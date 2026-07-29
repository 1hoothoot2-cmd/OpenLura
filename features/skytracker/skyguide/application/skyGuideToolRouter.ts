import type { SkyGuideContext } from "../domain/skyGuide";

export type SkyGuideToolId =
  | "skytracker-live"
  | "airport-data"
  | "aviation-weather"
  | "aviation-news"
  | "web-search"
  | "spotter-intelligence";

export type SkyGuideToolPlan = Readonly<{
  tools: readonly SkyGuideToolId[];
  useWebSearch: boolean;
}>;

const AIRPORT = /\b(airport|luchthaven|icao|iata|arrivals?|departures?|runways?|timezone|eham|ams|schiphol)\b/i;
const WEATHER = /\b(weather|weer|metar|taf|wind|visibility|zicht|temperature|cloud|ceiling|flying conditions)\b/i;
const NEWS = /\b(news|nieuws|latest aviation|recent aviation|today in aviation)\b/i;
const SPOTTING = /\b(spotter|spotting|spot location|above me|overhead|a380|photograph aircraft)\b/i;
const CURRENT = /\b(current|currently|live|latest|today|now|actueel|vandaag|nu)\b/i;

export function routeSkyGuideTools(
  query: string,
  context: SkyGuideContext,
): SkyGuideToolPlan {
  const tools = new Set<SkyGuideToolId>();
  if (context.selectedAircraft || context.map) tools.add("skytracker-live");
  if (AIRPORT.test(query)) tools.add("airport-data");
  if (WEATHER.test(query)) tools.add("aviation-weather");
  if (NEWS.test(query)) tools.add("aviation-news");
  if (SPOTTING.test(query)) tools.add("spotter-intelligence");

  const useWebSearch =
    NEWS.test(query) ||
    WEATHER.test(query) ||
    SPOTTING.test(query) ||
    AIRPORT.test(query) ||
    (CURRENT.test(query) && !context.selectedAircraft);
  if (useWebSearch) tools.add("web-search");

  return { tools: [...tools], useWebSearch };
}
