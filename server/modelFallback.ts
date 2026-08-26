import { z } from "zod";

export type ModelProvider = "nvidia" | "openrouter";

export type ModelPlan = {
  provider: ModelProvider;
  model: string;
  endpoint: string;
};

export const SPORTS_NORMALIZATION_FALLBACKS: readonly ModelPlan[] = [
  { provider: "nvidia", model: "meta/llama-3.1-8b-instruct", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions" },
  { provider: "nvidia", model: "meta/llama-3.3-70b-instruct", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions" },
  { provider: "openrouter", model: "nvidia/nemotron-3.5-lightning:free", endpoint: "https://openrouter.ai/api/v1/chat/completions" },
  { provider: "openrouter", model: "liquid/lfm-2.5-2.6b:free", endpoint: "https://openrouter.ai/api/v1/chat/completions" },
];

export type LicensedFeedSnapshot = {
  source: "licensed-feed";
  providerName: string;
  fetchedAt: string;
  events: unknown[];
};

const NormalizedSelectionSchema = z.object({
  sourceSelectionId: z.string().min(1),
  label: z.string().min(1),
}).strict();

const NormalizedMarketSchema = z.object({
  sourceMarketId: z.string().min(1),
  label: z.string().min(1),
  selections: z.array(NormalizedSelectionSchema),
}).strict();

const NormalizedEventSchema = z.object({
  sourceEventId: z.string().min(1),
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
  competition: z.string().min(1),
  startTime: z.string().datetime(),
  markets: z.array(NormalizedMarketSchema),
}).strict();

const NormalizedSportsDataSchema = z.object({
  events: z.array(NormalizedEventSchema),
}).strict();

export type NormalizedSportsData = z.infer<typeof NormalizedSportsDataSchema>;

export type NormalizationResult = {
  normalized: NormalizedSportsData;
  canonicalEvents: unknown[];
  provider: ModelProvider;
  model: string;
};

type ChatTransport = typeof fetch;

function buildNormalizationMessages(snapshot: LicensedFeedSnapshot) {
  return [
    {
      role: "system",
      content: "You normalize licensed sports-provider payloads. Return strict JSON only with {events:[{sourceEventId,homeTeam,awayTeam,competition,startTime,markets:[{sourceMarketId,label,selections:[{sourceSelectionId,label}]}]}]}. Do not include odds, prices, probabilities, scores, or calculated values: those remain only in the canonical source payload. Never create identifiers, fixtures, labels, or timestamps. Reject fields that are missing from the source instead of inventing them.",
    },
    {
      role: "user",
      content: JSON.stringify({ provider: snapshot.providerName, fetchedAt: snapshot.fetchedAt, events: snapshot.events }),
    },
  ];
}

function apiKeyFor(provider: ModelProvider) {
  return provider === "nvidia" ? process.env.NVIDIA_API_KEY : process.env.OPENROUTER_API_KEY;
}

function sourceEventIds(events: unknown[]) {
  const ids = events.map(event => (event as { id?: unknown }).id).filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length !== events.length || new Set(ids).size !== ids.length) {
    throw new Error("Licensed provider snapshot must contain one stable string id per event.");
  }
  return new Set(ids);
}

function readJsonContent(payload: unknown) {
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Model response did not contain JSON content.");
  return JSON.parse(content) as unknown;
}

function validateNormalizedData(candidate: unknown, permittedSourceIds: Set<string>): NormalizedSportsData {
  const parsed = NormalizedSportsDataSchema.safeParse(candidate);
  if (!parsed.success) throw new Error("Model output failed strict sports normalization schema validation.");
  const normalizedIds = parsed.data.events.map(event => event.sourceEventId);
  if (new Set(normalizedIds).size !== normalizedIds.length || normalizedIds.length !== permittedSourceIds.size || normalizedIds.some(id => !permittedSourceIds.has(id))) {
    throw new Error("Model output did not preserve the licensed provider event identifiers.");
  }
  return parsed.data;
}

export async function normalizeLicensedSportsSnapshot(snapshot: LicensedFeedSnapshot, transport: ChatTransport = fetch): Promise<NormalizationResult> {
  if (snapshot.source !== "licensed-feed") {
    throw new Error("Only licensed provider snapshots can enter model normalization.");
  }
  if (!snapshot.providerName || !snapshot.fetchedAt || !Array.isArray(snapshot.events)) {
    throw new Error("Licensed provider snapshot is incomplete.");
  }
  const permittedSourceIds = sourceEventIds(snapshot.events);

  const failures: string[] = [];
  for (const plan of SPORTS_NORMALIZATION_FALLBACKS) {
    const apiKey = apiKeyFor(plan.provider);
    if (!apiKey) {
      failures.push(`${plan.provider}:${plan.model}:missing-key`);
      continue;
    }
    try {
      const response = await transport(plan.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: plan.model, temperature: 0, response_format: { type: "json_object" }, messages: buildNormalizationMessages(snapshot) }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const normalized = validateNormalizedData(readJsonContent(await response.json()), permittedSourceIds);
      return { normalized, canonicalEvents: snapshot.events, provider: plan.provider, model: plan.model };
    } catch (error) {
      failures.push(`${plan.provider}:${plan.model}:${error instanceof Error ? error.message : "unknown"}`);
    }
  }
  throw new Error(`Sports payload normalization unavailable (${failures.join(", ")}).`);
}
