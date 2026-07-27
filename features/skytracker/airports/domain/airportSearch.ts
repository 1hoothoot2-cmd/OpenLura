import type { AirportSearchEntry } from "./airport.ts";

export type AirportSearchResult = Readonly<{
  entry: AirportSearchEntry;
  matchedField: "icao" | "iata" | "name" | "city";
  matchType: "exact" | "prefix" | "contains";
}>;

const DEFAULT_RESULT_LIMIT = 8;

export function searchAirports(
  airports: readonly AirportSearchEntry[],
  query: string,
  limit = DEFAULT_RESULT_LIMIT,
): readonly AirportSearchResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery || limit <= 0) return [];

  return airports
    .flatMap((entry) => {
      const match = bestMatch(entry, normalizedQuery);
      return match ? [{ entry, ...match }] : [];
    })
    .sort(compareResults)
    .slice(0, limit);
}

function bestMatch(
  entry: AirportSearchEntry,
  query: string,
): Omit<AirportSearchResult, "entry"> | null {
  const candidates = [
    { field: "icao" as const, value: entry.airport.icaoCode },
    { field: "iata" as const, value: entry.airport.iataCode },
    { field: "name" as const, value: entry.airport.name },
    { field: "city" as const, value: entry.city },
  ];

  for (const matchType of ["exact", "prefix", "contains"] as const) {
    for (const candidate of candidates) {
      const value = normalize(candidate.value);
      if (!value) continue;
      if (
        (matchType === "exact" && value === query) ||
        (matchType === "prefix" && value.startsWith(query)) ||
        (matchType === "contains" && value.includes(query))
      ) {
        return { matchedField: candidate.field, matchType };
      }
    }
  }
  return null;
}

function compareResults(left: AirportSearchResult, right: AirportSearchResult) {
  const matchPriority = { exact: 0, prefix: 1, contains: 2 };
  const fieldPriority = { icao: 0, iata: 1, name: 2, city: 3 };
  return (
    matchPriority[left.matchType] - matchPriority[right.matchType] ||
    fieldPriority[left.matchedField] - fieldPriority[right.matchedField] ||
    left.entry.airport.name.localeCompare(right.entry.airport.name) ||
    (left.entry.airport.icaoCode ?? "").localeCompare(
      right.entry.airport.icaoCode ?? "",
    )
  );
}

function normalize(value: string | null) {
  return value?.trim().toLocaleLowerCase("en-US") ?? "";
}

