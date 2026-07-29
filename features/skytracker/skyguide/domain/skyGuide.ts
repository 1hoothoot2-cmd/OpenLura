export type SkyGuideActionId =
  | "find-flight"
  | "find-airport"
  | "find-aircraft"
  | "overhead"
  | "weather"
  | "spotting";

export type SkyGuideCapabilityId =
  | "live-skytracker-data"
  | "airport-intelligence"
  | "weather"
  | "aviation-news"
  | "controlled-web-search"
  | "memory"
  | "notifications";

export type SkyGuideCapability = {
  id: SkyGuideCapabilityId;
  available: boolean;
};

export type SkyGuideAction = {
  id: SkyGuideActionId;
  title: string;
  description: string;
  prompt: string;
  icon: "flight" | "airport" | "aircraft" | "location" | "weather" | "camera";
};

export type SkyGuideScopeResult =
  | { accepted: true; normalizedQuery: string }
  | { accepted: false; reason: "empty" | "outside-aviation" };

export type SkyGuideAudienceMode = "beginner" | "expert";
export type SkyGuideAiStatus = "ready" | "live" | "cached" | "web" | "offline";

export type SkyGuideSource = Readonly<{
  id: string;
  label: string;
  url?: string;
  publishedAt?: string;
}>;

export type SkyGuideMapContext = Readonly<{
  centerLatitudeDegrees: number;
  centerLongitudeDegrees: number;
  southLatitudeDegrees: number;
  westLongitudeDegrees: number;
  northLatitudeDegrees: number;
  eastLongitudeDegrees: number;
}>;

export type SkyGuideContext = Readonly<{
  selectedAircraft: Readonly<{
    id: string;
    callsign: string | null;
    registration: string | null;
    lifecycle: string;
    latitudeDegrees: number;
    longitudeDegrees: number;
    altitudeMeters: number | null;
    groundSpeedMetersPerSecond: number | null;
    headingDegrees: number | null;
  }> | null;
  map: SkyGuideMapContext | null;
  flightHistory:
    | "loading"
    | "available"
    | "session-only"
    | "unavailable";
}>;

const AVIATION_TERMS = [
  "aerodynamics", "airbus", "aircraft", "airline", "airplane", "airport",
  "airspace", "altitude", "approach", "arrival", "aviation", "boeing",
  "callsign", "cessna", "cockpit", "departure", "engine", "flight", "fly",
  "flying", "helicopter", "icao", "iata", "jet", "landing", "metar",
  "notam", "pilot", "plane", "route", "runway", "spotting", "squawk",
  "takeoff", "taxiway", "turbine", "turbulence", "weather", "wing",
  "aircraft history", "flight history", "historical track", "ground speed",
  "vertical speed", "heading", "climb", "cruise", "descent", "descending",
  "ascending", "tracking", "registration", "operator", "airworthiness",
  "regulation", "air traffic", "spotter", "avionics",
  "vliegtuig", "vlucht", "luchthaven", "luchtvaart", "vliegweer",
] as const;

const PROMPT_INJECTION_PATTERNS = [
  /\b(ignore|forget|override)\b.{0,40}\b(instruction|prompt|rule)/i,
  /\b(system|developer)\s+(message|prompt|instruction)/i,
  /\b(jailbreak|prompt injection)\b/i,
  /\b(reveal|show|print|return)\b.{0,40}\b(secret|api key|token|credential|prompt)/i,
] as const;

export const SKYGUIDE_MAX_QUERY_CHARACTERS = 500;
export const SKYGUIDE_MAX_SUGGESTIONS = 3;

export const SKYGUIDE_ACTIONS: readonly SkyGuideAction[] = [
  { id: "find-flight", title: "Find a flight", description: "Look up a flight or callsign", prompt: "Help me find a flight", icon: "flight" },
  { id: "find-airport", title: "Find an airport", description: "Explore an airport by name or code", prompt: "Tell me about an airport", icon: "airport" },
  { id: "find-aircraft", title: "Find an aircraft", description: "Search by registration or aircraft ID", prompt: "Help me find an aircraft", icon: "aircraft" },
  { id: "overhead", title: "What is above me?", description: "Understand nearby air traffic", prompt: "What aircraft are flying above me?", icon: "location" },
  { id: "weather", title: "Flying weather", description: "Ask about aviation weather", prompt: "How does today’s weather affect flying?", icon: "weather" },
  { id: "spotting", title: "Best spotting locations", description: "Learn where and how to spot aircraft", prompt: "Where can I safely spot aircraft?", icon: "camera" },
] as const;

export const SKYGUIDE_CAPABILITIES: readonly SkyGuideCapability[] = [
  { id: "live-skytracker-data", available: true },
  { id: "airport-intelligence", available: true },
  { id: "weather", available: true },
  { id: "aviation-news", available: true },
  { id: "controlled-web-search", available: true },
  { id: "memory", available: false },
  { id: "notifications", available: false },
] as const;

export const SKYGUIDE_PLACEHOLDERS = [
  "Why is this aircraft flying so low?",
  "Which flight departs next from Amsterdam?",
  "What is the flying weather over Frankfurt?",
  "Where can I spot aircraft today?",
  "What does squawk 7700 mean?",
  "How does an aircraft maintain altitude?",
] as const;

export function normalizeSkyGuideQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export function classifySkyGuideScope(
  query: string,
  hasSelectedAircraft = false,
): SkyGuideScopeResult {
  const normalizedQuery = normalizeSkyGuideQuery(query);
  if (!normalizedQuery) return { accepted: false, reason: "empty" };
  if (normalizedQuery.length > SKYGUIDE_MAX_QUERY_CHARACTERS) {
    return { accepted: false, reason: "outside-aviation" };
  }

  const lowered = normalizedQuery.toLocaleLowerCase("en");
  const containsAviationTerm = AVIATION_TERMS.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(lowered);
  });
  const contextualAircraftQuestion =
    hasSelectedAircraft &&
    /\b(this|it|selected|why|how|what|where|when|tell|explain)\b/i.test(
      normalizedQuery,
    );
  const accepted = containsAviationTerm || contextualAircraftQuestion;

  return accepted
    ? { accepted: true, normalizedQuery }
    : { accepted: false, reason: "outside-aviation" };
}

export function containsSkyGuidePromptInjection(query: string): boolean {
  const normalized = normalizeSkyGuideQuery(query);
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function inferSkyGuideAudienceMode(query: string): SkyGuideAudienceMode {
  const normalized = normalizeSkyGuideQuery(query).toLocaleLowerCase("en");
  return /\b(icao|iata|metar|notam|qnh|squawk|technical|aerodynamics)\b/.test(
    normalized,
  )
    ? "expert"
    : "beginner";
}
