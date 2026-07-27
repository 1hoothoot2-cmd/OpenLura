export type ViewportBounds = Readonly<{
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}>;

export type ViewportBoundsResult =
  | Readonly<{ valid: true; bounds: ViewportBounds; key: string }>
  | Readonly<{ valid: false; reason: "non-finite" | "too-large" | "antimeridian" | "range" }>;

export function normalizeViewportBounds(bounds: ViewportBounds): ViewportBoundsResult {
  const values = [bounds.minLat, bounds.minLon, bounds.maxLat, bounds.maxLon];
  if (values.some((value) => !Number.isFinite(value))) {
    return { valid: false, reason: "non-finite" };
  }
  if (
    bounds.minLat < -90 ||
    bounds.maxLat > 90 ||
    bounds.minLon < -180 ||
    bounds.maxLon > 180 ||
    bounds.minLat > bounds.maxLat
  ) {
    return { valid: false, reason: "range" };
  }
  if (bounds.minLon > bounds.maxLon) {
    return { valid: false, reason: "antimeridian" };
  }
  if (bounds.maxLat - bounds.minLat > 30 || bounds.maxLon - bounds.minLon > 60) {
    return { valid: false, reason: "too-large" };
  }
  const normalized = {
    minLat: precision(bounds.minLat),
    minLon: precision(bounds.minLon),
    maxLat: precision(bounds.maxLat),
    maxLon: precision(bounds.maxLon),
  };
  return {
    valid: true,
    bounds: normalized,
    key: [normalized.minLat, normalized.minLon, normalized.maxLat, normalized.maxLon].join(":"),
  };
}

function precision(value: number) {
  return Number(value.toFixed(5));
}
