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
────────────────────────────────────────────────────────────────────────────── */

/* ─── DEBUG / VERBOSE LOGGING ─────────────────────────────────────────────── */
const DEBUG_STORAGE_KEY = "skybet_debug_logging";

type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

function readDebugEnabled(): boolean {
  try { return localStorage.getItem(DEBUG_STORAGE_KEY) === "1"; } catch { return false; }
}
function nowIso(): string { try { return new Date().toISOString(); } catch { return ""; } }

function makeLogger(ns: string, level: LogLevel) {
  const enabled = (l: Exclude<LogLevel, "silent">) => RANK[l] >= RANK[level];
  const prefix  = `%c${ns}`;
  const style   = "color:#60a5fa;font-weight:700;";
  const dim     = "color:#8A8D93;font-weight:400;";
  const ts      = () => `%c${nowIso()}`;
  const tsStyle = "color:#8A8D93;font-weight:400;font-size:10px;";
  return {
    debug: (m: string, d?: unknown) => { if (!enabled("debug")) return; d !== undefined ? console.debug(prefix + ` %c${m}`, style, dim, d, "\n" + ts(), tsStyle) : console.debug(prefix + ` %c${m}`, style, dim); },
    info:  (m: string, d?: unknown) => { if (!enabled("info"))  return; d !== undefined ? console.info(prefix  + ` %c${m}`, style, dim, d, "\n" + ts(), tsStyle) : console.info(prefix  + ` %c${m}`, style, dim); },
    warn:  (m: string, d?: unknown) => { if (!enabled("warn"))  return; d !== undefined ? console.warn(prefix  + ` %c${m}`, style, dim, d, "\n" + ts(), tsStyle) : console.warn(prefix  + ` %c${m}`, style, dim); },
    error: (m: string, d?: unknown) => { d !== undefined ? console.error(prefix + ` %c${m}`, style, dim, d, "\n" + ts(), tsStyle) : console.error(prefix + ` %c${m}`, style, dim); },
    group: (label: string, fn: () => void) => {
      if (!enabled("debug")) { fn(); return; }
      console.groupCollapsed(`${ns} ${label}`);
      try { fn(); } finally { console.groupEnd(); }
    },
  };
}

const _debugLevel: LogLevel = readDebugEnabled() ? "debug" : "warn";
const log      = makeLogger("[skybet:deposit]",       _debugLevel);
const logHttp  = makeLogger("[skybet:http]",          _debugLevel);
const logMomo  = makeLogger("[skybet:momo]",          _debugLevel);
const logPoll  = makeLogger("[skybet:poll]",          _debugLevel);
const logStep  = makeLogger("[skybet:step]",          _debugLevel);
const logStore = makeLogger("[skybet:store]",         _debugLevel);
const logWallet= makeLogger("[skybet:wallet]",        _debugLevel);
const logForm  = makeLogger("[skybet:form]",          _debugLevel);

if (typeof window !== "undefined") {
  try {
    if (!readDebugEnabled()) {
      console.info(
        `%c[skybet:deposit]%c Verbose logging off. Run localStorage.setItem("${DEBUG_STORAGE_KEY}","1") and reload to see full diagnostics.`,
        "color:#60a5fa;font-weight:700;", "color:#8A8D93;"
      );
    }
  } catch { /* ignore */ }
}

interface TimelineEntry { t: number; ns: string; msg: string; data?: unknown; }
const timeline: TimelineEntry[] = [];
function record(ns: string, msg: string, data?: unknown) {
  timeline.push({ t: Date.now(), ns, msg, data });
  if (timeline.length > 200) timeline.shift();
}

/* ─── CONSTANTS ───────────────────────────────────────────────────────────── */
const ACCOUNT_PATH = "/account";
const API_BASE     = "https://futballbackend-production-b1a0.up.railway.app";

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

const GH_MIN_AMOUNT    = 100;
const GH_QUICK_AMOUNTS = [100, 150, 300, 400, 500, 1000, 5000];

const BRAND            = "SkyBet";
const SUPPORT_EMAIL    = "support@skybet.com";
const SUPPORT_TELEGRAM = "skybet_Agent";

/* ─── Types ──────────────────────────────────────────────────────────────── */
type GatewayId    = "akwapay_gh";
type IntentStatus = "pending" | "unresolved" | "success" | "failed";

interface Country {
  code: string; name: string; flag: string; flagImg: string;
  currency: string; symbol: string; gateways: GatewayId[];
}

const COUNTRIES: Country[] = [
  { code: "GH", name: "Ghana", flag: "🇬🇭", flagImg: "https://flagcdn.com/w40/gh.png", currency: "GHS", symbol: "GH₵", gateways: ["akwapay_gh"] },
];

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
  green:       "#4ade80",
  greenLow:    "rgba(74,222,128,0.08)",
  greenMid:    "rgba(74,222,128,0.28)",
};

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

/* ─── HTTP helpers ────────────────────────────────────────────────────────── */
const tok = () => getSessionToken() || "";

async function authFetch(path: string, init?: RequestInit) {
  const method = init?.method ?? "GET";
  let parsedBody: unknown;
  if (typeof init?.body === "string") { try { parsedBody = JSON.parse(init.body); } catch { parsedBody = init.body; } }
  logHttp.group(`${method} ${path}`, () => logHttp.debug("request", { url: `${API_BASE}${path}`, method, body: parsedBody }));
  record("http", `${method} ${path} →`, parsedBody);
  const t0 = performance.now();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}`, ...(init?.headers ?? {}) },
    });
  } catch (e) {
    const err = e instanceof Error ? { name: e.name, message: e.message } : e;
    logHttp.error(`network error on ${method} ${path}`, err);
    record("http", `${method} ${path} — network error`, err);
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON */ }
  const ms = Math.round(performance.now() - t0);
  if (!res.ok) {
    logHttp.error(`← ${res.status} ${method} ${path}`, { ms, status: res.status, requestBody: parsedBody, responseBody: data });
    record("http", `${method} ${path} ← ${res.status}`, { ms, data });
    throw new Error((data?.message as string) || (data?.error as string) || `Server error ${res.status}`);
  }
  logHttp.debug(`← ${res.status} ${method} ${path}`, { ms, data });
  record("http", `${method} ${path} ← ${res.status} ok`, { ms, data });
  return data;
}
const authGet  = (path: string) => authFetch(path);
const authPost = (path: string, body: object) => authFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/* ─── Payload helpers ─────────────────────────────────────────────────────── */
type GwPayload = Record<string, unknown> | null | undefined;
const unwrap = (d: GwPayload): GwPayload =>
  d && typeof d === "object" && "data" in d ? (d.data as GwPayload) : d;
const gnum = (d: GwPayload, k: string): number | null => { const v = d?.[k]; return typeof v === "number" ? v : null; };

/* ─── Pending deposit persistence ──────────────────────────────────────────── */
interface PendingDeposit {
  intentId: string; reference: string; amount: string; phone: string;
  network: GhNetworkCode; ussdFallback: string | null; checkoutUrl: string | null; at: number;
}
function savePending(p: PendingDeposit) {
  logStore.group(`save intent=${p.intentId}`, () => logStore.debug("pending payload", p));
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch (e) { logStore.warn("sessionStorage write failed", e); }
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch (e) { logStore.warn("localStorage write failed", e); }
  record("store", "pending saved", p);
}
function readPending(): PendingDeposit | null {
  for (const [name, s] of [["sessionStorage", sessionStorage], ["localStorage", localStorage]] as const) {
    try {
      const raw = s.getItem(PENDING_KEY);
      if (!raw) continue;
      const p = JSON.parse(raw) as PendingDeposit;
      if (p?.at && Date.now() - p.at > 24 * 60 * 60 * 1000) { logStore.warn(`${name} pending expired`, p); continue; }
      logStore.info(`restored pending from ${name}`, p);
      return p;
    } catch (e) { logStore.warn(`${name} read/parse failed`, e); }
  }
  return null;
}
function clearPending() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
  record("store", "pending cleared");
}

/* ─── Receipt ─────────────────────────────────────────────────────────────── */
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
  const r = { ...o, issuedAt, receiptNo: o.receiptNo ?? `CB-${new Date(issuedAt).getTime().toString(36).toUpperCase()}` };
  log.info("receipt generated", r);
  return r;
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
function SkyMark({ size = 30, color = T.white }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 32 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="7" r="4.4" fill="none" stroke={color} strokeWidth="1.4" />
      <path d="M4 20C1.8 20 0 18.2 0 16C0 13.8 1.8 12 4 12C4.5 9.6 6.7 8 9.2 8C12 8 14.3 10 14.7 12.7C17.4 12.9 19.5 15.1 19.5 17.8C19.5 20 17.6 20 15.5 20H4Z" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function ElapsedTicker({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const secs = Math.max(0, Math.round((now - since) / 1000));
  const label = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.dim, fontWeight: 600 }}>{label} elapsed</span>;
}

function PollProgressBar({ startedAt, timeoutSec }: { startedAt: number; timeoutSec: number }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const tick = () => setPct(Math.min(100, ((Date.now() - startedAt) / 1000 / timeoutSec) * 100));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [startedAt, timeoutSec]);
  return (
    <div style={{ height: 4, borderRadius: 99, background: T.border, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ height: "100%", borderRadius: 99, background: T.white, width: `${pct}%`, transition: "width 1s linear" }} />
    </div>
  );
}

function DiagnosticsPanel({ intentId, reference }: { intentId: string; reference: string }) {
  const [open, setOpen] = useState(false);
  const entries = timeline.filter(e =>
    !intentId ||
    JSON.stringify(e.data ?? "").includes(intentId) ||
    JSON.stringify(e.data ?? "").includes(reference) ||
    e.ns === "step"
  );
  return (
    <div className="_noprint" style={{ marginTop: 10 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: T.dim, fontSize: 10, fontWeight: 700, padding: 0, fontFamily: "inherit" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{open ? "expand_less" : "bug_report"}</span>
        {open ? "Hide diagnostics" : "Show diagnostics"}
      </button>
      {open && (
        <div style={{ marginTop: 8, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", maxHeight: 200, overflowY: "auto" }}>
          {entries.length === 0 && <div style={{ fontSize: 11, color: T.dim }}>No events recorded yet.</div>}
          {entries.map((e, i) => (
            <div key={i} style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: T.dim, marginBottom: 5, lineHeight: 1.5, wordBreak: "break-word" }}>
              <span style={{ color: T.white, fontWeight: 700 }}>{new Date(e.t).toLocaleTimeString()}</span>{" "}
              <span style={{ color: T.dim }}>[{e.ns}]</span> {e.msg}
              {e.data !== undefined && <div style={{ color: T.dim, opacity: 0.7, marginTop: 2 }}>{JSON.stringify(e.data)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Receipt component ───────────────────────────────────────────────────── */
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
          MoMo details are never stored by {BRAND}.<br />
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

/* ─── Trust badges ────────────────────────────────────────────────────────── */
function TrustBadges() {
  return (
    <div className="_noprint" style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Trusted Payment Partner</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.faint, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.dim }}>smartphone</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.white }}>Mobile Money</div>
            <div style={{ fontSize: 9, color: T.dim }}>Ghana · AkwaPay</div>
          </div>
        </div>
      </div>
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
  const steps = [
    "Enter your MoMo number (MTN, Telecel, or AirtelTigo) and the GHS amount.",
    `Tap "Send payment prompt" — AkwaPay pushes an approval prompt to your phone.`,
    "If a USSD code appears on screen, dial it manually to approve.",
    "Open the MoMo prompt on your phone and confirm with your PIN.",
    "Stay on this page — it confirms automatically and your receipt appears once credited.",
  ];
  return (
    <div className="_noprint" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginTop: 16, animation: "_fadeUp 0.3s ease" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.raised2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: 18, color: T.white }}>menu_book</span></div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.white }}>How to deposit</div>
          <div style={{ fontSize: 11, color: T.dim }}>Step-by-step for Ghana Mobile Money</div>
        </div>
        <span className="material-symbols-outlined" style={{ color: T.dim, fontSize: 18, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>expand_more</span>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "16px 20px" }}>
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            {steps.map((s, i) => <li key={i} style={{ fontSize: 12, color: T.dim, lineHeight: 1.6 }}><span style={{ color: T.white }}>{s}</span></li>)}
          </ol>
          <div style={{ marginTop: 14, background: T.faint, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 13px", fontSize: 11, color: T.dim, lineHeight: 1.6, display: "flex", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: T.white, flexShrink: 0, marginTop: 1 }}>receipt_long</span>
            <span><strong style={{ color: T.white }}>Processed by AkwaPay</strong> — every deposit gets a printable receipt.</span>
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

/* ── USSD Fallback banner ── */
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
  phone: string; amount: string; network: GhNetworkCode;
  ussdFallback: string | null; checkoutUrl: string | null;
  showUssd: boolean; setShowUssd: (v: boolean) => void;
  loading: boolean; error: string;
  pushSentAt: number | null;
  intentId: string; reference: string;
  onConfirm: () => void; onReset: () => void;
}
function GhAwaitPromptScreen({ phone, amount, network, ussdFallback, checkoutUrl, showUssd, setShowUssd, loading, error, pushSentAt, intentId, reference, onConfirm, onReset }: GhAwaitPromptProps) {
  const netLabel = GH_NETWORKS.find(n => n.value === network)?.label ?? network;
  const parsedAmt = parseFloat(amount);

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

      {pushSentAt && (
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Spin /><ElapsedTicker since={pushSentAt} />
        </div>
      )}

      {!showUssd && (
        <div style={{ fontSize: 11.5, color: T.dim, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span>Checking automatically…{" "}
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
      <DiagnosticsPanel intentId={intentId} reference={reference} />
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

      {!pollStopped && <PollProgressBar startedAt={pollStartedAt} timeoutSec={POLL_TIMEOUT_SEC} />}

      {phone && (
        <div style={{ background: T.inkLow, border: `1px solid ${T.inkMid}`, borderRadius: 10, padding: "10px 13px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.white }}>smartphone</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: T.dim, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 3 }}>MoMo number</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.white }}>{phone}</div>
          </div>
          {pushSentAt && <ElapsedTicker since={pushSentAt} />}
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
      <DiagnosticsPanel intentId={intentId} reference={reference} />
    </div>
  );
}

/* ══ RESULT SCREENS ══ */
interface ResultScreenProps { outcome: "success" | "failed"; receipt: ReceiptData | null; message?: string; amountLabel?: string; onAccount: () => void; onReset: () => void; }
function ResultScreen({ outcome, receipt, message, amountLabel, onAccount, onReset }: ResultScreenProps) {
  const isSuccess = outcome === "success";
  return (
    <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
      <div className="_noprint" style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: isSuccess ? T.greenLow : T.dangerLow, border: `2px solid ${isSuccess ? T.greenMid : T.dangerMid}` }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: isSuccess ? T.green : T.danger }}>{isSuccess ? "check_circle" : "error"}</span>
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
   BACKGROUND POLL HOOK
══════════════════════════════════════════════════════════════════════════════ */
function useBackgroundPoll(active: boolean, probe: () => Promise<void>) {
  const [startedAt, setStartedAt]   = useState<number>(Date.now());
  const [stopped, setStopped]       = useState(false);
  const probeRef     = useRef(probe);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef   = useRef<number>(Date.now());
  const inFlightRef  = useRef(false);
  const tickCountRef = useRef(0);

  useEffect(() => { probeRef.current = probe; }, [probe]);

  const safeProbe = useCallback(async () => {
    if (inFlightRef.current) { logPoll.debug("probe skipped — one already in flight"); return; }
    inFlightRef.current = true;
    try { await probeRef.current(); } finally { inFlightRef.current = false; }
  }, []);

  useEffect(() => {
    if (!active) { logPoll.debug("poll inactive"); return; }
    const start = Date.now();
    startedRef.current = start; setStartedAt(start); setStopped(false);
    tickCountRef.current = 0;
    let cancelled = false;
    logPoll.info("poll starting", { phases: POLL_PHASES });
    record("poll", "poll starting");

    const scheduleNext = () => {
      if (cancelled) return;
      const elapsedSec = (Date.now() - startedRef.current) / 1000;
      const phase = POLL_PHASES.find(p => elapsedSec < p.untilSec);
      if (!phase) { logPoll.warn("poll timed out client-side", { elapsedSec }); setStopped(true); return; }
      timerRef.current = setTimeout(tick, phase.intervalMs);
    };
    const tick = async () => {
      if (cancelled) return;
      tickCountRef.current += 1;
      logPoll.debug(`tick #${tickCountRef.current}`);
      await safeProbe();
      if (cancelled) return;
      scheduleNext();
    };
    void tick();

    const onVisible = () => { if (document.visibilityState === "visible") { logPoll.debug("tab visible — catch-up probe"); void safeProbe(); } };
    const onFocus   = () => { logPoll.debug("window focused — catch-up probe"); void safeProbe(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      logPoll.debug("poll cleanup", { ticksRun: tickCountRef.current });
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
  | "gh_form" | "gh_await_prompt" | "gh_checkout_redirect" | "gh_otp" | "gh_pending" | "gh_success" | "gh_failed";

export default function DepositPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = getSessionToken();
    if (!t) {
      log.warn("auth: no token — redirecting to login");
      navigate("/login", { replace: true, state: { from: "/deposit" } });
    }
  }, [navigate]);

  const { country: registeredCountry } = useCountry();

  const [country,     setCountry]     = useState<Country | null>(null);
  const [ipDetecting, setIpDetecting] = useState(true);
  const [error,       setError]       = useState("");
  const [receipt,     setReceipt]     = useState<ReceiptData | null>(null);
  const [step,        setStep]        = useState<Step>("form");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const prevStepRef = useRef<Step>(step);
  useEffect(() => {
    if (prevStepRef.current !== step) {
      logStep.info(`${prevStepRef.current} → ${step}`);
      record("step", `${prevStepRef.current} → ${step}`);
      prevStepRef.current = step;
    }
  }, [step]);

  /* ─── Wallet balance ─────────────────────────────────────────────────────── */
  const refreshWallet = useCallback(async () => {
    try {
      logWallet.debug("refreshing wallet balance");
      const raw = await authGet("/api/wallet");
      const data = unwrap(raw as GwPayload);
      const bal = gnum(data, "balance") ?? gnum(data, "availableBalance");
      if (bal !== null) { setWalletBalance(bal); logWallet.info("balance updated", { balance: bal }); }
    } catch (e) { logWallet.warn("wallet refresh failed", e); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { refreshWallet(); }, [refreshWallet]);

  /* ─── GH — AkwaPay state ─────────────────────────────────────────────────── */
  const [ghAmount,       setGhAmount]       = useState("");
  const [ghPhone,        setGhPhone]        = useState("");
  const [ghNetwork,      setGhNetwork]      = useState<GhNetworkCode>("");
  const [ghIntentId,     setGhIntentId]     = useState("");
  const [ghReference,    setGhReference]    = useState("");
  const [ghUssdFallback, setGhUssdFallback] = useState<string | null>(null);
  const [ghCheckoutUrl,  setGhCheckoutUrl]  = useState<string | null>(null);
  const [ghClientSecret, setGhClientSecret] = useState("");
  const [ghOtp,          setGhOtp]          = useState("");
  const [ghOtpError,     setGhOtpError]     = useState("");
  const [ghOtpLoading,   setGhOtpLoading]   = useState(false);
  const [ghErrs,         setGhErrs]         = useState<Record<string, string>>({});
  const [ghLoading,      setGhLoading]      = useState(false);
  const [ghIntentStatus, setGhIntentStatus] = useState<IntentStatus>("pending");
  const [ghSettledAt,    setGhSettledAt]    = useState<number>(Date.now());
  const [ghManualChecking, setGhManualChecking] = useState(false);
  const [ghShowUssd,     setGhShowUssd]     = useState(false);
  const [ghWaitingLong,  setGhWaitingLong]  = useState(false);
  const pushSentAtRef    = useRef<number | null>(null);
  const lastRawStatusRef = useRef<string>("");
  const submittingRef    = useRef(false);

  useEffect(() => {
    if (ghPhone.replace(/[^\d]/g, "").length >= 10) {
      const detected = detectNetwork(ghPhone);
      if (detected && !ghNetwork) { logMomo.info("auto-detected network", { detected }); setGhNetwork(detected); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghPhone]);

  useEffect(() => {
    if (step !== "gh_await_prompt" && step !== "gh_pending") { setGhShowUssd(false); return; }
    const timer = setTimeout(() => setGhShowUssd(true), USSD_WAIT_SEC * 1000);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (step !== "gh_pending" || !(ghIntentStatus === "pending" || ghIntentStatus === "unresolved")) { setGhWaitingLong(false); return; }
    const timer = setTimeout(() => setGhWaitingLong(true), 90_000);
    return () => clearTimeout(timer);
  }, [step, ghIntentStatus, ghSettledAt]);
  useEffect(() => { if (ghWaitingLong) setGhShowUssd(true); }, [ghWaitingLong]);

  /* ─── GH probe ──────────────────────────────────────────────────────────── */
  const probeGhIntent = useCallback(async (id: string) => {
    if (!id) { logPoll.warn("probeGhIntent: empty intentId — skipping"); return; }
    try {
      const result  = await authGet(AKWAPAY_STATUS_PATH(id));
      const payload = (result?.data ?? result) as Record<string, unknown>;
      const data    = (payload?.data ?? payload) as Record<string, unknown>;
      const s       = String(data?.status ?? "pending").toLowerCase();
      const liveRef = data?.reference != null ? String(data.reference) : "";
      const changed = s !== lastRawStatusRef.current;
      logPoll.debug("poll tick", { intentId: id, status: s, changed });
      record("poll", `status='${s}'${changed ? " (changed)" : ""}`, { intentId: id });
      lastRawStatusRef.current = s;

      if (AKWAPAY_SUCCESS.includes(s)) {
        logPoll.info("payment confirmed succeeded", { intentId: id });
        setGhSettledAt(Date.now()); setGhIntentStatus("success"); clearPending(); await refreshWallet();
      } else if (AKWAPAY_FAILED.includes(s)) {
        logPoll.warn("payment failed/declined/cancelled", { intentId: id, status: s });
        setGhIntentStatus("failed"); clearPending();
      } else if (AKWAPAY_PENDING.includes(s)) {
        setGhIntentStatus("pending");
        const waitedSec = pushSentAtRef.current ? Math.round((Date.now() - pushSentAtRef.current) / 1000) : null;
        if (waitedSec !== null && waitedSec > 60) {
          logPoll.error("[SYNC-GAP-SUSPECTED] AkwaPay intent stuck >60s", { intentId: id, reference: liveRef, waitedSec });
          record("poll", "SYNC-GAP-SUSPECTED", { intentId: id, reference: liveRef, waitedSec });
        }
      } else {
        logPoll.warn("unrecognised status from backend", { intentId: id, status: s });
        setGhIntentStatus("unresolved");
      }
    } catch (e) {
      logPoll.error("probe request failed", { intentId: id, error: e instanceof Error ? e.message : e });
    }
  }, [refreshWallet]); // eslint-disable-line react-hooks/exhaustive-deps

  const boundProbe = useCallback(() => probeGhIntent(ghIntentId), [probeGhIntent, ghIntentId]);

  const ghPollActive =
    (step === "gh_await_prompt" || step === "gh_pending") &&
    (ghIntentStatus === "pending" || ghIntentStatus === "unresolved");
  const { startedAt: ghPollStartedAt, stopped: ghPollStopped } =
    useBackgroundPoll(ghPollActive, boundProbe);

  useEffect(() => {
    if (step === "gh_await_prompt" && (ghIntentStatus === "success" || ghIntentStatus === "failed")) {
      logStep.info("await_prompt resolved via background poll — advancing", { ghIntentId, ghIntentStatus });
      setStep("gh_pending");
    }
  }, [step, ghIntentStatus, ghIntentId]);

  useEffect(() => {
    if (ghIntentStatus !== "success" || !ghIntentId) return;
    logStep.info("intent succeeded — building receipt", { ghIntentId, ghReference, ghAmount });
    setReceipt(prev => prev ?? makeReceipt({
      outcome: "success",
      method: `Mobile Money · AkwaPay (${GH_NETWORKS.find(n => n.value === ghNetwork)?.label ?? ghNetwork})`,
      usdAmount: "", localAmount: ghAmount, currency: "GHS", symbol: "GH₵",
      customerName: ghPhone, reference: ghReference, transactionId: ghIntentId,
    }));
    setStep("gh_success");
  }, [ghIntentStatus, ghIntentId, ghSettledAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ghIntentStatus === "failed" && (step === "gh_pending" || step === "gh_await_prompt")) {
      logStep.warn("intent failed — showing failure screen", { ghIntentId });
      setReceipt(makeReceipt({
        outcome: "failed",
        method: `Mobile Money · AkwaPay (${GH_NETWORKS.find(n => n.value === ghNetwork)?.label ?? ghNetwork})`,
        usdAmount: "", localAmount: ghAmount, currency: "GHS", symbol: "GH₵",
        customerName: ghPhone, reference: ghReference, transactionId: ghIntentId,
        pendingNote: "Payment was declined, cancelled, or expired.",
      }));
      setStep("gh_failed");
    }
  }, [ghIntentStatus, step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const p = readPending();
    if (!p?.intentId) return;
    log.info("restoring pending deposit after refresh", p);
    setGhIntentId(p.intentId); setGhReference(p.reference); setGhAmount(p.amount);
    setGhPhone(p.phone ?? ""); setGhNetwork(p.network ?? "");
    setGhUssdFallback(p.ussdFallback ?? null); setGhCheckoutUrl(p.checkoutUrl ?? null);
    setGhSettledAt(Date.now()); setGhIntentStatus("pending");
    pushSentAtRef.current = p.at ?? Date.now();
    setStep("gh_pending");
    void probeGhIntent(p.intentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── GH submit ──────────────────────────────────────────────────────────── */
  const validateGh = () => {
    const e: Record<string, string> = {};
    if (!ghPhone.trim() || ghPhone.replace(/[^0-9]/g, "").length < 9) e.phone = "Enter a valid Mobile Money number";
    if (!ghNetwork) e.network = "Select your network";
    const amt = parseFloat(ghAmount);
    if (!ghAmount || isNaN(amt) || amt < GH_MIN_AMOUNT) e.amount = `Minimum deposit is GH₵${GH_MIN_AMOUNT}`;
    logForm[Object.keys(e).length ? "warn" : "debug"]("client-side validation", { errors: e });
    setGhErrs(e); return Object.keys(e).length === 0;
  };

  const handleGhSubmit = async () => {
    if (submittingRef.current) { logMomo.warn("init: blocked duplicate submit"); return; }

    const existing = readPending();
    if (existing?.intentId) {
      logMomo.warn("init: resuming existing pending intent", existing);
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

    const maskedPhone = ghPhone.length > 4 ? ghPhone.slice(0, 3) + "***" + ghPhone.slice(-2) : "<short>";
    const payload = { amount: parseFloat(ghAmount), phone: normalizePhone(ghPhone), network: ghNetwork };
    logMomo.group("POST /init", () => logMomo.info("outgoing payload", { amount: payload.amount, phoneMasked: maskedPhone, network: payload.network }));
    record("momo", "POST /init", { amount: payload.amount, phoneMasked: maskedPhone, network: payload.network });

    try {
      const result = await authPost(AKWAPAY_INIT_PATH, payload);
      const intent    = (result?.data ?? result ?? {}) as Record<string, unknown>;
      const newId     = String(intent?.id ?? "");
      const newRef    = String(intent?.reference ?? "");
      const nextAction= intent?.next_action as Record<string, unknown> | null | undefined;
      const nextType  = String(nextAction?.type ?? "none");
      const newUssd   = nextAction?.ussdFallback != null ? String(nextAction.ussdFallback) : null;
      const newCheckout = intent?.checkout_url != null ? String(intent.checkout_url) : null;
      const rawStatus = String(intent?.status ?? "").toLowerCase();
      const newSecret = String(intent?.client_secret ?? "");

      logMomo.debug("intent created", { intentId: newId, reference: newRef, nextType, rawStatus });
      record("momo", "intent created", { intentId: newId, reference: newRef, nextType, rawStatus });

      if (!newId) {
        logMomo.error("backend returned no intent id", { fullResult: result });
        throw new Error("Payment gateway returned no intent ID. Please try again.");
      }

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
      logMomo.warn("unrecognised next_action.type — falling back to poll", { nextType, intentId: newId, rawStatus });
      setGhIntentStatus(AKWAPAY_FAILED.includes(rawStatus) ? "failed" : AKWAPAY_PENDING.includes(rawStatus) ? "pending" : "unresolved");
      setGhLoading(false); setStep("gh_pending");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not start the deposit. Please try again.";
      logMomo.error("init failed", { message: msg });
      setError(msg); setGhLoading(false);
    } finally { submittingRef.current = false; }
  };

  const handleGhCheckoutFallback = async () => {
    if (submittingRef.current) { logMomo.warn("checkout fallback: blocked"); return; }
    const parsedAmt = parseFloat(ghAmount);
    if (!ghAmount || isNaN(parsedAmt) || parsedAmt <= 0) { setGhErrs(p => ({ ...p, amount: "Enter an amount first" })); return; }
    submittingRef.current = true; setGhLoading(true); setError("");
    try {
      const result = await authPost(AKWAPAY_CHECKOUT_PATH, { amount: parsedAmt });
      const intent = (result?.data ?? result ?? {}) as Record<string, unknown>;
      const newId  = String(intent?.id ?? "");
      const newRef = String(intent?.reference ?? "");
      const url    = intent?.checkout_url != null ? String(intent.checkout_url) : null;
      if (!url) throw new Error("No checkout URL returned. Please try again or contact support.");
      setGhIntentId(newId); setGhReference(newRef); setGhCheckoutUrl(url);
      savePending({ intentId: newId, reference: newRef, amount: ghAmount, phone: "", network: "", ussdFallback: null, checkoutUrl: url, at: Date.now() });
      setGhLoading(false); setStep("gh_checkout_redirect");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not open checkout. Please try again.";
      logMomo.error("checkout fallback failed", { message: msg });
      setError(msg); setGhLoading(false);
    } finally { submittingRef.current = false; }
  };

  const proceedGhToPoll = () => {
    logStep.info("user confirmed approval — moving to polling", { ghIntentId, ghReference });
    setGhIntentStatus("pending"); setStep("gh_pending");
  };

  const handleGhOtpSubmit = async () => {
    const trimmed = ghOtp.trim();
    if (!trimmed) { setGhOtpError("Enter the OTP sent to your phone."); return; }
    if (!ghIntentId || !ghClientSecret) { setGhOtpError("Missing payment reference — please start over."); return; }
    setGhOtpLoading(true); setGhOtpError("");
    try {
      const result = await authPost(AKWAPAY_OTP_PATH, { intentId: ghIntentId, clientSecret: ghClientSecret, otp: trimmed });
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
    logPoll.info("manual check now triggered", { ghIntentId });
    record("poll", "manual check now");
    setGhManualChecking(true);
    await probeGhIntent(ghIntentId);
    setGhManualChecking(false);
  }, [probeGhIntent, ghIntentId]);

  /* ─── Resets ──────────────────────────────────────────────────────────────── */
  const resetGhState = useCallback(() => {
    setGhAmount(""); setGhPhone(""); setGhNetwork(""); setGhIntentId(""); setGhReference("");
    setGhUssdFallback(null); setGhCheckoutUrl(null); setGhClientSecret(""); setGhOtp(""); setGhOtpError("");
    setGhErrs({}); setGhLoading(false); setGhIntentStatus("pending"); setGhManualChecking(false);
    setGhShowUssd(false); setGhWaitingLong(false);
    pushSentAtRef.current = null; lastRawStatusRef.current = "";
  }, []);

  const reset = useCallback(() => {
    log.info("reset — clearing all state");
    clearPending();
    resetGhState();
    setError(""); setReceipt(null); setStep("gh_form");
  }, [resetGhState]);

  const goAccount = useCallback(() => navigate(ACCOUNT_PATH, { replace: true }), [navigate]);

  /* ─── Country pre-selection ───────────────────────────────────────────────── */
  useEffect(() => {
    const found = COUNTRIES.find(c => c.code === registeredCountry.code) ?? COUNTRIES[0];
    setCountry(found);
    setIpDetecting(false);
    setStep("gh_form");
  }, [registeredCountry.code]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Restore pending on mount ─────────────────────────────────────────── */
  useEffect(() => {
    const p = readPending();
    if (!p?.intentId) return;
    log.info("restoring pending deposit after refresh", p);
    setGhIntentId(p.intentId); setGhReference(p.reference); setGhAmount(p.amount);
    setGhPhone(p.phone ?? ""); setGhNetwork(p.network ?? "");
    setGhUssdFallback(p.ussdFallback ?? null); setGhCheckoutUrl(p.checkoutUrl ?? null);
    setGhSettledAt(Date.now()); setGhIntentStatus("pending");
    pushSentAtRef.current = p.at ?? Date.now();
    setStep("gh_pending");
    void probeGhIntent(p.intentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Derived flags ───────────────────────────────────────────────────────── */
  const onReceiptStep   = ["gh_success", "gh_failed"].includes(step);
  const onTransientStep = ["gh_await_prompt", "gh_checkout_redirect", "gh_otp", "gh_pending"].includes(step);

  const stepIndex = () => {
    if (onReceiptStep || onTransientStep) return 2;
    return 1;
  };

  /* ─── renderPanel ─────────────────────────────────────────────────────────── */
  const renderPanel = () => {
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
        intentId={ghIntentId} reference={ghReference}
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
                Minimum deposit: <span style={{ color: T.white, fontWeight: 600 }}>GH₵{GH_MIN_AMOUNT}</span>
              </div>
              <TrustBadges />
              <HowToDepositPanel />
              <SupportPanel />
            </div>

            {/* Right form column */}
            <div style={{ background: T.surface, borderRadius: 16, overflow: "visible", border: `1px solid ${T.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "_fadeUp 0.5s ease" }}>
              <div style={{ padding: "20px 20px 24px" }}>
                <StepIndicator steps={["Enter details", "Pay"]} current={stepIndex()} />

                {ipDetecting && (
                  <div style={{ textAlign: "center", padding: "28px 0 8px", color: T.dim, fontSize: 13 }}>
                    <Spin /> &nbsp;Loading…
                  </div>
                )}

                {!ipDetecting && (
                  <>
                    {/* Section divider */}
                    {!onReceiptStep && (
                      <div className="_noprint" style={{ marginBottom: 18 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                          <div style={{ flex: 1, height: 1, background: T.border }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.7px" }}>Mobile Money · Ghana</span>
                          <div style={{ flex: 1, height: 1, background: T.border }} />
                        </div>
                      </div>
                    )}
                    {renderPanel()}
                  </>
                )}
              </div>

              <div className="_noprint" style={{ borderTop: `1px solid ${T.border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 11, color: "rgba(245,245,240,0.22)", display: "flex", alignItems: "center", gap: 5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                  256-bit encrypted · {BRAND}
                </span>
                <span style={{ fontSize: 10, color: "rgba(245,245,240,0.16)" }}>AkwaPay</span>
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