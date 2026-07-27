import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import {
  aircraftFeatureFingerprint,
  shouldWriteAircraftFeatures,
  type AircraftFeatureCollection,
} from "../../aircraft/presentation/aircraftGeoJson";
import { AIRCRAFT_SOURCE_ID } from "./aircraftMapIds";

export class AircraftMapSourceWriter {
  private lastFingerprint: string | null = null;
  private disposed = false;
  private writeCount = 0;

  constructor(
    private readonly map: MapLibreMap,
    initialCollection: AircraftFeatureCollection,
  ) {
    if (!map.getSource(AIRCRAFT_SOURCE_ID)) {
      map.addSource(AIRCRAFT_SOURCE_ID, {
        type: "geojson",
        data: initialCollection,
      });
      this.lastFingerprint = aircraftFeatureFingerprint(initialCollection);
      this.writeCount = 1;
    }
  }

  write(collection: AircraftFeatureCollection): boolean {
    if (this.disposed) return false;

    const source = this.map.getSource(AIRCRAFT_SOURCE_ID);
    if (!source || !("setData" in source)) return false;

    const fingerprint = aircraftFeatureFingerprint(collection);
    if (!shouldWriteAircraftFeatures(this.lastFingerprint, collection)) {
      return false;
    }

    this.lastFingerprint = fingerprint;
    this.writeCount += 1;
    void (source as GeoJSONSource).setData(collection);
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
