import type { Aircraft } from "./aircraft.ts";

export type AircraftValidationIssue = Readonly<{
  id: string;
  reason: string;
}>;

export type AircraftValidationResult = Readonly<{
  validAircraft: readonly Aircraft[];
  issues: readonly AircraftValidationIssue[];
}>;

export function validateAircraftSnapshot(
  aircraft: readonly Aircraft[],
): AircraftValidationResult {
  const ids = new Set<string>();
  const validAircraft: Aircraft[] = [];
  const issues: AircraftValidationIssue[] = [];

  for (const item of aircraft) {
    const reason = validateAircraft(item, ids);
    if (reason) {
      issues.push({ id: item.id || "(empty)", reason });
      continue;
    }

    ids.add(item.id);
    validAircraft.push(item);
  }

  return { validAircraft, issues };
}

function validateAircraft(
  aircraft: Aircraft,
  existingIds: ReadonlySet<string>,
): string | null {
  if (!aircraft.id.trim()) return "Aircraft ID must not be empty";
  if (existingIds.has(aircraft.id)) return "Aircraft ID must be unique";
  if (!isFiniteInRange(aircraft.latitudeDegrees, -90, 90)) {
    return "Latitude must be finite and between -90 and 90";
  }
  if (!isFiniteInRange(aircraft.longitudeDegrees, -180, 180)) {
    return "Longitude must be finite and between -180 and 180";
  }
  if (
    aircraft.headingDegrees !== null &&
    !isFiniteInRange(aircraft.headingDegrees, 0, 360)
  ) {
    return "Heading must be finite and between 0 and 360";
  }
  if (
    !Number.isFinite(aircraft.positionTimestampEpochMillis) ||
    aircraft.positionTimestampEpochMillis < 0
  ) {
    return "Position timestamp must be a non-negative finite number";
  }

  const optionalNumbers = [
    aircraft.altitudeMeters,
    aircraft.groundSpeedMetersPerSecond,
  ];
  if (optionalNumbers.some((value) => value !== null && !Number.isFinite(value))) {
    return "Optional numeric values must be finite";
  }

  return null;
}

function isFiniteInRange(value: number, minimum: number, maximum: number) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}
