export type SkyGuideUnitPreferences = Readonly<{
  altitude: "meters" | "feet";
  speed: "meters-per-second" | "knots";
  temperature: "celsius" | "fahrenheit";
}>;

export type SkyGuidePersonalization = Readonly<{
  favoriteAircraftIds: readonly string[];
  favoriteAirlineCodes: readonly string[];
  favoriteAirportCodes: readonly string[];
  favoriteSpotLocations: readonly string[];
  preferredLanguage: string | null;
  units: SkyGuideUnitPreferences | null;
  notificationsEnabled: boolean | null;
}>;

export interface SkyGuidePersonalizationProvider {
  current(): SkyGuidePersonalization | null;
}

// P3.4 deliberately defines the future boundary only. No implementation,
// persistence, account, browser storage or network adapter is provided.
