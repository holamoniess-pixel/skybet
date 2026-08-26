import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  accountBalanceSummaries,
  adminAuditEvents,
  bonusPolicyOverrides,
  bonusPolicyRules,
  InsertUser,
  localAdminCredentials,
  referralRewardOverrides,
  referralRewardRules,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
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

    await db.insert(users).values(values).onDuplicateKeyUpdate({
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
    });
    const userId = Number(insertUser[0].insertId);
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
    });
    const ruleId = Number(insertResult[0].insertId);

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
    });
    const overrideId = Number(insertResult[0].insertId);

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
    });
    const policyId = Number(insertResult[0].insertId);
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
    });
    const overrideId = Number(insertResult[0].insertId);
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
