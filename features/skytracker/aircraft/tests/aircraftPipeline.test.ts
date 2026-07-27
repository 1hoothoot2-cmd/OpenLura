import test from "node:test";
import assert from "node:assert/strict";
import type { Map as MapLibreMap } from "maplibre-gl";
import { aircraftId, type Aircraft } from "../domain/aircraft.ts";
import { validateAircraftSnapshot } from "../domain/aircraftValidation.ts";
import { DEVELOPMENT_AIRCRAFT } from "../fixtures/developmentAircraft.ts";
import {
  aircraftFeatureFingerprint,
  createAircraftFeatureCollection,
  shouldWriteAircraftFeatures,
} from "../presentation/aircraftGeoJson.ts";
import {
  normalizeHeading,
  presentAircraft,
} from "../presentation/presentedAircraft.ts";
import { AircraftMapSourceWriter } from "../../map/infrastructure/aircraftSourceWriter.ts";

test("development fixtures are valid, unique and deterministic", () => {
  const first = validateAircraftSnapshot(DEVELOPMENT_AIRCRAFT);
  const second = validateAircraftSnapshot(DEVELOPMENT_AIRCRAFT);

  assert.equal(first.validAircraft.length, 12);
  assert.deepEqual(first.issues, []);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.validAircraft.map((item) => item.id)).size, 12);
});

test("invalid coordinates and duplicate IDs are rejected without losing valid records", () => {
  const valid = DEVELOPMENT_AIRCRAFT[0];
  const invalidCoordinate = {
    ...DEVELOPMENT_AIRCRAFT[1],
    id: aircraftId("invalid"),
    latitudeDegrees: 91,
  };
  const duplicate = { ...DEVELOPMENT_AIRCRAFT[2], id: valid.id };
  const result = validateAircraftSnapshot([valid, invalidCoordinate, duplicate]);

  assert.deepEqual(result.validAircraft.map((item) => item.id), [valid.id]);
  assert.equal(result.issues.length, 2);
});

test("non-finite values and invalid headings are rejected", () => {
  const invalid: Aircraft = {
    ...DEVELOPMENT_AIRCRAFT[0],
    id: aircraftId("nonfinite"),
    longitudeDegrees: Number.NaN,
    headingDegrees: 361,
  };

  assert.equal(validateAircraftSnapshot([invalid]).validAircraft.length, 0);
});

test("heading normalization preserves cardinal directions and safely falls back", () => {
  assert.equal(normalizeHeading(0), 0);
  assert.equal(normalizeHeading(90), 90);
  assert.equal(normalizeHeading(180), 180);
  assert.equal(normalizeHeading(270), 270);
  assert.equal(normalizeHeading(360), 0);
  assert.equal(normalizeHeading(null), 0);
  assert.equal(normalizeHeading(Number.NaN), 0);
});

test("domain mapping uses ID selection and safe missing-heading presentation", () => {
  const selected = DEVELOPMENT_AIRCRAFT[2].id;
  const presented = presentAircraft(DEVELOPMENT_AIRCRAFT, selected);
  const missingHeading = presented.find((item) => item.id === aircraftId("d00009"));

  assert.equal(presented.filter((item) => item.selected).length, 1);
  assert.equal(presented[2].selected, true);
  assert.equal(missingHeading?.hasKnownHeading, false);
  assert.equal(missingHeading?.rotationDegrees, 0);
});

test("GeoJSON output is compact, deterministic and uses stable IDs", () => {
  const presented = presentAircraft(DEVELOPMENT_AIRCRAFT, aircraftId("d00003"));
  const first = createAircraftFeatureCollection(presented);
  const second = createAircraftFeatureCollection(presented);

  assert.deepEqual(first, second);
  assert.equal(first.type, "FeatureCollection");
  assert.equal(first.features.length, 12);
  assert.equal(first.features[0].geometry.type, "Point");
  assert.equal(first.features[0].id, DEVELOPMENT_AIRCRAFT[0].id);
  assert.equal(first.features[2].properties.selected, true);
  assert.equal(first.features[8].properties.heading_known, false);
});

test("content fingerprint suppresses equal writes and detects selection changes", () => {
  const normal = createAircraftFeatureCollection(
    presentAircraft(DEVELOPMENT_AIRCRAFT, null),
  );
  const selected = createAircraftFeatureCollection(
    presentAircraft(DEVELOPMENT_AIRCRAFT, aircraftId("d00003")),
  );
  const fingerprint = aircraftFeatureFingerprint(normal);

  assert.equal(shouldWriteAircraftFeatures(null, normal), true);
  assert.equal(shouldWriteAircraftFeatures(fingerprint, normal), false);
  assert.equal(shouldWriteAircraftFeatures(fingerprint, selected), true);
});

test("sourcewriter defers an initial write until the source becomes available", () => {
  const normal = featureCollection(null);
  const harness = sourceWriterHarness(true);
  const writer = new AircraftMapSourceWriter(harness.map, normal);

  assert.equal(writer.writes, 0);
  assert.equal(harness.setDataCalls.length, 0);

  harness.makeSourceAvailable();
  assert.equal(writer.write(normal), true);
  assert.equal(writer.writes, 1);
  assert.equal(harness.setDataCalls.length, 1);
});

test("sourcewriter deduplicates only after a successful setData call", () => {
  const normal = featureCollection(null);
  const harness = sourceWriterHarness(false);
  const writer = new AircraftMapSourceWriter(harness.map, normal);

  assert.equal(writer.writes, 1);
  assert.equal(harness.setDataCalls.length, 1);
  assert.equal(writer.write(normal), false);
  assert.equal(writer.writes, 1);
  assert.equal(harness.setDataCalls.length, 1);
});

test("sourcewriter writes one changed selection after the initial collection", () => {
  const normal = featureCollection(null);
  const selected = featureCollection(aircraftId("d00003"));
  const harness = sourceWriterHarness(false);
  const writer = new AircraftMapSourceWriter(harness.map, normal);

  assert.equal(writer.write(selected), true);
  assert.equal(writer.writes, 2);
  assert.equal(harness.setDataCalls.length, 2);
  assert.deepEqual(harness.setDataCalls[1], selected);
});

test("disposed sourcewriter rejects all later writes", () => {
  const normal = featureCollection(null);
  const selected = featureCollection(aircraftId("d00003"));
  const harness = sourceWriterHarness(false);
  const writer = new AircraftMapSourceWriter(harness.map, normal);

  writer.dispose();

  assert.equal(writer.write(selected), false);
  assert.equal(writer.writes, 1);
  assert.equal(harness.setDataCalls.length, 1);
});

function featureCollection(selectedAircraftId: ReturnType<typeof aircraftId> | null) {
  return createAircraftFeatureCollection(
    presentAircraft(DEVELOPMENT_AIRCRAFT, selectedAircraftId),
  );
}

function sourceWriterHarness(deferSourceOnAdd: boolean) {
  const setDataCalls: ReturnType<typeof featureCollection>[] = [];
  let sourceAvailable = false;
  const source = {
    setData(collection: ReturnType<typeof featureCollection>) {
      setDataCalls.push(collection);
      return source;
    },
  };
  const map = {
    getSource() {
      return sourceAvailable ? source : undefined;
    },
    addSource() {
      if (!deferSourceOnAdd) sourceAvailable = true;
    },
  };

  return {
    map: map as unknown as MapLibreMap,
    setDataCalls,
    makeSourceAvailable() {
      sourceAvailable = true;
    },
  };
}
