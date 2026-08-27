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
  account: router({
    balanceSummary: protectedProcedure.query(({ ctx }) => db.getAccountBalanceSummary(ctx.user.id)),
  }),
  payments: paymentReviewRouter,
  paymentReview: paymentReviewAdminRouter,
  commissions: commissionRouter,
  adminManagement: adminManagementRouter,
});

export type AppRouter = typeof appRouter;
