"use client";

import type { Monitor } from "../domain/monitoring";
import { monitorPresentationStatus } from "../application/liveMonitoringSession";

export type MonitoringPanelProps = {
  monitors: readonly Monitor[];
  onPause: (monitorId: string) => void;
  onResume: (monitorId: string) => void;
  onStop: (monitorId: string) => void;
};

export function MonitoringPanel({
  monitors,
  onPause,
  onResume,
  onStop,
}: MonitoringPanelProps) {
  const visible = monitors.filter((monitor) => monitor.state.status !== "disabled");
  if (visible.length === 0) return null;

  return (
    <section
      aria-labelledby="active-monitors-heading"
      className="mt-4 border-t border-white/[0.07] pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="active-monitors-heading"
          className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40"
        >
          Active Monitors
        </h3>
        <span className="rounded-full bg-cyan-200/[0.08] px-2 py-0.5 text-[10px] text-cyan-100/65">
          {visible.length}
        </span>
      </div>
      <ul className="mt-2 space-y-2">
        {visible.map((monitor) => {
          const status = monitorPresentationStatus(monitor.state.status);
          return (
            <li
              key={monitor.id}
              className="rounded-xl border border-cyan-200/10 bg-cyan-200/[0.025] p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-white/76">
                    {monitor.target.label}
                  </p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-cyan-100/45">
                    {monitor.kind} · {status}
                  </p>
                </div>
                <span className="text-[10px] text-white/35">
                  {formatMonitorTime(
                    monitor.state.lastEvaluatedAtEpochMillis ??
                      monitor.createdAtEpochMillis,
                  )}
                </span>
              </div>
              <div className="mt-2 flex gap-1.5">
                {status === "paused" ? (
                  <button
                    type="button"
                    onClick={() => onResume(monitor.id)}
                    className="min-h-8 rounded-lg border border-cyan-200/14 px-2 text-[10px] text-cyan-50/70"
                  >
                    Resume
                  </button>
                ) : status === "watching" ? (
                  <button
                    type="button"
                    onClick={() => onPause(monitor.id)}
                    className="min-h-8 rounded-lg border border-white/10 px-2 text-[10px] text-white/58"
                  >
                    Pause
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onStop(monitor.id)}
                  className="min-h-8 rounded-lg border border-white/10 px-2 text-[10px] text-white/58"
                >
                  Stop
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function formatMonitorTime(epochMillis: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(epochMillis);
}
