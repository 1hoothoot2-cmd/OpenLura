export type TrackCompleteness = "COMPLETE" | "PARTIAL" | "UNKNOWN";

export type HistoricalTrackPoint = Readonly<{
  latitudeDegrees: number;
  longitudeDegrees: number;
  observedAtEpochSeconds: number;
}>;

export type HistoricalTrackSegment = Readonly<{
  startIndex: number;
  endIndex: number;
  reason:
    | "CONTINUOUS"
    | "TIME_GAP"
    | "DISTANCE_JUMP"
    | "INVALID_POINT_REMOVED"
    | "PROVIDER_GAP";
}>;

export type HistoricalTrack = Readonly<{
  flightId: string;
  aircraftId: string;
  provider: string;
  points: readonly HistoricalTrackPoint[];
  segments: readonly HistoricalTrackSegment[];
  completeness: TrackCompleteness;
}>;

const COMPLETENESS = new Set<TrackCompleteness>([
  "COMPLETE",
  "PARTIAL",
  "UNKNOWN",
]);
const SEGMENT_REASONS = new Set<HistoricalTrackSegment["reason"]>([
  "CONTINUOUS",
  "TIME_GAP",
  "DISTANCE_JUMP",
  "INVALID_POINT_REMOVED",
  "PROVIDER_GAP",
]);

export function parseHistoricalTrack(value: unknown): HistoricalTrack {
  if (
    !isRecord(value) ||
    !nonEmpty(value.flightId) ||
    !nonEmpty(value.aircraftId) ||
    !nonEmpty(value.provider) ||
    !Array.isArray(value.points) ||
    !Array.isArray(value.segments) ||
    !COMPLETENESS.has(value.completeness as TrackCompleteness)
  ) {
    throw new Error("Malformed historical track");
  }

  const points = value.points.map(parsePoint);
  const segments = value.segments.map((segment) =>
    parseSegment(segment, points.length),
  );
  if (points.length < 2 || segments.length === 0) {
    throw new Error("Malformed historical track");
  }

  return {
    flightId: value.flightId.trim(),
    aircraftId: value.aircraftId.trim().toLowerCase(),
    provider: value.provider.trim(),
    points,
    segments,
    completeness: value.completeness as TrackCompleteness,
  };
}

function parsePoint(value: unknown): HistoricalTrackPoint {
  if (
    !isRecord(value) ||
    !finiteRange(value.latitude, -90, 90) ||
    !finiteRange(value.longitude, -180, 180) ||
    !Number.isInteger(value.observedAtEpochSeconds) ||
    (value.observedAtEpochSeconds as number) <= 0
  ) {
    throw new Error("Malformed historical track point");
  }
  return {
    latitudeDegrees: value.latitude,
    longitudeDegrees: value.longitude,
    observedAtEpochSeconds: value.observedAtEpochSeconds as number,
  };
}

function parseSegment(
  value: unknown,
  pointCount: number,
): HistoricalTrackSegment {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.startIndex) ||
    !Number.isInteger(value.endIndex) ||
    (value.startIndex as number) < 0 ||
    (value.endIndex as number) < (value.startIndex as number) ||
    (value.endIndex as number) >= pointCount ||
    !SEGMENT_REASONS.has(value.reason as HistoricalTrackSegment["reason"])
  ) {
    throw new Error("Malformed historical track segment");
  }
  return {
    startIndex: value.startIndex as number,
    endIndex: value.endIndex as number,
    reason: value.reason as HistoricalTrackSegment["reason"],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finiteRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}
