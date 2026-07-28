import type { Aircraft } from "../../aircraft/domain/aircraft.ts";
import { parseLiveAircraftSnapshot } from "../domain/liveAircraftSnapshot.ts";

export type GlobalAircraftSearchClientResult =
  | Readonly<{ ok: true; aircraft: readonly Aircraft[]; cacheStatus: string | null }>
  | Readonly<{
      ok: false;
      category: "invalid-query" | "unavailable" | "malformed";
    }>;

export async function searchGlobalAircraft(
  query: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<GlobalAircraftSearchClientResult> {
  const normalized = query.trim();
  if (!/^[a-z0-9-]{2,16}$/i.test(normalized)) {
    return { ok: false, category: "invalid-query" };
  }
  const url = new URL("/api/skytracker/aircraft/search", "http://localhost");
  url.searchParams.set("q", normalized);
  const response = await fetcher(`${url.pathname}${url.search}`, {
    method: "GET",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return {
      ok: false,
      category: response.status === 400 ? "invalid-query" : "unavailable",
    };
  }
  try {
    return {
      ok: true,
      aircraft: parseLiveAircraftSnapshot(await response.json()).aircraft,
      cacheStatus: response.headers.get("x-cache-status"),
    };
  } catch {
    return { ok: false, category: "malformed" };
  }
}
