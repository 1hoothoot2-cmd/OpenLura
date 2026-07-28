export const AIRCRAFT_SOURCE_ID = "skytracker-aircraft";
export const AIRCRAFT_ICON_ID = "skytracker-aircraft-silhouette";
export const AIRCRAFT_NORMAL_LAYER_ID = "skytracker-aircraft-normal";
export const AIRCRAFT_SELECTED_GLOW_LAYER_ID =
  "skytracker-aircraft-selected-glow";
export const AIRCRAFT_SELECTED_LAYER_ID = "skytracker-aircraft-selected";
export const AIRCRAFT_LABEL_LAYER_ID = "skytracker-aircraft-label";

export const AIRCRAFT_HIT_LAYER_IDS = [
  AIRCRAFT_SELECTED_GLOW_LAYER_ID,
  AIRCRAFT_SELECTED_LAYER_ID,
  AIRCRAFT_NORMAL_LAYER_ID,
] as const;
