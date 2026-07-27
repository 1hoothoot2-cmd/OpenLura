import type { Aircraft } from "../domain/aircraft.ts";
import {
  determineFlightPhase,
  flightPhaseLabel,
  type FlightPhase,
} from "../domain/flightPhase.ts";

export type FlightTimelineStep = Readonly<{
  id: string;
  label: string;
  state: "detected" | "current" | "unavailable";
  detail: string;
}>;

export type FlightTimelineModel = Readonly<{
  phase: FlightPhase;
  currentPhaseLabel: string;
  detectedAtLabel: string;
  steps: readonly FlightTimelineStep[];
}>;

const TIMELINE_PHASES: readonly Readonly<{
  id: string;
  label: string;
  phase?: FlightPhase;
}>[] = [
  { id: "detected", label: "Flight detected" },
  { id: "pushback", label: "Pushback" },
  { id: "taxi", label: "Taxi", phase: "TAXI" },
  { id: "take-off", label: "Take-off", phase: "TAKE_OFF" },
  { id: "climb", label: "Climb", phase: "CLIMB" },
  { id: "cruise", label: "Cruise", phase: "CRUISE" },
  { id: "descent", label: "Descent", phase: "DESCENT" },
  { id: "landing", label: "Landing", phase: "LANDING" },
  { id: "taxi-in", label: "Taxi in" },
  { id: "gate", label: "Gate" },
];

export function createFlightTimelineModel(
  aircraft: Aircraft,
  detectedAtEpochMillis = aircraft.positionTimestampEpochMillis,
): FlightTimelineModel {
  const phase = determineFlightPhase(aircraft);
  const detectedAtLabel = formatDetectedAt(detectedAtEpochMillis);

  return {
    phase,
    currentPhaseLabel: flightPhaseLabel(phase),
    detectedAtLabel,
    steps: TIMELINE_PHASES.map((step) => {
      if (step.id === "detected") {
        return {
          id: step.id,
          label: step.label,
          state: "detected",
          detail: detectedAtLabel,
        };
      }
      if (step.phase && step.phase === phase) {
        return {
          id: step.id,
          label: step.label,
          state: "current",
          detail: "Current phase",
        };
      }
      return {
        id: step.id,
        label: step.label,
        state: "unavailable",
        detail: "Not available",
      };
    }),
  };
}

function formatDetectedAt(epochMillis: number) {
  if (!Number.isFinite(epochMillis) || epochMillis <= 0) {
    return "Time not available";
  }
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(epochMillis));
}
