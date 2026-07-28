import type { Aircraft, AircraftLifecycle } from "./aircraft.ts";

export const LIVE_POSITION_MAXIMUM_AGE_MILLIS = 60_000;
export const PREDICTED_POSITION_MAXIMUM_AGE_MILLIS = 120_000;
export const STALE_POSITION_MAXIMUM_AGE_MILLIS = 420_000;

export function classifyAircraftLifecycle(
  aircraft: Pick<Aircraft, "lifecycle" | "positionTimestampEpochMillis">,
  epochMillis: number,
): Exclude<AircraftLifecycle, "FRESH"> {
  const ageMillis = Math.max(
    0,
    epochMillis - aircraft.positionTimestampEpochMillis,
  );
  if (aircraft.lifecycle === "LOST") return "LOST";
  if (aircraft.lifecycle === "STALE") {
    return ageMillis > STALE_POSITION_MAXIMUM_AGE_MILLIS ? "LOST" : "STALE";
  }
  if (ageMillis <= LIVE_POSITION_MAXIMUM_AGE_MILLIS) return "LIVE";
  if (ageMillis <= PREDICTED_POSITION_MAXIMUM_AGE_MILLIS) return "PREDICTED";
  if (ageMillis <= STALE_POSITION_MAXIMUM_AGE_MILLIS) return "STALE";
  return "LOST";
}

export function applyAircraftLifecycle(
  aircraft: Aircraft,
  epochMillis: number,
): Aircraft {
  const lifecycle = classifyAircraftLifecycle(aircraft, epochMillis);
  return aircraft.lifecycle === lifecycle ? aircraft : { ...aircraft, lifecycle };
}

export function applyAircraftLifecycles(
  aircraft: readonly Aircraft[],
  epochMillis: number,
): readonly Aircraft[] {
  let changed = false;
  const next = aircraft.map((item) => {
    const classified = applyAircraftLifecycle(item, epochMillis);
    if (classified !== item) changed = true;
    return classified;
  });
  return changed ? next : aircraft;
}

export function aircraftLifecycleLabel(
  lifecycle: AircraftLifecycle | undefined,
) {
  switch (lifecycle) {
    case "FRESH":
    case "LIVE":
      return "Live";
    case "PREDICTED":
      return "Predicted";
    case "STALE":
      return "Stale";
    case "LOST":
      return "Lost";
    default:
      return "Unknown";
  }
}
