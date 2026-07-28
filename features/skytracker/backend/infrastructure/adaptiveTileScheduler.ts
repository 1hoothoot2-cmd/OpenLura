import {
  MAXIMUM_CLIENT_REQUESTS_PER_DAY,
  POLL_INTERVAL_MILLIS,
  type PollingOutcome,
} from "./viewportPollingScheduler.ts";

const REQUEST_BUDGET_WINDOW_MILLIS = 24 * 60 * 60_000;
export const PRIORITY_TILE_LOAD_INTERVAL_MILLIS = 2_000;
type Schedule = (
  callback: () => void,
  delay: number,
) => ReturnType<typeof setTimeout>;
type Cancel = (handle: ReturnType<typeof setTimeout>) => void;

export class AdaptiveTileScheduler<
  T extends Readonly<{ key: string; priority?: string }>,
> {
  private desired: readonly T[] = [];
  private readonly lastSuccessfulRun = new Map<string, number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastRunStartedAt: number | null = null;
  private requestWindowStartedAt: number | null = null;
  private requestCount = 0;
  private failures = 0;
  private running = false;
  private paused = false;
  private disposed = false;
  private readonly run: (tile: T) => Promise<PollingOutcome>;
  private readonly isFresh: (tile: T, now: number) => boolean;
  private readonly schedule: Schedule;
  private readonly cancel: Cancel;
  private readonly now: () => number;

  constructor(
    run: (tile: T) => Promise<PollingOutcome>,
    isFresh: (tile: T, now: number) => boolean,
    schedule: Schedule = (callback, delay) =>
      globalThis.setTimeout(callback, delay),
    cancel: Cancel = (handle) => globalThis.clearTimeout(handle),
    now: () => number = Date.now,
  ) {
    this.run = run;
    this.isFresh = isFresh;
    this.schedule = schedule;
    this.cancel = cancel;
    this.now = now;
  }

  setTiles(tiles: readonly T[]) {
    if (this.disposed) return;
    this.desired = deduplicate(tiles);
    this.paused = false;
    this.reschedule(this.delayUntilNextMissingTile());
  }

  pause() {
    this.paused = true;
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
  }

  resume() {
    if (this.disposed) return;
    this.paused = false;
    this.reschedule(this.delayUntilNextMissingTile());
  }

  dispose() {
    this.disposed = true;
    this.pause();
    this.desired = [];
  }

  private reschedule(delay: number) {
    if (this.disposed || this.paused || this.running) return;
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
    if (this.desired.length === 0) return;
    this.queue(delay);
  }

  private queue(delay: number) {
    this.timer = this.schedule(async () => {
      this.timer = null;
      if (this.disposed || this.paused || this.running) return;
      const tile = this.nextTile();
      if (!tile) {
        this.queue(POLL_INTERVAL_MILLIS);
        return;
      }
      if (!this.consumeBudget()) {
        this.queue(this.delayUntilBudgetReset());
        return;
      }
      this.running = true;
      const startedAt = this.now();
      const outcome = await this.run(tile);
      this.running = false;
      if (outcome !== "skipped") this.lastRunStartedAt = startedAt;
      if (outcome === true) {
        this.lastSuccessfulRun.set(tile.key, startedAt);
        this.failures = 0;
      } else if (outcome === false) {
        this.failures = Math.min(this.failures + 1, 4);
      }
      if (this.disposed || this.paused) return;
      this.queue(
        outcome === false
          ? Math.min(5, 2 ** (this.failures - 1)) * POLL_INTERVAL_MILLIS
          : this.delayUntilNextMissingTile(),
      );
    }, Math.max(0, delay));
  }

  private nextTile() {
    const now = this.now();
    const missing = this.desired.find((tile) => !this.isFresh(tile, now));
    if (missing) return missing;
    const focus = this.desired.find((tile) => tile.priority === "focus");
    if (focus) return focus;
    return [...this.desired].sort(
      (left, right) =>
        (this.lastSuccessfulRun.get(left.key) ?? 0) -
        (this.lastSuccessfulRun.get(right.key) ?? 0),
    )[0];
  }

  private delayUntilNextMissingTile() {
    if (this.desired.length === 0) return POLL_INTERVAL_MILLIS;
    const hasMissing = this.desired.some((tile) => !this.isFresh(tile, this.now()));
    if (!hasMissing) return POLL_INTERVAL_MILLIS;
    if (this.lastRunStartedAt === null) return 0;
    return Math.max(
      0,
      PRIORITY_TILE_LOAD_INTERVAL_MILLIS -
        (this.now() - this.lastRunStartedAt),
    );
  }

  private consumeBudget() {
    const now = this.now();
    if (
      this.requestWindowStartedAt === null ||
      now - this.requestWindowStartedAt >= REQUEST_BUDGET_WINDOW_MILLIS
    ) {
      this.requestWindowStartedAt = now;
      this.requestCount = 0;
    }
    if (this.requestCount >= MAXIMUM_CLIENT_REQUESTS_PER_DAY) return false;
    this.requestCount += 1;
    return true;
  }

  private delayUntilBudgetReset() {
    if (this.requestWindowStartedAt === null) return POLL_INTERVAL_MILLIS;
    return Math.max(
      POLL_INTERVAL_MILLIS,
      REQUEST_BUDGET_WINDOW_MILLIS -
        (this.now() - this.requestWindowStartedAt),
    );
  }
}

function deduplicate<T extends Readonly<{ key: string; priority?: string }>>(
  tiles: readonly T[],
) {
  return [...new Map(tiles.map((tile) => [tile.key, tile])).values()];
}
