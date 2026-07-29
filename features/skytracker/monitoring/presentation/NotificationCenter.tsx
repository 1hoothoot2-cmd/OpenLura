"use client";

import type { MonitorKind } from "../domain/monitoring";
import type {
  NotificationPreferences,
  SessionNotification,
} from "../domain/notificationDelivery";
import type { BrowserNotificationPermission } from "../infrastructure/browserNotificationAdapter";

export type NotificationCenterProps = {
  notifications: readonly SessionNotification[];
  preferences: NotificationPreferences;
  browserPermission: BrowserNotificationPermission;
  contextMessage: string;
  onEnableBrowser: () => void;
  onUpdatePreferences: (preferences: NotificationPreferences) => void;
  onRead: (notificationId: string) => void;
  onDismiss: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
  onOpen: (notification: SessionNotification) => void;
};

const MONITOR_KIND_LABELS: Readonly<Record<MonitorKind, string>> = {
  flight: "Flights",
  aircraft: "Aircraft",
  airport: "Airports",
  weather: "Weather",
  spotter: "Spotting",
  news: "News",
};

export function NotificationCenter(props: NotificationCenterProps) {
  const visible = props.notifications.filter(
    (notification) =>
      notification.status !== "dismissed" &&
      notification.status !== "suppressed",
  );
  const unread = visible.filter(
    (notification) => notification.status === "delivered",
  ).length;

  return (
    <section
      aria-labelledby="notification-center-heading"
      className="mt-4 border-t border-amber-100/10 pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="notification-center-heading"
          className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40"
        >
          Notifications
        </h3>
        <span
          aria-label={`${unread} unread notifications`}
          className="rounded-full bg-amber-200/10 px-2 py-0.5 text-[10px] text-amber-100/70"
        >
          {unread}
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-4 text-white/38">
        Notifications work while SkyTracker is open.
      </p>

      <NotificationPreferencesPanel {...props} />

      {visible.length > 0 ? (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={props.onMarkAllRead} className={smallButtonClass}>
              Mark all as read
            </button>
            <button type="button" onClick={props.onClear} className={smallButtonClass}>
              Clear
            </button>
          </div>
          <ol aria-live="polite" className="mt-2 max-h-56 space-y-2 overflow-y-auto">
            {visible.map((notification) => (
              <li
                key={notification.id}
                className={`rounded-xl border p-2.5 ${
                  notification.severity === "notice"
                    ? "border-amber-100/16 bg-amber-100/[0.045]"
                    : "border-cyan-100/10 bg-cyan-100/[0.025]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => props.onOpen(notification)}
                  className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span dir="auto" className="text-xs font-medium text-white/78">
                      {notification.title}
                    </span>
                    <time
                      dateTime={new Date(notification.createdAtEpochMillis).toISOString()}
                      className="shrink-0 text-[10px] text-white/34"
                    >
                      {formatTime(notification.createdAtEpochMillis)}
                    </time>
                  </span>
                  <span dir="auto" className="mt-1 block text-[11px] leading-4 text-white/50">
                    {notification.description}
                  </span>
                  <span dir="auto" className="mt-1 block text-[9px] uppercase tracking-[0.1em] text-cyan-100/38">
                    {notification.reason} · {notification.status === "read" ? "read" : "unread"}
                  </span>
                </button>
                <div className="mt-2 flex gap-1.5">
                  {notification.status !== "read" && (
                    <button type="button" onClick={() => props.onRead(notification.id)} className={smallButtonClass}>
                      Read
                    </button>
                  )}
                  <button type="button" onClick={() => props.onDismiss(notification.id)} className={smallButtonClass}>
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="mt-2 rounded-xl border border-white/[0.06] px-3 py-2 text-[11px] text-white/42">
          No session notifications yet.
        </p>
      )}
      {props.contextMessage && (
        <p role="status" className="mt-2 text-[11px] text-cyan-100/62">
          {props.contextMessage}
        </p>
      )}
    </section>
  );
}

function NotificationPreferencesPanel(props: NotificationCenterProps) {
  const preferences = props.preferences;
  const update = (partial: Partial<NotificationPreferences>) =>
    props.onUpdatePreferences({ ...preferences, ...partial });

  return (
    <details className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
      <summary className="cursor-pointer text-[10px] font-medium text-white/58">
        Notification preferences
      </summary>
      <div className="mt-2 space-y-2 text-[11px] text-white/58">
        <PreferenceToggle
          label="In-app notifications"
          checked={preferences.inAppEnabled}
          onChange={(checked) => update({ inAppEnabled: checked })}
        />
        <div>
          <p>Browser notifications</p>
          <p className="mt-0.5 text-[10px] text-white/35">
            Permission is requested only when you choose to enable this.
          </p>
          {props.browserPermission === "granted" ? (
            <PreferenceToggle
              label="Notifications on"
              checked={preferences.browserEnabled}
              onChange={(checked) => update({ browserEnabled: checked })}
            />
          ) : (
            <button type="button" onClick={props.onEnableBrowser} className={`${smallButtonClass} mt-1.5`}>
              Enable browser notifications
            </button>
          )}
          {props.browserPermission === "denied" && (
            <p className="mt-1 text-[10px] text-amber-100/60">
              Permission was denied. You can change it in your browser settings.
            </p>
          )}
          {props.browserPermission === "unsupported" && (
            <p className="mt-1 text-[10px] text-white/38">
              Browser notifications are not supported here.
            </p>
          )}
        </div>
        <PreferenceToggle
          label="Normal alerts"
          checked={preferences.normalAlertsEnabled}
          onChange={(checked) => update({ normalAlertsEnabled: checked })}
        />
        <PreferenceToggle
          label="Important alerts"
          checked={preferences.importantAlertsEnabled}
          onChange={(checked) => update({ importantAlertsEnabled: checked })}
        />
        <PreferenceToggle
          label="Quiet period 22:00–07:00"
          checked={preferences.quietPeriod !== null}
          onChange={(checked) =>
            update({
              quietPeriod: checked ? { startHour: 22, endHour: 7 } : null,
            })
          }
        />
        <div>
          <p className="mb-1">Monitor types</p>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(MONITOR_KIND_LABELS) as MonitorKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={preferences.enabledMonitorKinds[kind]}
                onClick={() =>
                  update({
                    enabledMonitorKinds: {
                      ...preferences.enabledMonitorKinds,
                      [kind]: !preferences.enabledMonitorKinds[kind],
                    },
                  })
                }
                className={`${smallButtonClass} aria-pressed:border-cyan-200/30 aria-pressed:text-cyan-50/75`}
              >
                {MONITOR_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

function PreferenceToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-8 items-center justify-between gap-3">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-cyan-300"
      />
    </label>
  );
}

const smallButtonClass =
  "min-h-8 rounded-lg border border-white/10 px-2 text-[10px] text-white/56 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300";

function formatTime(epochMillis: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(epochMillis);
}
