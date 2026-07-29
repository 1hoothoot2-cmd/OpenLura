import { createHash } from "node:crypto";
import {
  answerSkyGuideQuestion,
  sanitizeSkyGuideContext,
  validateSkyGuideQuestion,
} from "@/features/skytracker/skyguide/application/skyGuideAssistant";
import type { SkyGuideContext } from "@/features/skytracker/skyguide/domain/skyGuide";
import { InMemorySkyGuideRateLimiter } from "@/features/skytracker/skyguide/infrastructure/inMemorySkyGuideRateLimiter";
import { OpenAiSkyGuideProvider } from "@/features/skytracker/skyguide/infrastructure/openAiSkyGuideProvider";
import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";
import { MemoryManager } from "@/features/skytracker/personal-platform/application/memoryManager";
import {
  SupabaseMemoryRepository,
  SupabasePreferencesRepository,
  createSupabaseRepositoryConfig,
} from "@/features/skytracker/personal-platform/infrastructure/supabaseRepositories";

export const runtime = "nodejs";

const limiter = new InMemorySkyGuideRateLimiter();

type RequestBody = { query?: unknown; context?: unknown };

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ error: "invalid-request" }, 415);
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return json({ error: "invalid-request" }, 400);
  }

  if (typeof body.query !== "string" || !isSkyGuideContext(body.context)) {
    return json({ error: "invalid-request" }, 400);
  }

  let context = sanitizeSkyGuideContext(body.context);
  const identity = await requireOpenLuraIdentity(request);
  if (identity.ok) {
    try {
      const config = createSupabaseRepositoryConfig(identity.identity.accessToken);
      const memory = await new MemoryManager(
        new SupabaseMemoryRepository(config),
        new SupabasePreferencesRepository(config),
      ).get(identity.identity.userId);
      context = sanitizeSkyGuideContext({
        ...context,
        memory: {
          items: memory.items.map(({ category, value, label }) => ({
            category,
            value,
            label,
          })),
          preferredLanguage: memory.preferredLanguage,
          expertiseLevel: memory.expertiseLevel,
          conversationStyle: memory.conversationStyle,
        },
      });
    } catch {
      // Memory is optional context; SkyGuide remains available without it.
    }
  }
  const preflight = validateSkyGuideQuestion({ query: body.query, context });
  if (preflight.kind !== "accepted") {
    return json(
      {
        error: preflight.kind,
        message:
          preflight.kind === "empty"
            ? "Ask SkyGuide a question about aviation."
            : "I’m SkyGuide. I can help with aviation, aircraft, flights and airports.",
      },
      400,
    );
  }

  const rateLimit = limiter.consume(requestKey(request), "free");
  const rateHeaders = {
    "X-SkyGuide-RateLimit-Limit": String(rateLimit.limit),
    "X-SkyGuide-RateLimit-Remaining": String(rateLimit.remaining),
    "X-SkyGuide-RateLimit-Reset": String(
      Math.ceil(rateLimit.resetAtEpochMillis / 1_000),
    ),
  };
  if (!rateLimit.allowed) {
    return json(
      {
        error: "rate-limited",
        message: "You’ve reached the current SkyGuide free limit. Please try again later.",
      },
      429,
      {
        ...rateHeaders,
        "Retry-After": String(
          Math.max(1, Math.ceil((rateLimit.resetAtEpochMillis - Date.now()) / 1_000)),
        ),
      },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(
      { error: "temporarily-unavailable", message: "SkyGuide is currently temporarily unavailable." },
      503,
      rateHeaders,
    );
  }

  try {
    const provider = new OpenAiSkyGuideProvider(
      apiKey,
      process.env.SKYGUIDE_AI_MODEL,
    );
    const scope = await provider.classifyScope(preflight.query, context);
    if (!scope.accepted) {
      console.info("SkyGuide scope rejected", JSON.stringify({
        reason: "semantic-outside-aviation",
        language: scope.language,
      }));
      return json(
        {
          error: "outside-aviation",
          message:
            scope.refusal ||
            "I’m SkyGuide. I can help with aviation, aircraft, flights and airports.",
        },
        400,
        rateHeaders,
      );
    }
    console.info("SkyGuide scope accepted", JSON.stringify({
      reason: "semantic-aviation",
      language: scope.language,
      tools: scope.toolPlan.tools,
      useWebSearch: scope.toolPlan.useWebSearch,
    }));
    const result = await answerSkyGuideQuestion(
      {
        query: preflight.query,
        context,
        toolPlan: scope.toolPlan,
        responseLanguage: scope.language,
      },
      provider,
    );
    if (result.kind !== "answered") {
      return json({ error: result.kind }, 400, rateHeaders);
    }
    return json(result.value, 200, rateHeaders);
  } catch (error) {
    const providerError =
      error && typeof error === "object"
        ? (error as Record<string, unknown>)
        : {};
    console.error("SkyGuide provider request failed", JSON.stringify({
      errorType: error instanceof Error ? error.name : "unknown",
      status: typeof providerError.status === "number" ? providerError.status : null,
      code: typeof providerError.code === "string" ? providerError.code : null,
      message:
        error instanceof Error
          ? error.message.replace(/\s+/g, " ").slice(0, 240)
          : null,
    }));
    return json(
      { error: "temporarily-unavailable", message: "SkyGuide is currently temporarily unavailable." },
      503,
      rateHeaders,
    );
  }
}

function requestKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const source = forwarded || request.headers.get("x-real-ip")?.trim() || "anonymous";
  return createHash("sha256").update(source).digest("hex");
}

function isSkyGuideContext(value: unknown): value is SkyGuideContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Record<string, unknown>;
  const historyStates = ["loading", "available", "session-only", "unavailable"];
  if (!historyStates.includes(String(context.flightHistory))) return false;
  if (context.selectedAircraft !== null && !isSelectedAircraft(context.selectedAircraft)) {
    return false;
  }
  if (context.map !== null && !isMapContext(context.map)) return false;
  if (
    context.favorites !== undefined &&
    (!context.favorites || typeof context.favorites !== "object")
  ) return false;
  return true;
}

function isSelectedAircraft(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.lifecycle === "string" &&
    typeof item.latitudeDegrees === "number" &&
    typeof item.longitudeDegrees === "number"
  );
}

function isMapContext(value: unknown) {
  if (!value || typeof value !== "object") return false;
  return [
    "centerLatitudeDegrees",
    "centerLongitudeDegrees",
    "southLatitudeDegrees",
    "westLongitudeDegrees",
    "northLatitudeDegrees",
    "eastLongitudeDegrees",
  ].every((key) => typeof (value as Record<string, unknown>)[key] === "number");
}

function json(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
