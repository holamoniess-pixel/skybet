import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getToken as getSessionToken } from '../utils/session';
import { useCountry } from '../hooks/useCountry';

const API_BASE = "https://futballbackend-iw9o.onrender.com";

/* ─── UPDATED ───────────────────────────────────────────────────────────────
   Payment rails:

   • GHANA (GHS)  — RushPay REST API (direct Mobile Money collect).
     POST /api/wallet/deposit/rushpay/init  { amount, phone, provider, email }
     → { payment_reference, widget_session_token }
     Then POST core.rushpay.cash/api/v1/merchant/payments/initiate-mobile-money
     { payment_reference, phone, provider, email }
     Header: X-RushPay-Widget-Session: <widget_session_token>
     → { reference (chargeRef), requires_otp }
     If requires_otp → ask for OTP, POST core.rushpay.cash/.../submit-momo-otp
     Customer approves prompt on phone; we poll charge-status + payment-status
     until paid, then poll our backend until wallet credited.
     Customer NEVER leaves this page for GH.

   • NIGERIA (NGN) — Manual bank transfer (unchanged).
     Customer transfers, then submits proof via POST /api/wallet/bank-deposits.

   • ALL OTHER COUNTRIES — Crypto (Binance/manual) only.

   The RushPay widget SDK (window.RushPay.mount) is NOT used — we call
   RushPay Core's REST API directly using widget_session_token as auth header.
   This is the proven pattern. */

/* ─── DEBUG LOGGING ───────────────────────────────────────────────────────
   Every network call and state transition in the RushPay (GH) flow is now
   logged with a "[RushPay]" / "[BackendPoll]" prefix so a failed-to-credit
   deposit can be traced end-to-end from the browser console:
     [RushPay][init]                 — our backend creates the checkout
     [RushPay][initiate-mobile-money]— RushPay Core starts the MoMo charge
     [RushPay][otp]                  — OTP/voucher submission (Telecel/AT)
     [RushPay][verify]               — customer says "I've approved", we ask
                                        RushPay Core if the charge is paid
     [BackendPoll]                   — we ask OUR backend if the wallet was
                                        actually credited (this is the ONLY
                                        step that means money landed)
   dlog() is a no-op wrapper so it's trivial to silence all of this later
   (e.g. behind a DEBUG flag) without touching every call site.
────────────────────────────────────────────────────────────────────────── */
const RUSHPAY_DEBUG = true;
const dlog  = (...args: unknown[]) => { if (RUSHPAY_DEBUG) console.log(...args); };
const dwarn = (...args: unknown[]) => { if (RUSHPAY_DEBUG) console.warn(...args); };
const derr  = (...args: unknown[]) => { if (RUSHPAY_DEBUG) console.error(...args); };

const ACCOUNT_PATH = "/account";

/* ─── RushPay ─────────────────────────────────────────────────────────────── */
const RUSHPAY_CORE = "https://core.rushpay.cash";
const RUSHPAY_STATUS_POLL_INTERVAL_MS = 3000;
const RUSHPAY_STATUS_POLL_MAX_ATTEMPTS = 40; // ~2 minutes

const MOMO_NETWORKS = [
  { id: "MTN",        provider: "mtn", label: "MTN MoMo",        },
  { id: "VODAFONE",   provider: "vod", label: "Telecel Cash",     },
  { id: "AIRTELTIGO", provider: "atl", label: "AirtelTigo Money", },
];

/* ─── Nigeria — Manual Bank Transfer ─────────────────────────────────────── */
const NG_MANUAL_BANK_NAME   = "Palmpay ";
const NG_MANUAL_ACCT_NAME   = "FARUQ ABIODUN TIAMIYU";
const NG_MANUAL_ACCT_NUMBER = "9070897735";
const NG_MIN_AMOUNT         = 31000;

/* ─── Business rule: single global minimum, always priced in USD ─────────── */
const MIN_DEPOSIT_USD = 25;
const GH_MIN_AMOUNT   = 290; // GHS minimum for RushPay

/* ─── Binance / Crypto Constants ─────────────────────────────────────────── */
const BINANCE_ADDRESS = "TZG9smK9bD6HNsmk8NcDMLCfrdhhfjcPg1";
const BINANCE_NETWORK = "TRC20";
const BINANCE_COIN    = "USDT";
const CRYPTO_COINS    = ["USDT", "BTC", "ETH", "BNB", "USDC"];
const CRYPTO_NETWORKS = ["TRC20", "BEP20", "ERC20", "Arbitrum", "Optimism"];

const BRAND            = "SkyBet";
const SUPPORT_EMAIL    = "support@skybet.com";
const SUPPORT_TELEGRAM = "skybet_Agent";

/* ─── ImgBB (screenshot hosting, crypto proof only) ─────────────────────── */
const IMGBB_API_KEY = "bdd12743a2e929bcdd4a6843dea9295e";

async function uploadToImgBB(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `ImgBB upload failed (${res.status})`);
  }
  const data = await res.json();
  const url: string = data?.data?.url;
  if (!url) throw new Error("ImgBB returned no URL — check your API key.");
  return url;
}

/* ─── Types & Data ─────────────────────────────────────────────────────────── */
type GatewayId = "rushpay_gh" | "ng_manual" | "binance";
type Market = "GH" | "NG";

interface Country {
  code: string;
  name: string;
  flag: string;
  flagImg: string;
  currency: string;
  symbol: string;
  gateways: GatewayId[];
}

const COUNTRIES: Country[] = [
  { code: "GH", name: "Ghana",          flag: "🇬🇭", flagImg: "https://flagcdn.com/w40/gh.png", currency: "GHS", symbol: "GH₵",  gateways: ["rushpay_gh", "binance"] },
  { code: "NG", name: "Nigeria",        flag: "🇳🇬", flagImg: "https://flagcdn.com/w40/ng.png", currency: "NGN", symbol: "₦",    gateways: ["ng_manual", "binance"] },
  { code: "KE", name: "Kenya",          flag: "🇰🇪", flagImg: "https://flagcdn.com/w40/ke.png", currency: "KES", symbol: "KSh",  gateways: ["binance"] },
  { code: "TZ", name: "Tanzania",       flag: "🇹🇿", flagImg: "https://flagcdn.com/w40/tz.png", currency: "TZS", symbol: "TSh",  gateways: ["binance"] },
  { code: "UG", name: "Uganda",         flag: "🇺🇬", flagImg: "https://flagcdn.com/w40/ug.png", currency: "UGX", symbol: "USh",  gateways: ["binance"] },
  { code: "SN", name: "Senegal",        flag: "🇸🇳", flagImg: "https://flagcdn.com/w40/sn.png", currency: "XOF", symbol: "CFA",  gateways: ["binance"] },
  { code: "CI", name: "Côte d'Ivoire",  flag: "🇨🇮", flagImg: "https://flagcdn.com/w40/ci.png", currency: "XOF", symbol: "CFA",  gateways: ["binance"] },
  { code: "CM", name: "Cameroon",       flag: "🇨🇲", flagImg: "https://flagcdn.com/w40/cm.png", currency: "XAF", symbol: "FCFA", gateways: ["binance"] },
  { code: "ZM", name: "Zambia",         flag: "🇿🇲", flagImg: "https://flagcdn.com/w40/zm.png", currency: "ZMW", symbol: "ZK",   gateways: ["binance"] },
  { code: "ZA", name: "South Africa",   flag: "🇿🇦", flagImg: "https://flagcdn.com/w40/za.png", currency: "ZAR", symbol: "R",    gateways: ["binance"] },
  { code: "US", name: "United States",  flag: "🇺🇸", flagImg: "https://flagcdn.com/w40/us.png", currency: "USD", symbol: "$",    gateways: ["binance"] },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", flagImg: "https://flagcdn.com/w40/gb.png", currency: "GBP", symbol: "£",    gateways: ["binance"] },
  { code: "DE", name: "Germany",        flag: "🇩🇪", flagImg: "https://flagcdn.com/w40/de.png", currency: "EUR", symbol: "€",    gateways: ["binance"] },
  { code: "FR", name: "France",         flag: "🇫🇷", flagImg: "https://flagcdn.com/w40/fr.png", currency: "EUR", symbol: "€",    gateways: ["binance"] },
];

const GATEWAY_META: Record<GatewayId, { matIcon: string; label: string; sub: string }> = {
  rushpay_gh: { matIcon: "smartphone",       label: "Mobile Money", sub: "Approve on your phone · RushPay" },
  ng_manual:  { matIcon: "account_balance",  label: "Bank Transfer", sub: "Manual review · transfer proof" },
  binance:    { matIcon: "currency_bitcoin", label: "Crypto",        sub: "USDT · BTC · ETH · BNB" },
};

/* ─── Design Tokens — monochrome: black / white / grey only ─────────────────── */
const T = {
  bg:        "#070b14",
  surface:   "#0d1422",
  raised:    "#121c30",
  raised2:   "#1a2740",
  border:    "rgba(96,165,250,0.12)",
  borderStrong: "rgba(96,165,250,0.22)",
  ink:       "#e8eefd",
  inkLow:    "rgba(232,238,253,0.08)",
  inkMid:    "rgba(232,238,253,0.22)",
  silver:    "#a8bcdc",
  silverLow: "rgba(168,188,220,0.10)",
  silverMid: "rgba(168,188,220,0.30)",
  white:     "#e8eefd",
  dim:       "rgba(232,238,253,0.40)",
  faint:     "rgba(96,165,250,0.06)",
  danger:    "#f87171",
  dangerLow: "rgba(224,32,32,0.08)",
  dangerMid: "rgba(224,32,32,0.28)",
};

/* ─── Stable style objects ───────────────────────────────────────────────────── */
const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: T.raised, border: `1px solid ${T.border}`,
  borderRadius: 10, padding: "11px 14px",
  color: T.white, fontSize: 14, outline: "none", fontFamily: "inherit",
  transition: "border 0.15s",
};

const btnPrimary: React.CSSProperties = {
  width: "100%", padding: "13px", border: "none", borderRadius: 10,
  fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em",
  background: T.white, color: "#0a0a0a",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  transition: "opacity 0.15s, transform 0.1s", fontFamily: "inherit",
};

const btnGold: React.CSSProperties = { ...btnPrimary };

const btnGhost: React.CSSProperties = {
  width: "100%", padding: "12px",
  background: "transparent", border: `1px solid ${T.border}`,
  borderRadius: 10, color: T.dim, fontSize: 12, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.02em",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
};

const lbl: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 700,
  color: T.dim, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6,
};

/* ══════════════════════════════════════════════════════════════════════════════
   RECEIPT MODEL
══════════════════════════════════════════════════════════════════════════════ */
type Outcome = "success" | "failed" | "pending";

interface ReceiptData {
  outcome: Outcome;
  method: string;
  usdAmount: string;
  localAmount: string;
  currency: string;
  symbol: string;
  customerName: string;
  reference: string;
  transactionId: string;
  issuedAt: string;
  receiptNo: string;
  extra?: [string, string][];
  pendingNote?: string;
}

function makeReceipt(o: Omit<ReceiptData, "issuedAt" | "receiptNo"> & { issuedAt?: string; receiptNo?: string }): ReceiptData {
  const issuedAt = o.issuedAt ?? new Date().toISOString();
  return {
    ...o,
    issuedAt,
    receiptNo: o.receiptNo ?? `CB-${new Date(issuedAt).getTime().toString(36).toUpperCase()}`,
  };
}

function fmtMoney(amount: string, symbol: string): string {
  if (!amount) return "—";
  const n = Number(amount);
  if (isNaN(n)) return `${symbol}${amount}`;
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
}

function statusWord(o: Outcome): string {
  return o === "success" ? "SUCCESSFUL" : o === "failed" ? "FAILED" : "AWAITING CONFIRMATION";
}

function receiptRows(r: ReceiptData): [string, string][] {
  return [
    ["Receipt no.",    r.receiptNo],
    ["Status",         statusWord(r.outcome)],
    ["Charged",        fmtMoney(r.localAmount, r.symbol)],
    ["Deposit value",  r.usdAmount ? `$${Number(r.usdAmount).toFixed(2)} USD` : "—"],
    ["Paid by",        r.customerName || "—"],
    ["Method",         r.method],
    ["Reference",      r.reference || "—"],
    ["Transaction ID", r.transactionId || "—"],
    ...(r.extra ?? []),
    ["Date",           fmtDate(r.issuedAt)],
    ["Merchant",       `${BRAND} · wallet deposit`],
  ];
}

function receiptToText(r: ReceiptData): string {
  const rule = "-".repeat(44);
  return [
    `${BRAND.toUpperCase()} — DEPOSIT RECEIPT`,
    rule,
    ...receiptRows(r).map(([k, v]) => `${(k + ":").padEnd(17)}${v}`),
    rule,
    `${BRAND} never stores your card, bank, or Mobile Money`,
    "details. Payments are processed by RushPay.",
    `Support: ${SUPPORT_EMAIL} · t.me/${SUPPORT_TELEGRAM}`,
    "",
  ].join("\n");
}

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ─── RushPay gateway helpers ────────────────────────────────────────────── */
type GwPayload = Record<string, unknown> | null | undefined;
const unwrap = (d: GwPayload): GwPayload =>
  d && typeof d === "object" && "data" in d ? (d.data as GwPayload) : d;
const gstr = (d: GwPayload, key: string): string => {
  const v = d?.[key]; return typeof v === "string" ? v : "";
};

/* ─── Small helpers ─────────────────────────────────────────────────────────── */
function FlagImg({ country, size = 24 }: { country: Country; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) return <span style={{ fontSize: size * 0.9, filter: "grayscale(1)" }}>{country.flag}</span>;
  return <img src={country.flagImg} alt={country.name} width={size} height={size * 0.67} onError={() => setErr(true)} style={{ borderRadius: 3, objectFit: "cover", flexShrink: 0, filter: "grayscale(1)" }} />;
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setOk(true); setTimeout(() => setOk(false), 2000); }}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "5px 13px", borderRadius: 6, cursor: "pointer", border: `1px solid ${ok ? T.borderStrong : T.silverMid}`, background: ok ? T.raised2 : T.silverLow, color: ok ? T.white : T.silver, transition: "all 0.2s", fontFamily: "inherit" }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{ok ? "check_circle" : "content_copy"}</span>
      {ok ? "Copied" : "Copy"}
    </button>
  );
}

function Spin() {
  return <span style={{ display: "inline-block", width: 15, height: 15, border: "2px solid rgba(255,255,255,0.18)", borderTopColor: "#fff", borderRadius: "50%", animation: "_spin 0.7s linear infinite" }} />;
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ background: T.dangerLow, border: `1px solid ${T.dangerMid}`, borderRadius: 10, padding: "10px 14px", color: T.danger, fontSize: 12, marginBottom: 16, lineHeight: 1.55, display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>warning</span>
      {msg}
    </div>
  );
}

function fmtLocal(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

/* ─── Sky mark ──────────────────────────────────────────────────────────── */
function SkyMark({ size = 30, color = T.white }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 32 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="7" r="4.4" fill="none" stroke={color} strokeWidth="1.4" />
      <path d="M4 20C1.8 20 0 18.2 0 16C0 13.8 1.8 12 4 12C4.5 9.6 6.7 8 9.2 8C12 8 14.3 10 14.7 12.7C17.4 12.9 19.5 15.1 19.5 17.8C19.5 20 17.6 20 15.5 20H4Z" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   RECEIPT
══════════════════════════════════════════════════════════════════════════════ */
function Receipt({ data }: { data: ReceiptData }) {
  const [copied, setCopied] = useState<"ref" | "all" | null>(null);
  const flash = (w: "ref" | "all") => { setCopied(w); setTimeout(() => setCopied(null), 1800); };

  const tone =
    data.outcome === "success" ? { icon: "check_circle", word: "Paid",       bg: T.inkLow,    bd: T.inkMid }
    : data.outcome === "failed" ? { icon: "cancel",       word: "Not paid",   bg: T.dangerLow, bd: T.dangerMid }
    : { icon: "hourglass_top", word: "Confirming", bg: T.silverLow, bd: T.silverMid };

  const rows = receiptRows(data).filter(([k]) => k !== "Receipt no." && k !== "Charged" && k !== "Deposit value");

  return (
    <div>
      <div className="_receipt" style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", textAlign: "left", marginBottom: 14 }}>
        <div className="_r-head" style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px dashed ${T.borderStrong}` }}>
          <div className="_r-mark" style={{ width: 32, height: 32, borderRadius: 8, background: T.raised2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <SkyMark size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="_r-brand" style={{ fontSize: 13, fontWeight: 800, color: T.white, letterSpacing: "-0.2px" }}>{BRAND} deposit receipt</div>
            <div className="_r-dim" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: T.dim }}>{data.receiptNo}</div>
          </div>
          <span className="_r-badge" style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
            color: T.white, background: tone.bg, border: `1px solid ${tone.bd}`,
            borderRadius: 20, padding: "4px 9px", whiteSpace: "nowrap",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{tone.icon}</span>
            {tone.word}
          </span>
        </div>

        <div style={{ padding: "18px 16px 14px", borderBottom: `1px dashed ${T.borderStrong}` }}>
          <div className="_r-dim" style={{ fontSize: 9, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 5 }}>Amount charged</div>
          <div className="_r-amt" style={{ fontSize: 30, fontWeight: 800, color: T.white, letterSpacing: "-1px", lineHeight: 1.05 }}>
            {fmtMoney(data.localAmount, data.symbol)}
          </div>
          <div className="_r-dim" style={{ fontSize: 11, color: T.dim, marginTop: 5 }}>
            {data.currency}
            {data.usdAmount ? <> · deposit value ${Number(data.usdAmount).toFixed(2)} USD</> : null}
          </div>
        </div>

        <div style={{ padding: "10px 16px 14px" }}>
          {rows.map(([k, v]) => (
            <div key={k} className="_r-row" style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", fontSize: 12, borderBottom: `1px solid ${T.faint}` }}>
              <span className="_r-dim" style={{ color: T.dim, flexShrink: 0 }}>{k}</span>
              <span style={{
                color: T.white, fontWeight: 600, textAlign: "right", wordBreak: "break-all", maxWidth: "62%",
                fontFamily: ["Reference", "Transaction ID", "TXID"].includes(k) ? "'DM Mono', monospace" : "inherit",
              }}>{v}</span>
            </div>
          ))}
        </div>

        <div className="_r-foot _r-dim" style={{ padding: "11px 16px 14px", borderTop: `1px dashed ${T.borderStrong}`, fontSize: 10, color: T.dim, lineHeight: 1.65 }}>
          {data.pendingNote ? <>{data.pendingNote}<br /></> : null}
          Card, bank and Mobile Money details are never stored by {BRAND}.<br />
          Questions? {SUPPORT_EMAIL} · t.me/{SUPPORT_TELEGRAM}
        </div>
      </div>

      <div className="_noprint" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <button onClick={async () => { if (await copyText(data.reference || data.transactionId)) flash("ref"); }}
          disabled={!data.reference && !data.transactionId}
          style={{ ...btnGhost, opacity: !data.reference && !data.transactionId ? 0.45 : 1 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{copied === "ref" ? "check" : "content_copy"}</span>
          {copied === "ref" ? "Copied" : "Copy reference"}
        </button>
        <button onClick={async () => { if (await copyText(receiptToText(data))) flash("all"); }} style={btnGhost}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{copied === "all" ? "check" : "assignment"}</span>
          {copied === "all" ? "Copied" : "Copy receipt"}
        </button>
      </div>
      <div className="_noprint" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <button onClick={() => window.print()} style={btnGhost}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>print</span>Print / save PDF
        </button>
        <button onClick={() => downloadText(`${data.receiptNo}.txt`, receiptToText(data))} style={btnGhost}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>Download
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   STEP INDICATOR
══════════════════════════════════════════════════════════════════════════════ */
function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="_noprint" style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800,
                background: done ? T.white : active ? T.inkLow : T.faint,
                border: `1.5px solid ${done || active ? T.white : T.border}`,
                color: done ? "#0a0a0a" : active ? T.white : T.dim,
                transition: "all 0.2s",
              }}>
                {done ? <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> : i + 1}
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: active || done ? T.white : T.dim, textTransform: "uppercase", letterSpacing: "0.4px", whiteSpace: "nowrap" }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1.5, background: done ? T.white : T.border, margin: "0 6px 16px", transition: "background 0.2s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   USD AMOUNT PICKER  (shared by Crypto flow)
══════════════════════════════════════════════════════════════════════════════ */
interface UsdAmountPickerProps {
  usdAmount: string;
  setUsdAmount: (v: string) => void;
  rate: number | null;
  symbol: string;
  error?: string;
}
function UsdAmountPicker({ usdAmount, setUsdAmount, rate, symbol, error }: UsdAmountPickerProps) {
  const QUICK = [25, 50, 100, 250, 500];
  const n = parseFloat(usdAmount);
  const localVal = rate && !isNaN(n) ? n * rate : null;

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>Amount (USD) <span style={{ color: T.danger }}>*</span></label>
      <div style={{ display: "flex", alignItems: "center", background: T.raised, border: `1px solid ${error ? T.dangerMid : T.border}`, borderRadius: 10, overflow: "hidden" }}>
        <span style={{ padding: "0 14px", fontSize: 15, color: T.dim, fontWeight: 700, borderRight: `1px solid ${T.border}` }}>$</span>
        <input type="number" min={MIN_DEPOSIT_USD} value={usdAmount} placeholder={String(MIN_DEPOSIT_USD)}
          onChange={e => setUsdAmount(e.target.value)}
          style={{ ...inp, border: "none", borderRadius: 0, background: "none", fontSize: 16, fontWeight: 700 }} />
      </div>
      {error && <div style={{ fontSize: 11, color: T.danger, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>{error}</div>}
      {!error && (
        <div style={{ fontSize: 11, color: T.dim, marginTop: 5 }}>
          {localVal !== null ? <>You'll be charged <strong style={{ color: T.white }}>{fmtLocal(localVal, symbol)}</strong> at today's rate</> : "Enter an amount to see the local equivalent"}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginTop: 10 }}>
        {QUICK.map(q => (
          <button key={q} onClick={() => setUsdAmount(String(q))}
            style={{ background: usdAmount === String(q) ? T.inkLow : T.faint, border: `1px solid ${usdAmount === String(q) ? T.white : T.border}`, borderRadius: 8, padding: "7px 0", color: usdAmount === String(q) ? T.white : T.dim, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.12s", fontFamily: "inherit" }}>
            ${q}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Trust Badges ── */
function TrustBadges() {
  return (
    <div className="_noprint" style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Trusted Payment Partners</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { label: "Mobile Money", matIcon: "smartphone",       desc: "Ghana · RushPay collect" },
          { label: "Bank Transfer", matIcon: "account_balance",  desc: "Nigeria · manual review" },
          { label: "Binance",      matIcon: "currency_bitcoin", desc: "Crypto · manual proof" },
        ].map(b => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6, background: T.faint, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.dim }}>{b.matIcon}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.white }}>{b.label}</div>
              <div style={{ fontSize: 9, color: T.dim }}>{b.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Country Dropdown ── */
interface CountryDropdownProps {
  country: Country | null;
  ipDetecting: boolean;
  onSelect: (c: Country) => void;
}
function CountryDropdown({ country, ipDetecting, onSelect }: CountryDropdownProps) {
  const [dropOpen, setDropOpen] = useState(false);
  const [search,   setSearch]   = useState("");
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.currency.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={dropRef} style={{ position: "relative" }}>
      <button onClick={() => setDropOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: T.raised, border: `1px solid ${dropOpen ? T.white : T.border}`, borderRadius: 10, padding: "11px 14px", cursor: "pointer", fontFamily: "inherit", transition: "border 0.15s" }}>
        {country ? (
          <><FlagImg country={country} size={24} /><span style={{ flex: 1, textAlign: "left", color: T.white, fontSize: 14, fontWeight: 600 }}>{country.name}</span><span style={{ fontSize: 11, color: T.dim, marginRight: 6 }}>{country.currency}</span></>
        ) : (
          <span style={{ flex: 1, textAlign: "left", color: T.dim, fontSize: 13 }}>Choose a country…</span>
        )}
        {ipDetecting && <span style={{ fontSize: 10, color: T.dim, display: "flex", alignItems: "center", gap: 4 }}><Spin /></span>}
        {!ipDetecting && country && <span className="material-symbols-outlined" style={{ fontSize: 14, color: T.silver }}>my_location</span>}
        <span className="material-symbols-outlined" style={{ color: T.dim, fontSize: 18, transform: dropOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>expand_more</span>
      </button>

      {dropOpen && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.7)", overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: T.dim }}>search</span>
            <input autoFocus type="text" placeholder="Search country or currency…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inp, padding: "6px 0", fontSize: 13, marginBottom: 0, background: "none", border: "none", flex: 1 }} />
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {filtered.map(c => {
              const hasCard = c.gateways.some(g => g === "rushpay_gh" || g === "ng_manual");
              const badge = c.code === "GH" ? "MOMO" : c.code === "NG" ? "BANK" : "CRYPTO";
              return (
                <button key={c.code} onClick={() => { onSelect(c); setDropOpen(false); setSearch(""); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: country?.code === c.code ? T.inkLow : "none", border: "none", borderBottom: `1px solid ${T.border}`, cursor: "pointer", fontFamily: "inherit", transition: "background 0.1s" }}>
                  <FlagImg country={c} size={22} />
                  <span style={{ flex: 1, textAlign: "left", color: T.white, fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                  <span style={{ fontSize: 10, color: T.dim, marginRight: 8 }}>{c.currency}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.05em", background: T.silverLow, color: T.silver, border: `1px solid ${T.silverMid}` }}>
                    {badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Gateway Tabs ── */
interface GatewayTabsProps {
  country: Country;
  gateway: GatewayId | null;
  onSelect: (gw: GatewayId) => void;
}
function GatewayTabs({ country, gateway, onSelect }: GatewayTabsProps) {
  if (!country || country.gateways.length <= 1) return null;
  const tabs = country.gateways;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, gap: 8 }}>
        {tabs.map(id => {
          const t = GATEWAY_META[id];
          const active = gateway === id;
          return (
            <button key={id} onClick={() => onSelect(id)}
              style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, padding: "13px 14px", background: active ? T.inkLow : T.raised, border: `1.5px solid ${active ? T.white : T.border}`, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: active ? T.white : T.dim }}>{t.matIcon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.white, lineHeight: 1.2 }}>{t.label}</span>
              <span style={{ fontSize: 9, color: T.dim, lineHeight: 1.4 }}>{t.sub}</span>
              {active && (
                <span style={{ fontSize: 9, fontWeight: 800, color: T.white, marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>check_circle</span>SELECTED
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Support Panel ── */
function SupportPanel() {
  const [supportOpen, setSupportOpen] = useState(false);
  return (
    <div className="_noprint" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginTop: 16, animation: "_fadeUp 0.3s ease" }}>
      <button onClick={() => setSupportOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.raised2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.white }}>support_agent</span>
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Need help? Contact Support</div>
          <div style={{ fontSize: 11, color: T.dim }}>We're online 24/7 — response in under 5 mins</div>
        </div>
        <span className="material-symbols-outlined" style={{ color: T.dim, fontSize: 18, transform: supportOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>expand_more</span>
      </button>
      {supportOpen && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "16px 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { matIcon: "chat", label: "Telegram Support", desc: `@${SUPPORT_TELEGRAM}`, href: `https://t.me/${SUPPORT_TELEGRAM}` },
              { matIcon: "mail", label: "Email Support",    desc: SUPPORT_EMAIL,          href: `mailto:${SUPPORT_EMAIL}` },
            ].map(ch => (
              <a key={ch.label} href={ch.href} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 12, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 13px", textDecoration: "none", transition: "border 0.15s" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: T.white, flexShrink: 0 }}>{ch.matIcon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.white }}>{ch.label}</div>
                  <div style={{ fontSize: 11, color: T.dim }}>{ch.desc}</div>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: T.dim }}>arrow_forward</span>
              </a>
            ))}
          </div>
          <div style={{ marginTop: 14, background: T.faint, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 13px", fontSize: 11, color: T.dim, lineHeight: 1.6, display: "flex", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: T.white, flexShrink: 0, marginTop: 1 }}>schedule</span>
            <span><strong style={{ color: T.white }}>Support hours:</strong> 24 hours, 7 days a week.<br />For deposit issues, have the <strong style={{ color: T.white }}>reference on your receipt</strong> ready.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── How To Deposit Panel ── */
function HowToDepositPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"gh" | "ng">("gh");

  const GUIDES: Record<"gh" | "ng", { icon: string; title: string; steps: string[] }> = {
    gh: {
      icon: "smartphone",
      title: "Ghana · Mobile Money",
      steps: [
        "Select Ghana as your country above.",
        "Pick Mobile Money, then enter your MoMo number (MTN, Telecel, or AirtelTigo) and the GHS amount.",
        `Tap "Send payment request" — RushPay pushes an approval prompt to your phone.`,
        "If prompted for an OTP or voucher code, enter it on the next screen.",
        "Open the MoMo prompt on your phone and approve it with your PIN.",
        "Stay on this page — it confirms automatically and your receipt appears once credited.",
      ],
    },
    ng: {
      icon: "account_balance",
      title: "Nigeria · Bank Transfer",
      steps: [
        "Select Nigeria as your country above.",
        "Pick Bank Transfer and note the account details shown.",
        "Transfer the amount from your bank app using the exact account number.",
        `Tap "I've sent the money" and fill in the proof form (reference, amount, screenshot).`,
        "Submit — an admin verifies your transfer and credits your wallet, usually within 5–15 minutes.",
      ],
    },
  };

  const active = GUIDES[tab];

  return (
    <div className="_noprint" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginTop: 16, animation: "_fadeUp 0.3s ease" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.raised2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.white }}>menu_book</span>
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.white }}>How to deposit</div>
          <div style={{ fontSize: 11, color: T.dim }}>Step-by-step for Ghana &amp; Nigeria</div>
        </div>
        <span className="material-symbols-outlined" style={{ color: T.dim, fontSize: 18, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>expand_more</span>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "16px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {(["gh", "ng"] as const).map(k => (
              <button key={k} onClick={() => setTab(k)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: tab === k ? T.inkLow : T.raised, border: `1.5px solid ${tab === k ? T.white : T.border}`, color: tab === k ? T.white : T.dim }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{GUIDES[k].icon}</span>
                {GUIDES[k].title}
              </button>
            ))}
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            {active.steps.map((s, i) => (
              <li key={i} style={{ fontSize: 12, color: T.dim, lineHeight: 1.6 }}>
                <span style={{ color: T.white }}>{s}</span>
              </li>
            ))}
          </ol>
          <div style={{ marginTop: 14, background: T.faint, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 13px", fontSize: 11, color: T.dim, lineHeight: 1.6, display: "flex", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: T.white, flexShrink: 0, marginTop: 1 }}>receipt_long</span>
            <span><strong style={{ color: T.white }}>Processed by RushPay (GH) or admin review (NG)</strong> — every deposit gets a printable receipt.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   GHANA — RUSHPAY MOBILE MONEY FORM
   User enters GHS amount, phone number, and MoMo network.
══════════════════════════════════════════════════════════════════════════════ */
interface GhFormProps {
  error: string;
  loading: boolean;
  phoneNumber: string; setPhoneNumber: (v: string) => void;
  ghAmount: string; setGhAmount: (v: string) => void;
  ghNetwork: string; setGhNetwork: (v: string) => void;
  errs: Record<string, string>;
  setErrs: (fn: (p: Record<string, string>) => Record<string, string>) => void;
  onSubmit: () => void;
}
function GhForm({ error, loading, phoneNumber, setPhoneNumber, ghAmount, setGhAmount, ghNetwork, setGhNetwork, errs, setErrs, onSubmit }: GhFormProps) {
  const QUICK_GHS = [200, 300, 500, 1000, 2000, 5000];
  const parsedAmt = parseFloat(ghAmount);
  const amtValid = !isNaN(parsedAmt) && parsedAmt >= GH_MIN_AMOUNT;

  return (
    <div>
      {error && <ErrBox msg={error} />}

      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>MoMo phone number <span style={{ color: T.danger }}>*</span></label>
        <input type="tel" value={phoneNumber}
          onChange={e => { setPhoneNumber(e.target.value); setErrs(p => ({ ...p, phoneNumber: "" })); }}
          placeholder="e.g. 0244 123 456" maxLength={10}
          style={{ ...inp, border: `1px solid ${errs.phoneNumber ? T.dangerMid : T.border}` }} />
        {errs.phoneNumber ? (
          <div style={{ fontSize: 11, color: T.danger, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>{errs.phoneNumber}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>Start with 0 — 10 digits. The approval prompt is sent to this number.</div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Amount (GH₵) <span style={{ color: T.danger }}>*</span></label>
        <input type="number" value={ghAmount} placeholder={`Min GH₵${GH_MIN_AMOUNT}`}
          onChange={e => { setGhAmount(e.target.value); setErrs(p => ({ ...p, amount: "" })); }}
          style={{ ...inp, border: `1px solid ${errs.amount ? T.dangerMid : T.border}` }} />
        {errs.amount && (
          <div style={{ fontSize: 11, color: T.danger, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>{errs.amount}
          </div>
        )}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
          {QUICK_GHS.map(a => (
            <button key={a} onClick={() => { setGhAmount(String(a)); setErrs(p => ({ ...p, amount: "" })); }}
              style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 20, cursor: "pointer", border: `1.5px solid ${ghAmount === String(a) ? T.white : T.border}`, background: ghAmount === String(a) ? T.inkLow : T.faint, color: ghAmount === String(a) ? T.white : T.dim, fontFamily: "inherit", transition: "all 0.12s" }}>
              GH₵{a.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Select network <span style={{ color: T.danger }}>*</span></label>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {MOMO_NETWORKS.map(n => (
            <button key={n.id} onClick={() => setGhNetwork(n.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, background: ghNetwork === n.id ? T.inkLow : T.raised, border: `1.5px solid ${ghNetwork === n.id ? T.white : T.border}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s" }}>
              <span style={{ flex: 1, textAlign: "left", color: T.white, fontSize: 13, fontWeight: 700 }}>{n.label}</span>
              {ghNetwork === n.id && (
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: T.white, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12, color: "#0a0a0a" }}>check</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 13px", marginBottom: 16, fontSize: 11, color: T.dim, lineHeight: 1.65, display: "flex", gap: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 15, color: T.white, flexShrink: 0, marginTop: 1 }}>lock</span>
        <span>
          RushPay sends a payment prompt straight to this number — you stay on this page.
          {" "}Approve it with your MoMo PIN and your receipt appears here automatically.
        </span>
      </div>

      <button onClick={onSubmit} disabled={loading || !amtValid}
        style={{ ...btnGold, opacity: loading || !amtValid ? 0.5 : 1, marginBottom: 8 }}>
        {loading
          ? <><Spin /> Initiating…</>
          : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>smartphone</span>Send payment request — GH₵{amtValid ? parsedAmt.toFixed(2) : "0.00"}</>}
      </button>
      <div style={{ textAlign: "center", fontSize: 11, color: T.dim, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>bolt</span>
        Powered by RushPay — credited within 1–5 minutes of approval
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   GHANA — OTP SCREEN (Telecel / AirtelTigo)
══════════════════════════════════════════════════════════════════════════════ */
interface GhOtpScreenProps {
  ghPhone: string;
  ghNetwork: string;
  ghOtpCode: string; setGhOtpCode: (v: string) => void;
  ghOtpErr: string;
  loading: boolean;
  onSubmit: () => void;
  onReset: () => void;
}
function GhOtpScreen({ ghPhone, ghNetwork, ghOtpCode, setGhOtpCode, ghOtpErr, loading, onSubmit, onReset }: GhOtpScreenProps) {
  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div className="_noprint" style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: T.inkLow, border: `2px solid ${T.inkMid}` }}>
        <span className="material-symbols-outlined" style={{ fontSize: 30, color: T.white }}>sms</span>
      </div>
      <div className="_noprint" style={{ fontWeight: 800, fontSize: 17, color: T.white, marginBottom: 6 }}>Enter verification code</div>
      <div className="_noprint" style={{ fontSize: 13, color: T.dim, lineHeight: 1.65, marginBottom: 18 }}>
        {ghNetwork === "VODAFONE"
          ? <>Enter your <strong style={{ color: T.white }}>Telecel voucher code</strong>.<br /><span style={{ fontSize: 11 }}>Dial *110# to generate one if needed.</span></>
          : <>Enter the OTP sent to <strong style={{ color: T.white }}>{ghPhone}</strong>.</>}
      </div>

      <div style={{ marginBottom: 16, textAlign: "left" }}>
        <label style={lbl}>{ghNetwork === "VODAFONE" ? "Telecel voucher code" : "OTP / verification code"} <span style={{ color: T.danger }}>*</span></label>
        <input type="text" inputMode="numeric" value={ghOtpCode} placeholder="••••••"
          maxLength={12} autoFocus
          onChange={e => setGhOtpCode(e.target.value.replace(/\D/g, ""))}
          style={{ ...inp, fontSize: 22, fontWeight: 800, letterSpacing: 8, textAlign: "center", border: `1.5px solid ${ghOtpErr ? T.dangerMid : T.white}` }} />
        {ghOtpErr && (
          <div style={{ fontSize: 11, color: T.danger, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>{ghOtpErr}
          </div>
        )}
      </div>

      <button onClick={onSubmit} disabled={loading || ghOtpCode.length < 4}
        style={{ ...btnGold, opacity: loading || ghOtpCode.length < 4 ? 0.5 : 1, marginBottom: 8 }}>
        {loading ? <><Spin /> Verifying…</> : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>Submit code</>}
      </button>
      <button onClick={onReset} style={btnGhost}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>Start over
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   GHANA — APPROVE SCREEN (customer approves prompt on phone)
══════════════════════════════════════════════════════════════════════════════ */
interface GhApproveScreenProps {
  ghPhone: string;
  ghAmount: string;
  ghNetwork: string;
  ghCountdown: number;
  ghVerifyInfo: string;
  loading: boolean;
  error: string;
  onVerify: () => void;
  onReset: () => void;
}
function GhApproveScreen({ ghPhone, ghAmount, ghNetwork, ghCountdown, ghVerifyInfo, loading, error, onVerify, onReset }: GhApproveScreenProps) {
  const parsedAmt = parseFloat(ghAmount);
  const netLabel = MOMO_NETWORKS.find(n => n.id === ghNetwork)?.label ?? ghNetwork;
  const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      {error && <ErrBox msg={error} />}

      {ghVerifyInfo && (
        <div style={{ background: T.inkLow, border: `1px solid ${T.inkMid}`, borderRadius: 10, padding: "10px 14px", color: T.white, fontSize: 12, marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>info</span>
          {ghVerifyInfo}
        </div>
      )}

      <div className="_noprint" style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: T.inkLow, border: `2px solid ${T.inkMid}` }}>
        <span className="material-symbols-outlined" style={{ fontSize: 30, color: T.white }}>vibration</span>
      </div>
      <div className="_noprint" style={{ fontWeight: 800, fontSize: 17, color: T.white, marginBottom: 6 }}>Approve on your phone</div>
      <div className="_noprint" style={{ fontSize: 13, color: T.dim, lineHeight: 1.65, marginBottom: 8 }}>
        A prompt was sent to <strong style={{ color: T.white }}>{ghPhone}</strong>.<br />
        Approve the <strong style={{ color: T.white }}>GH₵{parsedAmt.toFixed(2)}</strong> payment on {netLabel}.
      </div>
      {ghCountdown > 0
        ? <div style={{ fontSize: 12, color: T.dim, fontWeight: 700, marginBottom: 18 }}>Prompt expires in {fmt(ghCountdown)}</div>
        : <div style={{ fontSize: 12, color: T.danger, marginBottom: 18 }}>Prompt may have expired — verify below anyway</div>}

      <div style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 13px", marginBottom: 16, fontSize: 11, color: T.dim, lineHeight: 1.65, display: "flex", gap: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 15, color: T.white, flexShrink: 0, marginTop: 1 }}>info</span>
        <span>Once you've approved the prompt on your phone, tap the button below to confirm your deposit.</span>
      </div>

      <button onClick={onVerify} disabled={loading}
        style={{ ...btnGold, opacity: loading ? 0.5 : 1, marginBottom: 8 }}>
        {loading ? <><Spin /> Verifying…</> : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>task_alt</span>I've approved — verify payment</>}
      </button>
      <button onClick={onReset} style={btnGhost}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>Start over
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   GHANA — CREDITING SCREEN (backend poll after RushPay confirms)
══════════════════════════════════════════════════════════════════════════════ */
function GhCreditingScreen() {
  return (
    <div style={{ textAlign: "center", padding: "40px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <Spin />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 4 }}>Crediting your wallet…</div>
          <div style={{ fontSize: 12, color: T.dim }}>Payment confirmed. Updating your balance — this takes a few seconds.</div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   PENDING SCREEN — shared for GH post-success and NG post-submit waits
══════════════════════════════════════════════════════════════════════════════ */
interface PendingScreenProps {
  receipt: ReceiptData | null;
  polling: boolean; timedOut: boolean;
  checking: boolean; onCheckNow: () => void;
  onAccount: () => void; onReset: () => void;
  headline?: string; subtext?: React.ReactNode;
}
function PendingScreen({ receipt, polling, timedOut, checking, onCheckNow, onAccount, onReset, headline, subtext }: PendingScreenProps) {
  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div className="_noprint" style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: T.silverLow, border: `2px solid ${T.silverMid}` }}>
        <span className="material-symbols-outlined" style={{ fontSize: 30, color: T.silver }}>hourglass_top</span>
      </div>
      <div className="_noprint" style={{ fontWeight: 800, fontSize: 17, color: T.white, marginBottom: 6 }}>{headline ?? "Confirming your payment…"}</div>
      <div className="_noprint" style={{ fontSize: 13, color: T.dim, lineHeight: 1.65, marginBottom: 18 }}>
        {timedOut
          ? <>This is taking longer than usual. Your wallet is credited automatically once confirmed — nothing else is needed from you. If it's been over 15 minutes, send support the reference below.</>
          : (subtext ?? <>We're verifying your payment. This usually takes under a minute — no need to refresh.</>)}
      </div>

      {receipt && <Receipt data={receipt} />}

      {polling && !timedOut && (
        <div className="_noprint" style={{ fontSize: 11, color: T.dim, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 14 }}>
          <Spin /> Checking status automatically…
        </div>
      )}

      {timedOut && (
        <button className="_noprint" onClick={onCheckNow} disabled={checking} style={{ ...btnGhost, marginBottom: 8, opacity: checking ? 0.5 : 1 }}>
          {checking ? <><Spin /> Checking…</> : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>Check status now</>}
        </button>
      )}

      <button className="_noprint" onClick={onAccount} style={{ ...btnPrimary, marginBottom: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span>Back to my account
      </button>
      <button className="_noprint" onClick={onReset} style={btnGhost}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>Make another deposit
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   RESULT SCREEN — success and failure
══════════════════════════════════════════════════════════════════════════════ */
interface ResultScreenProps {
  outcome: "success" | "failed";
  receipt: ReceiptData | null;
  message?: string;
  onAccount: () => void; onReset: () => void;
}
function ResultScreen({ outcome, receipt, message, onAccount, onReset }: ResultScreenProps) {
  const isSuccess = outcome === "success";
  return (
    <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
      <div className="_noprint" style={{
        width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isSuccess ? T.inkLow : T.dangerLow,
        border: `2px solid ${isSuccess ? T.inkMid : T.dangerMid}`,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: isSuccess ? T.white : T.danger }}>
          {isSuccess ? "check_circle" : "error"}
        </span>
      </div>
      <div className="_noprint" style={{ fontWeight: 800, fontSize: 20, color: T.white, marginBottom: 6 }}>
        {isSuccess ? "Deposit successful" : "Deposit failed"}
      </div>
      <div className="_noprint" style={{ fontSize: 13, color: T.dim, lineHeight: 1.7, marginBottom: 18 }}>
        {isSuccess
          ? <>Your wallet has been credited. Here's your receipt — print it, download it, or just keep the reference.</>
          : <>{message || "The payment was declined or cancelled."} If you were charged, send support the reference on this receipt.</>}
      </div>

      {receipt && <Receipt data={receipt} />}

      <button className="_noprint" onClick={onAccount} style={{ ...btnPrimary, marginBottom: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span>Back to my account
      </button>
      <button className="_noprint" onClick={onReset} style={btnGhost}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>Make another deposit
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   GHANA — UNCONFIRMED SCREEN (RushPay says paid, but OUR backend never
   confirmed the wallet credit within the poll window, or the poll itself
   errored repeatedly). This is intentionally NOT the success screen — see
   the "false-success" bug note in startBackendPoll below.
══════════════════════════════════════════════════════════════════════════════ */
interface GhUnconfirmedScreenProps {
  receipt: ReceiptData | null;
  checking: boolean;
  onCheckNow: () => void;
  onAccount: () => void; onReset: () => void;
}
function GhUnconfirmedScreen({ receipt, checking, onCheckNow, onAccount, onReset }: GhUnconfirmedScreenProps) {
  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div className="_noprint" style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: T.dangerLow, border: `2px solid ${T.dangerMid}` }}>
        <span className="material-symbols-outlined" style={{ fontSize: 30, color: T.danger }}>hourglass_disabled</span>
      </div>
      <div className="_noprint" style={{ fontWeight: 800, fontSize: 17, color: T.white, marginBottom: 6 }}>We couldn't confirm your wallet credit yet</div>
      <div className="_noprint" style={{ fontSize: 13, color: T.dim, lineHeight: 1.65, marginBottom: 18 }}>
        RushPay confirmed your payment, but we haven't been able to verify it landed in your wallet yet.
        This does <strong style={{ color: T.white }}>not</strong> mean it failed — tap "Check again" below,
        or contact support with the reference on this receipt if it's been more than 15 minutes.
      </div>

      {receipt && <Receipt data={receipt} />}

      <button className="_noprint" onClick={onCheckNow} disabled={checking} style={{ ...btnGold, marginBottom: 8, opacity: checking ? 0.5 : 1 }}>
        {checking ? <><Spin /> Checking…</> : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>Check again</>}
      </button>
      <button className="_noprint" onClick={onAccount} style={{ ...btnPrimary, marginBottom: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span>Back to my account
      </button>
      <button className="_noprint" onClick={onReset} style={btnGhost}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>Make another deposit
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   NIGERIA — MANUAL BANK TRANSFER — INFO SCREEN
══════════════════════════════════════════════════════════════════════════════ */
interface NgManualInfoProps {
  error: string;
  onNext: () => void;
}
function NgManualInfo({ error, onNext }: NgManualInfoProps) {
  return (
    <div>
      {error && <ErrBox msg={error} />}

      <div style={{ background: T.inkLow, border: `1px solid ${T.inkMid}`, borderRadius: 10, padding: "10px 13px", marginBottom: 12, fontSize: 11, color: T.white, display: "flex", alignItems: "center", gap: 6 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, flexShrink: 0 }}>info</span>
        Minimum deposit: <strong>₦{NG_MIN_AMOUNT.toLocaleString()}</strong>
      </div>

      <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: T.raised2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ color: T.white, fontSize: 18 }}>account_balance</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.white }}>Transfer to this account</div>
            <div style={{ fontSize: 11, color: T.dim }}>Then submit your payment proof below</div>
          </div>
        </div>

        {[
          { icon: "corporate_fare", label: "Bank name",      value: NG_MANUAL_BANK_NAME,   mono: false },
          { icon: "person",         label: "Account name",   value: NG_MANUAL_ACCT_NAME,   mono: false },
          { icon: "tag",            label: "Account number", value: NG_MANUAL_ACCT_NUMBER, mono: true  },
        ].map(row => (
          <div key={row.label} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "11px 13px", marginBottom: 7 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 11, color: T.dim }}>{row.icon}</span>
              {row.label}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontFamily: row.mono ? "'DM Mono', monospace" : "inherit", fontSize: row.mono ? 17 : 13, fontWeight: 700, color: T.white, letterSpacing: row.mono ? 1 : 0 }}>{row.value}</span>
              <CopyBtn text={row.value} />
            </div>
          </div>
        ))}

        <div style={{ background: T.dangerLow, border: `1px solid ${T.dangerMid}`, borderRadius: 7, padding: "8px 11px", fontSize: 11, color: T.danger, lineHeight: 1.55, display: "flex", gap: 7 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>warning</span>
          Always use a reference you'll remember (your username or phone number) so we can match your payment.
        </div>
      </div>

      <button onClick={onNext} style={{ ...btnGold, marginBottom: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>task_alt</span>I've sent the money — submit proof
      </button>
      <div style={{ textAlign: "center", fontSize: 11, color: T.dim, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>manage_search</span>
        Verified by admin within 5–15 minutes
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   NIGERIA — MANUAL BANK TRANSFER — PROOF FORM
══════════════════════════════════════════════════════════════════════════════ */
interface NgManualProofProps {
  error: string;
  ngAmount: string; setNgAmount: (v: string) => void;
  ngRef: string; setNgRef: (v: string) => void;
  ngSender: string; setNgSender: (v: string) => void;
  ngPhone: string; setNgPhone: (v: string) => void;
  ngNote: string; setNgNote: (v: string) => void;
  ngScreenshot: string;
  ngCompressing: boolean;
  ngErrs: Record<string, string>; setNgErrs: (fn: (p: Record<string, string>) => Record<string, string>) => void;
  loading: boolean;
  onScreenshotChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onScreenshotRemove: () => void;
  onSubmit: () => void;
  onBack: () => void;
}
function NgManualProof({
  error, ngAmount, setNgAmount, ngRef, setNgRef, ngSender, setNgSender,
  ngPhone, setNgPhone, ngNote, setNgNote, ngScreenshot, ngCompressing,
  ngErrs, setNgErrs, loading, onScreenshotChange, onScreenshotRemove, onSubmit, onBack,
}: NgManualProofProps) {
  const QUICK_NGN = [50000, 100000, 200000, 500000, 1000000];
  const fe = (k: string) => ngErrs[k] ? <div style={{ fontSize: 11, color: T.danger, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>{ngErrs[k]}</div> : null;
  const fi = (k: string): React.CSSProperties => ({ ...inp, border: `1px solid ${ngErrs[k] ? T.dangerMid : T.border}` });

  return (
    <div>
      {error && <ErrBox msg={error} />}

      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Transfer reference / narration <span style={{ color: T.danger }}>*</span></label>
        <input type="text" value={ngRef}
          onChange={e => { setNgRef(e.target.value); setNgErrs(p => ({ ...p, ref: "" })); }}
          placeholder="Your name, username, or receipt reference" style={fi("ref")} />
        {fe("ref")}
        <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>Use the exact narration entered during the transfer.</div>
      </div>

      <div style={{ marginBottom: 6 }}>
        <label style={lbl}>Amount sent (₦) <span style={{ color: T.danger }}>*</span></label>
        <input type="number" value={ngAmount} placeholder={`Min ₦${NG_MIN_AMOUNT.toLocaleString()}`}
          onChange={e => { setNgAmount(e.target.value); setNgErrs(p => ({ ...p, amt: "" })); }}
          style={fi("amt")} />
        {fe("amt")}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
        {QUICK_NGN.map(a => (
          <button key={a}
            onClick={() => { setNgAmount(String(a)); setNgErrs(p => ({ ...p, amt: "" })); }}
            style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 20, cursor: "pointer", border: `1.5px solid ${ngAmount === String(a) ? T.white : T.border}`, background: ngAmount === String(a) ? T.inkLow : T.faint, color: ngAmount === String(a) ? T.white : T.dim, fontFamily: "inherit", transition: "all 0.12s" }}>
            ₦{a >= 1000 ? `${a / 1000}k` : a}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Sender account name <span style={{ color: T.dim, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
        <input type="text" value={ngSender} placeholder="Name on your bank account"
          onChange={e => setNgSender(e.target.value)} style={inp} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Phone number <span style={{ color: T.dim, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
        <input type="tel" value={ngPhone} placeholder="e.g. 08012345678"
          onChange={e => setNgPhone(e.target.value)} style={inp} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Payment screenshot <span style={{ color: T.danger }}>*</span></label>
        {ngScreenshot ? (
          <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}`, background: T.raised }}>
            <img src={ngScreenshot} alt="Payment screenshot" style={{ width: "100%", maxHeight: 180, objectFit: "contain", display: "block" }} />
            {ngCompressing && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}><Spin /></div>
            )}
            {!ngCompressing && (
              <div style={{ position: "absolute", top: 7, right: 7, display: "flex", gap: 5 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 5, cursor: "pointer", background: "rgba(0,0,0,0.7)", color: T.silver, fontFamily: "inherit" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>upload</span>Change
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={onScreenshotChange} />
                </label>
                <button onClick={onScreenshotRemove} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 5, cursor: "pointer", border: "none", background: T.dangerLow, color: T.danger, fontFamily: "inherit" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>Remove
                </button>
              </div>
            )}
            {!ngCompressing && (
              <div style={{ position: "absolute", bottom: 7, left: 7, fontSize: 9.5, fontWeight: 800, padding: "3px 8px", borderRadius: 20, background: "rgba(0,0,0,0.7)", color: T.white, display: "flex", alignItems: "center", gap: 3 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>check</span>Ready
              </div>
            )}
          </div>
        ) : (
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 86, border: `2px dashed ${ngErrs.screenshot ? T.dangerMid : T.border}`, borderRadius: 8, cursor: ngCompressing ? "wait" : "pointer", background: T.faint, transition: "all 0.15s" }}>
            {ngCompressing
              ? <><Spin /><span style={{ fontSize: 11.5, color: T.dim, marginTop: 6 }}>Processing…</span></>
              : <>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: T.dim, marginBottom: 5 }}>add_photo_alternate</span>
                <span style={{ fontSize: 12, color: T.dim, fontWeight: 600 }}>Tap or drag screenshot here</span>
                <span style={{ fontSize: 10, color: T.dim, marginTop: 2, opacity: 0.5 }}>JPG · PNG · WEBP</span>
              </>}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={onScreenshotChange} />
          </label>
        )}
        {fe("screenshot")}
        {!ngErrs.screenshot && ngScreenshot && !ngCompressing && (
          <div style={{ fontSize: 11, color: T.white, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>Screenshot attached
          </div>
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={lbl}>Note to admin <span style={{ color: T.dim, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
        <textarea value={ngNote} onChange={e => setNgNote(e.target.value)}
          placeholder="Any extra info" rows={3}
          style={{ ...inp, resize: "vertical", lineHeight: 1.6 } as React.CSSProperties} />
      </div>

      <button onClick={onSubmit} disabled={loading || ngCompressing}
        style={{ ...btnGold, opacity: loading || ngCompressing ? 0.38 : 1, marginBottom: 8 }}>
        {loading ? <><Spin /> Submitting…</> : ngCompressing ? <><Spin /> Processing image…</> : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload_file</span>Submit payment proof</>}
      </button>
      <button onClick={onBack} style={btnGhost}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>Back
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   NIGERIA — PENDING ADMIN REVIEW
══════════════════════════════════════════════════════════════════════════════ */
function NgManualPendingScreen({ onAccount, onReset }: { onAccount: () => void; onReset: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
      <div className="_noprint" style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: T.silverLow, border: `2px solid ${T.silverMid}` }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: T.silver }}>hourglass_top</span>
      </div>
      <div className="_noprint" style={{ fontWeight: 800, fontSize: 20, color: T.white, marginBottom: 6 }}>Proof submitted</div>
      <div className="_noprint" style={{ fontSize: 13, color: T.dim, lineHeight: 1.7, marginBottom: 18 }}>
        Your bank transfer is under review. An admin will verify and credit your wallet — usually within <strong style={{ color: T.white }}>5–15 minutes</strong>.
      </div>
      <button className="_noprint" onClick={onAccount} style={{ ...btnPrimary, marginBottom: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span>Back to my account
      </button>
      <button className="_noprint" onClick={onReset} style={btnGhost}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>Make another deposit
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   BINANCE / CRYPTO  (still manual — unchanged from original)
══════════════════════════════════════════════════════════════════════════════ */
interface BinanceScreenshotUploaderProps {
  screenshot: string; preview: string; uploading: boolean; error?: string;
  onFileChange: (file: File) => void; onRemove: () => void;
}
function BinanceScreenshotUploader({ screenshot, preview, uploading, error, onFileChange, onRemove }: BinanceScreenshotUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) onFileChange(file); };
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>
        Payment Screenshot{" "}
        <span style={{ color: T.dim, textTransform: "none", fontSize: 10 }}>(recommended · auto-uploaded)</span>
      </label>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleInputChange} />
      <button type="button" onClick={() => !uploading && fileInputRef.current?.click()}
        style={{
          position: "relative", width: "100%",
          padding: preview ? 0 : "20px 16px",
          borderRadius: 10, cursor: uploading ? "wait" : "pointer",
          boxSizing: "border-box", overflow: "hidden",
          background: screenshot ? T.inkLow : T.faint,
          border: `2px dashed ${error ? T.dangerMid : screenshot ? T.inkMid : T.border}`,
          color: screenshot ? T.white : T.dim,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
          fontFamily: "inherit", transition: "all 0.2s",
        }}>
        {preview ? (
          <img src={preview} alt="Payment proof" style={{ width: "100%", maxHeight: 180, objectFit: "contain", opacity: uploading ? 0.5 : 1, display: "block" }} />
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 28 }}>add_photo_alternate</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Tap to upload screenshot</span>
            <span style={{ fontSize: 10, color: "rgba(245,245,240,0.2)" }}>PNG · JPG · WEBP — max 10 MB</span>
          </>
        )}
        {uploading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Spin /><span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>Uploading…</span>
          </div>
        )}
      </button>
      {screenshot && !uploading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <div style={{ fontSize: 11, color: T.white, display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>
            Uploaded — tap image to change
          </div>
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 6, cursor: "pointer", border: "none", background: T.dangerLow, color: T.danger, fontFamily: "inherit" }}>
            Remove
          </button>
        </div>
      )}
      {error && (
        <div style={{ fontSize: 11, color: T.danger, marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>{error}
        </div>
      )}
      {!screenshot && !uploading && !error && (
        <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>
          Optional but speeds up admin verification. Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: T.white }}>{SUPPORT_EMAIL}</a>{" "}
          if you prefer to attach later.
        </div>
      )}
    </div>
  );
}

function BinanceInfo({ error, minLocalLabel, onNext }: { error: string; minLocalLabel: string; onNext: () => void }) {
  return (
    <div>
      {error && <ErrBox msg={error} />}
      <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: T.raised2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ color: T.white, fontSize: 18 }}>currency_bitcoin</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.white }}>Send USDT to this address</div>
            <div style={{ fontSize: 11, color: T.dim }}>Network: <strong style={{ color: T.white }}>{BINANCE_NETWORK} (TRON)</strong></div>
          </div>
        </div>
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "11px 13px", marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>Wallet Address</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.white, wordBreak: "break-all", lineHeight: 1.7, marginBottom: 10 }}>{BINANCE_ADDRESS}</div>
          <CopyBtn text={BINANCE_ADDRESS} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
          {[["Network", BINANCE_NETWORK], ["Coin", BINANCE_COIN], ["Min.", `$${MIN_DEPOSIT_USD}`]].map(([l, v]) => (
            <div key={l} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 5px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: T.dim, marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.white }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background: T.dangerLow, border: `1px solid ${T.dangerMid}`, borderRadius: 7, padding: "8px 11px", fontSize: 11, color: T.danger, lineHeight: 1.55, display: "flex", gap: 7 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>warning</span>
          Only send <strong>USDT via TRC20</strong>. Wrong network = <strong>permanent loss of funds</strong>. Minimum deposit is <strong>${MIN_DEPOSIT_USD}</strong> ({minLocalLabel}).
        </div>
      </div>
      <div style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Also Accepted</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CRYPTO_COINS.map(c => (
            <span key={c} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: T.silverLow, color: T.silver, border: `1px solid ${T.silverMid}` }}>{c}</span>
          ))}
        </div>
      </div>
      <div style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: T.white, flexShrink: 0 }}>account_balance_wallet</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: T.white }}>New to Binance?</div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 2, lineHeight: 1.4 }}>Create a free account to buy &amp; send crypto in minutes.</div>
        </div>
        <a href="https://www.binance.com/en/register" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 800, padding: "7px 13px", borderRadius: 8, background: T.white, color: "#0a0a0a", textDecoration: "none", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
          Sign Up <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
        </a>
      </div>
      <button onClick={onNext} style={{ ...btnPrimary, marginBottom: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>receipt_long</span>I've Sent — Submit Proof
      </button>
      <div style={{ textAlign: "center", fontSize: 11, color: T.dim, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>manage_search</span>
        Reviewed &amp; credited within 1–5 mins
      </div>
    </div>
  );
}

interface BinanceProofProps {
  error: string;
  txid: string; setTxid: (v: string) => void;
  cryptoAmt: string; setCryptoAmt: (v: string) => void;
  coin: string; setCoin: (v: string) => void;
  cryptoNet: string; setCryptoNet: (v: string) => void;
  usdAmount: string; setUsdAmount: (v: string) => void;
  rate: number | null; symbol: string;
  senderAddr: string; setSenderAddr: (v: string) => void;
  userNote: string; setUserNote: (v: string) => void;
  screenshotUrl: string; screenshotPreview: string; screenshotUploading: boolean;
  onScreenshotFile: (file: File) => void; onScreenshotRemove: () => void;
  bErrs: Record<string, string>; setBErrs: (fn: (p: Record<string, string>) => Record<string, string>) => void;
  loading: boolean; onSubmit: () => void; onBack: () => void;
}
function BinanceProof({
  error, txid, setTxid, cryptoAmt, setCryptoAmt, coin, setCoin, cryptoNet, setCryptoNet,
  usdAmount, setUsdAmount, rate, symbol, senderAddr, setSenderAddr, userNote, setUserNote,
  screenshotUrl, screenshotPreview, screenshotUploading, onScreenshotFile, onScreenshotRemove,
  bErrs, setBErrs, loading, onSubmit, onBack,
}: BinanceProofProps) {
  const fe = (k: string) => bErrs[k] ? <div style={{ fontSize: 11, color: T.danger, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>{bErrs[k]}</div> : null;
  const fi = (k: string): React.CSSProperties => ({ ...inp, border: `1px solid ${bErrs[k] ? T.dangerMid : T.border}` });
  const submitDisabled = loading || screenshotUploading;

  return (
    <div>
      {error && <ErrBox msg={error} />}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Transaction Hash (TXID) <span style={{ color: T.danger }}>*</span></label>
        <input type="text" value={txid}
          onChange={e => { setTxid(e.target.value); setBErrs(p => ({ ...p, txid: "" })); }}
          placeholder="Paste blockchain TXID" style={fi("txid")} />
        {fe("txid")}
        <div style={{ fontSize: 11, color: T.dim, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>info</span>Find in your Binance withdrawal history. Must be 10–128 characters.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label style={lbl}>Coin <span style={{ color: T.danger }}>*</span></label>
          <select value={coin} onChange={e => setCoin(e.target.value)} style={{ ...inp, appearance: "none" as const }}>
            {CRYPTO_COINS.map(c => <option key={c} style={{ background: "#141414" }}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Network <span style={{ color: T.danger }}>*</span></label>
          <select value={cryptoNet} onChange={e => setCryptoNet(e.target.value)} style={{ ...inp, appearance: "none" as const }}>
            {CRYPTO_NETWORKS.map(n => <option key={n} style={{ background: "#141414" }}>{n}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Amount Sent ({coin}) <span style={{ color: T.danger }}>*</span></label>
        <input type="number" value={cryptoAmt} placeholder="0.00" min="0" step="any"
          onChange={e => { setCryptoAmt(e.target.value); setBErrs(p => ({ ...p, cryptoAmt: "" })); }} style={fi("cryptoAmt")} />
        {fe("cryptoAmt")}
      </div>

      <UsdAmountPicker usdAmount={usdAmount} setUsdAmount={setUsdAmount} rate={rate} symbol={symbol} error={bErrs.usdAmount} />

      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Sender Wallet <span style={{ color: T.dim, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
        <input type="text" value={senderAddr} placeholder="Address you sent from"
          onChange={e => { setSenderAddr(e.target.value); setBErrs(p => ({ ...p, senderAddr: "" })); }} style={fi("senderAddr")} />
        {fe("senderAddr")}
      </div>
      <BinanceScreenshotUploader
        screenshot={screenshotUrl} preview={screenshotPreview} uploading={screenshotUploading}
        error={bErrs.screenshot} onFileChange={onScreenshotFile} onRemove={onScreenshotRemove}
      />
      <div style={{ marginBottom: 18 }}>
        <label style={lbl}>Note to Admin <span style={{ color: T.dim, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
        <textarea value={userNote}
          onChange={e => { setUserNote(e.target.value); setBErrs(p => ({ ...p, userNote: "" })); }}
          placeholder="Any extra info" rows={3}
          style={{ ...fi("userNote"), resize: "vertical", lineHeight: 1.6 } as React.CSSProperties} />
        {fe("userNote")}
      </div>
      <button onClick={onSubmit} disabled={submitDisabled} style={{ ...btnPrimary, opacity: submitDisabled ? 0.38 : 1, marginBottom: 8 }}>
        {loading ? <><Spin /> Submitting…</> : screenshotUploading ? <><Spin /> Uploading screenshot…</> : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload_file</span>Submit Deposit Proof</>}
      </button>
      <button onClick={onBack} style={btnGhost}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>Back
      </button>
    </div>
  );
}

function CryptoSubmitted({ receipt, onAccount, onReset }: { receipt: ReceiptData | null; onAccount: () => void; onReset: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
      <div className="_noprint" style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: T.inkLow, border: `2px solid ${T.inkMid}` }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: T.white }}>hourglass_top</span>
      </div>
      <div className="_noprint" style={{ fontWeight: 800, fontSize: 20, color: T.white, marginBottom: 6 }}>Proof submitted</div>
      <div className="_noprint" style={{ fontSize: 13, color: T.dim, lineHeight: 1.7, marginBottom: 18 }}>
        Your crypto deposit is under review. Admin will credit your {BRAND} wallet within <strong style={{ color: T.white }}>1–5 minutes</strong>. Keep this receipt.
      </div>

      {receipt && <Receipt data={receipt} />}

      <button className="_noprint" onClick={onAccount} style={{ ...btnPrimary, marginBottom: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span>Back to my account
      </button>
      <button className="_noprint" onClick={onReset} style={btnGhost}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>Make another deposit
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
type Step =
  | "form"
  /* Ghana — RushPay MoMo */
  | "gh_form" | "gh_otp" | "gh_approve" | "gh_crediting" | "gh_success" | "gh_failed" | "gh_unconfirmed"
  /* Nigeria — Manual bank transfer */
  | "ng_info" | "ng_proof" | "ng_pending"
  /* Crypto */
  | "crypto_info" | "crypto_proof" | "crypto_success";

export default function DepositPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = getSessionToken();
    if (!t) navigate("/login", { replace: true });
  }, [navigate]);

  const tok = () => getSessionToken() || "";

  const [country,     setCountry]     = useState<Country | null>(null);
  const [gateway,     setGateway]     = useState<GatewayId | null>(null);
  const [ipDetecting, setIpDetecting] = useState(true);
  const { country: registeredCountry } = useCountry();

  const [error,       setError]       = useState("");
  const [failMessage, setFailMessage] = useState<string | undefined>(undefined);
  const [receipt,     setReceipt]     = useState<ReceiptData | null>(null);
  const [step,        setStep]        = useState<Step>("form");

  /* ─── GH — RushPay state ─── */
  const [ghAmount,      setGhAmount]      = useState("");
  const [ghPhone,       setGhPhone]       = useState("");
  const [ghNetwork,     setGhNetwork]     = useState("MTN");
  const [ghPaymentRef,  setGhPaymentRef]  = useState("");
  const [ghWidgetToken, setGhWidgetToken] = useState("");
  const [ghChargeRef,   setGhChargeRef]   = useState("");
  const [ghOtpCode,     setGhOtpCode]     = useState("");
  const [ghOtpErr,      setGhOtpErr]      = useState("");
  const [ghCountdown,   setGhCountdown]   = useState(120);
  const [ghVerifyInfo,  setGhVerifyInfo]  = useState("");
  const [ghErrs,        setGhErrs]        = useState<Record<string, string>>({});
  const [ghLoading,     setGhLoading]     = useState(false);
  /* Manual "check again" button on the unconfirmed screen. */
  const [ghChecking,    setGhChecking]    = useState(false);

  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);

  /* ─── NG — Manual state ─── */
  const [ngAmount,      setNgAmount]      = useState("");
  const [ngRef,         setNgRef]         = useState("");
  const [ngSender,      setNgSender]      = useState("");
  const [ngPhone,       setNgPhone]       = useState("");
  const [ngNote,        setNgNote]        = useState("");
  const [ngScreenshot,  setNgScreenshot]  = useState("");
  const [ngCompressing, setNgCompressing] = useState(false);
  const [ngErrs,        setNgErrs]        = useState<Record<string, string>>({});
  const [ngLoading,     setNgLoading]     = useState(false);

  /* ─── Crypto state ─── */
  const [loading,             setLoading]             = useState(false);
  const [txid,                setTxid]                = useState("");
  const [cryptoAmt,           setCryptoAmt]           = useState("");
  const [coin,                setCoin]                = useState(BINANCE_COIN);
  const [cryptoNet,           setCryptoNet]           = useState(BINANCE_NETWORK);
  const [cryptoUsd,           setCryptoUsd]           = useState(String(MIN_DEPOSIT_USD));
  const [senderAddr,          setSenderAddr]          = useState("");
  const [userNote,            setUserNote]            = useState("");
  const [bErrs,               setBErrs]               = useState<Record<string, string>>({});
  const [screenshotUrl,       setScreenshotUrl]       = useState("");
  const [screenshotPreview,   setScreenshotPreview]   = useState("");
  const [screenshotUploading, setScreenshotUploading] = useState(false);

  /* ─── FX rates (display only — backend is source of truth for charge amounts) ─── */
  const USD_RATES: Record<string, number> = {
    GHS: 11.5, NGN: 1380, KES: 129, TZS: 2680, UGX: 3650,
    XOF: 575, XAF: 575, ZMW: 27, ZAR: 17.7,
    USD: 1, GBP: 0.75, EUR: 0.87,
  };

  const rateFor = useCallback((cur: string) => USD_RATES[cur] ?? 1, []);
  const currentRate   = country ? rateFor(country.currency) : null;
  const currentSymbol = country?.symbol ?? "$";

  /* ─── HTTP helpers ─── */
  const request = async (path: string, init?: RequestInit) => {
    dlog("[HTTP] →", init?.method || "GET", path, init?.body ? JSON.parse(init.body as string) : undefined);
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}`, ...(init?.headers || {}) },
    });
    const text = await res.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON */ }
    if (!res.ok) {
      derr("[HTTP] ✗", init?.method || "GET", path, "status", res.status, "body", data);
      throw new Error(data?.message || data?.error || `Server error ${res.status}`);
    }
    dlog("[HTTP] ✓", init?.method || "GET", path, "status", res.status, "body", data);
    return data;
  };
  const post      = (path: string, body: object)        => request(path, { method: "POST", body: JSON.stringify(body) });
  const backendGet = (path: string)                     => request(path);

  /** Call RushPay Core REST API using widget_session_token as auth header. */
  const rushpayPost = async (path: string, body: object, widgetToken: string) => {
    dlog("[RushPayCore] →", path, body);
    const res = await fetch(`${RUSHPAY_CORE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-RushPay-Widget-Session": widgetToken },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      derr("[RushPayCore] ✗", path, "status", res.status, "body", data);
      throw new Error(data?.message || `RushPay error (${res.status}).`);
    }
    dlog("[RushPayCore] ✓", path, "status", res.status, "body", data);
    return data;
  };

  const rushpayGet = async (path: string, widgetToken: string) => {
    dlog("[RushPayCore] →", path);
    const res = await fetch(`${RUSHPAY_CORE}${path}`, {
      method: "GET",
      headers: { "X-RushPay-Widget-Session": widgetToken },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      derr("[RushPayCore] ✗", path, "status", res.status, "body", data);
      throw new Error(data?.message || `RushPay error (${res.status}).`);
    }
    dlog("[RushPayCore] ✓", path, "status", res.status, "body", data);
    return data;
  };

  /* ─── Cleanup ─── */
  useEffect(() => () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  /* ─── GH countdown (starts when entering gh_approve) ─── */
  useEffect(() => {
    if (step === "gh_approve") {
      setGhCountdown(120);
      countdownRef.current = setInterval(() => {
        setGhCountdown(p => { if (p <= 1) { clearInterval(countdownRef.current!); return 0; } return p - 1; });
      }, 1000);
    } else {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    }
  }, [step]);

  /* ─── Log every step transition — makes it trivial to see exactly where a
         given deposit attempt stopped progressing, straight from the console. ─── */
  useEffect(() => {
    dlog("[Step] →", step);
  }, [step]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
  }, []);

  /* ─── GH Phase 1: init checkout + RushPay MoMo ─── */
  const validateGh = () => {
    const e: Record<string, string> = {};
    const digits = ghPhone.replace(/\D/g, "");
    if (!digits || digits.length < 9) e.phoneNumber = "Enter a valid 10-digit MoMo number";
    const amt = parseFloat(ghAmount);
    if (!amt || isNaN(amt) || amt < GH_MIN_AMOUNT) e.amount = `Minimum deposit is GH₵${GH_MIN_AMOUNT}`;
    setGhErrs(e);
    if (Object.keys(e).length) dwarn("[RushPay][init] validation failed", e);
    return Object.keys(e).length === 0;
  };

  const handleGhSubmit = async () => {
    if (!validateGh()) return;
    setGhLoading(true); setError("");
    const currentNet = MOMO_NETWORKS.find(n => n.id === ghNetwork)!;
    dlog("[RushPay][init] submitting", { amount: ghAmount, phone: ghPhone, provider: currentNet.provider });

    try {
      // Step 1 — our backend: create RushPay checkout + widget session
      const initRaw = await post("/api/wallet/deposit/rushpay/init", {
        amount: parseFloat(ghAmount),
        phone: ghPhone.trim(),
        provider: currentNet.provider,
        email: `user@skybet.deposit`,
      });
      const initData = unwrap(initRaw as GwPayload);
      const pRef    = gstr(initData, "payment_reference") || gstr(initData, "paymentReference");
      const wToken  = gstr(initData, "widget_session_token") || gstr(initData, "widgetSessionToken");
      if (!pRef || !wToken) {
        derr("[RushPay][init] backend response missing payment_reference/widget_session_token", initData);
        throw new Error("Could not start payment. Please try again.");
      }
      setGhPaymentRef(pRef);
      setGhWidgetToken(wToken);
      dlog("[RushPay][init] got payment_reference + widget_session_token", { pRef });

      try { localStorage.setItem("rushpay_pending", JSON.stringify({ ref: pRef, ts: Date.now() })); } catch { /* ignore */ }

      // Step 2 — RushPay Core: initiate mobile money
      const momoRaw = await rushpayPost("/api/v1/merchant/payments/initiate-mobile-money", {
        payment_reference: pRef,
        email: `user@skybet.deposit`,
        phone: ghPhone.trim(),
        provider: currentNet.provider,
      }, wToken);
      const momo = unwrap(momoRaw as GwPayload);
      const cRef = gstr(momo, "reference") || gstr(momo, "charge_reference");
      setGhChargeRef(cRef);
      dlog("[RushPay][initiate-mobile-money] chargeRef set", { cRef, requires_otp: momo?.requires_otp });

      const needsOtp = momo?.requires_otp === true || momo?.requiresOtp === true;
      setGhLoading(false);
      setStep(needsOtp ? "gh_otp" : "gh_approve");
    } catch (e: unknown) {
      derr("[RushPay][init] FAILED", e);
      setError((e as Error).message);
      setGhLoading(false);
    }
  };

  /* ─── GH Phase 2: submit OTP ─── */
  const handleGhOtpSubmit = async () => {
    if (!ghOtpCode.trim()) { setGhOtpErr("Please enter the code from your phone"); return; }
    if (!ghChargeRef)      { setGhOtpErr("Missing payment reference. Please start over."); derr("[RushPay][otp] missing ghChargeRef — cannot submit"); return; }
    setGhOtpErr(""); setError(""); setGhLoading(true);
    dlog("[RushPay][otp] submitting", { ghChargeRef });
    try {
      const otpRaw = await rushpayPost("/api/v1/merchant/payments/submit-momo-otp", {
        reference: ghChargeRef,
        otp: ghOtpCode.trim(),
      }, ghWidgetToken);
      dlog("[RushPay][otp] accepted", otpRaw);
      setGhOtpCode("");
      setStep("gh_approve");
    } catch (e: unknown) {
      derr("[RushPay][otp] FAILED", e);
      setGhOtpErr((e as Error).message);
    } finally { setGhLoading(false); }
  };

  /* ─── GH Phase 3: verify via RushPay, then backend poll ─── */
  const handleGhVerify = async () => {
    if (!ghWidgetToken || !ghPaymentRef) { setError("Missing session. Please start over."); derr("[RushPay][verify] missing widgetToken/paymentRef"); return; }
    setError(""); setGhVerifyInfo(""); setGhLoading(true);
    dlog("[RushPay][verify] starting", { ghPaymentRef, ghChargeRef });
    try {
      let chargeStatus = "";
      if (ghChargeRef) {
        const chargeRaw = await rushpayGet(
          `/api/v1/merchant/payments/charge-status?reference=${encodeURIComponent(ghChargeRef)}`,
          ghWidgetToken,
        );
        const charge = unwrap(chargeRaw as GwPayload);
        chargeStatus = String(charge?.status || charge?.txstatus || "").toLowerCase();
        dlog("[RushPay][verify] charge-status", { chargeStatus });
      }

      const payRaw = await rushpayGet(
        `/api/v1/merchant/payments/status?payment_reference=${encodeURIComponent(ghPaymentRef)}`,
        ghWidgetToken,
      );
      const pay = unwrap(payRaw as GwPayload);
      const payStatus = String(pay?.status || "").toLowerCase();
      dlog("[RushPay][verify] payment status", { payStatus });

      const paid =
        pay?.paid === true || pay?.credited === true ||
        ["success", "completed", "paid", "successful"].includes(payStatus) ||
        ["success", "completed", "paid", "successful"].includes(chargeStatus);

      const failed =
        ["failed", "cancelled", "canceled", "declined"].includes(payStatus) ||
        ["failed", "cancelled", "canceled", "declined"].includes(chargeStatus);

      dlog("[RushPay][verify] resolved", { paid, failed });

      if (paid) {
        setGhLoading(false);
        setStep("gh_crediting");
        dlog("[RushPay][verify] RushPay confirms paid — handing off to backend credit poll", { ref: ghPaymentRef });
        startBackendPoll(ghPaymentRef);
      } else if (failed) {
        dwarn("[RushPay][verify] payment failed/cancelled at RushPay", { payStatus, chargeStatus });
        const receiptNo = `CB-${Date.now().toString(36).toUpperCase()}`;
        setFailMessage("Payment was cancelled or failed.");
        setReceipt(makeReceipt({
          outcome: "failed",
          method: `Mobile Money · RushPay (${MOMO_NETWORKS.find(n => n.id === ghNetwork)?.label ?? ghNetwork})`,
          usdAmount: "",
          localAmount: ghAmount,
          currency: "GHS", symbol: "GH₵",
          customerName: ghPhone,
          reference: ghPaymentRef,
          transactionId: ghChargeRef,
          receiptNo,
        }));
        setStep("gh_failed");
        setGhLoading(false);
      } else {
        dlog("[RushPay][verify] still pending — user must retry after approving on phone");
        setGhVerifyInfo("Payment still pending — approve the prompt on your phone, then verify again.");
        setGhLoading(false);
      }
    } catch (e: unknown) {
      derr("[RushPay][verify] FAILED", e);
      setError((e as Error).message);
      setGhLoading(false);
    }
  };

  /* ─── GH Phase 4: backend poll until wallet credited ───────────────────────
     FIX: previously, both the "max attempts reached" branch and the catch
     block's "max attempts reached" branch assumed success and jumped straight
     to `gh_success` — even though nobody had confirmed the wallet was ever
     credited. That is very likely why some users saw a "Deposit successful"
     receipt while their balance never moved: RushPay had confirmed the charge,
     but our own backend never got the chance to say "credited" before the
     poll gave up.

     Now: on timeout or repeated backend error we route to "gh_unconfirmed" —
     a screen that is explicit about NOT confirming the credit, offers a
     manual "check again" button, and points the user at support with their
     reference. We only ever show gh_success when the backend itself returns
     status === "success".
  ─────────────────────────────────────────────────────────────────────────── */
  const buildUnconfirmedReceipt = useCallback((ref: string) => makeReceipt({
    outcome: "pending",
    method: `Mobile Money · RushPay (${MOMO_NETWORKS.find(n => n.id === ghNetwork)?.label ?? ghNetwork})`,
    usdAmount: "",
    localAmount: ghAmount,
    currency: "GHS", symbol: "GH₵",
    customerName: ghPhone,
    reference: ref,
    transactionId: ghChargeRef,
    pendingNote: "RushPay confirmed this payment, but we could not yet confirm the wallet credit. This is not a failure — tap \"Check again\" or contact support with this reference.",
  }), [ghAmount, ghPhone, ghChargeRef, ghNetwork]);

  const startBackendPoll = useCallback((ref: string) => {
    pollAttemptsRef.current = 0;
    const tick = async () => {
      pollAttemptsRef.current += 1;
      const attempt = pollAttemptsRef.current;
      dlog(`[BackendPoll] attempt ${attempt}/${RUSHPAY_STATUS_POLL_MAX_ATTEMPTS} ref=${ref}`);
      try {
        const data = await backendGet(`/api/wallet/deposit/rushpay/status?ref=${encodeURIComponent(ref)}`);
        const status = (data?.data?.status ?? data?.status) as string | undefined;
        dlog(`[BackendPoll] attempt ${attempt} status='${status}'`, data);

        if (status === "success") {
          dlog("[BackendPoll] ✓ SUCCESS — backend confirms wallet credited", { ref, data });
          stopPolling();
          const receiptNo = `CB-${Date.now().toString(36).toUpperCase()}`;
          setReceipt(makeReceipt({
            outcome: "success",
            method: `Mobile Money · RushPay (${MOMO_NETWORKS.find(n => n.id === ghNetwork)?.label ?? ghNetwork})`,
            usdAmount: "",
            localAmount: ghAmount,
            currency: "GHS", symbol: "GH₵",
            customerName: ghPhone,
            reference: ref,
            transactionId: ghChargeRef,
            receiptNo,
          }));
          try { localStorage.removeItem("rushpay_pending"); } catch { /* ignore */ }
          setStep("gh_success");
          return;
        }
        if (status === "failed") {
          dwarn("[BackendPoll] backend reports FAILED", { ref, data });
          stopPolling();
          const receiptNo = `CB-${Date.now().toString(36).toUpperCase()}`;
          setFailMessage("Your payment was not successful. Please try again.");
          setReceipt(makeReceipt({
            outcome: "failed",
            method: `Mobile Money · RushPay (${MOMO_NETWORKS.find(n => n.id === ghNetwork)?.label ?? ghNetwork})`,
            usdAmount: "",
            localAmount: ghAmount,
            currency: "GHS", symbol: "GH₵",
            customerName: ghPhone,
            reference: ref,
            transactionId: ghChargeRef,
            receiptNo,
          }));
          setStep("gh_failed");
          return;
        }
        if (attempt >= RUSHPAY_STATUS_POLL_MAX_ATTEMPTS) {
          // FIXED: do NOT assume success. RushPay confirmed the charge, but our
          // backend never returned status === "success" within the poll window —
          // route to the honest "unconfirmed" screen instead of a false receipt.
          derr(
            "[BackendPoll] TIMED OUT after max attempts — wallet credit was NEVER CONFIRMED by the backend. " +
            "Routing to gh_unconfirmed instead of assuming success.",
            { ref, lastResponse: data }
          );
          stopPolling();
          setReceipt(buildUnconfirmedReceipt(ref));
          setStep("gh_unconfirmed");
          return;
        }
        pollTimerRef.current = setTimeout(tick, RUSHPAY_STATUS_POLL_INTERVAL_MS);
      } catch (err) {
        // FIXED: backend errors (e.g. 400 "Unknown payment reference" after a
        // restart, or a 500) used to be silently retried and — on timeout —
        // also routed to gh_success. Now every error is logged, and running
        // out of attempts routes to the honest "unconfirmed" screen too.
        derr(`[BackendPoll] attempt ${attempt} THREW — backend call failed`, err);
        if (attempt >= RUSHPAY_STATUS_POLL_MAX_ATTEMPTS) {
          derr("[BackendPoll] gave up after repeated errors — routing to gh_unconfirmed (credit was never confirmed)", { ref, err });
          stopPolling();
          setReceipt(buildUnconfirmedReceipt(ref));
          setStep("gh_unconfirmed");
          return;
        }
        pollTimerRef.current = setTimeout(tick, RUSHPAY_STATUS_POLL_INTERVAL_MS);
      }
    };
    tick();
  }, [stopPolling, ghAmount, ghPhone, ghChargeRef, ghNetwork, buildUnconfirmedReceipt]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Manual "Check again" button on the gh_unconfirmed screen — re-runs a single poll attempt. */
  const handleGhCheckNow = useCallback(async () => {
    if (!ghPaymentRef) { derr("[BackendPoll][manual] no ghPaymentRef to check"); return; }
    setGhChecking(true);
    dlog("[BackendPoll][manual] user-triggered check", { ref: ghPaymentRef });
    try {
      const data = await backendGet(`/api/wallet/deposit/rushpay/status?ref=${encodeURIComponent(ghPaymentRef)}`);
      const status = (data?.data?.status ?? data?.status) as string | undefined;
      dlog("[BackendPoll][manual] result", { status, data });
      if (status === "success") {
        const receiptNo = `CB-${Date.now().toString(36).toUpperCase()}`;
        setReceipt(makeReceipt({
          outcome: "success",
          method: `Mobile Money · RushPay (${MOMO_NETWORKS.find(n => n.id === ghNetwork)?.label ?? ghNetwork})`,
          usdAmount: "",
          localAmount: ghAmount,
          currency: "GHS", symbol: "GH₵",
          customerName: ghPhone,
          reference: ghPaymentRef,
          transactionId: ghChargeRef,
          receiptNo,
        }));
        try { localStorage.removeItem("rushpay_pending"); } catch { /* ignore */ }
        setStep("gh_success");
      } else if (status === "failed") {
        const receiptNo = `CB-${Date.now().toString(36).toUpperCase()}`;
        setFailMessage("Your payment was not successful. Please try again.");
        setReceipt(makeReceipt({
          outcome: "failed",
          method: `Mobile Money · RushPay (${MOMO_NETWORKS.find(n => n.id === ghNetwork)?.label ?? ghNetwork})`,
          usdAmount: "",
          localAmount: ghAmount,
          currency: "GHS", symbol: "GH₵",
          customerName: ghPhone,
          reference: ghPaymentRef,
          transactionId: ghChargeRef,
          receiptNo,
        }));
        setStep("gh_failed");
      } else {
        dlog("[BackendPoll][manual] still not confirmed", { status });
        setReceipt(buildUnconfirmedReceipt(ghPaymentRef));
      }
    } catch (e) {
      derr("[BackendPoll][manual] check FAILED", e);
      setReceipt(buildUnconfirmedReceipt(ghPaymentRef));
    } finally {
      setGhChecking(false);
    }
  }, [ghPaymentRef, ghAmount, ghPhone, ghChargeRef, ghNetwork, buildUnconfirmedReceipt]);

  /* ─── NG — image compression helper ─── */
  const compressImageToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image."));
      img.onload = () => {
        const MAX_W = 800;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        resolve(dataUrl.length > 524288 ? canvas.toDataURL("image/jpeg", 0.45) : dataUrl);
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });

  const handleNgScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNgCompressing(true);
    dlog("[NG][screenshot] compressing", { name: file.name, size: file.size, type: file.type });
    try {
      const dataUrl = await compressImageToBase64(file);
      setNgScreenshot(dataUrl);
      setNgErrs(p => ({ ...p, screenshot: "" }));
      dlog("[NG][screenshot] compressed OK", { finalLength: dataUrl.length });
    } catch (e2) {
      derr("[NG][screenshot] compression FAILED", e2);
      setNgErrs(p => ({ ...p, screenshot: "Could not process image. Try another file." }));
    } finally { setNgCompressing(false); }
  };

  /* ─── NG — validate + submit proof ─── */
  const validateNg = () => {
    const e: Record<string, string> = {};
    const amt = parseFloat(ngAmount);
    if (!amt || isNaN(amt) || amt <= 0) e.amt = "Enter the amount you transferred";
    else if (amt < NG_MIN_AMOUNT) e.amt = `Minimum deposit is ₦${NG_MIN_AMOUNT.toLocaleString()}`;
    if (!ngRef.trim() || ngRef.trim().length < 3) e.ref = "Enter the transfer reference / narration you used";
    if (!ngScreenshot) e.screenshot = "A payment screenshot is required";
    setNgErrs(e);
    if (Object.keys(e).length) dwarn("[NG][submit] validation failed", e);
    return Object.keys(e).length === 0;
  };

  const handleNgSubmit = async () => {
    if (!validateNg()) return;
    setNgLoading(true); setError("");
    dlog("[NG][submit] submitting proof", { ngAmount, ngRef });
    try {
      const amt = parseFloat(ngAmount);
      const noteParts: string[] = [];
      if (ngPhone.trim()) noteParts.push(`Phone: ${ngPhone.trim()}`);
      if (ngNote.trim())  noteParts.push(ngNote.trim());
      const resp = await post("/api/wallet/bank-deposits", {
        transferReference: ngRef.trim(),
        ngnAmountSent: amt,
        expectedNgnCredit: amt,
        senderAccountName: ngSender.trim() || undefined,
        screenshotUrl: ngScreenshot || undefined,
        userNote: noteParts.length ? noteParts.join(" | ") : undefined,
      });
      dlog("[NG][submit] backend accepted proof — pending admin review", resp);
      setStep("ng_pending");
    } catch (e: unknown) {
      derr("[NG][submit] FAILED", e);
      setError((e as Error).message);
    } finally { setNgLoading(false); }
  };

  /* ─── Crypto ─── */
  const handleBinanceScreenshotFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { setBErrs(p => ({ ...p, screenshot: "Please select an image file." })); return; }
    if (file.size > 10 * 1024 * 1024)   { setBErrs(p => ({ ...p, screenshot: "Image must be under 10 MB." })); return; }
    const objectUrl = URL.createObjectURL(file);
    setScreenshotPreview(objectUrl);
    setScreenshotUploading(true);
    setBErrs(p => ({ ...p, screenshot: "" }));
    dlog("[Crypto][screenshot] uploading to ImgBB", { name: file.name, size: file.size });
    try {
      const url = await uploadToImgBB(file);
      setScreenshotUrl(url);
      dlog("[Crypto][screenshot] uploaded", { url });
    } catch (e: unknown) {
      derr("[Crypto][screenshot] upload FAILED", e);
      setBErrs(p => ({ ...p, screenshot: e instanceof Error ? e.message : "Upload failed. Try again." }));
      setScreenshotUrl(""); URL.revokeObjectURL(objectUrl); setScreenshotPreview("");
    } finally { setScreenshotUploading(false); }
  };

  const handleBinanceScreenshotRemove = () => { setScreenshotUrl(""); setScreenshotPreview(""); setBErrs(p => ({ ...p, screenshot: "" })); };

  const validateBinance = () => {
    const e: Record<string, string> = {};
    const trimmedTxid = txid.trim();
    if (!trimmedTxid || trimmedTxid.length < 10 || trimmedTxid.length > 128) e.txid = "TXID must be between 10 and 128 characters";
    if (!cryptoAmt || isNaN(+cryptoAmt) || +cryptoAmt <= 0) e.cryptoAmt = "Enter the amount you sent";
    const usd = parseFloat(cryptoUsd);
    if (!usd || isNaN(usd) || usd < MIN_DEPOSIT_USD) e.usdAmount = `Minimum deposit is $${MIN_DEPOSIT_USD}`;
    if (senderAddr.trim().length > 256) e.senderAddr = "Sender address is too long (max 256 characters)";
    if (userNote.trim().length > 1000)  e.userNote   = "Note is too long (max 1000 characters)";
    if (screenshotUploading) e.screenshot = "Please wait for the screenshot to finish uploading";
    setBErrs(e);
    if (Object.keys(e).length) dwarn("[Crypto][submit] validation failed", e);
    return Object.keys(e).length === 0;
  };

  const handleBinanceSubmit = async () => {
    if (!validateBinance()) return;
    if (!currentRate) { setError("Live rate unavailable right now — please retry in a moment."); derr("[Crypto][submit] no currentRate available"); return; }
    setLoading(true); setError("");
    dlog("[Crypto][submit] submitting proof", { txid, cryptoAmt, coin, cryptoNet, cryptoUsd });
    try {
      const expectedLocal = (parseFloat(cryptoUsd) * currentRate).toFixed(2);
      const data = await post("/api/wallet/binance-deposits", {
        txid: txid.trim(), cryptoAmount: parseFloat(cryptoAmt), coin, network: cryptoNet,
        expectedLocalAmount: parseFloat(expectedLocal), expectedCurrency: country?.currency,
        senderAddress: senderAddr.trim() || undefined,
        screenshotUrl: screenshotUrl.trim() || undefined,
        userNote: userNote.trim() || undefined,
      });
      dlog("[Crypto][submit] backend accepted proof — pending admin review", data);
      setReceipt(makeReceipt({
        outcome: "pending",
        method: `Crypto — ${coin} (${cryptoNet})`,
        usdAmount: cryptoUsd,
        localAmount: expectedLocal,
        currency: country?.currency ?? "USD",
        symbol: currentSymbol,
        customerName: senderAddr.trim() || "—",
        reference: data?.data?.id ?? "",
        transactionId: "",
        extra: [
          ["TXID", txid.trim()],
          ["Sent", `${cryptoAmt} ${coin}`],
          ["Proof", screenshotUrl ? "Screenshot uploaded" : "Not provided"],
        ],
        pendingNote: `Under admin review — ${data?.data?.status ?? "PENDING"}.`,
      }));
      setStep("crypto_success");
    } catch (e: unknown) {
      derr("[Crypto][submit] FAILED", e);
      setError((e as Error).message);
    }
    finally { setLoading(false); }
  };

  const resetBinanceState = useCallback(() => {
    setTxid(""); setCryptoAmt(""); setCoin(BINANCE_COIN); setCryptoNet(BINANCE_NETWORK);
    setCryptoUsd(String(MIN_DEPOSIT_USD)); setSenderAddr(""); setUserNote(""); setBErrs({});
    setScreenshotUrl(""); setScreenshotPreview(""); setScreenshotUploading(false);
  }, []);

  const resetGhState = useCallback(() => {
    stopPolling();
    setGhAmount(""); setGhPhone(""); setGhNetwork("MTN"); setGhPaymentRef("");
    setGhWidgetToken(""); setGhChargeRef(""); setGhOtpCode(""); setGhOtpErr("");
    setGhVerifyInfo(""); setGhErrs({}); setGhLoading(false); setGhChecking(false);
  }, [stopPolling]);

  /* ─── Reset / navigation ─── */
  const reset = useCallback(() => {
    dlog("[UI] reset() — starting a fresh deposit");
    stopPolling();
    resetGhState();
    setNgAmount(""); setNgRef(""); setNgSender(""); setNgPhone(""); setNgNote("");
    setNgScreenshot(""); setNgErrs({}); setNgLoading(false);
    resetBinanceState();
    setCountry(null); setGateway(null); setError(""); setFailMessage(undefined); setReceipt(null);
    setStep("form");
  }, [resetGhState, resetBinanceState, stopPolling]);

  const goAccount = useCallback(() => {
    dlog("[UI] goAccount() — navigating back to account, stopping any active poll");
    stopPolling();
    navigate(ACCOUNT_PATH, { replace: true });
  }, [navigate, stopPolling]);

  /* ─── Country pre-selection from registered country ─── */
  useEffect(() => {
    const found = COUNTRIES.find(c => c.code === registeredCountry.code);
    if (found) {
      dlog("[UI] country auto-selected from registration", { code: found.code });
      setCountry(found);
      if (found.gateways.length === 1) setGateway(found.gateways[0]);
    }
    setIpDetecting(false);
  }, [registeredCountry.code]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Country / gateway selection ─── */
  const handleSelectCountry = useCallback((c: Country) => {
    dlog("[UI] country selected", { code: c.code });
    stopPolling();
    setCountry(c); setGateway(null); setError(""); setFailMessage(undefined); setReceipt(null);
    setStep("form");
    if (c.gateways.length === 1) {
      const gw = c.gateways[0];
      setGateway(gw);
      setStep(gw === "binance" ? "crypto_info" : gw === "rushpay_gh" ? "gh_form" : "ng_info");
    }
  }, [stopPolling]);

  const selectGateway = useCallback((gw: GatewayId) => {
    dlog("[UI] gateway selected", { gw });
    setGateway(gw); setError("");
    setStep(gw === "binance" ? "crypto_info" : gw === "rushpay_gh" ? "gh_form" : "ng_info");
  }, []);

  useEffect(() => {
    if (gateway === "rushpay_gh" && step === "form") setStep("gh_form");
    if (gateway === "ng_manual"  && step === "form") setStep("ng_info");
  }, [gateway, step]);

  /* ─── Derived flags ─── */
  const onReceiptStep = [
    "gh_success", "gh_failed", "gh_unconfirmed",
    "ng_pending",
    "crypto_success",
  ].includes(step);

  const onTransientStep = [
    "gh_otp", "gh_approve", "gh_crediting",
  ].includes(step);

  const stepIndex = () => {
    if (onReceiptStep || onTransientStep) return 3;
    if (step === "form") return country ? 1 : 0;
    return 2;
  };

  /* ─── Panel title ─── */
  const panelTitle = () => {
    if (step === "gh_form" || step === "gh_otp" || step === "gh_approve" || step === "gh_crediting") return "Mobile Money · GH";
    if (step === "gh_success" || step === "gh_failed") return "Your receipt";
    if (step === "gh_unconfirmed") return "Awaiting confirmation";
    if (step === "ng_info")    return "Bank Transfer · NG";
    if (step === "ng_proof")   return "Payment Proof · NG";
    if (step === "ng_pending") return "Under review";
    if (step === "crypto_info")    return "Crypto Deposit";
    if (step === "crypto_proof")   return "Payment Proof";
    if (step === "crypto_success") return "Your receipt";
    return null;
  };

  /* ─── renderPanel ─── */
  const renderPanel = () => {
    /* ── GH: RushPay steps ── */
    if (step === "gh_form") return (
      <GhForm
        error={error} loading={ghLoading}
        phoneNumber={ghPhone} setPhoneNumber={setGhPhone}
        ghAmount={ghAmount} setGhAmount={setGhAmount}
        ghNetwork={ghNetwork} setGhNetwork={setGhNetwork}
        errs={ghErrs} setErrs={setGhErrs}
        onSubmit={handleGhSubmit}
      />
    );

    if (step === "gh_otp") return (
      <GhOtpScreen
        ghPhone={ghPhone} ghNetwork={ghNetwork}
        ghOtpCode={ghOtpCode} setGhOtpCode={setGhOtpCode}
        ghOtpErr={ghOtpErr} loading={ghLoading}
        onSubmit={handleGhOtpSubmit}
        onReset={reset}
      />
    );

    if (step === "gh_approve") return (
      <GhApproveScreen
        ghPhone={ghPhone} ghAmount={ghAmount} ghNetwork={ghNetwork}
        ghCountdown={ghCountdown} ghVerifyInfo={ghVerifyInfo}
        loading={ghLoading} error={error}
        onVerify={handleGhVerify}
        onReset={reset}
      />
    );

    if (step === "gh_crediting") return <GhCreditingScreen />;

    if (step === "gh_success") return (
      <ResultScreen outcome="success" receipt={receipt} onAccount={goAccount} onReset={reset} />
    );

    if (step === "gh_failed") return (
      <ResultScreen outcome="failed" receipt={receipt} message={failMessage} onAccount={goAccount} onReset={reset} />
    );

    if (step === "gh_unconfirmed") return (
      <GhUnconfirmedScreen
        receipt={receipt}
        checking={ghChecking}
        onCheckNow={handleGhCheckNow}
        onAccount={goAccount}
        onReset={reset}
      />
    );

    /* ── NG: Manual bank transfer ── */
    if (step === "ng_info") return (
      <NgManualInfo error={error} onNext={() => setStep("ng_proof")} />
    );

    if (step === "ng_proof") return (
      <NgManualProof
        error={error}
        ngAmount={ngAmount} setNgAmount={setNgAmount}
        ngRef={ngRef} setNgRef={setNgRef}
        ngSender={ngSender} setNgSender={setNgSender}
        ngPhone={ngPhone} setNgPhone={setNgPhone}
        ngNote={ngNote} setNgNote={setNgNote}
        ngScreenshot={ngScreenshot}
        ngCompressing={ngCompressing}
        ngErrs={ngErrs} setNgErrs={setNgErrs}
        loading={ngLoading}
        onScreenshotChange={handleNgScreenshotChange}
        onScreenshotRemove={() => { setNgScreenshot(""); setNgErrs(p => ({ ...p, screenshot: "" })); }}
        onSubmit={handleNgSubmit}
        onBack={() => setStep("ng_info")}
      />
    );

    if (step === "ng_pending") return (
      <NgManualPendingScreen onAccount={goAccount} onReset={reset} />
    );

    /* ── Crypto ── */
    if (!country || !gateway) return null;

    if (gateway === "binance") {
      if (step === "crypto_proof") return (
        <BinanceProof
          error={error}
          txid={txid} setTxid={setTxid}
          cryptoAmt={cryptoAmt} setCryptoAmt={setCryptoAmt}
          coin={coin} setCoin={setCoin}
          cryptoNet={cryptoNet} setCryptoNet={setCryptoNet}
          usdAmount={cryptoUsd} setUsdAmount={setCryptoUsd}
          rate={currentRate} symbol={currentSymbol}
          senderAddr={senderAddr} setSenderAddr={setSenderAddr}
          userNote={userNote} setUserNote={setUserNote}
          screenshotUrl={screenshotUrl}
          screenshotPreview={screenshotPreview}
          screenshotUploading={screenshotUploading}
          onScreenshotFile={handleBinanceScreenshotFile}
          onScreenshotRemove={handleBinanceScreenshotRemove}
          bErrs={bErrs} setBErrs={setBErrs}
          loading={loading}
          onSubmit={handleBinanceSubmit}
          onBack={() => setStep("crypto_info")}
        />
      );
      if (step === "crypto_success") return (
        <CryptoSubmitted receipt={receipt} onAccount={goAccount} onReset={reset} />
      );
      return (
        <BinanceInfo
          error={error}
          minLocalLabel={currentRate ? `≈ ${fmtLocal(MIN_DEPOSIT_USD * currentRate, currentSymbol)}` : "rate loading…"}
          onNext={() => { resetBinanceState(); setStep("crypto_proof"); }}
        />
      );
    }

    return null;
  };

  /* ─── Render ─── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        .material-symbols-outlined { font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; font-family:'Material Symbols Outlined'; font-style:normal; font-weight:normal; line-height:1; display:inline-block; text-transform:none; letter-spacing:normal; word-wrap:normal; white-space:nowrap; direction:ltr; vertical-align:middle; user-select:none; }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{margin:0;background:#070b14;}
        @keyframes _spin{to{transform:rotate(360deg);}}
        @keyframes _fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
        input::placeholder,textarea::placeholder{color:rgba(245,245,240,0.2);}
        select option{background:#141414;color:#f5f5f0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px;}
        a:hover{opacity:0.85;}
        button:hover:not(:disabled){opacity:0.9;}
        button:active:not(:disabled){transform:scale(0.99);}
        button:focus-visible, input:focus-visible, select:focus-visible {outline: 2px solid ${T.white}; outline-offset: 2px;}
        @media (prefers-reduced-motion: reduce) { *{animation-duration:0.001ms !important;} }
        @media (min-width: 900px) {
          ._depositGrid { grid-template-columns: 1.05fr 1.55fr !important; align-items: start !important; }
          ._depositGrid > div:first-child { position: sticky; top: 32px; }
        }
        @media print {
          body { background: #fff !important; }
          body * { visibility: hidden !important; box-shadow: none !important; }
          ._receipt, ._receipt * { visibility: visible !important; }
          ._noprint, ._noprint * { display: none !important; }
          ._receipt {
            position: absolute; left: 0; top: 0; width: 100%;
            background: #fff !important; border: 1px solid #ddd !important; border-radius: 0 !important;
          }
          ._receipt * { color: #000 !important; background: transparent !important; }
          ._receipt ._r-dim, ._receipt ._r-foot { color: #555 !important; }
          ._receipt ._r-head, ._receipt ._r-foot { border-color: #bbb !important; }
          ._receipt ._r-row { border-color: #eee !important; }
          ._receipt ._r-badge, ._receipt ._r-mark { border-color: #999 !important; }
          ._receipt svg path, ._receipt svg circle, ._receipt svg rect { stroke: #000 !important; fill: none !important; }
          ._receipt svg circle, ._receipt svg rect { fill: #000 !important; }
          @page { margin: 14mm; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: T.bg, padding: "32px 16px 60px", fontFamily: "'Outfit', sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>

          {/* ── Page header ── */}
          <div className="_noprint" style={{ marginBottom: 26, animation: "_fadeUp 0.4s ease", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <SkyMark size={24} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.white }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "1.2px" }}>
                  {BRAND} · {onReceiptStep ? "Deposit receipt" : "Secure deposit"}
                </span>
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: T.white, letterSpacing: "-0.4px", lineHeight: 1.1 }}>
                {onReceiptStep ? "Your deposit" : "Fund your account"}
              </h1>
            </div>
          </div>

          <div className="_depositGrid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>

            {/* ── Left info column ── */}
            <div className="_noprint" style={{ animation: "_fadeUp 0.45s ease" }}>
              <div style={{ marginBottom: 14, fontSize: 12, color: T.dim }}>
                Minimum: <span style={{ color: T.white, fontWeight: 600 }}>GH₵{GH_MIN_AMOUNT} (GH) · ₦{NG_MIN_AMOUNT.toLocaleString()} (NG) · ${MIN_DEPOSIT_USD} (Crypto)</span>
              </div>
              <TrustBadges />
              <HowToDepositPanel />
              <SupportPanel />
            </div>

            {/* ── Right form column ── */}
            <div style={{ background: T.surface, borderRadius: 16, overflow: "visible", border: `1px solid ${T.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "_fadeUp 0.5s ease" }}>
              <div style={{ padding: "20px 20px 24px" }}>

                <StepIndicator steps={["Country", "Method", "Pay"]} current={stepIndex()} />

                {/* Country picker — hidden once on a terminal/transient step */}
                {!onReceiptStep && !onTransientStep && step !== "gh_form" && step !== "ng_info" && step !== "ng_proof" && step !== "crypto_info" && step !== "crypto_proof" && (
                  <div style={{ marginBottom: country ? 16 : 0 }}>
                    <label style={{ ...lbl, marginBottom: 8 }}>1 · Select your country</label>
                    <CountryDropdown country={country} ipDetecting={ipDetecting} onSelect={handleSelectCountry} />
                  </div>
                )}

                {/* Gateway tabs */}
                {!onReceiptStep && !onTransientStep && country && country.gateways.length > 1 && step !== "gh_form" && step !== "ng_info" && step !== "ng_proof" && step !== "crypto_info" && step !== "crypto_proof" && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ ...lbl, marginBottom: 8 }}>2 · Payment method</label>
                    <GatewayTabs country={country} gateway={gateway} onSelect={selectGateway} />
                  </div>
                )}

                {/* Section divider */}
                {country && gateway && (
                  <div className="_noprint" style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <div style={{ flex: 1, height: 1, background: T.border }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.7px" }}>{panelTitle()}</span>
                      <div style={{ flex: 1, height: 1, background: T.border }} />
                    </div>
                  </div>
                )}

                {renderPanel()}

                {!onReceiptStep && !onTransientStep && !country && (
                  <div style={{ textAlign: "center", padding: "28px 0 8px", color: T.dim, fontSize: 13, lineHeight: 1.7 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 36, display: "block", marginBottom: 10, opacity: 0.4 }}>public</span>
                    {ipDetecting ? <><Spin /> &nbsp;Loading…</> : <>Select your country above to see<br />available payment methods.</>}
                  </div>
                )}
              </div>

              <div className="_noprint" style={{ borderTop: `1px solid ${T.border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 11, color: "rgba(245,245,240,0.22)", display: "flex", alignItems: "center", gap: 5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                  256-bit encrypted · {BRAND}
                </span>
                <span style={{ fontSize: 10, color: "rgba(245,245,240,0.16)" }}>RushPay · Crypto</span>
              </div>
            </div>
          </div>

          <div className="_noprint" style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "rgba(245,245,240,0.16)", lineHeight: 1.7, animation: "_fadeUp 0.6s ease" }}>
            By depositing you agree to {BRAND}'s<br />
            <a href="/terms" style={{ color: "rgba(245,245,240,0.30)", textDecoration: "underline" }}>Terms of Service</a>
            {" · "}
            <a href="/privacy" style={{ color: "rgba(245,245,240,0.30)", textDecoration: "underline" }}>Privacy Policy</a>
          </div>

        </div>
      </div>
    </>
  );
}
