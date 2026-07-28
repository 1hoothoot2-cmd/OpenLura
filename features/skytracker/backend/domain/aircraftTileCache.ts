import type { Aircraft } from "../../aircraft/domain/aircraft.ts";

export const AIRCRAFT_TILE_CACHE_MAXIMUM_ENTRIES = 64;
export const AIRCRAFT_TILE_CACHE_TTL_MILLIS = 25 * 60 * 60_000;
export const AIRCRAFT_TILE_REFRESH_MILLIS = 7 * 60_000;
export const AIRCRAFT_BACKGROUND_REFRESH_MILLIS = 24 * 60 * 60_000;

type TileEntry = Readonly<{
  aircraft: readonly Aircraft[];
  fetchedAt: number;
  cacheStatus: string | null;
}>;

export class AircraftTileCache {
  private readonly entries = new Map<string, TileEntry>();
  private readonly maximumEntries: number;
  private readonly ttlMillis: number;

  constructor(
    maximumEntries = AIRCRAFT_TILE_CACHE_MAXIMUM_ENTRIES,
    ttlMillis = AIRCRAFT_TILE_CACHE_TTL_MILLIS,
  ) {
    this.maximumEntries = maximumEntries;
    this.ttlMillis = ttlMillis;
  }

  put(
    key: string,
    aircraft: readonly Aircraft[],
    fetchedAt: number,
    cacheStatus: string | null = null,
  ) {
    this.entries.delete(key);
    this.entries.set(key, { aircraft: [...aircraft], fetchedAt, cacheStatus });
    while (this.entries.size > this.maximumEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  hasFresh(key: string, now: number, refreshMillis = AIRCRAFT_TILE_REFRESH_MILLIS) {
    const entry = this.entries.get(key);
    return Boolean(entry && now - entry.fetchedAt < refreshMillis);
  }

  loadedCount(keys: readonly string[], now: number) {
    this.prune(now);
    return keys.filter((key) => this.entries.has(key)).length;
  }

  hasDelayedData(keys: readonly string[], now: number) {
    this.prune(now);
    return keys.some(
      (key) => this.entries.get(key)?.cacheStatus?.includes("stale") === true,
    );
  }

  merge(keys: readonly string[], now: number) {
    this.prune(now);
    const aircraft = new Map<string, Aircraft>();
    for (const key of keys) {
      for (const candidate of this.entries.get(key)?.aircraft ?? []) {
        const current = aircraft.get(candidate.id);
        if (
          !current ||
          candidate.positionTimestampEpochMillis >
            current.positionTimestampEpochMillis
        ) {
          aircraft.set(candidate.id, candidate);
        }
      }
    }
    return [...aircraft.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
  }

  private prune(now: number) {
    for (const [key, entry] of this.entries) {
      if (now - entry.fetchedAt >= this.ttlMillis) this.entries.delete(key);
    }
  }
}
