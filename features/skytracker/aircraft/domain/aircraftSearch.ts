import type { Aircraft } from "./aircraft.ts";

export type AircraftSearchResult = Readonly<{
  aircraft: Aircraft;
  matchedField: "callsign" | "registration" | "aircraftId";
  matchType: "exact" | "prefix" | "contains";
}>;

const DEFAULT_RESULT_LIMIT = 8;

export function searchAircraft(
  aircraft: readonly Aircraft[],
  query: string,
  limit = DEFAULT_RESULT_LIMIT,
): readonly AircraftSearchResult[] {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery || limit <= 0) return [];

  return aircraft
    .flatMap((item) => {
      const match = bestMatch(item, normalizedQuery);
      return match ? [{ aircraft: item, ...match }] : [];
    })
    .sort(compareResults)
    .slice(0, limit);
}

function bestMatch(
  aircraft: Aircraft,
  query: string,
): Omit<AircraftSearchResult, "aircraft"> | null {
  const candidates = [
    { field: "callsign" as const, value: aircraft.callsign },
    { field: "registration" as const, value: aircraft.registration },
    { field: "aircraftId" as const, value: aircraft.id },
  ];

  for (const matchType of ["exact", "prefix", "contains"] as const) {
    for (const candidate of candidates) {
      const value = normalizeSearchValue(candidate.value);
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

function compareResults(
  left: AircraftSearchResult,
  right: AircraftSearchResult,
) {
  const matchPriority = { exact: 0, prefix: 1, contains: 2 };
  const fieldPriority = { callsign: 0, registration: 1, aircraftId: 2 };
  return (
    matchPriority[left.matchType] - matchPriority[right.matchType] ||
    fieldPriority[left.matchedField] - fieldPriority[right.matchedField] ||
    displayIdentity(left.aircraft).localeCompare(displayIdentity(right.aircraft)) ||
    left.aircraft.id.localeCompare(right.aircraft.id)
  );
}

function displayIdentity(aircraft: Aircraft) {
  return aircraft.callsign?.trim() || aircraft.registration?.trim() || aircraft.id;
}

function normalizeSearchValue(value: string | null) {
  return value?.trim().toLocaleLowerCase("en-US") ?? "";
}
