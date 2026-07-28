export const POLL_INTERVAL_MILLIS = 6 * 60_000;
export const REQUEST_TIMEOUT_MILLIS = 14_000;
export const MOVE_END_DEBOUNCE_MILLIS = 400;
export const REGION_CHANGE_MIN_INTERVAL_MILLIS = 30_000;
export const MAXIMUM_CLIENT_REQUESTS_PER_DAY = 240;
const REQUEST_BUDGET_WINDOW_MILLIS = 24 * 60 * 60_000;
const BACKOFF = [
  POLL_INTERVAL_MILLIS,
  2 * POLL_INTERVAL_MILLIS,
  4 * POLL_INTERVAL_MILLIS,
  5 * POLL_INTERVAL_MILLIS,
] as const;
type Schedule = (
  callback: () => void,
  delay: number,
) => ReturnType<typeof setTimeout>;
type Cancel = (handle: ReturnType<typeof setTimeout>) => void;
export type PollingOutcome = boolean | "skipped";

export class ViewportPollingScheduler {
  private readonly run: () => Promise<PollingOutcome>;
  private readonly schedule: Schedule;
  private readonly cancel: Cancel;
  private readonly now: () => number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastRunStartedAt: number | null = null;
  private failures = 0;
  private disposed = false;
  private running = false;
  private paused = false;
  private restartRequested = false;
  private regionRestartRequested = false;
  private activeRegionKey: string | null = null;
  private requestWindowStartedAt: number | null = null;
  private requestCount = 0;

  constructor(
    run: () => Promise<PollingOutcome>,
    schedule: Schedule = (callback, delay) =>
      globalThis.setTimeout(callback, delay),
    cancel: Cancel = (handle) => globalThis.clearTimeout(handle),
    now: () => number = Date.now,
  ) {
    this.run = run;
    this.schedule = schedule;
    this.cancel = cancel;
    this.now = now;
  }

  start(immediate = true) {
    if (this.disposed || this.timer !== null || this.running) return;
    this.paused = false;
    this.queue(immediate ? this.delayUntilNextRun() : POLL_INTERVAL_MILLIS);
  }

  pause() {
    this.paused = true;
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
  }

  resume() {
    this.paused = false;
    this.start(true);
  }

  reset() {
    this.failures = 0;
    this.paused = false;
    if (this.running) {
      this.restartRequested = true;
      return;
    }
    this.pause();
    this.paused = false;
    this.start(true);
  }

  regionChanged(regionKey: string) {
    if (this.disposed || regionKey === this.activeRegionKey) return;
    this.activeRegionKey = regionKey;
    this.failures = 0;
    this.paused = false;
    if (this.running) {
      this.regionRestartRequested = true;
      return;
    }
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
    this.queue(this.delayUntilRegionRun());
  }

  dispose() {
    this.disposed = true;
    this.pause();
  }

  private queue(delay: number) {
    this.timer = this.schedule(async () => {
      this.timer = null;
      if (this.disposed || this.running) return;
      if (!this.consumeRequestBudget()) {
        this.queue(this.delayUntilBudgetReset());
        return;
      }
      this.running = true;
      const runStartedAt = this.now();
      const outcome = await this.run();
      if (outcome !== "skipped") this.lastRunStartedAt = runStartedAt;
      this.running = false;
      if (this.disposed || this.paused) return;
      if (this.restartRequested) {
        this.restartRequested = false;
        this.queue(this.delayUntilNextRun());
        return;
      }
      if (this.regionRestartRequested) {
        this.regionRestartRequested = false;
        this.queue(this.delayUntilRegionRun());
        return;
      }
      this.failures = outcome === true
        ? 0
        : outcome === false
          ? Math.min(this.failures + 1, BACKOFF.length)
          : this.failures;
      const next = outcome !== false
        ? POLL_INTERVAL_MILLIS
        : BACKOFF[Math.min(this.failures - 1, BACKOFF.length - 1)];
      this.queue(next);
    }, delay);
  }

  private delayUntilNextRun() {
    if (this.lastRunStartedAt === null) return 0;
    const elapsed = this.now() - this.lastRunStartedAt;
    if (elapsed <= 0) return POLL_INTERVAL_MILLIS;
    return Math.max(0, POLL_INTERVAL_MILLIS - elapsed);
  }

  private delayUntilRegionRun() {
    if (this.lastRunStartedAt === null) return 0;
    return Math.max(
      0,
      REGION_CHANGE_MIN_INTERVAL_MILLIS -
        (this.now() - this.lastRunStartedAt),
    );
  }

  private consumeRequestBudget() {
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
