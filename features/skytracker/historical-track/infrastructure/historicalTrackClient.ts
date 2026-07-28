import type { Aircraft } from "../../aircraft/domain/aircraft.ts";
import {
  parseHistoricalTrack,
  type HistoricalTrack,
} from "../domain/historicalTrack.ts";
import {
  parseFlightLegInformation,
  type FlightLegInformation,
} from "../domain/flightLegInformation.ts";

export type HistoricalTrackClientResult =
  | Readonly<{
      ok: true;
      track: HistoricalTrack | null;
      flight: FlightLegInformation;
    }>
  | Readonly<{ ok: false; category: "unavailable" | "malformed" }>;

export async function fetchHistoricalTrackForAircraft(
  aircraft: Aircraft,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<HistoricalTrackClientResult> {
  const url = new URL("/api/skytracker/historical-track", "http://localhost");
  url.searchParams.set("aircraftId", aircraft.id);
  if (aircraft.callsign) url.searchParams.set("callsign", aircraft.callsign);
  url.searchParams.set(
    "observedAtEpochSeconds",
    String(Math.floor(aircraft.positionTimestampEpochMillis / 1_000)),
  );
  const response = await fetcher(`${url.pathname}${url.search}`, {
    method: "GET",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return { ok: false, category: "unavailable" };
  try {
    const payload = await response.json();
    if (!isRecord(payload)) return { ok: false, category: "malformed" };
    const flight = parseFlightLegInformation(payload.flight);
    const track =
      payload.track == null ? null : parseHistoricalTrack(payload.track);
    return !track || track.aircraftId === aircraft.id
      ? { ok: true, track, flight }
      : { ok: false, category: "malformed" };
  } catch {
    return { ok: false, category: "malformed" };
  }
}

export async function fetchHistoricalTrackFromBackend(
  baseUrl: string,
  aircraft: Pick<Aircraft, "id" | "callsign" | "positionTimestampEpochMillis">,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<HistoricalTrackClientResult> {
  const flightLegUrl = new URL(
    `/v1/flightlegs/${encodeURIComponent(aircraft.id)}`,
    `${baseUrl}/`,
  );
  if (aircraft.callsign) {
    flightLegUrl.searchParams.set("callsign", aircraft.callsign);
  }
  flightLegUrl.searchParams.set(
    "observedAtEpochSeconds",
    String(Math.floor(aircraft.positionTimestampEpochMillis / 1_000)),
  );

  const flightLegResponse = await fetcher(flightLegUrl, {
    method: "GET",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!flightLegResponse.ok) return { ok: false, category: "unavailable" };

  let flight: FlightLegInformation;
  try {
    flight = parseFlightLegInformation(await flightLegResponse.json());
  } catch {
    return { ok: false, category: "malformed" };
  }

  const trackResponse = await fetcher(
    new URL(
      `/v1/historical-tracks/${encodeURIComponent(flight.flightId)}`,
      `${baseUrl}/`,
    ),
    {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
    },
  );
  if (!trackResponse.ok) return { ok: true, track: null, flight };

  try {
    const track = parseHistoricalTrack(await trackResponse.json());
    if (track.flightId !== flight.flightId || track.aircraftId !== aircraft.id) {
      return { ok: false, category: "malformed" };
    }
    return { ok: true, track, flight };
  } catch {
    return { ok: false, category: "malformed" };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
