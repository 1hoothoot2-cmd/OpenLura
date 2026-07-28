import {
  normalizeViewportBounds,
  type ViewportBounds,
  type ViewportBoundsResult,
} from "./viewportBounds.ts";

export const GLOBAL_QUERY_SPAN_DEGREES = 4;
export const GLOBAL_QUERY_GRID_DEGREES = 2;

export type GlobalViewportQuery =
  | Readonly<{
      valid: true;
      bounds: ViewportBounds;
      key: string;
    }>
  | Readonly<{ valid: false }>;

/**
 * Maps any finite world-map center to a stable 4° × 4° provider query.
 *
 * The overlapping 2° grid avoids a provider request for small pans while
 * keeping every request below the existing 16-square-degree web limit. Near
 * poles and the antimeridian the window shifts inward instead of crossing an
 * unsupported boundary.
 */
export function createGlobalViewportQuery(
  latitudeDegrees: number,
  longitudeDegrees: number,
): GlobalViewportQuery {
  if (!Number.isFinite(latitudeDegrees) || !Number.isFinite(longitudeDegrees)) {
    return { valid: false };
  }

  const latitude = clamp(latitudeDegrees, -90, 90);
  const longitude = wrapLongitude(longitudeDegrees);
  const halfSpan = GLOBAL_QUERY_SPAN_DEGREES / 2;
  const snappedLatitude =
    Math.round(latitude / GLOBAL_QUERY_GRID_DEGREES) *
    GLOBAL_QUERY_GRID_DEGREES;
  const snappedLongitude =
    Math.round(longitude / GLOBAL_QUERY_GRID_DEGREES) *
    GLOBAL_QUERY_GRID_DEGREES;
  const minimumLatitude = clamp(
    snappedLatitude - halfSpan,
    -90,
    90 - GLOBAL_QUERY_SPAN_DEGREES,
  );
  const minimumLongitude = clamp(
    snappedLongitude - halfSpan,
    -180,
    180 - GLOBAL_QUERY_SPAN_DEGREES,
  );

  return fromNormalized(
    normalizeViewportBounds({
      minLat: minimumLatitude,
      minLon: minimumLongitude,
      maxLat: minimumLatitude + GLOBAL_QUERY_SPAN_DEGREES,
      maxLon: minimumLongitude + GLOBAL_QUERY_SPAN_DEGREES,
    }),
  );
}

function fromNormalized(result: ViewportBoundsResult): GlobalViewportQuery {
  return result.valid
    ? { valid: true, bounds: result.bounds, key: result.key }
    : { valid: false };
}

function wrapLongitude(value: number) {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
