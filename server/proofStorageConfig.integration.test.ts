import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { createProofStorageClient, getProofStorageConfig } from "./proofStorageConfig";

describe("private payment-proof storage configuration", () => {
  it("authenticates a lightweight S3-compatible request with the configured server-only credentials", async () => {
    const config = getProofStorageConfig();
    expect(config).not.toBeNull();
    if (!config) return;

    const client = createProofStorageClient(config);
    try {
      const response = await client.send(new ListBucketsCommand({}));
      expect(Array.isArray(response.Buckets)).toBe(true);
    } catch {
      throw new Error("Payment-proof object storage credential validation failed.");
    } finally {
      client.destroy();
    }
  }, 15_000);
});
