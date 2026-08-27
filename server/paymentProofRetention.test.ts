import { describe, expect, it, vi } from "vitest";
import { createPaymentProofRetentionHandler, runPaymentProofRetention } from "./paymentProofRetention";

function responseRecorder() {
  const result = { statusCode: 0, body: null as unknown };
  const response = { status(code: number) { result.statusCode = code; return this; }, json(body: unknown) { result.body = body; return this; } };
  return { result, response };
}

describe("payment-proof retention", () => {
  it("deletes only expired private proof objects and records a key-free completed run", async () => {
    const deleted = vi.fn().mockResolvedValue(undefined);
    const marked = vi.fn().mockResolvedValue(undefined);
    const recorded = vi.fn().mockResolvedValue(undefined);
    const result = await runPaymentProofRetention({
      now: () => new Date("2026-08-27T12:00:00.000Z"),
      getExpiredProofs: vi.fn().mockResolvedValue([{ id: 7, proofStorageKey: "payment-proofs/9/proof.png", proofStorageProvider: "neon_s3" }]),
      deleteProof: deleted,
      markDeleted: marked,
      recordRun: recorded,
    });

    expect(deleted).toHaveBeenCalledWith("payment-proofs/9/proof.png");
    expect(marked).toHaveBeenCalledWith(7, new Date("2026-08-27T12:00:00.000Z"));
    expect(result).toMatchObject({ candidateCount: 1, deletedCount: 1, failedCount: 0, status: "completed" });
    expect(JSON.stringify(recorded.mock.calls[0][0])).not.toContain("payment-proofs/");
  });

  it("keeps processing after one deletion error and records a partial result", async () => {
    const marked = vi.fn().mockResolvedValue(undefined);
    const recorded = vi.fn().mockResolvedValue(undefined);
    const result = await runPaymentProofRetention({
      getExpiredProofs: vi.fn().mockResolvedValue([{ id: 1, proofStorageKey: "payment-proofs/1/fail.png", proofStorageProvider: "neon_s3" }, { id: 2, proofStorageKey: "payment-proofs/2/ok.png", proofStorageProvider: "neon_s3" }]),
      deleteProof: vi.fn().mockRejectedValueOnce(new Error("storage unavailable")).mockResolvedValueOnce(undefined),
      markDeleted: marked,
      recordRun: recorded,
    });

    expect(result).toMatchObject({ deletedCount: 1, failedCount: 1, status: "partial" });
    expect(marked).toHaveBeenCalledTimes(1);
  });

  it("fails closed until the cleanup secret exists and accepts only the matching bearer token", async () => {
    const disabled = createPaymentProofRetentionHandler({ getCronSecret: () => undefined, runCleanup: vi.fn() as never });
    const disabledResponse = responseRecorder();
    await disabled({ get: vi.fn() } as never, disabledResponse.response as never, vi.fn());
    expect(disabledResponse.result).toEqual({ statusCode: 503, body: { ok: false, error: "proof-retention-disabled" } });

    const cleanup = vi.fn().mockResolvedValue({ candidateCount: 2, deletedCount: 2, legacyAccessRevokedCount: 0, failedCount: 0, status: "completed" });
    const handler = createPaymentProofRetentionHandler({ getCronSecret: () => "test-secret", runCleanup: cleanup });
    const rejected = responseRecorder();
    await handler({ get: vi.fn().mockReturnValue("Bearer wrong") } as never, rejected.response as never, vi.fn());
    expect(rejected.result).toEqual({ statusCode: 403, body: { ok: false, error: "cron-only" } });

    const accepted = responseRecorder();
    await handler({ get: vi.fn().mockReturnValue("Bearer test-secret") } as never, accepted.response as never, vi.fn());
    expect(accepted.result).toEqual({ statusCode: 200, body: { ok: true, candidateCount: 2, deletedCount: 2, legacyAccessRevokedCount: 0, failedCount: 0, status: "completed" } });
    expect(JSON.stringify(accepted.result.body)).not.toContain("payment-proofs/");

    const failedHandler = createPaymentProofRetentionHandler({ getCronSecret: () => "test-secret", runCleanup: vi.fn().mockRejectedValue(new Error("payment-proofs/private-key.png unavailable")) });
    const failed = responseRecorder();
    await failedHandler({ get: vi.fn().mockReturnValue("Bearer test-secret") } as never, failed.response as never, vi.fn());
    expect(failed.result).toEqual({ statusCode: 502, body: { ok: false, error: "proof-retention-failed" } });
    expect(JSON.stringify(failed.result.body)).not.toContain("payment-proofs/");
  });
});
