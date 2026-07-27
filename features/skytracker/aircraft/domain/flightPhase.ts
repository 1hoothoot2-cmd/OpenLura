import type { Aircraft } from "./aircraft.ts";

export type FlightPhase =
  | "GROUND"
  | "TAXI"
  | "TAKE_OFF"
  | "CLIMB"
  | "CRUISE"
  | "DESCENT"
  | "LANDING"
  | "UNKNOWN";

const TAXI_SPEED_METERS_PER_SECOND = 5;
const AIRBORNE_SPEED_METERS_PER_SECOND = 35;
const LOW_ALTITUDE_METERS = 1_000;
const CRUISE_ALTITUDE_METERS = 3_000;
const CLIMB_RATE_METERS_PER_SECOND = 1.5;
const DESCENT_RATE_METERS_PER_SECOND = -1.5;

export function determineFlightPhase(aircraft: Aircraft): FlightPhase {
  const speed = finite(aircraft.groundSpeedMetersPerSecond);
  const altitude = finite(aircraft.altitudeMeters);
  const verticalRate = finite(aircraft.verticalRateMetersPerSecond ?? null);

  if (aircraft.onGround) {
    if (speed === null) return "GROUND";
    return speed >= TAXI_SPEED_METERS_PER_SECOND ? "TAXI" : "GROUND";
  }

  if (speed === null || altitude === null || verticalRate === null) {
    return "UNKNOWN";
  }

  if (
    altitude < LOW_ALTITUDE_METERS &&
    speed >= AIRBORNE_SPEED_METERS_PER_SECOND
  ) {
    if (verticalRate > CLIMB_RATE_METERS_PER_SECOND) return "TAKE_OFF";
    if (verticalRate < DESCENT_RATE_METERS_PER_SECOND) return "LANDING";
  }
  if (verticalRate > CLIMB_RATE_METERS_PER_SECOND) return "CLIMB";
  if (verticalRate < DESCENT_RATE_METERS_PER_SECOND) return "DESCENT";
  if (
    altitude >= CRUISE_ALTITUDE_METERS &&
    speed >= AIRBORNE_SPEED_METERS_PER_SECOND
  ) {
    return "CRUISE";
  }
  return "UNKNOWN";
}

export function flightPhaseLabel(phase: FlightPhase) {
  switch (phase) {
    case "GROUND":
      return "Ground";
    case "TAXI":
      return "Taxi";
    case "TAKE_OFF":
      return "Take-off";
    case "CLIMB":
      return "Climb";
    case "CRUISE":
      return "Cruise";
    case "DESCENT":
      return "Descent";
    case "LANDING":
      return "Landing";
    case "UNKNOWN":
      return "Unknown";
  }
}

function finite(value: number | null) {
  return value !== null && Number.isFinite(value) ? value : null;
}
