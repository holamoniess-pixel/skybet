import { COOKIE_NAME } from "@shared/const";
import { getMockGamesFeed } from "@shared/mockGamesFeed";
import { validateBonusPolicyAmounts } from "@shared/bonusPolicies";
import { validateReferralRewardAmount } from "@shared/referrals";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { ADMIN_SESSION_COOKIE } from "./localAdminSession";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getSportsDataConnectionStatus } from "./sportsDataAdapter";
import { getAdminMatchFeed, getMatchFeed, getSimulatedMatchFeed } from "./simulatedMatches";
import { espnPreviewClient } from "./espnPreview";
import { commissionRouter, paymentReviewAdminRouter, paymentReviewRouter } from "./routers/paymentReview";
import { adminManagementRouter } from "./routers/adminManagement";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(ADMIN_SESSION_COOKIE, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  games: router({
    mockFeed: publicProcedure.query(() => getMockGamesFeed()),
    simulatedFeed: publicProcedure.query(() => getSimulatedMatchFeed()),
    matchFeed: publicProcedure.query(async () => {
      const persisted = await db.getPersistedCustomerMatchFeed();
      return persisted && persisted.events.length > 0 ? persisted : getMatchFeed();
    }),
  }),
  sportsData: router({
    status: publicProcedure.query(() => getSportsDataConnectionStatus()),
    scoreboard: publicProcedure
      .input(z.object({ league: z.literal("eng.1") }).optional())
      .query(({ input }) => espnPreviewClient.scoreboard(input?.league ?? "eng.1")),
  }),
  referrals: router({
    activeRule: adminProcedure.query(async () => {
      return db.getActiveReferralRewardRule();
    }),
    activeOverride: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return db.getActiveReferralRewardOverride(input.userId);
      }),
    searchUsers: adminProcedure
      .input(z.object({ query: z.string().trim().max(100), role: z.enum(["all", "user", "admin"]) }))
      .query(({ input }) => db.searchSkybetUsers(input)),
    saveDefaultRule: adminProcedure
      .input(z.object({ amount: z.string(), currency: z.literal("GHS"), reason: z.string().trim().min(5).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const validation = validateReferralRewardAmount(input.amount);
        if (!validation.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: validation.reason });
        }

        const rule = await db.saveReferralRewardRule({
          amount: validation.amount,
          currency: input.currency,
          reason: input.reason,
          actorUserId: ctx.user.id,
        });
        if (!rule) {
          throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Referral settings are unavailable. Try again later." });
        }
        return rule;
      }),
    saveUserOverride: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), amount: z.string(), currency: z.literal("GHS"), reason: z.string().trim().min(5).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const validation = validateReferralRewardAmount(input.amount);
        if (!validation.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: validation.reason });
        }

        try {
          const override = await db.saveReferralRewardOverride({
            userId: input.userId,
            amount: validation.amount,
            currency: input.currency,
            reason: input.reason,
            actorUserId: ctx.user.id,
          });
          if (!override) {
            throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Referral settings are unavailable. Try again later." });
          }
          return override;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          if (error instanceof Error && error.message === "Customer not found") {
            throw new TRPCError({ code: "NOT_FOUND", message: "Customer ID was not found." });
          }
          throw error;
        }
      }),
  }),
  bonusPolicies: router({
    activeRule: adminProcedure.query(() => db.getActiveBonusPolicyRule()),
    activeOverride: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => db.getActiveBonusPolicyOverride(input.userId)),
    saveDefaultRule: adminProcedure
      .input(z.object({ referralCommissionAmount: z.string(), depositBonusAmount: z.string(), settlementBonusAmount: z.string(), currency: z.literal("GHS"), reason: z.string().trim().min(5).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const validation = validateBonusPolicyAmounts(input);
        if (!validation.ok) throw new TRPCError({ code: "BAD_REQUEST", message: validation.reason });
        const policy = await db.saveBonusPolicyRule({ ...validation.amounts, currency: input.currency, reason: input.reason, actorUserId: ctx.user.id });
        if (!policy) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Bonus settings are unavailable. Try again later." });
        return policy;
      }),
    saveUserOverride: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), referralCommissionAmount: z.string(), depositBonusAmount: z.string(), settlementBonusAmount: z.string(), currency: z.literal("GHS"), reason: z.string().trim().min(5).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const validation = validateBonusPolicyAmounts(input);
        if (!validation.ok) throw new TRPCError({ code: "BAD_REQUEST", message: validation.reason });
        try {
          const policy = await db.saveBonusPolicyOverride({ ...validation.amounts, userId: input.userId, currency: input.currency, reason: input.reason, actorUserId: ctx.user.id });
          if (!policy) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Bonus settings are unavailable. Try again later." });
          return policy;
        } catch (error) {
          if (error instanceof Error && error.message === "Customer not found") throw new TRPCError({ code: "NOT_FOUND", message: "Customer ID was not found." });
          throw error;
        }
      }),
  }),
  wagers: router({
    place: protectedProcedure
      .input(z.object({ idempotencyKey: z.string().trim().min(16).max(128), stake: z.number().positive().max(100000), selections: z.array(z.object({ eventId: z.string().min(1), label: z.string().min(1).max(160), odds: z.string().regex(/^\d+(?:\.\d{1,4})?$/).refine(value => Number(value) >= 1.02 && Number(value) <= 15, "Odds must be between 1.02 and 15.00") })).min(1).max(20) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.placeSimulationWager({ userId: ctx.user.id, idempotencyKey: input.idempotencyKey, stake: input.stake, selections: input.selections });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unable to place the bet." });
        }
      }),
  }),
  sharedBets: router({
    load: publicProcedure.input(z.object({ code: z.string().trim().min(6).max(48) })).query(({ input }) => db.getSharedBetSlip(input.code)),
    create: protectedProcedure.input(z.object({ source: z.enum(["admin", "user"]), selections: z.array(z.object({ eventId: z.string().min(1), label: z.string().min(1), odds: z.string().regex(/^\d+(?:\.\d{1,4})?$/).refine(value => Number(value) >= 1.02 && Number(value) <= 15, "Odds must be between 1.02 and 15.00") })).min(1).max(20) })).mutation(async ({ ctx, input }) => {
      if (input.source === "admin" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required to create an admin share code." });
      try { return await db.createSharedBetSlip({ creatorUserId: ctx.user.id, source: input.source, selections: input.selections }); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unable to create share code." }); }
    }),
  }),
  account: router({
    balanceSummary: protectedProcedure.query(({ ctx }) => db.getAccountBalanceSummary(ctx.user.id)),
    profile: protectedProcedure.query(({ ctx }) => db.getAccountProfile(ctx.user.id)),
    notifications: protectedProcedure.query(({ ctx }) => db.getNotifications(ctx.user.id)),
    wagers: protectedProcedure.input(z.object({ status: z.enum(["running", "history", "all"]).default("all") })).query(({ ctx, input }) => db.getCustomerWagers(ctx.user.id, input.status)),
    referralProfile: protectedProcedure.query(({ ctx }) => db.getReferralProfile(ctx.user.id)),
  }),
  payments: paymentReviewRouter,
  paymentReview: paymentReviewAdminRouter,
  commissions: commissionRouter,
  adminManagement: adminManagementRouter,
  adminMatches: router({
    feed: adminProcedure.query(() => getAdminMatchFeed()),
    list: adminProcedure.query(() => db.listAdminMatches()),
    create: adminProcedure.input(z.object({
      sport: z.string().trim().min(2).max(48),
      competition: z.string().trim().min(2).max(160),
      homeTeam: z.string().trim().min(2).max(120),
      awayTeam: z.string().trim().min(2).max(120),
      kickoffAt: z.string().datetime(),
      endAt: z.string().datetime().optional(),
      status: z.enum(["scheduled", "live", "completed", "cancelled"]).default("scheduled"),
      homeScore: z.number().int().min(0).max(99).optional(),
      awayScore: z.number().int().min(0).max(99).optional(),
      markets: z.array(z.object({ marketType: z.string().trim().min(2).max(80), options: z.array(z.object({ name: z.string().trim().min(1).max(80), odd: z.number().finite().min(1.02).max(15) })).min(1).max(50) })).min(1).max(20),
    })).mutation(async ({ ctx, input }) => {
      try {
        return await db.createAdminMatch({ ...input, kickoffAt: new Date(input.kickoffAt), endAt: input.endAt ? new Date(input.endAt) : undefined, actorUserId: ctx.user.id });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unable to create match." });
      }
    }),
  }),
  adminBalances: router({
    adjust: adminProcedure.input(z.object({ userId: z.number().int().positive(), currency: z.literal("GHS"), balanceType: z.enum(["deposited", "bonus"]), newBalance: z.preprocess(value => typeof value === "string" ? value.trim().replace(/[₵GH\s,]/gi, "") : value, z.string().regex(/^\d+(?:\.\d{1,2})?$/)), reason: z.string().trim().min(5).max(500), idempotencyKey: z.string().trim().min(16).max(128) })).mutation(async ({ ctx, input }) => {
      try {
        return await db.adjustCustomerBalance({ ...input, actorUserId: ctx.user.id });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unable to adjust balance." });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
