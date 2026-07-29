import type { MonitorKind } from "./monitoring.ts";

export const NOTIFICATION_DELIVERY_STATUSES = [
  "queued",
  "delivered",
  "read",
  "dismissed",
  "failed",
  "suppressed",
] as const;

export type NotificationDeliveryStatus =
  (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export type NotificationTarget =
  | Readonly<{ kind: "aircraft"; aircraftId: string }>
  | Readonly<{ kind: "airport"; icaoCode: string | null }>
  | Readonly<{ kind: "region" }>
  | Readonly<{ kind: "pattern" }>
  | null;

export interface SessionNotification {
  id: string;
  alertId: string;
  monitorId: string;
  monitorKind: MonitorKind;
  createdAtEpochMillis: number;
  severity: "info" | "notice";
  title: string;
  description: string;
  reason: string;
  target: NotificationTarget;
  status: NotificationDeliveryStatus;
  browserDeliveryStatus: NotificationDeliveryStatus | "not-requested";
  suppressionReason: string | null;
}

export interface NotificationPreferences {
  inAppEnabled: boolean;
  browserEnabled: boolean;
  normalAlertsEnabled: boolean;
  importantAlertsEnabled: boolean;
  quietPeriod: Readonly<{ startHour: number; endHour: number }> | null;
  enabledMonitorKinds: Readonly<Record<MonitorKind, boolean>>;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  inAppEnabled: true,
  browserEnabled: false,
  normalAlertsEnabled: true,
  importantAlertsEnabled: true,
  quietPeriod: null,
  enabledMonitorKinds: {
    flight: true,
    aircraft: true,
    airport: true,
    weather: true,
    spotter: true,
    news: true,
  },
};

export function markNotificationRead(
  notification: SessionNotification,
): SessionNotification {
  return notification.status === "dismissed"
    ? notification
    : { ...notification, status: "read" };
}

export function dismissNotification(
  notification: SessionNotification,
): SessionNotification {
  return { ...notification, status: "dismissed" };
}
