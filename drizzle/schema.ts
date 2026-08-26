import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Password-hash credential record for the single locally managed administrator account. */
export const localAdminCredentials = mysqlTable("local_admin_credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LocalAdminCredential = typeof localAdminCredentials.$inferSelect;

/** Versioned, programme-wide referral reward configurations. */
export const referralRewardRules = mysqlTable("referral_reward_rules", {
  id: int("id").autoincrement().primaryKey(),
  currency: varchar("currency", { length: 3 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["active", "superseded"]).default("active").notNull(),
  reason: text("reason").notNull(),
  effectiveAt: timestamp("effectiveAt").defaultNow().notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Explicit referral-reward exception for an individual customer. */
export const referralRewardOverrides = mysqlTable("referral_reward_overrides", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  reason: text("reason").notNull(),
  status: mysqlEnum("status", ["active", "superseded"]).default("active").notNull(),
  effectiveAt: timestamp("effectiveAt").defaultNow().notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Append-only audit record for sensitive administrator operations. */
export const adminAuditEvents = mysqlTable("admin_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  beforeJson: text("beforeJson"),
  afterJson: text("afterJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReferralRewardRule = typeof referralRewardRules.$inferSelect;
export type ReferralRewardOverride = typeof referralRewardOverrides.$inferSelect;
export type AdminAuditEvent = typeof adminAuditEvents.$inferSelect;

/** Versioned programme-wide policy for credits that belong only in the bonus balance. */
export const bonusPolicyRules = mysqlTable("bonus_policy_rules", {
  id: int("id").autoincrement().primaryKey(),
  currency: varchar("currency", { length: 3 }).notNull(),
  referralCommissionAmount: decimal("referralCommissionAmount", { precision: 12, scale: 2 }).notNull(),
  depositBonusAmount: decimal("depositBonusAmount", { precision: 12, scale: 2 }).notNull(),
  settlementBonusAmount: decimal("settlementBonusAmount", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["active", "superseded"]).default("active").notNull(),
  reason: text("reason").notNull(),
  effectiveAt: timestamp("effectiveAt").defaultNow().notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Audited user-specific exception to a programme-wide bonus policy. */
export const bonusPolicyOverrides = mysqlTable("bonus_policy_overrides", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  referralCommissionAmount: decimal("referralCommissionAmount", { precision: 12, scale: 2 }).notNull(),
  depositBonusAmount: decimal("depositBonusAmount", { precision: 12, scale: 2 }).notNull(),
  settlementBonusAmount: decimal("settlementBonusAmount", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["active", "superseded"]).default("active").notNull(),
  reason: text("reason").notNull(),
  effectiveAt: timestamp("effectiveAt").defaultNow().notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Read model that keeps deposited funds distinct from non-withdrawable bonus credits. */
export const accountBalanceSummaries = mysqlTable("account_balance_summaries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  currency: varchar("currency", { length: 3 }).notNull(),
  depositedBalance: decimal("depositedBalance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  bonusBalance: decimal("bonusBalance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BonusPolicyRule = typeof bonusPolicyRules.$inferSelect;
export type BonusPolicyOverride = typeof bonusPolicyOverrides.$inferSelect;
export type AccountBalanceSummary = typeof accountBalanceSummaries.$inferSelect;
