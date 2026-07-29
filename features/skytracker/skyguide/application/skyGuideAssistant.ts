import {
  classifySkyGuideScope,
  containsSkyGuidePromptInjection,
  inferSkyGuideAudienceMode,
  normalizeSkyGuideQuery,
  SKYGUIDE_MAX_QUERY_CHARACTERS,
  SKYGUIDE_MAX_SUGGESTIONS,
  type SkyGuideAudienceMode,
  type SkyGuideContext,
} from "../domain/skyGuide.ts";

export type SkyGuideAnswer = Readonly<{
  answer: string;
  facts: readonly string[];
  likelyExplanation: readonly string[];
  unknown: readonly string[];
  suggestions: readonly string[];
  audienceMode: SkyGuideAudienceMode;
}>;

export type SkyGuideProviderInput = Readonly<{
  query: string;
  audienceMode: SkyGuideAudienceMode;
  context: SkyGuideContext;
}>;

export interface SkyGuideAiProvider {
  answer(input: SkyGuideProviderInput): Promise<SkyGuideAnswer>;
}

export type SkyGuideAccessTier = "free" | "account" | "pro";

export interface SkyGuideRateLimiter {
  consume(
    key: string,
    tier: SkyGuideAccessTier,
  ): { allowed: boolean; limit: number; remaining: number; resetAtEpochMillis: number };
}

export type SkyGuideAssistantResult =
  | { kind: "answered"; value: SkyGuideAnswer }
  | { kind: "empty" | "outside-aviation" | "prompt-injection" };

export function validateSkyGuideQuestion(
  input: Readonly<{ query: string; context: SkyGuideContext }>,
):
  | {
      kind: "accepted";
      query: string;
      audienceMode: SkyGuideAudienceMode;
    }
  | { kind: "empty" | "outside-aviation" | "prompt-injection" } {
  const query = normalizeSkyGuideQuery(input.query);
  if (!query) return { kind: "empty" };
  if (query.length > SKYGUIDE_MAX_QUERY_CHARACTERS) {
    return { kind: "outside-aviation" };
  }
  if (containsSkyGuidePromptInjection(query)) {
    return { kind: "prompt-injection" };
  }
  const scope = classifySkyGuideScope(query, input.context.selectedAircraft !== null);
  if (!scope.accepted) return { kind: scope.reason };
  return {
    kind: "accepted",
    query,
    audienceMode: inferSkyGuideAudienceMode(query),
  };
}

export async function answerSkyGuideQuestion(
  input: Readonly<{ query: string; context: SkyGuideContext }>,
  provider: SkyGuideAiProvider,
): Promise<SkyGuideAssistantResult> {
  const validation = validateSkyGuideQuestion(input);
  if (validation.kind !== "accepted") return validation;

  const answer = await provider.answer({
    query: validation.query,
    context: input.context,
    audienceMode: validation.audienceMode,
  });

  return {
    kind: "answered",
    value: {
      ...answer,
      answer: answer.answer.slice(0, 2_400),
      facts: answer.facts.slice(0, 5).map((item) => item.slice(0, 500)),
      likelyExplanation: answer.likelyExplanation
        .slice(0, 3)
        .map((item) => item.slice(0, 500)),
      unknown: answer.unknown.slice(0, 3).map((item) => item.slice(0, 500)),
      suggestions: answer.suggestions
        .slice(0, SKYGUIDE_MAX_SUGGESTIONS)
        .map((item) => item.slice(0, 120)),
    },
  };
}

export function sanitizeSkyGuideContext(context: SkyGuideContext): SkyGuideContext {
  const selected = context.selectedAircraft;
  return {
    selectedAircraft: selected
      ? {
          id: selected.id.slice(0, 32),
          callsign: selected.callsign?.slice(0, 20) ?? null,
          registration: selected.registration?.slice(0, 20) ?? null,
          lifecycle: selected.lifecycle.slice(0, 20),
          latitudeDegrees: boundedNumber(selected.latitudeDegrees, -90, 90),
          longitudeDegrees: boundedNumber(selected.longitudeDegrees, -180, 180),
          altitudeMeters: optionalBoundedNumber(selected.altitudeMeters, -1_000, 30_000),
          groundSpeedMetersPerSecond: optionalBoundedNumber(
            selected.groundSpeedMetersPerSecond,
            0,
            500,
          ),
          headingDegrees: optionalBoundedNumber(selected.headingDegrees, 0, 360),
        }
      : null,
    map: context.map
      ? {
          centerLatitudeDegrees: boundedNumber(context.map.centerLatitudeDegrees, -90, 90),
          centerLongitudeDegrees: boundedNumber(context.map.centerLongitudeDegrees, -180, 180),
          southLatitudeDegrees: boundedNumber(context.map.southLatitudeDegrees, -90, 90),
          westLongitudeDegrees: boundedNumber(context.map.westLongitudeDegrees, -180, 180),
          northLatitudeDegrees: boundedNumber(context.map.northLatitudeDegrees, -90, 90),
          eastLongitudeDegrees: boundedNumber(context.map.eastLongitudeDegrees, -180, 180),
        }
      : null,
    flightHistory: context.flightHistory,
  };
}

function boundedNumber(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum;
}

function optionalBoundedNumber(
  value: number | null,
  minimum: number,
  maximum: number,
): number | null {
  return value === null ? null : boundedNumber(value, minimum, maximum);
}
