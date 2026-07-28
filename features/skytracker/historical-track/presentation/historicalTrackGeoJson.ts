import type { Feature, FeatureCollection, LineString } from "geojson";
import type { HistoricalTrack } from "../domain/historicalTrack.ts";

export type HistoricalTrackFeatureCollection = FeatureCollection<
  LineString,
  Readonly<{ flight_id: string; segment_reason: string }>
>;

export const EMPTY_HISTORICAL_TRACK_FEATURES: HistoricalTrackFeatureCollection =
  { type: "FeatureCollection", features: [] };

export function createHistoricalTrackFeatureCollection(
  track: HistoricalTrack | null,
): HistoricalTrackFeatureCollection {
  if (!track) return EMPTY_HISTORICAL_TRACK_FEATURES;

  const features: Feature<
    LineString,
    Readonly<{ flight_id: string; segment_reason: string }>
  >[] = track.segments.flatMap((segment, index) => {
    const coordinates = track.points
      .slice(segment.startIndex, segment.endIndex + 1)
      .map((point) => [point.longitudeDegrees, point.latitudeDegrees]);
    if (coordinates.length < 2) return [];
    return [{
      type: "Feature",
      id: `${track.flightId}-${index}`,
      geometry: { type: "LineString", coordinates },
      properties: {
        flight_id: track.flightId,
        segment_reason: segment.reason,
      },
    }];
  });

  return { type: "FeatureCollection", features };
}
