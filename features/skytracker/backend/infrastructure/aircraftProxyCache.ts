export const AIRCRAFT_EDGE_CACHE_SECONDS = 5 * 60;
export const AIRCRAFT_EDGE_STALE_SECONDS = 30;

export function aircraftProxyCacheHeaders(success: boolean) {
  return success
    ? {
        "Cache-Control": "private, no-store",
        "Vercel-CDN-Cache-Control":
          `public, s-maxage=${AIRCRAFT_EDGE_CACHE_SECONDS}, ` +
          `stale-while-revalidate=${AIRCRAFT_EDGE_STALE_SECONDS}`,
      }
    : {
        "Cache-Control": "private, no-store",
      };
}
