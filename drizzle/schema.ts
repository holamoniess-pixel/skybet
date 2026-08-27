import { index, integer, numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const ruleStatusEnum = pgEnum("rule_status", ["active", "superseded"]);
export const paymentMethodEnum = pgEnum("payment_method", ["crypto_trc20", "aquapay"]);
export const paymentMethodStatusEnum = pgEnum("payment_method_status", ["enabled", "disabled"]);
export const paymentRequestTypeEnum = pgEnum("payment_request_type", ["deposit", "withdrawal"]);
export const paymentRequestStatusEnum = pgEnum("payment_request_status", ["submitted", "under_review", "approved", "rejected", "cancelled"]);
export const paymentActorRoleEnum = pgEnum("payment_actor_role", ["customer", "admin"]);
export const accountPaymentStatusEnum = pgEnum("account_payment_status", ["active", "held"]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Password-hash credential record for the single locally managed administrator account. */
export const localAdminCredentials = pgTable("local_admin_credentials", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type LocalAdminCredential = typeof localAdminCredentials.$inferSelect;

/** Server-owned customer email, phone, and password credential record. */
export const customerCredentials = pgTable("customer_credentials", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  phone: varchar("phone", { length: 32 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/** Hashed, expiring first-party customer sessions; raw tokens never persist. */
export const customerSessions = pgTable("customer_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomerCredential = typeof customerCredentials.$inferSelect;
export type CustomerSession = typeof customerSessions.$inferSelect;

/** Versioned, programme-wide referral reward configurations. */
export const referralRewardRules = pgTable("referral_reward_rules", {
  id: serial("id").primaryKey(),
  currency: varchar("currency", { length: 3 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: ruleStatusEnum("status").default("active").notNull(),
  reason: text("reason").notNull(),
  effectiveAt: timestamp("effectiveAt").defaultNow().notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Explicit referral-reward exception for an individual customer. */
export const referralRewardOverrides = pgTable("referral_reward_overrides", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  reason: text("reason").notNull(),
  status: ruleStatusEnum("status").default("active").notNull(),
  effectiveAt: timestamp("effectiveAt").defaultNow().notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Append-only audit record for sensitive administrator operations. */
export const adminAuditEvents = pgTable("admin_audit_events", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actorUserId").notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: integer("entityId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  beforeJson: text("beforeJson"),
  afterJson: text("afterJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReferralRewardRule = typeof referralRewardRules.$inferSelect;
export type ReferralRewardOverride = typeof referralRewardOverrides.$inferSelect;
export type AdminAuditEvent = typeof adminAuditEvents.$inferSelect;

/** Versioned programme-wide policy for credits that belong only in the bonus balance. */
export const bonusPolicyRules = pgTable("bonus_policy_rules", {
  id: serial("id").primaryKey(),
  currency: varchar("currency", { length: 3 }).notNull(),
  referralCommissionAmount: numeric("referralCommissionAmount", { precision: 12, scale: 2 }).notNull(),
  depositBonusAmount: numeric("depositBonusAmount", { precision: 12, scale: 2 }).notNull(),
  settlementBonusAmount: numeric("settlementBonusAmount", { precision: 12, scale: 2 }).notNull(),
  status: ruleStatusEnum("status").default("active").notNull(),
  reason: text("reason").notNull(),
  effectiveAt: timestamp("effectiveAt").defaultNow().notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Audited user-specific exception to a programme-wide bonus policy. */
export const bonusPolicyOverrides = pgTable("bonus_policy_overrides", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  referralCommissionAmount: numeric("referralCommissionAmount", { precision: 12, scale: 2 }).notNull(),
  depositBonusAmount: numeric("depositBonusAmount", { precision: 12, scale: 2 }).notNull(),
  settlementBonusAmount: numeric("settlementBonusAmount", { precision: 12, scale: 2 }).notNull(),
  status: ruleStatusEnum("status").default("active").notNull(),
  reason: text("reason").notNull(),
  effectiveAt: timestamp("effectiveAt").defaultNow().notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Read model that keeps deposited funds distinct from non-withdrawable bonus credits. */
export const accountBalanceSummaries = pgTable("account_balance_summaries", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  currency: varchar("currency", { length: 3 }).notNull(),
  depositedBalance: numeric("depositedBalance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  bonusBalance: numeric("bonusBalance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BonusPolicyRule = typeof bonusPolicyRules.$inferSelect;
export type BonusPolicyOverride = typeof bonusPolicyOverrides.$inferSelect;
export type AccountBalanceSummary = typeof accountBalanceSummaries.$inferSelect;

/** Administrator-managed customer deposit method configuration; gateway credentials remain server-only. */
export const paymentMethodConfigs = pgTable("payment_method_configs", {
  id: serial("id").primaryKey(),
  method: paymentMethodEnum("method").notNull().unique(),
  displayName: varchar("displayName", { length: 100 }).notNull(),
  network: varchar("network", { length: 32 }),
  destination: varchar("destination", { length: 255 }),
  status: paymentMethodStatusEnum("status").default("disabled").notNull(),
  updatedBy: integer("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/** Customer payment or withdrawal request; an approved review is not a money movement. */
export const paymentRequests = pgTable("payment_requests", {
  id: serial("id").primaryKey(),
  publicReference: varchar("publicReference", { length: 48 }).notNull().unique(),
  userId: integer("userId").notNull(),
  requestType: paymentRequestTypeEnum("requestType").notNull(),
  method: paymentMethodEnum("method").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  customerPaymentReference: varchar("customerPaymentReference", { length: 128 }),
  payoutDestination: varchar("payoutDestination", { length: 255 }),
  proofStorageKey: varchar("proofStorageKey", { length: 512 }),
  proofMimeType: varchar("proofMimeType", { length: 100 }),
  proofStorageProvider: varchar("proofStorageProvider", { length: 32 }),
  proofExpiresAt: timestamp("proofExpiresAt"),
  proofDeletedAt: timestamp("proofDeletedAt"),
  status: paymentRequestStatusEnum("status").default("submitted").notNull(),
  reviewReason: text("reviewReason"),
  reviewedBy: integer("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("payment_requests_method_reference_unique").on(table.method, table.customerPaymentReference),
  index("payment_requests_proof_expiry_idx").on(table.proofExpiresAt),
]);

/** Key-free execution record for the daily payment-proof retention process. */
export const proofRetentionRuns = pgTable("proof_retention_runs", {
  id: serial("id").primaryKey(),
  runAt: timestamp("runAt").defaultNow().notNull(),
  cutoffAt: timestamp("cutoffAt").notNull(),
  candidateCount: integer("candidateCount").notNull(),
  deletedCount: integer("deletedCount").notNull(),
  legacyAccessRevokedCount: integer("legacyAccessRevokedCount").notNull(),
  failedCount: integer("failedCount").notNull(),
  status: varchar("status", { length: 24 }).notNull(),
});

/** Append-only lifecycle record for customer submissions and administrator review decisions. */
export const paymentRequestEvents = pgTable("payment_request_events", {
  id: serial("id").primaryKey(),
  paymentRequestId: integer("paymentRequestId").notNull(),
  actorUserId: integer("actorUserId").notNull(),
  actorRole: paymentActorRoleEnum("actorRole").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  detailsJson: text("detailsJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Account-level operational hold used to stop new payment requests pending a documented review. */
export const accountPaymentControls = pgTable("account_payment_controls", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  status: accountPaymentStatusEnum("status").default("active").notNull(),
  reason: text("reason").notNull(),
  updatedBy: integer("updatedBy").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/** Versioned global referral commission percentage, retained separately from legacy fixed reward history. */
export const referralCommissionRules = pgTable("referral_commission_rules", {
  id: serial("id").primaryKey(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  status: ruleStatusEnum("status").default("active").notNull(),
  reason: text("reason").notNull(),
  effectiveAt: timestamp("effectiveAt").defaultNow().notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Versioned customer-specific referral commission percentage override. */
export const referralCommissionOverrides = pgTable("referral_commission_overrides", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  status: ruleStatusEnum("status").default("active").notNull(),
  reason: text("reason").notNull(),
  effectiveAt: timestamp("effectiveAt").defaultNow().notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentMethodConfig = typeof paymentMethodConfigs.$inferSelect;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
export type PaymentRequestEvent = typeof paymentRequestEvents.$inferSelect;
export type AccountPaymentControl = typeof accountPaymentControls.$inferSelect;
export type ReferralCommissionRule = typeof referralCommissionRules.$inferSelect;
export type ReferralCommissionOverride = typeof referralCommissionOverrides.$inferSelect;
