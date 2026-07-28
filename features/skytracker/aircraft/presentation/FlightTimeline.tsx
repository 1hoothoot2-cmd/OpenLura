import type { Aircraft } from "../domain/aircraft";
import type { FlightPhaseSession } from "../domain/flightPhaseSession";
import { aircraftDetailItems } from "./aircraftDetails";
import { createFlightTimelineModel } from "./flightTimelineModel";

type FlightTimelineProps = {
  aircraft: Aircraft;
  session: FlightPhaseSession;
};

const SUMMARY_LABELS = new Set([
  "Altitude",
  "Ground speed",
  "Vertical rate",
  "Heading",
  "Lifecycle",
]);

export function FlightTimeline({
  aircraft,
  session,
}: FlightTimelineProps) {
  const model = createFlightTimelineModel(aircraft, session);
  const summary = aircraftDetailItems(aircraft).filter((item) =>
    SUMMARY_LABELS.has(item.label),
  );

  return (
    <section
      aria-labelledby="flight-timeline-heading"
      className="mt-5 border-t border-white/[0.07] pt-5"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/48">
          Current flight phase
        </p>
        <h2
          id="flight-timeline-heading"
          className="mt-1 text-base font-semibold text-white/90"
        >
          Flight Timeline
        </h2>
        <p
          role="status"
          aria-live="polite"
          className="mt-2 text-sm font-medium text-cyan-100"
        >
          {model.currentPhaseLabel}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
        {summary.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[9px] font-semibold uppercase tracking-[0.11em] text-white/34">
              {item.label}
            </dt>
            <dd className="mt-1 break-words text-xs text-white/70">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      <ol aria-label="Flight timeline" className="mt-5">
        {model.steps.map((step, index) => {
          const current = step.status === "CURRENT";
          const confirmed = step.status === "CONFIRMED";
          const upcoming = step.status === "UPCOMING";
          return (
            <li
              key={step.id}
              aria-current={current ? "step" : undefined}
              className="relative grid min-h-14 grid-cols-[1.25rem_1fr] gap-3"
            >
              {index < model.steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[0.34375rem] top-4 h-[calc(100%-0.1rem)] w-px bg-white/10"
                />
              )}
              <span
                aria-hidden="true"
                className={`relative z-10 mt-1 flex h-3 w-3 items-center justify-center rounded-full border text-[8px] leading-none ${
                  current
                    ? "border-cyan-200 bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.5)]"
                    : confirmed
                      ? "border-cyan-200/45 bg-cyan-200/18 text-cyan-50"
                      : upcoming
                        ? "border-white/30 bg-[#0a111c]"
                        : "border-transparent bg-white/[0.04] text-white/42"
                }`}
              >
                {confirmed ? "✓" : step.status === "UNKNOWN" ? "–" : ""}
              </span>
              <div className="pb-4">
                <p
                  className={`text-sm font-medium ${
                    current ? "text-cyan-50" : "text-white/70"
                  }`}
                >
                  {step.label}
                </p>
                <p
                  className={`mt-0.5 text-xs ${
                    step.status === "UNKNOWN" ? "text-white/30" : "text-white/42"
                  }`}
                >
                  {step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
