/*
  # Futball Betting Platform - Initial Schema

  1. New Tables
    - `profiles` - User profiles extending auth.users
      - `id` (uuid, primary key, references auth.users)
      - `full_name` (text)
      - `phone` (text, unique)
      - `email` (text, unique)
      - `role` (text, default 'user')
      - `kyc_status` (text, default 'unverified')
      - `referral_code` (text, unique)
      - `referred_by` (uuid, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `wallets` - User wallets (main and affiliate)
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `type` (text - 'main' or 'affiliate')
      - `balance` (numeric, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `transactions` - Financial transactions
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `wallet_id` (uuid, references wallets)
      - `type` (text - deposit/withdrawal/bet_win/bet_loss/affiliate)
      - `amount` (numeric)
      - `description` (text)
      - `status` (text, default 'completed')
      - `created_at` (timestamptz)

    - `matches` - Sports matches
      - `id` (uuid, primary key)
      - `league` (text)
      - `league_flag` (text)
      - `home_team` (text)
      - `away_team` (text)
      - `home_score` (integer, nullable)
      - `away_score` (integer, nullable)
      - `match_time` (text)
      - `match_date` (date)
      - `venue` (text)
      - `referee` (text)
      - `status` (text, default 'upcoming')
      - `minute` (integer, nullable)
      - `home_odds` (numeric)
      - `draw_odds` (numeric)
      - `away_odds` (numeric)
      - `created_at` (timestamptz)

    - `markets` - Betting markets for matches
      - `id` (uuid, primary key)
      - `match_id` (uuid, references matches)
      - `name` (text)
      - `created_at` (timestamptz)

    - `market_options` - Options within a market
      - `id` (uuid, primary key)
      - `market_id` (uuid, references markets)
      - `label` (text)
      - `odd` (numeric)
      - `created_at` (timestamptz)

    - `bets` - Placed bets
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `stake` (numeric)
      - `total_odds` (numeric)
      - `potential_return` (numeric)
      - `status` (text, default 'pending')
      - `created_at` (timestamptz)
      - `settled_at` (timestamptz, nullable)

    - `bet_selections` - Individual selections within a bet
      - `id` (uuid, primary key)
      - `bet_id` (uuid, references bets)
      - `match_id` (uuid, references matches)
      - `market` (text)
      - `selection` (text)
      - `odd` (numeric)
      - `created_at` (timestamptz)

    - `promos` - Promotional offers
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `type` (text)
      - `value` (numeric)
      - `eligibility` (text)
      - `start_date` (date)
      - `end_date` (date)
      - `active` (boolean, default true)
      - `created_at` (timestamptz)

    - `claimed_promos` - Track claimed promos
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `promo_id` (uuid, references promos)
      - `claimed_at` (timestamptz)

    - `casino_games` - Casino game catalog
      - `id` (uuid, primary key)
      - `name` (text)
      - `provider` (text)
      - `category` (text)
      - `hot` (boolean, default false)
      - `jackpot` (boolean, default false)
      - `gradient` (text)
      - `created_at` (timestamptz)

    - `affiliate_referrals` - Referral tracking
      - `id` (uuid, primary key)
      - `referrer_id` (uuid, references profiles)
      - `referred_id` (uuid, references profiles)
      - `active` (boolean, default true)
      - `created_at` (timestamptz)

    - `withdrawal_requests` - Withdrawal requests
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `wallet_id` (uuid, references wallets)
      - `amount` (numeric)
      - `status` (text, default 'pending')
      - `reason` (text, nullable)
      - `created_at` (timestamptz)
      - `processed_at` (timestamptz, nullable)

  2. Security
    - Enable RLS on all tables
    - Users can read/update own profile
    - Users can read own wallets and transactions
    - Users can read matches, markets, promos, casino_games
    - Users can manage own bets
    - Admin role has broader access via service role
*/

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text UNIQUE NOT NULL DEFAULT '',
  email text UNIQUE NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  kyc_status text NOT NULL DEFAULT 'unverified' CHECK (kyc_status IN ('unverified', 'pending', 'verified')),
  referral_code text UNIQUE NOT NULL DEFAULT '',
  referred_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Wallets
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('main', 'affiliate')),
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, type)
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wallets"
  ON wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallets"
  ON wallets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallets"
  ON wallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'bet_win', 'bet_loss', 'affiliate')),
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league text NOT NULL DEFAULT '',
  league_flag text NOT NULL DEFAULT '',
  home_team text NOT NULL DEFAULT '',
  away_team text NOT NULL DEFAULT '',
  home_score integer,
  away_score integer,
  match_time text NOT NULL DEFAULT '',
  match_date date NOT NULL DEFAULT CURRENT_DATE,
  venue text NOT NULL DEFAULT '',
  referee text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'finished')),
  minute integer,
  home_odds numeric NOT NULL DEFAULT 1.00,
  draw_odds numeric NOT NULL DEFAULT 1.00,
  away_odds numeric NOT NULL DEFAULT 1.00,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read matches"
  ON matches FOR SELECT
  TO authenticated
  USING (true);

-- Markets
CREATE TABLE IF NOT EXISTS markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read markets"
  ON markets FOR SELECT
  TO authenticated
  USING (true);

-- Market Options
CREATE TABLE IF NOT EXISTS market_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  odd numeric NOT NULL DEFAULT 1.00,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE market_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read market options"
  ON market_options FOR SELECT
  TO authenticated
  USING (true);

-- Bets
CREATE TABLE IF NOT EXISTS bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stake numeric NOT NULL DEFAULT 0,
  total_odds numeric NOT NULL DEFAULT 1.00,
  potential_return numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost')),
  created_at timestamptz DEFAULT now(),
  settled_at timestamptz
);

ALTER TABLE bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bets"
  ON bets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bets"
  ON bets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bets"
  ON bets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bet Selections
CREATE TABLE IF NOT EXISTS bet_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id uuid NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES matches(id),
  market text NOT NULL DEFAULT '',
  selection text NOT NULL DEFAULT '',
  odd numeric NOT NULL DEFAULT 1.00,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bet_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bet selections"
  ON bet_selections FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM bets WHERE bets.id = bet_selections.bet_id AND bets.user_id = auth.uid()));

CREATE POLICY "Users can insert own bet selections"
  ON bet_selections FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM bets WHERE bets.id = bet_selections.bet_id AND bets.user_id = auth.uid()));

-- Promos
CREATE TABLE IF NOT EXISTS promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'welcome_bonus' CHECK (type IN ('welcome_bonus', 'reload_bonus', 'free_bet', 'cashback', 'referral')),
  value numeric NOT NULL DEFAULT 0,
  eligibility text NOT NULL DEFAULT 'all' CHECK (eligibility IN ('all', 'new', 'vip')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT CURRENT_DATE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active promos"
  ON promos FOR SELECT
  TO authenticated
  USING (true);

-- Claimed Promos
CREATE TABLE IF NOT EXISTS claimed_promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  promo_id uuid NOT NULL REFERENCES promos(id) ON DELETE CASCADE,
  claimed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, promo_id)
);

ALTER TABLE claimed_promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own claimed promos"
  ON claimed_promos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own claimed promos"
  ON claimed_promos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Casino Games
CREATE TABLE IF NOT EXISTS casino_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  provider text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'slots' CHECK (category IN ('slots', 'table', 'live', 'crash', 'virtual')),
  hot boolean NOT NULL DEFAULT false,
  jackpot boolean NOT NULL DEFAULT false,
  gradient text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE casino_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read casino games"
  ON casino_games FOR SELECT
  TO authenticated
  USING (true);

-- Affiliate Referrals
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referrals as referrer"
  ON affiliate_referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can insert own referrals"
  ON affiliate_referrals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = referrer_id);

-- Withdrawal Requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own withdrawal requests"
  ON withdrawal_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own withdrawal requests"
  ON withdrawal_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league);
CREATE INDEX IF NOT EXISTS idx_markets_match_id ON markets(match_id);
CREATE INDEX IF NOT EXISTS idx_market_options_market_id ON market_options(market_id);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
CREATE INDEX IF NOT EXISTS idx_bet_selections_bet_id ON bet_selections(bet_id);
CREATE INDEX IF NOT EXISTS idx_promos_active ON promos(active);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referrer ON affiliate_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
