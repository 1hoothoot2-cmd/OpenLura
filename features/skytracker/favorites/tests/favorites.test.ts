import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_FAVORITES,
  FAVORITES_STORAGE_VERSION,
  favoriteAircraftSnapshot,
  favoriteAirportSnapshot,
} from "../domain/favorites.ts";
import { searchFavorites } from "../domain/favoriteSearch.ts";
import {
  FavoritesRepository,
  SKYTRACKER_FAVORITES_STORAGE_KEY,
  parseFavorites,
} from "../infrastructure/favoritesRepository.ts";
import { aircraftId, type Aircraft } from "../../aircraft/domain/aircraft.ts";
import {
  DEVELOPMENT_AIRPORTS,
  developmentAirportDetails,
} from "../../airports/fixtures/developmentAirports.ts";

test("aircraft favorites add, persist, deduplicate and remove", () => {
  const storage = memoryStorage();
  const repository = new FavoritesRepository(storage);
  const favorite = favoriteAircraftSnapshot(AIRCRAFT);

  assert.deepEqual(repository.load(), EMPTY_FAVORITES);
  assert.equal(repository.toggleAircraft(favorite).aircraft.length, 1);
  assert.equal(new FavoritesRepository(storage).load().aircraft.length, 1);
  assert.equal(repository.toggleAircraft(favorite).aircraft.length, 0);
});

test("airport favorites add, persist, deduplicate and remove by ICAO", () => {
  const storage = memoryStorage();
  const repository = new FavoritesRepository(storage);
  const favorite = favoriteAirportSnapshot(
    developmentAirportDetails(DEVELOPMENT_AIRPORTS[0]!),
  );

  assert.equal(repository.toggleAirport(favorite).airports[0]?.icaoCode, "EHAM");
  assert.equal(new FavoritesRepository(storage).load().airports.length, 1);
  assert.equal(repository.toggleAirport(favorite).airports.length, 0);
});

test("storage rejects unknown versions and corrupt records safely", () => {
  assert.deepEqual(parseFavorites("{"), EMPTY_FAVORITES);
  assert.deepEqual(
    parseFavorites(JSON.stringify({ version: 2, aircraft: [], airports: [] })),
    EMPTY_FAVORITES,
  );
});

test("storage normalizes duplicates and invalid records", () => {
  const valid = favoriteAircraftSnapshot(AIRCRAFT);
  const parsed = parseFavorites(
    JSON.stringify({
      version: FAVORITES_STORAGE_VERSION,
      aircraft: [valid, valid, { aircraftId: "" }],
      airports: [],
    }),
  );
  assert.equal(parsed.aircraft.length, 1);
});

test("favorites search integrates aircraft and airport snapshots", () => {
  const favorites = {
    version: FAVORITES_STORAGE_VERSION,
    aircraft: [favoriteAircraftSnapshot(AIRCRAFT)],
    airports: [
      favoriteAirportSnapshot(
        developmentAirportDetails(DEVELOPMENT_AIRPORTS[0]!),
      ),
    ],
  } as const;
  assert.deepEqual(
    searchFavorites(favorites, "").map((result) => result.kind),
    ["airport", "aircraft"],
  );
  assert.equal(searchFavorites(favorites, "PH-VSY")[0]?.kind, "aircraft");
  assert.equal(searchFavorites(favorites, "Schiphol")[0]?.kind, "airport");
});

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
      assert.equal(key, SKYTRACKER_FAVORITES_STORAGE_KEY);
    },
  };
}

const AIRCRAFT: Aircraft = {
  id: aircraftId("484516"),
  latitudeDegrees: 52.31,
  longitudeDegrees: 4.76,
  headingDegrees: 182,
  callsign: "SKY551",
  registration: "PH-VSY",
  altitudeMeters: 10_400,
  groundSpeedMetersPerSecond: 225,
  onGround: false,
  category: "passenger",
  lifecycle: "FRESH",
  positionTimestampEpochMillis: 1_700_000_000_000,
};

