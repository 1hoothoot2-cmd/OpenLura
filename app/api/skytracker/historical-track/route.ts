import { NextRequest, NextResponse } from "next/server";
import { aircraftId, type Aircraft } from "@/features/skytracker/aircraft/domain/aircraft";
import { fetchHistoricalTrackFromBackend } from "@/features/skytracker/historical-track/infrastructure/historicalTrackClient";
import { resolveSkyTrackerApiConfig } from "@/features/skytracker/backend/infrastructure/skyTrackerApiConfig";

const AIRCRAFT_ID_PATTERN = /^[0-9a-f]{6}$/i;

export async function GET(request: NextRequest) {
  const config = resolveSkyTrackerApiConfig();
  if (!config.configured) {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }

  const rawAircraftId = request.nextUrl.searchParams.get("aircraftId")?.trim();
  const rawObservedAt = request.nextUrl.searchParams.get(
    "observedAtEpochSeconds",
  );
  const observedAtEpochSeconds = Number(rawObservedAt);
  if (
    !rawAircraftId ||
    !AIRCRAFT_ID_PATTERN.test(rawAircraftId) ||
    !Number.isInteger(observedAtEpochSeconds) ||
    observedAtEpochSeconds <= 0
  ) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const result = await fetchHistoricalTrackFromBackend(
    config.baseUrl,
    {
      id: aircraftId(rawAircraftId),
      callsign: request.nextUrl.searchParams.get("callsign")?.trim() || null,
      positionTimestampEpochMillis: observedAtEpochSeconds * 1_000,
    } satisfies Pick<
      Aircraft,
      "id" | "callsign" | "positionTimestampEpochMillis"
    >,
    request.signal,
  );
  if (!result.ok) {
    return NextResponse.json(
      { status: result.category },
      { status: result.category === "malformed" ? 502 : 404 },
    );
  }
  return NextResponse.json({
    flight: result.flight,
    track: result.track
      ? {
          ...result.track,
          points: result.track.points.map((point) => ({
            latitude: point.latitudeDegrees,
            longitude: point.longitudeDegrees,
            observedAtEpochSeconds: point.observedAtEpochSeconds,
          })),
        }
      : null,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
