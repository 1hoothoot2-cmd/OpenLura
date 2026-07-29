import type { MonitoringAlert } from "../domain/alert.ts";
import type { Monitor } from "../domain/monitoring.ts";
import {
  type NotificationPreferences,
  type NotificationTarget,
  type SessionNotification,
} from "../domain/notificationDelivery.ts";

export interface NotificationDeliveryAdapter {
  deliver(notification: SessionNotification): Promise<"delivered" | "failed" | "suppressed">;
}

export type InAppNotificationAdapter = NotificationDeliveryAdapter;
export type PushNotificationAdapter = NotificationDeliveryAdapter;
export type EmailNotificationAdapter = NotificationDeliveryAdapter;

export interface NotificationDeliveryService {
  enqueue(
    alerts: readonly MonitoringAlert[],
    monitors: readonly Monitor[],
    existing: readonly SessionNotification[],
    preferences: NotificationPreferences,
    now: number,
  ): readonly SessionNotification[];
}

const DEDUPLICATION_WINDOW_MILLIS = 60_000;
const MONITOR_COOLDOWN_MILLIS = 30_000;
const MAXIMUM_PER_FIVE_MINUTES = 12;
const MAXIMUM_SESSION_NOTIFICATIONS = 30;

export class SessionNotificationDeliveryService
  implements NotificationDeliveryService
{
  enqueue(
    alerts: readonly MonitoringAlert[],
    monitors: readonly Monitor[],
    existing: readonly SessionNotification[],
    preferences: NotificationPreferences,
    now: number,
  ): readonly SessionNotification[] {
    const monitorById = new Map(monitors.map((monitor) => [monitor.id, monitor]));
    const next: SessionNotification[] = [...existing];

    for (const alert of alerts) {
      const monitor = monitorById.get(alert.monitorId);
      if (!monitor) continue;
      if (next.some((notification) => notification.alertId === alert.id)) {
        continue;
      }
      const suppressionReason = suppressionReasonFor(
        alert,
        monitor,
        next,
        preferences,
        now,
      );
      next.unshift({
        id: `notification:${alert.id}`,
        alertId: alert.id,
        monitorId: alert.monitorId,
        monitorKind: monitor.kind,
        createdAtEpochMillis: alert.timestampEpochMillis,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        reason: triggerReason(alert.trigger),
        target: targetFor(monitor),
        status: suppressionReason
          ? "suppressed"
          : preferences.inAppEnabled || preferences.browserEnabled
            ? "delivered"
            : "queued",
        browserDeliveryStatus: "not-requested",
        suppressionReason,
      });
    }

    const unique = new Map<string, SessionNotification>();
    for (const notification of next) {
      if (!unique.has(notification.id)) unique.set(notification.id, notification);
    }
    return [...unique.values()]
      .sort((left, right) => right.createdAtEpochMillis - left.createdAtEpochMillis)
      .slice(0, MAXIMUM_SESSION_NOTIFICATIONS);
  }
}

function suppressionReasonFor(
  alert: MonitoringAlert,
  monitor: Monitor,
  existing: readonly SessionNotification[],
  preferences: NotificationPreferences,
  now: number,
): string | null {
  if (!preferences.enabledMonitorKinds[monitor.kind]) return "monitor-type-disabled";
  if (alert.severity === "notice" && !preferences.importantAlertsEnabled) {
    return "important-alerts-disabled";
  }
  if (alert.severity === "info" && !preferences.normalAlertsEnabled) {
    return "normal-alerts-disabled";
  }
  if (isQuietPeriod(preferences, now)) return "quiet-period";
  if (
    existing.some(
      (notification) =>
        notification.alertId === alert.id ||
        (notification.monitorId === alert.monitorId &&
          notification.title === alert.title &&
          now - notification.createdAtEpochMillis < DEDUPLICATION_WINDOW_MILLIS),
    )
  ) {
    return "duplicate";
  }
  if (
    existing.some(
      (notification) =>
        notification.monitorId === alert.monitorId &&
        now - notification.createdAtEpochMillis < MONITOR_COOLDOWN_MILLIS,
    )
  ) {
    return "monitor-cooldown";
  }
  if (
    existing.filter(
      (notification) =>
        notification.status !== "suppressed" &&
        now - notification.createdAtEpochMillis < 5 * 60_000,
    ).length >= MAXIMUM_PER_FIVE_MINUTES
  ) {
    return "session-rate-limit";
  }
  return null;
}

function isQuietPeriod(
  preferences: NotificationPreferences,
  now: number,
): boolean {
  const period = preferences.quietPeriod;
  if (!period) return false;
  const hour = new Date(now).getHours();
  return period.startHour <= period.endHour
    ? hour >= period.startHour && hour < period.endHour
    : hour >= period.startHour || hour < period.endHour;
}

function targetFor(monitor: Monitor): NotificationTarget {
  const context = monitor.targetContext;
  if (!context) return null;
  if (context.kind === "aircraft") return context;
  if (context.kind === "airport") {
    return { kind: "airport", icaoCode: context.icaoCode };
  }
  if (context.kind === "region") return { kind: "region" };
  return { kind: "pattern" };
}

function triggerReason(trigger: MonitoringAlert["trigger"]): string {
  return trigger.replaceAll("-", " ");
}

export const NOTIFICATION_DELIVERY_LIMITS = {
  deduplicationWindowMillis: DEDUPLICATION_WINDOW_MILLIS,
  monitorCooldownMillis: MONITOR_COOLDOWN_MILLIS,
  maximumPerFiveMinutes: MAXIMUM_PER_FIVE_MINUTES,
  maximumSessionNotifications: MAXIMUM_SESSION_NOTIFICATIONS,
} as const;
