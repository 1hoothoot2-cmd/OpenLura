import type {
  FavoriteAircraft,
  FavoriteAirport,
  SkyTrackerFavorites,
} from "./favorites.ts";

export type FavoriteSearchResult =
  | Readonly<{ kind: "aircraft"; favorite: FavoriteAircraft }>
  | Readonly<{ kind: "airport"; favorite: FavoriteAirport }>;

export function searchFavorites(
  favorites: SkyTrackerFavorites,
  query: string,
): readonly FavoriteSearchResult[] {
  const normalizedQuery = normalize(query);
  const aircraft = favorites.aircraft
    .filter((favorite) =>
      matches(
        [favorite.callsign, favorite.registration, favorite.aircraftId],
        normalizedQuery,
      ),
    )
    .map((favorite) => ({ kind: "aircraft" as const, favorite }));
  const airports = favorites.airports
    .filter((favorite) =>
      matches(
        [
          favorite.name,
          favorite.city,
          favorite.icaoCode,
          favorite.iataCode,
        ],
        normalizedQuery,
      ),
    )
    .map((favorite) => ({ kind: "airport" as const, favorite }));

  return [...aircraft, ...airports].sort((left, right) =>
    displayName(left).localeCompare(displayName(right)),
  );
}

function matches(values: readonly (string | null)[], query: string) {
  return !query || values.some((value) => normalize(value).includes(query));
}

function normalize(value: string | null) {
  return value?.trim().toLocaleLowerCase("en-US") ?? "";
}

function displayName(result: FavoriteSearchResult) {
  return result.kind === "aircraft"
    ? result.favorite.callsign ??
        result.favorite.registration ??
        result.favorite.aircraftId
    : result.favorite.name;
}

