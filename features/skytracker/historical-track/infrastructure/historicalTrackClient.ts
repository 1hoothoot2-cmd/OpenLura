import type { Aircraft } from "../../aircraft/domain/aircraft.ts";
import {
  parseHistoricalTrack,
  type HistoricalTrack,
} from "../domain/historicalTrack.ts";

export type HistoricalTrackClientResult =
  | Readonly<{ ok: true; track: HistoricalTrack }>
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
    const track = parseHistoricalTrack(await response.json());
    return track.aircraftId === aircraft.id
      ? { ok: true, track }
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

  let flightId: string;
  try {
    const flightLeg = await flightLegResponse.json();
    if (
      typeof flightLeg !== "object" ||
      flightLeg === null ||
      typeof flightLeg.flightId !== "string" ||
      flightLeg.flightId.trim().length === 0
    ) {
      return { ok: false, category: "malformed" };
    }
    flightId = flightLeg.flightId.trim();
  } catch {
    return { ok: false, category: "malformed" };
  }

  const trackResponse = await fetcher(
    new URL(
      `/v1/historical-tracks/${encodeURIComponent(flightId)}`,
      `${baseUrl}/`,
    ),
    {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
    },
  );
  if (!trackResponse.ok) return { ok: false, category: "unavailable" };

  try {
    const track = parseHistoricalTrack(await trackResponse.json());
    if (track.flightId !== flightId || track.aircraftId !== aircraft.id) {
      return { ok: false, category: "malformed" };
    }
    return { ok: true, track };
  } catch {
    return { ok: false, category: "malformed" };
  }
}
