import { useState, useMemo, useRef, useEffect } from 'react';

import CasinoIcon from '@mui/icons-material/Casino';
import GridViewIcon from '@mui/icons-material/GridView';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import DiamondIcon from '@mui/icons-material/Diamond';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import CircleIcon from '@mui/icons-material/Circle';
import CasinoIcon2 from '@mui/icons-material/Casino';
import Filter9PlusIcon from '@mui/icons-material/Filter9Plus';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ConstructionIcon from '@mui/icons-material/Construction';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';

import VirtualFootballGame from './VirtualFootballGame';
import SpinDaBottleGame from './Spindabottlegame';
import AviatorGame from './Aviatorgame';
import MinesGame from './MinesGames';
import SportyKickGame from './SportyKickGame';
import MagicBallGame from './MagicBallGame';
import FruitFrenzyGame from './FruitFrenzyGame';
import { useCountry } from '../hooks/useCountry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CasinoGame {
  slug: string;
  name: string;
  provider: string;
  family: string;
  badge: 'POPULAR' | 'EXCLUSIVE' | 'NEW' | null;
  players: number;
  accentColor: string;
  Icon: React.ElementType;
  image: string;
  /** Slugs listed here render a real in-page game section instead of the "coming soon" toast */
  playable?: boolean;
}

interface RecentWin {
  slug: string;
  player: string;
  tag: string;
}

// ---------------------------------------------------------------------------
// Sidebar categories
// ---------------------------------------------------------------------------
const categories = [
  { key: 'all', label: 'All Games', Icon: GridViewIcon },
  { key: 'favourites', label: 'My Favourites', Icon: FavoriteBorderIcon },
  { key: 'popular', label: 'Popular', Icon: LocalFireDepartmentIcon },
  { key: 'new', label: 'New', Icon: AutoAwesomeIcon },
  { key: 'crash', label: 'Crash', Icon: RocketLaunchIcon },
  { key: 'wheel', label: 'Wheel', Icon: CircleIcon },
  { key: 'dice', label: 'Dice', Icon: DiamondIcon },
  { key: 'numbers', label: 'Numbers', Icon: Filter9PlusIcon },
  { key: 'table', label: 'Table', Icon: SportsSoccerIcon },
];

// ---------------------------------------------------------------------------
// Game catalogue — only playable games remain
// ---------------------------------------------------------------------------
const casinoGames: CasinoGame[] = [
  {
    slug: 'aviator',
    name: 'Aviator',
    provider: 'Spribe',
    family: 'crash',
    badge: 'POPULAR',
    players: 765,
    accentColor: '#ff4d4d',
    Icon: FlightTakeoffIcon,
    image: 'https://s.sporty.net/sportygames/lobby_banner/1648540504987.png',
    playable: true,
  },
  {
    slug: 'sporty-hero',
    name: 'Sporty Kick',
    provider: 'In-House',
    family: 'crash',
    badge: 'EXCLUSIVE',
    players: 810,
    accentColor: '#f5a623',
    Icon: SportsSoccerIcon,
    image: 'https://s.sporty.net/sportygames/lobby_banner/1746091399180.png',
    playable: true,
  },
  {
    slug: 'spin-da-bottle',
    name: "Spin da' Bottle",
    provider: 'In-House',
    family: 'wheel',
    badge: null,
    players: 825,
    accentColor: '#7ed321',
    Icon: CircleIcon,
    image: 'https://s.sporty.net/sportygames/lobby_banner/1738222851489.png',
    playable: true,
  },
  {
    slug: 'mines',
    name: 'Mines',
    provider: 'In-House',
    family: 'dice',
    badge: null,
    players: 412,
    accentColor: '#00c853',
    Icon: DiamondIcon,
    image: 'https://s.sporty.net/sportygames/lobby_banner/1683538887869.png',
    playable: true,
  },
  {
    slug: 'virtual-football',
    name: 'Virtual Football',
    provider: 'In-House',
    family: 'table',
    badge: 'POPULAR',
    players: 298,
    accentColor: '#44dd88',
    Icon: SportsSoccerIcon,
    image: 'https://s.sporty.net/common/main/res/59bd76f2fe42b8cd5daf90e91b822ef3.jpg',
    playable: true,
  },
  {
    slug: 'magic-ball',
    name: 'Magic Ball',
    provider: 'In-House',
    family: 'numbers',
    badge: 'NEW',
    players: 254,
    accentColor: '#9966ff',
    Icon: CasinoIcon2,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT2Wfeydc72t9am2u5AYpCn7FL-VGWy9b_sle4_gd8b5a33MpR_Ht5XtU9o&s=10',
    playable: true,
  },
  {
    slug: 'fruit-frenzy',
    name: 'Fruit Frenzy',
    provider: 'In-House',
    family: 'quick',
    badge: 'NEW',
    players: 341,
    accentColor: '#ff7043',
    Icon: AutoAwesomeIcon,
    image: 'https://mir-s3-cdn-cf.behance.net/projects/404/18f2d0222189047.Y3JvcCwxNjM2LDEyODAsMTA1LDA.png',
    playable: true,
  },
];

// Recent wins ticker — only references games that still exist in the catalogue
const recentWins: RecentWin[] = [
  { slug: 'aviator', player: 'w***s', tag: '14.2x cash out' },
  { slug: 'spin-da-bottle', player: '5***9', tag: 'Big win' },
  { slug: 'mines', player: 'a***5', tag: '3 gems cleared' },
  { slug: 'sporty-hero', player: 'k***2', tag: 'Bonus round' }, // displays as "Sporty Kick"
  { slug: 'fruit-frenzy', player: 'f***2', tag: 'Triple cherry win' },
  { slug: 'virtual-football', player: 'v***1', tag: 'Match won' },
  { slug: 'magic-ball', player: 'm***4', tag: 'Lucky number hit' },
];

// ---------------------------------------------------------------------------
// Games that are actually live right now. Everything else in the catalogue
// pops the "still in development" modal instead of opening.
// ---------------------------------------------------------------------------
// Every slug here has a real React component wired up in renderOpenGame()
// below. The previous list omitted sporty-hero, magic-ball and fruit-frenzy
// even though they were flagged `playable: true` in the catalogue AND had
// working components — so clicking them showed a "still in development"
// popup for a game that was already finished.
const LIVE_SLUGS = new Set([
  'aviator',
  'virtual-football',
  'mines',
  'spin-da-bottle',
  'sporty-hero',
  'magic-ball',
  'fruit-frenzy',
]);
// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function CasinoPage() {
  const { country, fmt, minStake } = useCountry();
  const [activeCategory, setActiveCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Which playable game currently occupies the main content area (null = grid view)
  const [openGameSlug, setOpenGameSlug] = useState<string | null>(null);

  // Game currently shown in the "still in development" modal (null = closed)
  const [devGame, setDevGame] = useState<CasinoGame | null>(null);
  const [notifyMeSent, setNotifyMeSent] = useState(false);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const gameBySlug = useMemo(() => {
    const map = new Map<string, CasinoGame>();
    casinoGames.forEach((g) => map.set(g.slug, g));
    return map;
  }, []);

  const filtered = useMemo(() => {
    let list = casinoGames;
    if (activeCategory === 'favourites') {
      list = list.filter((g) => favourites.has(g.slug));
    } else if (activeCategory === 'popular') {
      list = list.filter((g) => g.badge === 'POPULAR');
    } else if (activeCategory === 'new') {
      list = list.filter((g) => g.badge === 'NEW');
    } else if (activeCategory !== 'all') {
      list = list.filter((g) => g.family === activeCategory);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    return list;
  }, [activeCategory, query, favourites]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const handleGameClick = (game: CasinoGame) => {
    if (game.playable && LIVE_SLUGS.has(game.slug)) {
      setOpenGameSlug(game.slug);
      return;
    }
    // Everything else (including games flagged playable in data but not yet
    // actually shipped) shows the "still in development" popup.
    setNotifyMeSent(false);
    setDevGame(game);
  };

  const closeDevModal = () => {
    setDevGame(null);
    setNotifyMeSent(false);
  };

  const handleNotifyMe = () => {
    setNotifyMeSent(true);
    if (devGame) {
      showToast(`We'll notify you when ${devGame.name} launches.`);
    }
  };

  const toggleFavourite = (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const badgeStyles: Record<string, { bg: string; label: string }> = {
    POPULAR: { bg: '#e53935', label: 'POPULAR' },
    EXCLUSIVE: { bg: '#f5a623', label: 'EXCLUSIVE' },
    NEW: { bg: '#43a047', label: 'NEW' },
  };

  const openGame = openGameSlug ? gameBySlug.get(openGameSlug) : null;

  // Maps a playable slug to its actual React game component.
  const renderOpenGame = () => {
    if (!openGame) return null;
    switch (openGame.slug) {
      case 'virtual-football':
        return <VirtualFootballGame onExit={() => setOpenGameSlug(null)} />;
      case 'spin-da-bottle':
        return <SpinDaBottleGame onExit={() => setOpenGameSlug(null)} />;
      case 'aviator':
        return <AviatorGame onExit={() => setOpenGameSlug(null)} />;
      case 'mines':
        return <MinesGame onExit={() => setOpenGameSlug(null)} />;
      case 'sporty-hero':
        return <SportyKickGame onExit={() => setOpenGameSlug(null)} />;
      case 'magic-ball':
        return <MagicBallGame onExit={() => setOpenGameSlug(null)} />;
      case 'fruit-frenzy':
        return <FruitFrenzyGame onExit={() => setOpenGameSlug(null)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex" style={{ color: 'var(--text-main)' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-56 flex-shrink-0 py-4 px-2 gap-1 overflow-y-auto"
        style={{ borderRight: '1px solid var(--border-light)', backgroundColor: 'var(--card-bg)' }}
      >
        <div className="flex items-center gap-2 px-3 pb-3 mb-1" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <CasinoIcon style={{ color: 'var(--primary)' }} fontSize="small" />
          <span className="font-bold text-sm">Casino</span>
        </div>
        {categories.map((cat) => {
          const active = activeCategory === cat.key && !openGame;
          const count =
            cat.key === 'favourites'
              ? favourites.size
              : cat.key === 'all'
              ? casinoGames.length
              : null;
          return (
            <button
              key={cat.key}
              onClick={() => {
                setOpenGameSlug(null);
                setActiveCategory(cat.key);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left"
              style={{
                backgroundColor: active ? 'var(--primary)' : 'transparent',
                color: active ? '#fff' : 'var(--text-muted)',
              }}
            >
              <cat.Icon sx={{ fontSize: 18 }} />
              <span className="flex-1 truncate">{cat.label}</span>
              {count !== null && count > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: active ? 'rgba(255,255,255,0.25)' : 'var(--card-alt)',
                    color: active ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 p-4">
        <div className="max-w-5xl mx-auto">

          {openGame ? (
            /* ── In-page game section (real React component, no iframe) ── */
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setOpenGameSlug(null)}
                className="self-start flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
                Back to games
              </button>
              {renderOpenGame()}
            </div>
          ) : (
            <>
              {/* ── Currency & stake strip ──────────────────────────────────
                  Shows which currency the lobby is priced in and what the
                  stake floor is, before the player opens anything. Both come
                  from the country chosen at registration. */}
              <div
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 px-3 py-2 rounded-lg text-xs"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-muted)',
                }}
              >
                <span className="flex items-center gap-1.5">
                  <span style={{ fontSize: 14 }}>{country.flag}</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                    {country.currency}
                  </span>
                </span>
                <span>
                  Min stake{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{fmt(minStake)}</strong>
                </span>
                <span>
                  Max stake{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{fmt(country.maxStake)}</strong>
                </span>
              </div>

              {/* Mobile category bar (sidebar is hidden below md) */}
              <div className="flex md:hidden items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
                {categories.map((cat) => {
                  const active = activeCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setActiveCategory(cat.key)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0"
                      style={{
                        backgroundColor: active ? 'var(--primary)' : 'var(--card-bg)',
                        color: active ? '#fff' : 'var(--text-muted)',
                        border: `1px solid ${active ? 'var(--primary)' : 'var(--border-light)'}`,
                      }}
                    >
                      <cat.Icon sx={{ fontSize: 14 }} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Top Wins — continuous auto-scrolling carousel */}
              <div
                className="mb-6 rounded-2xl p-4 overflow-hidden"
                style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-light)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <EmojiEventsIcon sx={{ fontSize: 18, color: '#eab308' }} />
                  <h2 className="text-sm font-bold">Top Wins Today</h2>
                </div>

                <div className="wins-marquee-viewport">
                  <div className="wins-marquee-track">
                    {[...recentWins, ...recentWins].map((win, i) => {
                      const game = gameBySlug.get(win.slug);
                      if (!game) return null;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 flex-shrink-0 px-3 py-2 rounded-xl"
                          style={{
                            width: '230px',
                            backgroundColor: 'var(--card-alt)',
                            border: '1px solid var(--border-light)',
                          }}
                        >
                          <EmojiEventsIcon sx={{ fontSize: 18, color: '#eab308' }} className="flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-main)' }}>
                              {win.tag}
                            </p>
                            <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                              {win.player} · {game.name}
                            </p>
                          </div>
                          <button
                            onClick={() => handleGameClick(game)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                            style={{ backgroundColor: '#43a047', color: '#fff' }}
                          >
                            PLAY
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <style>{`
                  .wins-marquee-viewport {
                    overflow: hidden;
                    width: 100%;
                  }
                  .wins-marquee-track {
                    display: flex;
                    gap: 12px;
                    width: max-content;
                    animation: wins-marquee-scroll 24s linear infinite;
                  }
                  .wins-marquee-viewport:hover .wins-marquee-track {
                    animation-play-state: paused;
                  }
                  @keyframes wins-marquee-scroll {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
                  }
                  @media (prefers-reduced-motion: reduce) {
                    .wins-marquee-track {
                      animation: none;
                    }
                  }
                `}</style>
              </div>

              {/* Header row: title + search */}
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <h1 className="text-lg font-bold">
                  {categories.find((c) => c.key === activeCategory)?.label ?? 'All Games'}
                </h1>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl w-full sm:w-auto sm:min-w-[280px] sm:max-w-sm transition-all"
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    border: `1px solid ${searchFocused ? 'var(--primary)' : 'var(--border-light)'}`,
                    boxShadow: searchFocused ? '0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent)' : 'none',
                  }}
                >
                  <SearchIcon sx={{ fontSize: 18 }} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    placeholder="Search for your favourite game"
                    aria-label="Search games"
                    className="bg-transparent outline-none text-sm w-full min-w-0"
                    style={{ color: 'var(--text-main)' }}
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--card-alt)' }}
                    >
                      <CloseIcon sx={{ fontSize: 13 }} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  )}
                </div>
              </div>

              {/* Result count when searching */}
              {query.trim() && (
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  {filtered.length} result{filtered.length === 1 ? '' : 's'} for "{query.trim()}"
                </p>
              )}

              {/* Game grid */}
              {filtered.length === 0 ? (
                <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                  <CasinoIcon sx={{ fontSize: 48 }} style={{ opacity: 0.3 }} />
                  <p className="mt-3">No games found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filtered.map((game) => {
                    const isFav = favourites.has(game.slug);
                    const badge = game.badge ? badgeStyles[game.badge] : null;
                    return (
                      <button
                        key={game.slug}
                        onClick={() => handleGameClick(game)}
                        className="relative text-left rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                        style={{ border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.18)')
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)')
                        }
                      >
                        <div className="relative" style={{ aspectRatio: '1 / 1' }}>
                          <img src={game.image} alt={game.name} className="w-full h-full object-cover" loading="lazy" />
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.05) 45%, transparent 70%)',
                            }}
                          />

                          {/* Top-left badge */}
                          {badge && (
                            <span
                              className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md"
                              style={{ backgroundColor: badge.bg, color: '#fff' }}
                            >
                              {badge.label}
                            </span>
                          )}

                          {/* Top-right live players */}
                          <span
                            className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: '#43e043', boxShadow: '0 0 4px #43e043' }}
                            />
                            {game.players} players
                          </span>

                          {/* Favourite heart */}
                          <button
                            onClick={(e) => toggleFavourite(e, game.slug)}
                            className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                          >
                            {isFav ? (
                              <FavoriteIcon sx={{ fontSize: 14, color: '#ff4d4d' }} />
                            ) : (
                              <FavoriteBorderIcon sx={{ fontSize: 14, color: '#fff' }} />
                            )}
                          </button>

                          {/* Game name overlay */}
                          <div className="absolute bottom-2 left-2.5 right-9">
                            <p
                              className="text-sm font-extrabold truncate"
                              style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                            >
                              {game.name}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── "Still in development" popup ─────────────────────────────────── */}
      {devGame && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10,10,14,0.6)', backdropFilter: 'blur(2px)' }}
          onClick={closeDevModal}
        >
          <div
            className="dev-popup-in w-full max-w-[300px] rounded-[20px] px-6 pt-7 pb-5 text-center relative"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border-light)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.28)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeDevModal}
              aria-label="Close"
              className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ color: 'var(--text-muted)' }}
            >
              <CloseIcon sx={{ fontSize: 15 }} />
            </button>

            {/* Icon */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: `${devGame.accentColor}1f` }}
            >
              <ConstructionIcon sx={{ fontSize: 22 }} style={{ color: devGame.accentColor }} />
            </div>

            <h3 className="text-[15px] font-bold leading-snug mb-1">{devGame.name}</h3>
            <p className="text-[13px] leading-snug mb-5" style={{ color: 'var(--text-muted)' }}>
              In development — we'll notify you at launch.
            </p>

            <button
              onClick={handleNotifyMe}
              disabled={notifyMeSent}
              className="w-full flex items-center justify-center gap-1.5 text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors"
              style={{
                backgroundColor: notifyMeSent ? 'var(--card-alt)' : devGame.accentColor,
                color: notifyMeSent ? 'var(--text-muted)' : '#fff',
              }}
            >
              {notifyMeSent ? (
                'You\u2019re on the list'
              ) : (
                <>
                  <NotificationsActiveOutlinedIcon sx={{ fontSize: 15 }} />
                  Notify me
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dev-popup-in {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .dev-popup-in {
          animation: dev-popup-in 0.16s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .dev-popup-in { animation: none; }
        }
      `}</style>

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl"
          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-light)' }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 18 }} style={{ color: 'var(--text-muted)' }} />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}