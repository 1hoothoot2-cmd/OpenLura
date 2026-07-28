import test from "node:test";
import assert from "node:assert/strict";
import type { Map as MapLibreMap } from "maplibre-gl";
import { aircraftId, type Aircraft } from "../domain/aircraft.ts";
import { parseHistoricalTrack } from "../../historical-track/domain/historicalTrack.ts";
import {
  fetchHistoricalTrackForAircraft,
  fetchHistoricalTrackFromBackend,
} from "../../historical-track/infrastructure/historicalTrackClient.ts";
import {
  createHistoricalTrackFeatureCollection,
  EMPTY_HISTORICAL_TRACK_FEATURES,
} from "../../historical-track/presentation/historicalTrackGeoJson.ts";
import {
  HISTORICAL_TRACK_LAYER_ID,
  HISTORICAL_TRACK_SOURCE_ID,
  registerHistoricalTrackMapPresentation,
} from "../../historical-track/presentation/historicalTrackMapRenderer.ts";

const AIRCRAFT: Aircraft = {
  id: aircraftId("406a3d"),
  latitudeDegrees: 52.3,
  longitudeDegrees: 4.8,
  headingDegrees: 90,
  callsign: "SKY553",
  registration: "G-DEVX",
  altitudeMeters: 1_200,
  groundSpeedMetersPerSecond: 122,
  verticalRateMetersPerSecond: 1,
  onGround: false,
  category: "passenger",
  lifecycle: "FRESH",
  positionTimestampEpochMillis: 1_700_000_120_000,
};

const TRACK_RESPONSE = {
  flightId: "development-flight-1",
  aircraftId: "406a3d",
  provider: "fr24",
  providerFlightId: "fr24-development-1",
  startedAtEpochSeconds: 1_700_000_000,
  endedAtEpochSeconds: 1_700_000_120,
  points: [
    { latitude: 52.3, longitude: 4.76, observedAtEpochSeconds: 1_700_000_000 },
    { latitude: 52.3, longitude: 4.78, observedAtEpochSeconds: 1_700_000_060 },
    { latitude: 52.3, longitude: 4.8, observedAtEpochSeconds: 1_700_000_120 },
  ],
  segments: [{ startIndex: 0, endIndex: 2, reason: "CONTINUOUS" }],
  completeness: "COMPLETE",
  retrievedAtEpochSeconds: 1_700_000_120,
  expiresAtEpochSeconds: 1_700_100_120,
};

test("historical track parser validates the provider-neutral backend contract", () => {
  const track = parseHistoricalTrack(TRACK_RESPONSE);
  assert.equal(track.aircraftId, "406a3d");
  assert.equal(track.points.length, 3);
  assert.throws(() =>
    parseHistoricalTrack({
      ...TRACK_RESPONSE,
      points: [{ latitude: 100, longitude: 4.76, observedAtEpochSeconds: 1 }],
    }),
  );
  assert.throws(() =>
    parseHistoricalTrack({
      ...TRACK_RESPONSE,
      segments: [{ startIndex: 0, endIndex: 9, reason: "CONTINUOUS" }],
    }),
  );
});

test("GeoJSON preserves backend segments without drawing across gaps", () => {
  const track = parseHistoricalTrack({
    ...TRACK_RESPONSE,
    points: [
      ...TRACK_RESPONSE.points,
      { latitude: 53, longitude: 5.2, observedAtEpochSeconds: 1_700_001_000 },
      { latitude: 53.1, longitude: 5.3, observedAtEpochSeconds: 1_700_001_060 },
    ],
    segments: [
      { startIndex: 0, endIndex: 2, reason: "CONTINUOUS" },
      { startIndex: 3, endIndex: 4, reason: "TIME_GAP" },
    ],
  });
  const collection = createHistoricalTrackFeatureCollection(track);
  assert.equal(collection.features.length, 2);
  assert.deepEqual(collection.features[0].geometry.coordinates.at(-1), [4.8, 52.3]);
  assert.deepEqual(collection.features[1].geometry.coordinates[0], [5.2, 53]);
  assert.equal(createHistoricalTrackFeatureCollection(null).features.length, 0);
});

test("browser client uses one same-origin request without direct backend access", async () => {
  const requests: string[] = [];
  const result = await fetchHistoricalTrackForAircraft(
    AIRCRAFT,
    new AbortController().signal,
    async (input) => {
      requests.push(input.toString());
      return Response.json(TRACK_RESPONSE);
    },
  );
  assert.equal(result.ok, true);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /^\/api\/skytracker\/historical-track\?/);
  assert.match(requests[0], /aircraftId=406a3d/);
});

test("server adapter resolves an existing flight leg then loads one historical track", async () => {
  const requests: string[] = [];
  const result = await fetchHistoricalTrackFromBackend(
    "http://localhost:8080",
    AIRCRAFT,
    new AbortController().signal,
    async (input) => {
      const url = input.toString();
      requests.push(url);
      if (url.includes("/v1/flightlegs/")) {
        return Response.json({
          flightId: "development-flight-1",
          aircraftId: "406a3d",
          status: "ACTIVE",
        });
      }
      return Response.json(TRACK_RESPONSE);
    },
  );
  assert.equal(result.ok, true);
  assert.equal(requests.length, 2);
  assert.match(requests[0], /flightlegs\/406a3d/);
  assert.match(requests[0], /callsign=SKY553/);
  assert.match(requests[1], /historical-tracks\/development-flight-1/);
});

test("server adapter stops after unavailable correlation and rejects mismatched track", async () => {
  let requests = 0;
  const unavailable = await fetchHistoricalTrackFromBackend(
    "http://localhost:8080",
    AIRCRAFT,
    new AbortController().signal,
    async () => {
      requests += 1;
      return new Response("{}", { status: 404 });
    },
  );
  assert.deepEqual(unavailable, { ok: false, category: "unavailable" });
  assert.equal(requests, 1);

  const mismatched = await fetchHistoricalTrackFromBackend(
    "http://localhost:8080",
    AIRCRAFT,
    new AbortController().signal,
    async (input) =>
      input.toString().includes("/v1/flightlegs/")
        ? Response.json({ flightId: "development-flight-1" })
        : Response.json({ ...TRACK_RESPONSE, aircraftId: "484516" }),
  );
  assert.deepEqual(mismatched, { ok: false, category: "malformed" });
});

test("map registration creates one source and layer and clears with one write", () => {
  const sources = new Map<string, { setData: (value: unknown) => void }>();
  const layers = new Set<string>();
  const writes: unknown[] = [];
  const map = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => {
      sources.set(id, { setData: (value) => writes.push(value) });
    },
    getLayer: (id: string) => layers.has(id) ? { id } : undefined,
    addLayer: (layer: { id: string }) => layers.add(layer.id),
  } as unknown as MapLibreMap;

  const first = registerHistoricalTrackMapPresentation(
    map,
    EMPTY_HISTORICAL_TRACK_FEATURES,
  );
  registerHistoricalTrackMapPresentation(map, EMPTY_HISTORICAL_TRACK_FEATURES);
  assert.equal(sources.size, 1);
  assert.equal(layers.size, 1);
  assert.ok(sources.has(HISTORICAL_TRACK_SOURCE_ID));
  assert.ok(layers.has(HISTORICAL_TRACK_LAYER_ID));

  const collection = createHistoricalTrackFeatureCollection(
    parseHistoricalTrack(TRACK_RESPONSE),
  );
  first.write(collection);
  first.write(collection);
  first.write(EMPTY_HISTORICAL_TRACK_FEATURES);
  assert.equal(writes.length, 2);
  first.remove();
  first.write(collection);
  assert.equal(writes.length, 2);
});
