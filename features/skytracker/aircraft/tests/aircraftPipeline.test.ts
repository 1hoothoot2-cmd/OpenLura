import test from "node:test";
import assert from "node:assert/strict";
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
