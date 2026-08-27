import { and, desc, eq, like, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { alias } from "drizzle-orm/pg-core";
import {
  accountBalanceSummaries,
  accountPaymentControls,
  adminAuditEvents,
  bonusPolicyOverrides,
  bonusPolicyRules,
  customerCredentials,
  customerSessions,
  InsertUser,
  localAdminCredentials,
  paymentMethodConfigs,
  paymentRequestEvents,
  paymentRequests,
  referralCommissionOverrides,
  referralCommissionRules,
  referralRewardOverrides,
  referralRewardRules,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _sql = postgres(process.env.DATABASE_URL, { max: 5, prepare: false });
      _db = drizzle(_sql);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createCustomerWithCredentials(input: {
  email: string;
  phone: string;
  passwordHash: string;
  name?: string;
}) {
  const db = await getDb();
  if (!db) return undefined;
  return db.transaction(async tx => {
    const openId = `customer:${randomUUID()}`;
    const inserted = await tx.insert(users).values({
      openId,
      name: input.name || null,
      email: input.email,
      loginMethod: "password",
      role: "user",
      lastSignedIn: new Date(),
    }).returning({ id: users.id });
    const userId = inserted[0].id;
    await tx.insert(customerCredentials).values({
      userId,
      email: input.email,
      phone: input.phone,
      passwordHash: input.passwordHash,
    });
    const created = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    return created[0];
  });
}

export async function getCustomerCredentialByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ credential: customerCredentials, user: users })
    .from(customerCredentials)
    .innerJoin(users, eq(customerCredentials.userId, users.id))
    .where(eq(customerCredentials.email, email))
    .limit(1);
  return result[0];
}

export async function getCustomerCredentialByPhone(phone: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ credential: customerCredentials, user: users })
    .from(customerCredentials)
    .innerJoin(users, eq(customerCredentials.userId, users.id))
    .where(eq(customerCredentials.phone, phone))
    .limit(1);
  return result[0];
}

export async function createCustomerSession(input: { userId: number; tokenHash: string; expiresAt: Date }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(customerSessions).values(input);
}

export async function getCustomerSessionUser(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ session: customerSessions, user: users })
    .from(customerSessions)
    .innerJoin(users, eq(customerSessions.userId, users.id))
    .where(eq(customerSessions.tokenHash, tokenHash))
    .limit(1);
  const record = result[0];
  if (!record || record.session.expiresAt.getTime() <= Date.now()) {
    if (record) await db.delete(customerSessions).where(eq(customerSessions.id, record.session.id));
    return undefined;
  }
  return record.user;
}

export async function deleteCustomerSession(tokenHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(customerSessions).where(eq(customerSessions.tokenHash, tokenHash));
}

export async function getLocalAdminCredentialByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ credential: localAdminCredentials, user: users })
    .from(localAdminCredentials)
    .innerJoin(users, eq(localAdminCredentials.userId, users.id))
    .where(eq(localAdminCredentials.email, email))
    .limit(1);
  return result[0];
}

export async function bootstrapLocalAdminCredential(input: {
  email: string;
  passwordHash: string;
  openId: string;
}) {
  const db = await getDb();
  if (!db) return undefined;
  return db.transaction(async tx => {
    const existing = await tx
      .select({ credential: localAdminCredentials, user: users })
      .from(localAdminCredentials)
      .innerJoin(users, eq(localAdminCredentials.userId, users.id))
      .where(eq(localAdminCredentials.email, input.email))
      .limit(1);
    if (existing[0]) return existing[0];

    const insertUser = await tx.insert(users).values({
      openId: input.openId,
      name: "SKYBET administrator",
      email: input.email,
      loginMethod: "password",
      role: "admin",
      lastSignedIn: new Date(),
    }).returning({ id: users.id });
    const userId = insertUser[0].id;
    await tx.insert(localAdminCredentials).values({ userId, email: input.email, passwordHash: input.passwordHash });
    const created = await tx
      .select({ credential: localAdminCredentials, user: users })
      .from(localAdminCredentials)
      .innerJoin(users, eq(localAdminCredentials.userId, users.id))
      .where(eq(localAdminCredentials.userId, userId))
      .limit(1);
    return created[0];
  });
}

export async function updateLocalAdminCredentialPassword(input: { userId: number; passwordHash: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(localAdminCredentials).set({ passwordHash: input.passwordHash }).where(eq(localAdminCredentials.userId, input.userId));
}

export async function recordLocalAdminSignIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function getActiveReferralRewardRule() {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(referralRewardRules)
    .where(eq(referralRewardRules.status, "active"))
    .orderBy(desc(referralRewardRules.effectiveAt), desc(referralRewardRules.id))
    .limit(1);

  return result[0];
}

type ReferralRuleInput = {
  amount: number;
  currency: string;
  reason: string;
  actorUserId: number;
};

export async function saveReferralRewardRule(input: ReferralRuleInput) {
  const db = await getDb();
  if (!db) return undefined;

  return db.transaction(async tx => {
    const current = await tx
      .select()
      .from(referralRewardRules)
      .where(eq(referralRewardRules.status, "active"))
      .orderBy(desc(referralRewardRules.effectiveAt), desc(referralRewardRules.id))
      .limit(1);
    const previousRule = current[0];

    if (previousRule) {
      await tx
        .update(referralRewardRules)
        .set({ status: "superseded" })
        .where(eq(referralRewardRules.id, previousRule.id));
    }

    const insertResult = await tx.insert(referralRewardRules).values({
      amount: input.amount.toFixed(2),
      currency: input.currency,
      reason: input.reason,
      createdBy: input.actorUserId,
    }).returning({ id: referralRewardRules.id });
    const ruleId = insertResult[0].id;

    await tx.insert(adminAuditEvents).values({
      actorUserId: input.actorUserId,
      entityType: "referral_reward_rule",
      entityId: ruleId,
      action: "created",
      beforeJson: previousRule ? JSON.stringify(previousRule) : null,
      afterJson: JSON.stringify({ amount: input.amount, currency: input.currency, reason: input.reason }),
    });

    const created = await tx
      .select()
      .from(referralRewardRules)
      .where(eq(referralRewardRules.id, ruleId))
      .limit(1);

    return created[0];
  });
}

type ReferralOverrideInput = ReferralRuleInput & {
  userId: number;
};

export async function saveReferralRewardOverride(input: ReferralOverrideInput) {
  const db = await getDb();
  if (!db) return undefined;

  return db.transaction(async tx => {
    const targetUser = await tx.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!targetUser[0]) {
      throw new Error("Customer not found");
    }

    const current = await tx
      .select()
      .from(referralRewardOverrides)
      .where(and(eq(referralRewardOverrides.userId, input.userId), eq(referralRewardOverrides.status, "active")))
      .orderBy(desc(referralRewardOverrides.effectiveAt), desc(referralRewardOverrides.id))
      .limit(1);
    const previousOverride = current[0];

    if (previousOverride) {
      await tx
        .update(referralRewardOverrides)
        .set({ status: "superseded" })
        .where(eq(referralRewardOverrides.id, previousOverride.id));
    }

    const insertResult = await tx.insert(referralRewardOverrides).values({
      userId: input.userId,
      amount: input.amount.toFixed(2),
      currency: input.currency,
      reason: input.reason,
      createdBy: input.actorUserId,
    }).returning({ id: referralRewardOverrides.id });
    const overrideId = insertResult[0].id;

    await tx.insert(adminAuditEvents).values({
      actorUserId: input.actorUserId,
      entityType: "referral_reward_override",
      entityId: overrideId,
      action: "created",
      beforeJson: previousOverride ? JSON.stringify(previousOverride) : null,
      afterJson: JSON.stringify({ userId: input.userId, amount: input.amount, currency: input.currency, reason: input.reason }),
    });

    const created = await tx
      .select()
      .from(referralRewardOverrides)
      .where(eq(referralRewardOverrides.id, overrideId))
      .limit(1);

    return created[0];
  });
}

export async function getActiveReferralRewardOverride(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(referralRewardOverrides)
    .where(and(eq(referralRewardOverrides.userId, userId), eq(referralRewardOverrides.status, "active")))
    .orderBy(desc(referralRewardOverrides.effectiveAt), desc(referralRewardOverrides.id))
    .limit(1);

  return result[0];
}

type BonusPolicyInput = {
  referralCommissionAmount: number;
  depositBonusAmount: number;
  settlementBonusAmount: number;
  currency: string;
  reason: string;
  actorUserId: number;
};

export async function getActiveBonusPolicyRule() {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(bonusPolicyRules)
    .where(eq(bonusPolicyRules.status, "active"))
    .orderBy(desc(bonusPolicyRules.effectiveAt), desc(bonusPolicyRules.id))
    .limit(1);
  return result[0];
}

export async function saveBonusPolicyRule(input: BonusPolicyInput) {
  const db = await getDb();
  if (!db) return undefined;

  return db.transaction(async tx => {
    const current = await tx.select().from(bonusPolicyRules).where(eq(bonusPolicyRules.status, "active")).orderBy(desc(bonusPolicyRules.effectiveAt), desc(bonusPolicyRules.id)).limit(1);
    const previous = current[0];
    if (previous) await tx.update(bonusPolicyRules).set({ status: "superseded" }).where(eq(bonusPolicyRules.id, previous.id));

    const insertResult = await tx.insert(bonusPolicyRules).values({
      currency: input.currency,
      referralCommissionAmount: input.referralCommissionAmount.toFixed(2),
      depositBonusAmount: input.depositBonusAmount.toFixed(2),
      settlementBonusAmount: input.settlementBonusAmount.toFixed(2),
      reason: input.reason,
      createdBy: input.actorUserId,
    }).returning({ id: bonusPolicyRules.id });
    const policyId = insertResult[0].id;
    const afterJson = JSON.stringify({ ...input, actorUserId: undefined });
    await tx.insert(adminAuditEvents).values({ actorUserId: input.actorUserId, entityType: "bonus_policy_rule", entityId: policyId, action: "created", beforeJson: previous ? JSON.stringify(previous) : null, afterJson });
    return (await tx.select().from(bonusPolicyRules).where(eq(bonusPolicyRules.id, policyId)).limit(1))[0];
  });
}

type BonusPolicyOverrideInput = BonusPolicyInput & { userId: number };

export async function getActiveBonusPolicyOverride(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(bonusPolicyOverrides).where(and(eq(bonusPolicyOverrides.userId, userId), eq(bonusPolicyOverrides.status, "active"))).orderBy(desc(bonusPolicyOverrides.effectiveAt), desc(bonusPolicyOverrides.id)).limit(1);
  return result[0];
}

export async function saveBonusPolicyOverride(input: BonusPolicyOverrideInput) {
  const db = await getDb();
  if (!db) return undefined;

  return db.transaction(async tx => {
    const target = await tx.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!target[0]) throw new Error("Customer not found");
    const current = await tx.select().from(bonusPolicyOverrides).where(and(eq(bonusPolicyOverrides.userId, input.userId), eq(bonusPolicyOverrides.status, "active"))).orderBy(desc(bonusPolicyOverrides.effectiveAt), desc(bonusPolicyOverrides.id)).limit(1);
    const previous = current[0];
    if (previous) await tx.update(bonusPolicyOverrides).set({ status: "superseded" }).where(eq(bonusPolicyOverrides.id, previous.id));

    const insertResult = await tx.insert(bonusPolicyOverrides).values({
      userId: input.userId,
      currency: input.currency,
      referralCommissionAmount: input.referralCommissionAmount.toFixed(2),
      depositBonusAmount: input.depositBonusAmount.toFixed(2),
      settlementBonusAmount: input.settlementBonusAmount.toFixed(2),
      reason: input.reason,
      createdBy: input.actorUserId,
    }).returning({ id: bonusPolicyOverrides.id });
    const overrideId = insertResult[0].id;
    const afterJson = JSON.stringify({ ...input, actorUserId: undefined });
    await tx.insert(adminAuditEvents).values({ actorUserId: input.actorUserId, entityType: "bonus_policy_override", entityId: overrideId, action: "created", beforeJson: previous ? JSON.stringify(previous) : null, afterJson });
    return (await tx.select().from(bonusPolicyOverrides).where(eq(bonusPolicyOverrides.id, overrideId)).limit(1))[0];
  });
}

export async function getAccountBalanceSummary(userId: number) {
  const db = await getDb();
  if (!db) return { userId, currency: "GHS", depositedBalance: "0.00", bonusBalance: "0.00", source: "unconfigured" as const };
  const result = await db.select().from(accountBalanceSummaries).where(eq(accountBalanceSummaries.userId, userId)).limit(1);
  const summary = result[0];
  return summary ? { ...summary, source: "persisted" as const } : { userId, currency: "GHS", depositedBalance: "0.00", bonusBalance: "0.00", source: "unconfigured" as const };
}

export async function searchSkybetUsers(input: { query: string; role: "all" | "user" | "admin" }) {
  const db = await getDb();
  if (!db) return [];

  const filters = [];
  if (input.role !== "all") {
    filters.push(eq(users.role, input.role));
  }
  if (input.query) {
    const term = `%${input.query}%`;
    filters.push(or(like(users.name, term), like(users.email, term), like(users.openId, term)));
  }

  const query = db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, openId: users.openId, lastSignedIn: users.lastSignedIn })
    .from(users)
    .orderBy(desc(users.lastSignedIn))
    .limit(50);

  return filters.length > 0 ? query.where(and(...filters)) : query;
}

export async function getPaymentMethods(includeDisabled = false) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(paymentMethodConfigs).orderBy(paymentMethodConfigs.id);
  return includeDisabled ? query : query.where(eq(paymentMethodConfigs.status, "enabled"));
}

export async function getAccountPaymentControl(userId: number) {
  const db = await getDb();
  if (!db) return { userId, status: "active" as const, reason: "" };
  const result = await db.select().from(accountPaymentControls).where(eq(accountPaymentControls.userId, userId)).limit(1);
  return result[0] ?? { userId, status: "active" as const, reason: "" };
}

async function assertAccountCanSubmitPayment(tx: any, userId: number) {
  const control = await tx.select().from(accountPaymentControls).where(eq(accountPaymentControls.userId, userId)).limit(1);
  if (control[0]?.status === "held") throw new Error("Payment requests are currently held for this account.");
}

async function assertMethodEnabled(tx: any, method: "crypto_trc20" | "aquapay") {
  const configured = await tx.select().from(paymentMethodConfigs).where(eq(paymentMethodConfigs.method, method)).limit(1);
  if (!configured[0] || configured[0].status !== "enabled") throw new Error("The selected payment method is not available.");
}

type DepositRequestInput = {
  userId: number;
  method: "crypto_trc20" | "aquapay";
  amount: number;
  publicReference: string;
  customerPaymentReference: string;
  proofStorageKey: string;
  proofMimeType: string;
};

export async function createDepositRequest(input: DepositRequestInput) {
  const db = await getDb();
  if (!db) return undefined;
  return db.transaction(async tx => {
    await assertAccountCanSubmitPayment(tx, input.userId);
    await assertMethodEnabled(tx, input.method);
    const inserted = await tx.insert(paymentRequests).values({
      publicReference: input.publicReference,
      userId: input.userId,
      requestType: "deposit",
      method: input.method,
      currency: "GHS",
      amount: input.amount.toFixed(2),
      customerPaymentReference: input.customerPaymentReference,
      proofStorageKey: input.proofStorageKey,
      proofMimeType: input.proofMimeType,
    }).returning({ id: paymentRequests.id });
    const requestId = inserted[0].id;
    await tx.insert(paymentRequestEvents).values({ paymentRequestId: requestId, actorUserId: input.userId, actorRole: "customer", action: "submitted", detailsJson: JSON.stringify({ requestType: "deposit", method: input.method, amount: input.amount, currency: "GHS" }) });
    return (await tx.select().from(paymentRequests).where(eq(paymentRequests.id, requestId)).limit(1))[0];
  });
}

type WithdrawalRequestInput = {
  userId: number;
  amount: number;
  publicReference: string;
  mobileMoneyNumber: string;
};

export async function createWithdrawalRequest(input: WithdrawalRequestInput) {
  const db = await getDb();
  if (!db) return undefined;
  return db.transaction(async tx => {
    await assertAccountCanSubmitPayment(tx, input.userId);
    const inserted = await tx.insert(paymentRequests).values({
      publicReference: input.publicReference,
      userId: input.userId,
      requestType: "withdrawal",
      method: "aquapay",
      currency: "GHS",
      amount: input.amount.toFixed(2),
      payoutDestination: input.mobileMoneyNumber,
    }).returning({ id: paymentRequests.id });
    const requestId = inserted[0].id;
    await tx.insert(paymentRequestEvents).values({ paymentRequestId: requestId, actorUserId: input.userId, actorRole: "customer", action: "submitted", detailsJson: JSON.stringify({ requestType: "withdrawal", channel: "mobile_money", amount: input.amount, currency: "GHS" }) });
    return (await tx.select().from(paymentRequests).where(eq(paymentRequests.id, requestId)).limit(1))[0];
  });
}

export async function getCustomerPaymentRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(paymentRequests).where(eq(paymentRequests.userId, userId)).orderBy(desc(paymentRequests.createdAt), desc(paymentRequests.id)).limit(50);
}

export async function getAdminPaymentRequests(status: "all" | "submitted" | "under_review" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) return [];
  const reviewer = alias(users, "payment_reviewer");
  const query = db.select({ request: paymentRequests, user: { id: users.id, name: users.name, email: users.email }, reviewer: { id: reviewer.id, name: reviewer.name, email: reviewer.email } }).from(paymentRequests).innerJoin(users, eq(paymentRequests.userId, users.id)).leftJoin(reviewer, eq(paymentRequests.reviewedBy, reviewer.id)).orderBy(desc(paymentRequests.createdAt), desc(paymentRequests.id)).limit(100);
  return status === "all" ? query : query.where(eq(paymentRequests.status, status));
}

export async function reviewPaymentRequest(input: { requestId: number; actorUserId: number; decision: "approved" | "rejected"; reason: string }) {
  const db = await getDb();
  if (!db) return undefined;
  return db.transaction(async tx => {
    const current = await tx.select().from(paymentRequests).where(eq(paymentRequests.id, input.requestId)).limit(1);
    const request = current[0];
    if (!request) throw new Error("Payment request not found");
    if (request.userId === input.actorUserId) throw new Error("Administrators cannot review their own payment request");
    if (request.status !== "submitted" && request.status !== "under_review") throw new Error("Only submitted payment requests can be reviewed");

    await tx.update(paymentRequests).set({ status: input.decision, reviewReason: input.reason, reviewedBy: input.actorUserId, reviewedAt: new Date() }).where(eq(paymentRequests.id, request.id));
    await tx.insert(paymentRequestEvents).values({ paymentRequestId: request.id, actorUserId: input.actorUserId, actorRole: "admin", action: input.decision, detailsJson: JSON.stringify({ reason: input.reason, ledgerEffect: "none" }) });
    await tx.insert(adminAuditEvents).values({ actorUserId: input.actorUserId, entityType: "payment_request", entityId: request.id, action: input.decision, beforeJson: JSON.stringify({ status: request.status }), afterJson: JSON.stringify({ status: input.decision, reason: input.reason, ledgerEffect: "none" }) });
    return (await tx.select().from(paymentRequests).where(eq(paymentRequests.id, request.id)).limit(1))[0];
  });
}

export async function setAccountPaymentControl(input: { userId: number; status: "active" | "held"; reason: string; actorUserId: number }) {
  const db = await getDb();
  if (!db) return undefined;
  return db.transaction(async tx => {
    const customer = await tx.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!customer[0]) throw new Error("Customer not found");
    const existing = await tx.select().from(accountPaymentControls).where(eq(accountPaymentControls.userId, input.userId)).limit(1);
    if (existing[0]) {
      await tx.update(accountPaymentControls).set({ status: input.status, reason: input.reason, updatedBy: input.actorUserId }).where(eq(accountPaymentControls.id, existing[0].id));
    } else {
      await tx.insert(accountPaymentControls).values({ userId: input.userId, status: input.status, reason: input.reason, updatedBy: input.actorUserId });
    }
    await tx.insert(adminAuditEvents).values({ actorUserId: input.actorUserId, entityType: "account_payment_control", entityId: input.userId, action: input.status, beforeJson: existing[0] ? JSON.stringify(existing[0]) : null, afterJson: JSON.stringify({ status: input.status, reason: input.reason }) });
    return (await tx.select().from(accountPaymentControls).where(eq(accountPaymentControls.userId, input.userId)).limit(1))[0];
  });
}

type CommissionInput = { percentage: number; reason: string; actorUserId: number };

export async function getActiveReferralCommissionRule() {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(referralCommissionRules).where(eq(referralCommissionRules.status, "active")).orderBy(desc(referralCommissionRules.effectiveAt), desc(referralCommissionRules.id)).limit(1))[0];
}

export async function getActiveReferralCommissionOverride(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(referralCommissionOverrides).where(and(eq(referralCommissionOverrides.userId, userId), eq(referralCommissionOverrides.status, "active"))).orderBy(desc(referralCommissionOverrides.effectiveAt), desc(referralCommissionOverrides.id)).limit(1))[0];
}

export async function saveReferralCommissionRule(input: CommissionInput) {
  const db = await getDb();
  if (!db) return undefined;
  return db.transaction(async tx => {
    const previous = (await tx.select().from(referralCommissionRules).where(eq(referralCommissionRules.status, "active")).orderBy(desc(referralCommissionRules.effectiveAt), desc(referralCommissionRules.id)).limit(1))[0];
    if (previous) await tx.update(referralCommissionRules).set({ status: "superseded" }).where(eq(referralCommissionRules.id, previous.id));
    const inserted = await tx.insert(referralCommissionRules).values({ percentage: input.percentage.toFixed(2), reason: input.reason, createdBy: input.actorUserId }).returning({ id: referralCommissionRules.id });
    const ruleId = inserted[0].id;
    await tx.insert(adminAuditEvents).values({ actorUserId: input.actorUserId, entityType: "referral_commission_rule", entityId: ruleId, action: "created", beforeJson: previous ? JSON.stringify(previous) : null, afterJson: JSON.stringify({ percentage: input.percentage, reason: input.reason }) });
    return (await tx.select().from(referralCommissionRules).where(eq(referralCommissionRules.id, ruleId)).limit(1))[0];
  });
}

export async function saveReferralCommissionOverride(input: CommissionInput & { userId: number }) {
  const db = await getDb();
  if (!db) return undefined;
  return db.transaction(async tx => {
    const customer = await tx.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!customer[0]) throw new Error("Customer not found");
    const previous = (await tx.select().from(referralCommissionOverrides).where(and(eq(referralCommissionOverrides.userId, input.userId), eq(referralCommissionOverrides.status, "active"))).orderBy(desc(referralCommissionOverrides.effectiveAt), desc(referralCommissionOverrides.id)).limit(1))[0];
    if (previous) await tx.update(referralCommissionOverrides).set({ status: "superseded" }).where(eq(referralCommissionOverrides.id, previous.id));
    const inserted = await tx.insert(referralCommissionOverrides).values({ userId: input.userId, percentage: input.percentage.toFixed(2), reason: input.reason, createdBy: input.actorUserId }).returning({ id: referralCommissionOverrides.id });
    const overrideId = inserted[0].id;
    await tx.insert(adminAuditEvents).values({ actorUserId: input.actorUserId, entityType: "referral_commission_override", entityId: overrideId, action: "created", beforeJson: previous ? JSON.stringify(previous) : null, afterJson: JSON.stringify({ userId: input.userId, percentage: input.percentage, reason: input.reason }) });
    return (await tx.select().from(referralCommissionOverrides).where(eq(referralCommissionOverrides.id, overrideId)).limit(1))[0];
  });
}
