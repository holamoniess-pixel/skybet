import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { useCountry } from '../hooks/useCountry';
import { getToken, getStoredUser } from '../utils/session';
import { SvgIconComponent } from '@mui/icons-material';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ExtensionIcon from '@mui/icons-material/Extension';
import SportsIcon from '@mui/icons-material/Sports';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CircularProgress from '@mui/icons-material/Loop';

// ── Types ─────────────────────────────────────────────────────────────────────
interface GameInstructions {
  objective: string;
  steps: string[];
  tip?: string;
}

interface ArcadeGame {
  slug: string;
  name: string;
  family: string;
  max_payout: string;
  desc: string;
  tagline: string;
  gradient: string;
  Icon: SvgIconComponent;
  instructions: GameInstructions;
}

type Tab = 'play' | 'how-to-play' | 'related';
type LoadState = 'loading' | 'loaded' | 'error';

// ── Game catalogue ────────────────────────────────────────────────────────────
const arcadeGames: ArcadeGame[] = [
  {
    slug: 'aviator',
    name: 'Aviator',
    family: 'crash',
    max_payout: '1000x',
    desc: 'Cash out before the crash. The longer you wait, the higher the multiplier.',
    tagline: "Don't let it fly away",
    gradient: 'linear-gradient(135deg,#E8003D 0%,#ff6b35 100%)',
    Icon: FlightTakeoffIcon,
    instructions: {
      objective: 'Cash out before the multiplier crashes to win up to 1000x your stake.',
      steps: [
        'Place your bet before the round starts',
        'Watch the multiplier increase in real-time',
        'Cash out at any time before the crash',
        "If you don't cash out in time, you lose your bet",
      ],
      tip: 'Try the 1.5x strategy: cash out at 1.5x consistently for steady wins.',
    },
  },
  {
    slug: 'sporty-jet',
    name: 'Sporty Jet',
    family: 'crash',
    max_payout: '750x',
    desc: 'High-speed crash game with sports-themed visuals and fast-paced action.',
    tagline: 'Speed meets strategy',
    gradient: 'linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)',
    Icon: RocketLaunchIcon,
    instructions: {
      objective: 'Navigate the jet and cash out before it crashes for up to 750x.',
      steps: [
        'Set your stake amount',
        'Watch the jet take off with increasing multiplier',
        'Cash out before the jet crashes',
        'Win big if you time it right',
      ],
      tip: 'Watch for patterns in crash points to improve your timing.',
    },
  },
  {
    slug: 'sporty-kick',
    name: 'Ball Crush',
    family: 'skill',
    max_payout: '500x',
    desc: 'Smash the ball with perfect timing in this explosive football-themed game.',
    tagline: 'Smash it before it smashes you',
    gradient: 'linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%)',
    Icon: SportsSoccerIcon,
    instructions: {
      objective: 'Time your crush perfectly to smash goals and win multipliers.',
      steps: [
        'Choose your stake amount',
        'Wait for the power bar to fill',
        'Click to crush at the perfect moment',
        'Smash goals to increase your multiplier',
      ],
      tip: 'Aim for the corners - they give higher multipliers!',
    },
  },
  {
    slug: 'spin-bottle',
    name: 'Spin & Win',
    family: 'classic',
    max_payout: '100x',
    desc: 'Classic spinning bottle game with exciting multipliers and bonuses.',
    tagline: 'Lady luck is on your side',
    gradient: 'linear-gradient(135deg,#ec4899 0%,#f43f5e 100%)',
    Icon: AutorenewIcon,
    instructions: {
      objective: 'Spin the bottle and win based on where it lands.',
      steps: [
        'Place your bet',
        'Spin the bottle',
        'Win based on the section it lands on',
        'Collect your winnings',
      ],
      tip: 'Look out for the golden section - it pays 100x!',
    },
  },
  {
    slug: 'mines',
    name: 'Mines',
    family: 'skill',
    max_payout: '1000x',
    desc: 'Navigate the minefield and find gems while avoiding explosive mines.',
    tagline: 'One wrong move and boom!',
    gradient: 'linear-gradient(135deg,#d97706 0%,#eab308 100%)',
    Icon: ExtensionIcon,
    instructions: {
      objective: 'Reveal gems without hitting mines to increase your multiplier.',
      steps: [
        'Choose grid size and number of mines',
        "Click squares to reveal what's underneath",
        'Cash out anytime with your current multiplier',
        'Avoid mines or lose everything',
      ],
      tip: 'Start with fewer mines to learn the game mechanics.',
    },
  },
  {
    slug: 'virtual-football',
    name: 'Virtual Football',
    family: 'virtual',
    max_payout: '200x',
    desc: 'Fast-paced virtual football matches with realistic odds and outcomes.',
    tagline: '90 seconds to glory',
    gradient: 'linear-gradient(135deg,#16a34a 0%,#10b981 100%)',
    Icon: SportsIcon,
    instructions: {
      objective: 'Bet on virtual football matches and win based on the outcome.',
      steps: [
        'Choose a virtual football match',
        'Place bets on 1X2, OU, BTTS markets',
        'Watch the 90-second compressed match',
        'Collect winnings based on match outcome',
      ],
      tip: 'Check the form guide before betting - some teams have better stats!',
    },
  },
  {
    slug: 'spaceman',
    name: 'Spaceman',
    family: 'crash',
    max_payout: '5000x',
    desc: 'Ride the spaceman into orbit and cash out before he drifts away.',
    tagline: 'To the moon, or nothing',
    gradient: 'linear-gradient(135deg,#1d4ed8 0%,#6366f1 100%)',
    Icon: RocketLaunchIcon,
    instructions: {
      objective: 'Cash out before the spaceman floats off for up to 5000x.',
      steps: [
        'Set your stake and place the bet',
        'The multiplier climbs as he ascends',
        'Cash out before he drifts out of frame',
        'Miss the window and the stake is lost',
      ],
      tip: 'Set an auto-cashout so a slow reaction never costs you a round.',
    },
  },
  {
    slug: 'lucky-slots',
    name: 'Lucky Slots',
    family: 'slots',
    max_payout: '2500x',
    desc: 'Classic three-reel slot with stacked wilds and a bonus round.',
    tagline: 'Pull it and see',
    gradient: 'linear-gradient(135deg,#f59e0b 0%,#ef4444 100%)',
    Icon: AutorenewIcon,
    instructions: {
      objective: 'Line up matching symbols across the payline to win.',
      steps: [
        'Choose your stake per spin',
        'Spin the reels',
        'Match three symbols on the payline',
        'Trigger the bonus round with three scatters',
      ],
      tip: 'Wilds substitute for everything except scatters.',
    },
  },
  {
    slug: 'fruit-frenzy',
    name: 'Fruit Frenzy',
    family: 'slots',
    max_payout: '1200x',
    desc: 'Fast fruit-machine action with cascading wins and multipliers.',
    tagline: 'Fresh picks, big wins',
    gradient: 'linear-gradient(135deg,#f97316 0%,#facc15 100%)',
    Icon: ExtensionIcon,
    instructions: {
      objective: 'Match fruit clusters to trigger cascading payouts.',
      steps: [
        'Set your stake',
        'Spin to drop the fruit grid',
        'Matches clear and new fruit cascades in',
        'Each cascade in a row raises the multiplier',
      ],
      tip: 'Cascades chain — a single spin can pay several times over.',
    },
  },
  {
    slug: 'magic-ball',
    name: 'Magic Ball',
    family: 'classic',
    max_payout: '900x',
    desc: 'Pick your numbers and watch the magic ball decide your fate.',
    tagline: 'Trust the ball',
    gradient: 'linear-gradient(135deg,#8b5cf6 0%,#d946ef 100%)',
    Icon: AutorenewIcon,
    instructions: {
      objective: 'Predict the drawn numbers to win up to 900x your stake.',
      steps: [
        'Pick your numbers on the grid',
        'Set your stake',
        'Watch the draw',
        'The more you match, the bigger the payout',
      ],
      tip: 'Fewer numbers picked means longer odds but a far bigger payout.',
    },
  },
];

const FAMILY_META: Record<string, { label: string; color: string }> = {
  crash:   { label: 'Crash Game',     color: '#E8003D' },
  classic: { label: 'Casino Classic', color: '#FFB300' },
  skill:   { label: 'Skill Game',     color: '#00D4FF' },
  virtual: { label: 'Virtual Sport',  color: '#00E676' },
  slots:   { label: 'Slot Machine',   color: '#FFB300' },
};

// ── IFRAME_GUARD_SCRIPT ───────────────────────────────────────────────────────
const IFRAME_GUARD_SCRIPT = `<script>
(function () {
  try {
    history.pushState    = function () {};
    history.replaceState = function () {};
  } catch (e) {}
  try {
    Object.defineProperty(window, 'top',    { get: function () { return window; }, configurable: true });
    Object.defineProperty(window, 'parent', { get: function () { return window; }, configurable: true });
  } catch (e) {}
  var _origPM = window.postMessage.bind(window);
  window.postMessage = function (message, targetOrigin, transfer) {
    try { _origPM(message, window.location.href || '/', transfer); }
    catch (e) { try { _origPM(message, '/', transfer); } catch (_) {} }
  };
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('a');
    if (el && (!el.target || el.target === '_top' || el.target === '_parent')) {
      el.target = '_blank';
    }
  }, true);
})();
<\/script>`;

// ── inlineAssets ──────────────────────────────────────────────────────────────
// The permanent fix: given the raw HTML string and the base URL it was fetched
// from, find every <link rel="stylesheet"> and <script src="…"> that points to
// a same-origin relative path, fetch each asset, and inline it as a <style> or
// <script> block.  Works for every game automatically — no build step needed.
async function inlineAssets(html: string, baseUrl: string): Promise<string> {
  // Resolve a potentially-relative href against the base URL
  const resolve = (href: string) => {
    try { return new URL(href, baseUrl).href; }
    catch { return null; }
  };

  // ── Inline CSS ──────────────────────────────────────────────────────────────
  // Match <link rel="stylesheet" href="…"> in any attribute order
  const linkRe = /<link\b([^>]*)>/gi;
  const cssJobs: Array<{ tag: string; url: string }> = [];

  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const attrs = m[1];
    // Must have rel="stylesheet" (or rel='stylesheet')
    if (!/\brel\s*=\s*["']stylesheet["']/i.test(attrs)) continue;
    // Extract href
    const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!hrefMatch) continue;
    const url = resolve(hrefMatch[1]);
    if (!url) continue;
    cssJobs.push({ tag: m[0], url });
  }

  for (const job of cssJobs) {
    try {
      const res = await fetch(job.url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      html = html.replace(job.tag, `<style>\n${text}\n</style>`);
      console.log(`[GameRunner] Inlined CSS: ${job.url}`);
    } catch (e) {
      console.warn(`[GameRunner] Could not inline CSS (${job.url}):`, e);
    }
  }

  // ── Inline JS ───────────────────────────────────────────────────────────────
  // Match <script src="…"> — skip external CDN scripts (different origin)
  const scriptRe = /<script\b([^>]*)><\/script>/gi;
  const jsJobs: Array<{ tag: string; url: string; attrs: string }> = [];

  while ((m = scriptRe.exec(html)) !== null) {
    const attrs = m[1];
    const srcMatch = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!srcMatch) continue;

    const rawSrc = srcMatch[1];
    const url    = resolve(rawSrc);
    if (!url) continue;

    // Skip scripts that are clearly external/CDN (different origin than game)
    const gameOrigin = new URL(baseUrl).origin;
    try {
      const scriptOrigin = new URL(url).origin;
      if (scriptOrigin !== gameOrigin && scriptOrigin !== window.location.origin) {
        // It's a CDN script — leave it as-is; srcdoc can still load external scripts
        continue;
      }
    } catch { continue; }

    jsJobs.push({ tag: m[0], url, attrs });
  }

  for (const job of jsJobs) {
    try {
      const res = await fetch(job.url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // Preserve any attributes other than src (e.g. type, defer)
      const cleanAttrs = job.attrs
        .replace(/\bsrc\s*=\s*["'][^"']*["']/i, '')
        .trim();
      html = html.replace(job.tag, `<script ${cleanAttrs}>\n${text}\n<\/script>`);
      console.log(`[GameRunner] Inlined JS: ${job.url}`);
    } catch (e) {
      console.warn(`[GameRunner] Could not inline JS (${job.url}):`, e);
    }
  }

  return html;
}

// ── SkyBet bridge injection ─────────────────────────────────────────────────
// The iframe is sandboxed WITHOUT allow-same-origin, so its origin is null and
// it cannot read the parent's localStorage. That's why the token/country can't
// simply be looked up inside the game: we serialise a boot payload into the
// document at injection time, then keep it live over postMessage.
export interface BridgeBoot {
  token: string | null;
  user: Record<string, unknown> | null;
  country: string;
  currency: string;
  symbol: string;
  locale: string;
  minStake: number;
  maxStake: number;
  stakeSteps: number[];
  guest: boolean;
  guestBalance: number;
}

function buildBridgeTag(boot: BridgeBoot, bridgeSource: string): string {
  // JSON.stringify then escape </script> so a stray sequence in a name or
  // email can't terminate the tag early.
  const payload = JSON.stringify(boot).replace(/<\/script/gi, '<\\/script');
  return (
    `<script>window.__SKYBET_BOOT__ = ${payload};<\/script>` +
    `<script>\n${bridgeSource}\n<\/script>`
  );
}

// ── sanitizeGameHtml ──────────────────────────────────────────────────────────
function sanitizeGameHtml(raw: string, bridgeTag: string): string {
  let html = raw;
  html = html.replace(
    /<base[^>]*target\s*=\s*["'](_top|_parent)["'][^>]*\/?>/gi,
    '',
  );
  // ORDER MATTERS: the bridge must run before the game's own script, because
  // every rewritten game.js now calls CB.sym() / CB.fmt() / CB.minStake() at
  // module scope. If the bridge landed after them, the game would throw
  // "CB is not defined" on the first paint.
  const injection = `$&<base target="_blank">${IFRAME_GUARD_SCRIPT}${bridgeTag}`;
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, injection);
  } else {
    html = `<base target="_blank">${IFRAME_GUARD_SCRIPT}${bridgeTag}` + html;
  }
  return html;
}

// ── useParentMessageFilter ────────────────────────────────────────────────────
function useParentMessageFilter() {
  useEffect(() => {
    function handle(e: MessageEvent) {
      if (e.origin === 'null' || e.origin === '') {
        e.stopImmediatePropagation();
      }
    }
    window.addEventListener('message', handle, true);
    return () => window.removeEventListener('message', handle, true);
  }, []);
}

// ── useGameDoc ────────────────────────────────────────────────────────────────
// Fetches the game's index.html, then automatically inlines all local CSS and
// JS assets so the srcdoc iframe is fully self-contained (origin: null safe).
function useGameDoc(slug: string, boot: BridgeBoot) {
  // The boot payload is captured ONCE per game load, on purpose. Later
  // country/session changes are pushed over postMessage instead of being
  // baked in again — re-deriving srcDoc would remount the iframe and throw
  // away a round in progress.
  const bootRef = useRef(boot);
  bootRef.current = boot;
  const [html, setHtml]         = useState<string | null>(null);
  const [state, setState]       = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setState('loading');
    setHtml(null);
    setErrorMsg('');

    const base    = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
    const gameUrl = `${base}/games/${slug}/index.html`;

    console.log(`[GameRunner] Fetching game: ${gameUrl}`);

    (async () => {
      try {
        // 1. Fetch the HTML
        const res = await fetch(gameUrl, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status} — Make sure the file exists at: public/games/${slug}/index.html`,
          );
        }
        const raw = await res.text();

        // 2. Inline all local CSS + JS assets (the permanent fix)
        //    We pass the absolute URL so relative hrefs resolve correctly.
        const absoluteGameUrl = new URL(gameUrl, window.location.href).href;
        const inlined = await inlineAssets(raw, absoluteGameUrl);

        // 2b. Fetch the shared SkyBet bridge and inline it too. Without
        //     this the game has no currency symbol, no token and no stake
        //     floor — CB would be undefined.
        let bridgeSource = '';
        try {
          const bRes = await fetch(`${base}/games/_skybet-bridge.js`, { cache: 'no-store' });
          if (bRes.ok) bridgeSource = await bRes.text();
          else console.warn('[GameRunner] bridge fetch failed:', bRes.status);
        } catch (e) {
          console.warn('[GameRunner] bridge fetch error:', e);
        }
        const bridgeTag = buildBridgeTag(bootRef.current, bridgeSource);

        // 3. Apply iframe guard / sanitization + bridge
        const patched = sanitizeGameHtml(inlined, bridgeTag);

        if (!cancelled) {
          setHtml(patched);
          setState('loaded');
          console.log(`[GameRunner] Game ready (fully self-contained): ${slug}`);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[GameRunner] Failed to load game "${slug}":`, msg);
          setErrorMsg(msg);
          setState('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  return { html, state, errorMsg };
}

// ── GameRunner ────────────────────────────────────────────────────────────────
export default function GameRunner() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const game = arcadeGames.find((g) => g.slug === slug);

  const [tab, setTab]             = useState<Tab>('play');
  const [howToOpen, setHowToOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { user, isGuest, guest, adjustGuestBalance } = useAppStore();
  const { country, fmt, minStake } = useCountry();

  useParentMessageFilter();

  /* ── Boot payload handed to the sandboxed game ────────────────────────
     Everything the game needs to render the right currency, enforce the
     right stake floor and talk to the API as the right user. */
  const boot: BridgeBoot = useMemo(() => ({
    token: getToken(),
    user: (getStoredUser() ?? null) as Record<string, unknown> | null,
    country: country.code,
    currency: country.currency,
    symbol: country.symbol,
    locale: country.locale,
    minStake: country.minStake,
    maxStake: country.maxStake,
    stakeSteps: country.stakeSteps,
    guest: isGuest,
    guestBalance: guest?.balance ?? 0,
  }), [country, isGuest, guest?.balance]);

  const { html, state, errorMsg } = useGameDoc(slug ?? '', boot);

  /* ── Live sync: country switch or login/logout without a remount ──────
     Rebuilding srcDoc would tear down the running game, so changes are
     pushed as a message the bridge applies in place. */
  useEffect(() => {
    if (state !== 'loaded') return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    // A tick of delay so the bridge has attached its listener.
    const t = setTimeout(() => {
      try {
        win.postMessage({ type: 'skybet:sync', payload: boot }, '*');
      } catch { /* sandbox refused — the baked-in boot payload still applies */ }
    }, 60);
    return () => clearTimeout(t);
  }, [boot, state]);

  /* ── Messages coming back out of the game ────────────────────────────── */
  const handleGameMessage = useCallback((e: MessageEvent) => {
    const d = e.data as { type?: string; delta?: number } | null;
    if (!d || typeof d.type !== 'string') return;
    if (d.type === 'skybet:request-login')   navigate('/login');
    if (d.type === 'skybet:request-deposit') navigate(user ? '/deposit' : '/join');
    if (d.type === 'skybet:guest-delta' && typeof d.delta === 'number') {
      adjustGuestBalance(d.delta);
    }
  }, [navigate, user, adjustGuestBalance]);

  useEffect(() => {
    window.addEventListener('message', handleGameMessage);
    return () => window.removeEventListener('message', handleGameMessage);
  }, [handleGameMessage]);

  useEffect(() => {
    setTab('play');
    setHowToOpen(false);
  }, [slug]);

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 text-center max-w-md">
          <h2 className="font-heading text-2xl font-bold mb-2">Game not found</h2>
          <p className="text-slate-500 mb-4 text-sm">
            The game <strong>{slug}</strong> doesn't exist yet.
          </p>
          <Link to="/casino" className="btn-primary inline-block px-6 py-2 rounded-lg">
            ← Back to Casino
          </Link>
        </div>
      </div>
    );
  }

  const familyMeta   = FAMILY_META[game.family] ?? { label: 'Game', color: '#888' };
  const relatedGames = arcadeGames.filter((g) => g.slug !== slug).slice(0, 4);
  const GameIcon     = game.Icon;

  const base    = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  const gameUrl = `${base}/games/${slug}/index.html`;

  return (
    <div className="min-h-screen">

      {/* ── Header banner ──────────────────────────────────────────────────── */}
      <div className="relative h-44 md:h-56 overflow-hidden" style={{ background: game.gradient }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/70" />
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <GameIcon sx={{ fontSize: 180 }} className="text-white" />
        </div>
        <div className="relative max-w-6xl mx-auto h-full px-4 md:px-8 flex flex-col justify-end pb-5">
          <Link
            to="/casino"
            className="text-xs text-white/70 hover:text-white mb-2 inline-flex items-center gap-1 self-start"
          >
            ← Casino
          </Link>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span
              className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded text-white"
              style={{ background: familyMeta.color }}
            >
              {familyMeta.label}
            </span>
            <span className="text-xs text-white/80">
              Max Win <span className="font-mono font-bold text-green-400">{game.max_payout}</span>
            </span>
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-white">{game.name}</h1>
          <p className="text-white/80 text-sm mt-1">{game.tagline}</p>
        </div>
      </div>

      {/* ── Tab nav ────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 dark:border-slate-700 sticky top-16 z-20 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex">
          {(
            [
              { key: 'play' as Tab,        label: '▶  Play' },
              { key: 'how-to-play' as Tab, label: '📖  How to Play' },
              { key: 'related' as Tab,     label: '🎮  Related' },
            ]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">

        {/* PLAY ──────────────────────────────────────────────────────────── */}
        {tab === 'play' && (
          <div className="space-y-4">

            {/* Collapsible quick rules */}
            <div className="card overflow-hidden">
              <button
                onClick={() => setHowToOpen(!howToOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500 text-base">ℹ</span>
                  <span className="font-medium text-sm">Quick Rules</span>
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    — tap to {howToOpen ? 'hide' : 'show'}
                  </span>
                </div>
                <span className="text-slate-400 text-xs">{howToOpen ? '▲' : '▼'}</span>
              </button>

              {howToOpen && (
                <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-3">
                  <p className="text-sm">{game.instructions.objective}</p>
                  <ol className="space-y-1.5">
                    {game.instructions.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <span
                          className="font-mono font-bold flex-shrink-0"
                          style={{ color: familyMeta.color }}
                        >
                          {i + 1}.
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  {game.instructions.tip && (
                    <div
                      className="px-3 py-2 rounded-lg border-l-4 text-xs text-slate-600 dark:text-slate-300"
                      style={{ borderColor: '#FFB300', background: 'rgba(255,179,0,0.06)' }}
                    >
                      💡 <strong className="text-yellow-500">Tip:</strong> {game.instructions.tip}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Game frame ─────────────────────────────────────────────────── */}
            <div
              className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative"
              style={{ height: 'calc(100vh - 360px)', minHeight: '560px' }}
            >
              {state === 'loading' && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                  style={{ background: game.gradient }}
                >
                  <CircularProgress className="text-white animate-spin" sx={{ fontSize: 36 }} />
                  <p className="text-white font-medium text-sm">Loading {game.name}...</p>
                </div>
              )}

              {state === 'error' && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6"
                  style={{ background: game.gradient }}
                >
                  <GameIcon className="text-white/50" sx={{ fontSize: 64 }} />
                  <p className="text-white font-semibold text-lg">Couldn't load {game.name}</p>
                  <div className="bg-black/40 rounded-xl p-4 max-w-sm w-full text-left space-y-2">
                    <p className="text-white/90 text-xs font-semibold uppercase tracking-wider mb-3">
                      Fix: Add the game file to your project
                    </p>
                    <p className="text-white/70 text-xs">1. Create this folder structure:</p>
                    <code className="block bg-black/50 text-green-400 text-xs px-3 py-2 rounded font-mono">
                      public/<br />
                      &nbsp;&nbsp;games/<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;{slug}/<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;index.html ← required<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;styles.css  ← auto-inlined<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;game.js     ← auto-inlined
                    </code>
                    <p className="text-white/70 text-xs mt-2">2. Fetch URL:</p>
                    <code className="block bg-black/50 text-yellow-300 text-xs px-3 py-2 rounded font-mono break-all">
                      {gameUrl}
                    </code>
                    {errorMsg && (
                      <p className="text-red-300 text-xs mt-1">{errorMsg}</p>
                    )}
                  </div>
                  <a
                    href={gameUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                    Try opening directly
                  </a>
                </div>
              )}

              {state === 'loaded' && html && (
                <iframe
                  key={slug}
                  ref={iframeRef}
                  title={game.name}
                  className="w-full h-full border-0 bg-black"
                  sandbox="allow-scripts allow-forms allow-popups allow-modals"
                  referrerPolicy="no-referrer"
                  srcDoc={html}
                />
              )}
            </div>

            <div className="flex items-center justify-between px-1 text-xs text-slate-400">
              <span>
                {isGuest
                  ? `👤 Guest mode · ${fmt(guest?.balance ?? 0)} play credits`
                  : user
                    ? `${country.flag} ${country.currency} · min stake ${fmt(minStake)}`
                    : '🔒 Sign in to play for real'}
              </span>
              <a
                href={gameUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <OpenInNewIcon sx={{ fontSize: 13 }} /> Open fullscreen
              </a>
            </div>
          </div>
        )}

        {/* HOW TO PLAY ───────────────────────────────────────────────────── */}
        {tab === 'how-to-play' && (
          <HowToPlayPanel game={game} familyMeta={familyMeta} onPlay={() => setTab('play')} />
        )}

        {/* RELATED ───────────────────────────────────────────────────────── */}
        {tab === 'related' && (
          <div>
            <h3 className="font-heading text-xl font-bold mb-4">More games like {game.name}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedGames.map((g) => {
                const RelIcon = g.Icon;
                return (
                  <Link
                    key={g.slug}
                    to={`/games/${g.slug}`}
                    className="group block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow"
                  >
                    <div
                      className="aspect-video flex items-center justify-center"
                      style={{ background: g.gradient }}
                    >
                      <RelIcon className="text-white/40" sx={{ fontSize: 40 }} />
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-800">
                      <div className="text-sm font-bold group-hover:text-primary transition-colors">
                        {g.name}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">{g.max_payout}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── HowToPlayPanel ────────────────────────────────────────────────────────────
function HowToPlayPanel({
  game,
  familyMeta,
  onPlay,
}: {
  game: ArcadeGame;
  familyMeta: { label: string; color: string };
  onPlay: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="card p-6 md:p-8">
        <div
          className="text-xs uppercase tracking-widest mb-2 font-semibold"
          style={{ color: familyMeta.color }}
        >
          How to Play
        </div>
        <h2 className="font-heading text-3xl font-bold mb-3">{game.name}</h2>
        <p className="text-slate-600 dark:text-slate-300">{game.instructions.objective}</p>
      </div>

      <div className="card p-6 md:p-8">
        <h3 className="font-heading text-lg font-bold mb-4">Step by Step</h3>
        <ol className="space-y-4">
          {game.instructions.steps.map((step, i) => (
            <li key={i} className="flex gap-4">
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm font-bold border"
                style={{
                  background: familyMeta.color + '22',
                  color: familyMeta.color,
                  borderColor: familyMeta.color + '55',
                }}
              >
                {i + 1}
              </div>
              <p className="text-slate-600 dark:text-slate-300 pt-1.5 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      {game.instructions.tip && (
        <div className="card p-6 flex gap-4 items-start">
          <span className="text-3xl">💡</span>
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold mb-1 text-yellow-500">
              Pro Tip
            </div>
            <p className="text-slate-600 dark:text-slate-300 italic">{game.instructions.tip}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Max Win', value: game.max_payout, color: '#00E676' },
          { label: 'Type',    value: familyMeta.label, color: 'inherit' },
          { label: 'RTP',     value: '~97%',           color: 'inherit' },
        ].map((stat) => (
          <div key={stat.label} className="card p-4 text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{stat.label}</div>
            <div className="font-mono font-bold text-lg" style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <button onClick={onPlay} className="btn-primary w-full py-3 rounded-xl font-semibold text-base">
        ▶ Start Playing
      </button>
    </div>
  );
}