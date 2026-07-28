import test from "node:test";
import assert from "node:assert/strict";
import { aircraftId, type Aircraft } from "../domain/aircraft.ts";
import { aircraftDetailItems } from "../presentation/aircraftDetails.ts";
import {
  FOLLOW_CAMERA_INTERVAL_MILLIS,
  shouldUpdateFollowCamera,
} from "../../map/domain/followCameraPolicy.ts";

const AIRCRAFT: Aircraft = {
  id: aircraftId("abc123"),
  latitudeDegrees: 52.123456,
  longitudeDegrees: -3.123456,
  headingDegrees: 182,
  callsign: "SKY551",
  registration: "PH-VSY",
  altitudeMeters: 10_400,
  groundSpeedMetersPerSecond: 225,
  verticalRateMetersPerSecond: -1.5,
  onGround: false,
  category: "passenger",
  lifecycle: "FRESH",
  positionTimestampEpochMillis: 1_700_000_000_000,
};

test("aircraft detail presentation uses backend SI values and readable context", () => {
  assert.deepEqual(Object.fromEntries(aircraftDetailItems(AIRCRAFT).map((item) => [item.label, item.value])), {
    Callsign: "SKY551",
    ICAO24: "ABC123",
    Registration: "PH-VSY",
    Airline: "Unknown",
    "Aircraft type": "Unknown",
    Category: "Passenger",
    "Flight number": "Unknown",
    Departure: "Not available",
    Arrival: "Not available",
    Altitude: "10400 m",
    "Ground speed": "225.0 m/s",
    "Vertical rate": "-1.5 m/s",
    Heading: "182 °",
    Latitude: "52.12346° N",
    Longitude: "3.12346° W",
    Lifecycle: "Live",
  });
});

test("aircraft detail presentation has safe unknown fallbacks and stale lifecycle", () => {
  const values = Object.fromEntries(
    aircraftDetailItems({
      ...AIRCRAFT,
      callsign: null,
      registration: null,
      altitudeMeters: null,
      groundSpeedMetersPerSecond: null,
      verticalRateMetersPerSecond: null,
      headingDegrees: null,
      category: "unknown",
      lifecycle: "STALE",
    }).map((item) => [item.label, item.value]),
  );
  assert.equal(values.Callsign, "Unknown");
  assert.equal(values.Registration, "Unknown");
  assert.equal(values.Altitude, "Unknown");
  assert.equal(values.Lifecycle, "Stale");
});

test("aircraft detail presentation uses existing provider-neutral flight leg metadata", () => {
  const values = Object.fromEntries(
    aircraftDetailItems(AIRCRAFT, {
      flightId: "flight-1",
      flightNumber: "SKY551",
      callsign: "SKY551",
      origin: { icaoCode: "EHAM", iataCode: "AMS", name: "Schiphol" },
      destination: { icaoCode: "EGLL", iataCode: "LHR", name: "Heathrow" },
      status: "ACTIVE",
    }).map((item) => [item.label, item.value]),
  );
  assert.equal(values["Flight number"], "SKY551");
  assert.equal(values.Departure, "AMS");
  assert.equal(values.Arrival, "LHR");
  assert.equal(values.Airline, "Unknown");
  assert.equal(values["Aircraft type"], "Unknown");
});

test("follow camera policy is bounded by time, distance and finite positions", () => {
  const first = { longitudeDegrees: 5, latitudeDegrees: 52, timestampMillis: 1_000 };
  assert.equal(shouldUpdateFollowCamera(null, first), true);
  assert.equal(shouldUpdateFollowCamera(first, {
    longitudeDegrees: 5.1,
    latitudeDegrees: 52,
    timestampMillis: 1_000 + FOLLOW_CAMERA_INTERVAL_MILLIS - 1,
  }), false);
  assert.equal(shouldUpdateFollowCamera(first, {
    longitudeDegrees: 5.00001,
    latitudeDegrees: 52.00001,
    timestampMillis: 2_000,
  }), false);
  assert.equal(shouldUpdateFollowCamera(first, {
    longitudeDegrees: 5.1,
    latitudeDegrees: 52,
    timestampMillis: 2_000,
  }), true);
  assert.equal(shouldUpdateFollowCamera(first, {
    longitudeDegrees: Number.NaN,
    latitudeDegrees: 52,
    timestampMillis: 2_000,
  }), false);
});
