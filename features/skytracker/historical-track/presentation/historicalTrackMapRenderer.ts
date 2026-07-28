import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { AIRCRAFT_NORMAL_LAYER_ID } from "../../map/infrastructure/aircraftMapIds.ts";
import type { HistoricalTrackFeatureCollection } from "./historicalTrackGeoJson.ts";

export const HISTORICAL_TRACK_SOURCE_ID = "skytracker-historical-track";
export const HISTORICAL_TRACK_LAYER_ID = "skytracker-historical-track-line";

export type HistoricalTrackMapRegistration = Readonly<{
  write: (features: HistoricalTrackFeatureCollection) => void;
  remove: () => void;
}>;

export function registerHistoricalTrackMapPresentation(
  map: MapLibreMap,
  initialData: HistoricalTrackFeatureCollection,
): HistoricalTrackMapRegistration {
  if (!map.getSource(HISTORICAL_TRACK_SOURCE_ID)) {
    map.addSource(HISTORICAL_TRACK_SOURCE_ID, {
      type: "geojson",
      data: initialData,
    });
  }
  if (!map.getLayer(HISTORICAL_TRACK_LAYER_ID)) {
    map.addLayer(
      {
        id: HISTORICAL_TRACK_LAYER_ID,
        type: "line",
        source: HISTORICAL_TRACK_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#55d9f2",
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.2, 10, 2.1],
          "line-opacity": 0.58,
        },
      },
      map.getLayer(AIRCRAFT_NORMAL_LAYER_ID)
        ? AIRCRAFT_NORMAL_LAYER_ID
        : undefined,
    );
  }

  let disposed = false;
  let lastData = initialData;
  return {
    write: (features) => {
      if (disposed || features === lastData) return;
      const source = map.getSource(HISTORICAL_TRACK_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      if (!source) return;
      source.setData(features);
      lastData = features;
    },
    remove: () => {
      disposed = true;
    },
  };
}
