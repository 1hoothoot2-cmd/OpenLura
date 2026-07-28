import type { Aircraft, AircraftId } from "../../aircraft/domain/aircraft.ts";
import type { RecordedSessionFrame } from "../../replay/domain/sessionRecorder.ts";
import type {
  HistoricalTrack,
  HistoricalTrackPoint,
  HistoricalTrackSegment,
} from "./historicalTrack.ts";

const MAXIMUM_CONTINUOUS_OBSERVATION_GAP_SECONDS = 15 * 60;

export function createObservedSessionTrack(
  frames: readonly RecordedSessionFrame[],
  aircraftId: AircraftId | null,
): HistoricalTrack | null {
  if (!aircraftId) return null;
  const points: HistoricalTrackPoint[] = [];
  for (const frame of frames) {
    const aircraft = frame.aircraft.find((item) => item.aircraftId === aircraftId);
    if (!aircraft) continue;
    const point = {
      latitudeDegrees: aircraft.latitudeDegrees,
      longitudeDegrees: aircraft.longitudeDegrees,
      observedAtEpochSeconds: Math.floor(frame.timestampEpochMillis / 1_000),
    };
    const previous = points.at(-1);
    if (
      previous &&
      previous.latitudeDegrees === point.latitudeDegrees &&
      previous.longitudeDegrees === point.longitudeDegrees
    ) {
      continue;
    }
    points.push(point);
  }
  if (points.length < 2) return null;
  const segments: HistoricalTrackSegment[] = [];
  let segmentStartIndex = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (
      points[index].observedAtEpochSeconds -
        points[index - 1].observedAtEpochSeconds >
      MAXIMUM_CONTINUOUS_OBSERVATION_GAP_SECONDS
    ) {
      if (index - 1 > segmentStartIndex) {
        segments.push({
          startIndex: segmentStartIndex,
          endIndex: index - 1,
          reason: "CONTINUOUS",
        });
      }
      segmentStartIndex = index;
    }
  }
  if (points.length - 1 > segmentStartIndex) {
    segments.push({
      startIndex: segmentStartIndex,
      endIndex: points.length - 1,
      reason: "CONTINUOUS",
    });
  }
  if (segments.length === 0) return null;
  return {
    flightId: `session-${aircraftId}`,
    aircraftId,
    provider: "session",
    points,
    segments,
    completeness: "PARTIAL",
  };
}

export function extendTrackToLatestObservation(
  track: HistoricalTrack,
  aircraft: Aircraft,
): HistoricalTrack {
  const latest = track.points.at(-1);
  const observedAtEpochSeconds = Math.floor(
    aircraft.positionTimestampEpochMillis / 1_000,
  );
  if (
    !latest ||
    observedAtEpochSeconds <= latest.observedAtEpochSeconds ||
    (latest.latitudeDegrees === aircraft.latitudeDegrees &&
      latest.longitudeDegrees === aircraft.longitudeDegrees)
  ) {
    return track;
  }
  if (
    observedAtEpochSeconds - latest.observedAtEpochSeconds >
    MAXIMUM_CONTINUOUS_OBSERVATION_GAP_SECONDS
  ) {
    return track;
  }
  const points = [
    ...track.points,
    {
      latitudeDegrees: aircraft.latitudeDegrees,
      longitudeDegrees: aircraft.longitudeDegrees,
      observedAtEpochSeconds,
    },
  ];
  const segments = [...track.segments];
  const finalSegment = segments.at(-1);
  if (
    finalSegment &&
    finalSegment.endIndex === track.points.length - 1
  ) {
    segments[segments.length - 1] = {
      ...finalSegment,
      endIndex: points.length - 1,
    };
  }
  return { ...track, points, segments };
}
