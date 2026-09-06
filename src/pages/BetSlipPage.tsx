import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { useCountry } from '../hooks/useCountry';
import { calculateTotalOdds, calculatePotentialReturn } from '../utils';
import { bets as betsApi, booking, wallet as walletApi, publicFootball as publicMatches } from '../utils/api';
import type { Bet, BetSelection } from '../utils/api';

import html2canvas from 'html2canvas';

import trophyImg from '../trophy.png';

import ReceiptLongIcon          from '@mui/icons-material/ReceiptLong';
import HistoryIcon              from '@mui/icons-material/History';
import DeleteIcon               from '@mui/icons-material/Delete';
import EmojiEventsIcon          from '@mui/icons-material/EmojiEvents';
import CloseIcon                from '@mui/icons-material/Close';
import CircularProgress         from '@mui/icons-material/Loop';
import RefreshIcon              from '@mui/icons-material/Refresh';
import LoginIcon                from '@mui/icons-material/Login';
import QrCodeIcon               from '@mui/icons-material/QrCode';
import SportsSoccerIcon         from '@mui/icons-material/SportsSoccer';
import CheckCircleIcon          from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon         from '@mui/icons-material/InfoOutlined';
import ShareIcon                from '@mui/icons-material/Share';
import DownloadIcon             from '@mui/icons-material/Download';
import ArrowForwardIcon         from '@mui/icons-material/ArrowForward';
import ArrowBackIcon            from '@mui/icons-material/ArrowBack';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ContentCopyIcon          from '@mui/icons-material/ContentCopy';
import PublicIcon               from '@mui/icons-material/Public';
import VerifiedIcon             from '@mui/icons-material/Verified';
import WorkspacePremiumIcon     from '@mui/icons-material/WorkspacePremium';
import AutoGraphIcon            from '@mui/icons-material/AutoGraph';
import AddIcon                  from '@mui/icons-material/Add';
import RemoveIcon               from '@mui/icons-material/Remove';
import ConfirmationNumberIcon   from '@mui/icons-material/ConfirmationNumber';

// ---------------------------------------------------------------------------
// Constants — SKYBET PSL brand system (GREY / BLACK / WHITE)
// A single small green accent is reserved ONLY for match/selection detail
// text (the "Pick: X @ Y" lines) — everything else in the product is
// monochrome now: black CTAs, grey surfaces, white cards.
// ---------------------------------------------------------------------------

// Height reserved at the bottom of every full-screen sheet/modal so their
// action buttons never sit underneath a fixed bottom nav bar.
const BOTTOM_NAV_CLEARANCE = 96;

// Minimum stake (and max stake / min deposit / min withdrawal, where
// referenced) come straight from the registered country's config — the
// exact same source AccountPage's "Region & Currency" card reads from via
// useCountry(). There is no USD conversion and no live-rate lookup here
// any more: whatever the player registered under is what they see.

// Brand identity — SkyBet: blue accent for live UI; receipt stays grey/black/white.
const BRAND_NAME         = 'SKYBET PSL';
const BRAND_PRIMARY      = '#3b82f6'; // blue accent — primary CTA / live UI highlights
const BRAND_ACCENT       = '#374151'; // dark grey — active states / links
const BRAND_ACCENT_LIGHT = '#6b7280'; // mid grey — secondary highlights
const BRAND_DARK         = '#0d1422'; // dark-mode surface
const BRAND_DARK_DEEP    = '#070b14'; // deepest background
const BRAND_GREY         = '#6b7280'; // neutral grey — "LOST" banners, muted text
const BRAND_GREY_LIGHT   = '#e5e7eb'; // light grey — borders, dividers, chips
const RECEIPT_INK        = '#111827'; // near-black — printable receipt only (BrandMark)

// The ONLY spot of colour left in the whole UI: match/selection detail text.
const MATCH_GREEN = '#16a34a';

const DEBUG = (() => { try { return localStorage.getItem('SKYBET_DEBUG') === 'true'; } catch { return false; } })();
function log(area: string, ...args: unknown[])      { if (!DEBUG) return; console.log(`%c[SkyBet:${area}]`, 'color:#6b7280;font-weight:bold', ...args); }
function logWarn(area: string, ...args: unknown[])  { console.warn(`[SkyBet:${area}]`, ...args); }
function logError(area: string, ...args: unknown[]) { console.error(`[SkyBet:${area}]`, ...args); }

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------
export interface CurrencyInfo {
  code: string; symbol: string; name: string;
  locale: string; countryCode: string; countryName: string;
  flag: string; rateToGHS: number;
  // Stake / deposit / withdrawal floors (and stake ceiling), read directly
  // off the registered country's config. Same fields AccountPage's "Region
  // & Currency" card displays — kept here so every stake control on this
  // page agrees with what the player sees there.
  minStake: number; maxStake: number; minDeposit: number; minWithdrawal: number;
}

/* The FX table, live-rate fetcher and three-provider IP detection that used to
   live here are all deleted. Nothing converts any more (parity rule), and the
   country comes from registration rather than from the request's IP. The
   COUNTRY_CURRENCY_MAP above is retained only for the share-image renderer's
   flag lookup — src/config/countries.ts is the authoritative registry. */

export function useCurrency() {
  /* ── Driven by the REGISTERED country, not by IP ────────────────────────
     This used to race detectCountryFromIP() against a live FX endpoint on
     every mount, then convert every figure on the slip through the returned
     rate — including a $9 USD stake floor divided through a second live
     rate. It contradicted the country the user registered with, it blocked
     the slip on network calls, and the totals (and the minimum stake
     itself) visibly shifted when the rate resolved.

     This now mirrors AccountPage exactly: useCountry() reads the
     registration choice straight out of the store, and stake/deposit/
     withdrawal limits come from that same country config instead of being
     derived from a USD figure run through a rates table. Under the parity
     rule (1 cedi = 1 naira = 1 shilling) amounts don't need converting
     either — rateToGHS is fixed at 1 and only the symbol changes. The shape
     of the returned object is unchanged, so every consumer below — fromGHS,
     toGHS, formatLocal, the share-image renderer, the stake controls —
     keeps working without edits.
     -------------------------------------------------------------------- */
  const { country } = useCountry();

  const currency = useMemo<CurrencyInfo>(() => ({
    code: country.currency,
    symbol: country.symbol,
    name: country.currencyName,
    locale: country.locale,
    flag: country.flag,
    countryCode: country.code,
    countryName: country.name,
    rateToGHS: 1,
    minStake: country.minStake,
    maxStake: country.maxStake,
    minDeposit: country.minDeposit,
    minWithdrawal: country.minWithdrawal,
  }), [country]);

  const loading = false;
  const error: string | null = null;

  const fromGHS     = useCallback((ghs: number) => ghs * currency.rateToGHS, [currency.rateToGHS]);
  const toGHS       = useCallback((local: number) => currency.rateToGHS === 0 ? local : local / currency.rateToGHS, [currency.rateToGHS]);
  const formatLocal = useCallback((ghs: number) => {
    const v = fromGHS(ghs);
    try {
      return new Intl.NumberFormat(currency.locale, {
        style:'currency', currency:currency.code,
        minimumFractionDigits: ['JPY','UGX','XAF','XOF','RWF','NGN'].includes(currency.code) ? 0 : 2,
        maximumFractionDigits: ['JPY','UGX','XAF','XOF','RWF','NGN'].includes(currency.code) ? 0 : 2,
      }).format(v);
    } catch { return `${currency.symbol}${v.toFixed(2)}`; }
  }, [currency, fromGHS]);

  const minStakeLocal = currency.minStake;
  return { currency, loading, error, fromGHS, toGHS, formatLocal, minStakeLocal };
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
function useTheme(): 'light' | 'dark' {
  const getTheme = (): 'light' | 'dark' => {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    const cls = document.documentElement.classList;
    if (cls.contains('light')) return 'light';
    if (cls.contains('dark'))  return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  const [theme, setTheme] = useState<'light' | 'dark'>(getTheme);
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(getTheme()));
    obs.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme','class'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setTheme(getTheme());
    mq.addEventListener('change', handler);
    return () => { obs.disconnect(); mq.removeEventListener('change', handler); };
  }, []);
  return theme;
}

// Theme tokens — grey / black / white system (dark mode = true black-grey).
function useThemeTokens() {
  const theme  = useTheme();
  const isDark = theme === 'dark';
  return {
    isDark,
    pageBg:        isDark ? '#070b14' : '#f5f5f5',
    cardBg:        isDark ? '#0d1422' : '#ffffff',
    cardBorder:    isDark ? 'rgba(96,165,250,0.16)' : 'rgba(17,24,39,0.12)',
    inputBg:       isDark ? '#121c30'        : '#f0f0f0',
    inputBorder:   isDark ? 'rgba(96,165,250,0.20)' : 'rgba(17,24,39,0.18)',
    inputFocus:    isDark ? 'rgba(96,165,250,0.45)' : 'rgba(17,24,39,0.45)',
    textPrimary:   isDark ? '#e8eefd'  : '#111827',
    textSecondary: isDark ? '#a8bcdc'  : '#475569',
    textMuted:     isDark ? '#7ba0c4'  : '#8a8f98',
    divider:       isDark ? 'rgba(96,165,250,0.12)' : 'rgba(17,24,39,0.08)',
    overlay:       isDark ? 'rgba(96,165,250,0.06)' : 'rgba(17,24,39,0.04)',
    skeletonBg:    isDark ? '#1a2740' : '#ececec',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildMatchLabel(s: Record<string, unknown>): string {
  if (!s) return 'Unknown match';
  if (s.matchLabel)  return String(s.matchLabel);
  if (s.match_label) return String(s.match_label);
  if (s.match)       return String(s.match);
  const home = (s.homeTeam ?? s.home_team) as string | undefined;
  const away = (s.awayTeam ?? s.away_team) as string | undefined;
  if (home && away)  return `${home} v ${away}`;
  const id = (s.matchId ?? s.match_id ?? '') as string;
  return id ? `Match …${id.slice(-6)}` : 'Unknown match';
}

function extractOdds(sel: Record<string, unknown>): number {
  const candidates: Array<[string, unknown]> = [
    ['currentOdds',sel.currentOdds], ['oddsLocked',sel.oddsLocked],
    ['odds',sel.odds], ['value',sel.value], ['odd',sel.odd],
    ['price',sel.price], ['oddsValue',sel.oddsValue], ['rate',sel.rate],
  ];
  for (const [key, raw] of candidates) {
    const n = Number(raw);
    if (!isNaN(n) && n > 1) { log('extractOdds', `✅ "${key}" =`, n); return n; }
  }
  return 1;
}

function normaliseBet(bet: Bet): Bet {
  if (!bet) return bet;
  return {
    ...bet,
    placedAt:        bet.placedAt        ?? (bet as never as Record<string,string>).placed_at,
    settledAt:       bet.settledAt       ?? (bet as never as Record<string,string>).settled_at,
    totalOdds:       bet.totalOdds       ?? (bet as never as Record<string,number>).total_odds,
    potentialReturn: bet.potentialReturn ?? (bet as never as Record<string,number>).potential_return,
    selections: (bet.selections ?? []).map(s => ({
      ...s,
      oddsLocked: s.oddsLocked ?? (s as never as Record<string,number>).odds_locked ?? (s as never as Record<string,number>).odds ?? 1,
      homeTeam:   s.homeTeam   ?? (s as never as Record<string,string>).home_team,
      awayTeam:   s.awayTeam   ?? (s as never as Record<string,string>).away_team,
    })),
  };
}

// ---------------------------------------------------------------------------
// Brand mark — small grey/blue sky (sun + cloud) mark + "SKY"/"BET" wordmark
// with a "PSL" badge. Fully monochrome now.
// ---------------------------------------------------------------------------
function BrandMark({ size = 22, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:7, userSelect:'none' }}>
      <svg width={size} height={size} viewBox="0 0 44 40" fill="none" aria-hidden="true" style={{ flexShrink:0 }}>
        <circle cx="17" cy="11" r="6" fill="#ffffff" stroke={RECEIPT_INK} strokeWidth="1.5" />
        <path d="M6 30 C3 30 1 27.8 1 25.2 C1 22.6 3 20.5 5.6 20.4 C6.3 17.3 9.2 15 12.6 15 C16.3 15 19.4 17.6 19.9 21 C23.3 21.2 26 24 26 27.4 C26 30.5 23.6 30 21 30 Z" fill="#9ca3af" stroke={RECEIPT_INK} strokeWidth="1.3" strokeLinejoin="round" transform="translate(8,4)" />
        <rect x="4" y="30" width="36" height="5" rx="0" fill={RECEIPT_INK} stroke={BRAND_ACCENT} strokeWidth="1" />
      </svg>
      {wordmark && (
        <span style={{ display:'inline-flex', alignItems:'baseline', gap:4, fontFamily:"'Arial Black', Arial, sans-serif", fontWeight:900, fontStyle:'italic', fontSize:Math.round(size*0.56), letterSpacing:'0.01em', lineHeight:1 }}>
          <span><span style={{ color:'currentColor' }}>SKY</span><span style={{ color:BRAND_ACCENT_LIGHT }}>BET</span></span>
          <span style={{ fontStyle:'normal', fontWeight:900, fontSize:Math.round(size*0.30), color:BRAND_GREY, border:`1px solid ${BRAND_GREY_LIGHT}`, borderRadius:0, padding:'1px 4px', letterSpacing:'0.05em' }}>PSL</span>
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Signature structural motif — a row of small rotated "hex-facet" diamonds.
// Used as a ticket perforation between sections instead of a plain line.
// ---------------------------------------------------------------------------
function TicketDivider({ dense = false }: { dense?: boolean }) {
  const count = dense ? 5 : 9;
  return (
    <div aria-hidden="true" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:dense ? 5 : 7, padding: dense ? '8px 0' : '12px 0' }}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{
          width:5, height:5, flexShrink:0, borderRadius:1,
          transform:'rotate(45deg)',
          background: i === Math.floor(count/2) ? BRAND_ACCENT : 'rgba(100,116,139,0.30)',
        }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trophy — SIGNIFICANTLY larger everywhere, plus an orbiting sparkle layer
// that renders behind/around the artwork on the win screens.
// ---------------------------------------------------------------------------
function TrophyImage({ size = 380, sparkle = false }: { size?: number; sparkle?: boolean }) {
  const sparkles = sparkle
    ? Array.from({ length: 14 }, (_, i) => ({
        id: i,
        angle: (i * 360) / 14,
        dist: 38 + (i % 4) * 12,
        delay: (i % 7) * 0.22,
        dur: 1.6 + (i % 5) * 0.35,
        s: 6 + (i % 3) * 5,
      }))
    : [];
  return (
    <>
      <style>{`
        @keyframes pbTrophyReveal {
          0%   { transform: scale(0.05) rotate(-8deg); opacity: 0; filter: blur(12px); }
          35%  { opacity: 1; filter: blur(0); }
          65%  { transform: scale(1.08) rotate(1.5deg); }
          80%  { transform: scale(0.96) rotate(-0.8deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes pbTrophyFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-14px); }
        }
        @keyframes pbSparklePop {
          0%   { transform: translate(0,0) scale(0); opacity: 0; }
          35%  { opacity: 1; }
          100% { transform: translate(var(--sx), var(--sy)) scale(1); opacity: 0; }
        }
        @keyframes pbSparkleSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .pb-trophy-img {
          animation: pbTrophyReveal 0.85s cubic-bezier(0.16,1,0.3,1) both, pbTrophyFloat 3.5s ease-in-out 0.88s infinite;
          display: block;
          max-width: 88vw;
          filter: drop-shadow(0 0 40px rgba(255,255,255,0.30)) drop-shadow(0 0 80px rgba(148,163,184,0.28)) drop-shadow(0 20px 44px rgba(0,0,0,0.45));
        }
        .pb-sparkle-layer { position:absolute; inset:0; pointer-events:none; }
        .pb-sparkle {
          position:absolute; top:50%; left:50%; color:#ffffff;
          animation: pbSparklePop var(--dur) ease-in var(--delay) infinite;
          filter: drop-shadow(0 0 4px rgba(255,255,255,0.9));
        }
        @media (prefers-reduced-motion: reduce) { .pb-trophy-img, .pb-sparkle { animation: none !important; opacity: 1 !important; } }
      `}</style>
      <div style={{ position:'relative', width:size, height:size, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {sparkle && (
          <div className="pb-sparkle-layer" aria-hidden="true">
            {sparkles.map(sp => {
              const rad = (sp.angle * Math.PI) / 180;
              const sx = Math.cos(rad) * (size * 0.5 + sp.dist);
              const sy = Math.sin(rad) * (size * 0.5 + sp.dist);
              return (
                <svg key={sp.id} className="pb-sparkle" width={sp.s} height={sp.s} viewBox="0 0 24 24" fill="currentColor"
                  style={{ ['--sx' as string]: `${sx}px`, ['--sy' as string]: `${sy}px`, ['--delay' as string]: `${sp.delay}s`, ['--dur' as string]: `${sp.dur}s`, marginLeft:-sp.s/2, marginTop:-sp.s/2 }}>
                  <path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z" />
                </svg>
              );
            })}
          </div>
        )}
        <img src={trophyImg} alt="" aria-hidden="true" className="pb-trophy-img"
          style={{ width:size, height:size, objectFit:'contain', userSelect:'none', pointerEvents:'none', display:'block', position:'relative', zIndex:1 }} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Share slip image generator — grey/black/white ticket, trophy rendered
// larger than before.
// ---------------------------------------------------------------------------
const RECEIPT_TROPHY_SIZE = 130; // px

async function generateSlipImage(bet: Bet, isWin: boolean, currency: CurrencyInfo): Promise<string> {
  const localReturn = bet.potentialReturn * currency.rateToGHS;
  const localStake  = bet.stake * currency.rateToGHS;
  // One branch now: the amount is already in the player's currency, so there
  // is no base-vs-local distinction to switch on.
  const fmt = (n: number) =>
    `${currency.symbol}${n.toFixed(currency.code === 'JPY' || currency.code === 'UGX' ? 0 : 2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:400px;background:#ffffff;overflow:hidden;font-family:"Inter",sans-serif;';
  const bonusGhs = bet.potentialReturn - (bet.stake * bet.totalOdds);
  const hasBonus = isWin && bonusGhs > 0.5;

  const brandSvg = `
    <svg width="20" height="18" viewBox="0 0 44 40" fill="none" style="display:block;">
      <path d="M4 30 L4 15 L12 22 L17 9 L22 20 L27 9 L32 22 L40 15 L40 30 Z" fill="#9ca3af" stroke="#111827" stroke-width="1.5" stroke-linejoin="round" />
      <rect x="4" y="30" width="36" height="5" fill="#111827" stroke="#374151" stroke-width="1" />
    </svg>`;

  // Trophy badge — large, front-and-center on wins.
  const trophyBlock = isWin
    ? `<img src="${trophyImg}" alt="" style="width:${RECEIPT_TROPHY_SIZE}px;height:${RECEIPT_TROPHY_SIZE}px;object-fit:contain;display:block;margin:0 auto 8px;filter:drop-shadow(0 6px 14px rgba(17,24,39,0.35));" />`
    : '';

  container.innerHTML = `
    <style>*{box-sizing:border-box;margin:0;padding:0;}</style>
    <div>
      <div style="background:#ffffff;padding:12px 20px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e5e7eb;">
        <span style="display:flex;align-items:center;gap:6px;">
          ${brandSvg}
          <span style="font-size:12px;font-weight:900;font-style:italic;letter-spacing:1px;"><span style="color:#111827;">SKY</span><span style="color:#6b7280;">BET</span> <span style="color:#9ca3af;font-size:9px;">PSL</span></span>
        </span>
        <span style="font-size:10px;color:#9ca3af;">Official Ticket $</span>
      </div>
      <div style="background:#f5f5f5;padding:20px 20px 18px;text-align:center;">
        ${trophyBlock}
        <div style="font-size:13px;font-weight:700;color:#111827;letter-spacing:4px;text-transform:uppercase;margin-bottom:8px;">${isWin ? '🏆 YOU WON!' : '😞 BETTER LUCK'}</div>
        <div style="font-size:36px;font-weight:900;color:#111827;">${fmt(localReturn)}</div>
        $
      </div>
      <div style="background:#f0f0f0;margin:0 16px 12px;overflow:hidden;border:1px solid #e5e7eb;">
        ${bet.selections.map((sel, i) => `
          <div style="display:grid;grid-template-columns:20px 1fr 50px 60px;gap:0;padding:10px 12px;border-top:${i > 0 ? '1px solid #e5e7eb' : 'none'};">
            <span style="font-size:11px;font-weight:800;color:#374151;">${i + 1}</span>
            <div>
              <div style="font-size:11px;font-weight:700;color:#111827;">${sel.selection}</div>
              <div style="font-size:9px;color:#16a34a;">${sel.market}</div>
            </div>
            <span style="font-size:11px;font-weight:800;color:#111827;">${sel.oddsLocked.toFixed(2)}</span>
            <span style="font-size:10px;font-weight:800;color:${sel.result === 'WON' ? '#16a34a' : sel.result === 'LOST' ? '#ef4444' : '#6b7280'};">${sel.result === 'WON' ? '✓ WON' : sel.result === 'LOST' ? '✗ LOST' : '⏳'}</span>
          </div>
        `).join('')}
      </div>
      <div style="padding:12px 20px 8px;">
        ${[
          ['TOTAL ODDS', bet.totalOdds.toFixed(2) + 'x', '#111827'],
          ['STAKE', fmt(localStake), '#111827'],
          ...(hasBonus ? [['BONUS', fmt(bonusGhs * currency.rateToGHS), '#111827']] : []),
        ].map(([l, v, c]) => `<div style="display:flex;justify-content:space-between;margin-bottom:7px;"><span style="font-size:11px;color:#9ca3af;">${l}</span><span style="font-size:11px;font-weight:800;color:${c};">${v}</span></div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid #e5e7eb;margin-top:4px;">
          <span style="font-size:12px;font-weight:800;color:#475569;">TOTAL WINNINGS</span>
          <span style="font-size:18px;font-weight:900;color:#111827;">${fmt(localReturn)}</span>
        </div>
      </div>
      <div style="background:#f0f0f0;padding:10px 20px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e5e7eb;">
        <span style="font-size:9px;color:#9ca3af;">${new Date(bet.placedAt).toLocaleString('en-GH')}</span>
        <span style="font-size:11px;font-weight:900;font-style:italic;letter-spacing:1px;"><span style="color:#111827;">SKY</span><span style="color:#6b7280;">BET</span></span>
      </div>
    </div>
  `;
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, { scale:2, useCORS:true, backgroundColor:null, logging:false });
    return canvas.toDataURL('image/png');
  } finally { document.body.removeChild(container); }
}

// ---------------------------------------------------------------------------
// Share image modal — fully responsive width, grey/black/white, sharp
// buttons (no rounded corners).
// ---------------------------------------------------------------------------
function ShareImageModal({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl; a.download = `skybet-ticket-${Date.now()}.png`; a.click();
  };
  const handleShare = async () => {
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], 'skybet-ticket.png', { type:'image/png' });
      if (navigator.share && navigator.canShare?.({ files:[file] })) { await navigator.share({ files:[file], title:`My ${BRAND_NAME} Ticket` }); }
      else handleDownload();
    } catch { handleDownload(); }
  };
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4" onClick={onClose}>
      <div className="shadow-2xl w-full overflow-hidden" style={{ maxWidth:'min(94vw, 480px)', maxHeight:'92vh', display:'flex', flexDirection:'column', background:'#ffffff', border:'1px solid rgba(17,24,39,0.14)', borderRadius:0 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 sm:px-5 py-4" style={{ borderBottom:'1px solid rgba(17,24,39,0.10)', flexShrink:0 }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}>
            <ConfirmationNumberIcon sx={{ fontSize:17, color:BRAND_PRIMARY }} />
            <h3 className="font-black text-base" style={{ color:'#111827' }}>Your Ticket</h3>
          </span>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(17,24,39,0.08)', border:'none', cursor:'pointer', color:'#6b7280' }}>
            <CloseIcon fontSize="small" />
          </button>
        </div>
        <div style={{ padding:16, overflowY:'auto', flex:1 }}><img src={imageUrl} alt="Bet ticket" className="w-full shadow-xl" style={{ display:'block' }} /></div>
        <div style={{ padding:'0 16px 20px', display:'flex', gap:10, flexShrink:0 }}>
          <button onClick={handleDownload} style={{ flex:1, padding:'13px 0', borderRadius:0, fontSize:13, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'rgba(17,24,39,0.06)', color:'#374151', border:'1px solid rgba(17,24,39,0.16)', cursor:'pointer' }}>
            <DownloadIcon fontSize="small" /> Save
          </button>
          <button onClick={handleShare} style={{ flex:1, padding:'13px 0', borderRadius:0, color:'#fff', fontSize:13, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:BRAND_PRIMARY, border:'none', cursor:'pointer' }}>
            <ShareIcon fontSize="small" /> Share
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confetti — grey/black/white only
// ---------------------------------------------------------------------------
function CelebrationParticles() {
  const [particles] = useState(() =>
    Array.from({ length: 80 }, (_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 3,
      duration: 2.5 + Math.random() * 2.5, size: 4 + Math.random() * 9,
      color: ['#111827','#374151','#6b7280','#9ca3af','#ffffff','#e5e7eb','#d1d5db'][Math.floor(Math.random() * 7)],
      isCircle: Math.random() > 0.4, rotate: Math.random() * 360,
    }))
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <div key={p.id} style={{
          position:'absolute', left:`${p.left}%`, top:'-20px',
          width:`${p.size}px`, height:`${p.size * (p.isCircle ? 1 : 1.6)}px`,
          background:p.color, borderRadius:p.isCircle ? '50%' : '1px', opacity:0,
          transform:`rotate(${p.rotate}deg)`,
          animation:`confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Win Modal — grey/black/white, MUCH bigger sparkling trophy leading the
// celebration, fully responsive via clamp() from small phones to desktop.
// ---------------------------------------------------------------------------
function WinModal({ bet, onClose, currency, onDetails }: {
  bet: Bet; currency: CurrencyInfo; onClose: () => void; onDetails?: () => void;
}) {
  const [generatingImage, setGeneratingImage] = useState(false);
  const [shareImageUrl, setShareImageUrl]     = useState<string | null>(null);
  const verifyCode = bet.id.slice(-16).toUpperCase();

  const fmtLocal = (ghs: number) => {
    const v = ghs * currency.rateToGHS;
    try { return new Intl.NumberFormat(currency.locale, { style:'currency', currency:currency.code, minimumFractionDigits:2, maximumFractionDigits:2 }).format(v); }
    catch { return `${currency.symbol}${v.toFixed(2)}`; }
  };

  const handleShowOff = async () => {
    setGeneratingImage(true);
    try { setShareImageUrl(await generateSlipImage(bet, true, currency)); }
    catch (e) { logError('WinModal', e); }
    finally { setGeneratingImage(false); }
  };

  return (
    <>
      <style>{`
        @keyframes confettiFall { 0% { transform:translateY(-20px) rotate(0deg); opacity:1; } 85% { opacity:1; } 100% { transform:translateY(110vh) rotate(900deg); opacity:0; } }
        @keyframes winFadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes winChip     { from { opacity:0; transform:translateY(-14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes winTrophyIn { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }
        @keyframes winHeadline { from { opacity:0; transform:translateY(-16px) scale(0.9); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes winAmount   { from { opacity:0; transform:scale(0.7); } to { opacity:1; transform:scale(1); } }
        @keyframes winCode     { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes winBtns     { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmerMono { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
        @keyframes rayRotate   { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        .pb-win-overlay  { animation: winFadeIn   0.28s ease both; }
        .pb-win-chip     { animation: winChip     0.4s  cubic-bezier(0.16,1,0.3,1) 0.02s both; }
        .pb-win-trophy   { animation: winTrophyIn 0.5s  cubic-bezier(0.16,1,0.3,1) 0.10s both; }
        .pb-win-headline { animation: winHeadline 0.55s cubic-bezier(0.16,1,0.3,1) 0.30s both; }
        .pb-win-amount   { animation: winAmount   0.55s cubic-bezier(0.16,1,0.3,1) 0.40s both; }
        .pb-win-code     { animation: winCode     0.45s ease 0.55s both; }
        .pb-win-btns     { animation: winBtns     0.45s ease 0.65s both; }
        .pb-shimmer-headline { background:linear-gradient(90deg,#ffffff 0%,#9ca3af 35%,#ffffff 55%,#6b7280 100%); background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:shimmerMono 2.2s linear infinite; }
        .pb-rays-spin { animation: rayRotate 20s linear infinite; }
        .pb-win-inner { width:100%; max-width: clamp(300px, 94vw, 560px); padding-left: 12px; padding-right: 12px; box-sizing: border-box; }
        .pb-win-headline-text { font-size: clamp(28px, 9vw, 52px); }
        .pb-win-amount-text { font-size: clamp(22px, 7vw, 40px); }
        @media (prefers-reduced-motion: reduce) { .pb-win-overlay,.pb-win-chip,.pb-win-trophy,.pb-win-headline,.pb-win-amount,.pb-win-code,.pb-win-btns { animation:none !important; opacity:1 !important; } .pb-rays-spin { animation:none !important; } }
      `}</style>
      <div
        className="pb-win-overlay"
        onClick={onClose}
        style={{
          position:'fixed',
          inset:0,
          zIndex:200,
          background:'rgba(0,0,0,0.95)',
          backdropFilter:'blur(2px)',
          WebkitBackdropFilter:'blur(2px)',
          display:'flex',
          flexDirection:'column',
          alignItems:'center',
          justifyContent:'space-between',
          overflow:'hidden',
          // FIX: was `max(28px, env(safe-area-inset-bottom))`, which only
          // cleared the phone's home-indicator safe area and left the
          // fixed bottom nav bar overlapping the Details/Show Off buttons
          // and verify code. Now reserves the same clearance used by
          // WinDetailsSheet, plus the safe-area inset on top of it.
          paddingBottom:`max(${BOTTOM_NAV_CLEARANCE}px, calc(${BOTTOM_NAV_CLEARANCE}px + env(safe-area-inset-bottom)))`,
        }}
      >
        <CelebrationParticles />
        <button onClick={e => { e.stopPropagation(); onClose(); }} aria-label="Close" style={{ position:'absolute', top:16, right:16, zIndex:20, width:40, height:40, borderRadius:0, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.20)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <CloseIcon sx={{ fontSize:20 }} />
        </button>

        <div className="pb-win-inner" onClick={e => e.stopPropagation()} style={{ position:'relative', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between', flex:1, paddingTop:16 }}>
          <div aria-hidden="true" style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'min(90vw, 460px)', height:'min(90vw, 460px)', opacity:0.08, pointerEvents:'none', zIndex:0 }}>
            <div className="pb-rays-spin" style={{ width:'100%', height:'100%' }}>
              <svg viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
                {Array.from({ length:24 }, (_, i) => { const a=(i*360)/24, r=(a*Math.PI)/180; return <line key={i} x1={180+72*Math.cos(r)} y1={180+72*Math.sin(r)} x2={180+180*Math.cos(r)} y2={180+180*Math.sin(r)} stroke="#9ca3af" strokeWidth="2" />; })}
              </svg>
            </div>
          </div>

          {/* Ticket chip — brand + verify code */}
          <div className="pb-win-chip" style={{ position:'relative', zIndex:1, display:'inline-flex', alignItems:'center', gap:10, padding:'8px 16px', borderRadius:0, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.30)', flexShrink:0, color:'#fff' }}>
            <BrandMark size={16} />
            <span style={{ width:1, height:12, background:'rgba(255,255,255,0.2)' }} />
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.6)', fontFamily:'monospace', letterSpacing:'0.08em' }}>{verifyCode.slice(0,8)}…</span>
          </div>

          {/* Trophy — size unchanged at 420, only surrounding spacing reduced */}
          <div style={{ position:'relative', zIndex:1, flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'center', width:'100%' }}>
            <div className="pb-win-trophy" style={{ position:'relative', width:'min(72vw, 440px)', height:'min(72vw, 440px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div aria-hidden="true" style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'min(88vw, 480px)', height:'min(88vw, 480px)', borderRadius:'50%', background:'radial-gradient(circle, rgba(255,255,255,0.20) 0%, rgba(148,163,184,0.10) 50%, transparent 70%)', pointerEvents:'none' }} />
              <TrophyImage size={420} sparkle />
            </div>
          </div>

          {/* Headline + amount */}
          <div className="pb-win-headline" style={{ position:'relative', zIndex:1, width:'100%', textAlign:'center', flexShrink:0 }}>
            <p style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, letterSpacing:'0.04em', color:'rgba(255,255,255,0.55)' }}>You won more than <span style={{ color:'#ffffff', fontWeight:900 }}>99%</span> of all players</p>
            <h1 className="pb-shimmer-headline pb-win-headline-text" style={{ margin:0, fontWeight:900, letterSpacing:'0.03em', lineHeight:1 }}>YOU WON</h1>
          </div>

          <div className="pb-win-amount" style={{ position:'relative', zIndex:1, textAlign:'center', flexShrink:0, marginTop:2 }}>
            <div className="pb-win-amount-text" style={{ fontWeight:900, color:'#FFFFFF', letterSpacing:'0.5px', textShadow:'0 2px 16px rgba(0,0,0,0.4)', overflowWrap:'break-word' }}>{fmtLocal(bet.potentialReturn)}</div>
          </div>

          <div className="pb-win-code" style={{ position:'relative', zIndex:1, width:'100%', paddingLeft:8, paddingRight:8, paddingTop:10, flexShrink:0 }}>
            <div style={{ textAlign:'center', marginBottom:10, fontSize:13, color:'rgba(255,255,255,0.48)', letterSpacing:'0.04em', lineHeight:1.5 }}>
              Verify Code:{' '}
              <span style={{ color:'#ffffff', fontWeight:700, fontFamily:'monospace', letterSpacing:'0.10em' }}>{verifyCode}</span>
              <button onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(verifyCode); }} aria-label="Copy verify code" style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.42)', marginLeft:6, verticalAlign:'middle', display:'inline-flex', alignItems:'center', padding:0 }}>
                <ContentCopyIcon sx={{ fontSize:13 }} />
              </button>
            </div>
            <div className="pb-win-btns" style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <button onClick={e => { e.stopPropagation(); (onDetails ?? onClose)(); }} style={{ flex:'1 1 120px', padding:'16px 0', borderRadius:0, background:'rgba(255,255,255,0.08)', border:'1.5px solid rgba(255,255,255,0.45)', color:'#FFFFFF', fontSize:15, fontWeight:700, cursor:'pointer', touchAction:'manipulation' }}>Details</button>
              <button onClick={e => { e.stopPropagation(); handleShowOff(); }} disabled={generatingImage} style={{ flex:'1 1 120px', padding:'16px 0', borderRadius:0, background: generatingImage ? 'rgba(255,255,255,0.25)' : '#ffffff', border:'none', color: generatingImage ? '#fff' : '#111827', fontSize:15, fontWeight:800, cursor: generatingImage ? 'not-allowed' : 'pointer', touchAction:'manipulation', display:'flex', alignItems:'center', justifyContent:'center', gap:6, boxShadow: generatingImage ? 'none' : '0 4px 24px rgba(0,0,0,0.45)' }}>
                {generatingImage ? 'Generating…' : <><ShareIcon fontSize="small" /> Show Off</>}
              </button>
            </div>
          </div>
        </div>
      </div>
      {shareImageUrl && <ShareImageModal imageUrl={shareImageUrl} onClose={() => setShareImageUrl(null)} />}
    </>
  );
}
// ---------------------------------------------------------------------------
// Win Details Sheet — "Ticket Details" screen. Now anchored to the TOP of
// the viewport and animates DOWN into place (instead of rising from the
// bottom), with a reserved bottom margin so its action buttons never sit
// underneath a fixed bottom nav bar. Fully responsive width, larger trophy
// badge, sharp buttons, green reserved only for the match-detail "Pick"
// lines. Amount/label rows now wrap and right-align instead of overlapping
// when localized currency values run long.
// ---------------------------------------------------------------------------
function WinDetailsSheet({ bet, currency, onClose }: { bet: Bet; currency: CurrencyInfo; onClose: () => void }) {
  const [generatingImage, setGeneratingImage] = useState(false);
  const [shareImageUrl, setShareImageUrl]     = useState<string | null>(null);
  const [activeSection, setActiveSection]     = useState<'ticket' | 'journey' | 'payout' | 'verify'>('ticket');
  const [copied, setCopied]                   = useState(false);
  const verifyCode = bet.id.slice(-16).toUpperCase();
  const ticketId   = `CB${bet.id.slice(-8).toUpperCase()}`;
  const bonusGhs   = bet.potentialReturn - (bet.stake * bet.totalOdds);
  const hasBonus   = bonusGhs > 0.5;
  const profit     = bet.potentialReturn - bet.stake;
  const wonSels    = bet.selections.filter(s => s.result === 'WON').length;
  const successRate = bet.selections.length > 0 ? Math.round((wonSels / bet.selections.length) * 100) : 0;
  const betTypeLabel = bet.selections.length > 1 ? `Multiple (${bet.selections.length})` : 'Singles';

  const fmtLocal = (ghs: number) => {
    const v = ghs * currency.rateToGHS;
    try { return new Intl.NumberFormat(currency.locale, { style:'currency', currency:currency.code, minimumFractionDigits:2, maximumFractionDigits:2 }).format(v); }
    catch { return `${currency.symbol}${v.toFixed(2)}`; }
  };

  const placedDate  = bet.placedAt  ? new Date(bet.placedAt).toLocaleString('en-GH', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).replace(',','') : '';
  const settledDate = bet.settledAt ? new Date(bet.settledAt).toLocaleString('en-GH', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).replace(',','') : '';

  const handleShowOff = async () => {
    setGeneratingImage(true);
    try { setShareImageUrl(await generateSlipImage(bet, true, currency)); }
    catch (e) { logError('WinDetailsSheet', e); }
    finally { setGeneratingImage(false); }
  };
  const handleCopy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  const TABS = [
    { key:'ticket'  as const, label:'Ticket'  },
    { key:'journey' as const, label:'Journey' },
    { key:'payout'  as const, label:'Payout'  },
    { key:'verify'  as const, label:'Verify'  },
  ];

  return (
    <>
      <style>{`
        @keyframes detailsUp { from { opacity:0; transform:translateY(-32px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmerMono2 { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
        .details-enter { animation: detailsUp 0.38s cubic-bezier(0.16,1,0.3,1) both; }
        .shimmer-mono2 { background:linear-gradient(90deg,#111827 0%,#374151 35%,#111827 55%,#6b7280 100%); background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:shimmerMono2 2.5s linear infinite; }
        .win-section-enter { animation: detailsUp 0.3s ease both; }
        .cb-sheet-shell { width:100%; max-width: min(96vw, 640px); box-sizing: border-box; }
        @media (min-width: 1024px) { .cb-sheet-shell { max-width: 720px; } }
      `}</style>
      <div
        className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto"
        style={{ background:'rgba(0,0,0,0.72)', backdropFilter:'blur(4px)', paddingTop:'max(20px, env(safe-area-inset-top))' }}
        onClick={onClose}
      >
        <div
          className="details-enter cb-sheet-shell relative z-20 overflow-hidden flex flex-col"
          style={{
            maxHeight: `calc(100dvh - ${BOTTOM_NAV_CLEARANCE}px - 20px)`,
            marginBottom: BOTTOM_NAV_CLEARANCE,
            background:'#ffffff',
            border:'1px solid rgba(17,24,39,0.14)',
            borderRadius:0,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ width:36, height:4, background:'rgba(17,24,39,0.30)', margin:'12px auto 0', flexShrink:0 }} />

          {/* Header — back arrow · "Ticket Details" · brand · close */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 flex-shrink-0" style={{ borderBottom:'1px solid rgba(17,24,39,0.10)' }}>
            <div className="flex items-center gap-3">
              <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', display:'flex', padding:0 }}><ArrowBackIcon sx={{ fontSize:20 }} /></button>
              <div>
                <p style={{ fontSize:14, fontWeight:900, color:'#111827', lineHeight:1.1 }}>Ticket Details</p>
                <span style={{ color:'#111827' }}><BrandMark size={13} /></span>
              </div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(17,24,39,0.08)', border:'1px solid rgba(17,24,39,0.14)', borderRadius:0, padding:'4px 8px', cursor:'pointer', color:'#6b7280', display:'flex' }}><CloseIcon sx={{ fontSize:17 }} /></button>
          </div>

          {/* "Multiple (N)" · WON — Total Stake / Total Odds / Total Return
              TRUE VERTICAL STACK: label sits ABOVE its value in each row,
              rows stacked one under another (Stake, then Odds, then Return
              last at the bottom, largest and boldest). */}
          <div style={{ padding:'16px 16px 4px', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:6 }}>
              <span style={{ fontSize:16, fontWeight:900, color:'#111827' }}>{betTypeLabel}</span>
              <span style={{ fontSize:14, fontWeight:900, color:'#111827' }}>🏆 WON</span>
            </div>
            {[
              { label:'Total Stake',  value:fmtLocal(bet.stake), big:false },
              { label:'Total Odds',   value:`${bet.totalOdds.toFixed(2)}×`, big:false },
              { label:'Total Return', value:fmtLocal(bet.potentialReturn), big:true },
            ].map(({ label, value, big }, idx, arr) => (
              <div key={label} style={{ display:'flex', flexDirection:'column', padding:'10px 0', borderBottom: idx < arr.length - 1 ? '1px solid rgba(17,24,39,0.08)' : 'none' }}>
                <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#6b7280', marginBottom:4 }}>{label}</span>
                <span style={{ fontSize:big ? 26 : 17, fontWeight:900, color:'#111827', overflowWrap:'break-word' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Trophy badge — large, sits right in the celebration banner */}
          <div style={{ display:'flex', justifyContent:'center', padding:'4px 16px 8px', flexShrink:0 }}>
            <img src={trophyImg} alt="" style={{ width:130, height:130, objectFit:'contain', filter:'drop-shadow(0 8px 18px rgba(17,24,39,0.28))' }} />
          </div>

          {/* Show Off button — monochrome */}
          <div style={{ padding:'4px 16px 4px', flexShrink:0 }}>
            <button onClick={handleShowOff} disabled={generatingImage} style={{ width:'100%', padding:'16px 0', borderRadius:0, border:'none', fontSize:15, fontWeight:900, cursor: generatingImage ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, color:'#fff', background: generatingImage ? 'rgba(17,24,39,0.5)' : BRAND_PRIMARY, boxShadow: generatingImage ? 'none' : '0 4px 22px rgba(17,24,39,0.30)' }}>
              {generatingImage ? 'Generating…' : <>🎉 Show Off</>}
            </button>
          </div>

          {/* Verify code box */}
          <div style={{ padding:'12px 16px 0', flexShrink:0 }}>
            <div style={{ padding:'12px 16px', textAlign:'center', background:'rgba(17,24,39,0.05)', border:'1px solid rgba(17,24,39,0.12)', wordBreak:'break-all' }}>
              <span style={{ fontSize:12, color:'#6b7280' }}>Verify Code: </span>
              <span style={{ fontSize:13, fontWeight:800, color:'#111827', fontFamily:'monospace', letterSpacing:'0.08em' }}>{verifyCode}</span>
              <button onClick={() => handleCopy(verifyCode)} style={{ background:'none', border:'none', cursor:'pointer', color: copied ? '#111827' : '#9ca3af', marginLeft:6, verticalAlign:'middle', display:'inline-flex', padding:0 }}>
                {copied ? <CheckCircleIcon sx={{ fontSize:14 }} /> : <ContentCopyIcon sx={{ fontSize:14 }} />}
              </button>
            </div>
          </div>

          <TicketDivider />

          {/* Tabs */}
          <div className="px-3 sm:px-4 mb-3 flex-shrink-0">
            <div style={{ display:'flex', gap:4, padding:4, background:'rgba(17,24,39,0.05)', border:'1px solid rgba(17,24,39,0.10)', overflowX:'auto' }}>
              {TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveSection(tab.key)} style={{ flex:'1 1 0', minWidth:64, padding:'8px 0', borderRadius:0, fontSize:11, fontWeight:800, border:'none', cursor:'pointer', background: activeSection === tab.key ? BRAND_PRIMARY : 'transparent', color: activeSection === tab.key ? '#fff' : '#6b7280', transition:'background 150ms, color 150ms' }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {activeSection === 'ticket' && (
              <div className="px-3 sm:px-4 pb-2 win-section-enter">
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:8, marginBottom:12 }}>
                  {[{ label:'Stake', value:fmtLocal(bet.stake), icon:'💸' }, { label:'Total Odds', value:`${bet.totalOdds.toFixed(2)}×`, icon:'📈' }, { label:'Profit', value:fmtLocal(profit), icon:'🎯' }].map(({ label, value, icon }) => (
                    <div key={label} style={{ padding:'12px 8px', textAlign:'center', background:'rgba(17,24,39,0.04)', border:'1px solid rgba(17,24,39,0.10)', minWidth:0 }}>
                      <span style={{ fontSize:16 }}>{icon}</span>
                      <p style={{ fontSize:10, color:'#6b7280', fontWeight:700, letterSpacing:'0.5px', marginTop:4 }}>{label}</p>
                      <p style={{ fontSize:12, fontWeight:900, color:'#111827', marginTop:2, overflowWrap:'break-word' }}>{value}</p>
                    </div>
                  ))}
                </div>
                {hasBonus && (
                  <div style={{ marginBottom:12, padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:4, background:'rgba(17,24,39,0.05)', border:'1px solid rgba(17,24,39,0.14)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:14 }}>🎁</span><span style={{ fontSize:11, color:'#111827', fontWeight:700 }}>Bonus Applied</span></div>
                    <span style={{ fontSize:13, fontWeight:900, color:'#111827' }}>+{fmtLocal(bonusGhs)}</span>
                  </div>
                )}
                <div style={{ overflow:'hidden', marginBottom:12, background:'rgba(17,24,39,0.03)', border:'1px solid rgba(17,24,39,0.10)' }}>
                  {[{ label:'Ticket ID', value:ticketId, mono:true, color:'#111827' }, { label:'Placed', value:placedDate, mono:false, color:'#475569' }, { label:'Bet Type', value: betTypeLabel.toUpperCase(), mono:false, color:'#111827' }, { label:'Selections', value:`${bet.selections.length} picks`, mono:false, color:'#475569' }].map(({ label, value, mono, color }, idx, arr) => (
                    <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', gap:8, flexWrap:'wrap', borderBottom: idx < arr.length-1 ? '1px solid rgba(17,24,39,0.08)' : 'none' }}>
                      <span style={{ fontSize:11, color:'#9ca3af', fontWeight:700, letterSpacing:'0.4px' }}>{label}</span>
                      <span style={{ fontSize:11, fontWeight:800, color, fontFamily:mono?'monospace':'inherit', letterSpacing:mono?'1px':'normal', wordBreak:'break-all', textAlign:'right' }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {bet.selections.map((sel, i) => {
                    const isWon  = sel.result === 'WON'; const isLost = sel.result === 'LOST';
                    const matchLabel = buildMatchLabel(sel as unknown as Record<string, unknown>);
                    return (
                      <div key={sel.id ?? i} style={{ padding:14, background: isWon ? 'rgba(17,24,39,0.04)' : isLost ? 'rgba(239,68,68,0.05)' : 'rgba(17,24,39,0.03)', border:`1px solid ${isWon ? 'rgba(17,24,39,0.14)' : isLost ? 'rgba(239,68,68,0.14)' : 'rgba(17,24,39,0.10)'}` }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                          <div style={{ width:26, height:26, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:12, fontWeight:900, background: isWon ? 'rgba(17,24,39,0.10)' : isLost ? 'rgba(239,68,68,0.10)' : 'rgba(17,24,39,0.08)', color: isWon ? '#111827' : isLost ? '#ef4444' : '#6b7280' }}>{isWon ? '✓' : isLost ? '✗' : i + 1}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:13, fontWeight:800, color:'#111827', marginBottom:2, overflowWrap:'break-word' }}>{matchLabel}</p>
                            <p style={{ fontSize:12, color:MATCH_GREEN, fontWeight:700, overflowWrap:'break-word' }}>Pick: <span>{sel.selection}</span> @ <span>{sel.oddsLocked.toFixed(2)}</span></p>
                            <p style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Market: {sel.market}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {activeSection === 'journey' && (
              <div className="px-3 sm:px-4 pb-2 win-section-enter">
                <p style={{ fontSize:11, color:'#6b7280', fontWeight:700, letterSpacing:'1px', marginBottom:16 }}>WINNING JOURNEY</p>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:16, top:0, bottom:0, width:1, background:'linear-gradient(180deg,rgba(17,24,39,0.4) 0%,rgba(17,24,39,0.10) 100%)' }} />
                  <div style={{ display:'flex', flexDirection:'column', gap:16, paddingLeft:44 }}>
                    {bet.selections.map((sel, i) => {
                      const isWon = sel.result === 'WON'; const isLost = sel.result === 'LOST';
                      const matchLabel = buildMatchLabel(sel as unknown as Record<string, unknown>);
                      return (
                        <div key={sel.id ?? i} style={{ position:'relative' }}>
                          <div style={{ position:'absolute', left:-44, top:4, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, background: isWon ? 'rgba(17,24,39,0.12)' : isLost ? 'rgba(239,68,68,0.10)' : 'rgba(17,24,39,0.08)', border:`2px solid ${isWon ? '#111827' : isLost ? '#ef4444' : 'rgba(17,24,39,0.30)'}`, color: isWon ? '#111827' : isLost ? '#ef4444' : '#6b7280' }}>{isWon ? '✓' : isLost ? '✗' : '⏳'}</div>
                          <div style={{ padding:12, background:'rgba(17,24,39,0.03)', border:`1px solid ${isWon ? 'rgba(17,24,39,0.14)' : isLost ? 'rgba(239,68,68,0.14)' : 'rgba(17,24,39,0.10)'}` }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:6 }}>
                              <div style={{ flex:1, minWidth:0, marginRight:8 }}>
                                <p style={{ fontSize:11, fontWeight:800, color:'#111827', overflowWrap:'break-word' }}>{sel.selection}</p>
                                <p style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>{matchLabel}</p>
                                <p style={{ fontSize:9, color:MATCH_GREEN, marginTop:1 }}>{sel.market}</p>
                              </div>
                              <div style={{ textAlign:'right', flexShrink:0 }}>
                                <span style={{ fontSize:12, fontWeight:900, color:'#111827' }}>{sel.oddsLocked.toFixed(2)}×</span>
                                <span style={{ display:'block', fontSize:11, fontWeight:700, marginTop:2, color: isWon ? '#111827' : isLost ? '#ef4444' : '#6b7280' }}>{isWon ? '✅ Won' : isLost ? '❌ Lost' : '⏳ Pending'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ position:'relative' }}>
                      <div style={{ position:'absolute', left:-44, top:4, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, background:'rgba(17,24,39,0.12)', border:'2px solid #111827' }}>🏆</div>
                      <div style={{ padding:12, background:'rgba(17,24,39,0.05)', border:'1px solid rgba(17,24,39,0.16)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6 }}>
                        <span style={{ fontSize:12, fontWeight:900, color:'#111827' }}>TICKET WON!</span>
                        <span style={{ fontSize:14, fontWeight:900, color:'#111827' }}>{fmtLocal(bet.potentialReturn)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop:16, padding:16, background:'rgba(17,24,39,0.03)', border:'1px solid rgba(17,24,39,0.10)' }}>
                  <p style={{ fontSize:10, color:'#6b7280', fontWeight:700, letterSpacing:'1px', marginBottom:12 }}>PERFORMANCE</p>
                  {[{ label:'Correct Selections', value:`${wonSels}/${bet.selections.length}`, pct:successRate, color:'#111827', gradient:'linear-gradient(90deg,#111827,#6b7280)' }, { label:'Success Score', value:`${successRate}%`, pct:successRate, color:'#111827', gradient:'linear-gradient(90deg,#374151,#9ca3af)' }].map(({ label, value, pct, color, gradient }) => (
                    <div key={label} style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}><span style={{ fontSize:11, color:'#475569' }}>{label}</span><span style={{ fontSize:11, fontWeight:800, color }}>{value}</span></div>
                      <div style={{ height:6, background:'rgba(17,24,39,0.12)' }}><div style={{ height:'100%', width:`${pct}%`, background:gradient, transition:'width 0.8s ease' }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeSection === 'payout' && (
              <div className="px-3 sm:px-4 pb-2 win-section-enter">
                <p style={{ fontSize:11, color:'#6b7280', fontWeight:700, letterSpacing:'1px', marginBottom:16 }}>PAYOUT BREAKDOWN</p>
                <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                  {[{ label:'Initial Stake', value:fmtLocal(bet.stake), icon:'💸', color:'#111827', bg:'rgba(17,24,39,0.03)', big:false }, { label:`Odds Applied (${bet.totalOdds.toFixed(2)}×)`, value:`= ${fmtLocal(bet.stake*bet.totalOdds)}`, icon:'📊', color:'#111827', bg:'rgba(17,24,39,0.05)', big:false }, ...(hasBonus ? [{ label:'Bonus Added', value:`+${fmtLocal(bonusGhs)}`, icon:'🎁', color:'#111827', bg:'rgba(17,24,39,0.04)', big:false }] : []), { label:'Final Payout', value:fmtLocal(bet.potentialReturn), icon:'🏆', color:'#111827', bg:'rgba(17,24,39,0.07)', big:true }].map((row, idx, arr) => (
                    <div key={row.label}>
                      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6, background:row.bg, border:'1px solid rgba(17,24,39,0.10)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}><span style={{ fontSize:18, flexShrink:0 }}>{row.icon}</span><span style={{ fontSize:12, color:'#475569', fontWeight:600, overflowWrap:'break-word' }}>{row.label}</span></div>
                        <span style={{ fontSize:row.big ? 16 : 13, fontWeight:900, color:row.color, minWidth:0, textAlign:'right', overflowWrap:'break-word' }}>{row.value}</span>
                      </div>
                      {idx < arr.length-1 && <div style={{ textAlign:'center', padding:'4px 0', fontSize:14, color:'#9ca3af' }}>↓</div>}
                    </div>
                  ))}
                </div>
                
              </div>
            )}
            {activeSection === 'verify' && (
              <div className="px-3 sm:px-4 pb-2 win-section-enter">
                <p style={{ fontSize:11, color:'#6b7280', fontWeight:700, letterSpacing:'1px', marginBottom:16 }}>TICKET AUTHENTICATION</p>
                <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 20px', background:'rgba(17,24,39,0.06)', border:'1px solid rgba(17,24,39,0.24)' }}>
                    <VerifiedIcon sx={{ fontSize:16, color:'#111827' }} />
                    <span style={{ fontSize:11, fontWeight:800, color:'#111827', letterSpacing:'1.5px' }}>AUTHENTIC TICKET</span>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                  {[{ label:'Ticket ID', value:ticketId, copyable:false }, { label:'Verification Code', value:verifyCode, copyable:true }, { label:'Timestamp', value:placedDate, copyable:false }, ...(bet.settledAt ? [{ label:'Settlement Time', value:settledDate, copyable:false }] : [])].map(({ label, value, copyable }) => (
                    <div key={label} style={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', background:'rgba(17,24,39,0.03)', border:'1px solid rgba(17,24,39,0.10)' }}>
                      <div style={{ minWidth:0 }}><p style={{ fontSize:9, color:'#9ca3af', fontWeight:700, letterSpacing:'0.8px', marginBottom:2 }}>{label}</p><p style={{ fontSize:12, fontWeight:800, color:'#111827', fontFamily:'monospace', letterSpacing:'1px', wordBreak:'break-all' }}>{value}</p></div>
                      {copyable && <button onClick={() => handleCopy(value)} style={{ width:32, height:32, borderRadius:0, display:'flex', alignItems:'center', justifyContent:'center', background: copied ? 'rgba(17,24,39,0.12)' : 'rgba(17,24,39,0.06)', color: copied ? '#111827' : '#6b7280', border:`1px solid ${copied ? 'rgba(17,24,39,0.3)' : 'rgba(17,24,39,0.14)'}`, cursor:'pointer', flexShrink:0 }}>{copied ? <CheckCircleIcon sx={{ fontSize:14 }} /> : <ContentCopyIcon sx={{ fontSize:14 }} />}</button>}
                    </div>
                  ))}
                </div>
                <div style={{ padding:16, background:'rgba(17,24,39,0.03)', border:'1px solid rgba(17,24,39,0.10)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}><WorkspacePremiumIcon sx={{ fontSize:22, color:'#111827' }} /><div><p style={{ fontSize:12, fontWeight:900, color:'#111827' }}>Security Seal</p><p style={{ fontSize:10, color:'#9ca3af' }}>Verified by SkyBet PSL</p></div></div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:12, borderTop:'1px solid rgba(17,24,39,0.10)', marginTop:4 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'#111827' }} />
                    <span style={{ fontSize:10, color:'#374151', fontWeight:600 }}>Winnings confirmed · PAID</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="px-3 sm:px-4 pt-3 pb-1 flex-shrink-0 flex gap-3 flex-wrap">
            <button onClick={handleShowOff} disabled={generatingImage} style={{ flex:'1 1 140px', padding:'15px 0', borderRadius:0, border:'none', fontSize:14, fontWeight:800, cursor: generatingImage ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, color:'#fff', background: generatingImage ? 'rgba(17,24,39,0.5)' : BRAND_PRIMARY, boxShadow: generatingImage ? 'none' : '0 4px 24px rgba(17,24,39,0.30)', opacity: generatingImage ? 0.65 : 1 }}>
              {generatingImage ? 'Generating…' : <><ShareIcon fontSize="small" /> Show Off</>}
            </button>
            <Link to="/wallet" onClick={onClose} style={{ flex:'1 1 140px', padding:'15px 0', borderRadius:0, background:'rgba(17,24,39,0.06)', color:'#374151', border:'1px solid rgba(17,24,39,0.14)', fontSize:14, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', gap:6, textDecoration:'none' }}>💰 Withdraw</Link>
          </div>
          <button onClick={onClose} style={{ width:'100%', paddingTop:6, paddingBottom:4, fontSize:12, fontWeight:500, color:'#9ca3af', background:'none', border:'none', cursor:'pointer' }}>Continue Betting</button>
        </div>
      </div>
      {shareImageUrl && <ShareImageModal imageUrl={shareImageUrl} onClose={() => setShareImageUrl(null)} />}
    </>
  );
}

function WinFlow({ bet, currency, onClose }: { bet: Bet; currency: CurrencyInfo; onClose: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  if (showDetails) return <WinDetailsSheet bet={bet} currency={currency} onClose={onClose} />;
  return <WinModal bet={bet} currency={currency} onClose={onClose} onDetails={() => setShowDetails(true)} />;
}

// ---------------------------------------------------------------------------
// Loss Modal — grey/black/white, fully responsive width, sharp buttons
// ---------------------------------------------------------------------------
function LossModal({ bet, onClose, currency }: { bet: Bet; onClose: () => void; currency: CurrencyInfo }) {
  const [generatingImage, setGeneratingImage] = useState(false);
  const [shareImageUrl, setShareImageUrl]     = useState<string | null>(null);

  const fmtLocal = (ghs: number) => {
    const v = ghs * currency.rateToGHS;
    try { return new Intl.NumberFormat(currency.locale, { style:'currency', currency:currency.code, minimumFractionDigits:2, maximumFractionDigits:2 }).format(v); }
    catch { return `${currency.symbol}${v.toFixed(2)}`; }
  };

  const handleShare = async () => {
    setGeneratingImage(true);
    try { setShareImageUrl(await generateSlipImage(bet, false, currency)); }
    catch (e) { logError('LossModal', e); }
    finally { setGeneratingImage(false); }
  };

  return (
    <>
      <style>{`@keyframes lossSlideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}.loss-enter{animation:lossSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both;}`}</style>
      <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" style={{ background:'rgba(0,0,0,0.72)' }}>
        <div className="w-full loss-enter overflow-hidden" style={{ maxWidth:'min(96vw, 520px)', maxHeight:'94vh', overflowY:'auto', background:'#ffffff', border:'1px solid rgba(17,24,39,0.14)', borderRadius:0, paddingBottom:'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <div style={{ height:2, width:'100%', background:`linear-gradient(90deg,${BRAND_GREY},#9ca3af,${BRAND_GREY})` }} />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 16px 4px' }}>
            <span style={{ color:'#111827' }}><BrandMark size={16} /></span>
            <button onClick={onClose} style={{ width:36, height:36, borderRadius:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(17,24,39,0.08)', border:'none', cursor:'pointer', color:'#9ca3af' }}><CloseIcon sx={{ fontSize:16 }} /></button>
          </div>
          <div style={{ textAlign:'center', padding:'0 20px 16px' }}>
            <div style={{ width:80, height:80, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'3rem', background:'rgba(17,24,39,0.05)', border:'1px solid rgba(17,24,39,0.14)', marginBottom:16 }}>😔</div>
            <p style={{ fontSize:12, fontWeight:900, letterSpacing:'3px', textTransform:'uppercase', color:'#9ca3af', marginBottom:8 }}>BETTER LUCK NEXT TIME</p>
            <p style={{ fontSize:'1.875rem', fontWeight:900, color:'#475569', overflowWrap:'break-word' }}>{fmtLocal(bet.stake)}</p>
            
          </div>
          <div style={{ display:'flex', gap:10, margin:'0 16px 16px', flexWrap:'wrap' }}>
            {[{ label:'Lost', value:fmtLocal(bet.stake) }, { label:'Odds', value:`${bet.totalOdds.toFixed(2)}×` }, { label:'Picks', value:`${bet.selections.length}` }].map(({ label, value }) => (
              <div key={label} style={{ flex:'1 1 90px', padding:'12px 8px', textAlign:'center', background:'rgba(17,24,39,0.04)', border:'1px solid rgba(17,24,39,0.10)', minWidth:0 }}>
                <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4, color:'#9ca3af' }}>{label}</p>
                <p style={{ fontSize:14, fontWeight:900, color:'#475569', overflowWrap:'break-word' }}>{value}</p>
              </div>
            ))}
          </div>
          <div style={{ margin:'0 16px 16px', display:'flex', flexDirection:'column', gap:8 }}>
            {bet.selections.slice(0, 3).map((sel, i) => (
              <div key={i} style={{ padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, background:'rgba(17,24,39,0.04)', border:'1px solid rgba(17,24,39,0.10)' }}>
                <div style={{ minWidth:0, flex:1, marginRight:12 }}>
                  <p style={{ fontSize:10, color:'#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{buildMatchLabel(sel as unknown as Record<string,unknown>)}</p>
                  <p style={{ fontSize:12, fontWeight:700, color:MATCH_GREEN, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sel.market}: {sel.selection}</p>
                </div>
                <span style={{ fontSize:10, fontWeight:900, flexShrink:0, color: sel.result === 'WON' ? '#111827' : sel.result === 'LOST' ? '#ef4444' : '#9ca3af' }}>{sel.result === 'WON' ? '✓' : sel.result === 'LOST' ? '✗' : '—'}</span>
              </div>
            ))}
            {bet.selections.length > 3 && <p style={{ textAlign:'center', fontSize:12, color:'#9ca3af' }}>+{bet.selections.length - 3} more</p>}
          </div>
          <div style={{ padding:'0 16px 8px', display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={onClose} style={{ flex:'1 1 140px', padding:'14px 0', borderRadius:0, fontWeight:900, fontSize:14, color:'#fff', background:BRAND_PRIMARY, border:'none', cursor:'pointer' }}>Try Again</button>
            <button onClick={handleShare} disabled={generatingImage} style={{ flex:'1 1 140px', padding:'14px 0', borderRadius:0, fontWeight:900, fontSize:14, color:'#6b7280', background:'rgba(17,24,39,0.06)', border:'1px solid rgba(17,24,39,0.14)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity: generatingImage ? 0.5 : 1 }}>
              {generatingImage ? <CircularProgress fontSize="small" /> : <><ShareIcon fontSize="small" /> Share</>}
            </button>
          </div>
        </div>
      </div>
      {shareImageUrl && <ShareImageModal imageUrl={shareImageUrl} onClose={() => setShareImageUrl(null)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Bet Detail Modal — now anchored to the TOP of the viewport and animates
// DOWN into place (instead of rising from the bottom), with a reserved
// bottom margin so its action buttons never sit underneath a fixed bottom
// nav bar. Fully responsive width, grey/black/white throughout, sharp
// buttons, green reserved only for match-detail "Pick" text.
// ---------------------------------------------------------------------------
function BetDetailModal({ bet, onClose, currency }: { bet: Bet; onClose: () => void; currency: CurrencyInfo }) {
  const { cardBorder, textPrimary, textSecondary, textMuted, overlay, isDark } = useThemeTokens();
  const [showWin, setShowWin]   = useState(false);
  const [showLoss, setShowLoss] = useState(false);

  const isWon     = bet.status === 'WON';
  const isLost    = bet.status === 'LOST';
  const isVoid    = bet.status === 'VOID';
  const isPending = bet.status === 'PENDING';
  const betTypeLabel = bet.selections.length > 1 ? `Multiple (${bet.selections.length})` : 'Singles';
  const ticketId  = `#${bet.id.slice(-8).toUpperCase()}`;

  const fmtLocal = (ghs: number) => {
    const v = ghs * currency.rateToGHS;
    try { return new Intl.NumberFormat(currency.locale, { style:'currency', currency:currency.code, minimumFractionDigits:2, maximumFractionDigits:2 }).format(v); }
    catch { return `${currency.symbol}${v.toFixed(2)}`; }
  };

  const statusConfig = {
    WON:     { color:'#111827', label:'🏆 WON' },
    LOST:    { color:BRAND_GREY, label:'LOST' },
    PENDING: { color:'#475569', label:'⏳ PENDING' },
    VOID:    { color:'#334155', label:'↩ VOID' },
  };
  const sc = statusConfig[bet.status as keyof typeof statusConfig] ?? statusConfig.PENDING;

  return (
    <>
      <style>{`
        @keyframes detailSlideUp2{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:translateY(0)}}
        .detail-enter2{animation:detailSlideUp2 0.32s cubic-bezier(0.16,1,0.3,1) both;}
        .cb-detail-shell * { line-height: 1.2; }
      `}</style>
      <div
        className="fixed inset-0 z-[60] flex flex-col detail-enter2 cb-detail-shell"
        style={{
          background: isDark ? '#0d1422' : '#ffffff',
          paddingTop:'env(safe-area-inset-top)',
        }}
      >
        {/* Header — pinned to the very top */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 12px', flexShrink:0, borderBottom:`1px solid ${cardBorder}` }}>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:textMuted, display:'flex', padding:0, flexShrink:0 }}><ArrowBackIcon sx={{ fontSize:18 }} /></button>
          <h2 style={{ fontSize:13.5, fontWeight:900, color:textPrimary }}>Ticket Details</h2>
        </div>

        <div style={{ overflowY:'auto', flex:1, paddingBottom: BOTTOM_NAV_CLEARANCE }}>
          {/* Ticket card */}
          <div style={{ margin:'10px 12px 0', background:overlay, border:`1px solid ${cardBorder}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px 0', flexWrap:'wrap', gap:4 }}>
              <span style={{ fontSize:10, color:textMuted }}>ID: <strong style={{ color:textSecondary, fontFamily:'monospace' }}>{ticketId}</strong></span>
              <span style={{ fontSize:10, color:textMuted }}>{new Date(bet.placedAt).toLocaleString('en-GH', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:false })}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 12px 8px', flexWrap:'wrap', gap:4 }}>
              <span style={{ fontSize:14, fontWeight:900, color:textPrimary }}>{betTypeLabel}</span>
              <span style={{ fontSize:12, fontWeight:900, color: isDark ? '#ffffff' : sc.color }}>{sc.label}</span>
            </div>
            <TicketDivider dense />
            <div style={{ padding:'0 12px 7px' }}>
              {[
                { label:'Total Return', value: fmtLocal(isVoid ? bet.stake : bet.potentialReturn), emphasize:true, color:MATCH_GREEN },
                { label:'Total Stake',  value: fmtLocal(bet.stake), emphasize:false, color:textPrimary },
                { label:'Total Odds',   value: `${bet.totalOdds.toFixed(2)}`, emphasize:false, color:textPrimary },
              ].map(({ label, value, emphasize, color }) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0' }}>
                  <span style={{ fontSize:11, color:textMuted }}>{label}</span>
                  <span style={{ fontSize: emphasize ? 14 : 12.5, fontWeight:900, color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action button */}
          {(isWon || isLost) && (
            <div style={{ padding:'8px 12px' }}>
              <button onClick={() => isWon ? setShowWin(true) : setShowLoss(true)} style={{ width:'100%', padding:'10px 0', borderRadius:0, border:'none', fontSize:12.5, fontWeight:900, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, color:'#fff', background: isWon ? BRAND_PRIMARY : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', boxShadow: isWon ? '0 3px 18px rgba(17,24,39,0.28)' : 'none' }}>
                {isWon ? <>🎉 Show Off</> : <>📋 View Result Details</>}
              </button>
            </div>
          )}
          {isPending && (
            <div style={{ padding:'8px 12px' }}>
              <div style={{ width:'100%', padding:'10px 0', fontSize:12.5, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'rgba(17,24,39,0.05)', border:'1px solid rgba(17,24,39,0.14)', color:BRAND_PRIMARY }}>
                <CircularProgress sx={{ fontSize:13 }} /> Awaiting results…
              </div>
            </div>
          )}

          {/* Selections */}
          <div style={{ padding:'0 12px 6px' }}>
            <p style={{ fontSize:9.5, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.06em', color:textMuted, marginBottom:6 }}>Selections · {bet.selections.length}</p>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {bet.selections.map((sel, i) => {
                const selWon = sel.result === 'WON'; const selLost = sel.result === 'LOST';
                const matchLabel = buildMatchLabel(sel as unknown as Record<string, unknown>);
                return (
                  <div key={sel.id ?? i} style={{ padding:9, background:overlay, border:`1px solid ${cardBorder}` }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                      <div style={{ width:18, height:18, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1, fontSize:10, fontWeight:900, background: selWon ? 'rgba(17,24,39,0.14)' : selLost ? 'rgba(239,68,68,0.12)' : 'rgba(17,24,39,0.08)', color: selWon ? (isDark ? '#ffffff' : BRAND_PRIMARY) : selLost ? '#ef4444' : textMuted }}>{selWon ? '✓' : selLost ? '✗' : i + 1}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:12.5, fontWeight:800, color:textPrimary, overflowWrap:'break-word' }}>{matchLabel}</p>
                        {sel.result && <p style={{ fontSize:10.5, color:textMuted, marginTop:1 }}>FT: <strong style={{ color:textSecondary }}>{(sel as unknown as Record<string, unknown>).ftScore as string ?? '—'}</strong></p>}
                        <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(17,24,39,0.03)', padding:'5px 7px', marginTop:4 }}>
                          <p style={{ fontSize:11, fontWeight:700, color:MATCH_GREEN, overflowWrap:'break-word' }}>{sel.selection} @ {sel.oddsLocked.toFixed(2)}</p>
                          <p style={{ fontSize:9.5, color:textMuted }}>{sel.market}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ margin:'8px 12px 10px', overflow:'hidden', background:overlay, border:`1px solid ${cardBorder}` }}>
            {[{ label:'Number of Bets', value:`${bet.selections.length > 1 ? 1 : bet.selections.length}` }, ...(bet.settledAt ? [{ label:'Settled', value:new Date(bet.settledAt).toLocaleString('en-GH', { dateStyle:'medium', timeStyle:'short' }) }] : [])].map(({ label, value }, idx, arr) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 12px', gap:6, flexWrap:'wrap', borderBottom: idx < arr.length-1 ? `1px solid ${cardBorder}` : 'none' }}>
                <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:textMuted }}>{label}</span>
                <span style={{ fontSize:10, color:textSecondary, overflowWrap:'break-word', textAlign:'right' }}>{value}</span>
              </div>
            ))}
          </div>
          {isVoid && <div style={{ margin:'0 12px 10px', padding:'8px 12px', display:'flex', alignItems:'center', gap:8, background:'rgba(17,24,39,0.06)', border:'1px solid rgba(17,24,39,0.14)' }}><InfoOutlinedIcon sx={{ fontSize:13, color:'#6b7280', flexShrink:0 }} /><p style={{ fontSize:10.5, fontWeight:600, color: textSecondary }}>Your stake has been refunded to your wallet</p></div>}
        </div>
      </div>
      {showWin  && <WinFlow  bet={bet} currency={currency} onClose={() => { setShowWin(false);  onClose(); }} />}
      {showLoss && <LossModal bet={bet} currency={currency} onClose={() => { setShowLoss(false); onClose(); }} />}
    </>
  );
}
// ---------------------------------------------------------------------------
// Currency Banner
// ---------------------------------------------------------------------------
function CurrencyBanner({ currency, loading }: { currency: CurrencyInfo; loading: boolean }) {
  const { cardBorder, textMuted, isDark } = useThemeTokens();
  // Min stake reads straight off the registered country's config now — the
  // same field AccountPage's "Region & Currency" card shows — instead of
  // being derived from a USD figure run through a live rates table.
  const minLocal = currency.minStake;

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', marginBottom:12, background: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(17,24,39,0.04)', border:`1px solid ${cardBorder}` }}>
        <div style={{ width:12, height:12, borderRadius:'50%', background:textMuted, opacity:0.4 }} />
        <span style={{ fontSize:12, color:textMuted }}>Loading…</span>
      </div>
    );
  }
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, padding:'8px 12px', marginBottom:12, background:'transparent', border:`1px solid ${cardBorder}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
        <span style={{ fontSize:16 }}>{currency.flag}</span>
        <div style={{ minWidth:0 }}>
          <span style={{ fontSize:12, fontWeight:700, color:textMuted }}>{currency.countryName} · {currency.code}</span>
          <span style={{ display:'block', fontSize:10, color:textMuted, overflowWrap:'break-word' }}>
            <span style={{ fontWeight:700, color:MATCH_GREEN }}>Min stake: {currency.symbol}{minLocal.toLocaleString(undefined, { maximumFractionDigits: minLocal >= 100 ? 0 : 2 })}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared atoms
// ---------------------------------------------------------------------------
function GuestPrompt({ message }: { message: string }) {
  const { textPrimary, textSecondary, isDark } = useThemeTokens();
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', textAlign:'center' }}>
      <div style={{ width:64, height:64, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.05)', border:'1px solid rgba(17,24,39,0.16)' }}>
        <LoginIcon style={{ color:BRAND_PRIMARY, fontSize:28 }} />
      </div>
      <p style={{ fontSize:18, fontWeight:900, marginBottom:4, color:textPrimary }}>{message}</p>
      <p style={{ fontSize:14, color:textSecondary, marginBottom:32 }}>Sign in to access all features</p>
      <Link to="/login" style={{ padding:'12px 32px', fontSize:14, fontWeight:700, borderRadius:0, display:'inline-flex', alignItems:'center', gap:8, textDecoration:'none', color:'#fff', background:BRAND_PRIMARY }}>
        <LoginIcon fontSize="small" /> Log In
      </Link>
      <Link to="/register" style={{ marginTop:12, fontSize:14, color:textSecondary, textDecoration:'none' }}>Create account →</Link>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const configs: Record<string, { bg:string; color:string; label:string }> = {
    WON:        { bg:'rgba(17,24,39,0.12)',   color:BRAND_PRIMARY, label:'⚡ WON'      },
    LOST:       { bg:'rgba(107,114,128,0.14)', color:BRAND_GREY, label:'LOST'        },
    PENDING:    { bg:'rgba(71,85,105,0.10)',   color:'#475569', label:'⏳ PENDING'  },
    VOID:       { bg:'rgba(229,231,235,0.7)',  color:'#334155', label:'↩ VOID'     },
    CASHED_OUT: { bg:'rgba(17,24,39,0.10)',   color:BRAND_PRIMARY, label:'CASHED OUT'  },
  };
  const cfg = configs[status.toUpperCase()] ?? configs.PENDING;
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'4px 10px', borderRadius:0, fontSize:10, fontWeight:900, background:cfg.bg, color:cfg.color }}>{cfg.label}</span>;
}

// ---------------------------------------------------------------------------
// Booking Code Panel
// ---------------------------------------------------------------------------
function BookingCodePanel() {
  const { clearBetSlip, addToBetSlip, showToast } = useAppStore();
  const { cardBorder, textPrimary, textMuted, inputBg, inputBorder, inputFocus, isDark } = useThemeTokens();
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const handleLoad = async () => {
    if (!code.trim()) return;
    setLoading(true); setError(null); setPreview(null);
    try {
      const res = await booking.redeem({ code: code.trim().toUpperCase() });
      if (res.success && res.data) setPreview(res.data as unknown as Record<string, unknown>);
      else setError('Invalid or expired booking code.');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Invalid booking code.'); }
    finally { setLoading(false); }
  };

  const handleAddToSlip = () => {
    if (!preview) return;
    const enriched = (preview.enrichedSelections ?? []) as Record<string, unknown>[];
    const mapped = enriched.map(s => ({ matchId:String(s.matchId ?? s.match_id ?? s.fixtureId ?? s.fixture_id ?? ''), matchName:buildMatchLabel(s), market:String(s.market ?? s.marketKey ?? ''), selection:String(s.selection ?? s.pick ?? s.name ?? s.label ?? ''), odd:extractOdds(s) }));
    clearBetSlip();
    mapped.forEach(sel => addToBetSlip(sel as Parameters<typeof addToBetSlip>[0]));
    showToast(`Booking code loaded — ${mapped.length} selections added!`, 'success');
    setPreview(null); setCode('');
  };

  const bookingData        = preview?.booking as Record<string, unknown> | undefined;
  const enrichedSelections = (preview?.enrichedSelections ?? []) as Record<string, unknown>[];
  const currentTotalOdds   = (preview?.currentTotalOdds ?? bookingData?.totalOdds ?? 0) as number;

  return (
    <div style={{ marginTop:20, paddingTop:20, borderTop:`1px solid ${isDark ? 'rgba(148,163,184,0.10)' : 'rgba(17,24,39,0.10)'}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <div style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(17,24,39,0.08)', border:'1px solid rgba(17,24,39,0.18)' }}>
          <QrCodeIcon sx={{ fontSize:14, color:BRAND_PRIMARY }} />
        </div>
        <span style={{ fontSize:12, fontWeight:800, color:textMuted, letterSpacing:'0.06em', textTransform:'uppercase' }}>Booking Code</span>
      </div>

      <div style={{ position:'relative' }}>
        <div style={{ position:'relative', display:'flex', alignItems:'stretch', overflow:'hidden', border:`1.5px solid ${error ? '#ef4444' : focused ? inputFocus : inputBorder}`, background:inputBg, transition:'border-color 180ms ease', boxShadow: focused ? `0 0 0 3px ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(17,24,39,0.08)'}` : 'none' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', paddingLeft:14, paddingRight:6, flexShrink:0, color: error ? '#ef4444' : focused ? BRAND_PRIMARY : textMuted, transition:'color 180ms' }}>
            <QrCodeIcon sx={{ fontSize:16 }} />
          </div>
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError(null); setPreview(null); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Enter code e.g. ABC12345"
            disabled={loading}
            onKeyDown={e => e.key === 'Enter' && handleLoad()}
            style={{ flex:1, padding:'13px 8px', background:'transparent', border:'none', outline:'none', color:textPrimary, fontSize:14, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', minWidth:0 }}
          />
          {code.length > 0 && !loading && (
            <button
              onClick={() => { setCode(''); setError(null); setPreview(null); }}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'0 8px', background:'none', border:'none', cursor:'pointer', color:textMuted, flexShrink:0 }}
            >
              <CloseIcon sx={{ fontSize:14 }} />
            </button>
          )}
          <div style={{ width:1, background:isDark ? 'rgba(148,163,184,0.16)' : 'rgba(17,24,39,0.14)', margin:'8px 0', flexShrink:0 }} />
          <button
            onClick={handleLoad}
            disabled={loading || !code.trim()}
            style={{ padding:'0 18px', borderRadius:0, background: loading || !code.trim() ? 'transparent' : 'rgba(17,24,39,0.10)', border:'none', color: loading || !code.trim() ? textMuted : BRAND_PRIMARY, fontWeight:900, fontSize:12, letterSpacing:'0.05em', textTransform:'uppercase', cursor: loading || !code.trim() ? 'not-allowed' : 'pointer', flexShrink:0, transition:'background 150ms, color 150ms' }}
          >
            {loading ? '…' : 'Load'}
          </button>
        </div>

        {error && (
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, padding:'8px 12px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.16)' }}>
            <InfoOutlinedIcon sx={{ fontSize:13, color:'#ef4444', flexShrink:0 }} />
            <span style={{ fontSize:12, color:'#ef4444', fontWeight:600 }}>{error}</span>
          </div>
        )}
      </div>

      {preview && (
        <div style={{ marginTop:12, overflow:'hidden', background:isDark ? 'rgba(148,163,184,0.05)' : '#fff', border:`1px solid ${isDark ? 'rgba(148,163,184,0.16)' : 'rgba(17,24,39,0.14)'}` }}>
          <div style={{ padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6, borderBottom:`1px solid ${isDark ? 'rgba(148,163,184,0.10)' : 'rgba(17,24,39,0.10)'}` }}>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:13, fontWeight:900, fontFamily:'monospace', letterSpacing:'0.12em', color:BRAND_PRIMARY, overflowWrap:'break-word' }}>{String(bookingData?.code ?? code)}</p>
              <p style={{ fontSize:11, marginTop:2, color:textMuted }}>{enrichedSelections.length} selection{enrichedSelections.length !== 1 ? 's' : ''} · Odds: {currentTotalOdds.toFixed(2)}×</p>
            </div>
            <button onClick={() => { setPreview(null); setCode(''); }} style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'none', cursor:'pointer', color:textMuted, flexShrink:0 }}><CloseIcon sx={{ fontSize:14 }} /></button>
          </div>
          <div style={{ maxHeight:176, overflowY:'auto' }}>
            {enrichedSelections.map((sel, i) => {
              const odds = extractOdds(sel);
              return (
                <div key={i} style={{ padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, borderBottom:`1px solid ${isDark ? 'rgba(148,163,184,0.08)' : 'rgba(17,24,39,0.08)'}` }}>
                  <div style={{ minWidth:0, flex:1, marginRight:12 }}>
                    <p style={{ fontSize:11, color:textMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{buildMatchLabel(sel)}</p>
                    <p style={{ fontSize:12, fontWeight:700, color:MATCH_GREEN, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{String(sel.market ?? '')}: {String(sel.selection ?? '')}</p>
                  </div>
                  <span style={{ fontSize:12, fontWeight:900, flexShrink:0, color:BRAND_PRIMARY }}>{odds > 1 ? odds.toFixed(2) : '—'}</span>
                </div>
              );
            })}
          </div>
          <div style={{ padding:12 }}>
            <button onClick={handleAddToSlip} style={{ width:'100%', padding:'12px 0', borderRadius:0, border:'none', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:BRAND_PRIMARY, boxShadow:'0 3px 16px rgba(17,24,39,0.25)' }}>
              <CheckCircleIcon fontSize="small" /> Add {enrichedSelections.length} Selection{enrichedSelections.length !== 1 ? 's' : ''} to Slip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slip Tab
// ---------------------------------------------------------------------------
function SlipTab({ currency, currencyLoading }: { currency: CurrencyInfo; currencyLoading: boolean }) {
  const { betSlip, removeFromBetSlip, clearBetSlip, showToast, user } = useAppStore();
  const { cardBg, cardBorder, textPrimary, textSecondary, textMuted, inputBg, inputBorder, inputFocus, divider, overlay, isDark } = useThemeTokens();
  const navigate = useNavigate();
  const [stakeLocal, setStakeLocal]         = useState('');
  const [placing, setPlacing]               = useState(false);
  const [placed, setPlaced]                 = useState(false);
  const [walletBalance, setWalletBalance]   = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [stakeFocused, setStakeFocused]     = useState(false);

  // Min stake reads straight off the registered country's config, same as
  // AccountPage's "Region & Currency" card — no USD conversion.
  const minStakeLocal = currency.minStake;
  const QUICK_LOCAL   = [
    Math.round(minStakeLocal),
    Math.round(minStakeLocal * 2),
    Math.round(minStakeLocal * 4),
    Math.round(minStakeLocal * 10),
  ];

  const fmtLocal = (ghs: number) => {
    const v = ghs * currency.rateToGHS;
    try {
      return new Intl.NumberFormat(currency.locale, {
        style:'currency', currency:currency.code,
        minimumFractionDigits: ['NGN','JPY','UGX','XAF','XOF','RWF'].includes(currency.code) ? 0 : 2,
        maximumFractionDigits: ['NGN','JPY','UGX','XAF','XOF','RWF'].includes(currency.code) ? 0 : 2,
      }).format(v);
    } catch { return `${currency.symbol}${v.toFixed(2)}`; }
  };

  const parsedLocal = parseFloat(stakeLocal) || 0;
  const parsedGHS   = currency.rateToGHS > 0 ? parsedLocal / currency.rateToGHS : parsedLocal;

  const fetchBalance = useCallback(async () => {
    if (!user) return;
    setBalanceLoading(true);
    try {
      const res = await walletApi.getWallet();
      if (res.success && res.data) {
        const d   = res.data as Record<string, unknown>;
        const bal = typeof d.balance === 'number' ? d.balance : typeof d.mainBalance === 'number' ? d.mainBalance : typeof d.availableBalance === 'number' ? d.availableBalance : null;
        setWalletBalance(bal);
      }
    } catch (e) { logError('SlipTab', e); }
    finally { setBalanceLoading(false); }
  }, [user]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const totalOdds          = calculateTotalOdds(betSlip.map(s => s.odd));
  const potentialReturnGHS = calculatePotentialReturn(parsedGHS, totalOdds);
  const effectiveBalanceGHS = walletBalance ?? 0;
  const belowMinimum        = parsedLocal > 0 && parsedLocal < minStakeLocal;
  const insufficientFunds   = parsedLocal > 0 && walletBalance !== null && parsedGHS > effectiveBalanceGHS;
  const hasError            = belowMinimum || insufficientFunds;
  const canPlace            = !!user && parsedLocal >= minStakeLocal && !insufficientFunds && betSlip.length > 0;

  const handlePlace = async () => {
    if (!user) { navigate('/login'); return; }
    if (parsedLocal < minStakeLocal) { showToast(`Minimum stake is ${currency.symbol}${minStakeLocal.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${currency.code})`, 'error'); return; }
    setPlacing(true);
    try {
      const verifiedSelections = await Promise.all(betSlip.map(async s => {
        if (!s.matchId) return { matchId:s.matchId, market:s.market, selection:s.selection, submittedOdds:Number(s.odd) };
        try {
          const res = await publicMatches.odds(s.matchId);
          if (res.success && Array.isArray(res.data)) {
            const match = (res.data as Record<string, unknown>[]).find(o => (o.market === s.market || o.marketKey === s.market) && (o.selection === s.selection || o.name === s.selection));
            return { matchId:s.matchId, market:s.market, selection:s.selection, submittedOdds: match ? Number(match.value ?? match.odds ?? s.odd) : Number(s.odd) };
          }
        } catch { logWarn('SlipTab', `Odds fetch failed for ${s.matchId}`); }
        return { matchId:s.matchId, market:s.market, selection:s.selection, submittedOdds:Number(s.odd) };
      }));
      const payload = { stake:parsedGHS, currency:'GHS', selections: verifiedSelections.map(s => ({ matchId:s.matchId, fixtureId:s.matchId, market:s.market, selection:s.selection, submittedOdds:s.submittedOdds })) as Parameters<typeof betsApi.place>[0]['selections'] };
      const res = await betsApi.place(payload);
      if (res.success) { clearBetSlip(); setStakeLocal(''); setPlaced(true); showToast('Bet placed successfully!', 'success'); fetchBalance(); }
      else throw new Error((res as unknown as Record<string, unknown>).message as string ?? 'Failed to place bet.');
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Failed to place bet.', 'error'); }
    finally { setPlacing(false); }
  };

  if (placed) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', textAlign:'center' }}>
        <div style={{ width:80, height:80, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20, background:'rgba(17,24,39,0.08)', border:'1px solid rgba(17,24,39,0.20)' }}>
          <CheckCircleIcon sx={{ fontSize:40, color:BRAND_PRIMARY }} />
        </div>
        <p style={{ fontSize:24, fontWeight:900, marginBottom:8, color:textPrimary }}>Bet Placed!</p>
        <p style={{ fontSize:14, color:textSecondary, marginBottom:32 }}>Track it in My Bets</p>
        <button onClick={() => setPlaced(false)} style={{ padding:'14px 32px', borderRadius:0, fontSize:14, fontWeight:900, color:'#fff', background:BRAND_PRIMARY, border:'none', cursor:'pointer', boxShadow:'0 4px 20px rgba(17,24,39,0.30)' }}>New Bet</button>
      </div>
    );
  }

  if (betSlip.length === 0) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', textAlign:'center' }}>
        <div style={{ width:64, height:64, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20, background:overlay, border:`1px solid ${cardBorder}` }}>
          <ReceiptLongIcon sx={{ fontSize:28, color:textMuted }} />
        </div>
        <p style={{ fontSize:18, fontWeight:900, marginBottom:4, color:textPrimary }}>Slip is empty</p>
        <p style={{ fontSize:14, color:textSecondary, marginBottom:32 }}>Tap any odds to add selections</p>
        <Link to="/" style={{ padding:'12px 24px', fontSize:14, fontWeight:700, borderRadius:0, display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', color:'#fff', background:BRAND_PRIMARY }}>
          <SportsSoccerIcon fontSize="small" /> Browse Matches
        </Link>
        <BookingCodePanel />
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <CurrencyBanner currency={currency} loading={currencyLoading} />

      <div style={{ overflow:'hidden', background:cardBg, border:`1px solid ${cardBorder}` }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px 10px', flexWrap:'wrap', gap:6 }}>
          <span style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
            <ConfirmationNumberIcon sx={{ fontSize:15, color:BRAND_PRIMARY }} />
            <span style={{ fontSize:11, fontWeight:900, letterSpacing:'0.08em', textTransform:'uppercase', color:textMuted }}>Your Ticket · {betSlip.length} pick{betSlip.length !== 1 ? 's' : ''}</span>
          </span>
          <span style={{ fontSize:12, fontWeight:900, color:BRAND_PRIMARY }}>{totalOdds.toFixed(2)}×</span>
        </div>
        <TicketDivider dense />
        <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'2px 10px 12px' }}>
          {betSlip.map((sel, idx) => (
            <div key={`${sel.matchId}-${sel.market}-${sel.selection}`}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 12px', background:overlay, border:`1px solid ${cardBorder}` }}>
              <div style={{ width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(17,24,39,0.10)', border:'1px solid rgba(17,24,39,0.18)' }}>
                <span style={{ fontSize:10, fontWeight:900, color:BRAND_PRIMARY }}>{idx + 1}</span>
              </div>
              <div style={{ minWidth:0, flex:1 }}>
                <p style={{ fontSize:11, color:textMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:1 }}>{sel.matchName}</p>
                <p style={{ fontSize:13, fontWeight:700, color:MATCH_GREEN, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {sel.market}: <span style={{ color:textSecondary }}>{sel.selection}</span>
                </p>
              </div>
              <div style={{ padding:'5px 10px', background:'rgba(17,24,39,0.08)', border:'1px solid rgba(17,24,39,0.18)', flexShrink:0 }}>
                <span style={{ fontSize:13, fontWeight:900, color:BRAND_PRIMARY }}>{sel.odd.toFixed(2)}</span>
              </div>
              <button onClick={() => removeFromBetSlip(sel.matchId, sel.market, sel.selection)}
                style={{ width:28, height:28, borderRadius:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.12)', color:'rgba(239,68,68,0.6)', cursor:'pointer', flexShrink:0, transition:'background 150ms' }}>
                <DeleteIcon sx={{ fontSize:14 }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:'18px 14px', background:cardBg, border:`1px solid ${cardBorder}` }}>
        <p style={{ fontSize:10, fontWeight:900, letterSpacing:'0.08em', textTransform:'uppercase', color:textMuted, marginBottom:12 }}>Build Your Stake</p>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(64px, 1fr))', gap:6, marginBottom:14 }}>
          {QUICK_LOCAL.map(qs => (
            <button key={qs}
              onClick={() => setStakeLocal(prev => (parseFloat(prev || '0') + qs).toString())}
              style={{ padding:'9px 0', fontSize:11, fontWeight:800, borderRadius:0, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.05)', border:`1px solid ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(17,24,39,0.14)'}`, color:BRAND_PRIMARY, cursor:'pointer', transition:'background 120ms' }}>
              +{qs >= 1_000_000 ? `${(qs/1_000_000).toFixed(1)}M` : qs >= 1000 ? `${(qs/1000).toFixed(qs%1000===0?0:1)}k` : qs}
            </button>
          ))}
        </div>

        <div style={{ marginBottom:10 }}>
          <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:textMuted, marginBottom:8 }}>Or Enter Exact Amount</label>
          <div style={{ position:'relative', display:'flex', alignItems:'stretch', overflow:'hidden', border:`2px solid ${hasError ? '#ef4444' : stakeFocused ? inputFocus : inputBorder}`, background:inputBg, transition:'border-color 180ms ease, box-shadow 180ms ease', boxShadow: stakeFocused && !hasError ? `0 0 0 3px ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(17,24,39,0.08)'}` : hasError ? '0 0 0 3px rgba(239,68,68,0.10)' : 'none' }}>
            <button
              onClick={() => setStakeLocal(prev => Math.max(0, (parseFloat(prev || '0') - Math.round(minStakeLocal))).toString())}
              style={{ width:44, borderRadius:0, display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'none', borderRight:`1px solid ${isDark ? 'rgba(148,163,184,0.14)' : 'rgba(17,24,39,0.12)'}`, cursor:'pointer', color:textMuted, flexShrink:0, transition:'background 150ms' }}
            >
              <RemoveIcon sx={{ fontSize:16 }} />
            </button>
            <div style={{ flex:1, position:'relative', display:'flex', alignItems:'center', minWidth:0 }}>
              <span style={{ paddingLeft:12, fontSize:16, fontWeight:900, color: parsedLocal > 0 ? (hasError ? '#ef4444' : BRAND_PRIMARY) : textMuted, flexShrink:0, pointerEvents:'none', lineHeight:1 }}>
                {currency.symbol}
              </span>
              <input
                type="number"
                value={stakeLocal}
                onChange={e => setStakeLocal(e.target.value)}
                onFocus={() => setStakeFocused(true)}
                onBlur={() => setStakeFocused(false)}
                placeholder={minStakeLocal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                min={minStakeLocal}
                step={currency.code === 'NGN' ? 500 : 1}
                style={{ flex:1, padding:'15px 8px', background:'transparent', border:'none', outline:'none', color: hasError ? '#ef4444' : textPrimary, fontSize:22, fontWeight:900, letterSpacing:'-0.01em', minWidth:0, width:'100%' }}
              />
            </div>
            <button
              onClick={() => setStakeLocal(prev => ((parseFloat(prev || '0') + Math.round(minStakeLocal))).toString())}
              style={{ width:44, borderRadius:0, display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'none', borderLeft:`1px solid ${isDark ? 'rgba(148,163,184,0.14)' : 'rgba(17,24,39,0.12)'}`, cursor:'pointer', color:textMuted, flexShrink:0, transition:'background 150ms' }}
            >
              <AddIcon sx={{ fontSize:16 }} />
            </button>
          </div>

          {/* The "≈ GH₵…" secondary line that sat here is removed: the stake
              above is already denominated in the player's own currency. */}
          {belowMinimum && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, padding:'7px 10px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.14)' }}>
              <InfoOutlinedIcon sx={{ fontSize:12, color:'#ef4444', flexShrink:0 }} />
              <span style={{ fontSize:11, color:'#ef4444', fontWeight:600 }}>Minimum stake is {currency.symbol}{minStakeLocal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {!belowMinimum && insufficientFunds && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, padding:'7px 10px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.14)' }}>
              <InfoOutlinedIcon sx={{ fontSize:12, color:'#ef4444', flexShrink:0 }} />
              <span style={{ fontSize:11, color:'#ef4444', fontWeight:600 }}>Insufficient balance · {fmtLocal(effectiveBalanceGHS)} available</span>
            </div>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, padding:'9px 12px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.04)', border:`1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(17,24,39,0.10)'}` }}>
          <InfoOutlinedIcon sx={{ fontSize:13, color:BRAND_PRIMARY, flexShrink:0 }} />
          <p style={{ fontSize:11, fontWeight:700, color: isDark ? '#e5e7eb' : '#374151' }}>
            Min stake: <strong>{currency.symbol}{minStakeLocal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> {currency.code}
          </p>
        </div>

        <TicketDivider dense />

        <div style={{ margin:'12px 0 16px', overflow:'hidden', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.03)', border:`1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.10)'}` }}>
          {[
            { label:`${betSlip.length} pick${betSlip.length !== 1 ? 's' : ''} · Combined odds`, value:`${totalOdds.toFixed(2)}×`, color:BRAND_PRIMARY, big:false },
            { label:'Potential return',   value:fmtLocal(potentialReturnGHS),  color:parsedLocal > 0 ? BRAND_PRIMARY : textSecondary, big:true  },
            ...(user ? [{ label:'Wallet balance', value: balanceLoading ? '…' : walletBalance !== null ? fmtLocal(walletBalance) : '–', color:textMuted, big:false }] : []),
          ].map(({ label, value, color, big }, idx, arr) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'12px 14px', gap:12, flexWrap:'wrap', borderBottom: idx < arr.length-1 ? `1px solid ${divider}` : 'none' }}>
              <span style={{ fontSize:12, color:textMuted, flexShrink:0 }}>{label}</span>
              <span style={{ fontSize: big ? 18 : 13, fontWeight:900, color, minWidth:0, textAlign:'right', overflowWrap:'break-word' }}>{value}</span>
            </div>
          ))}
        </div>

        {user ? (
          <button onClick={handlePlace} disabled={!canPlace || placing}
            style={{ width:'100%', padding:'16px 0', borderRadius:0, border:'none', fontSize:15, fontWeight:900, cursor: canPlace && !placing ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:8, color:'#fff', background: canPlace ? BRAND_PRIMARY : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', boxShadow: canPlace ? '0 4px 24px rgba(17,24,39,0.35)' : 'none', opacity: !canPlace || placing ? 0.55 : 1, transition:'background 150ms, opacity 150ms, box-shadow 150ms' }}>
            {placing
              ? <><CircularProgress fontSize="small" /> Placing Bet…</>
              : <>Place Bet{parsedLocal > 0 ? ` · ${currency.symbol}${parsedLocal.toLocaleString()}` : ''} <ArrowForwardIcon fontSize="small" /></>
            }
          </button>
        ) : (
          <Link to="/login" style={{ width:'100%', padding:'16px 0', borderRadius:0, fontSize:15, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', gap:8, textDecoration:'none', color:'#fff', background:BRAND_PRIMARY, boxShadow:'0 4px 24px rgba(17,24,39,0.30)' }}>
            <LoginIcon fontSize="small" /> Log In to Place Bet
          </Link>
        )}

        <button onClick={clearBetSlip} style={{ width:'100%', marginTop:10, padding:'8px 0', fontSize:12, fontWeight:600, color:textMuted, background:'none', border:'none', cursor:'pointer', letterSpacing:'0.02em' }}>
          Clear slip
        </button>
      </div>

      {user && <BookingCodePanel />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// My Bets Tab
// ---------------------------------------------------------------------------
type BetsFilter = 'ALL' | 'PENDING' | 'WON' | 'LOST' | 'VOID';

const EMPTY_STATE: Record<BetsFilter, { emoji:string; label:string; sub:string }> = {
  ALL:     { emoji:'🏟️', label:'No bets yet',   sub:'Your bets will appear here once you start playing.' },
  PENDING: { emoji:'⏳', label:'No active bets', sub:'Placed bets appear here while in progress.' },
  WON:     { emoji:'🏆', label:'No wins yet',    sub:'Your winning tickets will land here.' },
  LOST:    { emoji:'👋', label:'No losses',      sub:"Bets that didn't hit show here." },
  VOID:    { emoji:'↩️', label:'No voided bets', sub:'Refunded bets appear here.' },
};

const BANNER_CONFIG: Record<string, { bg:string; text:string; label:string }> = {
  WON:     { bg:BRAND_PRIMARY, text:'#ffffff', label:'⚡ Won' },
  LOST:    { bg:BRAND_GREY, text:'#ffffff', label:'Lost' },
  PENDING: { bg:'#475569', text:'#ffffff', label:'⏳ Pending' },
  VOID:    { bg:'#e5e7eb', text:'#111827', label:'↩ Void' },
};

function MyBetsTab({ currency, currencyLoading }: { currency: CurrencyInfo; currencyLoading: boolean }) {
  const { user } = useAppStore();
  const { cardBg, cardBorder, textPrimary, textSecondary, textMuted, divider, skeletonBg, overlay, isDark } = useThemeTokens();
  const [apiBets, setApiBets]       = useState<Bet[]>([]);
  const [loading, setLoading]       = useState(false);
  const [page, setPage]             = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter]         = useState<BetsFilter>('ALL');
  const [detailBet, setDetailBet]   = useState<Bet | null>(null);
  const [unseenWins, setUnseenWins] = useState<Bet[]>([]);
  const [winPopup, setWinPopup]     = useState<Bet | null>(null);
  const didCheckUnseen              = useRef(false);

  const normalisedBets = apiBets.map(normaliseBet);
  const totalStaked    = normalisedBets.reduce((s, b) => s + (b.stake ?? 0), 0);
  const totalWon       = normalisedBets.filter(b => b.status === 'WON').reduce((s, b) => s + (b.potentialReturn ?? 0), 0);
  const settledBets    = normalisedBets.filter(b => b.status !== 'PENDING');
  const winCount       = normalisedBets.filter(b => b.status === 'WON').length;
  const winRate        = settledBets.length ? Math.round((winCount / settledBets.length) * 100) : 0;

  const fmtLocal = useCallback((ghs: number) => {
    const v = ghs * currency.rateToGHS;
    try {
      return new Intl.NumberFormat(currency.locale, {
        style:'currency', currency:currency.code,
        minimumFractionDigits: ['NGN','JPY','UGX'].includes(currency.code) ? 0 : 2,
        maximumFractionDigits: ['NGN','JPY','UGX'].includes(currency.code) ? 0 : 2,
      }).format(v);
    } catch { return `${currency.symbol}${v.toFixed(2)}`; }
  }, [currency]);

  const fetchBets = useCallback(async (p = 0) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await betsApi.getMyBets(p, 10);
      if (res.success) { setApiBets(prev => p === 0 ? res.data.content : [...prev, ...res.data.content]); setTotalPages(res.data.totalPages); setPage(p); }
    } catch (e) { logError('MyBets', e); }
    finally { setLoading(false); }
  }, [user]);

  const checkUnseenWins = useCallback(async () => {
    if (!user || didCheckUnseen.current) return;
    didCheckUnseen.current = true;
    try {
      const res = await betsApi.getUnseenWins();
      if (res.success && res.data.length > 0) { setUnseenWins(res.data); setWinPopup(normaliseBet(res.data[0])); }
    } catch (e) { logWarn('MyBets', 'checkUnseenWins failed:', e); }
  }, [user]);

  useEffect(() => { fetchBets(0); checkUnseenWins(); }, [fetchBets, checkUnseenWins]);

  const dismissWin = async (bet: Bet) => {
    try { await betsApi.dismissWin(bet.id); } catch {}
    const remaining = unseenWins.filter(b => b.id !== bet.id);
    setUnseenWins(remaining);
    setWinPopup(remaining[0] ? normaliseBet(remaining[0]) : null);
  };

  if (!user) return <GuestPrompt message="Log in to view your bets" />;

  const filtered = filter === 'ALL' ? normalisedBets : normalisedBets.filter(b => b.status === filter);
  const FILTERS: { key: BetsFilter; label: string }[] = [
    { key:'ALL', label:'All' }, { key:'PENDING', label:'Open' },
    { key:'WON', label:'Won' }, { key:'LOST', label:'Lost' }, { key:'VOID', label:'Void' },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <CurrencyBanner currency={currency} loading={currencyLoading} />

      {normalisedBets.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:8 }}>
          {[
            { icon:<AccountBalanceWalletIcon sx={{ fontSize:14 }} />, label:'Staked',   value:fmtLocal(totalStaked), color:textPrimary, bg:overlay },
            { icon:<EmojiEventsIcon sx={{ fontSize:14 }} />,          label:'Won',      value:fmtLocal(totalWon),   color:BRAND_PRIMARY, bg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.05)' },
            { icon:<AutoGraphIcon sx={{ fontSize:14 }} />,            label:'Win Rate', value: winRate ? `${winRate}%` : '—', color:BRAND_ACCENT_LIGHT, bg:overlay },
          ].map(({ icon, label, value, color, bg }) => (
            <div key={label} style={{ padding:'12px 8px', minWidth:0, background:bg, border:`1px solid ${cardBorder}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, color:textMuted }}>{icon}<p style={{ fontSize:9, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.1em', color:textMuted }}>{label}</p></div>
              <p style={{ fontSize:14, fontWeight:900, color, overflowWrap:'break-word' }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ display:'flex', gap:6, flex:1, overflowX:'auto', paddingBottom:2 }}>
          {FILTERS.map(f => {
            const count    = f.key === 'ALL' ? normalisedBets.length : normalisedBets.filter(b => b.status === f.key).length;
            const isActive = filter === f.key;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{ flexShrink:0, padding:'8px 14px', borderRadius:0, fontSize:12, fontWeight:900, border: isActive ? 'none' : `1px solid ${cardBorder}`, cursor:'pointer', background: isActive ? BRAND_PRIMARY : cardBg, color: isActive ? '#fff' : textSecondary, boxShadow: isActive ? '0 4px 14px rgba(17,24,39,0.30)' : 'none', transition:'background 150ms' }}>
                {f.label}{count > 0 ? ` · ${count}` : ''}
              </button>
            );
          })}
        </div>
        <button onClick={() => fetchBets(0)} style={{ flexShrink:0, width:32, height:32, borderRadius:0, display:'flex', alignItems:'center', justifyContent:'center', background:cardBg, border:`1px solid ${cardBorder}`, color:textMuted, cursor:'pointer' }}>
          <RefreshIcon sx={{ fontSize:15 }} />
        </button>
      </div>

      {loading && apiBets.length === 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ padding:16, background:cardBg, border:`1px solid ${cardBorder}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ height:12, width:80, background:skeletonBg }} />
                <div style={{ height:20, width:64, background:skeletonBg }} />
              </div>
              <div style={{ height:12, width:'100%', background:skeletonBg, marginBottom:6 }} />
              <div style={{ height:12, width:'65%', background:skeletonBg }} />
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', textAlign:'center' }}>
          <span style={{ fontSize:38, marginBottom:16 }}>{EMPTY_STATE[filter].emoji}</span>
          <p style={{ fontWeight:900, fontSize:16, marginBottom:4, color:textPrimary }}>{EMPTY_STATE[filter].label}</p>
          <p style={{ fontSize:14, color:textSecondary }}>{EMPTY_STATE[filter].sub}</p>
          {filter === 'ALL' && (
            <Link to="/" style={{ marginTop:32, padding:'12px 24px', fontSize:14, fontWeight:700, borderRadius:0, display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', color:'#fff', background:BRAND_PRIMARY }}>
              <SportsSoccerIcon fontSize="small" /> Browse Matches
            </Link>
          )}
        </div>
      )}

      {filtered.map(bet => {
        const banner = BANNER_CONFIG[bet.status] ?? BANNER_CONFIG.PENDING;
        const isWon     = bet.status === 'WON';
        const isVoid    = bet.status === 'VOID';
        const betTypeLabel = bet.selections.length > 1 ? 'Multiple' : 'Singles';
        const cardOpacity = bet.status === 'LOST' ? (isDark ? 0.7 : 0.85) : 1;

        return (
          <button key={bet.id} onClick={() => setDetailBet(bet)}
            style={{ width:'100%', textAlign:'left', borderRadius:0, overflow:'hidden', background:cardBg, border:`1px solid ${cardBorder}`, opacity:cardOpacity, cursor:'pointer', transition:'opacity 150ms' }}>
            <div style={{ padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6, background:banner.bg }}>
              <span style={{ fontSize:13, fontWeight:900, color:banner.text }}>{betTypeLabel}</span>
              <span style={{ fontSize:12, fontWeight:900, color:banner.text, display:'flex', alignItems:'center', gap:6 }}>{banner.label} <ArrowForwardIcon sx={{ fontSize:13 }} /></span>
            </div>
            <div style={{ padding:16 }}>
              <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:textMuted, marginBottom:8 }}>
                {new Date(bet.placedAt).toLocaleDateString('en-GH', { day:'2-digit', month:'short', year:'numeric' })} · {bet.selections.length} selection{bet.selections.length !== 1 ? 's' : ''}
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:12 }}>
                {bet.selections.slice(0, 2).map((sel: BetSelection, i: number) => {
                  const selWon = sel.result === 'WON'; const selLost = sel.result === 'LOST';
                  return (
                    <p key={sel.id ?? i} style={{ fontSize:12, color:textMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}>
                      {sel.result && <span style={{ fontSize:10, color: selWon ? BRAND_PRIMARY : selLost ? '#ef4444' : textMuted }}>{selWon ? '✓' : selLost ? '✗' : '·'}</span>}
                      <span style={{ fontWeight:600, color:MATCH_GREEN, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{buildMatchLabel(sel as unknown as Record<string,unknown>)}</span>
                      {' · '}{sel.selection}
                    </p>
                  );
                })}
                {bet.selections.length > 2 && <p style={{ fontSize:12, color:textMuted }}>+{bet.selections.length - 2} more</p>}
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:12, borderTop:`1px solid ${isDark ? 'rgba(148,163,184,0.10)' : 'rgba(0,0,0,0.06)'}`, flexWrap:'wrap', gap:6 }}>
                <div>
                  <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2, color:textMuted }}>Total Stake</p>
                  <p style={{ fontSize:14, fontWeight:900, color:textPrimary }}>{fmtLocal(bet.stake)}</p>
                </div>
                <div style={{ textAlign:'center' }}>
                  <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2, color:textMuted }}>Odds</p>
                  <p style={{ fontSize:14, fontWeight:900, color:BRAND_PRIMARY }}>{bet.totalOdds.toFixed(2)}×</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2, color:textMuted }}>Total {isVoid ? 'Refund' : 'Return'}</p>
                  <p style={{ fontSize:14, fontWeight:900, color: isWon ? BRAND_PRIMARY : isVoid ? '#334155' : textSecondary }}>{fmtLocal(isVoid ? bet.stake : bet.potentialReturn)}</p>
                </div>
              </div>
            </div>
          </button>
        );
      })}

      {page < totalPages - 1 && !loading && (
        <button onClick={() => fetchBets(page + 1)} style={{ width:'100%', padding:'14px 0', fontSize:14, fontWeight:900, borderRadius:0, color:BRAND_PRIMARY, border:'1px solid rgba(17,24,39,0.20)', background:'transparent', cursor:'pointer' }}>
          Load More
        </button>
      )}
      {loading && apiBets.length > 0 && (
        <div style={{ display:'flex', justifyContent:'center', padding:'20px 0', color:BRAND_PRIMARY }}>
          <CircularProgress sx={{ fontSize:14 }} />
        </div>
      )}

      {detailBet && <BetDetailModal bet={detailBet} onClose={() => setDetailBet(null)} currency={currency} />}
      {winPopup  && <WinFlow bet={winPopup} currency={currency} onClose={() => dismissWin(winPopup)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export — fully responsive shell that scales from small phones
// (320px) up through tablet and desktop widths, no horizontal overflow
// anywhere, sharp-edged (non-rounded) buttons throughout.
// ---------------------------------------------------------------------------
export default function BetSlipPage() {
  const { betSlip, user } = useAppStore();
  const { pageBg, cardBorder, textMuted, divider, isDark } = useThemeTokens();
  const [activeTab, setActiveTab] = useState<'slip' | 'bets'>('slip');
  const { currency, loading: currencyLoading } = useCurrency();

  return (
    <>
      <style>{`
        @keyframes shimmer { from { background-position:200% 0; } to { background-position:-200% 0; } }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        html, body { overflow-x: hidden; }
        button { touch-action: manipulation; border-radius: 0 !important; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .cb-shell { width:100%; max-width: 480px; margin:0 auto; padding-left: 0; padding-right: 0; }
        @media (min-width: 640px)  { .cb-shell { max-width: 600px; } }
        @media (min-width: 1024px) { .cb-shell { max-width: 760px; } }
        @media (min-width: 1440px) { .cb-shell { max-width: 880px; } }
        @media (max-width: 360px) {
          .cb-shell { padding-left: 2px; padding-right: 2px; }
        }
      `}</style>

      <div style={{ minHeight:'100dvh', width:'100%', overflowX:'hidden', background:pageBg, paddingBottom:112 }}>
        {/* Sticky header — responsive shell */}
        <div style={{ position:'sticky', top:0, zIndex:40, background: isDark ? 'rgba(0,0,0,0.92)' : 'rgba(245,245,245,0.94)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:`1px solid ${divider}` }}>
          <div className="cb-shell">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px 0', flexWrap:'wrap', gap:4 }}>
              <span style={{ color: isDark ? '#f5f5f5' : '#111827' }}><BrandMark size={18} /></span>
              <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.1em', color:textMuted, textTransform:'uppercase' }}>Ticket Center</span>
            </div>
            <div style={{ display:'flex' }}>
              {([
                { key:'slip' as const, icon:<ReceiptLongIcon sx={{ fontSize:16 }} />, label:'Bet Slip', badge: betSlip.length > 0 ? betSlip.length : null },
                { key:'bets' as const, icon:<HistoryIcon sx={{ fontSize:16 }} />,     label:'My Bets',  badge:null },
              ]).map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'16px 4px', fontSize:13, fontWeight:900, border:'none', borderBottom:`2.5px solid ${isActive ? BRAND_PRIMARY : 'transparent'}`, color: isActive ? BRAND_PRIMARY : textMuted, background:'none', cursor:'pointer', transition:'color 150ms, border-color 150ms' }}>
                    {tab.icon}
                    {tab.label}
                    {tab.badge !== null && (
                      <span style={{ background:BRAND_PRIMARY, color:'#fff', fontSize:10, fontWeight:900, width:18, height:18, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                        {tab.badge}
                      </span>
                    )}
                    {tab.key === 'bets' && !user && (
                      <span style={{ fontSize:9, padding:'2px 6px', fontWeight:700, background: isDark ? 'rgba(148,163,184,0.10)' : 'rgba(17,24,39,0.06)', color:textMuted, border:`1px solid ${cardBorder}` }}>LOGIN</span>
                    )}
                  </button>
                );
              })}
            </div>

            {!currencyLoading && currency.code !== 'GHS' && (
              <div style={{ padding:'0 12px 10px', display:'flex', alignItems:'center', gap:6 }}>
                <PublicIcon sx={{ fontSize:11, color:BRAND_PRIMARY }} />
                <span style={{ fontSize:10, fontWeight:700, color:BRAND_PRIMARY, overflowWrap:'break-word' }}>
                  Prices in {currency.code} {currency.flag} · Min stake: {currency.symbol}{currency.minStake.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content — responsive shell */}
        <div className="cb-shell" style={{ padding:'16px 10px 0' }}>
          {activeTab === 'slip'
            ? <SlipTab   currency={currency} currencyLoading={currencyLoading} />
            : <MyBetsTab currency={currency} currencyLoading={currencyLoading} />
          }
        </div>
      </div>
    </>
  );
}
