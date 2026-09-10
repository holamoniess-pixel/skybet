import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getToken as getSessionToken } from '../utils/session';
import { useCountry } from '../hooks/useCountry';

/* ─── PAYMENT RAILS ──────────────────────────────────────────────────────────
   • GHANA (GHS)  — AkwaPay REST API (Mobile Money push prompt / USSD fallback).
     POST /api/wallet/deposit/akwapay/init  { amount, phone, network }
     → { id, reference, next_action: { type, ussdFallback }, checkout_url, status }
     Poll GET /api/wallet/deposit/akwapay/status/:intentId until success/failed.
     Customer NEVER leaves this page for GH (push prompt path).
     OTP path: POST /api/wallet/deposit/akwapay/otp { intentId, clientSecret, otp }
     Checkout fallback: POST /api/wallet/deposit/akwapay/checkout { amount }
     → { id, reference, checkout_url }

   • NIGERIA (NGN) — Manual bank transfer.
     Customer transfers, then submits proof via POST /api/wallet/bank-deposits.

   • ALL OTHER COUNTRIES — Crypto (Binance/manual) only.
────────────────────────────────────────────────────────────────────────────── */

/* ─── DEBUG LOGGING ───────────────────────────────────────────────────────── */
const DEBUG = true;
const dlog  = (...a: unknown[]) => { if (DEBUG) console.log(...a); };
const dwarn = (...a: unknown[]) => { if (DEBUG) console.warn(...a); };
const derr  = (...a: unknown[]) => { if (DEBUG) console.error(...a); };

const ACCOUNT_PATH = "/account";
const API_BASE     = "https://futballbackend-production-b1a0.up.railway.app";

/* ─── AkwaPay ───────────────────────────────────────────────────────────────── */
const AKWAPAY_INIT_PATH     = "/api/wallet/deposit/akwapay/init";
const AKWAPAY_CHECKOUT_PATH = "/api/wallet/deposit/akwapay/checkout";
const AKWAPAY_STATUS_PATH   = (id: string) => `/api/wallet/deposit/akwapay/status/${encodeURIComponent(id)}`;
const AKWAPAY_OTP_PATH      = "/api/wallet/deposit/akwapay/otp";

const AKWAPAY_SUCCESS = ["succeeded"];
const AKWAPAY_FAILED  = ["failed", "declined", "cancelled", "expired"];
const AKWAPAY_PENDING = ["pending", "processing", "requires_action", "requires_payment_method"];

const PENDING_KEY = "skybet_pending_deposit_akwapay";

const POLL_PHASES: { untilSec: number; intervalMs: number }[] = [
  { untilSec: 120,  intervalMs: 5_000   },
  { untilSec: 600,  intervalMs: 30_000  },
  { untilSec: 3600, intervalMs: 120_000 },
];
const POLL_TIMEOUT_SEC = 3600;
const USSD_WAIT_SEC    = 20;

const GH_NETWORKS = [
  { value: "MTN",        label: "MTN Mobile Money",  prefixes: ["024","025","053","054","055","059"] },
  { value: "TELECEL",    label: "Telecel Cash",       prefixes: ["020","050"] },
  { value: "AIRTELTIGO", label: "AirtelTigo Money",   prefixes: ["026","027","056","057"] },
] as const;
type GhNetworkCode = "MTN" | "TELECEL" | "AIRTELTIGO" | "";

function detectNetwork(phone: string): GhNetworkCode {
  const digits = phone.replace(/[^\d]/g, "");
  let local = "";
  if (digits.startsWith("233") && digits.length === 12) local = "0" + digits.substring(3);
  else if (digits.length === 10 && digits.startsWith("0")) local = digits;
  else return "";
  const prefix = local.substring(0, 3);
  for (const n of GH_NETWORKS) {
    if ((n.prefixes as readonly string[]).includes(prefix)) return n.value;
  }
  return "";
}

function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("233") && digits.length === 12) digits = "0" + digits.slice(3);
  else if (digits.length === 9 && !digits.startsWith("0")) digits = "0" + digits;
  return digits;
}

/* ─── Nigeria — Manual Bank Transfer ─────────────────────────────────────── */
const NG_MANUAL_BANK_NAME   = "Palmpay ";
const NG_MANUAL_ACCT_NAME   = "FARUQ ABIODUN TIAMIYU";
const NG_MANUAL_ACCT_NUMBER = "9070897735";
const NG_MIN_AMOUNT         = 31000;

/* ─── Business rules ─────────────────────────────────────────────────────── */
const MIN_DEPOSIT_USD = 25;
const GH_MIN_AMOUNT   = 100;   // GHS – backend is source of truth; this is the frontend floor
const GH_QUICK_AMOUNTS = [100, 150, 300, 400, 500, 1000, 5000];

/* ─── Binance / Crypto ───────────────────────────────────────────────────── */
const BINANCE_ADDRESS = "TZG9smK9bD6HNsmk8NcDMLCfrdhhfjcPg1";
const BINANCE_NETWORK = "TRC20";
const BINANCE_COIN    = "USDT";
const CRYPTO_COINS    = ["USDT", "BTC", "ETH", "BNB", "USDC"];
const CRYPTO_NETWORKS = ["TRC20", "BEP20", "ERC20", "Arbitrum", "Optimism"];

/* ─── ImgBB ───────────────────────────────────────────────────────────────── */
const IMGBB_API_KEY = "bdd12743a2e929bcdd4a6843dea9295e";

async function uploadToImgBB(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: form });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || `ImgBB upload failed (${res.status})`); }
  const data = await res.json();
  const url: string = data?.data?.url;
  if (!url) throw new Error("ImgBB returned no URL — check your API key.");
  return url;
}

const BRAND            = "SkyBet";
const SUPPORT_EMAIL    = "support@skybet.com";
const SUPPORT_TELEGRAM = "skybet_Agent";

/* ─── Types ──────────────────────────────────────────────────────────────── */
type GatewayId = "akwapay_gh" | "ng_manual" | "binance";
type IntentStatus = "pending" | "unresolved" | "success" | "failed";

interface Country {
  code: string; name: string; flag: string; flagImg: string;
  currency: string; symbol: string; gateways: GatewayId[];
}

const COUNTRIES: Country[] = [
  { code: "GH", name: "Ghana",          flag: "🇬🇭", flagImg: "https://flagcdn.com/w40/gh.png", currency: "GHS", symbol: "GH₵",  gateways: ["akwapay_gh", "binance"] },
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
  akwapay_gh: { matIcon: "smartphone",       label: "Mobile Money", sub: "Approve on your phone · AkwaPay" },
  ng_manual:  { matIcon: "account_balance",  label: "Bank Transfer", sub: "Manual review · transfer proof" },
  binance:    { matIcon: "currency_bitcoin", label: "Crypto",        sub: "USDT · BTC · ETH · BNB" },
};

/* ─── Design Tokens ──────────────────────────────────────────────────────── */
const T = {
  bg:          "#070b14",
  surface:     "#0d1422",
  raised:      "#121c30",
  raised2:     "#1a2740",
  border:      "rgba(96,165,250,0.12)",
  borderStrong:"rgba(96,165,250,0.22)",
  ink:         "#e8eefd",
  inkLow:      "rgba(232,238,253,0.08)",
  inkMid:      "rgba(232,238,253,0.22)",
  silver:      "#a8bcdc",
  silverLow:   "rgba(168,188,220,0.10)",
  silverMid:   "rgba(168,188,220,0.30)",
  white:       "#e8eefd",
  dim:         "rgba(232,238,253,0.40)",
  faint:       "rgba(96,165,250,0.06)",
  danger:      "#f87171",
  dangerLow:   "rgba(224,32,32,0.08)",
  dangerMid:   "rgba(224,32,32,0.28)",
  amber:       "#fbbf24",
  amberLow:    "rgba(251,191,36,0.08)",
  amberMid:    "rgba(251,191,36,0.28)",
};

/* ─── Stable style objects ────────────────────────────────────────────────── */
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

/* ─── Pending deposit persistence ─────────────────────────────────────────── */
interface PendingDeposit {
  intentId: string; reference: string; amount: string; phone: string;
  network: GhNetworkCode; ussdFallback: string | null; checkoutUrl: string | null; at: number;
}
function savePending(p: PendingDeposit) {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* ignore */ }
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
function readPending(): PendingDeposit | null {
  for (const s of [sessionStorage, localStorage]) {
    try {
      const raw = s.getItem(PENDING_KEY);
      if (!raw) continue;
      const p = JSON.parse(raw) as PendingDeposit;
      if (p?.at && Date.now() - p.at > 24 * 60 * 60 * 1000) continue;
      return p;
    } catch { /* ignore */ }
  }
  return null;
}
function clearPending() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}

/* ─── Receipt model ───────────────────────────────────────────────────────── */
type Outcome = "success" | "failed" | "pending";

interface ReceiptData {
  outcome: Outcome; method: string;
  usdAmount: string; localAmount: string; currency: string; symbol: string;
  customerName: string; reference: string; transactionId: string;
  issuedAt: string; receiptNo: string;
  extra?: [string, string][];
  pendingNote?: string;
}
function makeReceipt(o: Omit<ReceiptData, "issuedAt" | "receiptNo"> & { issuedAt?: string; receiptNo?: string }): ReceiptData {
  const issuedAt = o.issuedAt ?? new Date().toISOString();
  return { ...o, issuedAt, receiptNo: o.receiptNo ?? `CB-${new Date(issuedAt).getTime().toString(36).toUpperCase()}` };
}
function fmtMoney(amount: string, symbol: string): string {
  if (!amount) return "—";
  const n = Number(amount);
  if (isNaN(n)) return `${symbol}${amount}`;
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
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
    `${BRAND.toUpperCase()} — DEPOSIT RECEIPT`, rule,
    ...receiptRows(r).map(([k, v]) => `${(k + ":").padEnd(17)}${v}`), rule,
    `${BRAND} never stores your MoMo, card, or bank details.`,
    "Payments processed by AkwaPay.",
    `Support: ${SUPPORT_EMAIL} · t.me/${SUPPORT_TELEGRAM}`, "",
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
      document.body.removeChild(ta); return ok;
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

/* ─── Payload helpers ────────────────────────────────────────────────────── */
type GwPayload = Record<string, unknown> | null | undefined;
const unwrap = (d: GwPayload): GwPayload =>
  d && typeof d === "object" && "data" in d ? (d.data as GwPayload) : d;
const gstr = (d: GwPayload, key: string): string => { const v = d?.[key]; return typeof v === "string" ? v : ""; };
const gnum = (d: GwPayload, k: string): number | null => { const v = d?.[k]; return typeof v === "number" ? v : null; };

/* ─── Micro components ────────────────────────────────────────────────────── */
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
function SkyMark({ size = 30, color = T.white }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 32 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="7" r="4.4" fill="none" stroke={color} strokeWidth="1.4" />
      <path d="M4 20C1.8 20 0 18.2 0 16C0 13.8 1.8 12 4 12C4.5 9.6 6.7 8 9.2 8C12 8 14.3 10 14.7 12.7C17.4 12.9 19.5 15.1 19.5 17.8C19.5 20 17.6 20 15.5 20H4Z" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Receipt ─────────────────────────────────────────────────────────────── */
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px dashed ${T.borderStrong}` }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: T.raised2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <SkyMark size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.white, letterSpacing: "-0.2px" }}>{BRAND} deposit receipt</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: T.dim }}>{data.receiptNo}</div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.white, background: tone.bg, border: `1px solid ${tone.bd}`, borderRadius: 20, padding: "4px 9px", whiteSpace: "nowrap" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{tone.icon}</span>{tone.word}
          </span>
        </div>
        <div style={{ padding: "18px 16px 14px", borderBottom: `1px dashed ${T.borderStrong}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 5 }}>Amount charged</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: T.white, letterSpacing: "-1px", lineHeight: 1.05 }}>{fmtMoney(data.localAmount, data.symbol)}</div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 5 }}>
            {data.currency}{data.usdAmount ? <> · deposit value ${Number(data.usdAmount).toFixed(2)} USD</> : null}
          </div>
        </div>
        <div style={{ padding: "10px 16px 14px" }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", fontSize: 12, borderBottom: `1px solid ${T.faint}` }}>
              <span style={{ color: T.dim, flexShrink: 0 }}>{k}</span>
              <span style={{ color: T.white, fontWeight: 600, textAlign: "right", wordBreak: "break-all", maxWidth: "62%", fontFamily: ["Reference", "Transaction ID", "TXID"].includes(k) ? "'DM Mono', monospace" : "inherit" }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "11px 16px 14px", borderTop: `1px dashed ${T.borderStrong}`, fontSize: 10, color: T.dim, lineHeight: 1.65 }}>
          {data.pendingNote ? <>{data.pendingNote}<br /></> : null}
          MoMo, card &amp; bank details are never stored by {BRAND}.<br />
          Questions? {SUPPORT_EMAIL} · t.me/{SUPPORT_TELEGRAM}
        </div>
      </div>
      <div className="_noprint" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <button onClick={async () => { if (await copyText(data.reference || data.transactionId)) flash("ref"); }} disabled={!data.reference && !data.transactionId} style={{ ...btnGhost, opacity: !data.reference && !data.transactionId ? 0.45 : 1 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{copied === "ref" ? "check" : "content_copy"}</span>
          {copied === "ref" ? "Copied" : "Copy reference"}
        </button>
        <button onClick={async () => { if (await copyText(receiptToText(data))) flash("all"); }} style={btnGhost}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{copied === "all" ? "check" : "assignment"}</span>
          {copied === "all" ? "Copied" : "Copy receipt"}
        </button>
      </div>
      <div className="_noprint" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <button onClick={() => window.print()} style={btnGhost}><span className="material-symbols-outlined" style={{ fontSize: 15 }}>print</span>Print / save PDF</button>
        <button onClick={() => downloadText(`${data.receiptNo}.txt`, receiptToText(data))} style={btnGhost}><span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>Download</button>
      </div>
    </div>
  );
}

/* ─── Step indicator ─────────────────────────────────────────────────────── */
function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="_noprint" style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
      {steps.map((label, i) => {
        const done = i < current, active = i === current;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: done ? T.white : active ? T.inkLow : T.faint, border: `1.5px solid ${done || active ? T.white : T.border}`, color: done ? "#0a0a0a" : active ? T.white : T.dim, transition: "all 0.2s" }}>
                {done ? <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> : i + 1}
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: active || done ? T.white : T.dim, textTransform: "uppercase", letterSpacing: "0.4px", whiteSpace: "nowrap" }}>{label}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1.5, background: done ? T.white : T.border, margin: "0 6px 16px", transition: "background 0.2s" }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ─── USD Amount Picker (Crypto) ──────────────────────────────────────────── */
interface UsdAmountPickerProps { usdAmount: string; setUsdAmount: (v: string) => void; rate: number | null; symbol: string; error?: string; }
function UsdAmountPicker({ usdAmount, setUsdAmount, rate, symbol, error }: UsdAmountPickerProps) {
  const QUICK = [25, 50, 100, 250, 500];
  const n = parseFloat(usdAmount);
  const localVal = rate && !isNaN(n) ? n * rate : null;
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>Amount (USD) <span style={{ color: T.danger }}>*</span></label>
      <div style={{ display: "flex", alignItems: "center", background: T.raised, border: `1px solid ${error ? T.dangerMid : T.border}`, borderRadius: 10, overflow: "hidden" }}>
        <span style={{ padding: "0 14px", fontSize: 15, color: T.dim, fontWeight: 700, borderRight: `1px solid ${T.border}` }}>$</span>
        <input type="number" min={MIN_DEPOSIT_USD} value={usdAmount} placeholder={String(MIN_DEPOSIT_USD)} onChange={e => setUsdAmount(e.target.value)} style={{ ...inp, border: "none", borderRadius: 0, background: "none", fontSize: 16, fontWeight: 700 }} />
      </div>
      {error && <div style={{ fontSize: 11, color: T.danger, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>{error}</div>}
      {!error && <div style={{ fontSize: 11, color: T.dim, marginTop: 5 }}>{localVal !== null ? <>You'll be charged <strong style={{ color: T.white }}>{fmtLocal(localVal, symbol)}</strong> at today's rate</> : "Enter an amount to see the local equivalent"}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginTop: 10 }}>
        {QUICK.map(q => <button key={q} onClick={() => setUsdAmount(String(q))} style={{ background: usdAmount === String(q) ? T.inkLow : T.faint, border: `1px solid ${usdAmount === String(q) ? T.white : T.border}`, borderRadius: 8, padding: "7px 0", color: usdAmount === String(q) ? T.white : T.dim, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.12s", fontFamily: "inherit" }}>${q}</button>)}
      </div>
    </div>
  );
}

/* ─── Trust badges ────────────────────────────────────────────────────────── */
function TrustBadges() {
  return (
    <div className="_noprint" style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Trusted Payment Partners</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { label: "Mobile Money", matIcon: "smartphone",       desc: "Ghana · AkwaPay" },
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

/* ─── Country Dropdown ────────────────────────────────────────────────────── */
interface CountryDropdownProps { country: Country | null; ipDetecting: boolean; onSelect: (c: Country) => void; }
function CountryDropdown({ country, ipDetecting, onSelect }: CountryDropdownProps) {
  const [dropOpen, setDropOpen] = useState(false);
  const [search,   setSearch]   = useState("");
  const dropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const filtered = COUNTRIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.currency.toLowerCase().includes(search.toLowerCase()));
  return (
    <div ref={dropRef} style={{ position: "relative" }}>
      <button onClick={() => setDropOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: T.raised, border: `1px solid ${dropOpen ? T.white : T.border}`, borderRadius: 10, padding: "11px 14px", cursor: "pointer", fontFamily: "inherit", transition: "border 0.15s" }}>
        {country ? (<><FlagImg country={country} size={24} /><span style={{ flex: 1, textAlign: "left", color: T.white, fontSize: 14, fontWeight: 600 }}>{country.name}</span><span style={{ fontSize: 11, color: T.dim, marginRight: 6 }}>{country.currency}</span></>) : (<span style={{ flex: 1, textAlign: "left", color: T.dim, fontSize: 13 }}>Choose a country…</span>)}
        {ipDetecting && <Spin />}
        {!ipDetecting && country && <span className="material-symbols-outlined" style={{ fontSize: 14, color: T.silver }}>my_location</span>}
        <span className="material-symbols-outlined" style={{ color: T.dim, fontSize: 18, transform: dropOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>expand_more</span>
      </button>
      {dropOpen && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.7)", overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: T.dim }}>search</span>
            <input autoFocus type="text" placeholder="Search country or currency…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, padding: "6px 0", fontSize: 13, marginBottom: 0, background: "none", border: "none", flex: 1 }} />
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {filtered.map(c => {
              const badge = c.code === "GH" ? "MOMO" : c.code === "NG" ? "BANK" : "CRYPTO";
              return (
                <button key={c.code} onClick={() => { onSelect(c); setDropOpen(false); setSearch(""); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: country?.code === c.code ? T.inkLow : "none", border: "none", borderBottom: `1px solid ${T.border}`, cursor: "pointer", fontFamily: "inherit", transition: "background 0.1s" }}>
                  <FlagImg country={c} size={22} />
                  <span style={{ flex: 1, textAlign: "left", color: T.white, fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                  <span style={{ fontSize: 10, color: T.dim, marginRight: 8 }}>{c.currency}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.05em", background: T.silverLow, color: T.silver, border: `1px solid ${T.silverMid}` }}>{badge}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Gateway Tabs ────────────────────────────────────────────────────────── */
function GatewayTabs({ country, gateway, onSelect }: { country: Country; gateway: GatewayId | null; onSelect: (gw: GatewayId) => void }) {
  if (!country || country.gateways.length <= 1) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${country.gateways.length}, 1fr)`, gap: 8 }}>
      {country.gateways.map(id => {
        const t = GATEWAY_META[id]; const active = gateway === id;
        return (
          <button key={id} onClick={() => onSelect(id)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, padding: "13px 14px", background: active ? T.inkLow : T.raised, border: `1.5px solid ${active ? T.white : T.border}`, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: active ? T.white : T.dim }}>{t.matIcon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.white, lineHeight: 1.2 }}>{t.label}</span>
            <span style={{ fontSize: 9, color: T.dim, lineHeight: 1.4 }}>{t.sub}</span>
            {active && <span style={{ fontSize: 9, fontWeight: 800, color: T.white, marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}><span className="material-symbols-outlined" style={{ fontSize: 11 }}>check_circle</span>SELECTED</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Support Panel ───────────────────────────────────────────────────────── */
function SupportPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="_noprint" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginTop: 16, animation: "_fadeUp 0.3s ease" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.raised2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: 18, color: T.white }}>support_agent</span></div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Need help? Contact Support</div>
          <div style={{ fontSize: 11, color: T.dim }}>We're online 24/7 — response in under 5 mins</div>
        </div>
        <span className="material-symbols-outlined" style={{ color: T.dim, fontSize: 18, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>expand_more</span>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "16px 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { matIcon: "chat", label: "Telegram Support", desc: `@${SUPPORT_TELEGRAM}`, href: `https://t.me/${SUPPORT_TELEGRAM}` },
              { matIcon: "mail", label: "Email Support",    desc: SUPPORT_EMAIL,          href: `mailto:${SUPPORT_EMAIL}` },
            ].map(ch => (
              <a key={ch.label} href={ch.href} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 13px", textDecoration: "none" }}>
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

/* ─── How To Deposit Panel ────────────────────────────────────────────────── */
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
        `Tap "Send payment prompt" — AkwaPay pushes an approval prompt to your phone.`,
        "If a USSD code appears on screen, dial it manually to approve.",
        "Open the MoMo prompt on your phone and confirm with your PIN.",
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
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.raised2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: 18, color: T.white }}>menu_book</span></div>
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
              <button key={k} onClick={() => setTab(k)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: tab === k ? T.inkLow : T.raised, border: `1.5px solid ${tab === k ? T.white : T.border}`, color: tab === k ? T.white : T.dim }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{GUIDES[k].icon}</span>{GUIDES[k].title}
              </button>
            ))}
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            {active.steps.map((s, i) => <li key={i} style={{ fontSize: 12, color: T.dim, lineHeight: 1.6 }}><span style={{ color: T.white }}>{s}</span></li>)}
          </ol>
          <div style={{ marginTop: 14, background: T.faint, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 13px", fontSize: 11, color: T.dim, lineHeight: 1.6, display: "flex", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: T.white, flexShrink: 0, marginTop: 1 }}>receipt_long</span>
            <span><strong style={{ color: T.white }}>Processed by AkwaPay (GH) or admin review (NG)</strong> — every deposit gets a printable receipt.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   GHANA — AKWAPAY MOBILE MONEY FORM
══════════════════════════════════════════════════════════════════════════════ */
interface GhFormProps {
  error: string; loading: boolean;
  phone: string; setPhone: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  network: GhNetworkCode; setNetwork: (v: GhNetworkCode) => void;
  errs: Record<string, string>; setErrs: (fn: (p: Record<string, string>) => Record<string, string>) => void;
  onSubmit: () => void; onCheckoutFallback: () => void;
}
function GhForm({ error, loading, phone, setPhone, amount, setAmount, network, setNetwork, errs, setErrs, onSubmit, onCheckoutFallback }: GhFormProps) {
  const parsedAmt = parseFloat(amount);
  const amtValid  = !isNaN(parsedAmt) && parsedAmt >= GH_MIN_AMOUNT;
  const canSubmit = amtValid && phone.replace(/[^0-9]/g, "").length >= 9 && !!network && !loading;
  const fe = (k: string) => errs[k] ? <div style={{ fontSize: 11, color: T.danger, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>{errs[k]}</div> : null;
  const fi = (k: string): React.CSSProperties => ({ ...inp, border: `1px solid ${errs[k] ? T.dangerMid : T.border}` });

  return (
    <div>
      {error && <ErrBox msg={error} />}

      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Mobile Money number <span style={{ color: T.danger }}>*</span></label>
        <input type="tel" value={phone} placeholder="e.g. 0241234567" maxLength={12}
          onChange={e => { setPhone(e.target.value); setErrs(p => ({ ...p, phone: "" })); }}
          style={fi("phone")} />
        {fe("phone")}
        <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>AkwaPay sends the payment prompt to this number.</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Network <span style={{ color: T.danger }}>*</span></label>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {GH_NETWORKS.map(n => (
            <button key={n.value} onClick={() => { setNetwork(n.value); setErrs(p => ({ ...p, network: "" })); }}
              style={{ display: "flex", alignItems: "center", gap: 12, background: network === n.value ? T.inkLow : T.raised, border: `1.5px solid ${network === n.value ? T.white : T.border}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s" }}>
              <span style={{ flex: 1, textAlign: "left", color: T.white, fontSize: 13, fontWeight: 700 }}>{n.label}</span>
              {network === n.value && <div style={{ width: 18, height: 18, borderRadius: "50%", background: T.white, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: 12, color: "#0a0a0a" }}>check</span></div>}
            </button>
          ))}
        </div>
        {network && <div style={{ fontSize: 11, color: T.dim, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>{GH_NETWORKS.find(n => n.value === network)?.label} detected — tap another to change</div>}
        {fe("network")}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Amount (GH₵) <span style={{ color: T.danger }}>*</span></label>
        <input type="number" value={amount} placeholder={`Min GH₵${GH_MIN_AMOUNT}`}
          onChange={e => { setAmount(e.target.value); setErrs(p => ({ ...p, amount: "" })); }}
          style={fi("amount")} />
        {fe("amount")}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
          {GH_QUICK_AMOUNTS.map(a => (
            <button key={a} onClick={() => { setAmount(String(a)); setErrs(p => ({ ...p, amount: "" })); }}
              style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 20, cursor: "pointer", border: `1.5px solid ${amount === String(a) ? T.white : T.border}`, background: amount === String(a) ? T.inkLow : T.faint, color: amount === String(a) ? T.white : T.dim, fontFamily: "inherit", transition: "all 0.12s" }}>
              GH₵{a.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary pill */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: amtValid ? T.inkLow : T.raised, border: `1.5px solid ${amtValid ? T.white : T.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, transition: "all 0.2s" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: amtValid ? T.white : T.dim, textTransform: "uppercase", letterSpacing: "0.7px" }}>You're depositing</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: amtValid ? T.white : T.dim, fontFamily: "monospace" }}>
          GH₵{amtValid ? parsedAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
        </span>
      </div>

      <div style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 13px", marginBottom: 16, fontSize: 11, color: T.dim, lineHeight: 1.65, display: "flex", gap: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 15, color: T.white, flexShrink: 0, marginTop: 1 }}>lock</span>
        <span>AkwaPay sends a payment prompt to your phone — you stay on this page. Approve it with your MoMo PIN and your receipt appears automatically. A USSD code is shown as backup if the push doesn't arrive.</span>
      </div>

      <button onClick={onSubmit} disabled={!canSubmit}
        style={{ ...btnPrimary, opacity: !canSubmit ? 0.5 : 1, marginBottom: 8 }}>
        {loading ? <><Spin /> Sending prompt…</> : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>phone_android</span>Send payment prompt — GH₵{amtValid ? parsedAmt.toFixed(2) : "0.00"}</>}
      </button>

      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: T.dim }}>No phone handy?{" "}</span>
        <button onClick={onCheckoutFallback} disabled={loading} style={{ background: "none", border: "none", cursor: "pointer", color: T.white, fontSize: 11, fontWeight: 700, textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>
          Use hosted checkout instead →
        </button>
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: T.dim, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>bolt</span>
        Powered by AkwaPay — credited within 1–5 minutes of approval
      </div>
    </div>
  );
}

/* ──  USSD Fallback banner ── */
function UssdFallback({ code, visible }: { code: string; visible: boolean }) {
  if (!visible || !code) return null;
  const dialUrl = `tel:${code.replace(/[^0-9*#]/g, "")}`;
  return (
    <div style={{ background: T.amberLow, border: `1.5px solid ${T.amberMid}`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: T.amber }}>dialpad</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: T.amber, textTransform: "uppercase", letterSpacing: "0.8px" }}>USSD Fallback</span>
      </div>
      <div style={{ fontSize: 12, color: T.amber, lineHeight: 1.65, marginBottom: 10 }}>
        Dial this code to complete the payment manually if the push prompt doesn't arrive.
      </div>
      <a href={dialUrl} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: T.amber, color: "#0a0a0a", borderRadius: 8, padding: "11px 16px", textDecoration: "none", fontWeight: 800, fontSize: 15, fontFamily: "monospace", letterSpacing: "0.08em" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>phone</span>{code}
      </a>
    </div>
  );
}

/* ══ GHANA — AWAIT PROMPT SCREEN ══ */
interface GhAwaitPromptProps {
  phone: string; amount: string; network: GhNetworkCode; ussdFallback: string | null; checkoutUrl: string | null;
  showUssd: boolean; setShowUssd: (v: boolean) => void;
  loading: boolean; error: string;
  pushSentAt: number | null;
  onConfirm: () => void; onReset: () => void;
}
function GhAwaitPromptScreen({ phone, amount, network, ussdFallback, checkoutUrl, showUssd, setShowUssd, loading, error, pushSentAt, onConfirm, onReset }: GhAwaitPromptProps) {
  const netLabel = GH_NETWORKS.find(n => n.value === network)?.label ?? network;
  const parsedAmt = parseFloat(amount);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const elapsed = pushSentAt ? Math.max(0, Math.round((now - pushSentAt) / 1000)) : null;
  const elapsedLabel = elapsed === null ? "" : elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      {error && <ErrBox msg={error} />}
      <div className="_noprint" style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: T.inkLow, border: `2px solid ${T.inkMid}`, animation: "_pulse 2s ease-in-out infinite" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 30, color: T.white }}>phone_android</span>
      </div>
      <div className="_noprint" style={{ fontWeight: 800, fontSize: 17, color: T.white, marginBottom: 6 }}>Check your phone</div>
      <div className="_noprint" style={{ fontSize: 13, color: T.dim, lineHeight: 1.65, marginBottom: 18 }}>
        AkwaPay sent a payment prompt to <strong style={{ color: T.white }}>{phone}</strong>.<br />
        Approve the <strong style={{ color: T.white }}>GH₵{isNaN(parsedAmt) ? "—" : parsedAmt.toFixed(2)}</strong> payment on {netLabel}.
      </div>

      {pushSentAt && elapsed !== null && (
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 14 }}>{elapsedLabel} elapsed</div>
      )}

      {!showUssd && (
        <div style={{ fontSize: 11.5, color: T.dim, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Spin /><span>Waiting for your approval…{" "}
            <button onClick={() => setShowUssd(true)} style={{ background: "none", border: "none", color: T.amber, fontWeight: 700, cursor: "pointer", fontSize: 11.5, padding: 0, fontFamily: "inherit" }}>prompt didn't arrive?</button>
          </span>
        </div>
      )}

      <UssdFallback code={ussdFallback ?? ""} visible={showUssd} />

      {checkoutUrl && (
        <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", marginBottom: 8 }}>
          <div style={btnGhost}><span className="material-symbols-outlined" style={{ fontSize: 15 }}>open_in_new</span>Or pay by checkout instead</div>
        </a>
      )}

      <button onClick={onConfirm} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.5 : 1, marginBottom: 8 }}>
        {loading ? <><Spin /> Verifying…</> : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>task_alt</span>I approved — check payment</>}
      </button>
      <button onClick={onReset} style={btnGhost}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>Cancel &amp; start over</button>
    </div>
  );
}

/* ══ GHANA — CHECKOUT REDIRECT SCREEN ══ */
function GhCheckoutRedirectScreen({ checkoutUrl, onConfirm, onReset }: { checkoutUrl: string | null; onConfirm: () => void; onReset: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div className="_noprint" style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: T.inkLow, border: `2px solid ${T.inkMid}` }}>
        <span className="material-symbols-outlined" style={{ fontSize: 30, color: T.white }}>open_in_new</span>
      </div>
      <div className="_noprint" style={{ fontWeight: 800, fontSize: 17, color: T.white, marginBottom: 6 }}>Continue on AkwaPay Checkout</div>
      <div className="_noprint" style={{ fontSize: 13, color: T.dim, lineHeight: 1.65, marginBottom: 20 }}>
        You'll be redirected to AkwaPay's checkout page where you can enter your MoMo number, complete the payment, and use USSD if needed.
      </div>
      <div style={{ background: T.amberLow, border: `1px solid ${T.amberMid}`, borderRadius: 10, padding: "11px 13px", marginBottom: 16, fontSize: 11, color: T.amber, lineHeight: 1.65, display: "flex", gap: 8, textAlign: "left" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>info</span>
        <span><strong>Keep this tab open.</strong> After completing payment, return here and tap <strong>I've paid — check status</strong>.</span>
      </div>
      {checkoutUrl && (
        <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", marginBottom: 8 }}>
          <div style={btnPrimary}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>Open AkwaPay Checkout</div>
        </a>
      )}
      <button onClick={onConfirm} style={{ ...btnGhost, marginBottom: 8 }}><span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span>I've paid — check status</button>
      <button onClick={onReset} style={btnGhost}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>Cancel &amp; start over</button>
    </div>
  );
}

/* ══ GHANA — OTP SCREEN (legacy) ══ */
interface GhOtpScreenProps {
  phone: string; network: GhNetworkCode; ussdFallback: string | null;
  otp: string; setOtp: (v: string) => void;
  otpError: string; loading: boolean;
  onSubmit: () => void; onReset: () => void;
}
function GhOtpScreen({ phone, network, ussdFallback, otp, setOtp, otpError, loading, onSubmit, onReset }: GhOtpScreenProps) {
  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div className="_noprint" style={{ background: T.amberLow, border: `1px solid ${T.amberMid}`, borderRadius: 10, padding: "10px 13px", marginBottom: 14, fontSize: 11, color: T.amber, display: "flex", gap: 6, textAlign: "left" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>info</span>
        AkwaPay normally uses a USSD fallback, not OTP. This screen appears for legacy gateway flows only.
      </div>
      <UssdFallback code={ussdFallback ?? ""} visible={!!ussdFallback} />
      <div className="_noprint" style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: T.inkLow, border: `2px solid ${T.inkMid}` }}>
        <span className="material-symbols-outlined" style={{ fontSize: 30, color: T.white }}>password</span>
      </div>
      <div className="_noprint" style={{ fontWeight: 800, fontSize: 17, color: T.white, marginBottom: 6 }}>Enter the OTP</div>
      <div className="_noprint" style={{ fontSize: 13, color: T.dim, lineHeight: 1.65, marginBottom: 18 }}>
        A one-time code was sent by SMS to <strong style={{ color: T.white }}>{phone}</strong> to confirm this payment.
      </div>
      {otpError && <ErrBox msg={otpError} />}
      <div style={{ marginBottom: 16, textAlign: "left" }}>
        <label style={lbl}>One-Time PIN <span style={{ color: T.danger }}>*</span></label>
        <input type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} placeholder="••••••" maxLength={8}
          onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
          style={{ ...inp, textAlign: "center", fontSize: 22, fontWeight: 800, letterSpacing: 8, border: `1.5px solid ${otpError ? T.dangerMid : T.white}` }} />
      </div>
      <button onClick={onSubmit} disabled={loading || otp.length < 4} style={{ ...btnPrimary, opacity: loading || otp.length < 4 ? 0.5 : 1, marginBottom: 8 }}>
        {loading ? <><Spin /> Verifying…</> : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>Submit OTP</>}
      </button>
      <button onClick={onReset} style={btnGhost}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>Start over</button>
    </div>
  );
}

/* ══ GHANA — PENDING / POLLING SCREEN ══ */
interface GhPendingScreenProps {
  phone: string; amount: string; network: GhNetworkCode;
  ussdFallback: string | null; checkoutUrl: string | null;
  intentStatus: IntentStatus;
  showUssd: boolean; setShowUssd: (v: boolean) => void;
  pollStopped: boolean; pollStartedAt: number;
  waitingLong: boolean;
  manualChecking: boolean; onCheckNow: () => void;
  reference: string; intentId: string;
  pushSentAt: number | null;
  onReset: () => void;
}
function GhPendingScreen({ phone, amount, network, ussdFallback, checkoutUrl, intentStatus, showUssd, setShowUssd, pollStopped, pollStartedAt, waitingLong, manualChecking, onCheckNow, reference, intentId, pushSentAt, onReset }: GhPendingScreenProps) {
  const waiting = intentStatus === "pending" || intentStatus === "unresolved";
  const [pollPct, setPollPct] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tick = () => { setPollPct(Math.min(100, ((Date.now() - pollStartedAt) / 1000 / POLL_TIMEOUT_SEC) * 100)); setNow(Date.now()); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [pollStartedAt]);
  const elapsed = pushSentAt ? Math.max(0, Math.round((now - pushSentAt) / 1000)) : null;
  const elapsedLabel = elapsed === null ? "" : elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
  const parsedAmt = parseFloat(amount);

  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div className="_noprint" style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: T.silverLow, border: `2px solid ${T.silverMid}`, animation: "_pulse 2s ease-in-out infinite" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 30, color: T.silver }}>{waiting ? "hourglass_top" : "pending"}</span>
      </div>
      <div className="_noprint" style={{ fontWeight: 800, fontSize: 17, color: T.white, marginBottom: 6 }}>
        {intentStatus === "unresolved" ? "Still confirming…" : "Waiting for confirmation"}
      </div>
      <div className="_noprint" style={{ fontSize: 13, color: T.dim, lineHeight: 1.65, marginBottom: 18 }}>
        {intentStatus === "unresolved"
          ? "Don't pay again. We're checking in the background — your wallet updates once confirmed."
          : "AkwaPay is processing your payment. This page checks automatically."}
      </div>

      {/* Progress bar */}
      {!pollStopped && (
        <div style={{ height: 4, borderRadius: 99, background: T.border, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ height: "100%", borderRadius: 99, background: T.white, width: `${pollPct}%`, transition: "width 1s linear" }} />
        </div>
      )}

      {phone && (
        <div style={{ background: T.inkLow, border: `1px solid ${T.inkMid}`, borderRadius: 10, padding: "10px 13px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.white }}>smartphone</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: T.dim, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 3 }}>MoMo number</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.white }}>{phone}</div>
          </div>
          {elapsed !== null && <span style={{ fontSize: 11, color: T.dim, fontFamily: "monospace" }}>{elapsedLabel}</span>}
        </div>
      )}

      {!showUssd && ussdFallback && (
        <div style={{ fontSize: 11.5, color: T.dim, marginBottom: 14 }}>
          <button onClick={() => setShowUssd(true)} style={{ background: "none", border: "none", color: T.amber, fontWeight: 700, cursor: "pointer", fontSize: 11.5, padding: 0, fontFamily: "inherit" }}>Prompt didn't arrive? Use USSD fallback →</button>
        </div>
      )}
      <UssdFallback code={ussdFallback ?? ""} visible={!!(ussdFallback && showUssd)} />

      {checkoutUrl && (
        <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", marginBottom: 8 }}>
          <div style={waitingLong ? btnPrimary : btnGhost}>
            <span className="material-symbols-outlined" style={{ fontSize: waitingLong ? 18 : 13 }}>open_in_new</span>
            {waitingLong ? "Try paying by checkout instead" : "Or pay by checkout instead"}
          </div>
        </a>
      )}

      {pollStopped && waiting && (
        <div style={{ background: T.amberLow, border: `1px solid ${T.amberMid}`, borderRadius: 10, padding: "11px 14px", marginBottom: 16, fontSize: 12, color: T.amber, lineHeight: 1.55, display: "flex", gap: 8, textAlign: "left" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>wifi_off</span>
          <span>Auto-checking paused after {Math.round(POLL_TIMEOUT_SEC / 60)} min. Tap <strong>Check now</strong>, or the server-side sweep will update your wallet automatically.</span>
        </div>
      )}

      {waiting && waitingLong && (
        <div style={{ background: T.amberLow, border: `1.5px solid ${T.amberMid}`, borderRadius: 10, padding: "16px", marginBottom: 16, textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.amber }}>support_agent</span>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: T.amber }}>Already paid but it's still pending?</span>
          </div>
          <div style={{ fontSize: 12.5, color: T.amber, lineHeight: 1.6, marginBottom: 12, opacity: 0.9 }}>
            This can happen when the mobile money network confirms your payment slightly before our page catches up. Your money is safe — contact support with your reference and our team will confirm it immediately.
          </div>
          <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Deposit stuck — " + (reference || intentId))}&body=${encodeURIComponent(`Hi, my deposit hasn't confirmed on the app yet, but I completed the MoMo payment.\n\nReference: ${reference}\nIntent ID: ${intentId}\nAmount: GH₵${amount}\nPhone: ${phone}\n\nPlease check this and credit my wallet if the payment went through.`)}`} style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px", borderRadius: 8, background: T.amber, color: "#0a0a0a", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>mail</span>Contact support
            </div>
          </a>
        </div>
      )}

      <button onClick={onCheckNow} disabled={manualChecking} style={{ ...btnGhost, opacity: manualChecking ? 0.5 : 1, marginBottom: 8 }}>
        {manualChecking ? <><Spin /> Checking…</> : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>Check now</>}
      </button>
      <button onClick={onReset} style={btnGhost}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>Cancel &amp; start over</button>
    </div>
  );
}

/* ══ RESULT SCREENS ══ */
interface ResultScreenProps { outcome: "success" | "failed"; receipt: ReceiptData | null; message?: string; amountLabel?: string; onAccount: () => void; onReset: () => void; }
function ResultScreen({ outcome, receipt, message, amountLabel, onAccount, onReset }: ResultScreenProps) {
  const isSuccess = outcome === "success";
  return (
    <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
      <div className="_noprint" style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: isSuccess ? T.inkLow : T.dangerLow, border: `2px solid ${isSuccess ? T.inkMid : T.dangerMid}` }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: isSuccess ? T.white : T.danger }}>{isSuccess ? "check_circle" : "error"}</span>
      </div>
      <div className="_noprint" style={{ fontWeight: 800, fontSize: 20, color: T.white, marginBottom: 6 }}>
        {isSuccess ? (amountLabel ? `${amountLabel} added!` : "Deposit successful") : "Deposit failed"}
      </div>
      <div className="_noprint" style={{ fontSize: 13, color: T.dim, lineHeight: 1.7, marginBottom: 18 }}>
        {isSuccess
          ? <>Your wallet has been credited. Here's your receipt — print it, download it, or just keep the reference.</>
          : <>{message || "The payment was declined or cancelled."} If you were charged, send support the reference on this receipt.</>}
      </div>
      {receipt && <Receipt data={receipt} />}
      <button className="_noprint" onClick={onAccount} style={{ ...btnPrimary, marginBottom: 8 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span>Back to my account</button>
      <button className="_noprint" onClick={onReset} style={btnGhost}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>Make another deposit</button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   NIGERIA — MANUAL BANK TRANSFER
══════════════════════════════════════════════════════════════════════════════ */
function NgManualInfo({ error, onNext }: { error: string; onNext: () => void }) {
  return (
    <div>
      {error && <ErrBox msg={error} />}
      <div style={{ background: T.inkLow, border: `1px solid ${T.inkMid}`, borderRadius: 10, padding: "10px 13px", marginBottom: 12, fontSize: 11, color: T.white, display: "flex", alignItems: "center", gap: 6 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, flexShrink: 0 }}>info</span>
        Minimum deposit: <strong>₦{NG_MIN_AMOUNT.toLocaleString()}</strong>
      </div>
      <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: T.raised2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><span className="material-symbols-outlined" style={{ color: T.white, fontSize: 18 }}>account_balance</span></div>
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
            <div style={{ fontSize: 9.5, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 11, color: T.dim }}>{row.icon}</span>{row.label}</div>
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
      <button onClick={onNext} style={{ ...btnPrimary, marginBottom: 8 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>task_alt</span>I've sent the money — submit proof</button>
      <div style={{ textAlign: "center", fontSize: 11, color: T.dim, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><span className="material-symbols-outlined" style={{ fontSize: 13 }}>manage_search</span>Verified by admin within 5–15 minutes</div>
    </div>
  );
}

interface NgManualProofProps {
  error: string;
  ngAmount: string; setNgAmount: (v: string) => void;
  ngRef: string; setNgRef: (v: string) => void;
  ngSender: string; setNgSender: (v: string) => void;
  ngPhone: string; setNgPhone: (v: string) => void;
  ngNote: string; setNgNote: (v: string) => void;
  ngScreenshot: string; ngCompressing: boolean;
  ngErrs: Record<string, string>; setNgErrs: (fn: (p: Record<string, string>) => Record<string, string>) => void;
  loading: boolean;
  onScreenshotChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onScreenshotRemove: () => void;
  onSubmit: () => void; onBack: () => void;
}
function NgManualProof({ error, ngAmount, setNgAmount, ngRef, setNgRef, ngSender, setNgSender, ngPhone, setNgPhone, ngNote, setNgNote, ngScreenshot, ngCompressing, ngErrs, setNgErrs, loading, onScreenshotChange, onScreenshotRemove, onSubmit, onBack }: NgManualProofProps) {
  const QUICK_NGN = [50000, 100000, 200000, 500000, 1000000];
  const fe = (k: string) => ngErrs[k] ? <div style={{ fontSize: 11, color: T.danger, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>{ngErrs[k]}</div> : null;
  const fi = (k: string): React.CSSProperties => ({ ...inp, border: `1px solid ${ngErrs[k] ? T.dangerMid : T.border}` });
  return (
    <div>
      {error && <ErrBox msg={error} />}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Transfer reference / narration <span style={{ color: T.danger }}>*</span></label>
        <input type="text" value={ngRef} onChange={e => { setNgRef(e.target.value); setNgErrs(p => ({ ...p, ref: "" })); }} placeholder="Your name, username, or receipt reference" style={fi("ref")} />
        {fe("ref")}
        <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>Use the exact narration entered during the transfer.</div>
      </div>
      <div style={{ marginBottom: 6 }}>
        <label style={lbl}>Amount sent (₦) <span style={{ color: T.danger }}>*</span></label>
        <input type="number" value={ngAmount} placeholder={`Min ₦${NG_MIN_AMOUNT.toLocaleString()}`} onChange={e => { setNgAmount(e.target.value); setNgErrs(p => ({ ...p, amt: "" })); }} style={fi("amt")} />
        {fe("amt")}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
        {QUICK_NGN.map(a => <button key={a} onClick={() => { setNgAmount(String(a)); setNgErrs(p => ({ ...p, amt: "" })); }} style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 20, cursor: "pointer", border: `1.5px solid ${ngAmount === String(a) ? T.white : T.border}`, background: ngAmount === String(a) ? T.inkLow : T.faint, color: ngAmount === String(a) ? T.white : T.dim, fontFamily: "inherit", transition: "all 0.12s" }}>₦{a >= 1000 ? `${a / 1000}k` : a}</button>)}
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Sender account name <span style={{ color: T.dim, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
        <input type="text" value={ngSender} placeholder="Name on your bank account" onChange={e => setNgSender(e.target.value)} style={inp} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Phone number <span style={{ color: T.dim, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
        <input type="tel" value={ngPhone} placeholder="e.g. 08012345678" onChange={e => setNgPhone(e.target.value)} style={inp} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Payment screenshot <span style={{ color: T.danger }}>*</span></label>
        {ngScreenshot ? (
          <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}`, background: T.raised }}>
            <img src={ngScreenshot} alt="Payment screenshot" style={{ width: "100%", maxHeight: 180, objectFit: "contain", display: "block" }} />
            {ngCompressing && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}><Spin /></div>}
            {!ngCompressing && (
              <div style={{ position: "absolute", top: 7, right: 7, display: "flex", gap: 5 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 5, cursor: "pointer", background: "rgba(0,0,0,0.7)", color: T.silver, fontFamily: "inherit" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>upload</span>Change<input type="file" accept="image/*" style={{ display: "none" }} onChange={onScreenshotChange} />
                </label>
                <button onClick={onScreenshotRemove} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 5, cursor: "pointer", border: "none", background: T.dangerLow, color: T.danger, fontFamily: "inherit" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>Remove
                </button>
              </div>
            )}
          </div>
        ) : (
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 86, border: `2px dashed ${ngErrs.screenshot ? T.dangerMid : T.border}`, borderRadius: 8, cursor: ngCompressing ? "wait" : "pointer", background: T.faint, transition: "all 0.15s" }}>
            {ngCompressing ? <><Spin /><span style={{ fontSize: 11.5, color: T.dim, marginTop: 6 }}>Processing…</span></> : <><span className="material-symbols-outlined" style={{ fontSize: 28, color: T.dim, marginBottom: 5 }}>add_photo_alternate</span><span style={{ fontSize: 12, color: T.dim, fontWeight: 600 }}>Tap or drag screenshot here</span><span style={{ fontSize: 10, color: T.dim, marginTop: 2, opacity: 0.5 }}>JPG · PNG · WEBP</span></>}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={onScreenshotChange} />
          </label>
        )}
        {fe("screenshot")}
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={lbl}>Note to admin <span style={{ color: T.dim, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
        <textarea value={ngNote} onChange={e => setNgNote(e.target.value)} placeholder="Any extra info" rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.6 } as React.CSSProperties} />
      </div>
      <button onClick={onSubmit} disabled={loading || ngCompressing} style={{ ...btnPrimary, opacity: loading || ngCompressing ? 0.38 : 1, marginBottom: 8 }}>
        {loading ? <><Spin /> Submitting…</> : ngCompressing ? <><Spin /> Processing image…</> : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload_file</span>Submit payment proof</>}
      </button>
      <button onClick={onBack} style={btnGhost}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>Back</button>
    </div>
  );
}

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
      <button className="_noprint" onClick={onAccount} style={{ ...btnPrimary, marginBottom: 8 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span>Back to my account</button>
      <button className="_noprint" onClick={onReset} style={btnGhost}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>Make another deposit</button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   CRYPTO / BINANCE
══════════════════════════════════════════════════════════════════════════════ */
function BinanceScreenshotUploader({ screenshot, preview, uploading, error, onFileChange, onRemove }: { screenshot: string; preview: string; uploading: boolean; error?: string; onFileChange: (file: File) => void; onRemove: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>Payment Screenshot <span style={{ color: T.dim, textTransform: "none", fontSize: 10 }}>(recommended)</span></label>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFileChange(f); }} />
      <button type="button" onClick={() => !uploading && fileInputRef.current?.click()} style={{ position: "relative", width: "100%", padding: preview ? 0 : "20px 16px", borderRadius: 10, cursor: uploading ? "wait" : "pointer", boxSizing: "border-box", overflow: "hidden", background: screenshot ? T.inkLow : T.faint, border: `2px dashed ${error ? T.dangerMid : screenshot ? T.inkMid : T.border}`, color: screenshot ? T.white : T.dim, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", transition: "all 0.2s" }}>
        {preview ? <img src={preview} alt="Payment proof" style={{ width: "100%", maxHeight: 180, objectFit: "contain", opacity: uploading ? 0.5 : 1, display: "block" }} /> : <><span className="material-symbols-outlined" style={{ fontSize: 28 }}>add_photo_alternate</span><span style={{ fontSize: 12, fontWeight: 600 }}>Tap to upload screenshot</span><span style={{ fontSize: 10, color: "rgba(245,245,240,0.2)" }}>PNG · JPG · WEBP — max 10 MB</span></>}
        {uploading && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Spin /><span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>Uploading…</span></div>}
      </button>
      {screenshot && !uploading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <div style={{ fontSize: 11, color: T.white, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>Uploaded — tap image to change</div>
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 6, cursor: "pointer", border: "none", background: T.dangerLow, color: T.danger, fontFamily: "inherit" }}>Remove</button>
        </div>
      )}
      {error && <div style={{ fontSize: 11, color: T.danger, marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>{error}</div>}
    </div>
  );
}

function BinanceInfo({ error, minLocalLabel, onNext }: { error: string; minLocalLabel: string; onNext: () => void }) {
  return (
    <div>
      {error && <ErrBox msg={error} />}
      <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: T.raised2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><span className="material-symbols-outlined" style={{ color: T.white, fontSize: 18 }}>currency_bitcoin</span></div>
          <div><div style={{ fontWeight: 700, fontSize: 13, color: T.white }}>Send USDT to this address</div><div style={{ fontSize: 11, color: T.dim }}>Network: <strong style={{ color: T.white }}>{BINANCE_NETWORK} (TRON)</strong></div></div>
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
          {CRYPTO_COINS.map(c => <span key={c} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: T.silverLow, color: T.silver, border: `1px solid ${T.silverMid}` }}>{c}</span>)}
        </div>
      </div>
      <div style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: T.white, flexShrink: 0 }}>account_balance_wallet</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: T.white }}>New to Binance?</div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 2, lineHeight: 1.4 }}>Create a free account to buy &amp; send crypto in minutes.</div>
        </div>
        <a href="https://www.binance.com/en/register" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 800, padding: "7px 13px", borderRadius: 8, background: T.white, color: "#0a0a0a", textDecoration: "none", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>Sign Up <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span></a>
      </div>
      <button onClick={onNext} style={{ ...btnPrimary, marginBottom: 8 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>receipt_long</span>I've Sent — Submit Proof</button>
      <div style={{ textAlign: "center", fontSize: 11, color: T.dim, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><span className="material-symbols-outlined" style={{ fontSize: 13 }}>manage_search</span>Reviewed &amp; credited within 1–5 mins</div>
    </div>
  );
}

interface BinanceProofProps {
  error: string; txid: string; setTxid: (v: string) => void; cryptoAmt: string; setCryptoAmt: (v: string) => void; coin: string; setCoin: (v: string) => void; cryptoNet: string; setCryptoNet: (v: string) => void; usdAmount: string; setUsdAmount: (v: string) => void; rate: number | null; symbol: string; senderAddr: string; setSenderAddr: (v: string) => void; userNote: string; setUserNote: (v: string) => void; screenshotUrl: string; screenshotPreview: string; screenshotUploading: boolean; onScreenshotFile: (file: File) => void; onScreenshotRemove: () => void; bErrs: Record<string, string>; setBErrs: (fn: (p: Record<string, string>) => Record<string, string>) => void; loading: boolean; onSubmit: () => void; onBack: () => void;
}
function BinanceProof({ error, txid, setTxid, cryptoAmt, setCryptoAmt, coin, setCoin, cryptoNet, setCryptoNet, usdAmount, setUsdAmount, rate, symbol, senderAddr, setSenderAddr, userNote, setUserNote, screenshotUrl, screenshotPreview, screenshotUploading, onScreenshotFile, onScreenshotRemove, bErrs, setBErrs, loading, onSubmit, onBack }: BinanceProofProps) {
  const fe = (k: string) => bErrs[k] ? <div style={{ fontSize: 11, color: T.danger, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>{bErrs[k]}</div> : null;
  const fi = (k: string): React.CSSProperties => ({ ...inp, border: `1px solid ${bErrs[k] ? T.dangerMid : T.border}` });
  return (
    <div>
      {error && <ErrBox msg={error} />}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Transaction Hash (TXID) <span style={{ color: T.danger }}>*</span></label>
        <input type="text" value={txid} onChange={e => { setTxid(e.target.value); setBErrs(p => ({ ...p, txid: "" })); }} placeholder="Paste blockchain TXID" style={fi("txid")} />
        {fe("txid")}
        <div style={{ fontSize: 11, color: T.dim, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 12 }}>info</span>Find in your Binance withdrawal history. Must be 10–128 characters.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label style={lbl}>Coin <span style={{ color: T.danger }}>*</span></label>
          <select value={coin} onChange={e => setCoin(e.target.value)} style={{ ...inp, appearance: "none" as const }}>{CRYPTO_COINS.map(c => <option key={c} style={{ background: "#141414" }}>{c}</option>)}</select>
        </div>
        <div>
          <label style={lbl}>Network <span style={{ color: T.danger }}>*</span></label>
          <select value={cryptoNet} onChange={e => setCryptoNet(e.target.value)} style={{ ...inp, appearance: "none" as const }}>{CRYPTO_NETWORKS.map(n => <option key={n} style={{ background: "#141414" }}>{n}</option>)}</select>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Amount Sent ({coin}) <span style={{ color: T.danger }}>*</span></label>
        <input type="number" value={cryptoAmt} placeholder="0.00" min="0" step="any" onChange={e => { setCryptoAmt(e.target.value); setBErrs(p => ({ ...p, cryptoAmt: "" })); }} style={fi("cryptoAmt")} />
        {fe("cryptoAmt")}
      </div>
      <UsdAmountPicker usdAmount={usdAmount} setUsdAmount={setUsdAmount} rate={rate} symbol={symbol} error={bErrs.usdAmount} />
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Sender Wallet <span style={{ color: T.dim, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
        <input type="text" value={senderAddr} placeholder="Address you sent from" onChange={e => { setSenderAddr(e.target.value); setBErrs(p => ({ ...p, senderAddr: "" })); }} style={fi("senderAddr")} />
        {fe("senderAddr")}
      </div>
      <BinanceScreenshotUploader screenshot={screenshotUrl} preview={screenshotPreview} uploading={screenshotUploading} error={bErrs.screenshot} onFileChange={onScreenshotFile} onRemove={onScreenshotRemove} />
      <div style={{ marginBottom: 18 }}>
        <label style={lbl}>Note to Admin <span style={{ color: T.dim, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
        <textarea value={userNote} onChange={e => { setUserNote(e.target.value); setBErrs(p => ({ ...p, userNote: "" })); }} placeholder="Any extra info" rows={3} style={{ ...fi("userNote"), resize: "vertical", lineHeight: 1.6 } as React.CSSProperties} />
        {fe("userNote")}
      </div>
      <button onClick={onSubmit} disabled={loading || screenshotUploading} style={{ ...btnPrimary, opacity: loading || screenshotUploading ? 0.38 : 1, marginBottom: 8 }}>
        {loading ? <><Spin /> Submitting…</> : screenshotUploading ? <><Spin /> Uploading…</> : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload_file</span>Submit Deposit Proof</>}
      </button>
      <button onClick={onBack} style={btnGhost}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>Back</button>
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
      <div className="_noprint" style={{ fontSize: 13, color: T.dim, lineHeight: 1.7, marginBottom: 18 }}>Your crypto deposit is under review. Admin will credit your {BRAND} wallet within <strong style={{ color: T.white }}>1–5 minutes</strong>. Keep this receipt.</div>
      {receipt && <Receipt data={receipt} />}
      <button className="_noprint" onClick={onAccount} style={{ ...btnPrimary, marginBottom: 8 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span>Back to my account</button>
      <button className="_noprint" onClick={onReset} style={btnGhost}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>Make another deposit</button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   BACKGROUND POLL HOOK
══════════════════════════════════════════════════════════════════════════════ */
function useBackgroundPoll(active: boolean, probe: () => Promise<void>) {
  const [startedAt, setStartedAt]   = useState<number>(Date.now());
  const [stopped, setStopped]       = useState(false);
  const probeRef     = useRef(probe);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef   = useRef<number>(Date.now());
  const inFlightRef  = useRef(false);

  useEffect(() => { probeRef.current = probe; }, [probe]);

  const safeProbe = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try { await probeRef.current(); } finally { inFlightRef.current = false; }
  }, []);

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    startedRef.current = start; setStartedAt(start); setStopped(false);
    let cancelled = false;
    const scheduleNext = () => {
      if (cancelled) return;
      const elapsedSec = (Date.now() - startedRef.current) / 1000;
      const phase = POLL_PHASES.find(p => elapsedSec < p.untilSec);
      if (!phase) { setStopped(true); return; }
      timerRef.current = setTimeout(tick, phase.intervalMs);
    };
    const tick = async () => { if (cancelled) return; await safeProbe(); if (cancelled) return; scheduleNext(); };
    void tick();
    const onVisible = () => { if (document.visibilityState === "visible") void safeProbe(); };
    const onFocus   = () => { void safeProbe(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [active, safeProbe]);

  return { startedAt, stopped };
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
type Step =
  | "form"
  /* Ghana — AkwaPay MoMo */
  | "gh_form" | "gh_await_prompt" | "gh_checkout_redirect" | "gh_otp" | "gh_pending" | "gh_success" | "gh_failed"
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
  const [receipt,     setReceipt]     = useState<ReceiptData | null>(null);
  const [step,        setStep]        = useState<Step>("form");

  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  /* ─── HTTP helpers ──────────────────────────────────────────────────────── */
  const request = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}`, ...(init?.headers || {}) },
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON */ }
    if (!res.ok) throw new Error((data?.message as string) || (data?.error as string) || `Server error ${res.status}`);
    return data;
  };
  const post       = (path: string, body: object) => request(path, { method: "POST", body: JSON.stringify(body) });
  const backendGet = (path: string) => request(path);

  const refreshWallet = useCallback(async () => {
    try {
      const raw = await backendGet("/api/wallet");
      const data = unwrap(raw as GwPayload);
      const bal = gnum(data, "balance") ?? gnum(data, "availableBalance");
      if (bal !== null) setWalletBalance(bal);
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refreshWallet(); }, [refreshWallet]);

  /* ─── GH — AkwaPay state ─────────────────────────────────────────────── */
  const [ghAmount,      setGhAmount]      = useState("");
  const [ghPhone,       setGhPhone]       = useState("");
  const [ghNetwork,     setGhNetwork]     = useState<GhNetworkCode>("");
  const [ghIntentId,    setGhIntentId]    = useState("");
  const [ghReference,   setGhReference]   = useState("");
  const [ghUssdFallback,setGhUssdFallback]= useState<string | null>(null);
  const [ghCheckoutUrl, setGhCheckoutUrl] = useState<string | null>(null);
  const [ghClientSecret,setGhClientSecret]= useState("");
  const [ghOtp,         setGhOtp]         = useState("");
  const [ghOtpError,    setGhOtpError]    = useState("");
  const [ghOtpLoading,  setGhOtpLoading]  = useState(false);
  const [ghErrs,        setGhErrs]        = useState<Record<string, string>>({});
  const [ghLoading,     setGhLoading]     = useState(false);
  const [ghIntentStatus,setGhIntentStatus]= useState<IntentStatus>("pending");
  const [ghSettledAt,   setGhSettledAt]   = useState<number>(Date.now());
  const [ghManualChecking, setGhManualChecking] = useState(false);
  const [ghShowUssd,    setGhShowUssd]    = useState(false);
  const [ghWaitingLong, setGhWaitingLong] = useState(false);
  const pushSentAtRef   = useRef<number | null>(null);
  const lastRawStatusRef = useRef<string>("");
  const submittingRef   = useRef(false);

  /* ─── GH network auto-detect ───────────────────────────────────────────── */
  useEffect(() => {
    if (ghPhone.replace(/[^\d]/g, "").length >= 10) {
      const detected = detectNetwork(ghPhone);
      if (detected && !ghNetwork) setGhNetwork(detected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghPhone]);

  /* ─── GH USSD timer ──────────────────────────────────────────────────────*/
  useEffect(() => {
    if (step !== "gh_await_prompt" && step !== "gh_pending") { setGhShowUssd(false); return; }
    const timer = setTimeout(() => setGhShowUssd(true), USSD_WAIT_SEC * 1000);
    return () => clearTimeout(timer);
  }, [step]);

  /* ─── GH waiting long ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (step !== "gh_pending" || !(ghIntentStatus === "pending" || ghIntentStatus === "unresolved")) { setGhWaitingLong(false); return; }
    const timer = setTimeout(() => setGhWaitingLong(true), 90_000);
    return () => clearTimeout(timer);
  }, [step, ghIntentStatus, ghSettledAt]);
  useEffect(() => { if (ghWaitingLong) setGhShowUssd(true); }, [ghWaitingLong]);

  /* ─── GH probe ────────────────────────────────────────────────────────── */
  const probeGhIntent = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const result  = await backendGet(AKWAPAY_STATUS_PATH(id));
      const payload = (result?.data ?? result) as Record<string, unknown>;
      const data    = (payload?.data ?? payload) as Record<string, unknown>;
      const s       = String(data?.status ?? "pending").toLowerCase();
      dlog("[GH Poll] status", s, "intentId", id);
      lastRawStatusRef.current = s;
      if (AKWAPAY_SUCCESS.includes(s)) {
        setGhSettledAt(Date.now()); setGhIntentStatus("success"); clearPending(); await refreshWallet();
      } else if (AKWAPAY_FAILED.includes(s)) {
        setGhIntentStatus("failed"); clearPending();
      } else if (AKWAPAY_PENDING.includes(s)) {
        setGhIntentStatus("pending");
        if (pushSentAtRef.current && (Date.now() - pushSentAtRef.current) > 60_000) {
          derr("[GH Poll] stuck past 60s — check AkwaPay/NaloPay collection report for reference", { id });
        }
      } else { setGhIntentStatus("unresolved"); }
    } catch (e) { derr("[GH Poll] probe failed", e); }
  }, [refreshWallet]); // eslint-disable-line react-hooks/exhaustive-deps

  const boundProbe  = useCallback(() => probeGhIntent(ghIntentId), [probeGhIntent, ghIntentId]);
  const ghPollActive = (step === "gh_await_prompt" || step === "gh_pending")
    && (ghIntentStatus === "pending" || ghIntentStatus === "unresolved");
  const { startedAt: ghPollStartedAt, stopped: ghPollStopped } = useBackgroundPoll(ghPollActive, boundProbe);

  /* Auto-advance off await_prompt when poll resolves */
  useEffect(() => {
    if (step === "gh_await_prompt" && (ghIntentStatus === "success" || ghIntentStatus === "failed")) {
      setStep("gh_pending");
    }
  }, [step, ghIntentStatus]);

  /* Advance to success */
  useEffect(() => {
    if (ghIntentStatus !== "success" || !ghIntentId) return;
    const amtLabel = ghAmount ? `GH₵${parseFloat(ghAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
    setReceipt(prev => prev ?? makeReceipt({
      outcome: "success", method: `Mobile Money · AkwaPay (${GH_NETWORKS.find(n => n.value === ghNetwork)?.label ?? ghNetwork})`,
      usdAmount: "", localAmount: ghAmount, currency: "GHS", symbol: "GH₵",
      customerName: ghPhone, reference: ghReference, transactionId: ghIntentId,
    }));
    setStep("gh_success");
    dlog("[GH] success receipt built, amtLabel", amtLabel);
  }, [ghIntentStatus, ghIntentId, ghSettledAt]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Advance to failed */
  useEffect(() => {
    if (ghIntentStatus === "failed" && (step === "gh_pending" || step === "gh_await_prompt")) {
      setReceipt(makeReceipt({
        outcome: "failed", method: `Mobile Money · AkwaPay (${GH_NETWORKS.find(n => n.value === ghNetwork)?.label ?? ghNetwork})`,
        usdAmount: "", localAmount: ghAmount, currency: "GHS", symbol: "GH₵",
        customerName: ghPhone, reference: ghReference, transactionId: ghIntentId,
        pendingNote: "Payment was declined, cancelled, or expired.",
      }));
      setStep("gh_failed");
    }
  }, [ghIntentStatus, step]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Restore from sessionStorage/localStorage on mount */
  useEffect(() => {
    const p = readPending();
    if (!p?.intentId) return;
    dlog("[GH] restoring pending deposit", p);
    setGhIntentId(p.intentId); setGhReference(p.reference); setGhAmount(p.amount); setGhPhone(p.phone ?? ""); setGhNetwork(p.network ?? "");
    setGhUssdFallback(p.ussdFallback ?? null); setGhCheckoutUrl(p.checkoutUrl ?? null);
    setGhSettledAt(Date.now()); setGhIntentStatus("pending");
    pushSentAtRef.current = p.at ?? Date.now();
    setStep("gh_pending");
    void probeGhIntent(p.intentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── GH submit ─────────────────────────────────────────────────────────── */
  const validateGh = () => {
    const e: Record<string, string> = {};
    if (!ghPhone.trim() || ghPhone.replace(/[^0-9]/g, "").length < 9) e.phone = "Enter a valid Mobile Money number";
    if (!ghNetwork) e.network = "Select your network";
    const amt = parseFloat(ghAmount);
    if (!ghAmount || isNaN(amt) || amt < GH_MIN_AMOUNT) e.amount = `Minimum deposit is GH₵${GH_MIN_AMOUNT}`;
    setGhErrs(e); return Object.keys(e).length === 0;
  };

  const handleGhSubmit = async () => {
    if (submittingRef.current) return;

    const existing = readPending();
    if (existing?.intentId) {
      dwarn("[GH] resuming existing pending intent", existing);
      setGhIntentId(existing.intentId); setGhReference(existing.reference);
      setGhAmount(existing.amount); setGhPhone(existing.phone ?? ""); setGhNetwork(existing.network ?? "");
      setGhUssdFallback(existing.ussdFallback ?? null); setGhCheckoutUrl(existing.checkoutUrl ?? null);
      setGhIntentStatus("pending"); setStep("gh_pending");
      void probeGhIntent(existing.intentId);
      return;
    }

    if (!validateGh()) return;
    submittingRef.current = true;
    setGhLoading(true); setError("");

    try {
      const result = await post(AKWAPAY_INIT_PATH, {
        amount: parseFloat(ghAmount),
        phone: normalizePhone(ghPhone),
        network: ghNetwork,
      });
      const intent    = (result?.data ?? result ?? {}) as Record<string, unknown>;
      const newId     = String(intent?.id ?? "");
      const newRef    = String(intent?.reference ?? "");
      const nextAction= intent?.next_action as Record<string, unknown> | null | undefined;
      const nextType  = String(nextAction?.type ?? "none");
      const newUssd   = nextAction?.ussdFallback != null ? String(nextAction.ussdFallback) : null;
      const newCheckout = intent?.checkout_url != null ? String(intent.checkout_url) : null;
      const rawStatus = String(intent?.status ?? "").toLowerCase();
      const newSecret = String(intent?.client_secret ?? "");

      dlog("[GH] intent created", { id: newId, ref: newRef, nextType, rawStatus });

      if (!newId) throw new Error("Payment gateway returned no intent ID. Please try again.");

      setGhIntentId(newId); setGhReference(newRef); setGhUssdFallback(newUssd); setGhCheckoutUrl(newCheckout); setGhClientSecret(newSecret);
      setGhSettledAt(Date.now()); setReceipt(null); lastRawStatusRef.current = rawStatus;
      savePending({ intentId: newId, reference: newRef, amount: ghAmount, phone: ghPhone, network: ghNetwork, ussdFallback: newUssd, checkoutUrl: newCheckout, at: Date.now() });

      if (nextType === "await_prompt") {
        pushSentAtRef.current = Date.now();
        setGhIntentStatus("pending"); setGhLoading(false); setStep("gh_await_prompt");
        return;
      }
      if (nextType === "redirect") { setGhLoading(false); setStep("gh_checkout_redirect"); return; }
      if (nextType === "otp" || nextType === "requires_otp") { setGhLoading(false); setStep("gh_otp"); return; }
      if (AKWAPAY_SUCCESS.includes(rawStatus)) { setGhIntentStatus("success"); setGhLoading(false); setStep("gh_pending"); return; }
      dwarn("[GH] unknown next_action.type — falling back to poll", nextType);
      setGhIntentStatus(AKWAPAY_FAILED.includes(rawStatus) ? "failed" : AKWAPAY_PENDING.includes(rawStatus) ? "pending" : "unresolved");
      setGhLoading(false); setStep("gh_pending");
    } catch (e: unknown) {
      derr("[GH] init failed", e);
      setError((e as Error).message);
      setGhLoading(false);
    } finally { submittingRef.current = false; }
  };

  const handleGhCheckoutFallback = async () => {
    if (submittingRef.current) return;
    const parsedAmt = parseFloat(ghAmount);
    if (!ghAmount || isNaN(parsedAmt) || parsedAmt <= 0) { setGhErrs(p => ({ ...p, amount: "Enter an amount first" })); return; }
    submittingRef.current = true; setGhLoading(true); setError("");
    try {
      const result = await post(AKWAPAY_CHECKOUT_PATH, { amount: parsedAmt });
      const intent = (result?.data ?? result ?? {}) as Record<string, unknown>;
      const newId  = String(intent?.id ?? "");
      const newRef = String(intent?.reference ?? "");
      const url    = intent?.checkout_url != null ? String(intent.checkout_url) : null;
      if (!url) throw new Error("No checkout URL returned. Please try again or contact support.");
      setGhIntentId(newId); setGhReference(newRef); setGhCheckoutUrl(url);
      savePending({ intentId: newId, reference: newRef, amount: ghAmount, phone: "", network: "", ussdFallback: null, checkoutUrl: url, at: Date.now() });
      setGhLoading(false); setStep("gh_checkout_redirect");
    } catch (e: unknown) {
      derr("[GH] checkout fallback failed", e);
      setError((e as Error).message); setGhLoading(false);
    } finally { submittingRef.current = false; }
  };

  const proceedGhToPoll = () => { setGhIntentStatus("pending"); setStep("gh_pending"); };

  const handleGhOtpSubmit = async () => {
    const trimmed = ghOtp.trim();
    if (!trimmed) { setGhOtpError("Enter the OTP sent to your phone."); return; }
    if (!ghIntentId || !ghClientSecret) { setGhOtpError("Missing payment reference — please start over."); return; }
    setGhOtpLoading(true); setGhOtpError("");
    try {
      const result = await post(AKWAPAY_OTP_PATH, { intentId: ghIntentId, clientSecret: ghClientSecret, otp: trimmed });
      const data = (((result?.data ?? result ?? {}) as Record<string, unknown>)?.data ?? (result?.data ?? result ?? {})) as Record<string, unknown>;
      const rawStatus = String(data?.status ?? "pending").toLowerCase();
      if (AKWAPAY_SUCCESS.includes(rawStatus)) { setGhSettledAt(Date.now()); setGhIntentStatus("success"); setStep("gh_pending"); return; }
      if (AKWAPAY_FAILED.includes(rawStatus)) { setGhIntentStatus("failed"); clearPending(); setStep("gh_failed"); return; }
      setGhIntentStatus("pending"); setStep("gh_pending");
    } catch (e: unknown) {
      setGhOtpError(e instanceof Error ? e.message : "Incorrect or expired OTP. Please try again.");
    } finally { setGhOtpLoading(false); }
  };

  const handleGhManualCheck = useCallback(async () => {
    setGhManualChecking(true);
    await probeGhIntent(ghIntentId);
    setGhManualChecking(false);
  }, [probeGhIntent, ghIntentId]);

  /* ─── NG state ───────────────────────────────────────────────────────────── */
  const [ngAmount,      setNgAmount]      = useState("");
  const [ngRef,         setNgRef]         = useState("");
  const [ngSender,      setNgSender]      = useState("");
  const [ngPhone,       setNgPhone]       = useState("");
  const [ngNote,        setNgNote]        = useState("");
  const [ngScreenshot,  setNgScreenshot]  = useState("");
  const [ngCompressing, setNgCompressing] = useState(false);
  const [ngErrs,        setNgErrs]        = useState<Record<string, string>>({});
  const [ngLoading,     setNgLoading]     = useState(false);

  const compressImageToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image."));
      img.onload = () => {
        const MAX_W = 800, scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        resolve(dataUrl.length > 524288 ? canvas.toDataURL("image/jpeg", 0.45) : dataUrl);
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });

  const handleNgScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setNgCompressing(true);
    try { const dataUrl = await compressImageToBase64(file); setNgScreenshot(dataUrl); setNgErrs(p => ({ ...p, screenshot: "" })); }
    catch { setNgErrs(p => ({ ...p, screenshot: "Could not process image. Try another file." })); }
    finally { setNgCompressing(false); }
  };

  const validateNg = () => {
    const e: Record<string, string> = {};
    const amt = parseFloat(ngAmount);
    if (!amt || isNaN(amt) || amt <= 0) e.amt = "Enter the amount you transferred";
    else if (amt < NG_MIN_AMOUNT) e.amt = `Minimum deposit is ₦${NG_MIN_AMOUNT.toLocaleString()}`;
    if (!ngRef.trim() || ngRef.trim().length < 3) e.ref = "Enter the transfer reference / narration you used";
    if (!ngScreenshot) e.screenshot = "A payment screenshot is required";
    setNgErrs(e); return Object.keys(e).length === 0;
  };

  const handleNgSubmit = async () => {
    if (!validateNg()) return;
    setNgLoading(true); setError("");
    try {
      const amt = parseFloat(ngAmount);
      const noteParts: string[] = [];
      if (ngPhone.trim()) noteParts.push(`Phone: ${ngPhone.trim()}`);
      if (ngNote.trim())  noteParts.push(ngNote.trim());
      await post("/api/wallet/bank-deposits", {
        transferReference: ngRef.trim(), ngnAmountSent: amt, expectedNgnCredit: amt,
        senderAccountName: ngSender.trim() || undefined,
        screenshotUrl: ngScreenshot || undefined,
        userNote: noteParts.length ? noteParts.join(" | ") : undefined,
      });
      setStep("ng_pending");
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setNgLoading(false); }
  };

  /* ─── Crypto state ────────────────────────────────────────────────────── */
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

  const USD_RATES: Record<string, number> = { GHS: 11.5, NGN: 1380, KES: 129, TZS: 2680, UGX: 3650, XOF: 575, XAF: 575, ZMW: 27, ZAR: 17.7, USD: 1, GBP: 0.75, EUR: 0.87 };
  const rateFor = useCallback((cur: string) => USD_RATES[cur] ?? 1, []); // eslint-disable-line react-hooks/exhaustive-deps
  const currentRate   = country ? rateFor(country.currency) : null;
  const currentSymbol = country?.symbol ?? "$";

  const handleBinanceScreenshotFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { setBErrs(p => ({ ...p, screenshot: "Please select an image file." })); return; }
    if (file.size > 10 * 1024 * 1024)   { setBErrs(p => ({ ...p, screenshot: "Image must be under 10 MB." })); return; }
    setScreenshotPreview(URL.createObjectURL(file)); setScreenshotUploading(true); setBErrs(p => ({ ...p, screenshot: "" }));
    try { const url = await uploadToImgBB(file); setScreenshotUrl(url); }
    catch (e: unknown) { setBErrs(p => ({ ...p, screenshot: e instanceof Error ? e.message : "Upload failed." })); setScreenshotUrl(""); setScreenshotPreview(""); }
    finally { setScreenshotUploading(false); }
  };

  const validateBinance = () => {
    const e: Record<string, string> = {};
    const trimmedTxid = txid.trim();
    if (!trimmedTxid || trimmedTxid.length < 10 || trimmedTxid.length > 128) e.txid = "TXID must be between 10 and 128 characters";
    if (!cryptoAmt || isNaN(+cryptoAmt) || +cryptoAmt <= 0) e.cryptoAmt = "Enter the amount you sent";
    const usd = parseFloat(cryptoUsd);
    if (!usd || isNaN(usd) || usd < MIN_DEPOSIT_USD) e.usdAmount = `Minimum deposit is $${MIN_DEPOSIT_USD}`;
    if (senderAddr.trim().length > 256) e.senderAddr = "Sender address is too long";
    if (userNote.trim().length > 1000)  e.userNote   = "Note is too long";
    if (screenshotUploading) e.screenshot = "Please wait for the screenshot to finish uploading";
    setBErrs(e); return Object.keys(e).length === 0;
  };

  const handleBinanceSubmit = async () => {
    if (!validateBinance()) return;
    if (!currentRate) { setError("Live rate unavailable — please retry."); return; }
    setLoading(true); setError("");
    try {
      const expectedLocal = (parseFloat(cryptoUsd) * currentRate).toFixed(2);
      const data = await post("/api/wallet/binance-deposits", {
        txid: txid.trim(), cryptoAmount: parseFloat(cryptoAmt), coin, network: cryptoNet,
        expectedLocalAmount: parseFloat(expectedLocal), expectedCurrency: country?.currency,
        senderAddress: senderAddr.trim() || undefined,
        screenshotUrl: screenshotUrl.trim() || undefined,
        userNote: userNote.trim() || undefined,
      });
      setReceipt(makeReceipt({
        outcome: "pending", method: `Crypto — ${coin} (${cryptoNet})`,
        usdAmount: cryptoUsd, localAmount: expectedLocal,
        currency: country?.currency ?? "USD", symbol: currentSymbol,
        customerName: senderAddr.trim() || "—",
        reference: (data?.data as Record<string, unknown>)?.id as string ?? "",
        transactionId: "",
        extra: [["TXID", txid.trim()], ["Sent", `${cryptoAmt} ${coin}`], ["Proof", screenshotUrl ? "Screenshot uploaded" : "Not provided"]],
        pendingNote: `Under admin review — PENDING.`,
      }));
      setStep("crypto_success");
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  /* ─── Resets ─────────────────────────────────────────────────────────────── */
  const resetGhState = useCallback(() => {
    setGhAmount(""); setGhPhone(""); setGhNetwork(""); setGhIntentId(""); setGhReference("");
    setGhUssdFallback(null); setGhCheckoutUrl(""); setGhClientSecret(""); setGhOtp(""); setGhOtpError("");
    setGhErrs({}); setGhLoading(false); setGhIntentStatus("pending"); setGhManualChecking(false);
    setGhShowUssd(false); setGhWaitingLong(false);
    pushSentAtRef.current = null; lastRawStatusRef.current = "";
  }, []);

  const resetBinanceState = useCallback(() => {
    setTxid(""); setCryptoAmt(""); setCoin(BINANCE_COIN); setCryptoNet(BINANCE_NETWORK);
    setCryptoUsd(String(MIN_DEPOSIT_USD)); setSenderAddr(""); setUserNote(""); setBErrs({});
    setScreenshotUrl(""); setScreenshotPreview(""); setScreenshotUploading(false);
  }, []);

  const reset = useCallback(() => {
    clearPending();
    resetGhState();
    setNgAmount(""); setNgRef(""); setNgSender(""); setNgPhone(""); setNgNote("");
    setNgScreenshot(""); setNgErrs({}); setNgLoading(false);
    resetBinanceState();
    setCountry(null); setGateway(null); setError(""); setReceipt(null); setStep("form");
  }, [resetGhState, resetBinanceState]);

  const goAccount = useCallback(() => navigate(ACCOUNT_PATH, { replace: true }), [navigate]);

  /* ─── Country pre-selection ──────────────────────────────────────────────── */
  useEffect(() => {
    const found = COUNTRIES.find(c => c.code === registeredCountry.code);
    if (found) { setCountry(found); if (found.gateways.length === 1) setGateway(found.gateways[0]); }
    setIpDetecting(false);
  }, [registeredCountry.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectCountry = useCallback((c: Country) => {
    clearPending();
    setCountry(c); setGateway(null); setError(""); setReceipt(null); setStep("form");
    if (c.gateways.length === 1) {
      const gw = c.gateways[0]; setGateway(gw);
      setStep(gw === "binance" ? "crypto_info" : gw === "akwapay_gh" ? "gh_form" : "ng_info");
    }
  }, []);

  const selectGateway = useCallback((gw: GatewayId) => {
    setGateway(gw); setError("");
    setStep(gw === "binance" ? "crypto_info" : gw === "akwapay_gh" ? "gh_form" : "ng_info");
  }, []);

  useEffect(() => {
    if (gateway === "akwapay_gh" && step === "form") setStep("gh_form");
    if (gateway === "ng_manual"  && step === "form") setStep("ng_info");
  }, [gateway, step]);

  /* ─── Derived flags ───────────────────────────────────────────────────────── */
  const onReceiptStep = ["gh_success", "gh_failed", "ng_pending", "crypto_success"].includes(step);
  const onTransientStep = ["gh_await_prompt", "gh_checkout_redirect", "gh_otp", "gh_pending"].includes(step);

  const stepIndex = () => {
    if (onReceiptStep || onTransientStep) return 3;
    if (step === "form") return country ? 1 : 0;
    return 2;
  };

  const panelTitle = () => {
    if (["gh_form", "gh_await_prompt", "gh_checkout_redirect", "gh_otp", "gh_pending"].includes(step)) return "Mobile Money · GH";
    if (step === "gh_success" || step === "gh_failed") return "Your receipt";
    if (step === "ng_info")    return "Bank Transfer · NG";
    if (step === "ng_proof")   return "Payment Proof · NG";
    if (step === "ng_pending") return "Under review";
    if (step === "crypto_info")    return "Crypto Deposit";
    if (step === "crypto_proof")   return "Payment Proof";
    if (step === "crypto_success") return "Your receipt";
    return null;
  };

  /* ─── renderPanel ─────────────────────────────────────────────────────────── */
  const renderPanel = () => {
    /* GH — AkwaPay flow */
    if (step === "gh_form") return (
      <GhForm
        error={error} loading={ghLoading}
        phone={ghPhone} setPhone={setGhPhone}
        amount={ghAmount} setAmount={setGhAmount}
        network={ghNetwork} setNetwork={setGhNetwork}
        errs={ghErrs} setErrs={setGhErrs}
        onSubmit={() => void handleGhSubmit()}
        onCheckoutFallback={() => void handleGhCheckoutFallback()}
      />
    );
    if (step === "gh_await_prompt") return (
      <GhAwaitPromptScreen
        phone={ghPhone} amount={ghAmount} network={ghNetwork}
        ussdFallback={ghUssdFallback} checkoutUrl={ghCheckoutUrl}
        showUssd={ghShowUssd} setShowUssd={setGhShowUssd}
        loading={false} error={error}
        pushSentAt={pushSentAtRef.current}
        onConfirm={proceedGhToPoll}
        onReset={reset}
      />
    );
    if (step === "gh_checkout_redirect") return (
      <GhCheckoutRedirectScreen checkoutUrl={ghCheckoutUrl} onConfirm={proceedGhToPoll} onReset={reset} />
    );
    if (step === "gh_otp") return (
      <GhOtpScreen
        phone={ghPhone} network={ghNetwork} ussdFallback={ghUssdFallback}
        otp={ghOtp} setOtp={setGhOtp}
        otpError={ghOtpError} loading={ghOtpLoading}
        onSubmit={() => void handleGhOtpSubmit()}
        onReset={reset}
      />
    );
    if (step === "gh_pending") return (
      <GhPendingScreen
        phone={ghPhone} amount={ghAmount} network={ghNetwork}
        ussdFallback={ghUssdFallback} checkoutUrl={ghCheckoutUrl}
        intentStatus={ghIntentStatus}
        showUssd={ghShowUssd} setShowUssd={setGhShowUssd}
        pollStopped={ghPollStopped} pollStartedAt={ghPollStartedAt}
        waitingLong={ghWaitingLong}
        manualChecking={ghManualChecking} onCheckNow={() => void handleGhManualCheck()}
        reference={ghReference} intentId={ghIntentId}
        pushSentAt={pushSentAtRef.current}
        onReset={reset}
      />
    );
    if (step === "gh_success") {
      const amtLabel = ghAmount ? `GH₵${parseFloat(ghAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined;
      return <ResultScreen outcome="success" receipt={receipt} amountLabel={amtLabel} onAccount={goAccount} onReset={reset} />;
    }
    if (step === "gh_failed") return (
      <ResultScreen outcome="failed" receipt={receipt} message="The payment was declined, cancelled, or expired." onAccount={goAccount} onReset={reset} />
    );

    /* NG */
    if (step === "ng_info")  return <NgManualInfo error={error} onNext={() => setStep("ng_proof")} />;
    if (step === "ng_proof") return (
      <NgManualProof
        error={error}
        ngAmount={ngAmount} setNgAmount={setNgAmount}
        ngRef={ngRef} setNgRef={setNgRef}
        ngSender={ngSender} setNgSender={setNgSender}
        ngPhone={ngPhone} setNgPhone={setNgPhone}
        ngNote={ngNote} setNgNote={setNgNote}
        ngScreenshot={ngScreenshot} ngCompressing={ngCompressing}
        ngErrs={ngErrs} setNgErrs={setNgErrs}
        loading={ngLoading}
        onScreenshotChange={handleNgScreenshotChange}
        onScreenshotRemove={() => { setNgScreenshot(""); setNgErrs(p => ({ ...p, screenshot: "" })); }}
        onSubmit={() => void handleNgSubmit()}
        onBack={() => setStep("ng_info")}
      />
    );
    if (step === "ng_pending") return <NgManualPendingScreen onAccount={goAccount} onReset={reset} />;

    /* Crypto */
    if (!country || !gateway) return null;
    if (gateway === "binance") {
      if (step === "crypto_proof") return (
        <BinanceProof
          error={error} txid={txid} setTxid={setTxid}
          cryptoAmt={cryptoAmt} setCryptoAmt={setCryptoAmt}
          coin={coin} setCoin={setCoin}
          cryptoNet={cryptoNet} setCryptoNet={setCryptoNet}
          usdAmount={cryptoUsd} setUsdAmount={setCryptoUsd}
          rate={currentRate} symbol={currentSymbol}
          senderAddr={senderAddr} setSenderAddr={setSenderAddr}
          userNote={userNote} setUserNote={setUserNote}
          screenshotUrl={screenshotUrl} screenshotPreview={screenshotPreview} screenshotUploading={screenshotUploading}
          onScreenshotFile={handleBinanceScreenshotFile} onScreenshotRemove={() => { setScreenshotUrl(""); setScreenshotPreview(""); setBErrs(p => ({ ...p, screenshot: "" })); }}
          bErrs={bErrs} setBErrs={setBErrs}
          loading={loading} onSubmit={() => void handleBinanceSubmit()} onBack={() => setStep("crypto_info")}
        />
      );
      if (step === "crypto_success") return <CryptoSubmitted receipt={receipt} onAccount={goAccount} onReset={reset} />;
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

  /* ─── Render ──────────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        .material-symbols-outlined{font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;font-family:'Material Symbols Outlined';font-style:normal;font-weight:normal;line-height:1;display:inline-block;text-transform:none;letter-spacing:normal;word-wrap:normal;white-space:nowrap;direction:ltr;vertical-align:middle;user-select:none;}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{margin:0;background:#070b14;}
        @keyframes _spin{to{transform:rotate(360deg);}}
        @keyframes _fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes _pulse{0%,100%{box-shadow:0 0 0 0 rgba(232,238,253,0.14);}50%{box-shadow:0 0 0 14px rgba(232,238,253,0);}}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
        input::placeholder,textarea::placeholder{color:rgba(245,245,240,0.2);}
        select option{background:#141414;color:#f5f5f0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px;}
        a:hover{opacity:0.85;}
        button:hover:not(:disabled){opacity:0.9;}
        button:active:not(:disabled){transform:scale(0.99);}
        button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid ${T.white};outline-offset:2px;}
        @media (prefers-reduced-motion: reduce){*{animation-duration:0.001ms !important;}}
        @media (min-width:900px){._depositGrid{grid-template-columns:1.05fr 1.55fr !important;align-items:start !important;}._depositGrid>div:first-child{position:sticky;top:32px;}}
        @media print{
          body{background:#fff!important;}
          body *{visibility:hidden!important;}
          ._receipt,._receipt *{visibility:visible!important;}
          ._noprint,._noprint *{display:none!important;}
          ._receipt{position:absolute;left:0;top:0;width:100%;background:#fff!important;border:1px solid #ddd!important;border-radius:0!important;}
          ._receipt *{color:#000!important;background:transparent!important;}
          @page{margin:14mm;}
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: T.bg, padding: "32px 16px 60px", fontFamily: "'Outfit', sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>

          {/* Page header */}
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
              {walletBalance !== null && (
                <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>
                  Balance: <span style={{ color: T.white, fontWeight: 700 }}>GH₵{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          </div>

          <div className="_depositGrid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>

            {/* Left info column */}
            <div className="_noprint" style={{ animation: "_fadeUp 0.45s ease" }}>
              <div style={{ marginBottom: 14, fontSize: 12, color: T.dim }}>
                Minimum: <span style={{ color: T.white, fontWeight: 600 }}>GH₵{GH_MIN_AMOUNT} (GH) · ₦{NG_MIN_AMOUNT.toLocaleString()} (NG) · ${MIN_DEPOSIT_USD} (Crypto)</span>
              </div>
              <TrustBadges />
              <HowToDepositPanel />
              <SupportPanel />
            </div>

            {/* Right form column */}
            <div style={{ background: T.surface, borderRadius: 16, overflow: "visible", border: `1px solid ${T.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "_fadeUp 0.5s ease" }}>
              <div style={{ padding: "20px 20px 24px" }}>
                <StepIndicator steps={["Country", "Method", "Pay"]} current={stepIndex()} />

                {/* Country picker */}
                {!onReceiptStep && !onTransientStep && !["gh_form","ng_info","ng_proof","crypto_info","crypto_proof"].includes(step) && (
                  <div style={{ marginBottom: country ? 16 : 0 }}>
                    <label style={{ ...lbl, marginBottom: 8 }}>1 · Select your country</label>
                    <CountryDropdown country={country} ipDetecting={ipDetecting} onSelect={handleSelectCountry} />
                  </div>
                )}

                {/* Gateway tabs */}
                {!onReceiptStep && !onTransientStep && country && country.gateways.length > 1 && !["gh_form","ng_info","ng_proof","crypto_info","crypto_proof"].includes(step) && (
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
                <span style={{ fontSize: 10, color: "rgba(245,245,240,0.16)" }}>AkwaPay · Crypto</span>
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