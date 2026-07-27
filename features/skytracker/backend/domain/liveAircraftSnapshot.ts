import { aircraftId, type Aircraft, type AircraftCategory } from "../../aircraft/domain/aircraft.ts";

export type LiveAircraftSnapshot = Readonly<{
  snapshotId: string;
  generatedAtEpochMillis: number;
  aircraft: readonly Aircraft[];
  rawAircraftCount: number;
  rejectedAircraftCount: number;
}>;

const CATEGORIES = new Set<AircraftCategory>([
  "passenger",
  "cargo",
  "business",
  "helicopter",
  "unknown",
]);

export function parseLiveAircraftSnapshot(value: unknown): LiveAircraftSnapshot {
  if (!isRecord(value) || !nonEmpty(value.snapshotId) || !validTimestamp(value.generatedAt)) {
    throw new Error("Malformed aircraft snapshot");
  }
  if (!Array.isArray(value.aircraft)) throw new Error("Malformed aircraft snapshot");

  const ids = new Set<string>();
  const aircraft: Aircraft[] = [];
  for (const candidate of value.aircraft) {
    const mapped = parseAircraft(candidate);
    if (!mapped || ids.has(mapped.id)) continue;
    ids.add(mapped.id);
    aircraft.push(mapped);
  }
  return {
    snapshotId: value.snapshotId.trim(),
    generatedAtEpochMillis: value.generatedAt,
    aircraft,
    rawAircraftCount: value.aircraft.length,
    rejectedAircraftCount: value.aircraft.length - aircraft.length,
  };
}

function parseAircraft(value: unknown): Aircraft | null {
  if (
    !isRecord(value) ||
    !nonEmpty(value.id) ||
    !finiteRange(value.latitude, -90, 90) ||
    !finiteRange(value.longitude, -180, 180) ||
    !validTimestamp(value.positionTimestamp) ||
    !optionalRange(value.heading, 0, 360) ||
    !optionalNonNegative(value.groundSpeed) ||
    !optionalFinite(value.altitude) ||
    !optionalFinite(value.verticalRate) ||
    typeof value.onGround !== "boolean" ||
    !optionalString(value.callsign) ||
    !optionalString(value.registration) ||
    !optionalCategory(value.category) ||
    (value.lifecycle !== "FRESH" && value.lifecycle !== "STALE")
  ) {
    return null;
  }
  return {
    id: aircraftId(value.id),
    latitudeDegrees: value.latitude,
    longitudeDegrees: value.longitude,
    headingDegrees: value.heading === 360 ? 0 : (value.heading ?? null),
    groundSpeedMetersPerSecond: value.groundSpeed ?? null,
    altitudeMeters: value.altitude ?? null,
    verticalRateMetersPerSecond: value.verticalRate ?? null,
    callsign: clean(value.callsign),
    registration: clean(value.registration),
    category: value.category ?? "unknown",
    lifecycle: value.lifecycle,
    onGround: value.onGround,
    positionTimestampEpochMillis: value.positionTimestamp,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function validTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function finiteRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
function optionalRange(value: unknown, min: number, max: number): value is number | null | undefined {
  return value == null || finiteRange(value, min, max);
}
function optionalFinite(value: unknown): value is number | null | undefined {
  return value == null || (typeof value === "number" && Number.isFinite(value));
}
function optionalNonNegative(value: unknown): value is number | null | undefined {
  return optionalFinite(value) && (value == null || value >= 0);
}
function optionalString(value: unknown): value is string | null | undefined {
  return value == null || nonEmpty(value);
}
function optionalCategory(value: unknown): value is AircraftCategory | null | undefined {
  return value == null || (typeof value === "string" && CATEGORIES.has(value as AircraftCategory));
}
function clean(value: string | null | undefined) {
  return value?.trim() || null;
}
