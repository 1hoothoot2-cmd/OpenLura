export const POLL_INTERVAL_MILLIS = 4_000;
export const REQUEST_TIMEOUT_MILLIS = 8_000;
export const MOVE_END_DEBOUNCE_MILLIS = 400;
const BACKOFF = [4_000, 8_000, 16_000, 30_000] as const;
type Schedule = (
  callback: () => void,
  delay: number,
) => ReturnType<typeof setTimeout>;
type Cancel = (handle: ReturnType<typeof setTimeout>) => void;

export class ViewportPollingScheduler {
  private readonly run: () => Promise<boolean>;
  private readonly schedule: Schedule;
  private readonly cancel: Cancel;
  private timer: ReturnType<typeof setTimeout> | null = null;
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
  ) {
    this.run = run;
    this.schedule = schedule;
    this.cancel = cancel;
  }

  start(immediate = true) {
    if (this.disposed || this.timer !== null || this.running) return;
    this.paused = false;
    this.queue(immediate ? 0 : POLL_INTERVAL_MILLIS);
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
      const success = await this.run();
      this.running = false;
      if (this.disposed || this.paused) return;
      if (this.restartRequested) {
        this.restartRequested = false;
        this.queue(0);
        return;
      }
      this.failures = success ? 0 : Math.min(this.failures + 1, BACKOFF.length);
      const next = success
        ? POLL_INTERVAL_MILLIS
        : BACKOFF[Math.min(this.failures - 1, BACKOFF.length - 1)];
      this.queue(next);
    }, delay);
  }
}
