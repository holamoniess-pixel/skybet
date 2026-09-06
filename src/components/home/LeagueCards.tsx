import { useNavigate } from 'react-router-dom';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import SportsIcon from '@mui/icons-material/Sports';
import StarIcon from '@mui/icons-material/Star';

const topLeagues = [
  {
    name: 'Premier League',
    flag: '🇬🇧',
    gradient: 'from-purple-700 to-purple-900',
    logo: 'https://pngdownload.io/wp-content/uploads/2023/12/Premier-League-Logo-PNG-Iconic-English-Football-Emblem-Transparent-jpg.webp',
  },
  {
    name: 'La Liga',
    flag: '🇪🇸',
    gradient: 'from-red-600 to-red-800',
    logo: 'https://www.freelogovectors.net/wp-content/uploads/2023/07/laliga-logo-freelogovectors.net_.png',
  },
  {
    name: 'Serie A',
    flag: '🇮🇹',
    gradient: 'from-green-700 to-emerald-900',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTa4X4Oa75oDFLlBG-SWbuHOEpXDsXgYfH-XA&s',
  },
  {
    name: 'Champions League',
    flag: '🇪🇺',
    gradient: 'from-blue-700 to-blue-900',
    logo: 'https://static.vecteezy.com/system/resources/thumbnails/010/994/351/small/champions-league-logo-symbol-blue-design-football-european-countries-football-teams-illustration-with-white-background-free-vector.jpg',
  },
];

export default function LeagueCards() {
  const navigate = useNavigate();

  return (
    <div className="px-3 sm:px-4 mt-4 sm:mt-6">

      {/* ── Quick Action Buttons ── */}
      <div className="flex gap-2 mb-4">

        {/* Load Code */}
        <button
          onClick={() => navigate('/betslip')}
          className="flex-1 flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.97] transition-transform"
          style={{
            padding: '9px 10px',
            borderRadius: '12px',
            background: 'transparent',
            border: '1.5px solid rgba(0,0,0,0.15)',
          }}
        >
          <ConfirmationNumberIcon style={{ fontSize: 15, color: '#f59e0b', flexShrink: 0 }} />
          <span style={{
            fontSize: '11px',
            fontWeight: 900,
            letterSpacing: '0.02em',
            color: '#000000',
            whiteSpace: 'nowrap',
          }}>
            Load Code
          </span>
        </button>

        {/* Live Matches */}
        <button
          onClick={() => navigate('/live')}
          className="flex-1 flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.97] transition-transform"
          style={{
            padding: '9px 10px',
            borderRadius: '12px',
            background: 'transparent',
            border: '1.5px solid rgba(0,0,0,0.15)',
          }}
        >
          {/* Pulsing dot */}
          <span className="relative flex items-center justify-center" style={{ width: 8, height: 8, flexShrink: 0 }}>
            <span
              className="absolute inline-flex h-full w-full rounded-full animate-ping"
              style={{ background: '#ef4444', opacity: 0.7 }}
            />
            <span
              className="relative inline-flex rounded-full"
              style={{ width: 6, height: 6, background: '#ef4444' }}
            />
          </span>
          <SportsIcon style={{ fontSize: 15, color: '#ef4444', flexShrink: 0 }} />
          <span style={{
            fontSize: '11px',
            fontWeight: 900,
            letterSpacing: '0.02em',
            color: '#000000',
            whiteSpace: 'nowrap',
          }}>
            Live Matches
          </span>
        </button>

      </div>

      {/* ── League Cards ── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-lg font-bold text-slate-900 dark:text-slate-100">
          Top Leagues
        </h2>
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">See All</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        {topLeagues.map((league) => (
          <button
            key={league.name}
            className={`bg-gradient-to-br ${league.gradient} rounded-xl p-3 sm:p-4 text-white text-left hover:scale-[1.02] active:scale-[0.98] transition-transform touch-manipulation`}
          >
            <div className="flex items-center justify-between mb-3">
              <img
                src={league.logo}
                alt={`${league.name} logo`}
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const sibling = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (sibling) sibling.style.display = 'inline';
                }}
              />
              <span className="text-2xl" style={{ display: 'none' }}>{league.flag}</span>
              <StarIcon className="text-yellow-400" fontSize="small" />
            </div>
            <h3 className="font-heading text-sm font-bold leading-tight">{league.name}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{league.flag} Tap to explore</p>
          </button>
        ))}
      </div>
    </div>
  );
}