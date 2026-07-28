import type { LiveAircraftSnapshot } from "../domain/liveAircraftSnapshot.ts";
import { parseLiveAircraftSnapshot } from "../domain/liveAircraftSnapshot.ts";
import type { ViewportBounds } from "../domain/viewportBounds.ts";

export type LiveAircraftClientResult =
  | Readonly<{ ok: true; snapshot: LiveAircraftSnapshot; requestId: string | null; cacheStatus: string | null; etag: string | null }>
  | Readonly<{ ok: false; category: "viewport" | "unavailable" | "malformed"; retryable: boolean; requestId: string | null }>;

export async function fetchLiveAircraft(
  bounds: ViewportBounds,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<LiveAircraftClientResult> {
  const url = new URL("/api/skytracker/aircraft", "http://localhost");
  for (const [key, value] of Object.entries(bounds)) {
    url.searchParams.set(key, String(value));
  }
  const response = await fetcher(`${url.pathname}${url.search}`, {
    method: "GET",
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
  });
  const requestId = response.headers.get("x-request-id");
  if (!response.ok) {
    return {
      ok: false,
      category: response.status === 400 || response.status === 413 ? "viewport" : "unavailable",
      retryable: response.status === 502 || response.status === 503 || response.status === 429,
      requestId,
    };
  }
  try {
    return {
      ok: true,
      snapshot: parseLiveAircraftSnapshot(await response.json()),
      requestId,
      cacheStatus: response.headers.get("x-cache-status"),
      etag: response.headers.get("etag"),
    };
  } catch {
    return { ok: false, category: "malformed", retryable: true, requestId };
  }
}
