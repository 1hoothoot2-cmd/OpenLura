import type { Aircraft, AircraftId } from "./aircraft.ts";
import {
  determineFlightPhase,
  type FlightPhase,
} from "./flightPhase.ts";

export type ObservedFlightStage =
  | "GROUND"
  | "TAXI"
  | "TAKE_OFF"
  | "CLIMB"
  | "CRUISE"
  | "DESCENT"
  | "LANDING"
  | "TAXI_IN";

export type FlightPhaseSession = Readonly<{
  aircraftId: AircraftId;
  detectedAtEpochMillis: number;
  currentPhase: FlightPhase;
  currentStage: ObservedFlightStage | null;
  confirmedStages: ReadonlySet<ObservedFlightStage>;
}>;

export type FlightPhaseSessions = ReadonlyMap<AircraftId, FlightPhaseSession>;

export function updateFlightPhaseSessions(
  previous: FlightPhaseSessions,
  aircraft: readonly Aircraft[],
): FlightPhaseSessions {
  const next = new Map<AircraftId, FlightPhaseSession>();

  for (const item of aircraft) {
    const phase = determineFlightPhase(item);
    const existing = previous.get(item.id);
    if (!existing) {
      next.set(item.id, {
        aircraftId: item.id,
        detectedAtEpochMillis: item.positionTimestampEpochMillis,
        currentPhase: phase,
        currentStage: stageForPhase(phase, new Set()),
        confirmedStages: new Set(),
      });
      continue;
    }
    if (existing.currentPhase === phase) {
      next.set(item.id, existing);
      continue;
    }

    const confirmedStages = new Set(existing.confirmedStages);
    if (existing.currentStage) confirmedStages.add(existing.currentStage);
    next.set(item.id, {
      ...existing,
      currentPhase: phase,
      currentStage: stageForPhase(phase, confirmedStages),
      confirmedStages,
    });
  }

  return sessionsEqual(previous, next) ? previous : next;
}

function stageForPhase(
  phase: FlightPhase,
  confirmedStages: ReadonlySet<ObservedFlightStage>,
): ObservedFlightStage | null {
  if (phase === "UNKNOWN") return null;
  if (phase === "TAXI" && confirmedStages.has("LANDING")) return "TAXI_IN";
  return phase;
}

function sessionsEqual(
  left: FlightPhaseSessions,
  right: FlightPhaseSessions,
) {
  if (left.size !== right.size) return false;
  for (const [id, next] of right) {
    const current = left.get(id);
    if (
      !current ||
      current.currentPhase !== next.currentPhase ||
      current.currentStage !== next.currentStage ||
      current.detectedAtEpochMillis !== next.detectedAtEpochMillis ||
      !setsEqual(current.confirmedStages, next.confirmedStages)
    ) {
      return false;
    }
  }
  return true;
}

function setsEqual<T>(left: ReadonlySet<T>, right: ReadonlySet<T>) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}
