type LocalHistoricalTrackResponse = Readonly<{
  flight: Readonly<{
    flightId: string;
    aircraftId: string;
    flightNumber: string;
    callsign: string;
    origin: Readonly<{
      icaoCode: string;
      iataCode: string;
      name: string;
    }>;
    destination: Readonly<{
      icaoCode: string;
      iataCode: string;
      name: string;
    }>;
    status: "ACTIVE";
  }>;
  track: Readonly<{
    flightId: string;
    aircraftId: string;
    provider: "local-test";
    providerFlightId: string;
    startedAtEpochSeconds: number;
    endedAtEpochSeconds: number;
    points: readonly Readonly<{
      latitude: number;
      longitude: number;
      observedAtEpochSeconds: number;
    }>[];
    segments: readonly Readonly<{
      startIndex: number;
      endIndex: number;
      reason: "CONTINUOUS";
    }>[];
    completeness: "PARTIAL";
    retrievedAtEpochSeconds: number;
    expiresAtEpochSeconds: number;
  }>;
}>;

const HISTORY_AIRCRAFT_ID = "406a3d";

export function createLocalHistoricalTrackFixture(
  aircraftId: string,
  observedAtEpochSeconds: number,
): LocalHistoricalTrackResponse | null {
  if (aircraftId.toLowerCase() !== HISTORY_AIRCRAFT_ID) return null;

  const startedAtEpochSeconds = observedAtEpochSeconds - 180;
  return {
    flight: {
      flightId: "local-test-flight-sky553",
      aircraftId: HISTORY_AIRCRAFT_ID,
      flightNumber: "SKY553",
      callsign: "SKY553",
      origin: {
        icaoCode: "EHAM",
        iataCode: "AMS",
        name: "Amsterdam Airport Schiphol",
      },
      destination: {
        icaoCode: "EBBR",
        iataCode: "BRU",
        name: "Brussels Airport",
      },
      status: "ACTIVE",
    },
    track: {
      flightId: "local-test-flight-sky553",
      aircraftId: HISTORY_AIRCRAFT_ID,
      provider: "local-test",
      providerFlightId: "local-test-sky553",
      startedAtEpochSeconds,
      endedAtEpochSeconds: observedAtEpochSeconds,
      points: [
        {
          latitude: 51.02,
          longitude: 3.38,
          observedAtEpochSeconds: startedAtEpochSeconds,
        },
        {
          latitude: 50.975,
          longitude: 3.5,
          observedAtEpochSeconds: observedAtEpochSeconds - 90,
        },
        {
          latitude: 50.93,
          longitude: 3.62,
          observedAtEpochSeconds,
        },
      ],
      segments: [{ startIndex: 0, endIndex: 2, reason: "CONTINUOUS" }],
      completeness: "PARTIAL",
      retrievedAtEpochSeconds: observedAtEpochSeconds,
      expiresAtEpochSeconds: observedAtEpochSeconds + 300,
    },
  };
}
