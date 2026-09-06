import type { Match, Promo, CasinoGame, AffiliateStats, Winner, League, Transaction, Bet } from '../types';

export const leagues: League[] = [
  { name: 'Premier League', flag: '\u{1F1EC}\u{1F1E7}', country: 'England' },
  { name: 'La Liga', flag: '\u{1F1EA}\u{1F1F8}', country: 'Spain' },
  { name: 'Serie A', flag: '\u{1F1EE}\u{1F1F9}', country: 'Italy' },
  { name: 'Bundesliga', flag: '\u{1F1E9}\u{1F1EA}', country: 'Germany' },
  { name: 'Ligue 1', flag: '\u{1F1EB}\u{1F1F7}', country: 'France' },
  { name: 'Champions League', flag: '\u{1F1EA}\u{1F1FA}', country: 'Europe' },
  { name: 'Ghana Premier', flag: '\u{1F1EC}\u{1F1ED}', country: 'Ghana' },
  { name: 'MLS', flag: '\u{1F1FA}\u{1F1F8}', country: 'USA' },
  { name: 'Eredivisie', flag: '\u{1F1F3}\u{1F1F1}', country: 'Netherlands' },
  { name: 'Europa League', flag: '\u{1F1EA}\u{1F1FA}', country: 'Europe' },
  { name: 'AFCON', flag: '\u{1F1E6}\u{1F1FC}', country: 'Africa' },
];

const createMarkets = (home: number, draw: number, away: number) => [
  { name: '1X2', options: [{ label: '1', odd: home }, { label: 'X', odd: draw }, { label: '2', odd: away }] },
  { name: 'Both Teams to Score', options: [{ label: 'Yes', odd: 1.75 }, { label: 'No', odd: 2.05 }] },
  { name: 'Over/Under 2.5', options: [{ label: 'Over', odd: 1.85 }, { label: 'Under', odd: 1.95 }] },
  { name: 'Double Chance', options: [{ label: '1X', odd: 1.35 }, { label: '12', odd: 1.45 }, { label: 'X2', odd: 1.55 }] },
  { name: 'Correct Score', options: [{ label: '1-0', odd: 6.5 }, { label: '2-0', odd: 7.0 }, { label: '2-1', odd: 8.5 }, { label: '1-1', odd: 5.5 }, { label: '0-1', odd: 7.5 }, { label: '0-2', odd: 9.0 }] },
  { name: 'First Goal Scorer', options: [{ label: 'Haaland', odd: 3.5 }, { label: 'Salah', odd: 4.0 }, { label: 'Saka', odd: 4.5 }, { label: 'No Goal', odd: 12.0 }] },
  { name: 'Half Time Result', options: [{ label: 'Home', odd: 2.1 }, { label: 'Draw', odd: 2.3 }, { label: 'Away', odd: 3.2 }] },
];

export const matches: Match[] = [
  {
    id: '1', league: 'Premier League', leagueFlag: '\u{1F1EC}\u{1F1E7}',
    homeTeam: 'Arsenal', awayTeam: 'Chelsea', homeScore: null, awayScore: null,
    time: '15:00', date: '2026-05-10', venue: 'Emirates Stadium', referee: 'M. Oliver',
    status: 'upcoming', odds: { home: 1.85, draw: 3.40, away: 4.20 },
    markets: createMarkets(1.85, 3.40, 4.20),
    stats: { possession: [58, 42], shots: [14, 8], shotsOnTarget: [6, 3], corners: [7, 4], fouls: [9, 12], yellowCards: [1, 2], redCards: [0, 0] },
    h2h: [
      { date: '2025-11-05', homeTeam: 'Chelsea', awayTeam: 'Arsenal', homeScore: 1, awayScore: 2, league: 'Premier League' },
      { date: '2025-03-15', homeTeam: 'Arsenal', awayTeam: 'Chelsea', homeScore: 3, awayScore: 1, league: 'Premier League' },
      { date: '2024-10-22', homeTeam: 'Chelsea', awayTeam: 'Arsenal', homeScore: 0, awayScore: 1, league: 'Carabao Cup' },
      { date: '2024-04-10', homeTeam: 'Arsenal', awayTeam: 'Chelsea', homeScore: 2, awayScore: 2, league: 'Premier League' },
      { date: '2023-11-08', homeTeam: 'Chelsea', awayTeam: 'Arsenal', homeScore: 1, awayScore: 3, league: 'Premier League' },
    ],
    lineups: {
      home: ['Raya', 'White', 'Saliba', 'Gabriel', 'Zinchenko', 'Rice', 'Odegaard', 'Saka', 'Havertz', 'Martinelli', 'Nketiah'],
      away: ['Sanchez', 'James', 'Thiago Silva', 'Colwill', 'Chilwell', 'Caicedo', 'Enzo', 'Palmer', 'Sterling', 'Jackson', 'Mudryk'],
    },
  },
  {
    id: '2', league: 'Premier League', leagueFlag: '\u{1F1EC}\u{1F1E7}',
    homeTeam: 'Man City', awayTeam: 'Liverpool', homeScore: null, awayScore: null,
    time: '17:30', date: '2026-05-10', venue: 'Etihad Stadium', referee: 'A. Taylor',
    status: 'upcoming', odds: { home: 2.10, draw: 3.30, away: 3.50 },
    markets: createMarkets(2.10, 3.30, 3.50),
    stats: { possession: [55, 45], shots: [12, 10], shotsOnTarget: [5, 4], corners: [6, 5], fouls: [8, 10], yellowCards: [1, 1], redCards: [0, 0] },
    h2h: [
      { date: '2025-12-01', homeTeam: 'Liverpool', awayTeam: 'Man City', homeScore: 2, awayScore: 1, league: 'Premier League' },
      { date: '2025-04-20', homeTeam: 'Man City', awayTeam: 'Liverpool', homeScore: 1, awayScore: 1, league: 'Premier League' },
    ],
    lineups: {
      home: ['Ederson', 'Walker', 'Dias', 'Stones', 'Gvardiol', 'Rodri', 'De Bruyne', 'Bernardo', 'Foden', 'Grealish', 'Haaland'],
      away: ['Alisson', 'Alexander-Arnold', 'Van Dijk', 'Konate', 'Robertson', 'Mac Allister', 'Szoboszlai', 'Salah', 'Diaz', 'Nunez', 'Gakpo'],
    },
  },
  {
    id: '3', league: 'La Liga', leagueFlag: '\u{1F1EA}\u{1F1F8}',
    homeTeam: 'Real Madrid', awayTeam: 'Barcelona', homeScore: null, awayScore: null,
    time: '20:00', date: '2026-05-11', venue: 'Santiago Bernabeu', referee: 'A. Mateu',
    status: 'upcoming', odds: { home: 2.25, draw: 3.20, away: 3.10 },
    markets: createMarkets(2.25, 3.20, 3.10),
    stats: { possession: [50, 50], shots: [13, 11], shotsOnTarget: [5, 5], corners: [5, 6], fouls: [11, 9], yellowCards: [2, 1], redCards: [0, 0] },
    h2h: [
      { date: '2026-01-15', homeTeam: 'Barcelona', awayTeam: 'Real Madrid', homeScore: 2, awayScore: 1, league: 'La Liga' },
    ],
    lineups: {
      home: ['Courtois', 'Carvajal', 'Rudiger', 'Alaba', 'Mendy', 'Tchouameni', 'Bellingham', 'Valverde', 'Vinicius', 'Rodrygo', 'Mbappe'],
      away: ['Ter Stegen', 'Kounde', 'Araujo', 'Cubarsi', 'Balde', 'Pedri', 'Gavi', 'Yamal', 'Raphinha', 'Lewandowski', 'Fati'],
    },
  },
  {
    id: '4', league: 'Serie A', leagueFlag: '\u{1F1EE}\u{1F1F9}',
    homeTeam: 'AC Milan', awayTeam: 'Inter Milan', homeScore: null, awayScore: null,
    time: '19:45', date: '2026-05-12', venue: 'San Siro', referee: 'D. Orsato',
    status: 'upcoming', odds: { home: 2.80, draw: 3.10, away: 2.50 },
    markets: createMarkets(2.80, 3.10, 2.50),
    stats: { possession: [48, 52], shots: [10, 13], shotsOnTarget: [4, 5], corners: [4, 6], fouls: [12, 8], yellowCards: [2, 1], redCards: [0, 0] },
    h2h: [],
    lineups: {
      home: ['Maignan', 'Calabria', 'Tomori', 'Thiaw', 'Theo', 'Reijnders', 'Loftus-Cheek', 'Bennacer', 'Leao', 'Giroud', 'Pulisic'],
      away: ['Sommer', 'Dumfries', 'Bastoni', 'Pavard', 'Dimarco', 'Barella', 'Calhanoglu', 'Mkhitaryan', 'Lautaro', 'Thuram', 'Buchanan'],
    },
  },
  {
    id: '5', league: 'Bundesliga', leagueFlag: '\u{1F1E9}\u{1F1EA}',
    homeTeam: 'Bayern Munich', awayTeam: 'Dortmund', homeScore: null, awayScore: null,
    time: '17:30', date: '2026-05-13', venue: 'Allianz Arena', referee: 'D. Siebert',
    status: 'upcoming', odds: { home: 1.55, draw: 4.00, away: 5.50 },
    markets: createMarkets(1.55, 4.00, 5.50),
    stats: { possession: [60, 40], shots: [16, 7], shotsOnTarget: [7, 2], corners: [8, 3], fouls: [7, 13], yellowCards: [0, 3], redCards: [0, 0] },
    h2h: [],
    lineups: {
      home: ['Neuer', 'Kimmich', 'Upamecano', 'Kim', 'Davies', 'Goretzka', 'Musiala', 'Sane', 'Gnabry', 'Kane', 'Muller'],
      away: ['Kobel', 'Ryerson', 'Hummels', 'Schlotterbeck', 'Maehlen', 'Can', 'Sabitzer', 'Brandt', 'Adeyemi', 'Fullkrug', 'Sancho'],
    },
  },
  {
    id: '6', league: 'Ghana Premier', leagueFlag: '\u{1F1EC}\u{1F1ED}',
    homeTeam: 'Hearts of Oak', awayTeam: 'Asante Kotoko', homeScore: null, awayScore: null,
    time: '15:00', date: '2026-05-14', venue: 'Accra Sports Stadium', referee: 'R. Badiu',
    status: 'upcoming', odds: { home: 2.30, draw: 3.10, away: 3.00 },
    markets: createMarkets(2.30, 3.10, 3.00),
    stats: { possession: [52, 48], shots: [9, 8], shotsOnTarget: [3, 3], corners: [5, 4], fouls: [10, 11], yellowCards: [1, 2], redCards: [0, 0] },
    h2h: [],
    lineups: {
      home: ['Mensah', 'Osei', 'Amankwah', 'Boateng', 'Tetteh', 'Asante', 'Owusu', 'Adjei', 'Mensah', 'Agyeman', 'Frimpong'],
      away: ['Ofori', 'Appiah', 'Mensah', 'Osei', 'Bonsu', 'Agyapong', 'Twumasi', 'Yeboah', 'Opoku', 'Ampofo', 'Asante'],
    },
  },
  {
    id: '7', league: 'Champions League', leagueFlag: '\u{1F1EA}\u{1F1FA}',
    homeTeam: 'PSG', awayTeam: 'Bayern Munich', homeScore: 2, awayScore: 1,
    time: '20:00', date: '2026-05-06', venue: 'Parc des Princes', referee: 'C. Turpin',
    status: 'live', minute: 67, odds: { home: 1.90, draw: 3.50, away: 3.80 },
    markets: createMarkets(1.90, 3.50, 3.80),
    stats: { possession: [54, 46], shots: [11, 9], shotsOnTarget: [5, 3], corners: [5, 4], fouls: [8, 10], yellowCards: [1, 2], redCards: [0, 0] },
    h2h: [],
    lineups: {
      home: ['Donnarumma', 'Hakimi', 'Marquinhos', 'Skriniar', 'Mendes', 'Verratti', 'Vitinha', 'Dembele', 'Barcola', 'Kolo Muani', 'Asensio'],
      away: ['Neuer', 'Kimmich', 'Upamecano', 'Kim', 'Davies', 'Goretzka', 'Musiala', 'Sane', 'Gnabry', 'Kane', 'Muller'],
    },
  },
  {
    id: '8', league: 'Premier League', leagueFlag: '\u{1F1EC}\u{1F1E7}',
    homeTeam: 'Tottenham', awayTeam: 'Man United', homeScore: 1, awayScore: 0,
    time: '19:00', date: '2026-05-06', venue: 'Tottenham Stadium', referee: 'P. Tierney',
    status: 'live', minute: 34, odds: { home: 1.70, draw: 3.80, away: 4.50 },
    markets: createMarkets(1.70, 3.80, 4.50),
    stats: { possession: [46, 54], shots: [6, 8], shotsOnTarget: [3, 2], corners: [3, 4], fouls: [6, 7], yellowCards: [1, 0], redCards: [0, 0] },
    h2h: [],
    lineups: {
      home: ['Vicario', 'Porro', 'Romero', 'Van de Ven', 'Udogie', 'Bissouma', 'Maddison', 'Kulusevski', 'Son', 'Richarlison', 'Werner'],
      away: ['Onana', 'Dalot', 'Varane', 'Martinez', 'Shaw', 'Mainoo', 'Casemiro', 'Fernandes', 'Rashford', 'Hojlund', 'Garnacho'],
    },
  },
  {
    id: '9', league: 'La Liga', leagueFlag: '\u{1F1EA}\u{1F1F8}',
    homeTeam: 'Atletico Madrid', awayTeam: 'Sevilla', homeScore: 0, awayScore: 0,
    time: '21:00', date: '2026-05-06', venue: 'Metropolitano', referee: 'J. Sanchez',
    status: 'live', minute: 12, odds: { home: 1.45, draw: 4.20, away: 6.50 },
    markets: createMarkets(1.45, 4.20, 6.50),
    stats: { possession: [62, 38], shots: [4, 1], shotsOnTarget: [1, 0], corners: [2, 0], fouls: [3, 5], yellowCards: [0, 1], redCards: [0, 0] },
    h2h: [],
    lineups: {
      home: ['Oblak', 'Savic', 'Gimenez', 'Hermoso', 'Llorente', 'Koke', 'De Paul', 'Llorente', 'Griezmann', 'Correa', 'Morata'],
      away: ['Nyland', 'Navas', 'Ramos', 'Kike Salas', 'Acuna', 'Rakitic', 'Fernando', 'Ocampos', 'En-Nesyri', 'Lukebakio', 'Susso'],
    },
  },
  {
    id: '10', league: 'Ligue 1', leagueFlag: '\u{1F1EB}\u{1F1F7}',
    homeTeam: 'Marseille', awayTeam: 'Lyon', homeScore: null, awayScore: null,
    time: '20:00', date: '2026-05-15', venue: 'Stade Velodrome', referee: 'B. Bastien',
    status: 'upcoming', odds: { home: 1.95, draw: 3.40, away: 3.80 },
    markets: createMarkets(1.95, 3.40, 3.80),
    stats: { possession: [53, 47], shots: [11, 9], shotsOnTarget: [4, 3], corners: [6, 4], fouls: [9, 10], yellowCards: [1, 2], redCards: [0, 0] },
    h2h: [],
    lineups: {
      home: ['Lopez', 'Clauss', 'Balerdi', 'Mbemba', 'Luan', 'Guendouzi', 'Rabiot', 'Under', 'Sarr', 'Aubameyang', 'Bakayoko'],
      away: ['Lopes', 'Malo Gusto', 'Lukeba', 'Tagliafico', 'Caqueret', 'Tolisso', 'Cherki', 'Lacazette', 'Dembele', 'Barcola', 'Benrahma'],
    },
  },
];

export const promos: Promo[] = [
  { id: '1', title: '100% First Deposit Bonus', description: 'Get up to GH\u20B51,000 on your first deposit. Minimum deposit GH\u20B550.', type: 'welcome_bonus', value: 1000, eligibility: 'new', startDate: '2026-01-01', endDate: '2026-12-31', active: true },
  { id: '2', title: 'Multi-Bet Boost +30%', description: 'Get 30% extra winnings on multi-bets with 4+ selections.', type: 'free_bet', value: 30, eligibility: 'all', startDate: '2026-03-01', endDate: '2026-06-30', active: true },
  { id: '3', title: 'Refer & Earn GH\u20B5200', description: 'Invite a friend and earn GH\u20B5200 when they make their first deposit.', type: 'referral', value: 200, eligibility: 'all', startDate: '2026-02-01', endDate: '2026-08-31', active: true },
  { id: '4', title: 'Friday Reload 50%', description: 'Every Friday, get a 50% reload bonus up to GH\u20B5500.', type: 'reload_bonus', value: 500, eligibility: 'all', startDate: '2026-04-01', endDate: '2026-07-31', active: true },
  { id: '5', title: 'Cashback 10% on Losses', description: 'Get 10% cashback on net losses every Monday.', type: 'cashback', value: 10, eligibility: 'vip', startDate: '2026-05-01', endDate: '2026-05-31', active: true },
  { id: '6', title: 'Summer Special Bonus', description: 'Coming soon - exclusive summer promotions.', type: 'welcome_bonus', value: 750, eligibility: 'all', startDate: '2026-06-01', endDate: '2026-08-31', active: false },
];

export const casinoGames: CasinoGame[] = [
  { id: '1', name: 'Mega Fortune', provider: 'NetEnt', category: 'slots', jackpot: true, gradient: 'from-amber-500 to-orange-600' },
  { id: '2', name: 'Aviator', provider: 'Spribe', category: 'crash', hot: true, gradient: 'from-red-500 to-rose-600' },
  { id: '3', name: 'Lightning Roulette', provider: 'Evolution', category: 'live', gradient: 'from-yellow-400 to-amber-500' },
  { id: '4', name: 'Blackjack VIP', provider: 'Pragmatic', category: 'table', gradient: 'from-green-600 to-emerald-700' },
  { id: '5', name: 'Book of Dead', provider: 'Play\'n GO', category: 'slots', hot: true, gradient: 'from-blue-500 to-indigo-600' },
  { id: '6', name: 'JetX', provider: 'SmartSoft', category: 'crash', gradient: 'from-cyan-500 to-teal-600' },
  { id: '7', name: 'Baccarat Squeeze', provider: 'Evolution', category: 'live', gradient: 'from-purple-500 to-fuchsia-600' },
  { id: '8', name: 'Starburst', provider: 'NetEnt', category: 'slots', gradient: 'from-pink-500 to-rose-600' },
  { id: '9', name: 'Poker Hold\'em', provider: 'Evolution', category: 'table', gradient: 'from-slate-600 to-gray-700' },
  { id: '10', name: 'Spaceman', provider: 'Pragmatic', category: 'crash', gradient: 'from-violet-500 to-purple-600' },
  { id: '11', name: 'Gonzo\'s Quest', provider: 'NetEnt', category: 'slots', gradient: 'from-lime-500 to-green-600' },
  { id: '12', name: 'Virtual Football', provider: 'BetGames', category: 'virtual', gradient: 'from-emerald-500 to-green-600' },
  { id: '13', name: 'Crazy Time', provider: 'Evolution', category: 'live', hot: true, gradient: 'from-orange-400 to-red-500' },
  { id: '14', name: 'Sweet Bonanza', provider: 'Pragmatic', category: 'slots', gradient: 'from-rose-400 to-pink-500' },
  { id: '15', name: 'Virtual Horses', provider: 'BetGames', category: 'virtual', gradient: 'from-amber-600 to-yellow-700' },
  { id: '16', name: 'Dragon Tiger', provider: 'Pragmatic', category: 'table', gradient: 'from-red-600 to-red-800' },
];

export const affiliateStats: AffiliateStats = {
  totalReferrals: 47,
  activePlayers: 23,
  totalEarned: 4650,
  thisMonthEarnings: 820,
  referredPlayers: [
    { id: 'USR***8A3', joinDate: '2026-04-15', active: true },
    { id: 'USR***2F1', joinDate: '2026-04-10', active: true },
    { id: 'USR***7C9', joinDate: '2026-03-28', active: false },
    { id: 'USR***4D2', joinDate: '2026-03-15', active: true },
    { id: 'USR***1E5', joinDate: '2026-02-20', active: true },
  ],
  commissionTiers: [
    { min: 0, max: 10, rate: 15 },
    { min: 11, max: 25, rate: 20 },
    { min: 26, max: 50, rate: 25 },
    { min: 51, max: 999, rate: 30 },
  ],
  withdrawalHistory: [
    { date: '2026-04-28', amount: 500, status: 'completed' },
    { date: '2026-03-15', amount: 750, status: 'completed' },
    { date: '2026-02-01', amount: 300, status: 'completed' },
  ],
};

export const recentWinners: Winner[] = [
  { userId: 'USR***A7F', amount: 2450, date: '2026-05-05' },
  { userId: 'USR***3B2', amount: 1800, date: '2026-05-05' },
  { userId: 'USR***9D4', amount: 3200, date: '2026-05-04' },
  { userId: 'USR***1C8', amount: 950, date: '2026-05-04' },
  { userId: 'USR***6E5', amount: 4100, date: '2026-05-03' },
  { userId: 'USR***2F9', amount: 1200, date: '2026-05-03' },
];

export const mockTransactions: Transaction[] = [
  { id: 't1', type: 'deposit', amount: 200, description: 'Mobile Money Deposit', date: '2026-05-05', status: 'completed' },
  { id: 't2', type: 'bet_loss', amount: 50, description: 'Arsenal vs Chelsea', date: '2026-05-04', status: 'completed' },
  { id: 't3', type: 'bet_win', amount: 380, description: 'Multi-bet (4 selections)', date: '2026-05-03', status: 'completed' },
  { id: 't4', type: 'withdrawal', amount: 100, description: 'Withdrawal to MTN', date: '2026-05-02', status: 'completed' },
  { id: 't5', type: 'deposit', amount: 500, description: 'Bank Transfer', date: '2026-04-30', status: 'completed' },
  { id: 't6', type: 'affiliate', amount: 150, description: 'Affiliate Commission', date: '2026-04-28', status: 'completed' },
];

export const mockBets: Bet[] = [
  {
    id: 'b1', stake: 50, totalOdds: 7.6, potentialReturn: 380, status: 'won', placedAt: '2026-05-03T14:00:00Z', resultAt: '2026-05-03T16:30:00Z',
    selections: [
      { matchId: '1', matchName: 'Arsenal vs Chelsea', market: '1X2', selection: 'Home Win', odd: 1.85 },
      { matchId: '3', matchName: 'Real Madrid vs Barcelona', market: 'Both Teams to Score', selection: 'Yes', odd: 1.75 },
      { matchId: '5', matchName: 'Bayern vs Dortmund', market: '1X2', selection: 'Home Win', odd: 1.55 },
      { matchId: '7', matchName: 'PSG vs Bayern', market: 'Over/Under 2.5', selection: 'Over', odd: 1.85 },
    ],
  },
  {
    id: 'b2', stake: 100, totalOdds: 3.4, potentialReturn: 340, status: 'lost', placedAt: '2026-05-01T18:00:00Z', resultAt: '2026-05-01T20:00:00Z',
    selections: [
      { matchId: '2', matchName: 'Man City vs Liverpool', market: '1X2', selection: 'Home Win', odd: 2.10 },
      { matchId: '4', matchName: 'AC Milan vs Inter', market: '1X2', selection: 'Away Win', odd: 2.50 },
    ],
  },
  {
    id: 'b3', stake: 30, totalOdds: 5.55, potentialReturn: 166.5, status: 'pending', placedAt: '2026-05-06T10:00:00Z',
    selections: [
      { matchId: '7', matchName: 'PSG vs Bayern', market: '1X2', selection: 'Home Win', odd: 1.90 },
      { matchId: '8', matchName: 'Tottenham vs Man United', market: '1X2', selection: 'Home Win', odd: 1.70 },
      { matchId: '9', matchName: 'Atletico vs Sevilla', market: '1X2', selection: 'Home Win', odd: 1.45 },
    ],
  },
  {
    id: 'b4', stake: 75, totalOdds: 2.30, potentialReturn: 172.5, status: 'pending', placedAt: '2026-05-06T12:00:00Z',
    selections: [
      { matchId: '1', matchName: 'Arsenal vs Chelsea', market: '1X2', selection: 'Home Win', odd: 1.85 },
      { matchId: '10', matchName: 'Marseille vs Lyon', market: 'Both Teams to Score', selection: 'Yes', odd: 1.75 },
    ],
  },
];
