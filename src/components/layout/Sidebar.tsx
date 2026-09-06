import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useCountry } from '../../hooks/useCountry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Winner {
  name: string;
  phone: string;
  amount: number;
  minutesAgo: number;
}

interface Ad {
  image: string;
  title: string;
  subtitle: string;
}

// ---------------------------------------------------------------------------
// 60 Recent Winners — 1,000 to 1,000,000 in the player's own currency
// ---------------------------------------------------------------------------
const WINNERS: Winner[] = [
  { name: 'Kwame Mensah',       phone: '0244567890', amount: 450000,  minutesAgo: 2   },
  { name: 'Ama Owusu',          phone: '0554123312', amount: 12500,   minutesAgo: 5   },
  { name: 'Kofi Asante',        phone: '0201237741', amount: 870000,  minutesAgo: 8   },
  { name: 'Abena Darko',        phone: '0591236214', amount: 5200,    minutesAgo: 11  },
  { name: 'Yaw Boateng',        phone: '0271234551', amount: 1000000, minutesAgo: 14  },
  { name: 'Efua Nyarko',        phone: '0244129831', amount: 18750,   minutesAgo: 17  },
  { name: 'Kojo Amponsah',      phone: '0501671234', amount: 330000,  minutesAgo: 20  },
  { name: 'Akua Frimpong',      phone: '0261235401', amount: 7800,    minutesAgo: 23  },
  { name: 'Nana Adjei',         phone: '0571232981', amount: 620000,  minutesAgo: 26  },
  { name: 'Adwoa Sarpong',      phone: '0231237111', amount: 15000,   minutesAgo: 29  },
  { name: 'Kwesi Tetteh',       phone: '0281238361', amount: 485000,  minutesAgo: 33  },
  { name: 'Maame Acheampong',   phone: '0541230721', amount: 9300,    minutesAgo: 36  },
  { name: 'Fiifi Baah',         phone: '0201233491', amount: 750000,  minutesAgo: 40  },
  { name: 'Afia Bonsu',         phone: '0291236151', amount: 22000,   minutesAgo: 43  },
  { name: 'Kwabena Osei',       phone: '0561231881', amount: 4100,    minutesAgo: 46  },
  { name: 'Esi Quansah',        phone: '0244129271', amount: 910000,  minutesAgo: 50  },
  { name: 'Nii Armah',          phone: '0211235631', amount: 38000,   minutesAgo: 53  },
  { name: 'Akosua Mensah',      phone: '0581238041', amount: 2700,    minutesAgo: 56  },
  { name: 'Paa Kwesi',          phone: '0271232311', amount: 560000,  minutesAgo: 60  },
  { name: 'Yaa Asantewaa',      phone: '0331237191', amount: 14200,   minutesAgo: 63  },
  { name: 'Bright Adomako',     phone: '0241239871', amount: 1000,    minutesAgo: 66  },
  { name: 'Serwa Agyemang',     phone: '0551238021', amount: 275000,  minutesAgo: 69  },
  { name: 'Kodjo Mensah',       phone: '0201231341', amount: 63000,   minutesAgo: 72  },
  { name: 'Akua Boateng',       phone: '0261237651', amount: 999000,  minutesAgo: 75  },
  { name: 'Ebo Hayford',        phone: '0281234511', amount: 31000,   minutesAgo: 78  },
  { name: 'Nhyira Asare',       phone: '0241236791', amount: 128000,  minutesAgo: 81  },
  { name: 'Mawuli Dodzi',       phone: '0501238231', amount: 5500,    minutesAgo: 84  },
  { name: 'Abigail Owusu',      phone: '0571239011', amount: 820000,  minutesAgo: 87  },
  { name: 'Kwadwo Frimpong',    phone: '0231232761', amount: 47000,   minutesAgo: 90  },
  { name: 'Dede Quaye',         phone: '0591237431', amount: 3300,    minutesAgo: 93  },
  { name: 'Nana Yaa Mensah',    phone: '0271231081', amount: 690000,  minutesAgo: 96  },
  { name: 'Kofi Boakye',        phone: '0541234561', amount: 11500,   minutesAgo: 99  },
  { name: 'Ama Serwaa',         phone: '0211237891', amount: 430000,  minutesAgo: 102 },
  { name: 'Kwame Asante',       phone: '0581236121', amount: 8900,    minutesAgo: 105 },
  { name: 'Adwoa Tetteh',       phone: '0241230451', amount: 155000,  minutesAgo: 108 },
  { name: 'Yaw Darko',          phone: '0551231671', amount: 72000,   minutesAgo: 111 },
  { name: 'Efua Amponsah',      phone: '0201239341', amount: 510000,  minutesAgo: 114 },
  { name: 'Fiifi Nyarko',       phone: '0261238901', amount: 19000,   minutesAgo: 117 },
  { name: 'Akosua Adjei',       phone: '0281231231', amount: 345000,  minutesAgo: 120 },
  { name: 'Paa Kojo Bonsu',     phone: '0571234321', amount: 1000,    minutesAgo: 123 },
  { name: 'Serwaa Asante',      phone: '0244781234', amount: 780000,  minutesAgo: 126 },
  { name: 'Kofi Agyei',         phone: '0554329871', amount: 25000,   minutesAgo: 129 },
  { name: 'Abena Mensah',       phone: '0201456123', amount: 490000,  minutesAgo: 132 },
  { name: 'Kweku Boateng',      phone: '0271345678', amount: 6700,    minutesAgo: 135 },
  { name: 'Adjoa Tawiah',       phone: '0501987654', amount: 320000,  minutesAgo: 138 },
  { name: 'Ato Koomson',        phone: '0261876543', amount: 88000,   minutesAgo: 141 },
  { name: 'Naana Asiedu',       phone: '0571654321', amount: 1000000, minutesAgo: 144 },
  { name: 'Kofi Acheampong',    phone: '0231543210', amount: 42000,   minutesAgo: 147 },
  { name: 'Ama Darkoa',         phone: '0281432109', amount: 960000,  minutesAgo: 150 },
  { name: 'Kwasi Ofori',        phone: '0541321098', amount: 14700,   minutesAgo: 153 },
  { name: 'Efua Asante',        phone: '0291210987', amount: 580000,  minutesAgo: 156 },
  { name: 'Nii Laryea',         phone: '0561109876', amount: 3900,    minutesAgo: 159 },
  { name: 'Akosua Owusu',       phone: '0244098765', amount: 215000,  minutesAgo: 162 },
  { name: 'Kwame Darko',        phone: '0554987654', amount: 74000,   minutesAgo: 165 },
  { name: 'Adwoa Asare',        phone: '0201876543', amount: 840000,  minutesAgo: 168 },
  { name: 'Yaw Koomson',        phone: '0271765432', amount: 9100,    minutesAgo: 171 },
  { name: 'Ama Boateng',        phone: '0501654321', amount: 405000,  minutesAgo: 174 },
  { name: 'Kojo Tetteh',        phone: '0261543210', amount: 55000,   minutesAgo: 177 },
  { name: 'Abena Nyarko',       phone: '0571432109', amount: 730000,  minutesAgo: 180 },
  { name: 'Fiifi Quansah',      phone: '0231321098', amount: 2100,    minutesAgo: 183 },
  { name: 'Esi Amponsah',       phone: '0281210987', amount: 195000,  minutesAgo: 186 },
];

// ---------------------------------------------------------------------------
// Hardcoded Ads
// ---------------------------------------------------------------------------
const ADS: Ad[] = [
  {
    image: 'https://www.shutterstock.com/image-vector/win-congratulations-casino-big-banner-260nw-2711057875.jpg',
    title: 'Bet & Win Big Today',
    subtitle: 'Top odds on all Premier League fixtures this weekend.',
  },
  {
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRPzLqJq2KxlpIkWDM-u37z0VMvxC7BiveEAA&s',
    title: 'Mobile Money Instant Pay',
    subtitle: 'Withdraw your winnings directly to MoMo in seconds.',
  },
  {
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQzSfGLjPKDm2i6lZbmVg5u3zEM_K9DQ_IoDw&s',
    title: 'Champions League Special',
    subtitle: 'Boosted odds every matchday. Don\'t miss out.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/* formatCedi() removed — it hardcoded '₵' for every visitor regardless of
   their registered country. Winner amounts now render through useCountry()'s
   formatter inside WinnersTicker. */

/** First 3 digits only then **** */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(0, 3) + '****';
}

// ---------------------------------------------------------------------------
// Vertical auto-scroll Winners Ticker
// ---------------------------------------------------------------------------
function WinnersTicker() {
  // Winner amounts are shown in the player's registered currency.
  const { fmt } = useCountry();
  const items = [...WINNERS, ...WINNERS];

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        height: '420px',
        border: '1px solid var(--border-light)',
        backgroundColor: 'var(--card-alt)',
      }}
    >
      {/* Top fade */}
      <div
        className="absolute top-0 inset-x-0 h-8 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, var(--card-alt) 0%, transparent 100%)' }}
      />
      {/* Bottom fade */}
      <div
        className="absolute bottom-0 inset-x-0 h-8 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to top, var(--card-alt) 0%, transparent 100%)' }}
      />

      <div className="sidebar-winners-track py-2">
        {items.map((winner, idx) => (
          <div
            key={idx}
            className="px-3 py-2 mx-1 rounded-lg transition-colors"
            style={{ cursor: 'default' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--card-bg)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
          >
            <div className="flex items-center gap-2">
              {/* Trophy */}
              <div
                className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(234,179,8,0.12)' }}
              >
                <EmojiEventsIcon style={{ fontSize: 13, color: '#ca8a04' }} />
              </div>

              {/* Name · masked phone — same line */}
              <p
                className="text-xs font-semibold leading-tight truncate flex-1"
                style={{ color: 'var(--text-main)' }}
              >
                {winner.name}
                <span
                  className="font-normal ml-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  · {maskPhone(winner.phone)}
                </span>
              </p>
            </div>

            {/* Amount + time — next line, indented under name */}
            <div className="flex items-center justify-between mt-0.5 pl-9">
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: '#059669' }}
              >
                +{fmt(winner.amount, 0)}
              </span>
              <span
                className="text-[10px]"
                style={{ color: 'var(--text-muted)' }}
              >
                {winner.minutesAgo}m ago
              </span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .sidebar-winners-track {
          display: flex;
          flex-direction: column;
          gap: 0;
          animation: sidebar-scroll 110s linear infinite;
          will-change: transform;
        }
        .sidebar-winners-track:hover {
          animation-play-state: paused;
        }
        @keyframes sidebar-scroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ads Panel
// ---------------------------------------------------------------------------
function AdsPanel() {
  return (
    <div className="flex flex-col gap-3 mt-5">
      <p
        className="text-[10px] font-semibold uppercase tracking-widest text-center"
        style={{ color: 'var(--text-muted)' }}
      >
        Sponsored
      </p>
      {ADS.map((ad, idx) => (
        <div
          key={idx}
          className="rounded-xl overflow-hidden shadow-sm"
          style={{ border: '1px solid var(--border-light)' }}
        >
          {/* Ad image */}
          <div className="relative w-full" style={{ height: '100px' }}>
            <img
              src={ad.image}
              alt={ad.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          </div>

          {/* Ad text */}
          <div className="px-3 py-2.5" style={{ backgroundColor: 'var(--card-bg)' }}>
            <p className="text-xs font-bold leading-snug" style={{ color: 'var(--text-main)' }}>
              {ad.title}
            </p>
            <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
              {ad.subtitle}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Sidebar Component
// ---------------------------------------------------------------------------
export default function Sidebar() {
  return (
    <aside
      className="hidden lg:block w-60 shrink-0 overflow-y-auto h-[calc(100vh-4rem)] sticky top-16"
      style={{
        borderRight: '1px solid var(--border-light)',
        backgroundColor: 'var(--card-bg)',
      }}
    >
      <div className="p-4">

        {/* ── Recent Winners header ── */}
        <div className="flex items-center gap-2 mb-3">
          <EmojiEventsIcon style={{ fontSize: 16, color: '#ca8a04' }} />
          <h3
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-main)' }}
          >
            Recent Winners
          </h3>
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#22c55e' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            Live
          </span>
        </div>

        {/* ── Ticker ── */}
        <WinnersTicker />

        {/* ── Ads ── */}
        <AdsPanel />

      </div>
    </aside>
  );
}