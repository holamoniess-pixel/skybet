export interface User {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  role: 'user' | 'admin';
  kycStatus: 'unverified' | 'pending' | 'verified';
  referralCode: string;
}

export interface Match {
  id: string;
  league: string;
  leagueFlag: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  time: string;
  date: string;
  venue: string;
  referee: string;
  status: 'upcoming' | 'live' | 'finished';
  minute?: number;
  odds: {
    home: number;
    draw: number;
    away: number;
  };
  markets: Market[];
  stats?: MatchStats;
  h2h?: H2HMatch[];
  lineups?: Lineups;
}

export interface Market {
  name: string;
  options: { label: string; odd: number }[];
}

export interface MatchStats {
  possession: [number, number];
  shots: [number, number];
  shotsOnTarget: [number, number];
  corners: [number, number];
  fouls: [number, number];
  yellowCards: [number, number];
  redCards: [number, number];
}

export interface H2HMatch {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  league: string;
}

export interface Lineups {
  home: string[];
  away: string[];
}

export interface BetSlipSelection {
  matchId: string;
  matchName: string;
  market: string;
  selection: string;
  odd: number;
}

export interface Bet {
  id: string;
  selections: BetSlipSelection[];
  stake: number;
  totalOdds: number;
  potentialReturn: number;
  status: 'pending' | 'won' | 'lost';
  placedAt: string;
  resultAt?: string;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'bet_win' | 'bet_loss' | 'affiliate';
  amount: number;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface Promo {
  id: string;
  title: string;
  description: string;
  type: 'welcome_bonus' | 'reload_bonus' | 'free_bet' | 'cashback' | 'referral';
  value: number;
  eligibility: 'all' | 'new' | 'vip';
  startDate: string;
  endDate: string;
  active: boolean;
  claimed?: boolean;
}

export interface CasinoGame {
  id: string;
  name: string;
  provider: string;
  category: 'slots' | 'table' | 'live' | 'crash' | 'virtual';
  hot?: boolean;
  jackpot?: boolean;
  gradient: string;
}

export interface AffiliateStats {
  totalReferrals: number;
  activePlayers: number;
  totalEarned: number;
  thisMonthEarnings: number;
  referredPlayers: { id: string; joinDate: string; active: boolean }[];
  commissionTiers: { min: number; max: number; rate: number }[];
  withdrawalHistory: { date: string; amount: number; status: string }[];
}

export interface Winner {
  userId: string;
  amount: number;
  date: string;
}

export interface League {
  name: string;
  flag: string;
  country: string;
}
