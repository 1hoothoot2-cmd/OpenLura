import test from "node:test";
import assert from "node:assert/strict";
import { searchAirports } from "../domain/airportSearch.ts";
import {
  DEVELOPMENT_AIRPORTS,
  developmentAirportDetails,
} from "../fixtures/developmentAirports.ts";
import { createAirportMapFocus } from "../domain/airportMapPolicy.ts";

test("airport search matches ICAO and IATA case-insensitively", () => {
  assert.equal(
    searchAirports(DEVELOPMENT_AIRPORTS, "eham")[0]?.matchedField,
    "icao",
  );
  assert.equal(
    searchAirports(DEVELOPMENT_AIRPORTS, " AMS ")[0]?.matchedField,
    "iata",
  );
});

test("airport search matches airport name and city by prefix or contains", () => {
  assert.equal(
    searchAirports(DEVELOPMENT_AIRPORTS, "Amster")[0]?.matchType,
    "prefix",
  );
  assert.equal(
    searchAirports(DEVELOPMENT_AIRPORTS, "schiphol")[0]?.matchType,
    "contains",
  );
});

test("airport search is deterministic and bounded", () => {
  assert.deepEqual(
    searchAirports(DEVELOPMENT_AIRPORTS, "a"),
    searchAirports(DEVELOPMENT_AIRPORTS, "a"),
  );
  assert.equal(searchAirports(DEVELOPMENT_AIRPORTS, "a", 0).length, 0);
});

test("development details preserve contract fields and placeholders", () => {
  const details = developmentAirportDetails(DEVELOPMENT_AIRPORTS[0]!);
  assert.equal(details.airport.icaoCode, "EHAM");
  assert.equal(details.airport.iataCode, "AMS");
  assert.equal(details.city, "Amsterdam");
  assert.equal(details.elevationMeters, null);
  assert.equal(details.timezone, null);
  assert.deepEqual(details.runways, []);
});

test("airport map focus centers on the airport without changing aircraft selection", () => {
  const details = developmentAirportDetails(DEVELOPMENT_AIRPORTS[0]!);
  assert.deepEqual(createAirportMapFocus(details), {
    longitudeDegrees: 4.7639,
    latitudeDegrees: 52.3086,
    stopFollowing: true,
    preserveAircraftSelection: true,
  });
});
