// =============================================================================
// api.ts — futball api
// Base URL: https://futballbackend.onrender.com
// =============================================================================

import { getToken as getSessionToken } from "./session";

const BASE_URL = "https://futballbackend-production-b1a0.up.railway.app";
// ---------------------------------------------------------------------------
// Types & Schemas
// ---------------------------------------------------------------------------

export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";
export type UserStatus = "ACTIVE" | "DISABLED" | "LOCKED";
export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SETTLED" | "FAILED";
export type BetStatus = "PENDING" | "WON" | "LOST" | "VOID" | "CASHED_OUT";
export type PayoutStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "PAID";
export type AffiliateWithdrawalStatus = "PENDING" | "PROCESSED" | "REJECTED";
export type AdminUpgradeChatStatus = "PENDING_COMMISSION" | "COMMISSION_SET" | "CLOSED";
export type SenderRole = "USER" | "SUPER_ADMIN" | "SYSTEM";
export type TransactionKind =
  | "DEPOSIT"
  | "WITHDRAW"
  | "WITHDRAW_HOLD"
  | "WITHDRAW_RELEASE"
  | "BET_STAKE"
  | "BET_WIN"
  | "REFERRAL_COMMISSION"
  | "PAYOUT"
  | "ADJUSTMENT"
  | "VIP_CASHBACK"
  | "VIP_MEMBERSHIP"
  | "WELCOME_BONUS"
  | "WITHDRAWAL_REFUND"
  | "ADMIN_UPGRADE_FEE";
export type MatchSource =
  | "SPORTDB"
  | "SPORTSRC"
  | "BSD"
  | "FOOTBALL_DATA"
  | "API_FOOTBALL"
  | "VIRTUAL"
  | "ADMIN_CREATED"
  | "LIVESCORE"
  | "ESPN";
export type SportEnum =
  | "FOOTBALL"
  | "BASKETBALL"
  | "BASEBALL"
  | "AMERICAN_FOOTBALL"
  | "MMA"
  | "TENNIS";
export type BinanceDepositStatus = "PENDING" | "APPROVED" | "REJECTED";

export type FootballLeague =
  | "PREMIER_LEAGUE" | "LA_LIGA" | "BUNDESLIGA" | "SERIE_A" | "LIGUE_1"
  | "CHAMPIONS_LEAGUE_GROUP" | "CHAMPIONSHIP" | "EREDIVISIE" | "PRIMEIRA_LIGA"
  | "SCOTTISH_PREM" | "BELGIAN_PRO" | "TURKISH_SUPER" | "RUSSIAN_PREMIER"
  | "GREEK_SUPER" | "UKRAINIAN_PREMIER" | "AUSTRIAN_BUNDESLIGA" | "SWISS_SUPER"
  | "DANISH_SUPER" | "NORWEGIAN_ELITE" | "SWEDISH_ALLSVENSKAN" | "CZECH_FIRST"
  | "POLISH_EKSTRA" | "ROMANIAN_LIGA1" | "CROATIAN_HNL" | "SERBIAN_SUPER"
  | "ISRAELI_PREMIER" | "HUNGARIAN_LIGA" | "SLOVAK_SUPER" | "SLOVENIAN_PRVA"
  | "BELARUSIAN_PREMIER" | "KAZAKH_PREMIER" | "FINNISH_VEIKKAUS"
  | "SOUTH_AFRICAN_PREMIER" | "MOROCCAN_BOTOLA" | "EGYPTIAN_PREMIER"
  | "NIGERIAN_PREMIER" | "GHANAIAN_PREMIER" | "SAUDI_PRO" | "UAE_PRO"
  | "INDIAN_SUPER" | "J1_LEAGUE" | "K_LEAGUE_1" | "CHINESE_SUPER"
  | "THAI_LEAGUE_1" | "MALAYSIAN_SUPER" | "INDONESIAN_LIGA1" | "IRANIAN_PGPL"
  | "A_LEAGUE" | "MLS" | "LIGA_MX" | "BRAZILIAN_SERIE_A" | "ARGENTINE_PRIMERA"
  | "COLOMBIAN_PRIMERA" | "CHILEAN_PRIMERA" | "PERUVIAN_LIGA1"
  | "ECUADORIAN_SERIE_A" | "URUGUAYAN_PRIMERA" | "VENEZUELAN_PRIMERA"
  | "BOLIVIAN_DFP" | "PARAGUAYAN_DP";

export type FootballCup =
  | "FA_CUP" | "EFL_CUP" | "COPA_DEL_REY" | "DFB_POKAL" | "COPPA_ITALIA"
  | "COUPE_DE_FRANCE" | "CHAMPIONS_LEAGUE" | "EUROPA_LEAGUE"
  | "CONFERENCE_LEAGUE" | "NATIONS_LEAGUE" | "EUROS" | "COPA_LIBERTADORES"
  | "COPA_AMERICA" | "CONCACAF_CHAMPIONS" | "AFC_CHAMPIONS" | "CAF_CHAMPIONS"
  | "AFCON" | "WORLD_CUP" | "WOMENS_WORLD_CUP" | "CLUB_WORLD_CUP";

export interface GrantedAuthority {
  authority: string;
}

export interface User {
  id: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  role: UserRole;
  status: UserStatus;
  createdByAdminId?: string;
  referredViaLinkId?: string;
  themePreference?: string;
  winSeen?: boolean;
  totpSecret?: string;
  totpEnabled?: boolean;
  totpBackupCodes?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  verificationToken?: string;
  resetToken?: string;
  resetTokenExpiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
  authorities?: GrantedAuthority[];
  enabled?: boolean;
  password?: string;
  username?: string;
  accountNonLocked?: boolean;
  credentialsNonExpired?: boolean;
  accountNonExpired?: boolean;
}

export interface UserDto {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  role: string;
  themePreference?: string;
}

export interface UserSummaryDto {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  role: string;
  emailVerified?: boolean;
  createdAt?: string;
}

export interface WalletSummaryDto {
  walletId: string;
  balance: number;
  currency?: string;
  totalTransactions?: number;
  totalDeposited?: number;
  totalWithdrawn?: number;
}

export interface UserDetailDto {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  role: string;
  emailVerified?: boolean;
  createdAt?: string;
  wallet?: WalletSummaryDto;
}

export interface ReferralSummaryDto {
  linkId?: string;
  code?: string;
  commissionPercent?: number;
  totalReferrals?: number;
  totalEarnings?: number;
}

export interface AdminDetailDto {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  emailVerified?: boolean;
  createdAt?: string;
  wallet?: WalletSummaryDto;
  referral?: ReferralSummaryDto;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  user: UserDto;
  mustSetup2fa?: boolean;
}

export interface Transaction {
  id: string;
  walletId: string;
  kind: TransactionKind;
  amount: number;
  balanceAfter: number;
  providerRef?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface TransactionDto {
  id: string;
  walletId: string;
  userId: string;
  userEmail?: string;
  kind: TransactionKind;
  amount: number;
  balanceAfter: number;
  providerRef?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  user: User;
  amount: number;
  currency?: string;
  status: WithdrawalStatus;
  method: string;
  accountNumber: string;
  accountName: string;
  network?: string;
  admin?: User;
  adminNote?: string;
  superAdmin?: User;
  superAdminNote?: string;
  reviewedAt?: string;
  settledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateWithdrawalRequest {
  id: string;
  userId: string;
  amount: number;
  currency?: string;
  status: AffiliateWithdrawalStatus;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  mobileMoneyNumber?: string;
  reference?: string;
  rejectReason?: string;
  requestedAt: string;
  processedAt?: string;
  updatedAt: string;
}

export interface PayoutRequest {
  id: string;
  adminId: string;
  amount: number;
  status: PayoutStatus;
  periodEnd?: string;
  rejectReason?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUpgradeChatMessageDto {
  id: string;
  chatId: string;
  senderId: string;
  senderRole: SenderRole;
  senderName?: string;
  content: string;
  sentAt: string;
}

export interface AdminUpgradeChatDto {
  id: string;
  userId: string;
  userEmail?: string;
  userFirstName?: string;
  status: AdminUpgradeChatStatus;
  commissionRate?: number;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface GameRound {
  id: string;
  userId: string;
  game: string;
  stake: number;
  result?: Record<string, unknown>;
  payout?: number;
  playedAt: string;
}

export interface GameCrashSchedule {
  id: string;
  gameSlug: string;
  roundNumber: number;
  crashAt: number;
  tier?: string;
  highCrash?: boolean;
  extremeCrash?: boolean;
  generatedBy?: string;
  generatedAt: string;
  playedAt?: string;
  adminNotified?: boolean;
  overrideReason?: string;
}

export interface Match {
  id: string;
  source: MatchSource;
  externalId?: string;
  minutePlayed?: number;
  sport?: string;
  sportEnum?: SportEnum;
  league?: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt?: string;
  status?: string;
  scoreHome?: number;
  scoreAway?: number;
  homeLogo?: string;
  awayLogo?: string;
  createdByAdminId?: string;
  leagueLogo?: string;
  featured?: boolean;
  metadata?: Record<string, unknown>;
  settledAt?: string;
  createdAt: string;
}

export interface Odds {
  id: string;
  matchId: string;
  market: string;
  selection: string;
  value: number;
  line?: number;
  handicap?: number;
  capturedAt: string;
}

export interface BetSelection {
  id: string;
  matchId: string;
  market: string;
  selection: string;
  oddsLocked: number;
  result?: string;
  homeTeam?: string;
  awayTeam?: string;
}

export interface Bet {
  id: string;
  userId: string;
  stake: number;
  currency?: string;
  totalOdds: number;
  potentialReturn: number;
  status: BetStatus;
  winSeen?: boolean;
  placedAt: string;
  settledAt?: string;
  bookingCodeUsedId?: string;
  selections: BetSelection[];
}

export interface BookingCode {
  id: string;
  code: string;
  creatorAdminId?: string;
  label?: string;
  kind?: string;
  bookingType?: string;
  version?: number;
  currency?: string;
  stake?: number;
  selections?: Record<string, unknown>[];
  totalOdds?: number;
  potentialPayout?: number;
  status?: string;
  redemptionCount?: number;
  maxRedemptions?: number;
  expiresAt?: string;
  createdAt: string;
}

export interface RedeemResponse {
  booking: BookingCode;
  enrichedSelections?: Record<string, unknown>[];
  currentTotalOdds?: number;
}

export interface ReferralLink {
  id: string;
  adminId: string;
  code: string;
  label?: string;
  commissionPercent?: number;
  active?: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface AiPrediction {
  id: string;
  matchId: string;
  model?: string;
  generatedAt: string;
  prediction?: Record<string, unknown>;
  sharedAt?: string;
  sharedByAdminId?: string;
  publishedToUsers?: boolean;
  adminNote?: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  action: string;
  targetEntity?: string;
  targetId?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface AffiliateStatsDTO {
  totalReferrals: number;
  lifetimeStake: number;
  lifetimeCommission: number;
  availableBalance: number;
  currency?: string;
}

export interface AdminAffiliateStatsDTO {
  totalReferrals: number;
  lifetimeStake: number;
  lifetimeCommission: number;
  commissionBalance: number;
  totalEarnedLifetime: number;
  totalPaidOutLifetime: number;
  currency?: string;
  lastPayoutAt?: string;
}

export interface ReferredUserDTO {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  joinedAt: string;
  lifetimeStake?: number;
  lifetimeCommission?: number;
}

export interface RevenueOverviewDto {
  totalDepositsAllTime: number;
  totalDepositsThisMonth: number;
  totalDepositsToday: number;
  totalWithdrawalsAllTime: number;
  totalWithdrawalsThisMonth: number;
  totalDepositCount: number;
  totalWithdrawalCount: number;
  currency?: string;
}

// ── Binance / Crypto deposit ──────────────────────────────────────────────────

export interface BinanceDeposit {
  id: string;
  userId: string;
  txid: string;
  cryptoAmount: number;
  coin: string;
  network: string;
  expectedGhsAmount: number;
  creditedGhsAmount?: number;
  senderAddress?: string;
  screenshotUrl?: string;
  userNote?: string;
  status: BinanceDepositStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  adminNote?: string;
  walletTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  country?: string;
  ref?: string;
}

export interface DemoLoginRequest {
  role?: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  themePreference?: string;
}

export interface WithdrawalRequestDto {
  amount: number;
  currency?: string;
  method: string;
  accountNumber: string;
  accountName: string;
  network?: string;
}

export interface AccountDetailsDTO {
  bankName: string;
  accountNumber: string;
  accountName: string;
  mobileMoneyNumber?: string;
}

export interface WithdrawalRequestDTO {
  amount: number;
  accountDetails: AccountDetailsDTO;
}

export interface PlaceBetRequest {
  stake: number;
  currency?: string;
  selections: SelectionDto[];
  bookingCodeUsedId?: string;
}

export interface SelectionDto {
  matchId: string;
  fixtureId?: string;
  market: string;
  selection: string;
  submittedOdds: number;
}

export interface RedeemRequest {
  code: string;
}

export interface SendMessageRequest {
  content: string;
}

export interface SetCommissionRequest {
  commissionRate: number;
}

export interface CreateLinkRequest {
  label?: string;
  expiresAt?: string;
}

export interface AdminMatchRequest {
  homeTeam: string;
  awayTeam: string;
  league?: string;
  sport?: string;
  homeLogo?: string;
  awayLogo?: string;
  leagueLogo?: string;
  kickoffAt?: string;
  status?: string;
  featured?: boolean;
}

export interface AdminStatusUpdateRequest {
  status: string;
}

export interface AdminScoreUpdateRequest {
  scoreHome: number;
  scoreAway: number;
  minutePlayed?: number;
}

export interface CreateBookingRequest {
  kind?: string;
  label?: string;
  currency?: string;
  stake?: number;
  selections?: Record<string, unknown>[];
  maxRedemptions?: number;
  expiresAt?: string;
}

// ── Binance deposit request DTOs ──────────────────────────────────────────────

export interface BinanceDepositSubmitRequest {
  txid: string;
  cryptoAmount: number;
  coin: string;
  network: string;
  expectedGhsAmount: number;
  senderAddress?: string;
  screenshotUrl?: string;
  userNote?: string;
}

// ---------------------------------------------------------------------------
// Paginated response wrappers
// ---------------------------------------------------------------------------

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// HTTP utility
// ---------------------------------------------------------------------------

/**
 * Auth header. Reads through utils/session so there is exactly ONE token key
 * ('skybet_token') shared by the React app and the arcade games. This used
 * to read localStorage['accessToken'] directly, while the games read
 * localStorage['sb_token'] — so a signed-in user was anonymous inside a game.
 */
function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
    ...extraHeaders,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error?.message ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

const http = {
  get: <T>(path: string, extraHeaders?: Record<string, string>) =>
    request<T>("GET", path, undefined, extraHeaders),
  post: <T>(path: string, body?: unknown, extraHeaders?: Record<string, string>) =>
    request<T>("POST", path, body, extraHeaders),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
};

// ---------------------------------------------------------------------------
// Helper to build query strings
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const filtered = Object.entries(params).filter(([, v]) => v !== undefined);
  if (!filtered.length) return "";
  return "?" + filtered.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}

// =============================================================================
// AUTH
// =============================================================================

export const auth = {
  /** POST /api/auth/login */
  login: (body: LoginRequest) =>
    http.post<ApiResponse<AuthResponse>>("/api/auth/login", body),

  /** POST /api/auth/register */
  register: (body: RegisterRequest) =>
    http.post<ApiResponse<AuthResponse>>("/api/auth/register", body),

  /** POST /api/auth/demo-login */
  demoLogin: (body: DemoLoginRequest) =>
    http.post<ApiResponse<AuthResponse>>("/api/auth/demo-login", body),

  /** POST /api/auth/logout */
  logout: () =>
    http.post<ApiResponse<void>>("/api/auth/logout"),

  /** POST /api/auth/refresh */
  refresh: () =>
    http.post<ApiResponse<AuthResponse>>("/api/auth/refresh"),

  /** POST /api/auth/verify-email */
  verifyEmail: (body: Record<string, string>) =>
    http.post<ApiResponse<Record<string, string>>>("/api/auth/verify-email", body),

  /** POST /api/auth/send-verification */
  sendVerification: (body: Record<string, string>) =>
    http.post<ApiResponse<Record<string, string>>>("/api/auth/send-verification", body),

  /** POST /api/auth/request-password-reset */
  requestPasswordReset: (body: Record<string, string>) =>
    http.post<ApiResponse<Record<string, string>>>("/api/auth/request-password-reset", body),

  /** POST /api/auth/reset-password */
  resetPassword: (body: Record<string, string>) =>
    http.post<ApiResponse<Record<string, string>>>("/api/auth/reset-password", body),
};

// =============================================================================
// USER
// =============================================================================

export const user = {
  /** GET /api/users/me */
  me: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/users/me"),

  /** PATCH /api/users/me */
  update: (body: UpdateProfileRequest) =>
    http.patch<ApiResponse<UserDto>>("/api/users/me", body),
};

// =============================================================================
// WALLET
// =============================================================================

export const wallet = {
  /** GET /api/wallet */
  getWallet: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/wallet"),

  /** GET /api/wallet/transactions */
  getTransactions: (page = 0, size = 20) =>
    http.get<ApiResponse<PageResponse<Transaction>>>(
      `/api/wallet/transactions${qs({ page, size })}`
    ),

  /** POST /api/wallet/withdraw */
  withdraw: (body: Record<string, unknown>) =>
    http.post<ApiResponse<Transaction>>("/api/wallet/withdraw", body),
};

// =============================================================================
// WALLET — WITHDRAWALS
// =============================================================================

export const withdrawals = {
  /** GET /api/wallet/withdrawals */
  getMyWithdrawals: (page = 0, size = 20, status?: WithdrawalStatus) =>
    http.get<ApiResponse<PageResponse<WithdrawalRequest>>>(
      `/api/wallet/withdrawals${qs({ page, size, status })}`
    ),

  /** POST /api/wallet/withdrawals */
  submit: (body: WithdrawalRequestDto) =>
    http.post<ApiResponse<WithdrawalRequest>>("/api/wallet/withdrawals", body),

  /** GET /api/wallet/withdrawals/:id */
  getById: (id: string) =>
    http.get<ApiResponse<WithdrawalRequest>>(`/api/wallet/withdrawals/${id}`),

  /** GET /api/wallet/withdrawals/admin/all */
  getAllForAdmin: (page = 0, size = 20, status?: WithdrawalStatus) =>
    http.get<ApiResponse<PageResponse<WithdrawalRequest>>>(
      `/api/wallet/withdrawals/admin/all${qs({ page, size, status })}`
    ),

  /** GET /api/wallet/withdrawals/admin/stats */
  getAdminStats: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/wallet/withdrawals/admin/stats"),

  /** GET /api/wallet/withdrawals/super-admin/stats */
  getSuperAdminStats: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/wallet/withdrawals/super-admin/stats"),

  /** POST /api/wallet/withdrawals/admin/:id/approve */
  approve: (id: string, body: Record<string, string>) =>
    http.post<ApiResponse<WithdrawalRequest>>(`/api/wallet/withdrawals/admin/${id}/approve`, body),

  /** POST /api/wallet/withdrawals/admin/:id/reject */
  reject: (id: string, body: Record<string, string>) =>
    http.post<ApiResponse<WithdrawalRequest>>(`/api/wallet/withdrawals/admin/${id}/reject`, body),

  /** POST /api/wallet/withdrawals/super-admin/:id/settle */
  settle: (id: string, body: Record<string, string>) =>
    http.post<ApiResponse<WithdrawalRequest>>(`/api/wallet/withdrawals/super-admin/${id}/settle`, body),

  /** POST /api/wallet/withdrawals/super-admin/:id/mark-failed */
  markFailed: (id: string, body: Record<string, string>) =>
    http.post<ApiResponse<WithdrawalRequest>>(`/api/wallet/withdrawals/super-admin/${id}/mark-failed`, body),
};

// =============================================================================
// DEPOSITS
// =============================================================================

export const deposits = {
  /** POST /api/wallet/deposit/stripe/intent */
  stripeIntent: (body: Record<string, unknown>) =>
    http.post<ApiResponse<Record<string, unknown>>>("/api/wallet/deposit/stripe/intent", body),

  /** POST /api/wallet/deposit/paystack/init */
  paystackInit: (body: Record<string, unknown>) =>
    http.post<ApiResponse<Record<string, unknown>>>("/api/wallet/deposit/paystack/init", body),

  // ── Binance / Crypto deposits ─────────────────────────────────────────────

  /** POST /api/wallet/binance-deposits */
  binanceSubmit: (body: BinanceDepositSubmitRequest) =>
    http.post<ApiResponse<BinanceDeposit>>("/api/wallet/binance-deposits", body),

  /** GET /api/wallet/binance-deposits */
  getBinanceDeposits: (page = 0, size = 20) =>
    http.get<ApiResponse<PageResponse<BinanceDeposit>>>(
      `/api/wallet/binance-deposits${qs({ page, size })}`
    ),

  // ── Super-admin Binance deposit management ────────────────────────────────

  /** GET /api/admin/binance-deposits */
  adminGetAllBinanceDeposits: (page = 0, size = 20) =>
    http.get<ApiResponse<PageResponse<BinanceDeposit>>>(
      `/api/admin/binance-deposits${qs({ page, size })}`
    ),

  /** GET /api/admin/binance-deposits/pending */
  adminGetPendingBinanceDeposits: (page = 0, size = 20) =>
    http.get<ApiResponse<PageResponse<BinanceDeposit>>>(
      `/api/admin/binance-deposits/pending${qs({ page, size })}`
    ),

  /** GET /api/admin/binance-deposits/:id */
  adminGetBinanceDeposit: (id: string) =>
    http.get<ApiResponse<BinanceDeposit>>(`/api/admin/binance-deposits/${id}`),

  /** POST /api/admin/binance-deposits/:id/approve */
  adminApproveBinanceDeposit: (
    id: string,
    body: { creditedGhsAmount: number; adminNote?: string }
  ) =>
    http.post<ApiResponse<BinanceDeposit>>(
      `/api/admin/binance-deposits/${id}/approve`,
      body
    ),

  /** POST /api/admin/binance-deposits/:id/reject */
  adminRejectBinanceDeposit: (id: string, body: { adminNote: string }) =>
    http.post<ApiResponse<BinanceDeposit>>(
      `/api/admin/binance-deposits/${id}/reject`,
      body
    ),
};

// =============================================================================
// WEBHOOKS
// =============================================================================

export const webhooks = {
  /** POST /api/webhooks/stripe */
  stripe: (payload: string, signature: string) =>
    http.post<string>("/api/webhooks/stripe", payload, { "Stripe-Signature": signature }),

  /** POST /api/webhooks/paystack */
  paystack: (signature?: string) => {
    const headers = signature ? { "x-paystack-signature": signature } : undefined;
    return http.post<string>("/api/webhooks/paystack", undefined, headers);
  },
};

// =============================================================================
// BETS
// =============================================================================

export const bets = {
  /** GET /api/bets */
  getMyBets: (page = 0, size = 20) =>
    http.get<ApiResponse<PageResponse<Bet>>>(`/api/bets${qs({ page, size })}`),

  /** POST /api/bets */
  place: (body: PlaceBetRequest) =>
    http.post<ApiResponse<Bet>>("/api/bets", body),

  /** GET /api/bets/:id */
  getOne: (id: string) =>
    http.get<ApiResponse<Bet>>(`/api/bets/${id}`),

  /** GET /api/bets/unseen-wins */
  getUnseenWins: () =>
    http.get<ApiResponse<Bet[]>>("/api/bets/unseen-wins"),

  /** POST /api/bets/:id/dismiss-win */
  dismissWin: (id: string) =>
    http.post<ApiResponse<void>>(`/api/bets/${id}/dismiss-win`),
};

// =============================================================================
// GAMES
// =============================================================================

export const games = {
  /** POST /api/games/:game/play */
  play: (game: string, body: Record<string, unknown>) =>
    http.post<ApiResponse<GameRound>>(`/api/games/${game}/play`, body),

  /** POST /api/games/:game/cashout */
  cashout: (game: string, body: Record<string, unknown>) =>
    http.post<ApiResponse<Record<string, unknown>>>(`/api/games/${game}/cashout`, body),

  /** GET /api/games/:game/current-round */
  currentRound: (game: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/games/${game}/current-round`),

  /** GET /api/games/history */
  history: (limit = 20) =>
    http.get<ApiResponse<GameRound[]>>(`/api/games/history${qs({ limit })}`),
};

// =============================================================================
// BOOKING CODES (user-facing)
// =============================================================================

export const booking = {
  /** POST /api/booking/redeem */
  redeem: (body: RedeemRequest) =>
    http.post<ApiResponse<RedeemResponse>>("/api/booking/redeem", body),
};

// =============================================================================
// ADMIN — BOOKING CODES
// =============================================================================

export const adminBooking = {
  /** GET /api/admin/booking-codes */
  list: (page = 0, size = 20) =>
    http.get<ApiResponse<PageResponse<BookingCode>>>(
      `/api/admin/booking-codes${qs({ page, size })}`
    ),

  /** POST /api/admin/booking-codes — Standard code */
  createBookingCode: (body: CreateBookingRequest) =>
    http.post<ApiResponse<BookingCode>>("/api/admin/booking-codes", body),

  /** POST /api/admin/booking-codes — Admin-only matches */
  createAdminOnlyBookingCode: (body: CreateBookingRequest) =>
    http.post<ApiResponse<BookingCode>>("/api/admin/booking-codes", {
      ...body,
      bookingType: "ADMIN_ONLY",
    }),

  /** POST /api/admin/booking-codes — Mixed */
  createMixedBookingCode: (body: CreateBookingRequest) =>
    http.post<ApiResponse<BookingCode>>("/api/admin/booking-codes", {
      ...body,
      bookingType: "MIXED",
    }),

  /** GET /api/admin/booking-codes/:id */
  detail: (id: string) =>
    http.get<ApiResponse<BookingCode>>(`/api/admin/booking-codes/${id}`),
};

// =============================================================================
// GEO
// =============================================================================

export const geo = {
  /** GET /api/geo/currency */
  getCurrency: () =>
    http.get<Record<string, string>>("/api/geo/currency"),
};

// =============================================================================
// PUBLIC — FOOTBALL MATCHES
// =============================================================================

export const publicFootball = {
  /** GET /api/public/football/matches */
  getAll: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/football/matches"),

  /** GET /api/public/football/matches/upcoming */
  upcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/matches/upcoming"),

  /** GET /api/public/football/matches/today */
  today: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/matches/today"),

  /** GET /api/public/football/matches/live */
  live: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/matches/live"),

  /** GET /api/public/football/matches/future */
  future: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/matches/future"),

  /** GET /api/public/football/matches/results */
  results: (limit = 20) =>
    http.get<ApiResponse<Match[]>>(`/api/public/football/matches/results${qs({ limit })}`),

  /** GET /api/public/football/matches/featured */
  featured: () =>
    http.get<ApiResponse<Match[]>>("/api/public/football/matches/featured"),

  /** GET /api/public/football/matches/with-odds */
  withOdds: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/football/matches/with-odds"),

  /** GET /api/public/football/matches/with-all-odds */
  withAllOdds: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/football/matches/with-all-odds"),

  /** GET /api/public/football/matches/top6/upcoming */
  top6Upcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/matches/top6/upcoming"),

  /** GET /api/public/football/matches/top6/today */
  top6Today: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/matches/top6/today"),

  /** GET /api/public/football/matches/top6/live */
  top6Live: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/matches/top6/live"),

  /** GET /api/public/football/matches/cups/upcoming */
  cupsUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/matches/cups/upcoming"),

  /** GET /api/public/football/matches/cups/today */
  cupsToday: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/matches/cups/today"),

  /** GET /api/public/football/matches/cups/live */
  cupsLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/matches/cups/live"),

  /** GET /api/public/football/matches/all-cups/upcoming */
  allCupsUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/matches/all-cups/upcoming"),

  /** GET /api/public/football/matches/all-cups/today */
  allCupsToday: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/matches/all-cups/today"),

  /** GET /api/public/football/matches/all-cups/live */
  allCupsLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/matches/all-cups/live"),

  /** GET /api/public/football/matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/public/football/matches/${id}`),

  /** GET /api/public/football/matches/:id/stats */
  stats: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/matches/${id}/stats`),

  /** GET /api/public/football/matches/:id/prediction */
  prediction: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/matches/${id}/prediction`),

  /** GET /api/public/football/matches/:id/odds */
  odds: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/matches/${id}/odds`),

  /** GET /api/public/football/matches/:id/odds/raw */
  oddsRaw: (id: string) =>
    http.get<ApiResponse<Odds[]>>(`/api/public/football/matches/${id}/odds/raw`),

  /** GET /api/public/football/matches/:id/odds/all */
  oddsAll: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/matches/${id}/odds/all`),

  /** GET /api/public/football/matches/:id/odds/handicap */
  oddsHandicap: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/matches/${id}/odds/handicap`),

  /** GET /api/public/football/matches/:id/odds/half-time */
  oddsHalfTime: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/matches/${id}/odds/half-time`),

  /** GET /api/public/football/matches/:id/odds/correct-score */
  oddsCorrectScore: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/matches/${id}/odds/correct-score`),

  /** GET /api/public/football/matches/:id/odds/goalscorer */
  oddsGoalscorer: (id: string) =>
    http.get<ApiResponse<Record<string, Record<string, unknown>[]>>>(`/api/public/football/matches/${id}/odds/goalscorer`),

  /** GET /api/public/football/matches/:id/odds/espn */
  oddsEspn: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/matches/${id}/odds/espn`),

  /** GET /api/public/football/matches/:id/odds/cache-status */
  oddsCacheStatus: (id: string) =>
    http.get<ApiResponse<Record<string, boolean>>>(`/api/public/football/matches/${id}/odds/cache-status`),

  /** GET /api/public/football/matches/:id/lineups */
  lineups: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/matches/${id}/lineups`),

  /** GET /api/public/football/matches/:id/h2h */
  h2h: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/matches/${id}/h2h`),

  /** GET /api/public/football/matches/:id/events */
  events: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/matches/${id}/events`),

  /** GET /api/public/football/matches/:id/detail */
  detail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/matches/${id}/detail`),

  /** GET /api/public/football/matches/:id/form */
  form: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/matches/${id}/form`),

  /** GET /api/public/football/matches/:id/news */
  news: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/matches/${id}/news`),

  /** GET /api/public/football/matches/:id/videos */
  videos: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/matches/${id}/videos`),

  /** GET /api/public/football/matches/:id/venue */
  venue: (id: string) =>
    http.get<ApiResponse<string>>(`/api/public/football/matches/${id}/venue`),
};

// =============================================================================
// PUBLIC — FOOTBALL LEAGUES
// =============================================================================

export const publicFootballLeagues = {
  /** GET /api/public/football/leagues/:league/upcoming */
  upcoming: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/leagues/${league}/upcoming`),

  /** GET /api/public/football/leagues/:league/today */
  today: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/leagues/${league}/today`),

  /** GET /api/public/football/leagues/:league/live */
  live: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/leagues/${league}/live`),

  /** GET /api/public/football/leagues/top6/:league/upcoming */
  top6Upcoming: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/leagues/top6/${league}/upcoming`),

  /** GET /api/public/football/leagues/top6/:league/today */
  top6Today: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/leagues/top6/${league}/today`),

  /** GET /api/public/football/leagues/top6/:league/live */
  top6Live: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/leagues/top6/${league}/live`),

  /** GET /api/public/football/leagues/top6/:league/results/finished */
  top6Finished: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/leagues/top6/${league}/results/finished`),

  /** GET /api/public/football/leagues/top6/:league/teams */
  top6Teams: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/leagues/top6/${league}/teams`),

  /** GET /api/public/football/leagues/top6/:league/teams/:teamId/schedule */
  top6TeamSchedule: (league: FootballLeague, teamId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/leagues/top6/${league}/teams/${teamId}/schedule`),

  /** GET /api/public/football/leagues/top6/:league/fixtures/date/:date */
  top6FixturesByDate: (league: FootballLeague, date: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/leagues/top6/${league}/fixtures/date/${date}`),
};

// =============================================================================
// PUBLIC — FOOTBALL CUPS
// =============================================================================

export const publicFootballCups = {
  /** GET /api/public/football/cups/:cup/upcoming */
  upcoming: (cup: FootballCup) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/cups/${cup}/upcoming`),

  /** GET /api/public/football/cups/:cup/today */
  today: (cup: FootballCup) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/cups/${cup}/today`),

  /** GET /api/public/football/cups/:cup/live */
  live: (cup: FootballCup) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/cups/${cup}/live`),

  /** GET /api/public/football/cups/:cup/results/finished */
  finished: (cup: FootballCup) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/cups/${cup}/results/finished`),

  /** GET /api/public/football/cups/:cup/matches/:eventId/detail */
  matchDetail: (cup: FootballCup, eventId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/cups/${cup}/matches/${eventId}/detail`),

  /** GET /api/public/football/cups/fixtures/date/:date */
  fixturesByDate: (date: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/cups/fixtures/date/${date}`),
};

// =============================================================================
// PUBLIC — FOOTBALL TEAMS
// =============================================================================

export const publicFootballTeams = {
  /** GET /api/public/football/teams/:team/upcoming */
  upcoming: (team: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/teams/${team}/upcoming`),

  /** GET /api/public/football/teams/:team/results */
  results: (team: string) =>
    http.get<ApiResponse<Match[]>>(`/api/public/football/teams/${team}/results`),

  /** GET /api/public/football/teams/:team/live */
  live: (team: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/teams/${team}/live`),
};

// =============================================================================
// PUBLIC — FOOTBALL STANDINGS
// =============================================================================

export const publicFootballStandings = {
  /** GET /api/public/football/standings/:competitionId */
  byCompetition: (competitionId: number) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/standings/${competitionId}`),

  /** GET /api/public/football/standings/top6 */
  top6: () =>
    http.get<ApiResponse<Record<string, Record<string, unknown>>>>("/api/public/football/standings/top6"),

  /** GET /api/public/football/standings/leagues/:league */
  byLeague: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/standings/leagues/${league}`),

  /** GET /api/public/football/standings/leagues/top6/:league */
  top6ByLeague: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/standings/leagues/top6/${league}`),

  /** GET /api/public/football/standings/cups/:cup */
  byCup: (cup: FootballCup) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/standings/cups/${cup}`),
};

// =============================================================================
// PUBLIC — FOOTBALL SCORERS
// =============================================================================

export const publicFootballScorers = {
  /** GET /api/public/football/scorers/:competitionId */
  byCompetition: (competitionId: number) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/scorers/${competitionId}`),

  /** GET /api/public/football/scorers/leagues/:league */
  byLeague: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/scorers/leagues/${league}`),

  /** GET /api/public/football/scorers/leagues/top6/:league */
  top6ByLeague: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/football/scorers/leagues/top6/${league}`),
};

// =============================================================================
// PUBLIC — FOOTBALL LIVESCORE
// =============================================================================

export const publicFootballLivescore = {
  /** GET /api/public/football/livescore/live */
  live: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/livescore/live"),

  /** GET /api/public/football/livescore/today */
  today: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/livescore/today"),

  /** GET /api/public/football/livescore/fixtures */
  fixtures: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/livescore/fixtures"),

  /** GET /api/public/football/livescore/top6/live */
  top6Live: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/livescore/top6/live"),

  /** GET /api/public/football/livescore/top6/fixtures */
  top6Fixtures: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/livescore/top6/fixtures"),

  /** GET /api/public/football/livescore/top6/all-fixtures */
  top6AllFixtures: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/livescore/top6/all-fixtures"),

  /** GET /api/public/football/livescore/leagues/top6/:league/live */
  top6LeagueLive: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/livescore/leagues/top6/${league}/live`),

  /** GET /api/public/football/livescore/leagues/top6/:league/fixtures */
  top6LeagueFixtures: (league: FootballLeague) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/livescore/leagues/top6/${league}/fixtures`),

  /** GET /api/public/football/livescore/cups/live */
  cupsLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/livescore/cups/live"),

  /** GET /api/public/football/livescore/cups/fixtures */
  cupsFixtures: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/livescore/cups/fixtures"),

  /** GET /api/public/football/livescore/cups/:cup/live */
  cupLive: (cup: FootballCup) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/livescore/cups/${cup}/live`),

  /** GET /api/public/football/livescore/cups/:cup/fixtures */
  cupFixtures: (cup: FootballCup) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/football/livescore/cups/${cup}/fixtures`),

  /** GET /api/public/football/livescore/all-leagues/today */
  allLeaguesToday: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/livescore/all-leagues/today"),

  /** GET /api/public/football/livescore/all-cups/today */
  allCupsToday: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/football/livescore/all-cups/today"),
};

// =============================================================================
// PUBLIC — BASKETBALL / NBA MATCHES
// =============================================================================

export const publicBasketball = {
  /** GET /api/public/basketball/matches  (also /api/public/nba/matches) */
  getAll: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/basketball/matches"),

  /** GET /api/public/basketball/matches/upcoming */
  upcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/basketball/matches/upcoming"),

  /** GET /api/public/basketball/matches/today */
  today: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/basketball/matches/today"),

  /** GET /api/public/basketball/matches/live */
  live: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/basketball/matches/live"),

  /** GET /api/public/basketball/matches/future */
  future: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/basketball/matches/future"),

  /** GET /api/public/basketball/matches/results */
  results: (limit = 20) =>
    http.get<ApiResponse<Match[]>>(`/api/public/basketball/matches/results${qs({ limit })}`),

  /** GET /api/public/basketball/matches/with-odds */
  withOdds: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/basketball/matches/with-odds"),

  /** GET /api/public/basketball/matches/with-all-odds */
  withAllOdds: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/basketball/matches/with-all-odds"),

  /** GET /api/public/basketball/matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/public/basketball/matches/${id}`),

  /** GET /api/public/basketball/matches/:id/odds */
  odds: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/basketball/matches/${id}/odds`),

  /** GET /api/public/basketball/matches/:id/odds/all */
  oddsAll: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/basketball/matches/${id}/odds/all`),

  /** GET /api/public/basketball/matches/:id/odds/moneyline */
  oddsMoneyline: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/basketball/matches/${id}/odds/moneyline`),

  /** GET /api/public/basketball/matches/:id/odds/spread */
  oddsSpread: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/basketball/matches/${id}/odds/spread`),

  /** GET /api/public/basketball/matches/:id/odds/total */
  oddsTotal: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/basketball/matches/${id}/odds/total`),

  /** GET /api/public/basketball/matches/:id/odds/quarters */
  oddsQuarters: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/basketball/matches/${id}/odds/quarters`),

  /** GET /api/public/basketball/matches/:id/odds/margin */
  oddsMargin: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/basketball/matches/${id}/odds/margin`),

  /** GET /api/public/basketball/matches/:id/stats */
  stats: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/basketball/matches/${id}/stats`),

  /** GET /api/public/basketball/matches/:id/lineups */
  lineups: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/basketball/matches/${id}/lineups`),

  /** GET /api/public/basketball/matches/:id/h2h */
  h2h: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/basketball/matches/${id}/h2h`),

  /** GET /api/public/basketball/matches/:id/events */
  events: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/basketball/matches/${id}/events`),

  /** GET /api/public/basketball/matches/:id/detail */
  detail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/basketball/matches/${id}/detail`),

  /** GET /api/public/basketball/standings */
  standings: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/basketball/standings"),

  /** GET /api/public/basketball/teams */
  teams: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/basketball/teams"),

  /** GET /api/public/basketball/teams/:team/upcoming */
  teamUpcoming: (team: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/basketball/teams/${team}/upcoming`),

  /** GET /api/public/basketball/teams/:team/results */
  teamResults: (team: string) =>
    http.get<ApiResponse<Match[]>>(`/api/public/basketball/teams/${team}/results`),

  /** GET /api/public/basketball/teams/:team/live */
  teamLive: (team: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/basketball/teams/${team}/live`),

  /** GET /api/public/basketball/teams/:teamId/schedule */
  teamSchedule: (teamId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/basketball/teams/${teamId}/schedule`),

  /** GET /api/public/basketball/teams/:teamId/roster */
  teamRoster: (teamId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/basketball/teams/${teamId}/roster`),

  /** GET /api/public/basketball/teams/:teamId/info */
  teamInfo: (teamId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/basketball/teams/${teamId}/info`),

  /** GET /api/public/basketball/espn/upcoming */
  espnUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/basketball/espn/upcoming"),

  /** GET /api/public/basketball/espn/today */
  espnToday: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/basketball/espn/today"),

  /** GET /api/public/basketball/espn/live */
  espnLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/basketball/espn/live"),

  /** GET /api/public/basketball/espn/game/:espnGameId */
  espnGameDetail: (espnGameId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/basketball/espn/game/${espnGameId}`),
};

// =============================================================================
// PUBLIC — NFL / AMERICAN FOOTBALL MATCHES
// =============================================================================

export const publicNfl = {
  /** GET /api/public/nfl/matches */
  getAll: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/nfl/matches"),

  /** GET /api/public/nfl/matches/upcoming */
  upcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/nfl/matches/upcoming"),

  /** GET /api/public/nfl/matches/today */
  today: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/nfl/matches/today"),

  /** GET /api/public/nfl/matches/live */
  live: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/nfl/matches/live"),

  /** GET /api/public/nfl/matches/results */
  results: () =>
    http.get<ApiResponse<Match[]>>("/api/public/nfl/matches/results"),

  /** GET /api/public/nfl/matches/with-odds */
  withOdds: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/nfl/matches/with-odds"),

  /** GET /api/public/nfl/matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/public/nfl/matches/${id}`),

  /** GET /api/public/nfl/matches/:id/odds */
  odds: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/nfl/matches/${id}/odds`),

  /** GET /api/public/nfl/matches/:id/odds/all */
  oddsAll: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/nfl/matches/${id}/odds/all`),

  /** GET /api/public/nfl/matches/:id/score */
  score: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/nfl/matches/${id}/score`),

  /** GET /api/public/nfl/matches/:id/detail */
  detail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/nfl/matches/${id}/detail`),

  /** GET /api/public/nfl/standings */
  standings: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/nfl/standings"),

  /** GET /api/public/nfl/espn/week */
  espnCurrentWeek: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/nfl/espn/week"),

  /** GET /api/public/nfl/espn/week/:week */
  espnByWeek: (week: number, seasonType = 2) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/nfl/espn/week/${week}${qs({ seasonType })}`),

  /** GET /api/public/nfl/espn/upcoming */
  espnUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/nfl/espn/upcoming"),

  /** GET /api/public/nfl/espn/live */
  espnLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/nfl/espn/live"),

  /** GET /api/public/nfl/espn/finished */
  espnFinished: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/nfl/espn/finished"),

  /** GET /api/public/nfl/espn/date/:date */
  espnByDate: (date: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/nfl/espn/date/${date}`),
};

// =============================================================================
// PUBLIC — BASEBALL MATCHES
// =============================================================================

export const publicBaseball = {
  /** GET /api/public/baseball/matches */
  getAll: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/baseball/matches"),

  /** GET /api/public/baseball/matches/upcoming */
  upcoming: () =>
    http.get<ApiResponse<Match[]>>("/api/public/baseball/matches/upcoming"),

  /** GET /api/public/baseball/matches/today */
  today: () =>
    http.get<ApiResponse<Match[]>>("/api/public/baseball/matches/today"),

  /** GET /api/public/baseball/matches/live */
  live: () =>
    http.get<ApiResponse<Match[]>>("/api/public/baseball/matches/live"),

  /** GET /api/public/baseball/matches/results */
  results: (limit = 20) =>
    http.get<ApiResponse<Match[]>>(`/api/public/baseball/matches/results${qs({ limit })}`),

  /** GET /api/public/baseball/matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/public/baseball/matches/${id}`),

  /** GET /api/public/baseball/matches/:id/odds */
  odds: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/baseball/matches/${id}/odds`),

  /** GET /api/public/baseball/matches/:id/odds/persisted */
  oddsDb: (id: string) =>
    http.get<ApiResponse<Odds[]>>(`/api/public/baseball/matches/${id}/odds/persisted`),

  /** GET /api/public/baseball/matches/:id/score */
  score: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/baseball/matches/${id}/score`),

  /** GET /api/public/baseball/matches/:id/detail */
  detail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/baseball/matches/${id}/detail`),

  /** GET /api/public/baseball/standings */
  standings: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/baseball/standings"),

  /** GET /api/public/baseball/teams/:team/upcoming */
  teamUpcoming: (team: string) =>
    http.get<ApiResponse<Match[]>>(`/api/public/baseball/teams/${team}/upcoming`),

  /** GET /api/public/baseball/teams/:team/results */
  teamResults: (team: string) =>
    http.get<ApiResponse<Match[]>>(`/api/public/baseball/teams/${team}/results`),

  /** GET /api/public/baseball/teams/:team/live */
  teamLive: (team: string) =>
    http.get<ApiResponse<Match[]>>(`/api/public/baseball/teams/${team}/live`),

  /** GET /api/public/baseball/espn/upcoming */
  espnUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/baseball/espn/upcoming"),

  /** GET /api/public/baseball/espn/today */
  espnToday: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/baseball/espn/today"),

  /** GET /api/public/baseball/espn/live */
  espnLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/baseball/espn/live"),

  /** GET /api/public/baseball/espn/game/:espnGameId */
  espnGameDetail: (espnGameId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/baseball/espn/game/${espnGameId}`),
};

// =============================================================================
// PUBLIC — MMA MATCHES
// =============================================================================

export const publicMma = {
  /** GET /api/public/mma/matches */
  getAll: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/mma/matches"),

  /** GET /api/public/mma/matches/upcoming */
  upcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/mma/matches/upcoming"),

  /** GET /api/public/mma/matches/live */
  live: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/mma/matches/live"),

  /** GET /api/public/mma/matches/results */
  results: (limit = 20) =>
    http.get<ApiResponse<Match[]>>(`/api/public/mma/matches/results${qs({ limit })}`),

  /** GET /api/public/mma/matches/featured */
  featured: () =>
    http.get<ApiResponse<Match[]>>("/api/public/mma/matches/featured"),

  /** GET /api/public/mma/matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/public/mma/matches/${id}`),

  /** GET /api/public/mma/matches/:id/odds */
  odds: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/mma/matches/${id}/odds`),

  /** GET /api/public/mma/matches/:id/odds/all */
  oddsAll: (id: string) =>
    http.get<ApiResponse<Odds[]>>(`/api/public/mma/matches/${id}/odds/all`),

  /** GET /api/public/mma/matches/:id/score */
  score: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/mma/matches/${id}/score`),

  /** GET /api/public/mma/matches/:id/detail */
  detail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/mma/matches/${id}/detail`),

  /** GET /api/public/mma/matches/:id/events */
  events: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/mma/matches/${id}/events`),

  /** GET /api/public/mma/matches/:id/full */
  fullDetail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/mma/matches/${id}/full`),

  /** GET /api/public/mma/matches/:id/fight-card */
  fightCard: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/mma/matches/${id}/fight-card`),

  /** GET /api/public/mma/matches/with-odds */
  withOdds: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/mma/matches/with-odds"),

  /** GET /api/public/mma/fighters/:athleteId */
  fighter: (athleteId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/mma/fighters/${athleteId}`),

  /** GET /api/public/mma/espn/events */
  espnEvents: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/mma/espn/events"),

  /** GET /api/public/mma/espn/events/upcoming */
  espnUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/mma/espn/events/upcoming"),

  /** GET /api/public/mma/espn/events/live */
  espnLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/mma/espn/events/live"),

  /** GET /api/public/mma/espn/events/finished */
  espnFinished: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/mma/espn/events/finished"),
};

// =============================================================================
// PUBLIC — TENNIS MATCHES
// =============================================================================

export const publicTennis = {
  /** GET /api/public/tennis/matches */
  getAll: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/tennis/matches"),

  /** GET /api/public/tennis/matches/upcoming */
  upcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/tennis/matches/upcoming"),

  /** GET /api/public/tennis/matches/live */
  live: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/tennis/matches/live"),

  /** GET /api/public/tennis/matches/results */
  results: (limit = 20) =>
    http.get<ApiResponse<Match[]>>(`/api/public/tennis/matches/results${qs({ limit })}`),

  /** GET /api/public/tennis/matches/featured */
  featured: () =>
    http.get<ApiResponse<Match[]>>("/api/public/tennis/matches/featured"),

  /** GET /api/public/tennis/matches/with-odds */
  withOdds: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/tennis/matches/with-odds"),

  /** GET /api/public/tennis/matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/public/tennis/matches/${id}`),

  /** GET /api/public/tennis/matches/:id/odds */
  odds: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/tennis/matches/${id}/odds`),

  /** GET /api/public/tennis/matches/:id/score */
  score: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/tennis/matches/${id}/score`),

  /** GET /api/public/tennis/matches/:id/events */
  events: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/tennis/matches/${id}/events`),

  /** GET /api/public/tennis/matches/:id/detail */
  detail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/tennis/matches/${id}/detail`),

  /** GET /api/public/tennis/atp/matches */
  atpMatches: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/tennis/atp/matches"),

  /** GET /api/public/tennis/atp/live */
  atpLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/tennis/atp/live"),

  /** GET /api/public/tennis/atp/upcoming */
  atpUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/tennis/atp/upcoming"),

  /** GET /api/public/tennis/atp/tournaments */
  atpTournaments: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/tennis/atp/tournaments"),

  /** GET /api/public/tennis/atp/rankings */
  atpRankings: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/tennis/atp/rankings"),

  /** GET /api/public/tennis/wta/matches */
  wtaMatches: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/tennis/wta/matches"),

  /** GET /api/public/tennis/wta/live */
  wtaLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/tennis/wta/live"),

  /** GET /api/public/tennis/wta/upcoming */
  wtaUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/tennis/wta/upcoming"),

  /** GET /api/public/tennis/wta/tournaments */
  wtaTournaments: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/public/tennis/wta/tournaments"),

  /** GET /api/public/tennis/wta/rankings */
  wtaRankings: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/tennis/wta/rankings"),

  /** GET /api/public/tennis/tours/:tour/upcoming */
  tourUpcoming: (tour: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/tennis/tours/${tour}/upcoming`),

  /** GET /api/public/tennis/tours/:tour/live */
  tourLive: (tour: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/public/tennis/tours/${tour}/live`),
};

// =============================================================================
// PUBLIC — ADMIN MATCHES
// =============================================================================

export const publicAdminMatches = {
  /** GET /api/public/admin-matches */
  getAll: () =>
    http.get<ApiResponse<Match[]>>("/api/public/admin-matches"),

  /** GET /api/public/admin-matches/upcoming */
  upcoming: () =>
    http.get<ApiResponse<Match[]>>("/api/public/admin-matches/upcoming"),

  /** GET /api/public/admin-matches/live */
  live: () =>
    http.get<ApiResponse<Match[]>>("/api/public/admin-matches/live"),

  /** GET /api/public/admin-matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/public/admin-matches/${id}`),

  /** GET /api/public/admin-matches/:id/odds */
  odds: (id: string) =>
    http.get<ApiResponse<Odds[]>>(`/api/public/admin-matches/${id}/odds`),

  /** GET /api/public/admin-matches/:id/odds/all */
  oddsAll: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/public/admin-matches/${id}/odds/all`),
};

// =============================================================================
// PUBLIC — CONFIG & PREDICTIONS
// =============================================================================

export const publicConfig = {
  /** GET /api/public/config */
  get: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/public/config"),
};

export const publicPredictions = {
  /** GET /api/predictions/public */
  feed: (page = 0, size = 20) =>
    http.get<ApiResponse<PageResponse<AiPrediction>>>(
      `/api/predictions/public${qs({ page, size })}`
    ),

  /** GET /api/tip/:id */
  getTip: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/tip/${id}`),
};

// =============================================================================
// AUTHENTICATED — FOOTBALL MATCHES
// =============================================================================

export const matches = {
  /** GET /api/matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/matches/${id}`),

  /** GET /api/matches/upcoming */
  upcoming: () =>
    http.get<ApiResponse<Match[]>>("/api/matches/upcoming"),

  /** GET /api/matches/today */
  today: () =>
    http.get<ApiResponse<Match[]>>("/api/matches/today"),

  /** GET /api/matches/live */
  live: () =>
    http.get<ApiResponse<Match[]>>("/api/matches/live"),

  /** GET /api/matches/future */
  future: () =>
    http.get<ApiResponse<Match[]>>("/api/matches/future"),

  /** GET /api/matches/results */
  results: (limit = 20) =>
    http.get<ApiResponse<Match[]>>(`/api/matches/results${qs({ limit })}`),

  /** GET /api/matches/top6/upcoming */
  top6Upcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/matches/top6/upcoming"),

  /** GET /api/matches/top6/today */
  top6Today: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/matches/top6/today"),

  /** GET /api/matches/top6/live */
  top6Live: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/matches/top6/live"),

  /** GET /api/matches/cups/upcoming */
  cupsUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/matches/cups/upcoming"),

  /** GET /api/matches/cups/today */
  cupsToday: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/matches/cups/today"),

  /** GET /api/matches/cups/live */
  cupsLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/matches/cups/live"),

  /** GET /api/matches/all-cups/upcoming */
  allCupsUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/matches/all-cups/upcoming"),

  /** GET /api/matches/all-cups/today */
  allCupsToday: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/matches/all-cups/today"),

  /** GET /api/matches/all-cups/live */
  allCupsLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/matches/all-cups/live"),

  /** GET /api/matches/:id/stats */
  stats: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/matches/${id}/stats`),

  /** GET /api/matches/:id/prediction */
  prediction: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/matches/${id}/prediction`),

  /** GET /api/matches/:id/odds */
  odds: (id: string) =>
    http.get<ApiResponse<Odds[]>>(`/api/matches/${id}/odds`),

  /** GET /api/matches/:id/odds/live */
  oddsLive: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/matches/${id}/odds/live`),

  /** GET /api/matches/:id/odds/all */
  oddsAll: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/matches/${id}/odds/all`),

  /** GET /api/matches/:id/odds/handicap */
  oddsHandicap: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/matches/${id}/odds/handicap`),

  /** GET /api/matches/:id/odds/half-time */
  oddsHalfTime: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/matches/${id}/odds/half-time`),

  /** GET /api/matches/:id/odds/correct-score */
  oddsCorrectScore: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/matches/${id}/odds/correct-score`),

  /** GET /api/matches/:id/lineups */
  lineups: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/matches/${id}/lineups`),

  /** GET /api/matches/:id/h2h */
  h2h: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/matches/${id}/h2h`),

  /** GET /api/matches/:id/events */
  events: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/matches/${id}/events`),

  /** GET /api/matches/:id/detail */
  detail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/matches/${id}/detail`),
};

// =============================================================================
// AUTHENTICATED — LIVESCORE
// =============================================================================

export const livescore = {
  /** GET /api/livescore/live */
  live: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/livescore/live"),

  /** GET /api/livescore/today */
  today: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/livescore/today"),

  /** GET /api/livescore/fixtures */
  fixtures: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/livescore/fixtures"),

  /** GET /api/livescore/top6/live */
  top6Live: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/livescore/top6/live"),

  /** GET /api/livescore/top6/fixtures */
  top6Fixtures: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/livescore/top6/fixtures"),

  /** GET /api/livescore/top6/all-fixtures */
  top6AllFixtures: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/livescore/top6/all-fixtures"),

  /** GET /api/livescore/leagues/top6/:league/live */
  top6LeagueLive: (league: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/livescore/leagues/top6/${league}/live`),

  /** GET /api/livescore/leagues/top6/:league/fixtures */
  top6LeagueFixtures: (league: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/livescore/leagues/top6/${league}/fixtures`),

  /** GET /api/livescore/cups/live */
  cupsLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/livescore/cups/live"),

  /** GET /api/livescore/cups/fixtures */
  cupsFixtures: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/livescore/cups/fixtures"),

  /** GET /api/livescore/cups/:cup/live */
  cupLive: (cup: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/livescore/cups/${cup}/live`),

  /** GET /api/livescore/cups/:cup/fixtures */
  cupFixtures: (cup: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/livescore/cups/${cup}/fixtures`),
};

// =============================================================================
// AUTHENTICATED — STANDINGS
// =============================================================================

export const standings = {
  /** GET /api/standings/:competitionId */
  byCompetition: (competitionId: number) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/standings/${competitionId}`),

  /** GET /api/standings/top6 */
  top6: () =>
    http.get<ApiResponse<Record<string, Record<string, unknown>>>>("/api/standings/top6"),

  /** GET /api/standings/leagues/:league */
  byLeague: (league: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/standings/leagues/${league}`),

  /** GET /api/standings/leagues/top6/:league */
  top6ByLeague: (league: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/standings/leagues/top6/${league}`),

  /** GET /api/standings/cups/:cup */
  byCup: (cup: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/standings/cups/${cup}`),
};

// =============================================================================
// AUTHENTICATED — SCORERS
// =============================================================================

export const scorers = {
  /** GET /api/scorers/:competitionId */
  byCompetition: (competitionId: number) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/scorers/${competitionId}`),

  /** GET /api/scorers/leagues/:league */
  byLeague: (league: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/scorers/leagues/${league}`),

  /** GET /api/scorers/leagues/top6/:league */
  top6ByLeague: (league: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/scorers/leagues/top6/${league}`),
};

// =============================================================================
// AUTHENTICATED — TEAMS (football)
// =============================================================================

export const teams = {
  /** GET /api/teams/name/:team/upcoming */
  upcoming: (team: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/teams/name/${team}/upcoming`),

  /** GET /api/teams/name/:team/results */
  results: (team: string) =>
    http.get<ApiResponse<Match[]>>(`/api/teams/name/${team}/results`),

  /** GET /api/teams/name/:team/live */
  live: (team: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/teams/name/${team}/live`),

  /** GET /api/teams/id/:teamId/matches */
  matchesById: (teamId: number) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/teams/id/${teamId}/matches`),

  /** GET /api/teams/id/:teamId/live */
  liveById: (teamId: number) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/teams/id/${teamId}/live`),

  /** GET /api/teams/id/:teamId/fixtures */
  fixturesById: (teamId: number) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/teams/id/${teamId}/fixtures`),
};

// =============================================================================
// AUTHENTICATED — LEAGUES (football)
// =============================================================================

export const leagues = {
  /** GET /api/leagues/:league/upcoming */
  upcoming: (league: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/leagues/${league}/upcoming`),

  /** GET /api/leagues/:league/today */
  today: (league: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/leagues/${league}/today`),

  /** GET /api/leagues/:league/live */
  live: (league: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/leagues/${league}/live`),

  /** GET /api/leagues/top6/:league/upcoming */
  top6Upcoming: (league: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/leagues/top6/${league}/upcoming`),

  /** GET /api/leagues/top6/:league/today */
  top6Today: (league: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/leagues/top6/${league}/today`),

  /** GET /api/leagues/top6/:league/live */
  top6Live: (league: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/leagues/top6/${league}/live`),
};

// =============================================================================
// AUTHENTICATED — CUPS (football)
// =============================================================================

export const cups = {
  /** GET /api/cups/:cup/upcoming */
  upcoming: (cup: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/cups/${cup}/upcoming`),

  /** GET /api/cups/:cup/today */
  today: (cup: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/cups/${cup}/today`),

  /** GET /api/cups/:cup/live */
  live: (cup: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/cups/${cup}/live`),
};

// =============================================================================
// AUTHENTICATED — NBA / BASKETBALL (auth)
// =============================================================================

export const nba = {
  /** GET /api/nba/matches/upcoming  (also /api/basketball/matches/upcoming) */
  upcoming: () =>
    http.get<ApiResponse<Match[]>>("/api/nba/matches/upcoming"),

  /** GET /api/nba/matches/today */
  today: () =>
    http.get<ApiResponse<Match[]>>("/api/nba/matches/today"),

  /** GET /api/nba/matches/live */
  live: () =>
    http.get<ApiResponse<Match[]>>("/api/nba/matches/live"),

  /** GET /api/nba/matches/future */
  future: () =>
    http.get<ApiResponse<Match[]>>("/api/nba/matches/future"),

  /** GET /api/nba/matches/results */
  results: (limit = 20) =>
    http.get<ApiResponse<Match[]>>(`/api/nba/matches/results${qs({ limit })}`),

  /** GET /api/nba/matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/nba/matches/${id}`),

  /** GET /api/nba/matches/:id/odds */
  odds: (id: string) =>
    http.get<ApiResponse<Odds[]>>(`/api/nba/matches/${id}/odds`),

  /** GET /api/nba/matches/:id/odds/all */
  oddsAll: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nba/matches/${id}/odds/all`),

  /** GET /api/nba/matches/:id/odds/moneyline */
  oddsMoneyline: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/nba/matches/${id}/odds/moneyline`),

  /** GET /api/nba/matches/:id/odds/spread */
  oddsSpread: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/nba/matches/${id}/odds/spread`),

  /** GET /api/nba/matches/:id/odds/total */
  oddsTotal: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/nba/matches/${id}/odds/total`),

  /** GET /api/nba/matches/:id/odds/quarters */
  oddsQuarters: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/nba/matches/${id}/odds/quarters`),

  /** GET /api/nba/matches/:id/odds/margin */
  oddsMargin: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/nba/matches/${id}/odds/margin`),

  /** GET /api/nba/matches/:id/score */
  score: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nba/matches/${id}/score`),

  /** GET /api/nba/matches/:id/stats */
  stats: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nba/matches/${id}/stats`),

  /** GET /api/nba/matches/:id/lineups */
  lineups: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nba/matches/${id}/lineups`),

  /** GET /api/nba/matches/:id/h2h */
  h2h: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nba/matches/${id}/h2h`),

  /** GET /api/nba/matches/:id/events */
  events: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nba/matches/${id}/events`),

  /** GET /api/nba/matches/:id/detail */
  detail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nba/matches/${id}/detail`),

  /** GET /api/nba/matches/:id/detail/full */
  detailFull: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nba/matches/${id}/detail/full`),

  /** GET /api/nba/standings */
  standings: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/nba/standings"),

  /** GET /api/nba/teams */
  teams: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/nba/teams"),

  /** GET /api/nba/teams/:team/upcoming */
  teamUpcoming: (team: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/nba/teams/${team}/upcoming`),

  /** GET /api/nba/teams/:team/results */
  teamResults: (team: string) =>
    http.get<ApiResponse<Match[]>>(`/api/nba/teams/${team}/results`),

  /** GET /api/nba/teams/:team/live */
  teamLive: (team: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/nba/teams/${team}/live`),

  /** GET /api/nba/teams/:teamId/schedule */
  teamSchedule: (teamId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nba/teams/${teamId}/schedule`),

  /** GET /api/nba/teams/:teamId/roster */
  teamRoster: (teamId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nba/teams/${teamId}/roster`),

  /** GET /api/nba/teams/:teamId/info */
  teamInfo: (teamId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nba/teams/${teamId}/info`),

  /** GET /api/nba/espn/upcoming */
  espnUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/nba/espn/upcoming"),

  /** GET /api/nba/espn/today */
  espnToday: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/nba/espn/today"),

  /** GET /api/nba/espn/live */
  espnLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/nba/espn/live"),

  /** GET /api/nba/espn/game/:espnGameId */
  espnGameDetail: (espnGameId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nba/espn/game/${espnGameId}`),
};

// =============================================================================
// AUTHENTICATED — NFL (auth)
// =============================================================================

export const nfl = {
  /** GET /api/nfl/matches/upcoming */
  upcoming: () =>
    http.get<ApiResponse<Match[]>>("/api/nfl/matches/upcoming"),

  /** GET /api/nfl/matches/today */
  today: () =>
    http.get<ApiResponse<Match[]>>("/api/nfl/matches/today"),

  /** GET /api/nfl/matches/live */
  live: () =>
    http.get<ApiResponse<Match[]>>("/api/nfl/matches/live"),

  /** GET /api/nfl/matches/results */
  results: () =>
    http.get<ApiResponse<Match[]>>("/api/nfl/matches/results"),

  /** GET /api/nfl/matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/nfl/matches/${id}`),

  /** GET /api/nfl/matches/:id/odds */
  odds: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/nfl/matches/${id}/odds`),

  /** GET /api/nfl/matches/:id/odds/db */
  oddsDb: (id: string) =>
    http.get<ApiResponse<Odds[]>>(`/api/nfl/matches/${id}/odds/db`),

  /** GET /api/nfl/matches/:id/odds/all */
  oddsAll: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nfl/matches/${id}/odds/all`),

  /** GET /api/nfl/matches/:id/score */
  score: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nfl/matches/${id}/score`),

  /** GET /api/nfl/matches/:id/detail */
  detail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nfl/matches/${id}/detail`),

  /** GET /api/nfl/matches/espn/:espnGameId/full */
  espnFullGame: (espnGameId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nfl/matches/espn/${espnGameId}/full`),

  /** GET /api/nfl/standings */
  standings: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/nfl/standings"),

  /** GET /api/nfl/teams */
  teams: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/nfl/teams"),

  /** GET /api/nfl/teams/:teamId */
  teamInfo: (teamId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nfl/teams/${teamId}`),

  /** GET /api/nfl/teams/:teamId/schedule */
  teamSchedule: (teamId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nfl/teams/${teamId}/schedule`),

  /** GET /api/nfl/teams/:teamId/roster */
  teamRoster: (teamId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/nfl/teams/${teamId}/roster`),

  /** GET /api/nfl/espn/week */
  espnCurrentWeek: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/nfl/espn/week"),

  /** GET /api/nfl/espn/week/:week */
  espnByWeek: (week: number, seasonType = 2) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/nfl/espn/week/${week}${qs({ seasonType })}`),

  /** GET /api/nfl/espn/upcoming */
  espnUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/nfl/espn/upcoming"),

  /** GET /api/nfl/espn/live */
  espnLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/nfl/espn/live"),

  /** GET /api/nfl/espn/finished */
  espnFinished: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/nfl/espn/finished"),

  /** GET /api/nfl/espn/date/:date */
  espnByDate: (date: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/nfl/espn/date/${date}`),
};

// =============================================================================
// AUTHENTICATED — BASEBALL (auth)
// =============================================================================

export const baseball = {
  /** GET /api/baseball/matches/upcoming */
  upcoming: () =>
    http.get<ApiResponse<Match[]>>("/api/baseball/matches/upcoming"),

  /** GET /api/baseball/matches/today */
  today: () =>
    http.get<ApiResponse<Match[]>>("/api/baseball/matches/today"),

  /** GET /api/baseball/matches/live */
  live: () =>
    http.get<ApiResponse<Match[]>>("/api/baseball/matches/live"),

  /** GET /api/baseball/matches/results */
  results: (limit = 20) =>
    http.get<ApiResponse<Match[]>>(`/api/baseball/matches/results${qs({ limit })}`),

  /** GET /api/baseball/matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/baseball/matches/${id}`),

  /** GET /api/baseball/matches/:id/odds */
  odds: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/baseball/matches/${id}/odds`),

  /** GET /api/baseball/matches/:id/odds/persisted */
  oddsDb: (id: string) =>
    http.get<ApiResponse<Odds[]>>(`/api/baseball/matches/${id}/odds/persisted`),

  /** GET /api/baseball/matches/:id/score */
  score: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/baseball/matches/${id}/score`),

  /** GET /api/baseball/matches/:id/detail */
  detail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/baseball/matches/${id}/detail`),

  /** GET /api/baseball/standings */
  standings: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/baseball/standings"),

  /** GET /api/baseball/teams/:team/upcoming */
  teamUpcoming: (team: string) =>
    http.get<ApiResponse<Match[]>>(`/api/baseball/teams/${team}/upcoming`),

  /** GET /api/baseball/teams/:team/results */
  teamResults: (team: string) =>
    http.get<ApiResponse<Match[]>>(`/api/baseball/teams/${team}/results`),

  /** GET /api/baseball/teams/:team/live */
  teamLive: (team: string) =>
    http.get<ApiResponse<Match[]>>(`/api/baseball/teams/${team}/live`),

  /** GET /api/baseball/espn/upcoming */
  espnUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/baseball/espn/upcoming"),

  /** GET /api/baseball/espn/today */
  espnToday: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/baseball/espn/today"),

  /** GET /api/baseball/espn/live */
  espnLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/baseball/espn/live"),

  /** GET /api/baseball/espn/game/:espnGameId */
  espnGameDetail: (espnGameId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/baseball/espn/game/${espnGameId}`),
};

// =============================================================================
// AUTHENTICATED — MMA (auth)
// =============================================================================

export const mma = {
  /** GET /api/mma/matches/upcoming */
  upcoming: () =>
    http.get<ApiResponse<Match[]>>("/api/mma/matches/upcoming"),

  /** GET /api/mma/matches/live */
  live: () =>
    http.get<ApiResponse<Match[]>>("/api/mma/matches/live"),

  /** GET /api/mma/matches/results */
  results: (limit = 20) =>
    http.get<ApiResponse<Match[]>>(`/api/mma/matches/results${qs({ limit })}`),

  /** GET /api/mma/matches/featured */
  featured: () =>
    http.get<ApiResponse<Match[]>>("/api/mma/matches/featured"),

  /** GET /api/mma/matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/mma/matches/${id}`),

  /** GET /api/mma/matches/:id/odds */
  odds: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/mma/matches/${id}/odds`),

  /** GET /api/mma/matches/:id/odds/all */
  oddsAll: (id: string) =>
    http.get<ApiResponse<Odds[]>>(`/api/mma/matches/${id}/odds/all`),

  /** GET /api/mma/matches/:id/score */
  score: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/mma/matches/${id}/score`),

  /** GET /api/mma/matches/:id/detail */
  detail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/mma/matches/${id}/detail`),

  /** GET /api/mma/matches/:id/events */
  events: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/mma/matches/${id}/events`),

  /** GET /api/mma/matches/:id/full */
  fullDetail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/mma/matches/${id}/full`),

  /** GET /api/mma/matches/:id/fight-card */
  fightCard: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/mma/matches/${id}/fight-card`),

  /** GET /api/mma/fighters/:athleteId */
  fighter: (athleteId: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/mma/fighters/${athleteId}`),

  /** GET /api/mma/espn/events */
  espnEvents: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/mma/espn/events"),

  /** GET /api/mma/espn/events/upcoming */
  espnUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/mma/espn/events/upcoming"),

  /** GET /api/mma/espn/events/live */
  espnLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/mma/espn/events/live"),

  /** GET /api/mma/espn/events/finished */
  espnFinished: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/mma/espn/events/finished"),
};

// =============================================================================
// AUTHENTICATED — TENNIS (auth)
// =============================================================================

export const tennis = {
  /** GET /api/tennis/matches/upcoming */
  upcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/tennis/matches/upcoming"),

  /** GET /api/tennis/matches/live */
  live: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/tennis/matches/live"),

  /** GET /api/tennis/matches/results */
  results: (limit = 20) =>
    http.get<ApiResponse<Match[]>>(`/api/tennis/matches/results${qs({ limit })}`),

  /** GET /api/tennis/matches/featured */
  featured: () =>
    http.get<ApiResponse<Match[]>>("/api/tennis/matches/featured"),

  /** GET /api/tennis/matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/tennis/matches/${id}`),

  /** GET /api/tennis/matches/:id/odds */
  odds: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/tennis/matches/${id}/odds`),

  /** GET /api/tennis/matches/:id/odds/db */
  oddsDb: (id: string) =>
    http.get<ApiResponse<Odds[]>>(`/api/tennis/matches/${id}/odds/db`),

  /** GET /api/tennis/matches/:id/score */
  score: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/tennis/matches/${id}/score`),

  /** GET /api/tennis/matches/:id/events */
  events: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/tennis/matches/${id}/events`),

  /** GET /api/tennis/matches/:id/detail */
  detail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/tennis/matches/${id}/detail`),

  /** GET /api/tennis/matches/:id/full-detail */
  fullDetail: (id: string) =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/tennis/matches/${id}/full-detail`),

  /** GET /api/tennis/atp/matches */
  atpMatches: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/tennis/atp/matches"),

  /** GET /api/tennis/atp/live */
  atpLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/tennis/atp/live"),

  /** GET /api/tennis/atp/upcoming */
  atpUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/tennis/atp/upcoming"),

  /** GET /api/tennis/atp/tournaments */
  atpTournaments: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/tennis/atp/tournaments"),

  /** GET /api/tennis/atp/rankings */
  atpRankings: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/tennis/atp/rankings"),

  /** GET /api/tennis/wta/matches */
  wtaMatches: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/tennis/wta/matches"),

  /** GET /api/tennis/wta/live */
  wtaLive: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/tennis/wta/live"),

  /** GET /api/tennis/wta/upcoming */
  wtaUpcoming: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/tennis/wta/upcoming"),

  /** GET /api/tennis/wta/tournaments */
  wtaTournaments: () =>
    http.get<ApiResponse<Record<string, unknown>[]>>("/api/tennis/wta/tournaments"),

  /** GET /api/tennis/wta/rankings */
  wtaRankings: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/tennis/wta/rankings"),

  /** GET /api/tennis/tours/:tour/upcoming */
  tourUpcoming: (tour: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/tennis/tours/${tour}/upcoming`),

  /** GET /api/tennis/tours/:tour/live */
  tourLive: (tour: string) =>
    http.get<ApiResponse<Record<string, unknown>[]>>(`/api/tennis/tours/${tour}/live`),
};

// =============================================================================
// AFFILIATE (user)
// =============================================================================

export const affiliate = {
  /** GET /api/affiliate/stats */
  getStats: () =>
    http.get<ApiResponse<AffiliateStatsDTO>>("/api/affiliate/stats"),

  /** GET /api/affiliate/balance */
  getBalance: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/affiliate/balance"),

  /** GET /api/affiliate/referred-users */
  getReferredUsers: () =>
    http.get<ApiResponse<ReferredUserDTO[]>>("/api/affiliate/referred-users"),

  /** GET /api/affiliate/links */
  getLinks: () =>
    http.get<ApiResponse<ReferralLink[]>>("/api/affiliate/links"),

  /** POST /api/affiliate/links */
  createLink: (body: CreateLinkRequest) =>
    http.post<ApiResponse<ReferralLink>>("/api/affiliate/links", body),

  /** GET /api/affiliate/withdrawals */
  getWithdrawals: (page = 0, size = 20) =>
    http.get<ApiResponse<PageResponse<AffiliateWithdrawalRequest>>>(
      `/api/affiliate/withdrawals${qs({ page, size })}`
    ),

  /** POST /api/affiliate/withdraw */
  requestWithdrawal: (body: WithdrawalRequestDTO) =>
    http.post<ApiResponse<AffiliateWithdrawalRequest>>("/api/affiliate/withdraw", body),
};

// =============================================================================
// ADMIN — MATCHES
// =============================================================================

export const adminMatches = {
  /** GET /api/admin/matches */
  list: () =>
    http.get<ApiResponse<Match[]>>("/api/admin/matches"),

  /** POST /api/admin/matches */
  create: (body: AdminMatchRequest) =>
    http.post<ApiResponse<Match>>("/api/admin/matches", body),

  /** GET /api/admin/matches/:id */
  getById: (id: string) =>
    http.get<ApiResponse<Match>>(`/api/admin/matches/${id}`),

  /** PATCH /api/admin/matches/:id/status */
  updateStatus: (id: string, body: AdminStatusUpdateRequest) =>
    http.patch<ApiResponse<Match>>(`/api/admin/matches/${id}/status`, body),

  /** PATCH /api/admin/matches/:id/score */
  updateScore: (id: string, body: AdminScoreUpdateRequest) =>
    http.patch<ApiResponse<Match>>(`/api/admin/matches/${id}/score`, body),
};

// =============================================================================
// ADMIN — PREDICTIONS
// =============================================================================

export const adminPredictions = {
  /** GET /api/admin/predictions */
  list: (page = 0, size = 20) =>
    http.get<ApiResponse<PageResponse<AiPrediction>>>(
      `/api/admin/predictions${qs({ page, size })}`
    ),

  /** POST /api/admin/predictions/run */
  run: (body: Record<string, string>) =>
    http.post<ApiResponse<AiPrediction>>("/api/admin/predictions/run", body),

  /** POST /api/admin/predictions/:id/share */
  share: (id: string) =>
    http.post<ApiResponse<AiPrediction>>(`/api/admin/predictions/${id}/share`),

  /** POST /api/admin/predictions/:id/unpublish */
  unpublish: (id: string) =>
    http.post<ApiResponse<AiPrediction>>(`/api/admin/predictions/${id}/unpublish`),
};

// =============================================================================
// ADMIN — CRASH GAME SCHEDULE
// =============================================================================

export const adminCrash = {
  /** GET /api/admin/crash/schedule/:game */
  schedule: (game: string, limit = 10) =>
    http.get<ApiResponse<GameCrashSchedule[]>>(
      `/api/admin/crash/schedule/${game}${qs({ limit })}`
    ),

  /** POST /api/admin/crash/schedule/:game/generate */
  generate: (game: string) =>
    http.post<ApiResponse<void>>(`/api/admin/crash/schedule/${game}/generate`),

  /** PATCH /api/admin/crash/schedule/:id/override */
  override: (id: string, body: Record<string, unknown>) =>
    http.patch<ApiResponse<GameCrashSchedule>>(`/api/admin/crash/schedule/${id}/override`, body),

  /** GET /api/admin/crash/history/:game */
  history: (game: string, page = 0, size = 50) =>
    http.get<ApiResponse<PageResponse<GameCrashSchedule>>>(
      `/api/admin/crash/history/${game}${qs({ page, size })}`
    ),
};

// =============================================================================
// ADMIN — AFFILIATE
// =============================================================================
export const adminAffiliate = {
  /** GET /api/admin/affiliate/stats */
  getStats: () =>
    http.get<ApiResponse<AdminAffiliateStatsDTO>>("/api/admin/affiliate/stats"),
  /** GET /api/admin/affiliate/referred-users */
  getReferredUsers: () =>
    http.get<ApiResponse<ReferredUserDTO[]>>("/api/admin/affiliate/referred-users"),
  /** GET /api/admin/affiliate/links */
  getLinks: () =>
    http.get<ApiResponse<ReferralLink[]>>("/api/admin/affiliate/links"),
  /** POST /api/admin/affiliate/links */
  createLink: (body: CreateLinkRequest) =>
    http.post<ApiResponse<ReferralLink>>("/api/admin/affiliate/links", body),
  /** GET /api/admin/affiliate/payout-window */
  getPayoutWindow: () =>
    http.get<ApiResponse<Record<string, boolean>>>("/api/admin/affiliate/payout-window"),
  /** POST /api/admin/affiliate/payout-request */
  requestPayout: () =>
    http.post<ApiResponse<PayoutRequest>>("/api/admin/affiliate/payout-request"),
  /** GET /api/admin/affiliate/payout-requests */
  getPayoutHistory: (page = 0, size = 20) =>
    http.get<ApiResponse<PageResponse<PayoutRequest>>>(
      `/api/admin/affiliate/payout-requests${qs({ page, size })}`
    ),
};
// =============================================================================
// ADMIN — REFERRAL LINKS
// =============================================================================

export const adminReferralLinks = {
  /** GET /api/admin/referral-links */
  list: () =>
    http.get<ApiResponse<ReferralLink[]>>("/api/admin/referral-links"),

  /** POST /api/admin/referral-links */
  create: (body: Record<string, unknown>) =>
    http.post<ApiResponse<ReferralLink>>("/api/admin/referral-links", body),

  /** GET /api/admin/referred-users */
  getReferredUsers: () =>
    http.get<ApiResponse<ReferredUserDTO[]>>("/api/admin/referred-users"),
};

// =============================================================================
// ADMIN — ANALYTICS & AUDIT
// =============================================================================

export const adminAnalytics = {
  /** GET /api/admin/analytics */
  get: (range = "7d") =>
    http.get<ApiResponse<Record<string, unknown>>>(`/api/admin/analytics${qs({ range })}`),

  /** GET /api/admin/audit-log */
  auditLog: (page = 0, size = 50) =>
    http.get<ApiResponse<PageResponse<AuditLog>>>(
      `/api/admin/audit-log${qs({ page, size })}`
    ),
};

// =============================================================================
// ADMIN UPGRADE CHATS (user-facing)
// =============================================================================

export const upgradeChats = {
  /** GET /api/upgrade-chats/:chatId/messages */
  getMessages: (chatId: string) =>
    http.get<ApiResponse<AdminUpgradeChatMessageDto[]>>(`/api/upgrade-chats/${chatId}/messages`),

  /** POST /api/upgrade-chats/:chatId/messages */
  sendMessage: (chatId: string, body: SendMessageRequest) =>
    http.post<ApiResponse<AdminUpgradeChatMessageDto>>(`/api/upgrade-chats/${chatId}/messages`, body),
};

// =============================================================================
// ADMIN UPGRADE — PAYSTACK INIT
// =============================================================================

export const adminUpgrade = {
  /** POST /api/user/upgrade-to-admin/paystack/init */
  initPaystack: () =>
    http.post<ApiResponse<Record<string, unknown>>>("/api/user/upgrade-to-admin/paystack/init"),
};

// =============================================================================
// SUPER ADMIN — UPGRADE CHATS
// =============================================================================

export const superAdminUpgradeChats = {
  /** GET /api/super-admin/upgrade-chats */
  getAll: () =>
    http.get<ApiResponse<AdminUpgradeChatDto[]>>("/api/super-admin/upgrade-chats"),

  /** GET /api/super-admin/upgrade-chats/pending */
  getPending: () =>
    http.get<ApiResponse<AdminUpgradeChatDto[]>>("/api/super-admin/upgrade-chats/pending"),

  /** GET /api/super-admin/upgrade-chats/:chatId/messages */
  getMessages: (chatId: string) =>
    http.get<ApiResponse<AdminUpgradeChatMessageDto[]>>(`/api/super-admin/upgrade-chats/${chatId}/messages`),

  /** POST /api/super-admin/upgrade-chats/:chatId/messages */
  sendMessage: (chatId: string, body: SendMessageRequest) =>
    http.post<ApiResponse<AdminUpgradeChatMessageDto>>(`/api/super-admin/upgrade-chats/${chatId}/messages`, body),

  /** POST /api/super-admin/upgrade-chats/:chatId/set-commission */
  setCommission: (chatId: string, body: SetCommissionRequest) =>
    http.post<ApiResponse<AdminUpgradeChatDto>>(`/api/super-admin/upgrade-chats/${chatId}/set-commission`, body),
};

// =============================================================================
// SUPER ADMIN — PAYOUT REQUESTS
// =============================================================================

export const superAdminPayouts = {
  /** GET /api/super-admin/payout-requests */
  getPending: () =>
    http.get<ApiResponse<PayoutRequest[]>>("/api/super-admin/payout-requests"),

  /** POST /api/super-admin/payout-requests/:id/approve */
  approve: (id: string) =>
    http.post<ApiResponse<PayoutRequest>>(`/api/super-admin/payout-requests/${id}/approve`),

  /** POST /api/super-admin/payout-requests/:id/reject */
  reject: (id: string, body: Record<string, string>) =>
    http.post<ApiResponse<PayoutRequest>>(`/api/super-admin/payout-requests/${id}/reject`, body),

  /** POST /api/super-admin/payout-requests/:id/mark-paid */
  markPaid: (id: string) =>
    http.post<ApiResponse<PayoutRequest>>(`/api/super-admin/payout-requests/${id}/mark-paid`),
};

// =============================================================================
// SUPER ADMIN — AFFILIATE WITHDRAWALS
// =============================================================================

export const superAdminAffiliateWithdrawals = {
  /** GET /api/super-admin/affiliate-withdrawals/pending */
  getPending: () =>
    http.get<ApiResponse<AffiliateWithdrawalRequest[]>>("/api/super-admin/affiliate-withdrawals/pending"),

  /** GET /api/super-admin/affiliate-withdrawals (paginated with optional status filter) */
  list: (page = 0, size = 20, status?: AffiliateWithdrawalStatus) =>
    http.get<ApiResponse<PageResponse<AffiliateWithdrawalRequest>>>(
      `/api/super-admin/affiliate-withdrawals${qs({ page, size, status })}`
    ),

  /** POST /api/super-admin/affiliate-withdrawals/:id/process */
  process: (id: string) =>
    http.post<ApiResponse<AffiliateWithdrawalRequest>>(`/api/super-admin/affiliate-withdrawals/${id}/process`),

  /** POST /api/super-admin/affiliate-withdrawals/:id/reject */
  reject: (id: string, body: Record<string, string>) =>
    http.post<ApiResponse<AffiliateWithdrawalRequest>>(`/api/super-admin/affiliate-withdrawals/${id}/reject`, body),
};

// =============================================================================
// SUPER ADMIN — ADMINS, USERS, METRICS, TRANSACTIONS, AUDIT
// =============================================================================

export const superAdmin = {
  /** GET /api/super-admin/admins */
  listAdmins: () =>
    http.get<ApiResponse<User[]>>("/api/super-admin/admins"),

  /** POST /api/super-admin/admins */
  createAdmin: (body: Record<string, string>) =>
    http.post<ApiResponse<User>>("/api/super-admin/admins", body),

  /** GET /api/super-admin/admins/:adminId */
  getAdminDetail: (adminId: string) =>
    http.get<ApiResponse<AdminDetailDto>>(`/api/super-admin/admins/${adminId}`),

  /** GET /api/super-admin/users */
  listUsers: (page = 0, size = 20, search?: string, role?: UserRole) =>
    http.get<ApiResponse<PageResponse<UserSummaryDto>>>(
      `/api/super-admin/users${qs({ page, size, search, role })}`
    ),

  /** GET /api/super-admin/users/:userId */
  getUserDetail: (userId: string) =>
    http.get<ApiResponse<UserDetailDto>>(`/api/super-admin/users/${userId}`),

  /** GET /api/super-admin/metrics */
  metrics: () =>
    http.get<ApiResponse<Record<string, unknown>>>("/api/super-admin/metrics"),

  /** GET /api/super-admin/metrics/deposits */
  depositMetrics: () =>
    http.get<ApiResponse<RevenueOverviewDto>>("/api/super-admin/metrics/deposits"),

  /** GET /api/super-admin/transactions */
  listTransactions: (
    page = 0,
    size = 50,
    kind?: TransactionKind,
    status?: string,
    walletId?: string,
    from?: string,
    to?: string
  ) =>
    http.get<ApiResponse<PageResponse<TransactionDto>>>(
      `/api/super-admin/transactions${qs({ page, size, kind, status, walletId, from, to })}`
    ),

  /** GET /api/super-admin/audit-log */
  auditLog: (page = 0, size = 50) =>
    http.get<ApiResponse<PageResponse<AuditLog>>>(
      `/api/super-admin/audit-log${qs({ page, size })}`
    ),

  /** GET /api/super-admin/predictions */
  predictions: (page = 0, size = 50) =>
    http.get<ApiResponse<PageResponse<AiPrediction>>>(
      `/api/super-admin/predictions${qs({ page, size })}`
    ),
};

// =============================================================================
// Default export — all namespaces bundled
// =============================================================================

const api = {
  auth,
  user,
  wallet,
  withdrawals,
  deposits,
  webhooks,
  bets,
  games,
  booking,
  adminBooking,
  geo,
  // Public sports
  publicFootball,
  publicFootballLeagues,
  publicFootballCups,
  publicFootballTeams,
  publicFootballStandings,
  publicFootballScorers,
  publicFootballLivescore,
  publicBasketball,
  publicNfl,
  publicBaseball,
  publicMma,
  publicTennis,
  publicAdminMatches,
  publicConfig,
  publicPredictions,
  // Authenticated sports
  matches,
  livescore,
  standings,
  scorers,
  teams,
  leagues,
  cups,
  nba,
  nfl,
  baseball,
  mma,
  tennis,
  // Admin
  affiliate,
  adminMatches,
  adminPredictions,
  adminCrash,
  adminAffiliate,
  adminReferralLinks,
  adminAnalytics,
  upgradeChats,
  adminUpgrade,
  superAdminUpgradeChats,
  superAdminPayouts,
  superAdminAffiliateWithdrawals,
  superAdmin,
};

export default api;
