import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  adminAuditEvents,
  InsertUser,
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
