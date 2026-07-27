import { aircraftId, type Aircraft } from "../domain/aircraft.ts";

const FIXTURE_TIME = Date.parse("2026-07-26T18:00:00.000Z");

export const DEVELOPMENT_AIRCRAFT: readonly Aircraft[] = [
  fixture("d00001", 52.31, 4.76, 0, "DEV001", "PH-DVA", 3150, 132, false, "passenger"),
  fixture("d00002", 51.98, 5.91, 90, "DEV090", "D-DVB", 8600, 221, false, "cargo"),
  fixture("d00003", 50.93, 3.62, 180, "DEV180", "OO-DVC", 11000, 246, false, "passenger"),
  fixture("d00004", 53.18, 6.58, 270, "DEV270", "PH-DVD", 4200, 158, false, "business"),
  fixture("d00005", 52.02, 1.94, 42, "FIX042", "G-DVE", 9800, 229, false, "passenger"),
  fixture("d00006", 49.72, 6.18, 136, "FIX136", "LX-DVF", 7600, 204, false, "cargo"),
  fixture("d00007", 48.97, 2.44, 224, "FIX224", "F-DVG", 10400, 238, false, "passenger"),
  fixture("d00008", 51.14, 7.08, 315, "FIX315", "D-DVH", 5600, 181, false, "business"),
  fixture("d00009", 52.17, 4.49, null, "NOHDG", null, 2300, 119, false, "unknown"),
  fixture("d0000a", 50.9, 4.48, 12, "GROUND", "OO-DVJ", 56, 4, true, "passenger"),
  fixture("d0000b", 54.02, 3.88, 198, null, "PH-DVK", 7300, 194, false, "helicopter"),
  fixture("d0000c", 50.08, 8.55, 72, "FIX072", null, 9100, 218, false, "passenger"),
];

export const INITIAL_SELECTED_AIRCRAFT_ID = aircraftId("d00003");

function fixture(
  id: string,
  latitudeDegrees: number,
  longitudeDegrees: number,
  headingDegrees: number | null,
  callsign: string | null,
  registration: string | null,
  altitudeMeters: number,
  groundSpeedMetersPerSecond: number,
  onGround: boolean,
  category: Aircraft["category"],
): Aircraft {
  return {
    id: aircraftId(id),
    latitudeDegrees,
    longitudeDegrees,
    headingDegrees,
    callsign,
    registration,
    altitudeMeters,
    groundSpeedMetersPerSecond,
    onGround,
    category,
    positionTimestampEpochMillis: FIXTURE_TIME,
  };
}
