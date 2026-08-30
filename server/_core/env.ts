export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  aquaPayApiUrl: process.env.AQUAPAY_API_URL ?? "",
  aquaPayApiKey: process.env.AQUAPAY_API_KEY ?? "",
  aquaPayWebhookSecret: process.env.AQUAPAY_WEBHOOK_SECRET ?? "",
  aquaPayEnabled: process.env.AQUAPAY_ENABLED === "true",
};
