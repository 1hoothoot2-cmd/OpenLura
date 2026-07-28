import type { Feature, FeatureCollection, Point } from "geojson";
import type { PresentedAircraft } from "./presentedAircraft.ts";

export type AircraftFeatureProperties = Readonly<{
  aircraft_id: string;
  rotation: number;
  heading_known: boolean;
  display_label: string;
  selected: boolean;
  favorite: boolean;
  on_ground: boolean;
  lifecycle: string;
}>;

export type AircraftFeatureCollection = FeatureCollection<
  Point,
  AircraftFeatureProperties
>;

export function createAircraftFeatureCollection(
  aircraft: readonly PresentedAircraft[],
): AircraftFeatureCollection {
  const features: Feature<Point, AircraftFeatureProperties>[] = aircraft.map(
    (item) => ({
      type: "Feature",
      id: item.id,
      geometry: {
        type: "Point",
        coordinates: [...item.coordinates],
      },
      properties: {
        aircraft_id: item.id,
        rotation: item.rotationDegrees,
        heading_known: item.hasKnownHeading,
        display_label: item.displayCallsign,
        selected: item.selected,
        favorite: item.favorite,
        on_ground: item.onGround,
        lifecycle: item.lifecycle,
      },
    }),
  );

  return { type: "FeatureCollection", features };
}

export function aircraftFeatureFingerprint(
  collection: AircraftFeatureCollection,
): string {
  return collection.features
    .map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      const properties = feature.properties;
      return [
        feature.id,
        longitude,
        latitude,
        properties.rotation,
        Number(properties.heading_known),
        properties.display_label,
        Number(properties.selected),
        Number(properties.favorite),
        Number(properties.on_ground),
        properties.lifecycle,
      ].join(":");
    })
    .join("|");
}

export function shouldWriteAircraftFeatures(
  previousFingerprint: string | null,
  collection: AircraftFeatureCollection,
): boolean {
  return previousFingerprint !== aircraftFeatureFingerprint(collection);
}
