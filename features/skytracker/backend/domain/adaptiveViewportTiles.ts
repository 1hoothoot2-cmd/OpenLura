import type { ViewportBounds } from "./viewportBounds.ts";

export const ADAPTIVE_TILE_SPAN_DEGREES = 4;
export const MAXIMUM_VISIBLE_TILES = 12;

export type VisibleWorldBounds = Readonly<{
  south: number;
  west: number;
  north: number;
  east: number;
}>;

export type AdaptiveViewportTile = Readonly<{
  key: string;
  bounds: ViewportBounds;
  centerLatitude: number;
  centerLongitude: number;
}>;

export type AdaptiveViewportPlan = Readonly<{
  tiles: readonly AdaptiveViewportTile[];
  totalTileCount: number;
  sampled: boolean;
  signature: string;
}>;

/**
 * Splits the visible map into stable, non-overlapping 4° × 4° backend queries.
 * When the viewport contains more regions than the provider budget can safely
 * sustain, representative regions are selected evenly across the viewport.
 */
export function planAdaptiveViewport(
  bounds: VisibleWorldBounds,
  maximumTiles = MAXIMUM_VISIBLE_TILES,
): AdaptiveViewportPlan {
  if (
    maximumTiles < 1 ||
    !Number.isInteger(maximumTiles) ||
    ![bounds.south, bounds.west, bounds.north, bounds.east].every(Number.isFinite)
  ) {
    return { tiles: [], totalTileCount: 0, sampled: false, signature: "" };
  }

  const south = clamp(Math.min(bounds.south, bounds.north), -90, 90);
  const north = clamp(Math.max(bounds.south, bounds.north), -90, 90);
  if (north <= south) {
    return { tiles: [], totalTileCount: 0, sampled: false, signature: "" };
  }

  const latitudeIndices = indicesForRange(south, north, -90, 90);
  const longitudeIntervals = visibleLongitudeIntervals(bounds.west, bounds.east);
  const longitudeIndices = uniqueSorted(
    longitudeIntervals.flatMap(([west, east]) =>
      indicesForRange(west, east, -180, 180),
    ),
  );
  const allTiles = latitudeIndices.flatMap((latitudeIndex) =>
    longitudeIndices.map((longitudeIndex) =>
      createTile(latitudeIndex, longitudeIndex),
    ),
  );
  const tiles =
    allTiles.length <= maximumTiles
      ? sortByViewportCenter(allTiles, bounds)
      : selectRepresentativeTiles(allTiles, maximumTiles, bounds);

  return {
    tiles,
    totalTileCount: allTiles.length,
    sampled: allTiles.length > tiles.length,
    signature: tiles.map((tile) => tile.key).sort().join("|"),
  };
}

function indicesForRange(
  minimum: number,
  maximum: number,
  worldMinimum: number,
  worldMaximum: number,
) {
  const first = Math.floor((minimum - worldMinimum) / ADAPTIVE_TILE_SPAN_DEGREES);
  const adjustedMaximum =
    maximum === worldMaximum ? maximum - Number.EPSILON : maximum;
  const last = Math.floor(
    (adjustedMaximum - worldMinimum) / ADAPTIVE_TILE_SPAN_DEGREES,
  );
  const maximumIndex =
    (worldMaximum - worldMinimum) / ADAPTIVE_TILE_SPAN_DEGREES - 1;
  const result: number[] = [];
  for (
    let index = clamp(first, 0, maximumIndex);
    index <= clamp(last, 0, maximumIndex);
    index += 1
  ) {
    result.push(index);
  }
  return result;
}

function visibleLongitudeIntervals(west: number, east: number) {
  const span = east - west;
  if (Math.abs(span) >= 360) return [[-180, 180] as const];
  const normalizedWest = wrapLongitude(west);
  const normalizedEast = wrapLongitude(east);
  if (normalizedWest <= normalizedEast && span >= 0) {
    return [[normalizedWest, normalizedEast] as const];
  }
  return [
    [normalizedWest, 180] as const,
    [-180, normalizedEast] as const,
  ];
}

function createTile(latitudeIndex: number, longitudeIndex: number) {
  const minLat = -90 + latitudeIndex * ADAPTIVE_TILE_SPAN_DEGREES;
  const minLon = -180 + longitudeIndex * ADAPTIVE_TILE_SPAN_DEGREES;
  const bounds = {
    minLat,
    minLon,
    maxLat: minLat + ADAPTIVE_TILE_SPAN_DEGREES,
    maxLon: minLon + ADAPTIVE_TILE_SPAN_DEGREES,
  };
  return {
    key: `${bounds.minLat}:${bounds.minLon}:${bounds.maxLat}:${bounds.maxLon}`,
    bounds,
    centerLatitude: minLat + ADAPTIVE_TILE_SPAN_DEGREES / 2,
    centerLongitude: minLon + ADAPTIVE_TILE_SPAN_DEGREES / 2,
  };
}

function selectRepresentativeTiles(
  tiles: readonly AdaptiveViewportTile[],
  maximumTiles: number,
  bounds: VisibleWorldBounds,
) {
  const ordered = sortByViewportCenter(tiles, bounds);
  const selected = new Map<string, AdaptiveViewportTile>();
  selected.set(ordered[0].key, ordered[0]);
  for (let index = 0; selected.size < maximumTiles; index += 1) {
    const position = Math.round(
      (index * (ordered.length - 1)) / Math.max(1, maximumTiles - 1),
    );
    selected.set(ordered[position].key, ordered[position]);
  }
  return [...selected.values()].sort(
    (left, right) =>
      distanceFromViewportCenter(left, bounds) -
        distanceFromViewportCenter(right, bounds) ||
      left.key.localeCompare(right.key),
  );
}

function sortByViewportCenter(
  tiles: readonly AdaptiveViewportTile[],
  bounds: VisibleWorldBounds,
) {
  return [...tiles].sort(
    (left, right) =>
      distanceFromViewportCenter(left, bounds) -
        distanceFromViewportCenter(right, bounds) ||
      left.key.localeCompare(right.key),
  );
}

function distanceFromViewportCenter(
  tile: AdaptiveViewportTile,
  bounds: VisibleWorldBounds,
) {
  const latitude = (bounds.south + bounds.north) / 2;
  const longitude = wrapLongitude(bounds.west + (bounds.east - bounds.west) / 2);
  const longitudeDelta = Math.abs(tile.centerLongitude - longitude);
  const wrappedLongitudeDelta = Math.min(longitudeDelta, 360 - longitudeDelta);
  return (
    Math.abs(tile.centerLatitude - latitude) ** 2 +
    wrappedLongitudeDelta ** 2
  );
}

function uniqueSorted(values: readonly number[]) {
  return [...new Set(values)].sort((left, right) => left - right);
}

function wrapLongitude(value: number) {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
