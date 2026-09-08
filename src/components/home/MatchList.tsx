// ---------------------------------------------------------------------------
// MatchList — WinBet dark theme (header-matched blue palette)
// UPDATED (this pass):
//   • Match of the Day: mobile layout fixed — Team A vs Team B now renders
//     as one horizontal row (teams-row wrapper), with the odds panel
//     stacked directly underneath on small screens.
//   • REMOVED the old "Special Games" section that mixed admin matches with
//     World Cup / country matches. Only ONE featured section remains now:
//     "Highlights" — and it shows ONLY admin/special-game matches (never
//     World Cup / country fixtures).
//   • World Cup / country matches are no longer pulled out of the main
//     match list — they now flow normally into Live / Next 3 Days /
//     Upcoming, just like any other match.
//   • Highlights section now also shows a featured "Team to Win" pick —
//     a randomly (day-seeded) selected admin match with its favorite team
//     and that team's odds to win, e.g. "France to win — 1.85".
//   • World Cup detection is still COUNTRY-BASED (both teams recognized
//     countries via COUNTRY_ISO2) and still used for flags + Match of the
//     Day eligibility.
//   • Country flags still render for ANY country-vs-country match in the
//     compact list rows and Match of the Day.
//   • Each match row (CompactMatchRow) still shows the match DATE (Today /
//     Yesterday / "12 Jul") directly above the kickoff time.
//   • Main match list groups into "Next 3 Days", "Upcoming (After 3 Days)",
//     and "Recent Results" (finished games last).
//   • Admin match fetching/polling/hide-after-finish logic lives in the
//     shared `useAdminMatches` hook, feeding Highlights AND Match of the Day.
//   • FloatingBetSlipButton is rendered through a React Portal straight
//     into document.body, and uses real CSS :hover/:active instead of inline
//     JS style mutation.
//   • ODDS GATE REMOVED: matches never hidden for lacking real odds —
//     synthetic odds are generated deterministically.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store';
import api from '../../utils/api';
import referBannerImg from '../../assests/image5.png';
import type { Match } from '../../utils/api';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import LockIcon from '@mui/icons-material/Lock';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import StarIcon from '@mui/icons-material/Star';
import BoltIcon from '@mui/icons-material/Bolt';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useCountry } from '../../hooks/useCountry';

// ---------------------------------------------------------------------------
// BACKEND BASE URL
// ---------------------------------------------------------------------------
const ADMIN_MATCHES_BASE = 'https://futballbackend-production-b1a0.up.railway.app';

// ---------------------------------------------------------------------------
// COUNTRY FLAG HELPER
// ---------------------------------------------------------------------------
const COUNTRY_ISO2: Record<string, string> = {
  'Algeria': 'dz', 'Angola': 'ao', 'Benin': 'bj', 'Burkina Faso': 'bf',
  'Cameroon': 'cm', 'Cape Verde': 'cv', 'Central African Republic': 'cf',
  'Chad': 'td', "Côte d'Ivoire": 'ci', 'Ivory Coast': 'ci',
  'DR Congo': 'cd', 'Egypt': 'eg', 'Equatorial Guinea': 'gq',
  'Ethiopia': 'et', 'Gabon': 'ga', 'Gambia': 'gm', 'Ghana': 'gh',
  'Guinea': 'gn', 'Guinea-Bissau': 'gw', 'Kenya': 'ke', 'Liberia': 'lr',
  'Libya': 'ly', 'Madagascar': 'mg', 'Malawi': 'mw', 'Mali': 'ml',
  'Mauritania': 'mr', 'Mauritius': 'mu', 'Morocco': 'ma',
  'Mozambique': 'mz', 'Namibia': 'na', 'Niger': 'ne', 'Nigeria': 'ng',
  'Rwanda': 'rw', 'Senegal': 'sn', 'Sierra Leone': 'sl', 'Somalia': 'so',
  'South Africa': 'za', 'Sudan': 'sd', 'Tanzania': 'tz', 'Togo': 'tg',
  'Tunisia': 'tn', 'Uganda': 'ug', 'Zambia': 'zm', 'Zimbabwe': 'zw',
  'Argentina': 'ar', 'Bolivia': 'bo', 'Brazil': 'br', 'Canada': 'ca',
  'Chile': 'cl', 'Colombia': 'co', 'Costa Rica': 'cr', 'Cuba': 'cu',
  'Dominican Republic': 'do', 'Ecuador': 'ec', 'El Salvador': 'sv',
  'Guatemala': 'gt', 'Haiti': 'ht', 'Honduras': 'hn', 'Jamaica': 'jm',
  'Mexico': 'mx', 'Nicaragua': 'ni', 'Panama': 'pa', 'Paraguay': 'py',
  'Peru': 'pe', 'Puerto Rico': 'pr', 'Trinidad and Tobago': 'tt',
  'United States': 'us', 'USA': 'us', 'Uruguay': 'uy', 'Venezuela': 've',
  'Afghanistan': 'af', 'Australia': 'au', 'Bahrain': 'bh',
  'Bangladesh': 'bd', 'China': 'cn', 'Hong Kong': 'hk', 'India': 'in',
  'Indonesia': 'id', 'Iran': 'ir', 'Iraq': 'iq', 'Israel': 'il',
  'Japan': 'jp', 'Jordan': 'jo', 'Kazakhstan': 'kz', 'Kuwait': 'kw',
  'Lebanon': 'lb', 'Malaysia': 'my', 'Maldives': 'mv', 'Myanmar': 'mm',
  'Nepal': 'np', 'New Zealand': 'nz', 'North Korea': 'kp', 'Oman': 'om',
  'Pakistan': 'pk', 'Palestine': 'ps', 'Philippines': 'ph', 'Qatar': 'qa',
  'Saudi Arabia': 'sa', 'Singapore': 'sg', 'South Korea': 'kr',
  'Sri Lanka': 'lk', 'Syria': 'sy', 'Taiwan': 'tw', 'Thailand': 'th',
  'Turkey': 'tr', 'UAE': 'ae', 'United Arab Emirates': 'ae',
  'Uzbekistan': 'uz', 'Vietnam': 'vn', 'Yemen': 'ye',
  'Albania': 'al', 'Andorra': 'ad', 'Armenia': 'am', 'Austria': 'at',
  'Azerbaijan': 'az', 'Belarus': 'by', 'Belgium': 'be',
  'Bosnia and Herzegovina': 'ba', 'Bulgaria': 'bg', 'Croatia': 'hr',
  'Cyprus': 'cy', 'Czech Republic': 'cz', 'Czechia': 'cz', 'Denmark': 'dk',
  'England': 'gb-eng', 'Estonia': 'ee', 'Finland': 'fi', 'France': 'fr',
  'Georgia': 'ge', 'Germany': 'de', 'Greece': 'gr', 'Hungary': 'hu',
  'Iceland': 'is', 'Ireland': 'ie', 'Italy': 'it', 'Kosovo': 'xk',
  'Latvia': 'lv', 'Liechtenstein': 'li', 'Lithuania': 'lt',
  'Luxembourg': 'lu', 'Malta': 'mt', 'Moldova': 'md', 'Monaco': 'mc',
  'Montenegro': 'me', 'Netherlands': 'nl', 'North Macedonia': 'mk',
  'Norway': 'no', 'Poland': 'pl', 'Portugal': 'pt', 'Romania': 'ro',
  'Russia': 'ru', 'San Marino': 'sm', 'Scotland': 'gb-sct',
  'Serbia': 'rs', 'Slovakia': 'sk', 'Slovenia': 'si', 'Spain': 'es',
  'Sweden': 'se', 'Switzerland': 'ch', 'Ukraine': 'ua',
  'United Kingdom': 'gb', 'Wales': 'gb-wls',
  'Fiji': 'fj', 'Papua New Guinea': 'pg', 'Samoa': 'ws',
};

function getCountryFlagUrl(countryName: string): string {
  const iso = COUNTRY_ISO2[countryName];
  if (!iso) return '';
  return `https://flagcdn.com/w80/${iso}.png`;
}

// ---------------------------------------------------------------------------
// COUNTRY / WORLD-CUP MATCH DETECTION
// A match is treated as a World Cup / international fixture whenever BOTH
// the home team and away team names are recognized countries in
// COUNTRY_ISO2 — regardless of what the `league` field on the raw match
// data says. Used for flags + Match of the Day eligibility only — NOT for
// the Highlights section anymore (that's admin-only).
// ---------------------------------------------------------------------------
function isCountryTeamName(name: string | undefined | null): boolean {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return false;
  return Object.prototype.hasOwnProperty.call(COUNTRY_ISO2, trimmed);
}

function isWorldCupCountryMatch(m: { homeTeam?: string; awayTeam?: string }): boolean {
  return isCountryTeamName(m.homeTeam) && isCountryTeamName(m.awayTeam);
}

// ---------------------------------------------------------------------------
// ADMIN LOGO POOLS
// ---------------------------------------------------------------------------
const HOME_LOGO_POOL: string[] = [
  'https://static.vecteezy.com/system/resources/thumbnails/011/049/345/small_2x/soccer-football-badge-logo-sport-team-identity-illustrations-isolated-on-white-background-vector.jpg',
  'https://marketplace.canva.com/EAGXHkfvP0k/2/0/1600w/canva-white-and-black-professional-design-football-club-logo-_0PEzCBc5Ao.jpg',
  'https://img.magnific.com/premium-vector/soccer-football-badge-logo-design-templates-sport-team-identity-vector-illustrations_683941-173.jpg',
  'https://marketplace.canva.com/EAFnwIBf4dU/2/0/1600w/canva-black-white-yellow-elegant-modern-football-club-logo-8HTQhmXBF18.jpg',
  'https://static.vecteezy.com/system/resources/previews/035/358/256/non_2x/football-club-logo-vector.jpg',
];

const AWAY_LOGO_POOL: string[] = [
  'https://marketplace.canva.com/EAF9gkRs2dU/2/0/1600w/canva-white-black-gold-circle-modern-football-club-logo-8y4rT2SOMu0.jpg',
  'https://logowik.com/content/uploads/images/football-club2744.logowik.com.webp',
  'https://img.freepik.com/free-vector/football-soccer-tournament-vector-logo-design_47987-24746.jpg?semt=ais_hybrid&w=740&q=80',
  'https://static.vecteezy.com/system/resources/thumbnails/012/995/442/small/football-championship-or-football-club-logo-vector.jpg',
  'https://d1csarkz8obe9u.cloudfront.net/posterpreviews/logo-design-template-b588de7cc0b07e82392c3b2ea4ea7b73_screen.jpg?ts=1702915331',
];

// ---------------------------------------------------------------------------
// POPULAR LEAGUES — HARDCODED (top 20 domestic leagues + major competitions)
// ---------------------------------------------------------------------------
const HARDCODED_POPULAR_LEAGUES: string[] = [
  'Premier League',
  'La Liga',
  'Bundesliga',
  'Serie A',
  'Ligue 1',
  'Eredivisie',
  'Primeira Liga',
  'Süper Lig',
  'Scottish Premiership',
  'Belgian Pro League',
  'MLS',
  'Brasileirão',
  'Argentine Primera División',
  'UEFA Champions League',
  'UEFA Europa League',
  'UEFA Conference League',
  'UEFA Nations League',
  'UEFA Euros',
  'FIFA World Cup',
  'Copa América',
];

interface HardcodedLeague {
  name: string;
  count: number;
}

// ---------------------------------------------------------------------------
// FlagImage
// ---------------------------------------------------------------------------
function FlagImage({ country, size = 56 }: { country: string; size?: number }) {
  const url = getCountryFlagUrl(country);
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    const initials = country.slice(0, 2).toUpperCase();
    return (
      <div style={{
        width: size, height: Math.round(size * 0.67),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.22), fontWeight: 800,
        color: '#9ca3af', fontFamily: 'system-ui, sans-serif',
        flexShrink: 0,
      }}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={country}
      width={size}
      height={Math.round(size * 0.67)}
      onError={() => setFailed(true)}
      style={{
        objectFit: 'cover', display: 'block',
        flexShrink: 0,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// TeamLogoImage — used for admin/special-game teams in Match of the Day
// (club-style logos instead of country flags)
// ---------------------------------------------------------------------------
function TeamLogoImage({ src, alt, size = 72 }: { src?: string; alt: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    const initials = alt.slice(0, 2).toUpperCase();
    return (
      <div style={{
        width: size, height: Math.round(size * 0.67),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.22), fontWeight: 800,
        color: '#9ca3af', fontFamily: 'system-ui, sans-serif',
        flexShrink: 0,
      }}>
        {initials}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      style={{
        width: size, height: Math.round(size * 0.67),
        objectFit: 'contain', display: 'block',
        flexShrink: 0,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// MatchOfTheDaySkeleton — shown while real matches are still loading
// ---------------------------------------------------------------------------
function MatchOfTheDaySkeleton() {
  return (
    <div className="motd-wrap">
      <div className="motd-eyebrow">
        <div className="motd-eyebrow-left">
          <StarIcon sx={{ fontSize: 12, color: '#facc15' }} />
          <span className="motd-eyebrow-label">MATCH OF THE DAY</span>
        </div>
      </div>
      <div className="motd-body motd-fade-in">
        <div className="motd-teams-row">
          <div className="motd-team-col motd-home-col">
            <div className="skeleton-block" style={{ width: 72, height: 48, borderRadius: 4 }} />
            <div className="skeleton-block" style={{ width: 60, height: 12, borderRadius: 4 }} />
          </div>
          <div className="motd-vs-col">
            <span className="motd-vs-text" style={{ opacity: 0.3 }}>VS</span>
          </div>
          <div className="motd-team-col motd-away-col">
            <div className="skeleton-block" style={{ width: 72, height: 48, borderRadius: 4 }} />
            <div className="skeleton-block" style={{ width: 60, height: 12, borderRadius: 4 }} />
          </div>
        </div>
        <div className="motd-odds-panel">
          <div className="motd-odds-row">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-block" style={{ flex: 1, height: 44, borderRadius: 6 }} />
            ))}
          </div>
        </div>
      </div>
      <style>{`
        .motd-wrap { width: 100%; margin-bottom: 16px; border-radius: 10px; overflow: hidden; border: 1.5px solid rgba(59, 130, 246,0.2); background: #0d1f3c; box-shadow: 0 4px 24px rgba(0,0,0,0.5); box-sizing: border-box; }
        .motd-eyebrow { display: flex; align-items: center; justify-content: space-between; padding: 7px 12px 6px; background: rgba(59, 130, 246,0.06); border-bottom: 1px solid rgba(59, 130, 246,0.12); }
        .motd-eyebrow-left { display: flex; align-items: center; gap: 5px; }
        .motd-eyebrow-label { font-size: 10px; font-weight: 900; color: #facc15; letter-spacing: 0.08em; font-family: system-ui, sans-serif; text-transform: uppercase; }
        .motd-body { display: flex; align-items: center; gap: 14px; padding: 18px 16px 18px 20px; }
        .motd-teams-row { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
        .motd-team-col { display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0; width: 90px; }
        .motd-vs-col { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; flex: 1; }
        .motd-vs-text { font-size: 22px; font-weight: 900; color: #3b82f6; font-family: system-ui, sans-serif; letter-spacing: 0.06em; }
        .motd-odds-panel { flex-shrink: 0; width: 260px; max-width: 100%; }
        .motd-odds-row { display: flex; gap: 6px; }
        @media (max-width: 700px) {
          .motd-body { flex-direction: column; align-items: stretch; }
          .motd-odds-panel { width: 100%; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// deriveFeaturedMatches — Match of the Day rotation is STRICTLY:
//   1) Real World Cup / country-vs-country matches (both teams are
//      countries — shown with country flags), and
//   2) Admin / Special-Game matches (shown with their assigned logos).
// No other league is ever eligible, and there is NO fallback to "any match"
// — if neither source has an eligible match, the caller renders nothing.
// ---------------------------------------------------------------------------
function deriveFeaturedMatches(matches: EnrichedMatch[], adminMatches: EnrichedMatch[]): EnrichedMatch[] {
  const byKickoff = (a: EnrichedMatch, b: EnrichedMatch) => {
    const ta = a.kickoffAt ? new Date(a.kickoffAt).getTime() : Number.POSITIVE_INFINITY;
    const tb = b.kickoffAt ? new Date(b.kickoffAt).getTime() : Number.POSITIVE_INFINITY;
    return ta - tb;
  };

  const worldCupMatches = matches.filter(
    (m) => !FINISHED_STATUSES.has(m.status ?? '') && isWorldCupCountryMatch(m),
  );
  const eligibleAdminMatches = adminMatches.filter((m) => !FINISHED_STATUSES.has(m.status ?? ''));

  // Admin/special games first, then World Cup / country fixtures, both
  // sorted by kickoff.
  const combined = [...eligibleAdminMatches.sort(byKickoff), ...worldCupMatches.sort(byKickoff)];
  return combined.slice(0, 8);
}

// ---------------------------------------------------------------------------
// MatchOfTheDayCard — driven ONLY by real World Cup / country matches +
// admin matches. Mobile layout: teams-row (Team A vs Team B) renders as one
// horizontal row, odds panel stacks directly underneath.
// ---------------------------------------------------------------------------
function MatchOfTheDayCard({
  matches, adminMatches, loading,
}: {
  matches: EnrichedMatch[]; adminMatches: EnrichedMatch[]; loading: boolean;
}) {
  const navigate = useNavigate();
  const { betSlip, addToBetSlip, showToast } = useAppStore() as {
    betSlip: { matchId: string; market: string; selection: string }[];
    addToBetSlip: (e: { matchId: string; matchName: string; market: string; selection: string; odd: number }) => void;
    showToast: (m: string, t: string) => void;
  };

  const featuredMatches = useMemo(() => deriveFeaturedMatches(matches, adminMatches), [matches, adminMatches]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (featuredMatches.length === 0) { setCurrentIdx(0); return; }
    if (currentIdx >= featuredMatches.length) setCurrentIdx(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredMatches.length]);

  useEffect(() => {
    if (featuredMatches.length <= 1) return;
    const id = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setCurrentIdx((prev) => (prev + 1) % featuredMatches.length);
        setAnimating(false);
      }, 300);
    }, 30_000);
    return () => clearInterval(id);
  }, [featuredMatches.length]);

  // Nothing eligible (no World Cup / country matches, no admin matches):
  // show nothing, except while the very first load is still in flight
  // (skeleton).
  if (featuredMatches.length === 0) {
    return loading ? <MatchOfTheDaySkeleton /> : null;
  }

  const featured = featuredMatches[currentIdx] ?? featuredMatches[0];
  const isAdminFeatured = featured.source === 'ADMIN_CREATED';
  const matchName = `${featured.homeTeam} vs ${featured.awayTeam}`;
  const isBoosted = isAdminFeatured || CUPS_LABELS.has(featured.league ?? '') || TOP_6_LEAGUE_DISPLAY_NAMES.includes(featured.league ?? '');

  const isSel = (sel: string) =>
    betSlip.some((s) => s.matchId === featured.id && s.market === '1X2' && s.selection === sel);

  const pick = (sel: string, odd: number) => {
    if (!odd || odd <= 0) return;
    addToBetSlip({ matchId: featured.id, matchName, market: '1X2', selection: sel, odd });
    showToast('Added to bet slip', 'success');
  };

  const goTo = (dir: 1 | -1) => {
    setAnimating(true);
    setTimeout(() => {
      setCurrentIdx((prev) => (prev + dir + featuredMatches.length) % featuredMatches.length);
      setAnimating(false);
    }, 250);
  };

  const oddsSlots = [
    { key: '1', label: featured.homeTeam, val: featured.oddsMap?.home ?? 0 },
    { key: 'X', label: 'Draw',            val: featured.oddsMap?.draw ?? 0 },
    { key: '2', label: featured.awayTeam, val: featured.oddsMap?.away ?? 0 },
  ];

  const eyebrowLabel = isAdminFeatured
    ? 'SPECIAL GAME'
    : (featured.league || 'FIFA WORLD CUP').toUpperCase();

  return (
    <div className="motd-wrap">
      <div className="motd-eyebrow">
        <div className="motd-eyebrow-left">
          <StarIcon sx={{ fontSize: 12, color: '#facc15' }} />
          <span className="motd-eyebrow-label">MATCH OF THE DAY</span>
          <span className="motd-eyebrow-sep">·</span>
          <span className="motd-eyebrow-comp">{eyebrowLabel}</span>
        </div>
        <div className="motd-nav">
          <button className="motd-nav-btn" onClick={() => goTo(-1)} aria-label="Previous">‹</button>
          <span className="motd-dots">
            {featuredMatches.map((_, i) => (
              <span
                key={i}
                className={`motd-dot${i === currentIdx ? ' active' : ''}`}
                onClick={() => { setAnimating(true); setTimeout(() => { setCurrentIdx(i); setAnimating(false); }, 250); }}
              />
            ))}
          </span>
          <button className="motd-nav-btn" onClick={() => goTo(1)} aria-label="Next">›</button>
        </div>
      </div>

      <div className={`motd-body${animating ? ' motd-fade-out' : ' motd-fade-in'}`}>
        <div className="motd-teams-row">
          <div className="motd-team-col motd-home-col">
            {isAdminFeatured ? (
              <TeamLogoImage src={featured.adminHomeLogo} alt={featured.homeTeam} size={72} />
            ) : (
              <FlagImage country={featured.homeTeam} size={72} />
            )}
            <span className="motd-team-name">{featured.homeTeam}</span>
          </div>

          <div className="motd-vs-col">
            <span className="motd-vs-text">VS</span>
            <span className="motd-kickoff-date">{featured.kickoffAt ? formatMatchDate(featured.kickoffAt) : ''}</span>
            <span className="motd-kickoff">{featured.kickoffAt ? formatKickoff(featured.kickoffAt) : '--:--'}</span>
          </div>

          <div className="motd-team-col motd-away-col">
            {isAdminFeatured ? (
              <TeamLogoImage src={featured.adminAwayLogo} alt={featured.awayTeam} size={72} />
            ) : (
              <FlagImage country={featured.awayTeam} size={72} />
            )}
            <span className="motd-team-name">{featured.awayTeam}</span>
          </div>
        </div>

        <div className="motd-odds-panel">
          <div className="motd-odds-hdr">
            <span className="motd-odds-label">MATCH WINNER</span>
            {isBoosted && (
              <span className="motd-boosted-badge">
                <BoltIcon sx={{ fontSize: 10, color: '#fff' }} />
                BOOSTED
              </span>
            )}
          </div>
          <div className="motd-odds-row">
            {oddsSlots.map(({ key, label, val }) => (
              <button
                key={key}
                className={`motd-odd-btn${isSel(key) ? ' sel' : ''}${val <= 0 ? ' empty' : ''}`}
                onClick={() => pick(key, val)}
                disabled={val <= 0}
              >
                <span className="motd-odd-team">{label}</span>
                <span className="motd-odd-val">{val > 0 ? val.toFixed(2) : '—'}</span>
              </button>
            ))}
          </div>
          <div className="motd-provider">Market via Blaziq</div>
          <button className="motd-all-markets" onClick={() => navigate(`/match/${featured.id}`)}>ALL MARKETS ›</button>
        </div>
      </div>

      <style>{`
        .motd-wrap {
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 16px; border-radius: 10px; overflow: hidden;
          border: 1.5px solid rgba(59, 130, 246,0.2); background: #0d1f3c;
          box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        }
        .motd-eyebrow {
          display: flex; align-items: center; justify-content: space-between;
          padding: 7px 12px 6px; background: rgba(59, 130, 246,0.06);
          border-bottom: 1px solid rgba(59, 130, 246,0.12);
          flex-wrap: wrap; row-gap: 4px; gap: 8px;
        }
        .motd-eyebrow-left { display: flex; align-items: center; gap: 5px; min-width: 0; }
        .motd-eyebrow-label { font-size: 10px; font-weight: 900; color: #facc15; letter-spacing: 0.08em; font-family: system-ui, sans-serif; text-transform: uppercase; white-space: nowrap; }
        .motd-eyebrow-sep { color: rgba(255,255,255,0.15); font-size: 11px; }
        .motd-eyebrow-comp { font-size: 10px; font-weight: 700; color: #6b7280; letter-spacing: 0.06em; font-family: system-ui, sans-serif; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
        .motd-nav { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
        .motd-nav-btn { background: rgba(59, 130, 246,0.1); border: 1px solid rgba(59, 130, 246,0.2); color: #60a5fa; font-size: 15px; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.12s, color 0.12s; font-family: system-ui, sans-serif; }
        .motd-nav-btn:hover { background: rgba(59, 130, 246,0.2); color: #bfdbfe; }
        .motd-dots { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; max-width: 90px; justify-content: center; }
        .motd-dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.12); cursor: pointer; transition: background 0.15s, transform 0.15s; }
        .motd-dot.active { background: #3b82f6; transform: scale(1.35); }

        .motd-body { display: flex; align-items: center; gap: 16px; padding: 18px 16px; transition: opacity 0.25s ease, transform 0.25s ease; box-sizing: border-box; width: 100%; }
        .motd-fade-in  { opacity: 1; transform: translateX(0); }
        .motd-fade-out { opacity: 0; transform: translateX(-8px); }

        /* Team A / VS / Team B always render as one horizontal row */
        .motd-teams-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex: 1; min-width: 0; }
        .motd-team-col { display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0; width: 90px; min-width: 0; }
        .motd-team-name { font-size: 13px; font-weight: 800; color: #f1f5f9; font-family: system-ui, sans-serif; letter-spacing: 0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .motd-vs-col { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; flex-shrink: 0; padding: 0 6px; }
        .motd-vs-text { font-size: 22px; font-weight: 900; color: #3b82f6; font-family: system-ui, sans-serif; letter-spacing: 0.06em; }
        .motd-kickoff-date { font-size: 10px; font-weight: 700; color: #4b5563; font-family: system-ui, sans-serif; letter-spacing: 0.03em; white-space: nowrap; text-transform: uppercase; }
        .motd-kickoff { font-size: 11px; font-weight: 700; color: #6b7280; font-family: system-ui, sans-serif; letter-spacing: 0.02em; white-space: nowrap; }

        .motd-odds-panel { flex-shrink: 0; width: 260px; max-width: 100%; display: flex; flex-direction: column; gap: 9px; box-sizing: border-box; }
        .motd-odds-hdr { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .motd-odds-label { font-size: 9px; font-weight: 800; color: #6b7280; letter-spacing: 0.1em; text-transform: uppercase; font-family: system-ui, sans-serif; white-space: nowrap; }
        .motd-boosted-badge { display: inline-flex; align-items: center; gap: 3px; background: #1d4ed8; color: #fff; font-size: 9px; font-weight: 900; border-radius: 4px; padding: 3px 7px; letter-spacing: 0.06em; font-family: system-ui, sans-serif; white-space: nowrap; flex-shrink: 0; }
        .motd-odds-row { display: flex; flex-wrap: nowrap; gap: 6px; }
        .motd-odd-btn { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 9px 4px 8px; border-radius: 6px; border: 1.5px solid rgba(59, 130, 246,0.2); background: rgba(59, 130, 246,0.06); cursor: pointer; transition: background 0.12s, border-color 0.12s, transform 0.08s; -webkit-tap-highlight-color: transparent; }
        .motd-odd-btn:hover:not(.sel):not(.empty) { background: rgba(59, 130, 246,0.14); border-color: rgba(59, 130, 246,0.5); }
        .motd-odd-btn:active { transform: scale(0.96); }
        .motd-odd-btn.sel { background: rgba(59, 130, 246,0.2); border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246,0.2); }
        .motd-odd-btn.empty { opacity: 0.35; cursor: default; }
        .motd-odd-team { font-size: 10px; font-weight: 600; color: #9ca3af; font-family: system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; text-align: center; }
        .motd-odd-val { font-size: 18px; font-weight: 900; color: #f1f5f9; font-family: system-ui, sans-serif; letter-spacing: -0.01em; }
        .motd-odd-btn.sel .motd-odd-val  { color: #60a5fa; }
        .motd-odd-btn.sel .motd-odd-team { color: rgba(96, 165, 250,0.8); }
        .motd-provider { font-size: 10px; color: #374151; font-family: system-ui, sans-serif; text-align: right; }
        .motd-all-markets { width: 100%; padding: 10px; background: rgba(59, 130, 246,0.08); border: 1.5px solid rgba(59, 130, 246,0.25); border-radius: 6px; color: #60a5fa; font-size: 11px; font-weight: 800; letter-spacing: 0.07em; cursor: pointer; font-family: system-ui, sans-serif; transition: background 0.12s, border-color 0.12s; -webkit-tap-highlight-color: transparent; }
        .motd-all-markets:hover { background: rgba(59, 130, 246,0.16); border-color: rgba(59, 130, 246,0.5); }

        /* ---- Mobile: teams-row stays horizontal, odds stack underneath ---- */
        @media (max-width: 700px) {
          .motd-body { flex-direction: column; align-items: stretch; gap: 12px; padding: 14px 12px; }
          .motd-teams-row { width: 100%; }
          .motd-team-col { width: 30%; min-width: 56px; }
          .motd-odds-panel { width: 100%; max-width: 100%; }
        }
        @media (max-width: 480px) {
          .motd-eyebrow { padding: 6px 10px 6px; }
          .motd-eyebrow-label { font-size: 9px; }
          .motd-eyebrow-comp { max-width: 80px; font-size: 8px; }
          .motd-body { padding: 10px 8px; gap: 10px; }
          .motd-team-col { min-width: 48px; }
          .motd-team-name { font-size: 10px; }
          .motd-vs-text { font-size: 15px; }
          .motd-kickoff-date { font-size: 8px; }
          .motd-kickoff { font-size: 9px; }
          .motd-odd-btn { min-width: 0; padding: 6px 2px; }
          .motd-odd-val { font-size: 13px; }
          .motd-odd-team { font-size: 8px; }
          .motd-all-markets { font-size: 9px; padding: 8px; }
          .motd-nav-btn { width: 18px; height: 18px; font-size: 13px; }
          .motd-dot { width: 4px; height: 4px; }
          .motd-dots { max-width: 60px; }
          .motd-boosted-badge { font-size: 7px; padding: 2px 5px; }
          .motd-odds-label { font-size: 7px; }
        }
        @media (max-width: 360px) {
          .motd-team-col { min-width: 40px; }
          .motd-team-name { font-size: 8px; }
          .motd-vs-text { font-size: 13px; }
          .motd-odd-val { font-size: 11px; }
          .motd-odd-team { font-size: 7px; }
          .motd-nav-btn { width: 16px; height: 16px; font-size: 11px; }
          .motd-dot { width: 3px; height: 3px; }
          .motd-dots { max-width: 40px; gap: 2px; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// deriveLeagueCounts — HARDCODED league list, LIVE counts
// ---------------------------------------------------------------------------
function deriveLeagueCounts(matches: EnrichedMatch[]): HardcodedLeague[] {
  const counts = new Map<string, number>();
  for (const m of matches) {
    if (FINISHED_STATUSES.has(m.status ?? '')) continue;
    const league = (m.league ?? '').trim();
    if (!league) continue;
    counts.set(league, (counts.get(league) ?? 0) + 1);
  }
  return HARDCODED_POPULAR_LEAGUES.map((name) => ({
    name,
    count: counts.get(name) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// PopularLeaguesSidebar
// ---------------------------------------------------------------------------
function PopularLeaguesSidebar({
  activeLeague,
  onSelect,
  totalCount,
  leagues,
}: {
  activeLeague: string | null;
  onSelect: (league: string | null) => void;
  totalCount: number;
  leagues: HardcodedLeague[];
}) {
  return (
    <aside className="pls-sidebar">
      <div className="pls-header">
        <SportsSoccerIcon sx={{ fontSize: 13, color: '#3b82f6' }} />
        <span className="pls-header-label">POPULAR LEAGUES</span>
      </div>

      <button
        className={`pls-item${activeLeague === null ? ' active' : ''}`}
        onClick={() => onSelect(null)}
      >
        <span className="pls-item-name">All Leagues</span>
        <span className={`pls-item-count${activeLeague === null ? ' active' : ''}`}>{totalCount}</span>
      </button>

      {leagues.map(({ name, count }) => (
        <button
          key={name}
          className={`pls-item${activeLeague === name ? ' active' : ''}`}
          onClick={() => onSelect(activeLeague === name ? null : name)}
        >
          <span className="pls-item-name">{name}</span>
          <span className={`pls-item-count${activeLeague === name ? ' active' : ''}`}>{count}</span>
        </button>
      ))}

      <style>{`
        .pls-sidebar {
          width: 200px;
          min-width: 200px;
          flex-shrink: 0;
          background: #0d1f3c;
          border: 1.5px solid rgba(59, 130, 246,0.15);
          border-radius: 10px;
          overflow: hidden;
          height: fit-content;
          position: sticky;
          top: 16px;
        }
        .pls-header {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 11px 12px 10px;
          background: rgba(59, 130, 246,0.08);
          border-bottom: 1.5px solid rgba(59, 130, 246,0.15);
        }
        .pls-header-label {
          font-size: 9px;
          font-weight: 900;
          color: #60a5fa;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-family: system-ui, sans-serif;
        }
        .pls-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 9px 12px;
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          cursor: pointer;
          text-align: left;
          transition: background 0.12s;
          -webkit-tap-highlight-color: transparent;
        }
        .pls-item:last-child { border-bottom: none; }
        .pls-item:hover { background: rgba(59, 130, 246,0.06); }
        .pls-item.active { background: rgba(59, 130, 246,0.12); border-left: 3px solid #3b82f6; padding-left: 9px; }
        .pls-item-name {
          font-size: 12px;
          font-weight: 600;
          color: #9ca3af;
          font-family: system-ui, sans-serif;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
          transition: color 0.12s;
        }
        .pls-item.active .pls-item-name { color: #60a5fa; font-weight: 700; }
        .pls-item-count {
          flex-shrink: 0;
          min-width: 22px;
          height: 18px;
          padding: 0 5px;
          border-radius: 4px;
          background: rgba(255,255,255,0.06);
          color: #6b7280;
          font-size: 10px;
          font-weight: 800;
          font-family: system-ui, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 6px;
          transition: background 0.12s, color 0.12s;
        }
        .pls-item-count.active { background: #3b82f6; color: #fff; }

        @media (max-width: 1024px) {
          .pls-sidebar { display: none; }
        }
      `}</style>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// RightSidebar — unchanged
// ---------------------------------------------------------------------------
function RightSidebar() {
  // Currency for this panel comes from the registered country.
  const { fmt: rsFmt, symbol: rsSymbol } = useCountry();
  const navigate = useNavigate();
  const { betSlip, removeFromBetSlip } = useAppStore() as {
    betSlip: { matchId: string; matchName: string; odd: number; selection: string; market: string }[];
    removeFromBetSlip: (matchId: string, market: string, selection: string) => void;
  };
  const count = betSlip?.length ?? 0;

  const totalOdds = useMemo(() => {
    if (!betSlip || betSlip.length === 0) return 0;
    return betSlip.reduce((acc, b) => acc * (b.odd ?? 1), 1);
  }, [betSlip]);

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [stakeInput, setStakeInput] = useState('');

  const stake = parseFloat(stakeInput) || 0;
  const potentialWin = stake > 0 ? stake * totalOdds : 0;

  const biggestWinTags = ['PL', 'La Liga', 'Bundesliga', 'UCL', 'Serie A', 'Ligue 1', 'NBA'];

  const topAccumulators = [
    { name: 'WC Group Stage Special', folds: 5, players: 617, multiplier: '×17.8'  },
    { name: 'NBA East Today',         folds: 6, players: 143, multiplier: '×24.14' },
    { name: 'Hat-trick Heroes',       folds: 3, players: 578, multiplier: '×32.78' },
  ];

  const recentWinners = [
    // Numbers, not pre-formatted strings — the symbol is applied at render
    // time from the player's registered country.
    { user: 'FP***yl', type: 'Even Odd',    amount: 226_145, ago: '5m ago'  },
    { user: 'MD***o0', type: 'Multi-bet',   amount: 201_500, ago: '9m ago'  },
    { user: 'LX***iw', type: 'Multi-bet',   amount: 185_690, ago: '2m ago'  },
    { user: 'PO***bo', type: 'MINES',       amount: 116_870, ago: '15m ago' },
    { user: 'TJ***1y', type: 'Blaziq Hero', amount:  89_280, ago: '7m ago'  },
    { user: 'FU***8x', type: 'Multi-bet',   amount:  85_405, ago: '11m ago' },
  ];

  const handleCopy = (idx: number) => {
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  return (
    <aside className="rs-sidebar">

      {count > 0 && (
        <div className="rs-card rs-betslip-card">
          <div className="rs-card-hdr">
            <ReceiptLongIcon sx={{ fontSize: 14, color: '#60a5fa' }} />
            <span className="rs-card-title">BET SLIP</span>
            <span className="rs-badge-count">{count}</span>
          </div>

          <div className="rs-betslip-items">
            {betSlip.map((b, i) => (
              <div key={i} className="rs-betslip-row">
                <div className="rs-betslip-row-top">
                  <span className="rs-betslip-match">{b.matchName}</span>
                  <button
                    className="rs-betslip-remove"
                    onClick={() => removeFromBetSlip(b.matchId, b.market, b.selection)}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
                <div className="rs-betslip-row-bottom">
                  <span className="rs-betslip-market">{b.market}</span>
                  <span className="rs-betslip-sel">{b.selection}</span>
                  <span className="rs-betslip-odd">{b.odd?.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rs-betslip-stake-wrap">
            <label className="rs-stake-label">STAKE ({rsSymbol})</label>
            <input
              type="number"
              min="0"
              placeholder="0.00"
              value={stakeInput}
              onChange={(e) => setStakeInput(e.target.value)}
              className="rs-stake-input"
            />
          </div>

          <div className="rs-betslip-totals">
            <div className="rs-totals-row">
              <span className="rs-total-label">Total Odds</span>
              <span className="rs-total-val">{totalOdds.toFixed(2)}</span>
            </div>
            {potentialWin > 0 && (
              <div className="rs-totals-row">
                <span className="rs-total-label">Potential Win</span>
                <span className="rs-total-win">{rsFmt(potentialWin)}</span>
              </div>
            )}
          </div>

          <button className="rs-place-btn" onClick={() => navigate('/betslip')}>
            PLACE BET ›
          </button>
        </div>
      )}

      <div className="rs-card rs-win-card">
        <div className="rs-card-hdr rs-win-hdr">
          <EmojiEventsIcon sx={{ fontSize: 16, color: '#facc15' }} />
          <span className="rs-card-title rs-win-title">BIGGEST WIN TODAY</span>
        </div>
        <div className="rs-win-body">
          <div className="rs-win-amount">{rsFmt(1_113_675)}</div>
          <div className="rs-win-user">by EX***3h · 4-fold accumulator</div>
          <div className="rs-win-tags">
            {biggestWinTags.map((tag, i) => (
              <span key={i} className={`rs-win-tag${i === biggestWinTags.length - 1 ? ' rs-win-tag-more' : ''}`}>
                {i === biggestWinTags.length - 1 ? '+1' : tag}
              </span>
            ))}
          </div>
          <div className="rs-win-stake-row">
            <span className="rs-win-stake-label">Stake: <strong className="rs-win-stake-val">{rsFmt(775)}</strong></span>
            <span className="rs-win-stake-sep">·</span>
            <span className="rs-win-odds-label">Odds: <strong className="rs-win-odds-val">857.00</strong></span>
          </div>
        </div>
      </div>

      <div className="rs-card rs-acc-card">
        <div className="rs-card-hdr rs-acc-hdr">
          <BoltIcon sx={{ fontSize: 15, color: '#3b82f6' }} />
          <span className="rs-card-title rs-acc-title">TOP ACCUMULATORS</span>
        </div>
        <div className="rs-acc-list">
          {topAccumulators.map((acc, idx) => (
            <div key={idx} className="rs-acc-row">
              <div className="rs-acc-info">
                <span className="rs-acc-name">{acc.name}</span>
                <span className="rs-acc-meta">{acc.folds}-fold · {acc.players} players today</span>
              </div>
              <div className="rs-acc-right">
                <span className="rs-acc-multi">{acc.multiplier}</span>
                <button
                  className={`rs-acc-copy${copiedIdx === idx ? ' copied' : ''}`}
                  onClick={() => handleCopy(idx)}
                >
                  {copiedIdx === idx ? (
                    <span style={{ fontSize: 11, fontWeight: 800 }}>✓</span>
                  ) : (
                    <ContentCopyIcon sx={{ fontSize: 12 }} />
                  )}
                  {copiedIdx === idx ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rs-card rs-winners-card">
        <div className="rs-card-hdr rs-winners-hdr">
          <span className="rs-winners-dot" />
          <span className="rs-card-title rs-winners-title">RECENT WINNERS</span>
        </div>
        <div className="rs-winners-list">
          {recentWinners.map((w, i) => (
            <div key={i} className="rs-winner-row">
              <div className="rs-winner-left">
                <span className="rs-winner-user">{w.user}</span>
                <div className="rs-winner-meta">
                  <span className="rs-winner-type">{w.type}</span>
                  <span className="rs-winner-ago">{w.ago}</span>
                </div>
              </div>
              <span className="rs-winner-amount">+{rsFmt(w.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rs-refer-wrap">
        <div className="rs-refer-image-slot">
          <img
            src={referBannerImg}
            alt="Refer & Earn"
            className="rs-refer-img"
          />
        </div>
      </div>

      <style>{`
        .rs-sidebar {
          width: 240px;
          min-width: 240px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
          position: sticky;
          top: 16px;
          height: fit-content;
        }

        .rs-card {
          background: #0d1f3c;
          border: 1.5px solid rgba(59, 130, 246,0.15);
          border-radius: 12px;
          overflow: hidden;
        }

        .rs-card-hdr {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px 10px;
          border-bottom: 1px solid rgba(59, 130, 246,0.12);
        }
        .rs-card-title {
          font-size: 10px;
          font-weight: 900;
          color: #9ca3af;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-family: 'Inter', system-ui, sans-serif;
          flex: 1;
        }
        .rs-badge-count {
          background: #1d4ed8;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          border-radius: 10px;
          padding: 1px 7px;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .rs-betslip-card { border-color: rgba(59, 130, 246,0.25); }
        .rs-betslip-card .rs-card-hdr { background: rgba(30,58,110,0.5); border-bottom-color: rgba(59, 130, 246,0.2); }
        .rs-betslip-items { padding: 4px 0; }

        .rs-betslip-row {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 9px 14px;
          border-bottom: 1px solid rgba(59, 130, 246,0.08);
          transition: background 0.12s;
        }
        .rs-betslip-row:hover { background: rgba(30,58,110,0.3); }
        .rs-betslip-row:last-child { border-bottom: none; }

        .rs-betslip-row-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 6px;
        }
        .rs-betslip-match {
          font-size: 12px;
          font-weight: 700;
          color: #e2e8f0;
          font-family: 'Inter', system-ui, sans-serif;
          line-height: 1.3;
          flex: 1;
          min-width: 0;
        }
        .rs-betslip-remove {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          color: #f87171;
          font-size: 10px;
          font-weight: 900;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.12s, border-color 0.12s;
          font-family: 'Inter', system-ui, sans-serif;
          padding: 0;
        }
        .rs-betslip-remove:hover {
          background: rgba(239,68,68,0.22);
          border-color: rgba(239,68,68,0.5);
        }

        .rs-betslip-row-bottom {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .rs-betslip-market {
          font-size: 10px;
          font-weight: 600;
          color: #4b5563;
          font-family: 'Inter', system-ui, sans-serif;
          white-space: nowrap;
        }
        .rs-betslip-sel {
          font-size: 10px;
          font-weight: 800;
          color: #bfdbfe;
          background: rgba(59, 130, 246,0.1);
          border: 1px solid rgba(59, 130, 246,0.2);
          border-radius: 3px;
          padding: 1px 5px;
          font-family: 'Inter', system-ui, sans-serif;
          white-space: nowrap;
        }
        .rs-betslip-odd {
          font-size: 13px;
          font-weight: 900;
          color: #60a5fa;
          font-family: 'Inter', system-ui, sans-serif;
          margin-left: auto;
        }

        .rs-betslip-stake-wrap {
          padding: 10px 14px;
          border-top: 1px solid rgba(59, 130, 246,0.1);
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .rs-stake-label {
          font-size: 9px;
          font-weight: 800;
          color: #4b5563;
          letter-spacing: 0.1em;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .rs-stake-input {
          width: 100%;
          background: rgba(30,58,110,0.5);
          border: 1.5px solid rgba(59, 130, 246,0.2);
          border-radius: 6px;
          padding: 8px 10px;
          color: #f1f5f9;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Inter', system-ui, sans-serif;
          outline: none;
          transition: border-color 0.12s;
          box-sizing: border-box;
        }
        .rs-stake-input:focus { border-color: #3b82f6; }
        .rs-stake-input::placeholder { color: #374151; }
        .rs-stake-input::-webkit-outer-spin-button,
        .rs-stake-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

        .rs-betslip-totals {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 10px 14px;
          background: rgba(30,58,110,0.5);
          border-top: 1px solid rgba(59, 130, 246,0.2);
        }
        .rs-totals-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .rs-total-label { font-size: 11px; color: #6b7280; font-family: 'Inter', system-ui, sans-serif; }
        .rs-total-val { font-size: 15px; font-weight: 900; color: #60a5fa; font-family: 'Inter', system-ui, sans-serif; }
        .rs-total-win { font-size: 15px; font-weight: 900; color: #facc15; font-family: 'Inter', system-ui, sans-serif; }

        .rs-place-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%);
          border: none;
          color: #fff;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          cursor: pointer;
          font-family: 'Inter', system-ui, sans-serif;
          transition: opacity 0.12s;
        }
        .rs-place-btn:hover { opacity: 0.88; }

        .rs-win-card { border-color: rgba(250,204,21,0.2); }
        .rs-win-hdr { background: rgba(30,58,110,0.5); border-bottom-color: rgba(59, 130, 246,0.2); }
        .rs-win-title { color: #bfdbfe; }
        .rs-win-body { padding: 14px; }
        .rs-win-amount {
          font-size: 24px;
          font-weight: 900;
          color: #facc15;
          font-family: 'Inter', system-ui, sans-serif;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin-bottom: 4px;
        }
        .rs-win-user {
          font-size: 12px;
          color: #6b7280;
          font-family: 'Inter', system-ui, sans-serif;
          margin-bottom: 10px;
          font-weight: 500;
        }
        .rs-win-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
        .rs-win-tag {
          font-size: 11px;
          font-weight: 700;
          color: #bfdbfe;
          background: rgba(59, 130, 246,0.1);
          border: 1px solid rgba(59, 130, 246,0.2);
          border-radius: 5px;
          padding: 3px 8px;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .rs-win-tag-more {
          color: #9ca3af;
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.1);
        }
        .rs-win-stake-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 10px;
          background: rgba(30,58,110,0.6);
          border-radius: 7px;
          border: 1px solid rgba(59, 130, 246,0.2);
        }
        .rs-win-stake-label, .rs-win-odds-label {
          font-size: 12px;
          color: #6b7280;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .rs-win-stake-val { color: #f1f5f9; font-weight: 800; }
        .rs-win-odds-val { color: #facc15; font-weight: 900; font-size: 13px; }
        .rs-win-stake-sep { color: rgba(255,255,255,0.15); font-size: 14px; }

        .rs-acc-card { border-color: rgba(59, 130, 246,0.2); }
        .rs-acc-hdr { background: rgba(30,58,110,0.5); border-bottom-color: rgba(59, 130, 246,0.2); }
        .rs-acc-title { color: #bfdbfe; }
        .rs-acc-list { padding: 4px 0; }
        .rs-acc-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(59, 130, 246,0.08);
        }
        .rs-acc-row:last-child { border-bottom: none; }
        .rs-acc-info { flex: 1; min-width: 0; }
        .rs-acc-name {
          font-size: 13px;
          font-weight: 700;
          color: #e5e7eb;
          font-family: 'Inter', system-ui, sans-serif;
          display: block;
          margin-bottom: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rs-acc-meta {
          font-size: 11px;
          color: #6b7280;
          font-family: 'Inter', system-ui, sans-serif;
          white-space: nowrap;
        }
        .rs-acc-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
          flex-shrink: 0;
        }
        .rs-acc-multi {
          font-size: 16px;
          font-weight: 900;
          color: #60a5fa;
          font-family: 'Inter', system-ui, sans-serif;
          letter-spacing: -0.01em;
        }
        .rs-acc-copy {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #1d4ed8;
          color: #fff;
          border: none;
          border-radius: 5px;
          padding: 5px 10px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.06em;
          cursor: pointer;
          font-family: 'Inter', system-ui, sans-serif;
          transition: background 0.12s, transform 0.08s;
          white-space: nowrap;
        }
        .rs-acc-copy:hover { background: #1d4ed8; }
        .rs-acc-copy:active { transform: scale(0.95); }
        .rs-acc-copy.copied { background: #1d4ed8; }

        .rs-winners-card { border-color: rgba(59, 130, 246,0.25); background: #0d1f3c; }
        .rs-winners-hdr {
          background: linear-gradient(90deg, rgba(30,58,110,0.9) 0%, rgba(13,31,60,0.9) 100%);
          border-bottom: 1px solid rgba(59, 130, 246,0.2);
        }
        .rs-winners-title { color: #bfdbfe; }
        .rs-winners-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #3b82f6;
          flex-shrink: 0;
          box-shadow: 0 0 8px #3b82f6, 0 0 16px rgba(59, 130, 246,0.4);
          animation: rs-winner-pulse 1.8s ease-in-out infinite;
        }
        @keyframes rs-winner-pulse {
          0%, 100% { opacity: 1;   box-shadow: 0 0 6px #3b82f6, 0 0 12px rgba(59, 130, 246,0.3); }
          50%       { opacity: 0.5; box-shadow: 0 0 14px #3b82f6, 0 0 28px rgba(59, 130, 246,0.5); }
        }
        .rs-winners-list { padding: 4px 0; }
        .rs-winner-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(59, 130, 246,0.07);
          transition: background 0.12s;
        }
        .rs-winner-row:last-child { border-bottom: none; }
        .rs-winner-row:hover { background: rgba(30,58,110,0.4); }
        .rs-winner-left { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .rs-winner-user {
          font-size: 13px;
          font-weight: 800;
          color: #e2e8f0;
          font-family: 'Inter', system-ui, sans-serif;
          white-space: nowrap;
        }
        .rs-winner-meta { display: flex; align-items: center; gap: 6px; }
        .rs-winner-type {
          font-size: 10px;
          font-weight: 700;
          color: #60a5fa;
          font-family: 'Inter', system-ui, sans-serif;
          background: rgba(59, 130, 246,0.12);
          border: 1px solid rgba(59, 130, 246,0.2);
          border-radius: 3px;
          padding: 1px 5px;
          white-space: nowrap;
        }
        .rs-winner-ago {
          font-size: 10px;
          color: rgba(255,255,255,0.25);
          font-family: 'Inter', system-ui, sans-serif;
          white-space: nowrap;
        }
        .rs-winner-amount {
          font-size: 12px;
          font-weight: 900;
          color: #22c55e;
          font-family: 'Inter', system-ui, sans-serif;
          white-space: nowrap;
          flex-shrink: 0;
          letter-spacing: -0.01em;
        }

        .rs-refer-wrap {
          border-radius: 12px;
          overflow: hidden;
          border: 1.5px solid rgba(59, 130, 246,0.2);
          background: #0d1f3c;
        }
        .rs-refer-image-slot {
          width: 100%;
          height: 200px;
          overflow: hidden;
          position: relative;
        }
        .rs-refer-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        @media (max-width: 1200px) {
          .rs-sidebar { display: none; }
        }
      `}</style>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// SupportersCarousel
// ---------------------------------------------------------------------------
interface Supporter { name: string; logoUrl: string; type: 'brand' | 'club' | 'media'; }
const SUPPORTERS: Supporter[] = [
  { name: 'Visa',          logoUrl: 'https://1000logos.net/wp-content/uploads/2021/11/VISA-logo.png', type: 'brand' },
  { name: 'Mastercard',    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg', type: 'brand' },
  { name: 'MTN',           logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQcsX815Q5iM1YzjweBSeX3KwWKFy0hS7Xy1A&s', type: 'brand' },
  { name: 'Betway',        logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXudjZT_JUXrXPxTRYuuoOJ07j1wmTD3mUBQ&s', type: 'brand' },
  { name: 'Sportybet',     logoUrl: 'https://www.latestmodapks.com/wp-content/uploads/2023/04/8rBblg0p56.png', type: 'brand' },
  { name: 'DStv',          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/94/DStv_2012_logo.svg', type: 'media' },
  { name: 'SuperSport',    logoUrl: 'https://e7.pngegg.com/pngimages/97/609/png-clipart-supersport-dstv-television-channel-others-miscellaneous-television-thumbnail.png', type: 'media' },
  { name: 'ESPN',          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/960px-ESPN_wordmark.svg.png', type: 'media' },
  { name: 'Sky Sports',    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Sky_Sports_2025.svg/3840px-Sky_Sports_2025.svg.png', type: 'media' },
  { name: 'Real Madrid',   logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/960px-Real_Madrid_CF.svg.png', type: 'club'  },
  { name: 'Barcelona',     logoUrl: 'https://upload.wikimedia.org/wikipedia/sco/thumb/4/47/FC_Barcelona_%28crest%29.svg/3840px-FC_Barcelona_%28crest%29.svg.png', type: 'club'  },
  { name: 'Bayern Munich', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/3840px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png', type: 'club'  },
  { name: 'Coca-Cola',     logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Coca-Cola_logo.svg/960px-Coca-Cola_logo.svg.png', type: 'brand' },
  { name: 'Nike',          logoUrl: 'https://media.about.nike.com/image-downloads/cf68f541-fc92-4373-91cb-086ae0fe2f88/002-nike-logos-swoosh-white.jpg', type: 'brand' },
  { name: 'Adidas',        logoUrl: 'https://preview.thenewsmarket.com/Previews/ADID/StillAssets/1920x1440/689347.jpg', type: 'brand' },
];

function SupportersCarousel() {
  const doubled = useMemo(() => [...SUPPORTERS, ...SUPPORTERS], []);
  return (
    <div className="supporters-wrap">
      <div className="supporters-track-wrap">
        <div className="supporters-track">
          {doubled.map((s, i) => (
            <div key={i} className="supporter-chip">
              {s.logoUrl ? (
                <img src={s.logoUrl} alt={s.name} className="supporter-logo-img" draggable={false} />
              ) : (
                <div className="supporter-logo-placeholder">
                  <span className="supporter-placeholder-initial">{s.name.charAt(0)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="supporters-fade-l" />
        <div className="supporters-fade-r" />
      </div>
      <style>{`
        .supporters-wrap { margin: 48px 0 0; border-radius: 12px; overflow: hidden; background: transparent; }
        .supporters-track-wrap { position: relative; overflow: hidden; padding: 10px 0; background: transparent; }
        .supporters-track { display: flex; gap: 12px; animation: supportersScroll 60s linear infinite; width: max-content; padding: 0 12px; }
        .supporter-chip { flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 8px; padding: 2px; cursor: default; transition: transform 0.15s; }
        .supporter-chip:hover { transform: translateY(-2px); }
        .supporter-logo-img { height: 40px; width: auto; max-width: 90px; object-fit: contain; display: block; border-radius: 4px; user-select: none; filter: brightness(0.85) contrast(1.1); }
        .supporter-logo-placeholder { height: 40px; width: 70px; border-radius: 6px; border: 1.5px dashed rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; }
        .supporter-placeholder-initial { font-size: 16px; font-weight: 800; color: rgba(255,255,255,0.15); font-family: system-ui, sans-serif; text-transform: uppercase; }
        .supporters-fade-l { position: absolute; top: 0; left: 0; bottom: 0; width: 28px; background: linear-gradient(90deg, #07080f 0%, transparent 100%); pointer-events: none; z-index: 2; }
        .supporters-fade-r { position: absolute; top: 0; right: 0; bottom: 0; width: 28px; background: linear-gradient(270deg, #07080f 0%, transparent 100%); pointer-events: none; z-index: 2; }
        @keyframes supportersScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SiteFooter
// ---------------------------------------------------------------------------
function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <SportsSoccerIcon sx={{ fontSize: 20, color: '#3b82f6' }} />
          <span className="footer-brand-name">WinBet</span>
        </div>
        <p className="footer-tagline">Your #1 destination for live sports betting.</p>
      </div>
      <div className="footer-links">
        {['About Us','Terms & Conditions','Privacy Policy','Responsible Gambling','Contact Support'].map((l, i, arr) => (
          <span key={l} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <a href="#" className="footer-link">{l}</a>
            {i < arr.length - 1 && <span className="footer-dot">·</span>}
          </span>
        ))}
      </div>
      <div className="footer-warning">
        <span className="footer-warning-icon">⚠️</span>
        <span>Gambling can be addictive. Please play responsibly. You must be 18+ to use this service. For help visit <strong>www.gamcare.org.uk</strong></span>
      </div>
      <div className="footer-bottom">
        <span>© {year} WinBet. All rights reserved.</span>
        <span className="footer-pipe">|</span>
        <span>Licensed &amp; Regulated</span>
        <span className="footer-18">18+</span>
      </div>
      <style>{`
        .site-footer { margin-top: 24px; padding: 22px 16px 36px; border-top: 1.5px solid rgba(59, 130, 246,0.15); background: transparent; border-radius: 12px 12px 0 0; font-family: system-ui, sans-serif; }
        .footer-top { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-bottom: 16px; }
        .footer-brand { display: flex; align-items: center; gap: 8px; }
        .footer-brand-name { font-size: 20px; font-weight: 900; color: #3b82f6; letter-spacing: 0.02em; font-family: system-ui, sans-serif; }
        .footer-tagline { font-size: 13px; color: #f3f4f6; font-family: system-ui, sans-serif; text-align: center; margin: 0; font-weight: 400; }
        .footer-links { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin-bottom: 14px; }
        .footer-link { font-size: 12px; color: #f9fafb; text-decoration: none; font-family: system-ui, sans-serif; font-weight: 600; transition: color 0.15s; }
        .footer-link:hover { color: #3b82f6; }
        .footer-dot { font-size: 12px; color: #f3f4f6; opacity: 0.4; }
        .footer-warning { display: flex; align-items: flex-start; gap: 8px; padding: 11px 14px; background: rgba(59, 130, 246,0.05); border: 1px solid rgba(59, 130, 246,0.15); border-radius: 8px; margin-bottom: 14px; font-size: 11px; color: #f3f4f6; font-family: system-ui, sans-serif; line-height: 1.6; font-weight: 400; }
        .footer-warning-icon { flex-shrink: 0; font-size: 14px; }
        .footer-bottom { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 11px; color: #f3f4f6; font-family: system-ui, sans-serif; font-weight: 400; flex-wrap: wrap; opacity: 0.7; }
        .footer-pipe { opacity: 0.3; }
        .footer-18 { background: #1d4ed8; color: #ffffff; font-size: 10px; font-weight: 900; border-radius: 4px; padding: 2px 6px; letter-spacing: 0.05em; }
      `}</style>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// FloatingBetSlipButton — rendered through a Portal directly into
// document.body so it is ALWAYS positioned relative to the real viewport.
// ---------------------------------------------------------------------------
function FloatingBetSlipButton() {
  const navigate = useNavigate();
  const { betSlip } = useAppStore() as { betSlip: { matchId: string }[] };
  const count = betSlip?.length ?? 0;
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{`
        @keyframes fbsPulse {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.14); }
          100% { transform: scale(1); }
        }
        .fbs-btn {
          position: fixed;
          bottom: calc(80px + env(safe-area-inset-bottom, 0px));
          right: calc(16px + env(safe-area-inset-right, 0px));
          z-index: 999999;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%);
          border: 2px solid rgba(59, 130, 246,0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(59, 130, 246,0.4);
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          outline: none;
          padding: 0;
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
          max-width: 56px;
          max-height: 56px;
        }
        .fbs-btn:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 6px 26px rgba(59, 130, 246,0.55);
          border-color: rgba(96, 165, 250,0.75);
        }
        .fbs-btn:active { transform: scale(0.92); }
        .fbs-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          background: #facc15;
          color: #1c1917;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          font-size: 11px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #07080f;
          line-height: 1;
          box-shadow: 0 0 0 1px rgba(250,204,21,0.35);
          animation: fbsPulse 1.8s ease-in-out infinite;
          pointer-events: none;
        }
        @media (max-width: 480px) {
          .fbs-btn {
            width: 50px;
            height: 50px;
            max-width: 50px;
            max-height: 50px;
            bottom: calc(72px + env(safe-area-inset-bottom, 0px));
            right: calc(12px + env(safe-area-inset-right, 0px));
          }
        }
        @media (max-width: 360px) {
          .fbs-btn {
            width: 44px;
            height: 44px;
            max-width: 44px;
            max-height: 44px;
            bottom: calc(64px + env(safe-area-inset-bottom, 0px));
            right: calc(8px + env(safe-area-inset-right, 0px));
          }
          .fbs-btn .material-icons { font-size: 22px !important; }
          .fbs-badge { width: 18px; height: 18px; font-size: 9px; top: -3px; right: -3px; }
        }
      `}</style>

      <button
        className="fbs-btn"
        onClick={() => navigate('/betslip')}
        aria-label="Open bet slip"
        title={count > 0 ? `${count} selection${count > 1 ? 's' : ''} in bet slip` : 'Bet slip'}
      >
        <span className="material-icons" style={{ fontSize: 26, color: '#fff' }}>
          receipt_long
        </span>

        {count > 0 && (
          <span className="fbs-badge">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
    </>,
    document.body,
  );
}
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TimeTab = 'all' | 'today' | 'tomorrow' | 'this_week' | 'highlights' | 'live';
type MatchCategory = 'live' | 'next3' | 'later' | 'results';

interface OddsMap { home: number; draw: number; away: number; }
interface EnrichedMatch extends Match {
  oddsMap?: OddsMap;
  adminHomeLogo?: string;
  adminAwayLogo?: string;
}

interface BetSlipEntry {
  matchId: string;
  matchName: string;
  market: string;
  selection: string;
  odd: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sanitizeLogo(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('blob:')) return '';
  return trimmed;
}

function assignAdminLogos(matches: EnrichedMatch[]): EnrichedMatch[] {
  const poolSize = Math.max(HOME_LOGO_POOL.length, AWAY_LOGO_POOL.length, 1);
  return matches.map((m, idx) => {
    const hardHome = sanitizeLogo((m as unknown as Record<string, string>).hardcodedHomeLogo);
    const hardAway = sanitizeLogo((m as unknown as Record<string, string>).hardcodedAwayLogo);
    const homeUrl = hardHome || sanitizeLogo(HOME_LOGO_POOL[idx % poolSize]) || '';
    const awayUrl = hardAway || sanitizeLogo(AWAY_LOGO_POOL[idx % poolSize]) || '';
    return { ...m, adminHomeLogo: homeUrl, adminAwayLogo: awayUrl };
  });
}

function buildAdminTeamFingerprints(adminMatches: EnrichedMatch[]): Set<string> {
  const fps = new Set<string>();
  for (const m of adminMatches) {
    const home = (m.homeTeam ?? '').toLowerCase().trim();
    const away = (m.awayTeam ?? '').toLowerCase().trim();
    if (home && away) fps.add(`${home}|${away}`);
  }
  return fps;
}

function isMatchInAdminSet(match: EnrichedMatch, adminFps: Set<string>): boolean {
  const home = (match.homeTeam ?? '').toLowerCase().trim();
  const away = (match.awayTeam ?? '').toLowerCase().trim();
  return adminFps.has(`${home}|${away}`);
}

const HIDDEN_ADMIN_IDS_KEY = 'hidden_finished_admin_match_ids';
function loadHiddenAdminIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_ADMIN_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set<string>(parsed);
  } catch { /* ignore */ }
  return new Set();
}
function saveHiddenAdminIds(ids: Set<string>): void {
  try { localStorage.setItem(HIDDEN_ADMIN_IDS_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}
function addHiddenAdminId(id: string): void {
  const ids = loadHiddenAdminIds();
  ids.add(id);
  saveHiddenAdminIds(ids);
}

// ---------------------------------------------------------------------------
// League inference
// ---------------------------------------------------------------------------
const LEAGUE_TEAMS: Record<string, { leagueNames: string[]; teams: string[] }> = {
  premier_league: {
    leagueNames: ['Premier League', 'English Premier League', 'EPL'],
    teams: [
      'Arsenal','Aston Villa','Bournemouth','Brentford','Brighton','Brighton & Hove Albion',
      'Chelsea','Crystal Palace','Everton','Fulham','Ipswich','Ipswich Town',
      'Leicester','Leicester City','Liverpool','Manchester City','Manchester United',
      'Newcastle','Newcastle United','Nottingham Forest','Nottm Forest','Southampton',
      'Tottenham','Tottenham Hotspur','West Ham','West Ham United','Wolves','Wolverhampton',
      'Wolverhampton Wanderers','Sunderland','Leeds United','Leeds','Burnley','AFC Bournemouth',
    ],
  },
  la_liga: {
    leagueNames: ['La Liga','LaLiga','La Liga EA Sports','Primera División','Primera Division'],
    teams: [
      'Athletic Club','Athletic Bilbao','Atlético Madrid','Atletico Madrid','Atlético de Madrid',
      'Barcelona','FC Barcelona','Celta Vigo','Deportivo Alavés','Deportivo Alaves',
      'Espanyol','RCD Espanyol','Getafe','Girona','Las Palmas','UD Las Palmas',
      'Leganés','Leganes','CD Leganés','Mallorca','RCD Mallorca','Osasuna','CA Osasuna',
      'Rayo Vallecano','Real Betis','Real Madrid','Real Sociedad','Real Valladolid',
      'Sevilla','Sevilla FC','Valencia','Valencia CF','Villarreal','Villarreal CF',
      'Alavés','Alaves','Levante','Elche','Real Oviedo',
    ],
  },
  bundesliga: {
    leagueNames: ['Bundesliga','1. Bundesliga','German Bundesliga','Fußball-Bundesliga'],
    teams: [
      'Augsburg','FC Augsburg','Bayer Leverkusen','Bayern Munich','FC Bayern München',
      'FC Bayern Munich','Borussia Dortmund','BVB','Borussia Mönchengladbach',
      'Borussia Monchengladbach','Eintracht Frankfurt','Freiburg','SC Freiburg',
      'Hamburg','Hamburger SV','Hamburg SV','Heidenheim','1. FC Heidenheim','1. FC Heidenheim 1846',
      'Hoffenheim','TSG Hoffenheim','Holstein Kiel','Mainz','Mainz 05','1. FSV Mainz 05',
      'RB Leipzig','Red Bull Leipzig','St. Pauli','FC St. Pauli','Stuttgart','VfB Stuttgart',
      'Union Berlin','1. FC Union Berlin','Werder Bremen','SV Werder Bremen','Wolfsburg',
      'VfL Wolfsburg','FC Cologne','1. FC Köln','Cologne',
    ],
  },
  serie_a: {
    leagueNames: ['Serie A','Italian Serie A','Serie A TIM'],
    teams: [
      'AC Milan','Milan','Atalanta','Atalanta BC','Bologna','Bologna FC',
      'Cagliari','Cagliari Calcio','Como','Como 1907','Empoli','Fiorentina','ACF Fiorentina',
      'Genoa','Genoa CFC','Hellas Verona','Inter','Inter Milan','FC Internazionale',
      'Internazionale','Juventus','Juve','Lazio','SS Lazio','Lecce','US Lecce',
      'Monza','AC Monza','Napoli','SSC Napoli','Parma','Parma Calcio','Roma','AS Roma',
      'Torino','Torino FC','Udinese','Udinese Calcio','Venezia','Venezia FC',
      'Cremonese','Pisa','Sassuolo',
    ],
  },
  ligue_1: {
    leagueNames: ['Ligue 1','Ligue 1 Uber Eats','French Ligue 1',"Ligue 1 McDonald's"],
    teams: [
      'Angers','SCO Angers','Auxerre','AJ Auxerre','Brest','Stade Brestois',
      'Stade Brestois 29','Le Havre','Le Havre AC','HAC','Lens','RC Lens','Lille','LOSC Lille',
      'Lyon','Olympique Lyonnais','OL','Marseille','Olympique de Marseille','OM',
      'Monaco','AS Monaco','Montpellier','Montpellier HSC','Nantes','FC Nantes',
      'Nice','OGC Nice','Paris Saint-Germain','PSG','Paris SG','Paris FC',
      'Reims','Stade de Reims','Rennes','Stade Rennais','Saint-Étienne','Saint-Etienne',
      'AS Saint-Étienne','Strasbourg','RC Strasbourg','Toulouse','Toulouse FC',
      'Metz','Lorient',
    ],
  },
};

function inferLeagueFromTeams(homeTeam: string, awayTeam: string): string {
  const h = homeTeam.toLowerCase();
  const a = awayTeam.toLowerCase();
  for (const { leagueNames, teams } of Object.values(LEAGUE_TEAMS)) {
    const teamSet = new Set(teams.map((t) => t.toLowerCase()));
    if (teamSet.has(h) && teamSet.has(a)) return leagueNames[0];
  }
  return '';
}

const TOP_6_LEAGUE_DISPLAY_NAMES = ['Premier League','La Liga','Bundesliga','Serie A','Ligue 1'];
const CUPS_LABELS = new Set<string>([
  'FA Cup','EFL Cup / Carabao Cup','Copa del Rey','DFB Pokal','Coppa Italia',
  'Coupe de France','UEFA Champions League','UEFA Europa League',
  'UEFA Conference League','UEFA Nations League','UEFA Euros',
  'Copa Libertadores','Copa América','CONCACAF Champions Cup',
  'AFC Champions League','CAF Champions League','Africa Cup of Nations',
  'FIFA World Cup',"Women's World Cup",'FIFA Club World Cup'
]);

function leagueSortKey(league: string): string {
  if (!league) return '99_zzz_unknown';
  for (let i = 0; i < TOP_6_LEAGUE_DISPLAY_NAMES.length; i++) {
    if (league === TOP_6_LEAGUE_DISPLAY_NAMES[i]) return `00_${String(i).padStart(2,'0')}_${league}`;
  }
  if (CUPS_LABELS.has(league)) return `01_${league.toLowerCase()}`;
  return `02_${league.toLowerCase()}`;
}

const LIVE_STATUSES = new Set([
  'LIVE','live','IN_PLAY','in_play','inplay',
  'FIRST_HALF','first_half','1H','1h','SECOND_HALF','second_half','2H','2h',
  'HALFTIME','halftime','HALF_TIME','half_time','HT','ht',
  'EXTRA_TIME','extra_time','ET','et','ET1','et1','ET2','et2',
  'PENALTIES','penalties','PEN','pen','P','SHOOTOUT','shootout',
  'BREAK','break','SUSPENDED','suspended','INTERRUPTED','interrupted',
  'STATUS_IN_PROGRESS','STATUS_HALFTIME','STATUS_END_PERIOD',
  'STATUS_OVERTIME','STATUS_FIRST_HALF','STATUS_SECOND_HALF',
]);

const FINISHED_STATUSES = new Set([
  'FINISHED','finished','FULL_TIME','full_time','FT','ft',
  'AWARDED','awarded','CANCELLED','cancelled','CANCELED','canceled',
  'POSTPONED','postponed','ABANDONED','abandoned','VOID','void',
  'AFTER_EXTRA_TIME','after_extra_time','AET','aet',
  'AFTER_PENALTIES','after_penalties','AP','ap',
  'ENDED','ended','COMPLETED','completed','COMPLETE','complete',
  'WALKOVER','walkover','RETIRED','retired','DELAYED','delayed',
  'COVERAGE_LOST','coverage_lost',
  'STATUS_FINAL','STATUS_FULL_TIME','STATUS_POSTPONED',
  'STATUS_CANCELED','STATUS_SUSPENDED','STATUS_ABANDONED','STATUS_RAIN_DELAY',
]);

const HALFTIME_STATUSES   = new Set(['HALFTIME','halftime','HALF_TIME','half_time','HT','ht','STATUS_HALFTIME']);
const EXTRA_TIME_STATUSES = new Set(['EXTRA_TIME','extra_time','ET','et','ET1','et1','ET2','et2','STATUS_OVERTIME']);
const PENALTY_STATUSES    = new Set(['PENALTIES','penalties','PEN','pen','SHOOTOUT','shootout']);

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function categorise(match: Match): MatchCategory | null {
  const status = match.status ?? '';
  if (FINISHED_STATUSES.has(status)) return 'results';
  if (LIVE_STATUSES.has(status)) return 'live';
  if (match.kickoffAt) {
    const kickoffMs = new Date(match.kickoffAt).getTime();
    const nowMs = Date.now();
    if (kickoffMs - nowMs <= THREE_DAYS_MS) return 'next3';
    return 'later';
  }
  return 'next3';
}

function formatKickoff(kickoffAt?: string): string {
  if (!kickoffAt) return '--:--';
  return new Date(kickoffAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12: false });
}

function formatMatchDate(kickoffAt?: string): string {
  if (!kickoffAt) return '';
  const d = new Date(kickoffAt);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatCountdown(kickoffAt?: string): string {
  if (!kickoffAt) return '';
  const diff = new Date(kickoffAt).getTime() - Date.now();
  if (diff <= 0) return 'Starting soon';
  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins  = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getResultLabel(match: Match): string {
  const status = match.status ?? '';
  if (status.toLowerCase().includes('cancel') || status.toLowerCase().includes('void') || status.toLowerCase().includes('abandon')) return 'VOID';
  if (status.toLowerCase().includes('postpone')) return 'PST';
  if (PENALTY_STATUSES.has(status) || status.toLowerCase().includes('penalt')) return 'AET (P)';
  if (EXTRA_TIME_STATUSES.has(status) || status.toLowerCase().includes('extra') || status.toLowerCase().includes('aet')) return 'AET';
  return 'FT';
}

function getMatchWinner(match: Match): 'home' | 'away' | 'draw' | null {
  if (match.scoreHome == null || match.scoreAway == null) return null;
  if (match.scoreHome > match.scoreAway) return 'home';
  if (match.scoreAway > match.scoreHome) return 'away';
  return 'draw';
}

function extractOddsMap(oddsArray: unknown[], homeTeam: string, awayTeam: string): OddsMap | undefined {
  if (!Array.isArray(oddsArray) || oddsArray.length === 0) return undefined;
  const pool = oddsArray as Array<Record<string, unknown>>;
  const parseOdd = (o: Record<string, unknown>): number =>
    parseFloat(String(o.odd ?? o.value ?? o.odds ?? o.price ?? o.decimal ?? o.americanOdds ?? '0'));
  const norm = (s: string) => s.toLowerCase().trim();
  const normHome = norm(homeTeam);
  const normAway = norm(awayTeam);
  const matchesTeam = (sel: string, teamNorm: string) => { const s = norm(sel); return s === teamNorm || s.includes(teamNorm) || teamNorm.includes(s); };
  let home = 0, draw = 0, away = 0;
  for (const o of pool) {
    const sel = norm(String(o.selection ?? o.outcome ?? o.name ?? o.label ?? o.type ?? ''));
    const val = parseOdd(o);
    if (val <= 1 || val > 200) continue;
    if (sel === 'home') { if (home === 0) home = val; }
    else if (sel === 'away') { if (away === 0) away = val; }
    else if (sel === 'draw' || sel === 'x') { if (draw === 0) draw = val; }
    else if (matchesTeam(sel, normHome)) { if (home === 0) home = val; }
    else if (matchesTeam(sel, normAway)) { if (away === 0) away = val; }
  }
  if (home === 0 && draw === 0 && away === 0) {
    const vals = pool.map(parseOdd).filter((v) => v > 1 && v < 50);
    if (vals.length >= 2) return vals.length >= 3 ? { home: vals[0], draw: vals[1], away: vals[2] } : { home: vals[0], draw: 0, away: vals[1] };
    return undefined;
  }
  return { home, draw, away };
}

// ---------------------------------------------------------------------------
// Synthetic odds generator — ODDS GATE REMOVED
// ---------------------------------------------------------------------------
function hashStringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateSyntheticOdds(matchId: string): OddsMap {
  const rand = seededRandom(hashStringToSeed(matchId));
  const homeStrength = 0.85 + rand() * 1.3;
  const awayStrength = 0.85 + rand() * 1.3;
  const drawStrength = 0.55 + rand() * 0.35;
  const total = homeStrength + awayStrength + drawStrength;
  const homeProb = homeStrength / total;
  const drawProb = drawStrength / total;
  const awayProb = awayStrength / total;
  const margin = 1.06;
  const toOdd = (p: number) => Math.min(15, Math.max(1.1, Math.round((margin / p) * 100) / 100));
  return { home: toOdd(homeProb), draw: toOdd(drawProb), away: toOdd(awayProb) };
}

function withGuaranteedOdds(match: EnrichedMatch): EnrichedMatch {
  const o = match.oddsMap;
  if (o && o.home > 0 && o.away > 0) return match;
  return { ...match, oddsMap: generateSyntheticOdds(match.id) };
}

function unwrapWithAllOdds(raw: unknown): Array<{ match: Match; odds: unknown[] }> {
  if (!raw) return [];
  const obj = raw as Record<string, unknown>;
  if (!obj.success || !obj.data) return [];
  const items: Array<{ match: Match; odds: unknown[] }> = [];
  const processItem = (item: unknown) => {
    const i = item as Record<string, unknown>;
    const match = normalizeMatch(i.match ?? i);
    if (!match?.id) return;
    const odds: unknown[] = Array.isArray(i.match_result) ? i.match_result : Array.isArray(i.odds) ? i.odds : Array.isArray(i.markets) ? i.markets : [];
    items.push({ match, odds });
  };
  const data = obj.data;
  if (Array.isArray(data)) data.forEach(processItem);
  else if (data && typeof data === 'object') for (const val of Object.values(data as Record<string, unknown>)) if (Array.isArray(val)) val.forEach(processItem);
  return items;
}

function looksLikeFixtureName(s: string): boolean { return / at /i.test(s) || / vs\.? /i.test(s) || / @ /i.test(s); }

function normalizeMatch(raw: unknown): Match | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? r.matchId ?? r.match_id ?? r.fixtureId ?? r.fixture_id ?? '');
  if (!id || id === 'undefined') return null;
  let competitorHome: Record<string, unknown> | null = null;
  let competitorAway: Record<string, unknown> | null = null;
  const competitorsArr = Array.isArray(r.competitors) ? r.competitors as Record<string, unknown>[] : null;
  const competitionsArr = Array.isArray(r.competitions) ? r.competitions as Record<string, unknown>[] : null;
  const firstComp = competitionsArr?.[0] as Record<string, unknown> | undefined;
  const nestedCompetitors = Array.isArray(firstComp?.competitors) ? firstComp!.competitors as Record<string, unknown>[] : null;
  const resolveCompetitors = (arr: Record<string, unknown>[]) => {
    for (const c of arr) {
      const side = String(c.homeAway ?? c.type ?? '').toLowerCase();
      const teamObj = (c.team && typeof c.team === 'object') ? c.team as Record<string, unknown> : c;
      if (side === 'home') competitorHome = teamObj; else if (side === 'away') competitorAway = teamObj;
    }
    if (!competitorHome && !competitorAway && arr.length >= 2) {
      const t0 = arr[0]; const t1 = arr[1];
      competitorHome = (t0.team && typeof t0.team === 'object') ? t0.team as Record<string, unknown> : t0;
      competitorAway = (t1.team && typeof t1.team === 'object') ? t1.team as Record<string, unknown> : t1;
    }
  };
  if (competitorsArr) resolveCompetitors(competitorsArr);
  if (!competitorHome && !competitorAway && nestedCompetitors) resolveCompetitors(nestedCompetitors);
  const homeObj = competitorHome ?? ((r.home && typeof r.home === 'object') ? r.home as Record<string, unknown> : null);
  const awayObj = competitorAway ?? ((r.away && typeof r.away === 'object') ? r.away as Record<string, unknown> : null);
  const getLogoFromObj = (obj: Record<string, unknown> | null): string => {
    if (!obj) return '';
    if (Array.isArray(obj.logos) && obj.logos.length > 0) {
      const first = obj.logos[0] as Record<string, unknown>;
      return String(first.href ?? first.url ?? '');
    }
    return String(obj.logo ?? obj.logoUrl ?? obj.crest ?? obj.image ?? obj.photo ?? obj.img ?? '');
  };
  let homeTeam = String(r.homeTeam ?? r.home_team ?? r.homeName ?? r.home_name ?? homeObj?.name ?? homeObj?.displayName ?? homeObj?.teamName ?? '').trim();
  let awayTeam = String(r.awayTeam ?? r.away_team ?? r.awayName ?? r.away_name ?? awayObj?.name ?? awayObj?.displayName ?? awayObj?.teamName ?? '').trim();
  if ((!homeTeam || !awayTeam) && typeof r.name === 'string') {
    const atMatch = r.name.match(/^(.+?)\s+at\s+(.+)$/i);
    const vsMatch = r.name.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
    if (atMatch) { if (!awayTeam) awayTeam = atMatch[1].trim(); if (!homeTeam) homeTeam = atMatch[2].trim(); }
    else if (vsMatch) { if (!homeTeam) homeTeam = vsMatch[1].trim(); if (!awayTeam) awayTeam = vsMatch[2].trim(); }
  }
  if (!homeTeam && !awayTeam) return null;
  let leagueName = '';
  let leagueLogo = '';
  if (firstComp) {
    const compLeague = firstComp.league ?? firstComp.season;
    if (compLeague && typeof compLeague === 'object') leagueName = String((compLeague as Record<string,unknown>).name ?? (compLeague as Record<string,unknown>).displayName ?? (compLeague as Record<string,unknown>).slug ?? '');
  }
  if (!leagueName) {
    const rawLeague = r.league ?? r.leagueName ?? r.competition ?? r.league_name ?? r.competitionName;
    if (rawLeague && typeof rawLeague === 'object') {
      const lo = rawLeague as Record<string, unknown>;
      leagueName = String(lo.name ?? lo.displayName ?? lo.shortName ?? lo.abbreviation ?? '');
      leagueLogo = String(lo.logo ?? lo.logoUrl ?? '');
      if (Array.isArray(lo.logos) && lo.logos.length > 0) leagueLogo = String((lo.logos[0] as Record<string,unknown>).href ?? (lo.logos[0] as Record<string,unknown>).url ?? leagueLogo);
    } else if (rawLeague) {
      const candidate = String(rawLeague);
      leagueName = looksLikeFixtureName(candidate) ? '' : candidate;
    }
  }
  if (!leagueName && firstComp) { const season = firstComp.season as Record<string, unknown> | undefined; if (season?.slug) leagueName = String(season.slug); }
  if (!leagueLogo) leagueLogo = String(r.leagueLogo ?? r.league_logo ?? r.competitionLogo ?? r.competition_logo ?? '');
  if (!leagueName && homeTeam && awayTeam) leagueName = inferLeagueFromTeams(homeTeam, awayTeam);
  let status = '';
  const rawStatus = (firstComp?.status) ?? r.status ?? r.matchStatus ?? r.match_status ?? r.state;
  if (rawStatus && typeof rawStatus === 'object') {
    const so = rawStatus as Record<string, unknown>;
    const typeObj = so.type as Record<string, unknown> | undefined;
    status = String(typeObj?.name ?? typeObj?.description ?? so.name ?? so.description ?? so.state ?? '');
  } else status = String(rawStatus ?? '');
  let scoreHome: number | undefined;
  let scoreAway: number | undefined;
  const rawScoreHome = r.scoreHome ?? r.score_home ?? r.homeScore ?? r.home_score;
  const rawScoreAway = r.scoreAway ?? r.score_away ?? r.awayScore ?? r.away_score;
  if (rawScoreHome != null) scoreHome = Number(rawScoreHome); else if (homeObj?.score != null) scoreHome = Number(homeObj.score);
  if (rawScoreAway != null) scoreAway = Number(rawScoreAway); else if (awayObj?.score != null) scoreAway = Number(awayObj.score);
  const scoreCompetitors = competitorsArr ?? nestedCompetitors ?? [];
  if (scoreHome == null || scoreAway == null) {
    for (const c of scoreCompetitors) {
      const side = String(c.homeAway ?? '').toLowerCase();
      const s = c.score != null ? Number(c.score) : undefined;
      if (side === 'home' && s != null && scoreHome == null) scoreHome = s;
      if (side === 'away' && s != null && scoreAway == null) scoreAway = s;
    }
  }
  const kickoffAt = String(r.kickoffAt ?? r.kickoff_at ?? r.startTime ?? r.start_time ?? r.date ?? r.scheduledAt ?? r.datetime ?? firstComp?.date ?? '');
  const rawHomeLogo = String(r.homeLogo ?? r.home_logo ?? r.homeCrest ?? r.homeTeamLogo ?? r.home_team_logo ?? r.homeImage ?? r.home_image ?? r.homePhoto ?? r.home_photo ?? homeObj?.logo ?? homeObj?.logoUrl ?? homeObj?.crest ?? homeObj?.image ?? homeObj?.photo ?? '').trim() || getLogoFromObj(homeObj);
  const rawAwayLogo = String(r.awayLogo ?? r.away_logo ?? r.awayCrest ?? r.awayTeamLogo ?? r.away_team_logo ?? r.awayImage ?? r.away_image ?? r.awayPhoto ?? r.away_photo ?? awayObj?.logo ?? awayObj?.logoUrl ?? awayObj?.crest ?? awayObj?.image ?? awayObj?.photo ?? '').trim() || getLogoFromObj(awayObj);
  const homeLogo = sanitizeLogo(rawHomeLogo);
  const awayLogo = sanitizeLogo(rawAwayLogo);
  let minutePlayed: number | undefined;
  if (r.minutePlayed != null) minutePlayed = Number(r.minutePlayed);
  else if (r.minute_played != null) minutePlayed = Number(r.minute_played);
  else if (rawStatus && typeof rawStatus === 'object') {
    const so = rawStatus as Record<string, unknown>;
    const clock = so.displayClock ?? so.clock;
    if (clock) { const mins = parseInt(String(clock), 10); if (!isNaN(mins)) minutePlayed = mins; }
  }
  return { id, source: (r.source as Match['source']) ?? 'ESPN', homeTeam, awayTeam, league: leagueName, status, kickoffAt, scoreHome, scoreAway, homeLogo, awayLogo, leagueLogo, minutePlayed, sport: String(r.sport ?? 'FOOTBALL'), createdAt: String(r.createdAt ?? r.created_at ?? '') } as Match;
}

function normalizeAdminMatch(raw: unknown): Match | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? r.matchId ?? r.match_id ?? '');
  if (!id || id === 'undefined') return null;
  const homeTeam = String(r.homeTeam ?? r.home_team ?? r.homeName ?? r.home_name ?? '').trim();
  const awayTeam = String(r.awayTeam ?? r.away_team ?? r.awayName ?? r.away_name ?? '').trim();
  let leagueName = '';
  let leagueLogo = '';
  const rawLeague = r.league ?? r.leagueName ?? r.league_name ?? r.competition ?? r.competitionName;
  if (rawLeague && typeof rawLeague === 'object') {
    const lo = rawLeague as Record<string, unknown>;
    leagueName = String(lo.name ?? lo.displayName ?? lo.shortName ?? '');
    leagueLogo = String(lo.logo ?? lo.logoUrl ?? lo.logo_url ?? '');
  } else if (typeof rawLeague === 'string' && rawLeague.trim()) leagueName = rawLeague.trim();
  if (!leagueLogo) leagueLogo = sanitizeLogo(String(r.leagueLogo ?? r.league_logo ?? r.competitionLogo ?? r.competition_logo ?? ''));
  if (!leagueName && homeTeam && awayTeam) leagueName = inferLeagueFromTeams(homeTeam, awayTeam);
  const status = String(r.status ?? r.matchStatus ?? r.match_status ?? '');
  const scoreHome = r.scoreHome != null ? Number(r.scoreHome) : r.score_home != null ? Number(r.score_home) : r.homeScore != null ? Number(r.homeScore) : undefined;
  const scoreAway = r.scoreAway != null ? Number(r.scoreAway) : r.score_away != null ? Number(r.score_away) : r.awayScore != null ? Number(r.awayScore) : undefined;
  const kickoffAt = String(r.kickoffAt ?? r.kickoff_at ?? r.startTime ?? r.start_time ?? r.date ?? r.scheduledAt ?? '');
  const minutePlayed = r.minutePlayed != null ? Number(r.minutePlayed) : r.minute_played != null ? Number(r.minute_played) : undefined;
  return { id, source: 'ADMIN_CREATED' as Match['source'], homeTeam: homeTeam || 'Home Team', awayTeam: awayTeam || 'Away Team', league: leagueName, status, kickoffAt, scoreHome, scoreAway, homeLogo: '', awayLogo: '', leagueLogo, minutePlayed, sport: String(r.sport ?? 'FOOTBALL'), createdAt: String(r.createdAt ?? r.created_at ?? '') } as Match;
}

function safeUnwrapList(raw: unknown): Match[] {
  if (!raw) return [];
  const normalize = (arr: unknown[]): Match[] => arr.map(normalizeMatch).filter((m): m is Match => m !== null);
  if (Array.isArray(raw)) return normalize(raw);
  const obj = raw as Record<string, unknown>;
  if (!obj.success || !obj.data) return [];
  if (Array.isArray(obj.data)) return normalize(obj.data);
  if (typeof obj.data === 'object') { const all: unknown[] = []; for (const val of Object.values(obj.data as Record<string, unknown>)) if (Array.isArray(val)) all.push(...val); return normalize(all); }
  return [];
}

function dedup(matches: Match[]): EnrichedMatch[] {
  const seen = new Set<string>();
  return matches.filter(({ id }) => { if (seen.has(id)) return false; seen.add(id); return true; }).map((m) => ({ ...m }));
}

function safeUnwrapOddsArray(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  if (!obj.success) return [];
  return Array.isArray(obj.data) ? obj.data : [];
}

function unwrapAdminMatches(raw: unknown): Match[] {
  if (!raw) return [];
  const obj = raw as Record<string, unknown>;
  if (!obj.success || !Array.isArray(obj.data)) return [];
  return (obj.data as unknown[]).reduce<Match[]>((acc, item) => { const match = normalizeAdminMatch(item); if (match?.id) acc.push(match); return acc; }, []);
}

async function fetchAdminMatchOdds(matchId: string): Promise<unknown[]> {
  try { return safeUnwrapOddsArray(await fetch(`${ADMIN_MATCHES_BASE}/api/public/admin-matches/${matchId}/odds`).then((r) => r.json())); }
  catch { return []; }
}

function mergeOddsById(oddsById: Map<string, unknown[]>, entries: Array<{ match: Match; odds: unknown[] }>): void {
  for (const { match, odds } of entries) {
    if (odds.length === 0) continue;
    const existing = oddsById.get(match.id);
    if (!existing || odds.length > existing.length) oddsById.set(match.id, odds);
  }
}

async function fetchAllFootballMatches(): Promise<EnrichedMatch[]> {
  const [withOddsRes, liveRes, upcomingRes, todayRes, resultsRes, livescoreLiveRes, livescoreTodayRes, allCupsUpcomingRes, allCupsTodayRes, allCupsLive] = await Promise.allSettled([
    api.publicFootball.withAllOdds(), api.publicFootball.live(), api.publicFootball.upcoming(), api.publicFootball.today(), api.publicFootball.results(50),
    api.publicFootballLivescore.live(), api.publicFootballLivescore.today(), api.publicFootball.allCupsUpcoming(), api.publicFootball.allCupsToday(), api.publicFootball.allCupsLive(),
  ]);
  const oddsById = new Map<string, unknown[]>();
  const withOddsItems     = withOddsRes.status  === 'fulfilled' ? unwrapWithAllOdds(withOddsRes.value)   : [];
  const fromUpcomingItems = upcomingRes.status   === 'fulfilled' ? unwrapWithAllOdds(upcomingRes.value)   : [];
  const fromTodayItems    = todayRes.status      === 'fulfilled' ? unwrapWithAllOdds(todayRes.value)      : [];
  mergeOddsById(oddsById, withOddsItems); mergeOddsById(oddsById, fromUpcomingItems); mergeOddsById(oddsById, fromTodayItems);
  if (liveRes.status === 'fulfilled') mergeOddsById(oddsById, unwrapWithAllOdds(liveRes.value));
  const oddsByFingerprint = new Map<string, unknown[]>();
  const makeFingerprint = (home: string, away: string, kickoff: string) => `${home.toLowerCase().trim()}|${away.toLowerCase().trim()}|${kickoff.slice(0, 10)}`;
  for (const [matchId, odds] of oddsById.entries()) {
    const sourceMatch = [...withOddsItems, ...fromUpcomingItems, ...fromTodayItems].find(({ match }) => match.id === matchId)?.match;
    if (sourceMatch?.homeTeam && sourceMatch?.awayTeam && sourceMatch?.kickoffAt) {
      const fp = makeFingerprint(sourceMatch.homeTeam, sourceMatch.awayTeam, sourceMatch.kickoffAt);
      if (!oddsByFingerprint.has(fp)) oddsByFingerprint.set(fp, odds);
    }
  }
  const allMatches: Match[] = [
    ...withOddsItems.map(({ match }) => match),
    ...(liveRes.status === 'fulfilled' ? safeUnwrapList(liveRes.value) : []),
    ...fromUpcomingItems.map(({ match }) => match),
    ...fromTodayItems.map(({ match }) => match),
    ...(resultsRes.status === 'fulfilled' ? safeUnwrapList(resultsRes.value) : []),
    ...(allCupsUpcomingRes.status === 'fulfilled' ? safeUnwrapList(allCupsUpcomingRes.value) : []),
    ...(allCupsTodayRes.status === 'fulfilled' ? safeUnwrapList(allCupsTodayRes.value) : []),
    ...(allCupsLive.status === 'fulfilled' ? safeUnwrapList(allCupsLive.value) : []),
    ...(livescoreLiveRes.status === 'fulfilled' ? safeUnwrapList(livescoreLiveRes.value) : []),
    ...(livescoreTodayRes.status === 'fulfilled' ? safeUnwrapList(livescoreTodayRes.value) : []),
  ];
  const seenIds = new Set<string>(); const seenFps = new Set<string>();
  const dedupedMatches = allMatches.filter((m) => {
    if (!m?.id || seenIds.has(m.id)) return false; seenIds.add(m.id);
    const fp = `${(m.homeTeam ?? '').toLowerCase()}|${(m.awayTeam ?? '').toLowerCase()}|${(m.kickoffAt ?? '').slice(0,16)}`;
    if (fp !== '||' && seenFps.has(fp)) return false; if (fp !== '||') seenFps.add(fp); return true;
  });
  const enrichedPass1 = dedupedMatches.map((match) => {
    let odds = oddsById.get(match.id) ?? [];
    if (odds.length === 0 && match.homeTeam && match.awayTeam && match.kickoffAt) {
      const fp = makeFingerprint(match.homeTeam, match.awayTeam, match.kickoffAt);
      const fpOdds = oddsByFingerprint.get(fp);
      if (fpOdds?.length) odds = fpOdds;
    }
    const oddsMap = extractOddsMap(odds, match.homeTeam ?? '', match.awayTeam ?? '');
    const needsOdds = !oddsMap && !FINISHED_STATUSES.has(match.status ?? '');
    return { ...match, oddsMap, _needsOdds: needsOdds };
  });
  const needsIndividualOdds = enrichedPass1.filter((m) => m._needsOdds).slice(0, 30);
  const individualOddsResults = await Promise.allSettled(needsIndividualOdds.map((m) => api.publicFootball.odds(m.id).then((r) => ({ matchId: m.id, data: r })).catch(() => ({ matchId: m.id, data: null }))));
  const individualOddsMap = new Map<string, unknown[]>();
  individualOddsResults.forEach((result) => { if (result.status === 'fulfilled' && result.value.data) { const arr = safeUnwrapOddsArray(result.value.data); if (arr.length > 0) individualOddsMap.set(result.value.matchId, arr); } });
  const enriched = enrichedPass1.map(({ _needsOdds, ...match }) => {
    if (!_needsOdds || match.oddsMap) return match as EnrichedMatch;
    const indOdds = individualOddsMap.get(match.id) ?? [];
    if (indOdds.length === 0) return match as EnrichedMatch;
    return { ...match, oddsMap: extractOddsMap(indOdds, match.homeTeam ?? '', match.awayTeam ?? '') } as EnrichedMatch;
  });
  return enriched.map(withGuaranteedOdds);
}

// ---------------------------------------------------------------------------
// Time-tab filtering
// ---------------------------------------------------------------------------
function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function isWithinThisWeek(date: Date, now: Date): boolean {
  const endOfWeek = new Date(now);
  const daysUntilSunday = 7 - now.getDay();
  endOfWeek.setDate(now.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);
  return date >= now && date <= endOfWeek;
}

function isHighlightMatch(match: EnrichedMatch): boolean {
  const league = match.league ?? '';
  return TOP_6_LEAGUE_DISPLAY_NAMES.includes(league) || CUPS_LABELS.has(league);
}

function filterByTimeTab(matches: EnrichedMatch[], tab: TimeTab): { matches: EnrichedMatch[]; isFallback: boolean } {
  if (tab === 'all') return { matches, isFallback: false };
  if (tab === 'live') {
    const filtered = matches.filter((m) => LIVE_STATUSES.has(m.status ?? ''));
    return { matches: filtered, isFallback: false };
  }
  if (tab === 'highlights') {
    const filtered = matches.filter(isHighlightMatch);
    return filtered.length === 0 ? { matches, isFallback: true } : { matches: filtered, isFallback: false };
  }
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const filtered = matches.filter((m) => {
    if (!m.kickoffAt) return false;
    const kickoff = new Date(m.kickoffAt);
    if (tab === 'today') return isSameCalendarDay(kickoff, now);
    if (tab === 'tomorrow') return isSameCalendarDay(kickoff, tomorrow);
    if (tab === 'this_week') return isWithinThisWeek(kickoff, now);
    return true;
  });
  return filtered.length === 0 ? { matches, isFallback: true } : { matches: filtered, isFallback: false };
}

const ADMIN_FINISHED_LINGER_MS = 10_000;

// ---------------------------------------------------------------------------
// useAdminMatches — shared hook that fetches/polls admin (Highlights)
// matches once, applies odds + logos + the "linger 10s after finish then
// hide" rule, and returns the visible list + team fingerprints. Highlights
// and Match of the Day both consume this same data instead of each
// fetching it privately.
// ---------------------------------------------------------------------------
function useAdminMatches(): { matches: EnrichedMatch[]; fingerprints: Set<string> } {
  const permanentlyHiddenRef = useRef<Set<string>>(loadHiddenAdminIds());
  const finishedAtRef = useRef<Map<string, number>>(new Map());
  const [sessionHiddenIds, setSessionHiddenIds] = useState<Set<string>>(new Set());
  const [adminMatches, setAdminMatches] = useState<EnrichedMatch[]>([]);
  const genRef = useRef(0);

  useEffect(() => {
    const myGen = ++genRef.current;
    const alive = () => myGen === genRef.current;
    async function load() {
      try {
        const raw = await fetch(`${ADMIN_MATCHES_BASE}/api/public/admin-matches?ngrok-skip-browser-warning=true`).then((r) => r.json());
        if (!alive()) return;
        const matches = unwrapAdminMatches(raw);
        if (matches.length === 0) { setAdminMatches([]); return; }
        const oddsResults = await Promise.allSettled(matches.map((m) => fetchAdminMatchOdds(m.id)));
        if (!alive()) return;
        const enriched: EnrichedMatch[] = matches.map((match, idx) => {
          const oddsArr = oddsResults[idx].status === 'fulfilled' ? oddsResults[idx].value : [];
          return { ...match, oddsMap: extractOddsMap(oddsArr, match.homeTeam ?? '', match.awayTeam ?? '') };
        });
        const withOdds = enriched.map(withGuaranteedOdds);
        const withLogos = assignAdminLogos(withOdds);
        const now = Date.now();
        for (const m of withLogos) {
          if (FINISHED_STATUSES.has(m.status ?? '') && !finishedAtRef.current.has(m.id) && !permanentlyHiddenRef.current.has(m.id)) {
            finishedAtRef.current.set(m.id, now);
          }
        }
        setAdminMatches(withLogos);
      } catch { /* silent */ }
    }
    load();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 15_000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { genRef.current++; clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const [id, finishedAt] of finishedAtRef.current.entries()) {
      if (permanentlyHiddenRef.current.has(id) || sessionHiddenIds.has(id)) continue;
      const remaining = ADMIN_FINISHED_LINGER_MS - (Date.now() - finishedAt);
      const hide = () => {
        addHiddenAdminId(id);
        permanentlyHiddenRef.current.add(id);
        setSessionHiddenIds((prev) => new Set([...prev, id]));
      };
      if (remaining <= 0) hide(); else timers.push(setTimeout(hide, remaining));
    }
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminMatches]);

  const visibleMatches = useMemo(() => adminMatches.filter((m) => {
    if (permanentlyHiddenRef.current.has(m.id)) return false;
    if (FINISHED_STATUSES.has(m.status ?? '')) return finishedAtRef.current.has(m.id);
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [adminMatches, sessionHiddenIds]);

  const fingerprints = useMemo(() => buildAdminTeamFingerprints(visibleMatches), [visibleMatches]);

  return { matches: visibleMatches, fingerprints };
}

// ---------------------------------------------------------------------------
// pickFeaturedTeamToWin — for the Highlights "Team to Win" banner. Picks a
// day-seeded random ADMIN match, then the favorite (lower odd) side, and
// returns that team + its odds, e.g. { team: 'France', odd: 1.85 }.
// ---------------------------------------------------------------------------
function pickFeaturedTeamToWin(matches: EnrichedMatch[]): { match: EnrichedMatch; team: string; odd: number } | null {
  const eligible = matches.filter(
    (m) => !FINISHED_STATUSES.has(m.status ?? '') && !LIVE_STATUSES.has(m.status ?? '')
      && m.oddsMap && ((m.oddsMap.home ?? 0) > 0 || (m.oddsMap.away ?? 0) > 0),
  );
  if (eligible.length === 0) return null;
  const seed = hashStringToSeed([...eligible.map((m) => m.id)].sort().join('|') + new Date().toDateString());
  const rand = seededRandom(seed);
  const match = eligible[Math.floor(rand() * eligible.length)];
  const home = match.oddsMap?.home ?? 0;
  const away = match.oddsMap?.away ?? 0;
  const pickHome = home > 0 && (away <= 0 || home <= away);
  const team = pickHome ? match.homeTeam : match.awayTeam;
  const odd = pickHome ? home : away;
  return { match, team, odd };
}

// ---------------------------------------------------------------------------
// deriveHighlightFallbackMatches — used when there are NO admin matches.
// Pulls real "highlight-worthy" games (top-6 leagues, cups, or World Cup /
// country fixtures) that are live or kicking off today/tomorrow, so the
// Highlights section + "Team to Win" banner still have something to show.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// deriveHighlightFallbackMatches — used when there are NO admin matches.
// Pulls ALL real games that are live or kicking off today/tomorrow — not
// restricted to top-6 leagues/cups/World Cup — so Highlights always has
// something to show. Highlight-worthy matches (top leagues, cups, World
// Cup/country fixtures) are simply sorted to the front.
// ---------------------------------------------------------------------------
function deriveHighlightFallbackMatches(matches: EnrichedMatch[]): EnrichedMatch[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() + 4); // today + tomorrow window

  const eligible = matches.filter((m) => {
    if (FINISHED_STATUSES.has(m.status ?? '')) return false;
    if (LIVE_STATUSES.has(m.status ?? '')) return true;
    if (!m.kickoffAt) return false;
    return new Date(m.kickoffAt) <= cutoff;
  });

  return eligible
    .sort((a, b) => {
      const aPrestige = isHighlightMatch(a) || isWorldCupCountryMatch(a) ? 0 : 1;
      const bPrestige = isHighlightMatch(b) || isWorldCupCountryMatch(b) ? 0 : 1;
      if (aPrestige !== bPrestige) return aPrestige - bPrestige;
      const ta = a.kickoffAt ? new Date(a.kickoffAt).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.kickoffAt ? new Date(b.kickoffAt).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    })
    .slice(0, 14);
}
// ---------------------------------------------------------------------------
// ResultMatchRow
// ---------------------------------------------------------------------------
function ResultMatchRow({ match, matchIndex }: { match: EnrichedMatch; matchIndex: number }) {
  const navigate = useNavigate();
  const winner = getMatchWinner(match);
  const resultLabel = getResultLabel(match);
  const hasScore = match.scoreHome != null && match.scoreAway != null;
  const dateStr = formatMatchDate(match.kickoffAt);
  const timeStr = match.kickoffAt ? formatKickoff(match.kickoffAt) : '';
  const isWorldCup = isWorldCupCountryMatch(match);

  return (
    <div className="rmr" onClick={() => navigate(`/match/${match.id}`)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/match/${match.id}`); }}>
      <div className="rmr-left">
        <span className="rmr-date">{dateStr}</span>
        <span className="rmr-time">{timeStr}</span>
        <span className="rmr-idx">#{matchIndex}</span>
      </div>
      <div className="rmr-center">
        <div className={`rmr-team${winner === 'home' ? ' rmr-winner' : winner === 'draw' ? ' rmr-draw-team' : ' rmr-loser'}`}>
          <div className="rmr-team-info">
            {isWorldCup
              ? <FlagImage country={match.homeTeam} size={28} />
              : <TeamLogoImage src={match.homeLogo || match.adminHomeLogo} alt={match.homeTeam} size={28} />}
            <span className="rmr-team-name">{match.homeTeam}</span>
          </div>
          {hasScore && <span className={`rmr-score${winner === 'home' ? ' rmr-score-win' : ''}`}>{match.scoreHome}</span>}
        </div>
        <div className={`rmr-team${winner === 'away' ? ' rmr-winner' : winner === 'draw' ? ' rmr-draw-team' : ' rmr-loser'}`}>
          <div className="rmr-team-info">
            {isWorldCup
              ? <FlagImage country={match.awayTeam} size={28} />
              : <TeamLogoImage src={match.awayLogo || match.adminAwayLogo} alt={match.awayTeam} size={28} />}
            <span className="rmr-team-name">{match.awayTeam}</span>
          </div>
          {hasScore && <span className={`rmr-score${winner === 'away' ? ' rmr-score-win' : ''}`}>{match.scoreAway}</span>}
        </div>
      </div>
      <div className="rmr-right">
        <span className={`rmr-badge${winner === 'draw' ? ' rmr-badge-draw' : ''}`}>{resultLabel}</span>
        {match.league && <span className="rmr-league">{match.league}</span>}
      </div>
      <button className="cmr-stats" onClick={(e) => { e.stopPropagation(); navigate(`/match/${match.id}`); }} aria-label="stats">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompactMatchRow — fully responsive: adapts to any screen width.
// ---------------------------------------------------------------------------
function CompactMatchRow({
  match, hasDraw = true, onClick, isAdmin = false, matchIndex,
}: {
  match: EnrichedMatch; hasDraw?: boolean; onClick?: () => void; isAdmin?: boolean; matchIndex: number;
}) {
  const { betSlip, addToBetSlip, showToast } = useAppStore() as { betSlip: BetSlipEntry[]; addToBetSlip: (e: BetSlipEntry) => void; showToast: (m: string, t: string) => void; };
  const status = match.status ?? '';
  const isLive = LIVE_STATUSES.has(status);
  const isWorldCup = isWorldCupCountryMatch(match);
  const timerStr = useLiveTimer(match);
  const odds = match.oddsMap;
  const dateStr = match.kickoffAt ? formatMatchDate(match.kickoffAt) : '';

  const isSel = (sel: string) => (betSlip as BetSlipEntry[]).some((s) => s.matchId === match.id && s.market === '1X2' && s.selection === sel);
  const pick = (sel: string, odd: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLive) return;
    if (!odd || odd <= 0) return;
    addToBetSlip({ matchId: match.id, matchName: `${match.homeTeam} vs ${match.awayTeam}`, market: '1X2', selection: sel, odd });
    showToast('Added to bet slip', 'success');
  };
  const handleRowClick = () => { if (isLive) return; onClick?.(); };
  const oddsSlots = hasDraw
    ? [{ key: '1', val: odds?.home ?? 0 }, { key: 'X', val: odds?.draw ?? 0 }, { key: '2', val: odds?.away ?? 0 }]
    : [{ key: '1', val: odds?.home ?? 0 }, { key: '2', val: odds?.away ?? 0 }];

  return (
    <div className={`cmr${isLive ? ' live' : ''}${isAdmin ? ' admin' : ''}${isLive ? ' no-pointer' : ''}`}
      onClick={handleRowClick} role={isLive ? 'presentation' : 'button'} tabIndex={isLive ? -1 : 0}
      onKeyDown={(e) => { if (!isLive && (e.key === 'Enter' || e.key === ' ')) onClick?.(); }}
      style={isLive ? { cursor: 'default' } : undefined}>
      <div className="cmr-left">
        {isAdmin && <span className="cmr-star">★</span>}
        {isLive ? (
          <span className="cmr-live"><FiberManualRecordIcon sx={{ fontSize: 8 }} />{timerStr || 'LIVE'}</span>
        ) : (
          <>
            {dateStr && <span className="cmr-date">{dateStr}</span>}
            <span className="cmr-time">{match.kickoffAt ? formatKickoff(match.kickoffAt) : '--:--'}</span>
          </>
        )}
        <span className="cmr-id">#{matchIndex}</span>
      </div>
      <div className="cmr-teams">
        <div className="cmr-team">
          {isLive && <span className="cmr-score">{match.scoreHome ?? 0}</span>}
          {isWorldCup
            ? <FlagImage country={match.homeTeam} size={26} />
            : <TeamLogoImage src={match.homeLogo || match.adminHomeLogo} alt={match.homeTeam} size={26} />}
          <span className="cmr-name">{match.homeTeam}</span>
        </div>
        <div className="cmr-team">
          {isLive && <span className="cmr-score">{match.scoreAway ?? 0}</span>}
          {isWorldCup
            ? <FlagImage country={match.awayTeam} size={26} />
            : <TeamLogoImage src={match.awayLogo || match.adminAwayLogo} alt={match.awayTeam} size={26} />}
          <span className="cmr-name">{match.awayTeam}</span>
        </div>
        {!isLive && match.kickoffAt && (
          <div className="cmr-countdown"><ScheduleIcon sx={{ fontSize: 10, opacity: 0.4 }} />{formatCountdown(match.kickoffAt)}</div>
        )}
      </div>
      <div className="cmr-odds">
        {isLive ? (
          <div className="cmr-odds-locked">
            <LockIcon sx={{ fontSize: 13, color: 'rgba(59, 130, 246,0.6)' }} />
            <span className="cmr-locked-label">Live · Locked</span>
          </div>
        ) : (
          oddsSlots.map(({ key, val }) => (
            <button key={key} className={`cmr-btn${val <= 0 ? ' empty' : isSel(key) ? ' sel' : ''}`}
              onClick={(e) => val > 0 && pick(key, val, e)} disabled={val <= 0}>
              <span className="cmr-btn-label">{key}</span>
              <span className="cmr-btn-val">{val > 0 ? val.toFixed(2) : '—'}</span>
            </button>
          ))
        )}
      </div>
      {!isLive && (
        <button className="cmr-stats" onClick={(e) => { e.stopPropagation(); onClick?.(); }} aria-label="stats">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </button>
      )}
      {isLive && <div style={{ width: 28, flexShrink: 0 }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// useLiveTimer
// ---------------------------------------------------------------------------
function useLiveTimer(match: EnrichedMatch): string {
  const status = match.status ?? '';
  const isLive = LIVE_STATUSES.has(status);
  const getElapsedMins = useCallback((): number => {
    if (match.kickoffAt) { const elapsed = Date.now() - new Date(match.kickoffAt).getTime(); if (elapsed >= 0) return Math.floor(elapsed / 60_000); }
    return match.minutePlayed ?? 0;
  }, [match.kickoffAt, match.minutePlayed]);
  const [elapsed, setElapsed] = useState<number>(getElapsedMins);
  useEffect(() => {
    if (!isLive) return;
    setElapsed(getElapsedMins());
    const id = setInterval(() => setElapsed(getElapsedMins()), 30_000);
    return () => clearInterval(id);
  }, [isLive, getElapsedMins]);
  if (!isLive) return '';
  if (HALFTIME_STATUSES.has(status)) return 'HT';
  if (PENALTY_STATUSES.has(status)) return 'PEN';
  if (EXTRA_TIME_STATUSES.has(status)) return `${Math.min(elapsed, 120)}' ET`;
  return `${match.minutePlayed != null ? match.minutePlayed : Math.min(elapsed, 90)}'`;
}

// ---------------------------------------------------------------------------
// HighlightsSection — ADMIN GAMES ONLY (never World Cup / country matches).
// Shows a "Team to Win" featured pick banner (random admin match + its
// favorite team's odds to win) above the list of admin matches.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// getMatchWinnerPick — picks the favorite (lower-odd) side for a SINGLE
// match. Used to render one "Team to win @ odd" prediction card per game
// in the Highlights section.
// ---------------------------------------------------------------------------
function getMatchWinnerPick(match: EnrichedMatch): { team: string; odd: number; selection: '1' | '2' } | null {
  const home = match.oddsMap?.home ?? 0;
  const away = match.oddsMap?.away ?? 0;
  if (home <= 0 && away <= 0) return null;
  const pickHome = home > 0 && (away <= 0 || home <= away);
  return pickHome
    ? { team: match.homeTeam, odd: home, selection: '1' }
    : { team: match.awayTeam, odd: away, selection: '2' };
}

function HighlightsSection({
  matches, globalIndexStart: _globalIndexStart, isAdminSource: _isAdminSource = true,
}: {
  matches: EnrichedMatch[]; globalIndexStart: number; isAdminSource?: boolean;
}) {
  const { betSlip, addToBetSlip, showToast } = useAppStore() as {
    betSlip: BetSlipEntry[];
    addToBetSlip: (e: BetSlipEntry) => void;
    showToast: (m: string, t: string) => void;
  };

  const sorted = useMemo(() => [...matches].sort((a, b) => {
    const ta = a.kickoffAt ? new Date(a.kickoffAt).getTime() : Number.POSITIVE_INFINITY;
    const tb = b.kickoffAt ? new Date(b.kickoffAt).getTime() : Number.POSITIVE_INFINITY;
    return ta - tb;
  }), [matches]);

  const picks = useMemo(() => sorted
    .map((m) => {
      const pick = getMatchWinnerPick(m);
      return pick ? { match: m, ...pick } : null;
    })
    .filter((p): p is { match: EnrichedMatch; team: string; odd: number; selection: '1' | '2' } => p !== null),
  [sorted]);

  if (picks.length === 0) return null;

  const liveCount = sorted.filter((m) => LIVE_STATUSES.has(m.status ?? '')).length;

  const isSel = (matchId: string, sel: string) =>
    betSlip.some((b) => b.matchId === matchId && b.market === '1X2' && b.selection === sel);

  const handlePick = (
    e: React.MouseEvent | React.KeyboardEvent,
    p: { match: EnrichedMatch; team: string; odd: number; selection: '1' | '2' },
  ) => {
    e.stopPropagation();
    addToBetSlip({
      matchId: p.match.id,
      matchName: `${p.match.homeTeam} vs ${p.match.awayTeam}`,
      market: '1X2',
      selection: p.selection,
      odd: p.odd,
    });
    showToast('Added to bet slip', 'success');
  };

  return (
    <div className="cmsec highlights">
      <div className="cmsec-hdr">
        <span className="cmsec-title">
          <StarIcon sx={{ fontSize: 13, color: '#facc15' }} />
          Highlights <span className="cmsec-cnt">({picks.length})</span>
        </span>
        {liveCount > 0 && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:700, color:'#3b82f6' }}><FiberManualRecordIcon sx={{ fontSize:8 }} />{liveCount} Live</span>}
      </div>

      <div className="hl-grid">
        {picks.map(({ match, team, odd, selection }) => {
          const selected = isSel(match.id, selection);
          const isLive = LIVE_STATUSES.has(match.status ?? '');
          const isWorldCup = isWorldCupCountryMatch(match);
          const opponent = selection === '1' ? match.awayTeam : match.homeTeam;
          const whenLabel = isLive
            ? 'LIVE'
            : match.kickoffAt
              ? `${formatMatchDate(match.kickoffAt)} · ${formatKickoff(match.kickoffAt)}`
              : '';

          return (
            <div
              key={`hl-pick-${match.id}`}
              className={`hl-card${selected ? ' sel' : ''}${isLive ? ' live' : ''}`}
              onClick={(e) => handlePick(e, { match, team, odd, selection })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePick(e, { match, team, odd, selection }); }}
            >
              <div className="hl-card-top">
                {isWorldCup ? (
                  <FlagImage country={team} size={26} />
                ) : (
                  <div className="hl-card-badge"><SportsSoccerIcon sx={{ fontSize: 13, color: '#3b82f6' }} /></div>
                )}
                <span className={`hl-card-when${isLive ? ' live' : ''}`}>
                  {isLive && <FiberManualRecordIcon sx={{ fontSize: 7 }} />}
                  {whenLabel}
                </span>
              </div>

              <div className="hl-card-body">
                <span className="hl-card-team">{team}</span>
                <span className="hl-card-vs">vs {opponent}</span>
              </div>

              <div className="hl-card-foot">
                <span className="hl-card-label">To Win</span>
                <span className="hl-card-odd">{odd.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .hl-grid {
          display: flex;
          overflow-x: auto;
          overflow-y: visible;
          gap: 8px;
          padding: 10px 12px 12px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scrollbar-color: rgba(59, 130, 246,0.3) transparent;
        }
        .hl-grid::-webkit-scrollbar {
          height: 4px;
        }
        .hl-grid::-webkit-scrollbar-track {
          background: transparent;
        }
        .hl-grid::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246,0.3);
          border-radius: 4px;
        }

        .hl-card {
          flex: 0 0 auto;
          width: 160px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px;
          border-radius: 10px;
          background: linear-gradient(160deg, rgba(59, 130, 246,0.08) 0%, rgba(13,31,60,0.4) 100%);
          border: 1.5px solid rgba(59, 130, 246,0.18);
          cursor: pointer;
          transition: background 0.14s, border-color 0.14s, transform 0.1s;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          scroll-snap-align: start;
        }
        .hl-card:hover { border-color: rgba(59, 130, 246,0.45); background: linear-gradient(160deg, rgba(59, 130, 246,0.14) 0%, rgba(13,31,60,0.5) 100%); }
        .hl-card:active { transform: scale(0.97); }
        .hl-card.live { border-color: rgba(239,68,68,0.35); }
        .hl-card.sel { border-color: #3b82f6; background: linear-gradient(160deg, rgba(59, 130, 246,0.28) 0%, rgba(13,31,60,0.6) 100%); box-shadow: 0 0 0 2px rgba(59, 130, 246,0.25); }

        .hl-card-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .hl-card-badge { width: 26px; height: 26px; border-radius: 6px; background: rgba(59, 130, 246,0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .hl-card-when { font-size: 9px; font-weight: 700; color: #6b7280; letter-spacing: 0.03em; white-space: nowrap; text-transform: uppercase; font-family: system-ui, sans-serif; display: flex; align-items: center; gap: 3px; }
        .hl-card-when.live { color: #f87171; }

        .hl-card-body { display: flex; flex-direction: column; gap: 2px; min-height: 34px; justify-content: center; }
        .hl-card-team { font-size: 14px; font-weight: 800; color: #f1f5f9; font-family: system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
        .hl-card-vs { font-size: 10px; font-weight: 600; color: #6b7280; font-family: system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .hl-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding-top: 8px; border-top: 1px solid rgba(59, 130, 246,0.12); }
        .hl-card-label { font-size: 9px; font-weight: 800; color: #facc15; letter-spacing: 0.06em; text-transform: uppercase; font-family: system-ui, sans-serif; }
        .hl-card-odd { font-size: 17px; font-weight: 900; color: #f1f5f9; font-family: system-ui, sans-serif; letter-spacing: -0.01em; }
        .hl-card.sel .hl-card-odd { color: #60a5fa; }
        .hl-card.sel .hl-card-label { color: #bfdbfe; }

        @media (max-width: 480px) {
          .hl-grid { gap: 6px; padding: 8px 8px 10px; }
          .hl-card { width: 138px; padding: 8px; gap: 6px; }
          .hl-card-team { font-size: 12px; }
          .hl-card-vs { font-size: 9px; }
          .hl-card-odd { font-size: 15px; }
        }
      `}</style>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="cmr" style={{ cursor:'default', pointerEvents:'none' }}>
      <div className="cmr-left">
        <div className="skeleton-block" style={{ width:40, height:13, borderRadius:4 }} />
        <div className="skeleton-block" style={{ width:24, height:10, borderRadius:3, marginTop:5 }} />
      </div>
      <div className="cmr-teams">
        <div className="skeleton-block" style={{ width:'72%', height:13, borderRadius:4, marginBottom:5 }} />
        <div className="skeleton-block" style={{ width:'58%', height:13, borderRadius:4 }} />
      </div>
      <div className="cmr-odds">{[0,1,2].map((i) => <div key={i} className="cmr-btn empty skeleton-block" style={{ width:60 }} />)}</div>
      <div style={{ width:28 }} />
    </div>
  );
}

function FallbackNotice({ tabLabel }: { tabLabel: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', marginBottom:10, borderRadius:8, background:'rgba(59, 130, 246,0.05)', border:'1px solid rgba(59, 130, 246,0.15)' }}>
      <span style={{ fontSize:14 }}>ℹ️</span>
      <span style={{ fontSize:12, color:'#6b7280', fontFamily:'system-ui,sans-serif' }}>
        No <strong style={{ color:'#d1d5db', fontWeight:700 }}>{tabLabel}</strong> matches right now — showing all available games.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultsSection — finished games; always rendered LAST in the main list.
// ---------------------------------------------------------------------------
function ResultsSection({ matches, startIdx }: { matches: EnrichedMatch[]; startIdx: number }) {
  const [expanded, setExpanded] = useState(false);
  const INITIAL_SHOW = 5;
  if (matches.length === 0) return null;
  const sorted = [...matches].sort((a, b) => {
    const ta = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
    const tb = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
    return tb - ta;
  });
  const visible = expanded ? sorted : sorted.slice(0, INITIAL_SHOW);

  return (
    <div className="cmsec results-section">
      <div className="cmsec-hdr" style={{ background: 'rgba(59, 130, 246,0.05)', borderBottomColor: 'rgba(59, 130, 246,0.12)' }}>
        <span className="cmsec-title" style={{ color: '#bfdbfe' }}>
          <HistoryIcon sx={{ fontSize: 12, color: '#60a5fa' }} />
          Recent Results <span className="cmsec-cnt">({matches.length})</span>
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#60a5fa', fontFamily:'system-ui,sans-serif' }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 12 }} />
          Final Scores
        </span>
      </div>
      <div className="cmsec-col-hdr" style={{ background: 'rgba(59, 130, 246,0.03)' }}>
        <div style={{ flex: 1 }} />
        <div style={{ width: 80, textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#4c7cb0', letterSpacing: '0.07em', flexShrink: 0 }}>SCORE</div>
        <div style={{ width: 60, textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#4c7cb0', letterSpacing: '0.07em', flexShrink: 0 }}>RESULT</div>
        <div style={{ width: 28, flexShrink: 0 }} />
      </div>
      {visible.map((m, idx) => (
        <ResultMatchRow key={m.id} match={m} matchIndex={startIdx + idx + 1} />
      ))}
      {sorted.length > INITIAL_SHOW && (
        <button onClick={() => setExpanded((p) => !p)}
          style={{ width: '100%', padding: '10px', background: 'rgba(59, 130, 246,0.05)', border: 'none', borderTop: '1px solid rgba(59, 130, 246,0.1)', color: '#60a5fa', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.12s' }}
          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246,0.1)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246,0.05)')}>
          {expanded ? (
            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg> Show less</>
          ) : (
            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg> Show {sorted.length - INITIAL_SHOW} more results</>
          )}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimeTabBar — pill-style tabs, horizontally scrollable on mobile
// ---------------------------------------------------------------------------
const TIME_TABS: { key: TimeTab; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'today',       label: 'Today' },
  { key: 'tomorrow',    label: 'Tomorrow' },
  { key: 'this_week',   label: 'This Week' },
  { key: 'highlights',  label: 'Highlights' },
  { key: 'live',        label: 'Live' },
];

function TimeTabBar({ active, onChange, liveCount }: { active: TimeTab; onChange: (tab: TimeTab) => void; liveCount: number }) {
  return (
    <div className="ttb-wrap">
      <div className="ttb-scroll no-scrollbar">
        {TIME_TABS.map((tab) => {
          const isLiveTab = tab.key === 'live';
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`ttb-pill${isActive ? ' active' : ''}${isLiveTab ? ' live-pill' : ''}`}
            >
              {isLiveTab && !isActive && <FiberManualRecordIcon sx={{ fontSize: 8, color: '#ef4444' }} />}
              <span>{tab.label}</span>
              {isLiveTab && liveCount > 0 && <span className="ttb-live-count">{liveCount}</span>}
            </button>
          );
        })}
      </div>
      <style>{`
        .ttb-wrap { margin-bottom: 14px; width: 100%; overflow: hidden; }
        .ttb-scroll { display: flex; align-items: center; gap: 8px; overflow-x: auto; padding: 2px 2px 6px; -webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory; }
        .ttb-scroll > * { scroll-snap-align: start; flex-shrink: 0; }
        .ttb-pill { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; padding: 8px 16px; border-radius: 999px; border: 1.5px solid rgba(59, 130, 246,0.2); background: #0d1f3c; color: #9ca3af; font-size: 12.5px; font-weight: 700; white-space: nowrap; cursor: pointer; font-family: system-ui, sans-serif; transition: background 0.14s, border-color 0.14s, color 0.14s, transform 0.08s; -webkit-tap-highlight-color: transparent; user-select: none; }
        .ttb-pill:hover { border-color: rgba(59, 130, 246,0.5); color: #e5e7eb; }
        .ttb-pill:active { transform: scale(0.97); }
        .ttb-pill.active { background: #1d4ed8; border-color: #1d4ed8; color: #fff; font-weight: 800; }
        .ttb-pill.active:hover { background: #1d4ed8; border-color: #1d4ed8; }
        .ttb-pill.live-pill { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #f87171; }
        .ttb-pill.live-pill:hover { background: rgba(239,68,68,0.16); border-color: rgba(239,68,68,0.5); color: #fca5a5; }
        .ttb-pill.live-pill.active { background: #ef4444; border-color: #ef4444; color: #fff; }
        .ttb-pill.live-pill.active:hover { background: #f24747; border-color: #f24747; color: #fff; }
        .ttb-live-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: rgba(255,255,255,0.18); color: inherit; font-size: 10.5px; font-weight: 800; line-height: 1; }
        .ttb-pill.live-pill:not(.active) .ttb-live-count { background: rgba(239,68,68,0.22); color: #f87171; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        @media (max-width: 640px) {
          .ttb-scroll { gap: 6px; padding: 2px 0 6px; }
          .ttb-pill { padding: 6px 12px; font-size: 11px; }
        }
        @media (max-width: 480px) {
          .ttb-scroll { gap: 5px; }
          .ttb-pill { padding: 5px 10px; font-size: 10px; }
          .ttb-live-count { min-width: 16px; height: 16px; font-size: 9px; padding: 0 4px; }
        }
        @media (max-width: 360px) {
          .ttb-pill { padding: 4px 8px; font-size: 9px; gap: 3px; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main MatchList
// ---------------------------------------------------------------------------
export default function MatchList() {
  const [activeTimeTab, setActiveTimeTab] = useState<TimeTab>('all');
  const [activeLeague, setActiveLeague] = useState<string | null>(null);
  const [allFootballMatches, setAllFootballMatches] = useState<EnrichedMatch[]>([]);
  const [footballLoading, setFootballLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { matches: adminMatches, fingerprints: adminFingerprints } = useAdminMatches();
  const footballGenRef = useRef(0);
  const abortControllersRef = useRef<AbortController[]>([]);

  const fetchFootball = useCallback(async (background = false) => {
    const gen = ++footballGenRef.current;
    const alive = () => footballGenRef.current === gen;
    abortControllersRef.current.forEach((c) => c.abort()); abortControllersRef.current = [];
    if (!background) { setFootballLoading(true); setError(null); }
    try { const matches = await fetchAllFootballMatches(); if (!alive()) return; setAllFootballMatches(matches); }
    catch (err) { if (err instanceof Error && err.name === 'AbortError') return; if (alive() && !background) setError((err as Error).message ?? 'Failed to load matches'); }
    finally { if (alive()) setFootballLoading(false); }
  }, []);

  useEffect(() => { return () => { abortControllersRef.current.forEach((c) => c.abort()); footballGenRef.current++; }; }, []);
  useEffect(() => { fetchFootball(false); }, [fetchFootball]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'visible') return; fetchFootball(true); };
    const interval = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [fetchFootball]);

  const liveCount = useMemo(
    () => allFootballMatches.filter((m) => LIVE_STATUSES.has(m.status ?? '')).length,
    [allFootballMatches],
  );

  const popularLeagues = useMemo(
    () => deriveLeagueCounts(allFootballMatches),
    [allFootballMatches],
  );

  // Highlights = ADMIN GAMES when available, otherwise falls back to real
  // today/tomorrow top-league, cup, or World Cup/country fixtures so the
  // section (and its "Team to Win" pick banner) is never empty.
  const highlightMatches = useMemo(() => {
    if (adminMatches.length > 0) return adminMatches;
    return deriveHighlightFallbackMatches(allFootballMatches);
  }, [adminMatches, allFootballMatches]);

  // Highlights = ADMIN GAMES ONLY. World Cup / country matches are NOT
  // pulled out anymore — they flow normally into Live / Next 3 Days /
  // Upcoming like any other match (they're still detected for flags + MOTD
  // eligibility via isWorldCupCountryMatch elsewhere).
  const { activeMatches, resultMatches, isFallback } = useMemo((): {
    activeMatches: EnrichedMatch[];
    resultMatches: EnrichedMatch[];
    isFallback: boolean;
  } => {
    const result = filterByTimeTab(allFootballMatches, activeTimeTab);
    let filtered = result.matches.filter((m) => {
      if (adminFingerprints.size > 0 && isMatchInAdminSet(m, adminFingerprints)) return false;
      return true;
    });

    if (activeLeague !== null) {
      filtered = filtered.filter((m) => m.league === activeLeague);
    }

    return {
      activeMatches: assignAdminLogos(filtered.filter((m) => !FINISHED_STATUSES.has(m.status ?? ''))),
      resultMatches: assignAdminLogos(filtered.filter((m) => FINISHED_STATUSES.has(m.status ?? ''))),
      isFallback: result.isFallback,
    };
  }, [activeTimeTab, activeLeague, allFootballMatches, adminFingerprints]);

  // Grouping: Live Now → Next 3 Days → Upcoming (After 3 Days).
  // Finished games are handled separately by ResultsSection and always
  // render last.
  const grouped = useMemo(() => {
    const cats: Record<Exclude<MatchCategory, 'results'>, EnrichedMatch[]> = { live:[], next3:[], later:[] };
    for (const m of activeMatches) {
      const cat = categorise(m);
      if (cat && cat !== 'results') cats[cat].push(m);
    }
    return cats;
  }, [activeMatches]);

  const activeTimeTabLabel = useMemo(() => TIME_TABS.find((t) => t.key === activeTimeTab)?.label ?? activeTimeTab, [activeTimeTab]);
  const navigate = useNavigate();

  let globalIdx = 0;
  const highlightsStart = globalIdx;
  globalIdx += highlightMatches.length;

  function renderSection(title: string, matches: EnrichedMatch[], opts: { isLive?: boolean } = {}, startIdx: number): { node: React.ReactNode; count: number } {
    if (matches.length === 0) return { node: null, count: 0 };
    const sorted = [...matches].sort((a, b) => leagueSortKey(a.league || '').localeCompare(leagueSortKey(b.league || '')));
    let rowIdx = startIdx;
    const rows: React.ReactNode[] = sorted.map((m) => {
      const isMatchLive = LIVE_STATUSES.has(m.status ?? '');
      const node = (
        <CompactMatchRow key={m.id} match={m} hasDraw={true}
          onClick={isMatchLive ? undefined : () => navigate(`/match/${m.id}`)} matchIndex={rowIdx + 1} />
      );
      rowIdx++;
      return node;
    });
    return {
      node: (
        <div className={`cmsec${opts.isLive ? ' live-section' : ''}`}>
          <div className="cmsec-hdr">
            <span className="cmsec-title">
              {opts.isLive && <FiberManualRecordIcon sx={{ fontSize:10, color:'#3b82f6' }} />}
              {title} <span className="cmsec-cnt">({matches.length})</span>
            </span>
            {opts.isLive && (
              <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'rgba(59, 130, 246,0.7)', fontWeight:700, fontFamily:'system-ui,sans-serif' }}>
                <LockIcon sx={{ fontSize: 11 }} /> Odds locked during live play
              </span>
            )}
          </div>
          <div className="cmsec-col-hdr">
            <div style={{ flex:1 }} />
            {['1','X','2'].map((h) => <div key={h} className="cmsec-col-lbl">{h}</div>)}
            <div style={{ width:28 }} />
          </div>
          {rows}
        </div>
      ),
      count: rowIdx - startIdx,
    };
  }

  return (
    <div className="wb-root px-4 mt-4">

      {/* ── Time tabs ABOVE everything ── */}
      <TimeTabBar active={activeTimeTab} onChange={setActiveTimeTab} liveCount={liveCount} />

      {/* ── Three-column layout ── */}
      <div className="wb-layout">

        {/* LEFT SIDEBAR — hardcoded top-20 leagues/competitions, live counts */}
        <PopularLeaguesSidebar
          activeLeague={activeLeague}
          onSelect={setActiveLeague}
          totalCount={allFootballMatches.length}
          leagues={popularLeagues}
        />

        {/* MAIN CONTENT */}
        <div className="wb-main">
          <MatchOfTheDayCard matches={allFootballMatches} adminMatches={adminMatches} loading={footballLoading} />

          {isFallback && !footballLoading && <FallbackNotice tabLabel={activeTimeTabLabel} />}

          {/* Highlights — admin games if any exist, otherwise real
              today/tomorrow top-league/cup/World Cup fixtures, with a
              featured team-to-win pick */}
          <HighlightsSection
  matches={highlightMatches}
  globalIndexStart={highlightsStart}
  isAdminSource={adminMatches.length > 0}
/>

          {error ? (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color:'#6b7280' }}>{error}</p>
              <button onClick={() => fetchFootball(false)} className="mt-3 text-xs font-semibold hover:underline" style={{ color:'#3b82f6' }}>Try again</button>
            </div>
          ) : footballLoading ? (
            <div className="cmsec">
              <div className="cmsec-hdr"><div className="skeleton-block" style={{ width:90, height:14, borderRadius:4 }} /></div>
              <div className="cmsec-col-hdr"><div style={{ flex:1 }} />{['1','X','2'].map((h) => <div key={h} className="cmsec-col-lbl">{h}</div>)}<div style={{ width:28 }} /></div>
              {[0,1,2,3,4].map((i) => <SkeletonRow key={i} />)}
            </div>
          ) : (
            <>
              {(() => {
                const liveR  = renderSection('Live Now',               grouped.live,  { isLive: true }, globalIdx); globalIdx += liveR.count;
                const next3R = renderSection('Next 3 Days',             grouped.next3, {},               globalIdx); globalIdx += next3R.count;
                const laterR = renderSection('Upcoming (After 3 Days)', grouped.later, {},               globalIdx); globalIdx += laterR.count;
                return <>{liveR.node}{next3R.node}{laterR.node}</>;
              })()}
              <ResultsSection matches={resultMatches} startIdx={globalIdx} />
              {activeMatches.length === 0 && resultMatches.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-5xl mb-4">⚽</div>
                  <p className="text-sm" style={{ color:'#6b7280' }}>
                    {activeLeague
                      ? `No matches found for "${activeLeague}".`
                      : 'No football matches available right now.'}
                  </p>
                  {activeLeague && (
                    <button
                      onClick={() => setActiveLeague(null)}
                      style={{ marginTop: 8, fontSize: 12, color: '#3b82f6', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'system-ui, sans-serif' }}
                    >
                      Show all leagues
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <RightSidebar />

      </div>

      <FloatingBetSlipButton />

   <style>{`
/* =========================================================================
   CONSOLIDATED STYLESHEET — MatchList component (ALL FIXES APPLIED)
   ========================================================================= */

/* ===== CSS VARIABLES & ROOT ===== */
.wb-root {
  --bg-page: #07080f;
  --bg-card: #0d1f3c;
  --bg-card2: #111320;
  --border: rgba(59, 130, 246,0.15);
  --border-acc: rgba(59, 130, 246,0.3);
  --accent: #3b82f6;
  --accent-dim: rgba(59, 130, 246,0.12);
  --accent-border: rgba(59, 130, 246,0.25);
  --text-main: #f1f5f9;
  --text-muted: #6b7280;
  --text-faint: #374151;
  --gold: #facc15;
  --gold-dim: rgba(250,204,21,0.15);
  --danger: #ef4444;
  --success: #22c55e;
  background: var(--bg-page);
  min-height: 100vh;
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.wb-root, .wb-root *, .wb-root *::before, .wb-root *::after { box-sizing: border-box; }

/* ===== LAYOUT ===== */
.wb-layout {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  max-width: 100%;
  padding-bottom: 100px; /* reserves space for floating bet slip */
}
.wb-main { flex: 1 1 auto; min-width: 0; max-width: 100%; overflow-x: hidden; }

/* Sidebars — hidden via display:none (not width) at breakpoints */
.pls-sidebar { width: 200px; min-width: 200px; flex-shrink: 0; }
.rs-sidebar  { width: 240px; min-width: 240px; flex-shrink: 0; }

@media (max-width: 1200px) { .rs-sidebar { display: none; } }
@media (max-width: 1024px) { .pls-sidebar { display: none; } }

/* ===== SKELETON ===== */
.skeleton-block { background: linear-gradient(90deg, var(--bg-card) 25%, #1e3a6e 50%, var(--bg-card) 75%); background-size: 200% 100%; animation: skelShimmer 1.4s ease-in-out infinite; }
@keyframes skelShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* ===== SCROLLBAR HIDING ===== */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }

/* ===== SECTION CARDS ===== */
.cmsec {
  margin-bottom: 14px;
  border-radius: 12px;
  overflow: hidden;
  border: 1.5px solid var(--border);
  background: var(--bg-card);
  box-shadow: 0 2px 16px rgba(0,0,0,0.4);
  max-width: 100%;
  overflow-x: hidden;
}
.cmsec.highlights { border-color: var(--gold-dim); box-shadow: 0 2px 20px rgba(250,204,21,0.1); }
.cmsec.live-section { border-color: var(--accent-border); box-shadow: 0 2px 20px rgba(59, 130, 246,0.1); }
.cmsec.results-section { border-color: rgba(59, 130, 246,0.14); opacity: 0.96; }

.cmsec-hdr { display: flex; align-items: center; justify-content: space-between; padding: 11px 12px 9px; background: var(--accent-dim); border-bottom: 1.5px solid var(--border); gap: 8px; flex-wrap: wrap; row-gap: 4px; }
.cmsec.highlights .cmsec-hdr { background: var(--gold-dim); border-bottom-color: rgba(250,204,21,0.2); }
.cmsec-title { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; color: var(--text-main); letter-spacing: 0.06em; text-transform: uppercase; }
.cmsec-cnt { font-size: 9px; font-weight: 500; color: var(--text-muted); }
.cmsec-col-hdr { display: flex; align-items: center; padding: 4px 8px; background: rgba(255,255,255,0.015); border-bottom: 1px solid rgba(255,255,255,0.04); gap: 3px; }
.cmsec-col-lbl { width: 52px; text-align: center; font-size: 9px; font-weight: 800; color: var(--accent); letter-spacing: 0.07em; flex-shrink: 0; }

/* ===== COMPACT MATCH ROW ===== */
.cmr {
  display: flex; align-items: center; gap: 6px;
  padding: 9px 8px 9px 10px;
  border-bottom: 1px solid rgba(59, 130, 246,0.06);
  margin-bottom: 10px;
  cursor: pointer; transition: background 0.12s ease;
  min-height: 58px; width: 100%; box-sizing: border-box;
  overflow-x: hidden;
}
.cmr:last-child { border-bottom: none; margin-bottom: 0; }
.cmr:hover { background: rgba(59, 130, 246,0.05); }
.cmr.live { background: rgba(59, 130, 246,0.04); border-left: 3px solid var(--accent); padding-left: 7px; }
.cmr.live:hover { background: rgba(59, 130, 246,0.05); }
.cmr.no-pointer { cursor: default !important; }
.cmr.admin { background: rgba(59, 130, 246,0.04); border-left: 3px solid var(--accent); padding-left: 7px; }

.cmr-left { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 48px; min-width: 48px; flex-shrink: 0; }
.cmr-date { font-size: 8px; font-weight: 700; color: var(--text-faint); white-space: nowrap; letter-spacing: 0.01em; }
.cmr-time { font-size: 12px; font-weight: 800; color: var(--text-main); letter-spacing: 0.01em; white-space: nowrap; }
.cmr-id { font-size: 9px; color: rgba(59, 130, 246,0.4); font-weight: 600; }
.cmr-live { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 900; color: var(--accent); letter-spacing: 0.02em; white-space: nowrap; }
.cmr-star { font-size: 12px; color: var(--accent); }

.cmr-teams { flex: 1 1 auto; display: flex; flex-direction: column; gap: 3px; min-width: 0; overflow: hidden; }
.cmr-team { display: flex; align-items: center; gap: 5px; min-width: 0; width: 100%; }
.cmr-score { font-size: 13px; font-weight: 900; color: var(--accent); min-width: 14px; flex-shrink: 0; }
.cmr-name { font-size: 14px; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; line-height: 1.3; }
.cmr-team img { border-radius: 3px; flex-shrink: 0; }
.cmr-countdown { display: flex; align-items: center; gap: 3px; font-size: 8px; color: var(--text-faint); margin-top: 1px; white-space: nowrap; }

.cmr-odds { display: flex; flex-wrap: nowrap; align-items: center; gap: 2px; flex: 0 1 55%; max-width: 55%; min-width: 0; justify-content: flex-end; }
.cmr-odds-locked { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; width: 162px; max-width: 40vw; height: 44px; border-radius: 8px; border: 1.5px solid var(--border); background: var(--accent-dim); flex-shrink: 0; }
.cmr-locked-label { font-size: 8px; font-weight: 800; color: rgba(59, 130, 246,0.6); letter-spacing: 0.06em; text-transform: uppercase; }

.cmr-btn {
  flex: 1 1 0; min-width: 28px; max-width: 52px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 44px; border-radius: 7px;
  border: 1.5px solid var(--border);
  background: rgba(59, 130, 246,0.07);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, transform 0.08s;
  padding: 0 2px; -webkit-tap-highlight-color: transparent;
  box-sizing: border-box;
  touch-action: manipulation;
}
.cmr-btn:hover:not(.empty):not(.sel) { background: rgba(59, 130, 246,0.16); border-color: rgba(59, 130, 246,0.5); }
.cmr-btn:active:not(.empty):not(.sel) { transform: scale(0.94); }
.cmr-btn.sel { background: rgba(59, 130, 246,0.22); border-color: var(--accent); box-shadow: 0 0 0 2px rgba(59, 130, 246,0.2); }
.cmr-btn.empty { opacity: 0.22; cursor: default; border-color: rgba(255,255,255,0.05); background: rgba(255,255,255,0.02); }
.cmr-btn-label { font-size: 9px; font-weight: 800; color: rgba(96, 165, 250,0.7); letter-spacing: 0.07em; line-height: 1; white-space: nowrap; }
.cmr-btn-val { font-size: 13px; font-weight: 800; color: #60a5fa; letter-spacing: -0.01em; line-height: 1.2; margin-top: 2px; white-space: nowrap; }
.cmr-btn.sel .cmr-btn-label { color: rgba(96, 165, 250,0.9); }
.cmr-btn.sel .cmr-btn-val   { color: #bfdbfe; }
.cmr-btn.empty .cmr-btn-val  { color: var(--text-faint); }

.cmr-stats {
  width: 28px; height: 28px; border-radius: 7px;
  border: 1.5px solid rgba(59, 130, 246,0.15);
  background: rgba(59, 130, 246,0.05);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: rgba(59, 130, 246,0.5); flex-shrink: 0;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.cmr-stats:hover { background: rgba(59, 130, 246,0.14); color: var(--accent); border-color: rgba(59, 130, 246,0.4); }

/* ===== RESULT MATCH ROW ===== */
.rmr { display: flex; align-items: center; gap: 6px; padding: 9px 8px 9px 10px; border-bottom: 1px solid rgba(59, 130, 246,0.06); margin-bottom: 10px; cursor: pointer; transition: background 0.12s ease; min-height: 54px; width: 100%; box-sizing: border-box; overflow-x: hidden; }
.rmr:last-of-type { border-bottom: none; margin-bottom: 0; } .rmr:hover { background: rgba(59, 130, 246,0.04); }
.rmr-left { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 48px; min-width: 48px; flex-shrink: 0; }
.rmr-date { font-size: 9px; font-weight: 700; color: #5b7fa6; white-space: nowrap; }
.rmr-time { font-size: 11px; font-weight: 800; color: #7ba0c4; letter-spacing: 0.01em; white-space: nowrap; }
.rmr-idx  { font-size: 9px; color: rgba(96, 165, 250,0.18); font-weight: 600; }
.rmr-center { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; overflow: hidden; }
.rmr-team { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; }
.rmr-team-info { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; overflow: hidden; }
.rmr-team-info img, .rmr-team-info > div { border-radius: 4px; flex-shrink: 0; }
.rmr-team-name { font-size: 15px; font-weight: 600; color: #7ba0c4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.rmr-score { font-size: 13px; font-weight: 900; color: #5b7fa6; flex-shrink: 0; min-width: 16px; text-align: right; }
.rmr-winner .rmr-team-name { color: #e8eefd; font-weight: 700; }
.rmr-winner .rmr-score { color: var(--accent); }
.rmr-score-win { color: var(--accent) !important; }
.rmr-draw-team .rmr-team-name { color: #a8bcdc; }
.rmr-draw-team .rmr-score { color: #a8bcdc; }
.rmr-loser .rmr-team-name { color: #5b7fa6; }
.rmr-loser .rmr-score { color: #3d5c70; }
.rmr-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; min-width: 52px; }
.rmr-badge { font-size: 9px; font-weight: 800; color: #4b5563; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 4px; padding: 2px 5px; letter-spacing: 0.05em; white-space: nowrap; }
.rmr-badge-draw { color: #9ca3af; border-color: rgba(156,163,175,0.15); background: rgba(156,163,175,0.05); }
.rmr-league { font-size: 9px; color: #374151; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 72px; text-align: right; }

/* ===== MATCH OF THE DAY ===== */
.motd-wrap { width: 100%; box-sizing: border-box; margin-bottom: 16px; border-radius: 10px; overflow: hidden; border: 1.5px solid var(--border); background: var(--bg-card); box-shadow: 0 4px 24px rgba(0,0,0,0.5); }
.motd-eyebrow { display: flex; align-items: center; justify-content: space-between; padding: 7px 12px 6px; background: rgba(59, 130, 246,0.06); border-bottom: 1px solid var(--border); flex-wrap: wrap; row-gap: 4px; gap: 8px; }
.motd-eyebrow-left { display: flex; align-items: center; gap: 5px; min-width: 0; }
.motd-eyebrow-label { font-size: 10px; font-weight: 900; color: var(--gold); letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
.motd-eyebrow-sep { color: rgba(255,255,255,0.15); font-size: 11px; }
.motd-eyebrow-comp { font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
.motd-nav { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.motd-nav-btn { background: rgba(59, 130, 246,0.1); border: 1px solid var(--border); color: #60a5fa; font-size: 15px; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.12s, color 0.12s; touch-action: manipulation; }
.motd-nav-btn:hover { background: rgba(59, 130, 246,0.2); color: #bfdbfe; }
.motd-dots { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; max-width: 90px; justify-content: center; }
.motd-dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.12); cursor: pointer; transition: background 0.15s, transform 0.15s; }
.motd-dot.active { background: var(--accent); transform: scale(1.35); }

.motd-body { display: flex; align-items: center; gap: 16px; padding: 18px 16px; transition: opacity 0.25s ease, transform 0.25s ease; box-sizing: border-box; width: 100%; overflow-x: hidden; }
.motd-fade-in  { opacity: 1; transform: translateX(0); }
.motd-fade-out { opacity: 0; transform: translateX(-8px); }

.motd-teams-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex: 1; min-width: 0; }
.motd-team-col { display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0; width: 90px; min-width: 0; }
.motd-team-name { font-size: 13px; font-weight: 800; color: var(--text-main); letter-spacing: 0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.motd-vs-col { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; flex-shrink: 0; padding: 0 6px; }
.motd-vs-text { font-size: 22px; font-weight: 900; color: var(--accent); letter-spacing: 0.06em; }
.motd-kickoff-date { font-size: 10px; font-weight: 700; color: #4b5563; letter-spacing: 0.03em; white-space: nowrap; text-transform: uppercase; }
.motd-kickoff { font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.02em; white-space: nowrap; }

.motd-odds-panel { flex-shrink: 0; width: 260px; max-width: 100%; display: flex; flex-direction: column; gap: 9px; box-sizing: border-box; }
.motd-odds-hdr { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.motd-odds-label { font-size: 9px; font-weight: 800; color: var(--text-muted); letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; }
.motd-boosted-badge { display: inline-flex; align-items: center; gap: 3px; background: var(--accent); color: #fff; font-size: 9px; font-weight: 900; border-radius: 4px; padding: 3px 7px; letter-spacing: 0.06em; white-space: nowrap; flex-shrink: 0; }
.motd-odds-row { display: flex; flex-wrap: nowrap; gap: 6px; }
.motd-odd-btn { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 9px 4px 8px; border-radius: 6px; border: 1.5px solid var(--border); background: var(--accent-dim); cursor: pointer; transition: background 0.12s, border-color 0.12s, transform 0.08s; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.motd-odd-btn:hover:not(.sel):not(.empty) { background: rgba(59, 130, 246,0.14); border-color: rgba(59, 130, 246,0.5); }
.motd-odd-btn:active { transform: scale(0.96); }
.motd-odd-btn.sel { background: rgba(59, 130, 246,0.2); border-color: var(--accent); box-shadow: 0 0 0 2px rgba(59, 130, 246,0.2); }
.motd-odd-btn.empty { opacity: 0.35; cursor: default; }
.motd-odd-team { font-size: 10px; font-weight: 600; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; text-align: center; }
.motd-odd-val { font-size: 18px; font-weight: 900; color: var(--text-main); letter-spacing: -0.01em; }
.motd-odd-btn.sel .motd-odd-val  { color: #60a5fa; }
.motd-odd-btn.sel .motd-odd-team { color: rgba(96, 165, 250,0.8); }
.motd-provider { font-size: 10px; color: #374151; text-align: right; }
.motd-all-markets { width: 100%; padding: 10px; background: rgba(59, 130, 246,0.08); border: 1.5px solid var(--border); border-radius: 6px; color: #60a5fa; font-size: 11px; font-weight: 800; letter-spacing: 0.07em; cursor: pointer; transition: background 0.12s, border-color 0.12s; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.motd-all-markets:hover { background: rgba(59, 130, 246,0.16); border-color: rgba(59, 130, 246,0.5); }

/* ===== HIGHLIGHTS PICK BANNER ===== */
.hl-pick-banner { display: flex; align-items: center; gap: 8px; margin: 8px 12px 4px; padding: 8px 12px; border-radius: 8px; background: linear-gradient(90deg, var(--gold-dim) 0%, var(--accent-dim) 100%); border: 1px solid rgba(250,204,21,0.3); cursor: pointer; transition: background 0.12s, border-color 0.12s; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.hl-pick-banner:hover { background: linear-gradient(90deg, rgba(250,204,21,0.18) 0%, rgba(59, 130, 246,0.12) 100%); border-color: rgba(250,204,21,0.5); }
.hl-pick-icon { flex-shrink: 0; }
.hl-pick-text { display: flex; align-items: baseline; gap: 5px; flex: 1; min-width: 0; }
.hl-pick-team { font-size: 13px; font-weight: 800; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hl-pick-label { font-size: 11px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
.hl-pick-odd { font-size: 15px; font-weight: 900; color: var(--gold); flex-shrink: 0; }

/* ===== TIME TAB BAR ===== */
.ttb-wrap { margin-bottom: 14px; width: 100%; overflow: hidden; }
.ttb-scroll { display: flex; align-items: center; gap: 8px; overflow-x: auto; padding: 2px 2px 6px; -webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory; }
.ttb-scroll > * { scroll-snap-align: start; flex-shrink: 0; }
.ttb-pill { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; padding: 8px 16px; border-radius: 999px; border: 1.5px solid var(--border); background: var(--bg-card); color: var(--text-muted); font-size: 12.5px; font-weight: 700; white-space: nowrap; cursor: pointer; font-family: system-ui, sans-serif; transition: background 0.14s, border-color 0.14s, color 0.14s, transform 0.08s; -webkit-tap-highlight-color: transparent; user-select: none; touch-action: manipulation; }
.ttb-pill:hover { border-color: var(--accent-border); color: #e5e7eb; }
.ttb-pill:active { transform: scale(0.97); }
.ttb-pill.active { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 800; }
.ttb-pill.active:hover { background: #1d4ed8; border-color: #1d4ed8; }
.ttb-pill.live-pill { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #f87171; }
.ttb-pill.live-pill:hover { background: rgba(239,68,68,0.16); border-color: rgba(239,68,68,0.5); color: #fca5a5; }
.ttb-pill.live-pill.active { background: var(--danger); border-color: var(--danger); color: #fff; }
.ttb-pill.live-pill.active:hover { background: #f24747; border-color: #f24747; }
.ttb-live-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: rgba(255,255,255,0.18); color: inherit; font-size: 10.5px; font-weight: 800; line-height: 1; }
.ttb-pill.live-pill:not(.active) .ttb-live-count { background: rgba(239,68,68,0.22); color: #f87171; }

/* ===== POPULAR LEAGUES SIDEBAR ===== */
.pls-sidebar { background: var(--bg-card); border: 1.5px solid var(--border); border-radius: 10px; overflow: hidden; height: fit-content; position: sticky; top: 16px; }
.pls-header { display: flex; align-items: center; gap: 7px; padding: 11px 12px 10px; background: var(--accent-dim); border-bottom: 1.5px solid var(--border); }
.pls-header-label { font-size: 9px; font-weight: 900; color: #60a5fa; letter-spacing: 0.1em; text-transform: uppercase; }
.pls-item { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 9px 12px; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; text-align: left; transition: background 0.12s; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.pls-item:last-child { border-bottom: none; }
.pls-item:hover { background: var(--accent-dim); }
.pls-item.active { background: var(--accent-dim); border-left: 3px solid var(--accent); padding-left: 9px; }
.pls-item-name { font-size: 12px; font-weight: 600; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; transition: color 0.12s; }
.pls-item.active .pls-item-name { color: #60a5fa; font-weight: 700; }
.pls-item-count { flex-shrink: 0; min-width: 22px; height: 18px; padding: 0 5px; border-radius: 4px; background: rgba(255,255,255,0.06); color: var(--text-muted); font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-left: 6px; transition: background 0.12s, color 0.12s; }
.pls-item-count.active { background: var(--accent); color: #fff; }

/* ===== RIGHT SIDEBAR ===== */
.rs-sidebar { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 16px; height: fit-content; }
.rs-card { background: var(--bg-card); border: 1.5px solid var(--border); border-radius: 12px; overflow: hidden; }
.rs-card-hdr { display: flex; align-items: center; gap: 8px; padding: 12px 14px 10px; border-bottom: 1px solid var(--border); }
.rs-card-title { font-size: 10px; font-weight: 900; color: var(--text-muted); letter-spacing: 0.1em; text-transform: uppercase; flex: 1; }
.rs-badge-count { background: var(--accent); color: #fff; font-size: 10px; font-weight: 900; border-radius: 10px; padding: 1px 7px; }

.rs-betslip-card { border-color: var(--accent-border); }
.rs-betslip-card .rs-card-hdr { background: rgba(30,58,110,0.5); border-bottom-color: var(--border); }
.rs-betslip-items { padding: 4px 0; }
.rs-betslip-row { display: flex; flex-direction: column; gap: 5px; padding: 9px 14px; border-bottom: 1px solid rgba(59, 130, 246,0.08); transition: background 0.12s; }
.rs-betslip-row:hover { background: rgba(30,58,110,0.3); }
.rs-betslip-row:last-child { border-bottom: none; }
.rs-betslip-row-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
.rs-betslip-match { font-size: 12px; font-weight: 700; color: #e2e8f0; line-height: 1.3; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.rs-betslip-remove { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #f87171; font-size: 10px; font-weight: 900; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.12s, border-color 0.12s; padding: 0; touch-action: manipulation; }
.rs-betslip-remove:hover { background: rgba(239,68,68,0.22); border-color: rgba(239,68,68,0.5); }
.rs-betslip-row-bottom { display: flex; align-items: center; gap: 5px; }
.rs-betslip-market { font-size: 10px; font-weight: 600; color: #4b5563; white-space: nowrap; }
.rs-betslip-sel { font-size: 10px; font-weight: 800; color: #bfdbfe; background: rgba(59, 130, 246,0.1); border: 1px solid var(--border); border-radius: 3px; padding: 1px 5px; white-space: nowrap; }
.rs-betslip-odd { font-size: 13px; font-weight: 900; color: #60a5fa; margin-left: auto; }
.rs-betslip-stake-wrap { padding: 10px 14px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 5px; }
.rs-stake-label { font-size: 9px; font-weight: 800; color: #4b5563; letter-spacing: 0.1em; }
.rs-stake-input { width: 100%; background: rgba(30,58,110,0.5); border: 1.5px solid var(--border); border-radius: 6px; padding: 8px 10px; color: var(--text-main); font-size: 14px; font-weight: 700; outline: none; transition: border-color 0.12s; box-sizing: border-box; }
.rs-stake-input:focus { border-color: var(--accent); }
.rs-stake-input::placeholder { color: #374151; }
.rs-stake-input::-webkit-outer-spin-button, .rs-stake-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.rs-betslip-totals { display: flex; flex-direction: column; gap: 4px; padding: 10px 14px; background: rgba(30,58,110,0.5); border-top: 1px solid var(--border); }
.rs-totals-row { display: flex; align-items: center; justify-content: space-between; }
.rs-total-label { font-size: 11px; color: var(--text-muted); }
.rs-total-val { font-size: 15px; font-weight: 900; color: #60a5fa; }
.rs-total-win { font-size: 15px; font-weight: 900; color: var(--gold); }
.rs-place-btn { width: 100%; padding: 12px; background: linear-gradient(135deg, #1d4ed8 0%, var(--accent) 100%); border: none; color: #fff; font-size: 12px; font-weight: 900; letter-spacing: 0.08em; cursor: pointer; transition: opacity 0.12s; touch-action: manipulation; }
.rs-place-btn:hover { opacity: 0.88; }

.rs-win-card { border-color: rgba(250,204,21,0.2); }
.rs-win-hdr { background: rgba(30,58,110,0.5); border-bottom-color: var(--border); }
.rs-win-title { color: #bfdbfe; }
.rs-win-body { padding: 14px; }
.rs-win-amount { font-size: 24px; font-weight: 900; color: var(--gold); letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 4px; }
.rs-win-user { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; font-weight: 500; }
.rs-win-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
.rs-win-tag { font-size: 11px; font-weight: 700; color: #bfdbfe; background: rgba(59, 130, 246,0.1); border: 1px solid var(--border); border-radius: 5px; padding: 3px 8px; }
.rs-win-tag-more { color: var(--text-muted); background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
.rs-win-stake-row { display: flex; align-items: center; gap: 6px; padding: 9px 10px; background: rgba(30,58,110,0.6); border-radius: 7px; border: 1px solid var(--border); }
.rs-win-stake-label, .rs-win-odds-label { font-size: 12px; color: var(--text-muted); }
.rs-win-stake-val { color: var(--text-main); font-weight: 800; }
.rs-win-odds-val { color: var(--gold); font-weight: 900; font-size: 13px; }
.rs-win-stake-sep { color: rgba(255,255,255,0.15); font-size: 14px; }

.rs-acc-card { border-color: var(--border); }
.rs-acc-hdr { background: rgba(30,58,110,0.5); border-bottom-color: var(--border); }
.rs-acc-title { color: #bfdbfe; }
.rs-acc-list { padding: 4px 0; }
.rs-acc-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-bottom: 1px solid rgba(59, 130, 246,0.08); }
.rs-acc-row:last-child { border-bottom: none; }
.rs-acc-info { flex: 1; min-width: 0; }
.rs-acc-name { font-size: 13px; font-weight: 700; color: #e5e7eb; display: block; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rs-acc-meta { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
.rs-acc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
.rs-acc-multi { font-size: 16px; font-weight: 900; color: #60a5fa; letter-spacing: -0.01em; }
.rs-acc-copy { display: inline-flex; align-items: center; gap: 4px; background: var(--accent); color: #fff; border: none; border-radius: 5px; padding: 5px 10px; font-size: 10px; font-weight: 900; letter-spacing: 0.06em; cursor: pointer; transition: background 0.12s, transform 0.08s; white-space: nowrap; touch-action: manipulation; }
.rs-acc-copy:hover { background: #1d4ed8; }
.rs-acc-copy:active { transform: scale(0.95); }
.rs-acc-copy.copied { background: #1d4ed8; }

.rs-winners-card { border-color: var(--accent-border); background: var(--bg-card); }
.rs-winners-hdr { background: linear-gradient(90deg, rgba(30,58,110,0.9) 0%, rgba(13,31,60,0.9) 100%); border-bottom: 1px solid var(--border); }
.rs-winners-title { color: #bfdbfe; }
.rs-winners-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0; box-shadow: 0 0 8px var(--accent), 0 0 16px rgba(59, 130, 246,0.4); animation: rs-winner-pulse 1.8s ease-in-out infinite; }
@keyframes rs-winner-pulse { 0%,100% { opacity: 1; box-shadow: 0 0 6px var(--accent), 0 0 12px rgba(59, 130, 246,0.3); } 50% { opacity: 0.5; box-shadow: 0 0 14px var(--accent), 0 0 28px rgba(59, 130, 246,0.5); } }
.rs-winners-list { padding: 4px 0; }
.rs-winner-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px; border-bottom: 1px solid rgba(59, 130, 246,0.07); transition: background 0.12s; }
.rs-winner-row:last-child { border-bottom: none; }
.rs-winner-row:hover { background: rgba(30,58,110,0.4); }
.rs-winner-left { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.rs-winner-user { font-size: 13px; font-weight: 800; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rs-winner-meta { display: flex; align-items: center; gap: 6px; }
.rs-winner-type { font-size: 10px; font-weight: 700; color: #60a5fa; background: rgba(59, 130, 246,0.12); border: 1px solid var(--border); border-radius: 3px; padding: 1px 5px; white-space: nowrap; }
.rs-winner-ago { font-size: 10px; color: rgba(255,255,255,0.25); white-space: nowrap; }
.rs-winner-amount { font-size: 12px; font-weight: 900; color: var(--success); white-space: nowrap; flex-shrink: 0; letter-spacing: -0.01em; }

.rs-refer-wrap { border-radius: 12px; overflow: hidden; border: 1.5px solid var(--border); background: var(--bg-card); }
.rs-refer-image-slot { width: 100%; height: 200px; overflow: hidden; position: relative; }
.rs-refer-img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* ===== SUPPORTERS CAROUSEL ===== */
.supporters-wrap { margin: 48px 0 0; border-radius: 12px; overflow: hidden; background: transparent; }
.supporters-track-wrap { position: relative; overflow: hidden; padding: 10px 0; background: transparent; }
.supporters-track { display: flex; gap: 12px; animation: supportersScroll 60s linear infinite; width: max-content; padding: 0 12px; }
.supporter-chip { flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 8px; padding: 2px; cursor: default; transition: transform 0.15s; }
.supporter-chip:hover { transform: translateY(-2px); }
.supporter-logo-img { height: 40px; width: auto; max-width: 90px; object-fit: contain; display: block; border-radius: 4px; user-select: none; filter: brightness(0.85) contrast(1.1); }
.supporter-logo-placeholder { height: 40px; width: 70px; border-radius: 6px; border: 1.5px dashed rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; }
.supporter-placeholder-initial { font-size: 16px; font-weight: 800; color: rgba(255,255,255,0.15); text-transform: uppercase; }
.supporters-fade-l, .supporters-fade-r { position: absolute; top: 0; bottom: 0; width: 28px; pointer-events: none; z-index: 2; }
.supporters-fade-l { left: 0; background: linear-gradient(90deg, var(--bg-page) 0%, transparent 100%); }
.supporters-fade-r { right: 0; background: linear-gradient(270deg, var(--bg-page) 0%, transparent 100%); }
@keyframes supportersScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

/* ===== SITE FOOTER ===== */
.site-footer { margin-top: 24px; padding: 22px 16px 36px; border-top: 1.5px solid var(--border); background: transparent; border-radius: 12px 12px 0 0; }
.footer-top { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-bottom: 16px; }
.footer-brand { display: flex; align-items: center; gap: 8px; }
.footer-brand-name { font-size: 20px; font-weight: 900; color: var(--accent); letter-spacing: 0.02em; }
.footer-tagline { font-size: 13px; color: #f3f4f6; text-align: center; margin: 0; font-weight: 400; }
.footer-links { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin-bottom: 14px; }
.footer-link { font-size: 12px; color: #f9fafb; text-decoration: none; font-weight: 600; transition: color 0.15s; }
.footer-link:hover { color: var(--accent); }
.footer-dot { font-size: 12px; color: #f3f4f6; opacity: 0.4; }
.footer-warning { display: flex; align-items: flex-start; gap: 8px; padding: 11px 14px; background: rgba(59, 130, 246,0.05); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 14px; font-size: 11px; color: #f3f4f6; line-height: 1.6; font-weight: 400; }
.footer-warning-icon { flex-shrink: 0; font-size: 14px; }
.footer-bottom { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 11px; color: #f3f4f6; font-weight: 400; flex-wrap: wrap; opacity: 0.7; }
.footer-pipe { opacity: 0.3; }
.footer-18 { background: var(--accent); color: #fff; font-size: 10px; font-weight: 900; border-radius: 4px; padding: 2px 6px; letter-spacing: 0.05em; }

/* ===== FLOATING BET SLIP BUTTON (PORTAL) ===== */
@keyframes fbsPulse { 0% { transform: scale(1); } 50% { transform: scale(1.14); } 100% { transform: scale(1); } }
.fbs-btn {
  position: fixed;
  bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  right: calc(16px + env(safe-area-inset-right, 0px));
  z-index: 999999;
  width: 56px; height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg,#1d4ed8 0%,var(--accent) 100%);
  border: 2px solid rgba(59, 130, 246,0.4);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 20px rgba(59, 130, 246,0.4);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  outline: none; padding: 0; box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.fbs-btn:hover { transform: translateY(-2px) scale(1.05); box-shadow: 0 6px 26px rgba(59, 130, 246,0.55); border-color: rgba(96, 165, 250,0.75); }
.fbs-btn:active { transform: scale(0.92); }
.fbs-badge {
  position: absolute; top: -2px; right: -2px;
  background: var(--gold); color: #1c1917;
  border-radius: 50%; width: 20px; height: 20px;
  font-size: 11px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--bg-page-bg-page-bg);
  line-height: 1;
  box-shadow: 0 0 0 1px rgba(250,204,21,0.35);
  animation: fbsPulse 1.8s ease-in-out infinite;
  pointer-events: none;
}

/* ===== GLOBAL FOCUS STATE ===== */
.wb-root input:focus,
.wb-root select:focus,
.wb-root textarea:focus {
  border-color: var(--accent);
  outline: none;
}

/* ============================================================
   RESPONSIVE BREAKPOINTS
   ============================================================ */

.wb-root.px-4 { padding-left: 16px; padding-right: 16px; }

@media (max-width: 1280px) { .wb-layout { gap: 14px; } }
@media (max-width: 1024px) { .wb-layout { gap: 12px; } }

@media (max-width: 820px) {
  .wb-layout { flex-direction: column; gap: 0; }
  .wb-root.px-4 { padding-left: 12px; padding-right: 12px; }
  .cmr-odds-locked { width: auto; flex: 1; min-width: 0; max-width: none; }
}

@media (max-width: 700px) {
  .motd-body { flex-direction: column; }
}

@media (max-width: 640px) {
  .wb-root.px-4 { padding-left: 8px; padding-right: 8px; }
  .cmsec-title { font-size: 9px; }
  .cmsec-col-lbl { width: 44px; font-size: 8px; }
  .cmr { padding: 7px 5px 7px 7px; gap: 4px; min-height: 50px; }
  .cmr.live, .cmr.admin { padding-left: 5px; }
  .cmr-left { width: 40px; min-width: 40px; }
  .cmr-time { font-size: 13px; }
  .cmr-date { font-size: 7px; }
  .cmr-id { display: none; }
  .cmr-name { font-size: 13.5px; }
  .cmr-countdown { display: none; }
  .cmr-btn { min-width: 26px; height: 38px; border-radius: 6px; }
  .cmr-btn-label { font-size: 10px; }
  .cmr-btn-val { font-size: 12.5px; }
  .cmr-odds { gap: 2px; flex: 0 1 60%; max-width: 60%; }
  .cmr-stats { width: 24px; height: 24px; }
  .rmr { padding: 7px 5px 7px 7px; gap: 3px; }
  .rmr-left { width: 40px; min-width: 40px; }
  .rmr-team-name { font-size: 16px; }
  .rmr-right { min-width: 40px; }
  .rmr-league { display: none; }
  .ttb-scroll { gap: 6px; padding: 2px 0 6px; }
  .ttb-pill { padding: 6px 12px; font-size: 11px; }
  .ttb-live-count { min-width: 16px; height: 16px; font-size: 9px; padding: 0 4px; }
  .hl-pick-banner { margin: 6px 8px 4px; padding: 7px 9px; gap: 6px; }
  .hl-pick-team { font-size: 11px; }
  .hl-pick-label { font-size: 9px; }
  .hl-pick-odd { font-size: 13px; }
  .fbs-btn { width: 50px; height: 50px; bottom: calc(72px + env(safe-area-inset-bottom, 0px)); right: calc(12px + env(safe-area-inset-right, 0px)); }
  .fbs-btn .material-icons { font-size: 22px !important; }
  .fbs-badge { width: 18px; height: 18px; font-size: 9px; top: -3px; right: -3px; }
  .motd-team-col { min-width: 48px; }
  .motd-vs-text { font-size: 15px; }
  .motd-odd-btn { min-width: 0; padding: 6px 2px; }
  .motd-odd-val { font-size: 13px; }
  .motd-odd-team { font-size: 8px; }
  .motd-all-markets { font-size: 9px; padding: 8px; }
  .motd-nav-btn { width: 18px; height: 18px; font-size: 13px; }
  .motd-dot { width: 4px; height: 4px; }
  .motd-dots { max-width: 60px; }
  .motd-boosted-badge { font-size: 7px; padding: 2px 5px; }
  .motd-odds-label { font-size: 7px; }
  .motd-eyebrow { padding: 6px 10px 6px; }
  .motd-eyebrow-label { font-size: 9px; }
  .motd-eyebrow-comp { max-width: 80px; font-size: 8px; }
  .motd-body { padding: 10px 8px; gap: 10px; }
}

@media (max-width: 480px) {
  .wb-root.px-4 { padding-left: 6px; padding-right: 6px; }
  .cmsec { border-radius: 10px; margin-bottom: 10px; }
  .cmsec-hdr { padding: 8px 8px 6px; }
  .cmsec-title { font-size: 8px; gap: 4px; }
  .cmsec-cnt { font-size: 7px; }
  .cmsec-col-hdr { padding: 2px 4px; gap: 2px; }
  .cmsec-col-lbl { width: 36px; font-size: 7px; }
  .cmr { padding: 5px 4px 5px 5px; gap: 3px; min-height: 44px; border-bottom-width: 0.5px; }
  .cmr.live, .cmr.admin { border-left-width: 2px; padding-left: 4px; }
  .cmr-left { width: 32px; min-width: 32px; gap: 0; }
  .cmr-date { font-size: 6px; }
  .cmr-time { font-size: 9px; }
  .cmr-live { font-size: 8px; }
  .cmr-live svg { font-size: 6px !important; }
  .cmr-star { font-size: 9px; }
  .cmr-team { gap: 3px; }
  .cmr-score { font-size: 10px; min-width: 10px; }
  .cmr-name { font-size: 14px; }
  .cmr-btn { min-width: 26px; height: 30px; border-radius: 5px; border-width: 1px; padding: 0 1px; }
  .cmr-btn-label { font-size: 9px; }
  .cmr-btn-val { font-size: 11px; margin-top: 1px; }
  .cmr-stats { width: 20px; height: 20px; border-radius: 5px; border-width: 1px; }
  .cmr-stats svg { width: 11px; height: 11px; }
  .cmr-odds-locked { height: 32px; max-width: 30vw; gap: 1px; }
  .cmr-odds-locked svg { font-size: 10px !important; }
  .cmr-locked-label { font-size: 6px; }
  .rmr { padding: 5px 4px 5px 5px; gap: 2px; min-height: 44px; }
  .rmr-left { width: 32px; min-width: 32px; gap: 0; }
  .rmr-date { font-size: 7px; }
  .rmr-time { font-size: 9px; }
  .rmr-idx { display: none; }
  .rmr-team-name { font-size: 15px; }
  .rmr-score { font-size: 10px; min-width: 12px; }
  .rmr-right { min-width: 32px; gap: 1px; }
  .rmr-badge { font-size: 7px; padding: 1px 4px; }
  .rmr .cmr-stats { width: 18px; height: 18px; }
  .rmr .cmr-stats svg { width: 10px; height: 10px; }
  .motd-team-col { min-width: 40px; }
  .motd-vs-text { font-size: 13px; }
  .motd-odd-btn { padding: 4px; }
  .motd-odd-val { font-size: 11px; }
  .motd-dots { max-width: 40px; }
  .motd-nav-btn { width: 16px; height: 16px; }
  .motd-boosted-badge { font-size: 7px; padding: 2px 5px; }
  .motd-odds-label { font-size: 7px; }
  .motd-eyebrow-comp { max-width: 80px; font-size: 8px; }
  .ttb-pill { padding: 5px 10px; font-size: 10px; }
  .fbs-btn { width: 44px; height: 44px; bottom: calc(64px + env(safe-area-inset-bottom, 0px)); right: calc(8px + env(safe-area-inset-right, 0px)); }
  .fbs-btn .material-icons { font-size: 20px !important; }
  .fbs-badge { width: 16px; height: 16px; font-size: 8px; top: -3px; right: -3px; }
}

@media (max-width: 380px) {
  .wb-root.px-4 { padding-left: 4px; padding-right: 4px; }
  .cmsec { border-radius: 8px; margin-bottom: 8px; border-width: 1px; }
  .cmsec-hdr { padding: 6px 6px 4px; }
  .cmsec-title { font-size: 7px; }
  .cmsec-cnt { font-size: 7px; }
  .cmsec-col-lbl { width: 30px; font-size: 6px; }
  .cmr { padding: 4px 3px 4px 4px; gap: 2px; min-height: 46px; }
  .cmr-left { width: 26px; min-width: 26px; }
  .cmr-time { font-size: 8px; }
  .cmr-date { font-size: 5px; }
  .cmr-live { font-size: 7px; }
  .cmr-name { font-size: 13px; }
  .cmr-btn { min-width: 24px; height: 28px; border-radius: 4px; }
  .cmr-btn-label { font-size: 8px; }
  .cmr-btn-val { font-size: 10px; }
  .cmr-stats { width: 16px; height: 16px; border-radius: 4px; }
  .cmr-stats svg { width: 9px; height: 9px; }
  .cmr-odds-locked { height: 28px; max-width: 25vw; }
  .cmr-odds-locked svg { font-size: 8px !important; }
  .cmr-locked-label { font-size: 5px; }
  .rmr { padding: 4px 3px 4px 4px; min-height: 46px; }
  .rmr-left { width: 26px; min-width: 26px; }
  .rmr-time { font-size: 8px; }
  .rmr-date { font-size: 6px; }
  .rmr-team-info img, .rmr-team-info > div { width: 22px !important; height: 16px !important; }
  .rmr-team-name { font-size: 14px; }
  .rmr-score { font-size: 9px; min-width: 10px; }
  .rmr-right { min-width: 26px; }
  .rmr-badge { font-size: 6px; padding: 1px 3px; }
  .rmr .cmr-stats { width: 14px; height: 14px; }
  .rmr .cmr-stats svg { width: 8px; height: 8px; }
  .motd-team-col { min-width: 36px; }
  .motd-team-name { font-size: 8px; }
  .motd-vs-text { font-size: 11px; }
  .motd-odd-val { font-size: 10px; }
  .motd-odd-team { font-size: 7px; }
  .motd-nav-btn { width: 14px; height: 14px; font-size: 10px; }
  .motd-dot { width: 3px; height: 3px; }
  .motd-dots { max-width: 32px; gap: 2px; }
  .ttb-pill { padding: 4px 8px; font-size: 9px; }
  .fbs-btn { width: 40px; height: 40px; bottom: calc(56px + env(safe-area-inset-bottom, 0px)); right: calc(8px + env(safe-area-inset-right, 0px)); }
  .fbs-btn .material-icons { font-size: 18px !important; }
  .fbs-badge { width: 14px; height: 14px; font-size: 7px; top: -2px; right: -2px; }
}

@media (max-width: 360px) {
  .ttb-pill { padding: 4px 6px; font-size: 8px; gap: 3px; }
  .ttb-live-count { min-width: 14px; height: 14px; font-size: 8px; padding: 0 3px; }
}

/* ===== GLOBAL OVERFLOW SAFETY ===== */
.wb-root, .wb-main, .cmsec, .cmr, .rmr, .motd-wrap, .motd-body, .motd-motd-body, .motd-odds-panel { overflow-x: hidden; }

/* ===== TOUCH OPTIMIZATIONS (GLOBAL) ===== */
.cmr, .rmr, .cmr-btn, .motd-odd-btn, .ttb-pill, .pls-item, .motd-nav-btn, .motd-all-markets,
.rs-place-btn, .rs-acc-copy, .fbs-btn, .rs-betslip-remove, .cmr-stats,
.supporter-chip, .rs-acc-copy, .ttb-pill, .pls-item {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

/* Active press states for all interactive elements */
.cmr-btn:active, .motd-odd-btn:active, .ttb-pill:active, .motd-nav-btn:active,
.motd-all-markets:active, .pls-item:active, .rs-place-btn:active,
.rs-acc-copy:active, .fbs-btn:active, .rs-betslip-remove:active,
.cmr-stats:active, .supporter-chip:active {
  transform: scale(0.96);
}

/* Focus visible for accessibility */
.cmr-btn:focus-visible, .motd-odd-btn:focus-visible, .ttb-pill:focus-visible,
.motd-nav-btn:focus-visible, .motd-all-markets:focus-visible, .pls-item:focus-visible,
.rs-place-btn:focus-visible, .rs-acc-copy:focus-visible, .fbs-btn:focus-visible,
.rs-betslip-remove:focus-visible, .cmr-stats:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ===== PRINT STYLES (optional) ===== */
@media print {
  .fbs-btn, .ttb-wrap, .pls-sidebar, .rs-sidebar, .supporters-wrap, .site-footer { display: none !important; }
  .wb-layout { flex-direction: column; gap: 0; padding-bottom: 0; }
  .wb-root { background: #fff; color: #000; min-height: auto; }
  .cmsec { border: 1px solid #ccc; box-shadow: none; background: #fff; break-inside: avoid; }
  .cmr, .rmr { border-bottom: 1px solid #eee; background: #fff !important; }
  .cmr-btn, .motd-odd-btn { border: 1px solid #ccc; background: #f5f5f5 !important; color: #000 !important; }
}

/* ============================================================
   RESPONSIVE BREAKPOINTS — FIXED: no phantom sidebar space
   ============================================================ */

.wb-root.px-4 { padding-left: 16px; padding-right: 16px; }

/* Desktop: 3-column layout */
@media (min-width: 1201px) {
  .wb-layout { gap: 16px; }
}
@media (min-width: 1025px) and (max-width: 1200px) {
  .wb-layout { gap: 14px; }
}

/* Tablet: hide right sidebar, main takes full remaining width */
@media (max-width: 1200px) {
  .rs-sidebar { display: none !important; }
  .wb-main { flex: 1 1 auto; width: 100%; max-width: 100%; }
  .wb-layout { gap: 12px; }
}

/* Mobile: hide left sidebar too, stack everything */
@media (max-width: 1024px) {
  .pls-sidebar { display: none !important; }
  .wb-layout { 
    flex-direction: column; 
    gap: 0; 
    padding-bottom: 100px; /* keep space for FAB */
  }
  .wb-main { 
    width: 100%; 
    max-width: 100%; 
    min-width: 0;
    padding: 0; /* remove any internal padding */
  }
  .wb-root.px-4 { padding-left: 12px; padding-right: 12px; }
  .cmr-odds-locked { width: auto; flex: 1; min-width: 0; max-width: none; }
}

/* ─── All your existing mobile breakpoints stay the same ─── */
@media (max-width: 700px) {
  .motd-body { flex-direction: column; }
}

@media (max-width: 640px) {
  .wb-root.px-4 { padding-left: 8px; padding-right: 8px; }
  .cmsec-title { font-size: 9px; }
  .cmsec-col-lbl { width: 44px; font-size: 8px; }
  .cmr { padding: 7px 5px 7px 7px; gap: 4px; min-height: 50px; }
  .cmr.live, .cmr.admin { padding-left: 5px; }
  .cmr-left { width: 40px; min-width: 40px; }
  .cmr-time { font-size: 10px; }
  .cmr-date { font-size: 7px; }
  .cmr-id { display: none; }
  .cmr-name { font-size: 13.5px; }
  .cmr-countdown { display: none; }
  .cmr-btn { min-width: 26px; height: 38px; border-radius: 6px; }
  .cmr-btn-label { font-size: 10px; }
  .cmr-btn-val { font-size: 12.5px; }
  .cmr-odds { gap: 2px; flex: 0 1 60%; max-width: 60%; }
  .cmr-stats { width: 24px; height: 24px; }
  .rmr { padding: 7px 5px 7px 7px; gap: 3px; }
  .rmr-left { width: 40px; min-width: 40px; }
  .rmr-team-name { font-size: 16px; }
  .rmr-right { min-width: 40px; }
  .rmr-league { display: none; }
  .ttb-scroll { gap: 6px; padding: 2px 0 6px; }
  .ttb-pill { padding: 6px 12px; font-size: 11px; }
  .ttb-live-count { min-width: 16px; height: 16px; font-size: 9px; padding: 0 4px; }
  .hl-pick-banner { margin: 6px 8px 4px; padding: 7px 9px; gap: 6px; }
  .hl-pick-team { font-size: 11px; }
  .hl-pick-label { font-size: 9px; }
  .hl-pick-odd { font-size: 13px; }
  .fbs-btn { width: 50px; height: 50px; bottom: calc(72px + env(safe-area-inset-bottom, 0px)); right: calc(12px + env(safe-area-inset-right, 0px)); }
  .fbs-btn .material-icons { font-size: 22px !important; }
  .fbs-badge { width: 18px; height: 18px; font-size: 9px; top: -3px; right: -3px; }
  .motd-team-col { min-width: 48px; }
  .motd-vs-text { font-size: 15px; }
  .motd-odd-btn { min-width: 0; padding: 6px 2px; }
  .motd-odd-val { font-size: 13px; }
  .motd-odd-team { font-size: 8px; }
  .motd-all-markets { font-size: 9px; padding: 8px; }
  .motd-nav-btn { width: 18px; height: 18px; font-size: 13px; }
  .motd-dot { width: 4px; height: 4px; }
  .motd-dots { max-width: 60px; }
  .motd-boosted-badge { font-size: 7px; padding: 2px 5px; }
  .motd-odds-label { font-size: 7px; }
  .motd-eyebrow { padding: 6px 10px 6px; }
  .motd-eyebrow-label { font-size: 9px; }
  .motd-eyebrow-comp { max-width: 80px; font-size: 8px; }
  .motd-body { padding: 10px 8px; gap: 10px; }
}

@media (max-width: 480px) {
  .wb-root.px-4 { padding-left: 6px; padding-right: 6px; }
  .cmsec { border-radius: 10px; margin-bottom: 10px; }
  .cmsec-hdr { padding: 8px 8px 6px; }
  .cmsec-title { font-size: 8px; gap: 4px; }
  .cmsec-cnt { font-size: 7px; }
  .cmsec-col-hdr { padding: 2px 4px; gap: 2px; }
  .cmsec-col-lbl { width: 36px; font-size: 7px; }
  .cmr { padding: 5px 4px 5px 5px; gap: 3px; min-height: 44px; border-bottom-width: 0.5px; }
  .cmr.live, .cmr.admin { border-left-width: 2px; padding-left: 4px; }
  .cmr-left { width: 32px; min-width: 32px; gap: 0; }
  .cmr-date { font-size: 6px; }
  .cmr-time { font-size: 9px; }
  .cmr-live { font-size: 8px; }
  .cmr-live svg { font-size: 6px !important; }
  .cmr-star { font-size: 9px; }
  .cmr-team { gap: 3px; }
  .cmr-score { font-size: 10px; min-width: 10px; }
  .cmr-name { font-size: 13px; }
  .cmr-btn { min-width: 26px; height: 30px; border-radius: 5px; border-width: 1px; padding: 0 1px; }
  .cmr-btn-label { font-size: 9px; }
  .cmr-btn-val { font-size: 11px; margin-top: 1px; }
  .cmr-stats { width: 20px; height: 20px; border-radius: 5px; border-width: 1px; }
  .cmr-stats svg { width: 11px; height: 11px; }
  .cmr-odds-locked { height: 32px; max-width: 30vw; gap: 1px; }
  .cmr-odds-locked svg { font-size: 10px !important; }
  .cmr-locked-label { font-size: 6px; }
  .rmr { padding: 5px 4px 5px 5px; gap: 2px; min-height: 44px; }
  .rmr-left { width: 32px; min-width: 32px; gap: 0; }
  .rmr-date { font-size: 7px; }
  .rmr-time { font-size: 9px; }
  .rmr-idx { display: none; }
  .rmr-team-name { font-size: 15px; }
  .rmr-score { font-size: 10px; min-width: 12px; }
  .rmr-right { min-width: 32px; gap: 1px; }
  .rmr-badge { font-size: 7px; padding: 1px 4px; }
  .rmr .cmr-stats { width: 18px; height: 18px; }
  .rmr .cmr-stats svg { width: 10px; height: 10px; }
  .motd-team-col { min-width: 40px; }
  .motd-vs-text { font-size: 13px; }
  .motd-odd-btn { padding: 4px; }
  .motd-odd-val { font-size: 11px; }
  .motd-dots { max-width: 40px; }
  .motd-nav-btn { width: 16px; height: 16px; }
  .motd-boosted-badge { font-size: 7px; padding: 2px 5px; }
  .motd-odds-label { font-size: 7px; }
  .motd-eyebrow-comp { max-width: 80px; font-size: 8px; }
  .ttb-pill { padding: 5px 10px; font-size: 10px; }
  .fbs-btn { width: 44px; height: 44px; bottom: calc(64px + env(safe-area-inset-bottom, 0px)); right: calc(8px + env(safe-area-inset-right, 0px)); }
  .fbs-btn .material-icons { font-size: 20px !important; }
  .fbs-badge { width: 16px; height: 16px; font-size: 8px; top: -3px; right: -3px; }
}

@media (max-width: 380px) {
  .wb-root.px-4 { padding-left: 4px; padding-right: 4px; }
  .cmsec { border-radius: 8px; margin-bottom: 8px; border-width: 1px; }
  .cmsec-hdr { padding: 6px 6px 4px; }
  .cmsec-title { font-size: 7px; }
  .cmsec-cnt { font-size: 7px; }
  .cmsec-col-lbl { width: 30px; font-size: 6px; }
  .cmr { padding: 4px 3px 4px 4px; gap: 2px; min-height: 46px; }
  .cmr-left { width: 26px; min-width: 26px; }
  .cmr-time { font-size: 8px; }
  .cmr-date { font-size: 5px; }
  .cmr-live { font-size: 7px; }
  .cmr-name { font-size: 12px; }
  .cmr-btn { min-width: 24px; height: 28px; border-radius: 4px; }
  .cmr-btn-label { font-size: 8px; }
  .cmr-btn-val { font-size: 10px; }
  .cmr-stats { width: 16px; height: 16px; border-radius: 4px; }
  .cmr-stats svg { width: 9px; height: 9px; }
  .cmr-odds-locked { height: 28px; max-width: 25vw; }
  .cmr-odds-locked svg { font-size: 8px !important; }
  .cmr-locked-label { font-size: 5px; }
  .rmr { padding: 4px 3px 4px 4px; min-height: 46px; }
  .rmr-left { width: 26px; min-width: 26px; }
  .rmr-time { font-size: 8px; }
  .rmr-date { font-size: 6px; }
  .rmr-team-info img, .rmr-team-info > div { width: 22px !important; height: 16px !important; }
  .rmr-team-name { font-size: 14px; }
  .rmr-score { font-size: 9px; min-width: 10px; }
  .rmr-right { min-width: 26px; }
  .rmr-badge { font-size: 6px; padding: 1px 3px; }
  .rmr .cmr-stats { width: 14px; height: 14px; }
  .rmr .cmr-stats svg { width: 8px; height: 8px; }
  .motd-team-col { min-width: 36px; }
  .motd-team-name { font-size: 8px; }
  .motd-vs-text { font-size: 11px; }
  .motd-odd-val { font-size: 10px; }
  .motd-odd-team { font-size: 7px; }
  .motd-nav-btn { width: 14px; height: 14px; font-size: 10px; }
  .motd-dot { width: 3px; height: 3px; }
  .motd-dots { max-width: 32px; gap: 2px; }
  .ttb-pill { padding: 4px 8px; font-size: 9px; }
  .fbs-btn { width: 40px; height: 40px; bottom: calc(56px + env(safe-area-inset-bottom, 0px)); right: calc(8px + env(safe-area-inset-right, 0px)); }
  .fbs-btn .material-icons { font-size: 18px !important; }
  .fbs-badge { width: 14px; height: 14px; font-size: 7px; top: -2px; right: -2px; }
}

@media (max-width: 360px) {
  .ttb-pill { padding: 4px 6px; font-size: 8px; gap: 3px; }
  .ttb-live-count { min-width: 14px; height: 14px; font-size: 8px; padding: 0 3px; }
}

`}</style>


    </div>
  );
}