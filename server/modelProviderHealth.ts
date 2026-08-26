export type ModelProviderHealth = {
  provider: "nvidia" | "openrouter";
  ok: boolean;
  status: number;
  modelCount: number;
};

type ModelsResponse = { data?: unknown[] };

async function checkProvider(provider: ModelProviderHealth["provider"], url: string, apiKey: string): Promise<ModelProviderHealth> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(12_000),
  });
  const payload = response.ok ? await response.json() as ModelsResponse : undefined;
  return { provider, ok: response.ok, status: response.status, modelCount: Array.isArray(payload?.data) ? payload.data.length : 0 };
}

export async function checkConfiguredModelProviders() {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!nvidiaKey || !openRouterKey) throw new Error("Model provider secrets are not configured.");
  return Promise.all([
    checkProvider("nvidia", "https://integrate.api.nvidia.com/v1/models", nvidiaKey),
    checkProvider("openrouter", "https://openrouter.ai/api/v1/models", openRouterKey),
  ]);
}
