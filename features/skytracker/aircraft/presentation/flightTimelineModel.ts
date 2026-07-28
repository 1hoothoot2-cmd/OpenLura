import type { Aircraft } from "../domain/aircraft.ts";
import {
  flightPhaseLabel,
} from "../domain/flightPhase.ts";
import type {
  FlightPhaseSession,
  ObservedFlightStage,
} from "../domain/flightPhaseSession.ts";

export type FlightTimelineStep = Readonly<{
  id: string;
  label: string;
  status: "CONFIRMED" | "CURRENT" | "UPCOMING" | "UNKNOWN";
  detail: string;
}>;

export type FlightTimelineModel = Readonly<{
  currentPhaseLabel: string;
  detectedAtLabel: string;
  steps: readonly FlightTimelineStep[];
}>;

const TIMELINE_PHASES: readonly Readonly<{
  id: string;
  label: string;
  stage?: ObservedFlightStage;
}>[] = [
  { id: "ground", label: "Ground", stage: "GROUND" },
  { id: "pushback", label: "Pushback" },
  { id: "taxi", label: "Taxi", stage: "TAXI" },
  { id: "take-off", label: "Take-off", stage: "TAKE_OFF" },
  { id: "climb", label: "Climb", stage: "CLIMB" },
  { id: "cruise", label: "Cruise", stage: "CRUISE" },
  { id: "descent", label: "Descent", stage: "DESCENT" },
  { id: "landing", label: "Landing", stage: "LANDING" },
  { id: "taxi-in", label: "Taxi in", stage: "TAXI_IN" },
  { id: "gate", label: "Gate" },
];

export function createFlightTimelineModel(
  aircraft: Aircraft,
  session: FlightPhaseSession,
): FlightTimelineModel {
  const detectedAtLabel = formatDetectedAt(session.detectedAtEpochMillis);
  const currentIndex = TIMELINE_PHASES.findIndex(
    (step) => step.stage === session.currentStage,
  );
  const postFlightGround =
    session.currentStage === "GROUND" &&
    session.confirmedStages.has("LANDING");

  return {
    currentPhaseLabel: flightPhaseLabel(session.currentPhase),
    detectedAtLabel,
    steps: [
      {
        id: "detected",
        label: "Flight detected",
        status: "CONFIRMED",
        detail: `Confirmed · ${detectedAtLabel}`,
      },
      ...(session.currentStage === null
        ? [
            {
              id: "unknown-current",
              label: "Unknown phase",
              status: "CURRENT" as const,
              detail: "Current phase",
            },
          ]
        : []),
      ...TIMELINE_PHASES.map((step, index): FlightTimelineStep => {
        if (step.stage === session.currentStage) {
          return {
            id: step.id,
            label: step.label,
            status: "CURRENT",
            detail: "Current phase",
          };
        }
        if (step.stage && session.confirmedStages.has(step.stage)) {
          return {
            id: step.id,
            label: step.label,
            status: "CONFIRMED",
            detail: "Confirmed",
          };
        }
        if (!postFlightGround && currentIndex >= 0 && index > currentIndex) {
          return {
            id: step.id,
            label: step.label,
            status: "UPCOMING",
            detail: "Upcoming",
          };
        }
        return {
          id: step.id,
          label: step.label,
          status: "UNKNOWN",
          detail: "History unavailable",
        };
      }),
    ],
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
