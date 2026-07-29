import type { MonitorKind } from "../domain/monitoring.ts";

export interface MonitoringIntent {
  recognized: boolean;
  kind: MonitorKind | null;
  confidence: "high" | "none";
  executionAvailable: false;
}

const MONITORING_LANGUAGE =
  /\b(?:keep an eye on|notify me|watch|monitor|alert me|let me know)\b/i;

export function recognizeMonitoringIntent(query: string): MonitoringIntent {
  const normalized = query.trim();
  const recognized = MONITORING_LANGUAGE.test(normalized);

  if (!recognized) {
    return {
      recognized: false,
      kind: null,
      confidence: "none",
      executionAvailable: false,
    };
  }

  return {
    recognized: true,
    kind: inferKind(normalized),
    confidence: "high",
    executionAvailable: false,
  };
}

function inferKind(query: string): MonitorKind {
  if (/\b(?:weather|wind|storm|visibility|metar|taf)\b/i.test(query)) {
    return "weather";
  }
  if (/\b(?:news|boeing|airbus|notam|closure)\b/i.test(query)) {
    return "news";
  }
  if (/\b(?:rare|spotter|spotting|liver(?:y|ies)|military|cargo)\b/i.test(query)) {
    return "spotter";
  }
  if (/\b(?:airport|schiphol|heathrow|runway|arrivals|departures)\b/i.test(query)) {
    return "airport";
  }
  if (
    /\b(?:aircraft|a380|antonov|c-?17|icao24|registration|airline)\b/i.test(
      query,
    )
  ) {
    return "aircraft";
  }
  return "flight";
}
