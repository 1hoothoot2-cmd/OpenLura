export const ALERT_TRIGGER_KINDS = [
  "lifecycle-changed",
  "aircraft-disappeared",
  "aircraft-reappeared",
  "landing-detected",
  "departure-detected",
  "altitude-changed",
  "speed-changed",
  "aircraft-appeared",
  "region-entered",
  "region-left",
  "airport-activity-increased",
  "airport-activity-decreased",
] as const;

export type AlertTriggerKind = (typeof ALERT_TRIGGER_KINDS)[number];
export type AlertSeverity = "info" | "notice";
export type AlertStatus = "new" | "read" | "dismissed";

export interface MonitoringAlert {
  id: string;
  monitorId: string;
  trigger: AlertTriggerKind;
  timestampEpochMillis: number;
  severity: AlertSeverity;
  title: string;
  description: string;
  status: AlertStatus;
}

export function dismissAlert(
  alert: MonitoringAlert,
  alertId: string,
): MonitoringAlert {
  return alert.id === alertId ? { ...alert, status: "dismissed" } : alert;
}

export function appendSessionAlerts(
  current: readonly MonitoringAlert[],
  incoming: readonly MonitoringAlert[],
  maximum = 20,
): readonly MonitoringAlert[] {
  if (incoming.length === 0) return current;
  const byId = new Map<string, MonitoringAlert>();
  for (const alert of [...incoming, ...current]) {
    if (!byId.has(alert.id)) byId.set(alert.id, alert);
  }
  return [...byId.values()]
    .sort((left, right) => right.timestampEpochMillis - left.timestampEpochMillis)
    .slice(0, maximum);
}
