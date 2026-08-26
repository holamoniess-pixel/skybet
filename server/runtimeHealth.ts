export function createRuntimeHealthPayload() {
  return {
    ok: true,
    service: "skybet-api",
  } as const;
}

export function isLegacyOAuthConfigured(oAuthServerUrl: string) {
  return oAuthServerUrl.trim().length > 0;
}
