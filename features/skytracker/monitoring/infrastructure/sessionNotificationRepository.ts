import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type SessionNotification,
} from "../domain/notificationDelivery.ts";

const STORAGE_KEY = "skytracker.notifications.session.v1";

export interface SessionNotificationState {
  notifications: readonly SessionNotification[];
  preferences: NotificationPreferences;
}

export interface SessionNotificationRepository {
  load(): SessionNotificationState;
  save(state: SessionNotificationState): void;
  clear(): void;
}

export function createSessionNotificationRepository(): SessionNotificationRepository {
  return {
    load() {
      try {
        const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null");
        if (!parsed || typeof parsed !== "object") return emptyState();
        const record = parsed as Partial<SessionNotificationState>;
        return {
          notifications: Array.isArray(record.notifications)
            ? record.notifications.filter(isNotification).slice(0, 30)
            : [],
          preferences: isPreferences(record.preferences)
            ? record.preferences
            : DEFAULT_NOTIFICATION_PREFERENCES,
        };
      } catch {
        return emptyState();
      }
    },
    save(state) {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          notifications: state.notifications.slice(0, 30),
          preferences: state.preferences,
        }),
      );
    },
    clear() {
      window.sessionStorage.removeItem(STORAGE_KEY);
    },
  };
}

function emptyState(): SessionNotificationState {
  return {
    notifications: [],
    preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  };
}

function isNotification(value: unknown): value is SessionNotification {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<SessionNotification>;
  return (
    typeof record.id === "string" &&
    typeof record.alertId === "string" &&
    typeof record.monitorId === "string" &&
    typeof record.createdAtEpochMillis === "number" &&
    typeof record.title === "string" &&
    typeof record.status === "string"
  );
}

function isPreferences(value: unknown): value is NotificationPreferences {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<NotificationPreferences>;
  return (
    typeof record.inAppEnabled === "boolean" &&
    typeof record.browserEnabled === "boolean" &&
    typeof record.normalAlertsEnabled === "boolean" &&
    typeof record.importantAlertsEnabled === "boolean" &&
    typeof record.enabledMonitorKinds === "object"
  );
}
