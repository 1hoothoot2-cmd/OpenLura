import type { AircraftFeatureCollection } from "../../aircraft/presentation/aircraftGeoJson";
import type { AircraftId } from "../../aircraft/domain/aircraft";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import {
  AIRCRAFT_HIT_LAYER_IDS,
  AIRCRAFT_ICON_ID,
  AIRCRAFT_LABEL_LAYER_ID,
  AIRCRAFT_NORMAL_FOOTPRINT_LAYER_ID,
  AIRCRAFT_NORMAL_LAYER_ID,
  AIRCRAFT_SELECTED_GLOW_LAYER_ID,
  AIRCRAFT_SELECTED_LAYER_ID,
  AIRCRAFT_SOURCE_ID,
} from "../infrastructure/aircraftMapIds";
import { AircraftMapSourceWriter } from "../infrastructure/aircraftSourceWriter";

type AircraftSelectionHandler = (aircraftId: AircraftId | null) => void;

export type AircraftMapRegistration = Readonly<{
  sourceWriter: AircraftMapSourceWriter;
  remove: () => void;
}>;

export function registerAircraftMapPresentation(
  map: MapLibreMap,
  initialData: AircraftFeatureCollection,
  onSelect: AircraftSelectionHandler,
): AircraftMapRegistration {
  if (!map.hasImage(AIRCRAFT_ICON_ID)) {
    map.addImage(AIRCRAFT_ICON_ID, createAircraftImage(), {
      pixelRatio: 2,
      sdf: true,
    });
  }

  const sourceWriter = new AircraftMapSourceWriter(map, initialData);
  addLayers(map);

  const handleClick = (event: MapMouseEvent) => {
    const hits = map.queryRenderedFeatures(event.point, {
      layers: [...AIRCRAFT_HIT_LAYER_IDS],
    });
    const aircraftIds = new Set(
      hits
        .map((feature) => feature.properties?.aircraft_id)
        .filter((id): id is string => typeof id === "string"),
    );
    const aircraftId = aircraftIds.values().next().value;
    onSelect(aircraftId ? (aircraftId as AircraftId) : null);
  };

  const handleMouseMove = (event: MapMouseEvent) => {
    const hasAircraft = map.queryRenderedFeatures(event.point, {
      layers: [...AIRCRAFT_HIT_LAYER_IDS],
    }).length > 0;
    map.getCanvas().style.cursor = hasAircraft ? "pointer" : "";
  };

  const handleMouseLeave = () => {
    map.getCanvas().style.cursor = "";
  };

  map.on("click", handleClick);
  map.on("mousemove", handleMouseMove);
  map.getCanvas().addEventListener("mouseleave", handleMouseLeave);

  return {
    sourceWriter,
    remove: () => {
      sourceWriter.dispose();
      map.off("click", handleClick);
      map.off("mousemove", handleMouseMove);
      map.getCanvas().removeEventListener("mouseleave", handleMouseLeave);
    },
  };
}

function addLayers(map: MapLibreMap) {
  if (!map.getLayer(AIRCRAFT_NORMAL_FOOTPRINT_LAYER_ID)) {
    map.addLayer({
      id: AIRCRAFT_NORMAL_FOOTPRINT_LAYER_ID,
      type: "circle",
      source: AIRCRAFT_SOURCE_ID,
      filter: ["==", ["get", "selected"], false],
      paint: {
        "circle-radius": 10,
        "circle-color": "rgba(85,217,242,0.08)",
        "circle-stroke-color": "rgba(85,217,242,0.2)",
        "circle-stroke-width": 0.8,
      },
    });
  }

  if (!map.getLayer(AIRCRAFT_NORMAL_LAYER_ID)) {
    map.addLayer({
      id: AIRCRAFT_NORMAL_LAYER_ID,
      type: "symbol",
      source: AIRCRAFT_SOURCE_ID,
      filter: ["==", ["get", "selected"], false],
      layout: aircraftSymbolLayout(0.72),
      paint: {
        "icon-color": [
          "case",
          ["get", "on_ground"],
          "#6f91a8",
          "#55d9f2",
        ],
        "icon-halo-color": "#032738",
        "icon-halo-width": 1.2,
        "icon-opacity": ["case", ["get", "on_ground"], 0.72, 0.92],
      },
    });
  }

  if (!map.getLayer(AIRCRAFT_SELECTED_GLOW_LAYER_ID)) {
    map.addLayer({
      id: AIRCRAFT_SELECTED_GLOW_LAYER_ID,
      type: "circle",
      source: AIRCRAFT_SOURCE_ID,
      filter: ["==", ["get", "selected"], true],
      paint: {
        "circle-radius": 17,
        "circle-color": "rgba(251,191,36,0.13)",
        "circle-stroke-color": "rgba(251,191,36,0.42)",
        "circle-stroke-width": 1,
        "circle-blur": 0.35,
      },
    });
  }

  if (!map.getLayer(AIRCRAFT_SELECTED_LAYER_ID)) {
    map.addLayer({
      id: AIRCRAFT_SELECTED_LAYER_ID,
      type: "symbol",
      source: AIRCRAFT_SOURCE_ID,
      filter: ["==", ["get", "selected"], true],
      layout: aircraftSymbolLayout(0.9),
      paint: {
        "icon-color": "#fbbf24",
        "icon-halo-color": "#4b2c02",
        "icon-halo-width": 1.6,
      },
    });
  }

  if (!map.getLayer(AIRCRAFT_LABEL_LAYER_ID)) {
    map.addLayer({
      id: AIRCRAFT_LABEL_LAYER_ID,
      type: "symbol",
      source: AIRCRAFT_SOURCE_ID,
      filter: ["==", ["get", "selected"], true],
      minzoom: 4.5,
      layout: {
        "text-field": ["get", "display_label"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-offset": [0, 2.1],
        "text-anchor": "top",
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#ffe6a4",
        "text-halo-color": "#07101b",
        "text-halo-width": 1.5,
      },
    });
  }
}

function aircraftSymbolLayout(iconSize: number) {
  return {
    "icon-image": AIRCRAFT_ICON_ID,
    "icon-size": iconSize,
    "icon-rotate": ["get", "rotation"] as ["get", string],
    "icon-rotation-alignment": "map" as const,
    "icon-pitch-alignment": "map" as const,
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  };
}

function createAircraftImage(): ImageData {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Aircraft icon canvas is unavailable");

  context.clearRect(0, 0, size, size);
  context.fillStyle = "white";
  context.beginPath();
  context.moveTo(32, 3);
  context.lineTo(38, 25);
  context.lineTo(58, 34);
  context.lineTo(58, 39);
  context.lineTo(38, 35);
  context.lineTo(37, 51);
  context.lineTo(46, 57);
  context.lineTo(46, 61);
  context.lineTo(32, 57);
  context.lineTo(18, 61);
  context.lineTo(18, 57);
  context.lineTo(27, 51);
  context.lineTo(26, 35);
  context.lineTo(6, 39);
  context.lineTo(6, 34);
  context.lineTo(26, 25);
  context.closePath();
  context.fill();
  return context.getImageData(0, 0, size, size);
}
