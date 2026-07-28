import type { LngLatLike, StyleSpecification } from "maplibre-gl";

export const SKYTRACKER_INITIAL_CENTER: LngLatLike = [5.3, 52.15];
export const SKYTRACKER_INITIAL_ZOOM = 7.7;
export const SKYTRACKER_MIN_ZOOM = 2;
export const SKYTRACKER_MAX_ZOOM = 15;

export const SKYTRACKER_MAP_STYLE_URL =
  "https://tiles.openfreemap.org/styles/dark";

export type SkyTrackerMapStyle = string | StyleSpecification;
