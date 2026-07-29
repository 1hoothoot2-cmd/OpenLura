import type { MonitoringAlert } from "../domain/alert.ts";

const STORAGE_KEY = "skytracker.alerts.session.v1";

export interface SessionAlertRepository {
  load(): readonly MonitoringAlert[];
  save(alerts: readonly MonitoringAlert[]): void;
  clear(): void;
}

export function createSessionAlertRepository(): SessionAlertRepository {
  return {
    load() {
      try {
        const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "[]");
        return Array.isArray(parsed) ? parsed.filter(isAlert).slice(0, 20) : [];
      } catch {
        return [];
      }
    },
    save(alerts) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(alerts.slice(0, 20)));
    },
    clear() {
      window.sessionStorage.removeItem(STORAGE_KEY);
    },
  };
}

function isAlert(value: unknown): value is MonitoringAlert {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<MonitoringAlert>;
  return (
    typeof record.id === "string" &&
    typeof record.monitorId === "string" &&
    typeof record.trigger === "string" &&
    typeof record.timestampEpochMillis === "number" &&
    typeof record.title === "string" &&
    typeof record.description === "string" &&
    ["new", "read", "dismissed"].includes(record.status ?? "")
  );
}
