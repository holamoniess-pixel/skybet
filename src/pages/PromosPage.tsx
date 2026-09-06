import { useState, useMemo } from 'react';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

import GroupIcon from '@mui/icons-material/Group';
import StarIcon from '@mui/icons-material/Star';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import FilterListIcon from '@mui/icons-material/FilterList';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type PromoType =
  | 'welcome_bonus'
  | 'free_bet'
  | 'cashback'
  | 'reload_bonus'
  | 'accumulator'
  | 'odds_boost'
  | 'vip'
  | 'referral'
  | 'first_deposit'
  | 'naira_boost'
  | 'derby_special'
  | 'weekend_banker'
  | 'payday_bonus'
  | 'super_eagles'
  | 'afcon_special'
  | 'champions_bet'
  | 'midweek_magic'
  | 'combo_king'
  | 'loyalty_reward'
  | 'early_payout'
  | 'bet_insurance'
  | 'goalscorer'
  | 'mobile_bonus'
  | 'fast_withdrawal';

export interface Promo {
  id: string;
  type: PromoType;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  active: boolean;
  eligibility: 'new' | 'vip' | 'all';
  hot?: boolean;
}

// ---------------------------------------------------------------------------
// Promo data (unchanged logic, same IDs)
// ---------------------------------------------------------------------------
export const promos: Promo[] = [
  {
    id: 'p001', type: 'welcome_bonus', hot: true,
    title: '200% Welcome Bonus — Up to ₦50,000',
    description: 'New to the game? We go give you triple your first deposit — up to ₦50,000 free! Deposit as low as ₦500 and start winning today.',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'new',
  },
  {
    id: 'p002', type: 'first_deposit',
    title: 'First Deposit Wahala — ₦10,000 Free Bet',
    description: 'Make your first deposit of ₦1,000 or more and collect a ₦10,000 free bet. No wahala, straight to your wallet!',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'new',
  },
  {
    id: 'p003', type: 'free_bet',
    title: 'NNPC Derby Free Bet — ₦5,000 on Us',
    description: 'Bet on any Nigerian league derby match this weekend and if your team no win, we return your stake as a free bet — up to ₦5,000.',
    startDate: '2025-05-01', endDate: '2025-05-31', active: true, eligibility: 'all',
  },
  {
    id: 'p004', type: 'free_bet',
    title: 'Monday Morning ₦2,000 Free Bet',
    description: 'Every Monday we dash you ₦2,000 free bet to start the week well. Log in before 10am to grab yours!',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'all',
  },
  {
    id: 'p005', type: 'naira_boost', hot: true,
    title: 'Naira Boost — 50% Extra on All Winnings',
    description: 'Win big in Naira! All winnings this week get an extra 50% boost straight to your account. No minimum odds, no wahala.',
    startDate: '2025-05-06', endDate: '2025-05-12', active: true, eligibility: 'all',
  },
  {
    id: 'p006', type: 'payday_bonus',
    title: 'End of Month Payday Bonus — 30% Reload',
    description: "Salary don land? Celebrate payday with a 30% bonus on any deposit from the 25th to end of month. Life is good!",
    startDate: '2025-05-25', endDate: '2025-05-31', active: false, eligibility: 'all',
  },
  {
    id: 'p007', type: 'super_eagles',
    title: 'Super Eagles Special — Bet & Win Big!',
    description: 'Naija to the world! Place any bet on Nigeria national team matches and get boosted odds of 3x. Go Super Eagles!',
    startDate: '2025-06-01', endDate: '2025-06-30', active: false, eligibility: 'all',
  },
  {
    id: 'p008', type: 'afcon_special',
    title: 'AFCON Special — West Africa Wins Together',
    description: "Support your team — Nigeria, Ghana, Senegal, Côte d'Ivoire and more. Any AFCON bet comes with 25% cashback if your team loses in the final.",
    startDate: '2025-01-01', endDate: '2025-02-28', active: false, eligibility: 'all',
  },
  {
    id: 'p009', type: 'derby_special', hot: true,
    title: 'Lagos Derby Jackpot — ₦1,000,000 Pool',
    description: 'Pick the correct scoreline for the Lagos derby and share a ₦1,000,000 pool. Entry is just ₦200. E go be!',
    startDate: '2025-05-10', endDate: '2025-05-17', active: true, eligibility: 'all',
  },
  {
    id: 'p010', type: 'weekend_banker',
    title: 'Weekend Banker — Double Your Profits',
    description: 'Choose your weekend banker and if it wins, we double your winnings! Available every Friday 6pm to Sunday 11pm.',
    startDate: '2025-05-09', endDate: '2025-05-11', active: true, eligibility: 'all',
  },
  {
    id: 'p011', type: 'cashback',
    title: '20% Cashback — No Cry on Loss Day',
    description: 'Lost today? No wahala. We give you 20% cashback on net losses every Sunday, up to ₦20,000. Tomorrow is another day!',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'all',
  },
  {
    id: 'p012', type: 'bet_insurance',
    title: 'Bet Insurance — Last Leg Saver',
    description: 'Your accumulator falls because of one leg? We return your stake up to ₦15,000. Activate before your bet!',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'all',
  },
  {
    id: 'p013', type: 'reload_bonus',
    title: 'Midweek Reload — 25% Bonus Every Wednesday',
    description: 'Every Wednesday, deposit ₦1,000+ and collect 25% bonus — up to ₦25,000. Keep the momentum going all week!',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'all',
  },
  {
    id: 'p014', type: 'accumulator',
    title: 'Acca Booster — Up to 200% Extra Winnings',
    description: 'The more teams you pick, the bigger your bonus! 5 legs = 30%, 8 legs = 70%, 10+ legs = 200% extra. This is where the real money dey!',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'all',
  },
  {
    id: 'p015', type: 'combo_king',
    title: 'Combo King — ₦500,000 for 10 Correct Picks',
    description: 'Pick 10 matches correctly and chop ₦500,000. Entry fee is just ₦100. Everyday people dey win — today fit be your turn!',
    startDate: '2025-05-01', endDate: '2025-05-31', active: true, eligibility: 'all',
  },
  {
    id: 'p016', type: 'odds_boost',
    title: 'Friday Odds Boost — 3x on Selected Matches',
    description: 'Every Friday, we pick 5 matches and triple the odds! Check the boost section from 9am. First come, first served.',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'all',
  },
  {
    id: 'p017', type: 'champions_bet',
    title: 'Champions League Final Boost — Boosted Odds',
    description: 'Place your bet on the Champions League final with boosted odds. Win and we add 50% to your payout. Real Madrid vs anyone — your choice!',
    startDate: '2025-05-30', endDate: '2025-05-31', active: false, eligibility: 'all',
  },
  {
    id: 'p018', type: 'midweek_magic',
    title: 'Midweek Magic — ₦3,000 Free Bet Tuesdays',
    description: 'Tuesdays are not boring again! Get ₦3,000 free bet every Tuesday for Premier League and Champions League games. Oya come bet!',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'all',
  },
  {
    id: 'p019', type: 'vip',
    title: 'VIP Club — Your Money Dey Work For You',
    description: 'Join our exclusive VIP club and enjoy weekly cashback up to ₦100,000, personal account manager, and faster withdrawals. True big boy energy!',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'vip',
  },
  {
    id: 'p020', type: 'loyalty_reward',
    title: 'Loyalty Points — Bet & Earn Rewards',
    description: 'Every bet earns you loyalty points. Redeem for free bets, merchandise, and airtime! The more you bet, the more you collect.',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'all',
  },
  {
    id: 'p021', type: 'referral',
    title: 'Refer Your Paddy — ₦5,000 Per Friend',
    description: 'Tell your friends and family about us! When they sign up and deposit, you both get ₦5,000 free bet. No limit on how many people you refer!',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'all',
  },
  {
    id: 'p022', type: 'mobile_bonus',
    title: 'App Download Bonus — ₦1,500 Just for Installing',
    description: 'Download our app, register, and collect ₦1,500 free bet instantly. Bet from anywhere — bus, market, wherever you dey!',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'new',
  },
  {
    id: 'p023', type: 'fast_withdrawal',
    title: 'Instant Payout Guarantee — Money in 5 Minutes',
    description: 'Win today, collect today. We guarantee withdrawal to your Nigerian bank account or mobile wallet in under 5 minutes. Your money is your money!',
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'vip',
  },
  {
    id: 'p024', type: 'goalscorer', hot: true,
    title: 'First Goalscorer Jackpot — ₦200,000',
    description: "Predict the first goalscorer in today's featured match and win ₦200,000! Entry is free for all registered users. One lucky winner!",
    startDate: '2025-05-10', endDate: '2025-05-10', active: true, eligibility: 'all',
  },
  {
    id: 'p025', type: 'early_payout',
    title: 'Early Payout — Win When Your Team Goes 2-0',
    description: "Bet on any team and if they go 2 goals up, we pay your winnings immediately — even if the final result changes. Real-time excitement!",
    startDate: '2025-01-01', endDate: '2025-12-31', active: true, eligibility: 'all',
  },
];

// ---------------------------------------------------------------------------
// Visual config — reliable Pexels images, Casino-style accents
// ---------------------------------------------------------------------------
const PROMO_VISUALS: Record<string, { imageUrls: string[]; accent: string; gradient: string }> = {
  welcome_bonus: {
    imageUrls: [
      'https://images.pexels.com/photos/3943716/pexels-photo-3943716.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1602726/pexels-photo-1602726.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/796606/pexels-photo-796606.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#a855f7',
    gradient: 'linear-gradient(135deg,#0d0020 0%,#2a0060 60%,#0d0020 100%)',
  },
  first_deposit: {
    imageUrls: [
      'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1602726/pexels-photo-1602726.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#22c55e',
    gradient: 'linear-gradient(135deg,#041204 0%,#0d3012 60%,#041204 100%)',
  },
  free_bet: {
    imageUrls: [
      'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#10b981',
    gradient: 'linear-gradient(135deg,#041a0a 0%,#0a3a18 60%,#041a0a 100%)',
  },
  cashback: {
    imageUrls: [
      'https://images.pexels.com/photos/730547/pexels-photo-730547.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#f97316',
    gradient: 'linear-gradient(135deg,#1a0808 0%,#3d1208 60%,#1a0808 100%)',
  },
  reload_bonus: {
    imageUrls: [
      'https://images.pexels.com/photos/3943716/pexels-photo-3943716.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/796606/pexels-photo-796606.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1153655/pexels-photo-1153655.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#6366f1',
    gradient: 'linear-gradient(135deg,#080820 0%,#1a1a60 60%,#080820 100%)',
  },
  accumulator: {
    imageUrls: [
      'https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#f43f5e',
    gradient: 'linear-gradient(135deg,#200010 0%,#500028 60%,#200010 100%)',
  },
  odds_boost: {
    imageUrls: [
      'https://images.pexels.com/photos/358319/pexels-photo-358319.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/62623/wing-plane-flying-airplane-62623.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/47044/aircraft-landing-reach-injection-47044.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#1d4ed8',
    gradient: 'linear-gradient(135deg,#00101a 0%,#003050 60%,#00101a 100%)',
  },
  vip: {
    imageUrls: [
      'https://images.pexels.com/photos/1153655/pexels-photo-1153655.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/207383/pexels-photo-207383.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1616012/pexels-photo-1616012.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#eab308',
    gradient: 'linear-gradient(135deg,#1a1400 0%,#3d2e00 60%,#1a1400 100%)',
  },
  referral: {
    imageUrls: [
      'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#64748b',
    gradient: 'linear-gradient(135deg,#0a0c10 0%,#1a2030 60%,#0a0c10 100%)',
  },
  naira_boost: {
    imageUrls: [
      'https://images.pexels.com/photos/730547/pexels-photo-730547.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1602726/pexels-photo-1602726.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#00ff88',
    gradient: 'linear-gradient(135deg,#041a0a 0%,#0a3a18 60%,#041a0a 100%)',
  },
  derby_special: {
    imageUrls: [
      'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#ef4444',
    gradient: 'linear-gradient(135deg,#1a0404 0%,#3d0a0a 60%,#1a0404 100%)',
  },
  weekend_banker: {
    imageUrls: [
      'https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#8b5cf6',
    gradient: 'linear-gradient(135deg,#0d0020 0%,#2a0060 60%,#0d0020 100%)',
  },
  payday_bonus: {
    imageUrls: [
      'https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/730547/pexels-photo-730547.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#14b8a6',
    gradient: 'linear-gradient(135deg,#001a18 0%,#003d38 60%,#001a18 100%)',
  },
  super_eagles: {
    imageUrls: [
      'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#16a34a',
    gradient: 'linear-gradient(135deg,#041204 0%,#0d3012 60%,#041204 100%)',
  },
  afcon_special: {
    imageUrls: [
      'https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#f59e0b',
    gradient: 'linear-gradient(135deg,#1a1000 0%,#3d2800 60%,#1a1000 100%)',
  },
  champions_bet: {
    imageUrls: [
      'https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#3b82f6',
    gradient: 'linear-gradient(135deg,#000c20 0%,#001850 60%,#000c20 100%)',
  },
  midweek_magic: {
    imageUrls: [
      'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#d946ef',
    gradient: 'linear-gradient(135deg,#1a001a 0%,#400040 60%,#1a001a 100%)',
  },
  combo_king: {
    imageUrls: [
      'https://images.pexels.com/photos/1153655/pexels-photo-1153655.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/207383/pexels-photo-207383.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1616012/pexels-photo-1616012.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#f97316',
    gradient: 'linear-gradient(135deg,#1a0808 0%,#3d1208 60%,#1a0808 100%)',
  },
  loyalty_reward: {
    imageUrls: [
      'https://images.pexels.com/photos/730547/pexels-photo-730547.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#f59e0b',
    gradient: 'linear-gradient(135deg,#1a1000 0%,#3d2800 60%,#1a1000 100%)',
  },
  early_payout: {
    imageUrls: [
      'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#3b82f6',
    gradient: 'linear-gradient(135deg,#00101a 0%,#003050 60%,#00101a 100%)',
  },
  bet_insurance: {
    imageUrls: [
      'https://images.pexels.com/photos/3943716/pexels-photo-3943716.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/796606/pexels-photo-796606.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1153655/pexels-photo-1153655.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#6366f1',
    gradient: 'linear-gradient(135deg,#080820 0%,#1a1a60 60%,#080820 100%)',
  },
  goalscorer: {
    imageUrls: [
      'https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#f43f5e',
    gradient: 'linear-gradient(135deg,#200010 0%,#500028 60%,#200010 100%)',
  },
  mobile_bonus: {
    imageUrls: [
      'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/1092644/pexels-photo-1092644.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#818cf8',
    gradient: 'linear-gradient(135deg,#080820 0%,#1a1a60 60%,#080820 100%)',
  },
  fast_withdrawal: {
    imageUrls: [
      'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg?auto=compress&cs=tinysrgb&w=640',
      'https://images.pexels.com/photos/730547/pexels-photo-730547.jpeg?auto=compress&cs=tinysrgb&w=640',
    ],
    accent: '#34d399',
    gradient: 'linear-gradient(135deg,#041a0a 0%,#0a3a18 60%,#041a0a 100%)',
  },
};

const FALLBACK_VISUAL = {
  imageUrls: [
    'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=640',
  ],
  accent: '#64748b',
  gradient: 'linear-gradient(135deg,#0a0c10 0%,#1a2030 60%,#0a0c10 100%)',
};

function getVisual(type: string) {
  return PROMO_VISUALS[type] ?? FALLBACK_VISUAL;
}

// ---------------------------------------------------------------------------
// PromoImage — tries each URL in order, falls back to gradient
// ---------------------------------------------------------------------------
function PromoImage({ promo, className = '' }: { promo: Promo; className?: string }) {
  const visual = getVisual(promo.type);
  const [urlIndex, setUrlIndex] = useState(0);
  const allFailed = urlIndex >= visual.imageUrls.length;

  if (allFailed) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${className}`}
        style={{ background: visual.gradient }}
      >
        <LocalOfferIcon sx={{ fontSize: 48, color: visual.accent, opacity: 0.7 }} />
      </div>
    );
  }

  return (
    <img
      src={visual.imageUrls[urlIndex]}
      alt={promo.title}
      className={`w-full h-full object-cover ${className}`}
      onError={() => setUrlIndex(i => i + 1)}
      loading="lazy"
    />
  );
}

// ---------------------------------------------------------------------------
// Daily seeded shuffle
// ---------------------------------------------------------------------------
function getDailyPromos(allPromos: Promo[], count = 4): Promo[] {
  const active = allPromos.filter(p => p.active);
  if (active.length <= count) return active;
  const seed = Math.floor(Date.now() / 86_400_000);
  function rand(s: number) {
    let x = s ^ (s >>> 16);
    x = Math.imul(x, 0x45d9f3b);
    x ^= x >>> 16;
    return (x >>> 0) / 0xffffffff;
  }
  const arr = [...active];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(seed + i) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

// ---------------------------------------------------------------------------
// Filter tabs — Casino-page style pill buttons
// ---------------------------------------------------------------------------
const FILTER_TABS = [
  { key: 'daily',    label: "Today's Picks" },
  { key: 'active',   label: 'All Active' },
  { key: 'upcoming', label: 'Coming Soon' },
  { key: 'expired',  label: 'Expired' },
];

// ---------------------------------------------------------------------------
// Eligibility badge — Casino pill style
// ---------------------------------------------------------------------------
function EligibilityBadge({ eligibility }: { eligibility: string }) {
  if (eligibility === 'new')
    return (
      <span
        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', color: '#fff' }}
      >
        <GroupIcon sx={{ fontSize: 10 }} /> New Users
      </span>
    );
  if (eligibility === 'vip')
    return (
      <span
        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', color: '#eab308' }}
      >
        <StarIcon sx={{ fontSize: 10 }} /> VIP
      </span>
    );
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', color: '#fff' }}
    >
      <GroupIcon sx={{ fontSize: 10 }} /> All Users
    </span>
  );
}

// ---------------------------------------------------------------------------
// Promo Card — Casino card pattern
// ---------------------------------------------------------------------------
function PromoCard({
  promo,
  claimed,
  onClick,
}: {
  promo: Promo;
  claimed: boolean;
  onClick: (promo: Promo) => void;
}) {
  const visual = getVisual(promo.type);

  return (
    <button
      onClick={() => onClick(promo)}
      className="overflow-hidden text-left group relative rounded-2xl transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
      style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-light)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.22)')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)')}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ height: '180px' }}>
        <PromoImage
          promo={promo}
          className="transition-transform duration-300 group-hover:scale-105"
        />
        {/* Bottom scrim */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.05) 55%, transparent 100%)',
          }}
        />

        {/* Top-left badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          <span
            className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', color: '#fff' }}
          >
            {promo.type.replace(/_/g, ' ')}
          </span>
          {!promo.active && (
            <span
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', color: '#fbbf24' }}
            >
              <AccessTimeIcon sx={{ fontSize: 10 }} />
              {new Date(promo.startDate) > new Date() ? 'Coming Soon' : 'Expired'}
            </span>
          )}
        </div>

        {/* Top-right */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5">
          {promo.hot && (
            <span className="flex items-center gap-0.5 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md">
              <LocalFireDepartmentIcon sx={{ fontSize: 11 }} />
              HOT
            </span>
          )}
          <EligibilityBadge eligibility={promo.eligibility} />
        </div>

        {/* Claimed overlay */}
        {claimed && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.52)' }}
          >
            <div className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <CheckCircleIcon sx={{ fontSize: 14 }} />
              Claimed!
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: visual.accent + '22',
              border: `1px solid ${visual.accent}44`,
            }}
          >
            <LocalOfferIcon sx={{ fontSize: 18, color: visual.accent }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>
              {promo.title}
            </h3>
            <p className="text-[11px] truncate flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <CalendarTodayIcon sx={{ fontSize: 10 }} />
              Expires {promo.endDate}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--primary)' }}>
            {claimed ? 'Done' : promo.eligibility === 'new' ? 'Learn' : 'Claim'}
          </span>
          <ArrowForwardIcon sx={{ fontSize: 14 }} style={{ color: 'var(--primary)' }} />
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Modal — Casino modal pattern
// ---------------------------------------------------------------------------
function PromoModal({
  promo,
  claimed,
  onClaim,
  onClose,
}: {
  promo: Promo;
  claimed: boolean;
  onClaim: (id: string) => void;
  onClose: () => void;
}) {
  const visual = getVisual(promo.type);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.76)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="m-0 sm:m-4 max-w-lg w-full rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border-light)',
        }}
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        {/* Modal top bar */}
        <div
          className="flex justify-between items-center px-4 pt-4 pb-3"
          style={{ borderBottom: '1px solid var(--border-light)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: visual.accent + '22',
                border: `1.5px solid ${visual.accent}55`,
              }}
            >
              <LocalOfferIcon sx={{ fontSize: 20, color: visual.accent }} />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight" style={{ color: 'var(--text-main)' }}>
                {promo.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {promo.eligibility === 'new' ? 'New Users Only' : promo.eligibility === 'vip' ? 'VIP Members' : 'All Users'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--card-alt)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Modal image */}
        <div className="relative overflow-hidden" style={{ height: '200px' }}>
          <PromoImage promo={promo} />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)',
            }}
          />
          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            <span
              className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', color: '#fff' }}
            >
              {promo.type.replace(/_/g, ' ')}
            </span>
          </div>
          {promo.hot && (
            <span className="absolute top-3 right-3 flex items-center gap-1 bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
              <LocalFireDepartmentIcon sx={{ fontSize: 14 }} />
              HOT
            </span>
          )}
          {/* Title over image */}
          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="font-bold text-lg text-white leading-snug drop-shadow-lg line-clamp-2">
              {promo.title}
            </h2>
          </div>
        </div>

        {/* Stats row */}
        <div
          className="grid grid-cols-3"
          style={{
            borderTop: '1px solid var(--border-light)',
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          {[
            { label: 'Eligibility', value: promo.eligibility === 'new' ? 'New Users' : promo.eligibility === 'vip' ? 'VIP Only' : 'All Users' },
            { label: 'Starts', value: promo.startDate },
            { label: 'Expires', value: promo.endDate },
          ].map(({ label, value }, i, arr) => (
            <div
              key={label}
              className="py-3 text-center"
              style={{ borderRight: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none' }}
            >
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {label}
              </p>
              <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-main)' }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Description */}
        <div className="px-4 py-3.5">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {promo.description}
          </p>
          <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
            T&Cs apply. Please gamble responsibly.{' '}
            <a href="#" style={{ color: 'var(--primary)' }} className="underline">Full terms →</a>
          </p>
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97]"
            style={{
              backgroundColor: 'var(--card-alt)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-main)',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.filter = 'brightness(0.95)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.filter = '')}
          >
            Close
          </button>

          {claimed ? (
            <button
              disabled
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-default"
              style={{ backgroundColor: '#10b981', color: '#fff', opacity: 0.9 }}
            >
              <CheckCircleIcon sx={{ fontSize: 16 }} />
              Claimed!
            </button>
          ) : (
            <button
              onClick={() => { onClaim(promo.id); onClose(); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
              style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.filter = '')}
            >
              {promo.eligibility === 'new' ? '→ Learn More' : '🎉 Claim Bonus'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function PromosPage() {
  const [activeFilter, setActiveFilter] = useState<string>('daily');
  const [claimed, setClaimed]           = useState<Set<string>>(new Set());
  const [selected, setSelected]         = useState<Promo | null>(null);

  const dailyPromos = useMemo(() => getDailyPromos(promos, 4), []);

  const filtered = useMemo(() => {
    if (activeFilter === 'daily')    return dailyPromos;
    if (activeFilter === 'active')   return promos.filter(p => p.active);
    if (activeFilter === 'upcoming') return promos.filter(p => !p.active && new Date(p.startDate) > new Date());
    return promos.filter(p => !p.active && new Date(p.endDate) < new Date());
  }, [activeFilter, dailyPromos]);

  const handleClaim = (id: string) => setClaimed(prev => new Set(prev).add(id));

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: 'var(--card-alt)' }}>
      <div className="max-w-6xl mx-auto p-4">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #eab308, #f97316)' }}
            >
              <LocalOfferIcon style={{ color: '#fff' }} fontSize="medium" />
            </div>
            <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text-main)' }}>
              Promotions
            </h1>
          </div>

          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0"
            style={{
              backgroundColor: 'color-mix(in srgb, #eab308 12%, var(--card-alt))',
              border: '1px solid color-mix(in srgb, #eab308 30%, var(--border-light))',
            }}
          >
            <EmojiEventsIcon sx={{ fontSize: 16, color: '#eab308' }} />
            <span className="text-xs font-bold hidden xs:inline" style={{ color: '#eab308' }}>
              PSL Season 10
            </span>
          </div>
        </div>

        {/* ── Category pills ── */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-hide">
          <FilterListIcon
            sx={{ fontSize: 18 }}
            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
          />
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className="px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
                style={{
                  backgroundColor: active ? 'var(--primary)' : 'var(--card-bg)',
                  color: active ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${active ? 'var(--primary)' : 'var(--border-light)'}`,
                  transform: active ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Grid ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <LocalOfferIcon sx={{ fontSize: 48 }} style={{ opacity: 0.3 }} />
            <p className="mt-3">No promotions in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((promo) => (
              <PromoCard
                key={promo.id}
                promo={promo}
                claimed={claimed.has(promo.id)}
                onClick={setSelected}
              />
            ))}
          </div>
        )}

        {/* ── Modal ── */}
        {selected && (
          <PromoModal
            promo={selected}
            claimed={claimed.has(selected.id)}
            onClaim={handleClaim}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}