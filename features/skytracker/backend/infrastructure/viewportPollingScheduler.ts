export const POLL_INTERVAL_MILLIS = 6 * 60_000;
export const REQUEST_TIMEOUT_MILLIS = 14_000;
export const MOVE_END_DEBOUNCE_MILLIS = 400;
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

export class ViewportPollingScheduler {
  private readonly run: () => Promise<boolean>;
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

  constructor(
    run: () => Promise<boolean>,
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

  dispose() {
    this.disposed = true;
    this.pause();
  }

  private queue(delay: number) {
    this.timer = this.schedule(async () => {
      this.timer = null;
      if (this.disposed || this.running) return;
      this.running = true;
      this.lastRunStartedAt = this.now();
      const success = await this.run();
      this.running = false;
      if (this.disposed || this.paused) return;
      if (this.restartRequested) {
        this.restartRequested = false;
        this.queue(this.delayUntilNextRun());
        return;
      }
      this.failures = success ? 0 : Math.min(this.failures + 1, BACKOFF.length);
      const next = success
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
}
