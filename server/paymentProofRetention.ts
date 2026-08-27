import type { RequestHandler } from "express";
import { getExpiredPaymentProofs, markPaymentProofDeleted, recordProofRetentionRun } from "./db";
import { paymentProofStorageDelete } from "./storage";

type ExpiredProof = { id: number; proofStorageKey: string | null; proofStorageProvider: string | null };
type RetentionDependencies = {
  now?: () => Date;
  getExpiredProofs?: (cutoffAt: Date, limit?: number) => Promise<ExpiredProof[]>;
  deleteProof?: (key: string) => Promise<void>;
  markDeleted?: (requestId: number, deletedAt: Date) => Promise<unknown>;
  recordRun?: (input: { cutoffAt: Date; candidateCount: number; deletedCount: number; legacyAccessRevokedCount: number; failedCount: number; status: "completed" | "partial" }) => Promise<unknown>;
};

export async function runPaymentProofRetention(dependencies: RetentionDependencies = {}) {
  const now = dependencies.now?.() ?? new Date();
  const cutoffAt = now;
  const getExpiredProofs = dependencies.getExpiredProofs ?? getExpiredPaymentProofs;
  const deleteProof = dependencies.deleteProof ?? paymentProofStorageDelete;
  const markDeleted = dependencies.markDeleted ?? markPaymentProofDeleted;
  const recordRun = dependencies.recordRun ?? recordProofRetentionRun;
  const candidates = await getExpiredProofs(cutoffAt, 100);
  let deletedCount = 0;
  let legacyAccessRevokedCount = 0;
  let failedCount = 0;

  for (const proof of candidates) {
    if (!proof.proofStorageKey) continue;
    try {
      if (proof.proofStorageProvider === "legacy_forge") {
        // Legacy objects cannot be deleted through the new private bucket client.
        legacyAccessRevokedCount += 1;
      } else {
        await deleteProof(proof.proofStorageKey);
        deletedCount += 1;
      }
      await markDeleted(proof.id, now);
    } catch {
      failedCount += 1;
    }
  }

  const status: "completed" | "partial" = failedCount ? "partial" : "completed";
  await recordRun({ cutoffAt, candidateCount: candidates.length, deletedCount, legacyAccessRevokedCount, failedCount, status });
  return { cutoffAt, candidateCount: candidates.length, deletedCount, legacyAccessRevokedCount, failedCount, status };
}

type HandlerDependencies = { getCronSecret?: () => string | undefined; runCleanup?: () => ReturnType<typeof runPaymentProofRetention> };

export function createPaymentProofRetentionHandler({
  getCronSecret = () => process.env.SKYBET_PROOF_RETENTION_CRON_SECRET,
  runCleanup = () => runPaymentProofRetention(),
}: HandlerDependencies = {}): RequestHandler {
  return async (req, res) => {
    const expectedSecret = getCronSecret();
    if (!expectedSecret) return res.status(503).json({ ok: false, error: "proof-retention-disabled" });
    if (req.get("authorization") !== `Bearer ${expectedSecret}`) return res.status(403).json({ ok: false, error: "cron-only" });
    try {
      const result = await runCleanup();
      return res.status(200).json({ ok: true, candidateCount: result.candidateCount, deletedCount: result.deletedCount, legacyAccessRevokedCount: result.legacyAccessRevokedCount, failedCount: result.failedCount, status: result.status });
    } catch {
      return res.status(502).json({ ok: false, error: "proof-retention-failed" });
    }
  };
}
