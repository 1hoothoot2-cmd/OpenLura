import type { MonitorKind } from "../domain/monitoring.ts";

export interface MonitoringIntent {
  recognized: boolean;
  kind: MonitorKind | null;
  confidence: "high" | "none";
  executionAvailable: false;
}

export type LiveMonitoringCommand =
  | Readonly<{
      action:
        | "show"
        | "pause"
        | "resume"
        | "stop"
        | "show-alerts"
        | "explain-alert"
        | "dismiss-alert"
        | "clear-alerts"
        | "notifications-on"
        | "notifications-off"
        | "show-notifications"
        | "read-notifications"
        | "explain-notification"
        | "clear-notifications"
        | "pause-alerts"
        | "resume-alerts";
    }>
  | Readonly<{
      action: "watch";
      kind: MonitorKind;
      field: string | null;
      value: string | null;
    }>;

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

export function recognizeLiveMonitoringCommand(
  query: string,
): LiveMonitoringCommand | null {
  const normalized = query.trim();
  if (/\b(?:notify me|turn notifications on)\b/i.test(normalized)) {
    return { action: "notifications-on" };
  }
  if (/\bturn notifications off\b/i.test(normalized)) {
    return { action: "notifications-off" };
  }
  if (/\bwhat notifications are active\b/i.test(normalized)) {
    return { action: "show-notifications" };
  }
  if (/\bmark notifications as read\b/i.test(normalized)) {
    return { action: "read-notifications" };
  }
  if (/\bclear notifications\b/i.test(normalized)) {
    return { action: "clear-notifications" };
  }
  if (/\bwhy was i notified\b/i.test(normalized)) {
    return { action: "explain-notification" };
  }
  if (/\bpause (?:these )?alerts\b/i.test(normalized)) {
    return { action: "pause-alerts" };
  }
  if (/\bresume (?:these )?alerts\b/i.test(normalized)) {
    return { action: "resume-alerts" };
  }
  if (/\b(?:what happened|show alerts?|list alerts?)\b/i.test(normalized)) {
    return { action: "show-alerts" };
  }
  if (/\bwhy did (?:this|that|it) trigger\b/i.test(normalized)) {
    return { action: "explain-alert" };
  }
  if (/\bdismiss (?:the )?(?:latest )?alert\b/i.test(normalized)) {
    return { action: "dismiss-alert" };
  }
  if (/\bclear (?:all )?alerts\b/i.test(normalized)) {
    return { action: "clear-alerts" };
  }
  if (/\b(?:show|list)\b.{0,20}\b(?:active )?(?:monitors|watching)\b/i.test(normalized)) {
    return { action: "show" };
  }
  if (/\bpause\b.{0,20}\b(?:monitoring|watching|monitors?)\b/i.test(normalized)) {
    return { action: "pause" };
  }
  if (/\bresume\b.{0,20}\b(?:monitoring|watching|monitors?)\b/i.test(normalized)) {
    return { action: "resume" };
  }
  if (/\b(?:stop watching|remove monitor|stop monitoring)\b/i.test(normalized)) {
    return { action: "stop" };
  }
  if (!MONITORING_LANGUAGE.test(normalized)) return null;

  const kind = inferKind(normalized);
  const aircraftType = normalized.match(/\b(A3\d{2}|B7\d{2}|C-?17|Antonov)\b/i)?.[1];
  if (aircraftType) {
    return { action: "watch", kind: "aircraft", field: "aircraftType", value: aircraftType };
  }
  const category = normalized.match(/\b(military|cargo|helicopter)\b/i)?.[1];
  if (category) {
    return { action: "watch", kind: "spotter", field: "category", value: category };
  }
  const airline = normalized.match(/\b(Emirates|KLM|Lufthansa|Air France|British Airways)\b/i)?.[1];
  if (airline) {
    return { action: "watch", kind: "aircraft", field: "airline", value: airline };
  }
  return { action: "watch", kind, field: null, value: null };
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
