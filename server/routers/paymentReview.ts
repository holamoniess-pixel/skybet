import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { validateDepositPresetAmount, validateGhanaMobileMoneyNumber, validateReferralCommissionPercentage, validateWithdrawalAmount } from "../../shared/payments";
import { getAquaPayGatewayReadiness, initiateAquaPayPayment } from "../aquaPayGateway";
import * as db from "../db";
import { paymentProofStorageGetSignedUrl, paymentProofStoragePut, storageGetSignedUrl } from "../storage";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const paymentMethodSchema = z.enum(["crypto_trc20", "aquapay"]);
const proofSchema = z.object({ mimeType: z.enum(["image/jpeg", "image/png"]), dataUrl: z.string().max(7_000_000) });

function toPublicError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to process payment request.";
  if (message === "Payment requests are currently held for this account." || message === "The selected payment method is not available.") return message;
  return "Unable to process payment request. Try again later.";
}

async function uploadProof(userId: number, proof: z.infer<typeof proofSchema>) {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(proof.dataUrl);
  if (!match || match[1] !== proof.mimeType) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a PNG or JPEG screenshot." });
  const body = Buffer.from(match[2], "base64");
  if (body.length === 0 || body.length > 5 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "The screenshot must be 5 MB or smaller." });
  const extension = proof.mimeType === "image/png" ? "png" : "jpg";
  return paymentProofStoragePut(`payment-proofs/${userId}/${randomUUID()}.${extension}`, body, proof.mimeType);
}

export const paymentReviewRouter = router({
  methods: protectedProcedure.query(() => db.getPaymentMethods(true)),
  gatewayStatus: protectedProcedure.query(() => getAquaPayGatewayReadiness()),
  myRequests: protectedProcedure.query(({ ctx }) => db.getCustomerPaymentRequests(ctx.user.id)),
  submitDeposit: protectedProcedure
    .input(z.object({ method: paymentMethodSchema, amount: z.string(), customerPaymentReference: z.string().trim().min(3).max(128), proof: proofSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      const validation = validateDepositPresetAmount(input.amount);
      if (!validation.ok) throw new TRPCError({ code: "BAD_REQUEST", message: validation.reason });
      let upload: { key: string } | undefined;
      if (input.proof) {
        try {
          upload = await uploadProof(ctx.user.id, input.proof);
        } catch (error) {
          console.warn("[Payments] Screenshot was not stored; continuing without proof.", error instanceof Error ? error.message : error);
        }
      }
      try {
        const request = await db.createDepositRequest({ userId: ctx.user.id, method: input.method, amount: validation.amount, publicReference: `DEP-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`, customerPaymentReference: input.customerPaymentReference, proofStorageKey: upload?.key, proofMimeType: upload ? input.proof?.mimeType : undefined });
        if (!request) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Payment requests are temporarily unavailable." });
        return request;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "BAD_REQUEST", message: toPublicError(error) });
      }
    }),
  startAquaPayDeposit: protectedProcedure
    .input(z.object({ amount: z.string(), customerPaymentReference: z.string().trim().max(128).optional().default(""), mobileMoneyNumber: z.string().trim().min(9).max(32), network: z.enum(["MTN", "VODAFONE", "AIRTELTIGO"]) }))
    .mutation(async ({ ctx, input }) => {
      const validation = validateDepositPresetAmount(input.amount);
      if (!validation.ok) throw new TRPCError({ code: "BAD_REQUEST", message: validation.reason });
      const mobileMoney = validateGhanaMobileMoneyNumber(input.mobileMoneyNumber);
      if (!mobileMoney.ok) throw new TRPCError({ code: "BAD_REQUEST", message: mobileMoney.reason });
      const publicReference = `DEP-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
      const customerPaymentReference = input.customerPaymentReference.trim() || `AQP-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
      try {
        const request = await db.createDepositRequest({ userId: ctx.user.id, method: "aquapay", amount: validation.amount, publicReference, customerPaymentReference });
        if (!request) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Payment requests are temporarily unavailable." });
        const payment = await initiateAquaPayPayment({ amount: validation.amount, currency: "GHS", reference: publicReference, customerPhone: mobileMoney.number, network: input.network });
        return { request, checkoutUrl: payment.checkoutUrl, providerReference: payment.providerReference };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "BAD_REQUEST", message: toPublicError(error) });
      }
    }),
  submitWithdrawal: protectedProcedure
    .input(z.object({ amount: z.string(), mobileMoneyNumber: z.string().trim().min(9).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const validation = validateWithdrawalAmount(input.amount);
      if (!validation.ok) throw new TRPCError({ code: "BAD_REQUEST", message: validation.reason });
      const mobileMoney = validateGhanaMobileMoneyNumber(input.mobileMoneyNumber);
      if (!mobileMoney.ok) throw new TRPCError({ code: "BAD_REQUEST", message: mobileMoney.reason });
      try {
        const request = await db.createWithdrawalRequest({ userId: ctx.user.id, amount: validation.amount, publicReference: `WDR-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`, mobileMoneyNumber: mobileMoney.number });
        if (!request) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Withdrawal requests are temporarily unavailable." });
        return request;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "BAD_REQUEST", message: toPublicError(error) });
      }
    }),
  proofUrl: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const request = (await db.getCustomerPaymentRequests(ctx.user.id)).find(item => item.id === input.requestId);
    if (!request?.proofStorageKey || request.proofDeletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Payment proof was not found." });
    return { url: request.proofStorageProvider === "legacy_forge" ? await storageGetSignedUrl(request.proofStorageKey) : await paymentProofStorageGetSignedUrl(request.proofStorageKey) };
  }),
});

export const paymentReviewAdminRouter = router({
  queue: adminProcedure.input(z.object({ status: z.enum(["all", "submitted", "under_review", "approved", "rejected"]).default("submitted") })).query(({ input }) => db.getAdminPaymentRequests(input.status)),
  review: adminProcedure
    .input(z.object({ requestId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), reason: z.string().trim().min(5).max(500) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const request = await db.reviewPaymentRequest({ requestId: input.requestId, actorUserId: ctx.user.id, decision: input.decision, reason: input.reason });
        if (!request) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Payment review is temporarily unavailable." });
        return request;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: error instanceof Error && error.message === "Payment request not found" ? "NOT_FOUND" : "BAD_REQUEST", message: toPublicError(error) });
      }
    }),
  setAccountHold: adminProcedure
    .input(z.object({ userId: z.number().int().positive(), status: z.enum(["active", "held"]), reason: z.string().trim().min(5).max(500) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await db.setAccountPaymentControl({ ...input, actorUserId: ctx.user.id });
        if (!result) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Payment controls are temporarily unavailable." });
        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: error instanceof Error && error.message === "Customer not found" ? "NOT_FOUND" : "BAD_REQUEST", message: "Unable to update the account payment control." });
      }
    }),
  proofUrl: adminProcedure.input(z.object({ requestId: z.number().int().positive() })).query(async ({ input }) => {
    const proof = await db.getAdminPaymentProof(input.requestId);
    if (!proof?.proofStorageKey || proof.proofDeletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Payment proof was not found." });
    return { url: proof.proofStorageProvider === "legacy_forge" ? await storageGetSignedUrl(proof.proofStorageKey) : await paymentProofStorageGetSignedUrl(proof.proofStorageKey) };
  }),
  proofRetentionStatus: adminProcedure.query(async () => ({ ...await db.getProofRetentionStatus(), retentionHours: 24, cleanupConfigured: Boolean(process.env.SKYBET_PROOF_RETENTION_CRON_SECRET) })),
});

export const commissionRouter = router({
  activeRule: adminProcedure.query(() => db.getActiveReferralCommissionRule()),
  activeOverride: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => db.getActiveReferralCommissionOverride(input.userId)),
  saveDefaultRule: adminProcedure
    .input(z.object({ percentage: z.string(), reason: z.string().trim().min(5).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const validation = validateReferralCommissionPercentage(input.percentage);
      if (!validation.ok) throw new TRPCError({ code: "BAD_REQUEST", message: validation.reason });
      const result = await db.saveReferralCommissionRule({ percentage: validation.percentage, reason: input.reason, actorUserId: ctx.user.id });
      if (!result) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Commission settings are temporarily unavailable." });
      return result;
    }),
  saveUserOverride: adminProcedure
    .input(z.object({ userId: z.number().int().positive(), percentage: z.string(), reason: z.string().trim().min(5).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const validation = validateReferralCommissionPercentage(input.percentage);
      if (!validation.ok) throw new TRPCError({ code: "BAD_REQUEST", message: validation.reason });
      try {
        const result = await db.saveReferralCommissionOverride({ userId: input.userId, percentage: validation.percentage, reason: input.reason, actorUserId: ctx.user.id });
        if (!result) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Commission settings are temporarily unavailable." });
        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: error instanceof Error && error.message === "Customer not found" ? "NOT_FOUND" : "BAD_REQUEST", message: "Unable to update the customer commission." });
      }
    }),
});
