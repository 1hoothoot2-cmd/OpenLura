export type MonotonicTimeSource = () => number;

export class ReplayClock {
  private readonly now: MonotonicTimeSource;
  private accumulatedMillis = 0;
  private startedAtMillis: number | null = null;

  constructor(now: MonotonicTimeSource = () => performance.now()) {
    this.now = now;
  }

  play() {
    if (this.startedAtMillis === null) {
      this.startedAtMillis = this.now();
    }
  }

  pause() {
    if (this.startedAtMillis === null) return;
    this.accumulatedMillis += this.now() - this.startedAtMillis;
    this.startedAtMillis = null;
  }

  currentTime() {
    return this.startedAtMillis === null
      ? this.accumulatedMillis
      : this.accumulatedMillis + (this.now() - this.startedAtMillis);
  }

  get isPlaying() {
    return this.startedAtMillis !== null;
  }
}
