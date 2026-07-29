"use client";

import type { MonitoringAlert } from "../domain/alert";

export type AlertCenterProps = {
  alerts: readonly MonitoringAlert[];
  onDismiss: (alertId: string) => void;
  onClear: () => void;
};

export function AlertCenter({ alerts, onDismiss, onClear }: AlertCenterProps) {
  const visible = alerts.filter((alert) => alert.status !== "dismissed");
  if (visible.length === 0) return null;

  return (
    <section
      aria-labelledby="monitoring-alerts-heading"
      className="mt-4 border-t border-amber-100/10 pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="monitoring-alerts-heading"
          className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40"
        >
          Alerts
        </h3>
        <div className="flex items-center gap-2">
          <span
            aria-label={`${visible.length} active alerts`}
            className="rounded-full bg-amber-200/10 px-2 py-0.5 text-[10px] text-amber-100/70"
          >
            {visible.length}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="min-h-8 rounded-lg px-2 text-[10px] text-white/48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            Clear
          </button>
        </div>
      </div>
      <ol aria-live="polite" className="mt-2 max-h-56 space-y-2 overflow-y-auto">
        {visible.map((alert) => (
          <li
            key={alert.id}
            className="motion-safe:animate-[pulse_600ms_ease-out_1] rounded-xl border border-amber-100/10 bg-amber-100/[0.035] p-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/78">{alert.title}</p>
                <p className="mt-1 text-[11px] leading-4 text-white/50">
                  {alert.description}
                </p>
              </div>
              <time
                dateTime={new Date(alert.timestampEpochMillis).toISOString()}
                className="shrink-0 text-[10px] text-white/34"
              >
                {formatAlertTime(alert.timestampEpochMillis)}
              </time>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(alert.id)}
              className="mt-2 min-h-8 rounded-lg border border-white/10 px-2 text-[10px] text-white/54 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Dismiss
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function formatAlertTime(epochMillis: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(epochMillis);
}
