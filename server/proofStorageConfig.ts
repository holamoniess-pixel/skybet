import { S3Client } from "@aws-sdk/client-s3";

export type ProofStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

const requiredKeys = [
  "AWS_ENDPOINT_URL_S3",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "SKYBET_PAYMENT_PROOF_BUCKET",
] as const;

export function getProofStorageConfig(env: NodeJS.ProcessEnv = process.env): ProofStorageConfig | null {
  if (requiredKeys.some(key => !env[key]?.trim())) return null;
  return {
    endpoint: env.AWS_ENDPOINT_URL_S3!.trim().replace(/\/+$/, ""),
    region: env.AWS_REGION!.trim(),
    bucket: env.SKYBET_PAYMENT_PROOF_BUCKET!.trim(),
    accessKeyId: env.AWS_ACCESS_KEY_ID!.trim(),
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!.trim(),
  };
}

export function createProofStorageClient(config: ProofStorageConfig) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}
