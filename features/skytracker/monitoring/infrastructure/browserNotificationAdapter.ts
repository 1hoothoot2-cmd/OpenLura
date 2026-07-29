import type {
  NotificationDeliveryAdapter,
} from "../application/notificationDeliveryService.ts";
import type { SessionNotification } from "../domain/notificationDelivery.ts";

export type BrowserNotificationPermission =
  | NotificationPermission
  | "unsupported";

export interface BrowserNotificationAdapter
  extends NotificationDeliveryAdapter {
  permission(): BrowserNotificationPermission;
  requestPermission(): Promise<BrowserNotificationPermission>;
}

export function createBrowserNotificationAdapter(): BrowserNotificationAdapter {
  return {
    permission() {
      return typeof window === "undefined" || !("Notification" in window)
        ? "unsupported"
        : window.Notification.permission;
    },
    async requestPermission() {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return "unsupported";
      }
      return window.Notification.requestPermission();
    },
    async deliver(notification) {
      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        window.Notification.permission !== "granted"
      ) {
        return "suppressed";
      }
      try {
        const notificationTime = new Date(
          notification.createdAtEpochMillis,
        ).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
        const browserNotification = new window.Notification(
          `SkyTracker · ${notification.title}`,
          {
            body: `${notification.description} · ${notificationTime}`,
            tag: notification.id,
            data: { url: notificationUrl(notification) },
          },
        );
        browserNotification.onclick = () => {
          window.focus();
          window.location.assign(notificationUrl(notification));
          browserNotification.close();
        };
        return "delivered";
      } catch {
        return "failed";
      }
    },
  };
}

function notificationUrl(notification: SessionNotification): string {
  return notification.target?.kind === "aircraft"
    ? `/skytracker/live?aircraft=${encodeURIComponent(notification.target.aircraftId)}`
    : "/skytracker/live";
}
