import type { Request, Response } from "express";
import { verifyAquaPayWebhookSignature } from "./aquaPayGateway";
import { settleAquaPayWebhook } from "./db";

function firstString(...values: unknown[]) {
  return values.find(value => typeof value === "string" && value.trim()) as string | undefined;
}

export async function handleAquaPayWebhook(req: Request, res: Response) {
  const signature = req.header("x-aquapay-signature") ?? req.header("x-webhook-signature") ?? req.header("x-signature");
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  if (!verifyAquaPayWebhookSignature(rawBody, signature)) return res.status(401).json({ ok: false, error: "Invalid webhook signature" });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const nested = (body.data && typeof body.data === "object" ? body.data : {}) as Record<string, unknown>;
  const status = firstString(body.status, body.event, body.type, nested.status)?.toLowerCase() ?? "";
  if (!["success", "successful", "completed", "paid", "payment.successful", "payment_completed"].includes(status)) return res.status(200).json({ ok: true, ignored: true });
  const reference = firstString(body.reference, body.merchant_reference, body.external_reference, nested.reference, nested.merchant_reference);
  const providerReference = firstString(body.provider_reference, body.transaction_id, body.transactionId, body.id, nested.provider_reference, nested.transaction_id) ?? reference;
  const amountValue = body.amount ?? nested.amount;
  const amount = typeof amountValue === "number" ? amountValue : Number(amountValue);
  if (!reference || !providerReference || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ ok: false, error: "Incomplete webhook payload" });
  try {
    await settleAquaPayWebhook({ reference, amount, providerReference });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[AquaPay] Webhook settlement failed", error);
    return res.status(400).json({ ok: false, error: "Webhook could not be applied" });
  }
}
