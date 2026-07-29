import type { Monitor } from "../domain/monitoring.ts";

const STORAGE_KEY = "skytracker.monitoring.session.v1";

export interface SessionMonitoringRepository {
  load(): readonly Monitor[];
  save(monitors: readonly Monitor[]): void;
  clear(): void;
}

export function createSessionMonitoringRepository(): SessionMonitoringRepository {
  return {
    load() {
      try {
        const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "[]");
        return Array.isArray(parsed) ? parsed.filter(isMonitor) : [];
      } catch {
        return [];
      }
    },
    save(monitors) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(monitors.slice(0, 20)));
    },
    clear() {
      window.sessionStorage.removeItem(STORAGE_KEY);
    },
  };
}

function isMonitor(value: unknown): value is Monitor {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<Monitor>;
  return (
    typeof record.id === "string" &&
    typeof record.kind === "string" &&
    typeof record.title === "string" &&
    typeof record.createdAtEpochMillis === "number" &&
    typeof record.target === "object" &&
    typeof record.state === "object"
  );
}
