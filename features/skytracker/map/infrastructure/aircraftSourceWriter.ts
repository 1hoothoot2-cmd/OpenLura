import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import {
  aircraftFeatureFingerprint,
  shouldWriteAircraftFeatures,
  type AircraftFeatureCollection,
} from "../../aircraft/presentation/aircraftGeoJson.ts";
import { AIRCRAFT_SOURCE_ID } from "./aircraftMapIds.ts";

export class AircraftMapSourceWriter {
  private readonly map: MapLibreMap;
  private lastFingerprint: string | null = null;
  private disposed = false;
  private writeCount = 0;

  constructor(
    map: MapLibreMap,
    initialCollection: AircraftFeatureCollection,
  ) {
    this.map = map;
    if (!map.getSource(AIRCRAFT_SOURCE_ID)) {
      map.addSource(AIRCRAFT_SOURCE_ID, {
        type: "geojson",
        data: emptyAircraftFeatureCollection(),
      });
    }
    this.write(initialCollection);
  }

  write(collection: AircraftFeatureCollection): boolean {
    if (this.disposed) return false;

    const source = this.map.getSource(AIRCRAFT_SOURCE_ID);
    if (!source || !("setData" in source)) return false;

    const fingerprint = aircraftFeatureFingerprint(collection);
    if (!shouldWriteAircraftFeatures(this.lastFingerprint, collection)) {
      return false;
    }

    void (source as GeoJSONSource).setData(collection);
    this.lastFingerprint = fingerprint;
    this.writeCount += 1;
    return true;
  }

  get writes() {
    return this.writeCount;
  }

  dispose() {
    this.disposed = true;
    this.lastFingerprint = null;
  }
}

function emptyAircraftFeatureCollection(): AircraftFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  };
}
