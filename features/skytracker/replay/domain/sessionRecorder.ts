import type {
  Aircraft,
  AircraftId,
  AircraftLifecycle,
} from "../../aircraft/domain/aircraft.ts";

export const MAX_RECORDING_DURATION_MILLIS = 30 * 60 * 1_000;
export const MAX_RECORDED_FRAMES = 1_800;

export type RecordedAircraft = Readonly<{
  aircraftId: AircraftId;
  latitudeDegrees: number;
  longitudeDegrees: number;
  altitudeMeters: number | null;
  headingDegrees: number | null;
  groundSpeedMetersPerSecond: number | null;
  lifecycle: AircraftLifecycle | null;
}>;

export type RecordedSessionFrame = Readonly<{
  timestampEpochMillis: number;
  aircraft: readonly RecordedAircraft[];
}>;

export class SessionRecorder {
  private readonly frames = new RingBuffer<RecordedSessionFrame>(
    MAX_RECORDED_FRAMES,
  );
  private lastFingerprint: string | null = null;

  record(timestampEpochMillis: number, aircraft: readonly Aircraft[]) {
    if (!Number.isFinite(timestampEpochMillis) || timestampEpochMillis <= 0) {
      return false;
    }
    const frame = createRecordedFrame(timestampEpochMillis, aircraft);
    const fingerprint = frameFingerprint(frame);
    if (fingerprint === this.lastFingerprint) return false;

    this.frames.push(frame);
    this.lastFingerprint = fingerprint;
    this.frames.removeWhile(
      (candidate) =>
        timestampEpochMillis - candidate.timestampEpochMillis >
        MAX_RECORDING_DURATION_MILLIS,
    );
    return true;
  }

  snapshot() {
    return this.frames.toArray();
  }

  get durationMillis() {
    const frames = this.frames.toArray();
    if (frames.length < 2) return 0;
    return Math.max(
      0,
      frames[frames.length - 1]!.timestampEpochMillis -
        frames[0]!.timestampEpochMillis,
    );
  }

  get frameCount() {
    return this.frames.length;
  }
}

export function replayFrameAt(
  frames: readonly RecordedSessionFrame[],
  offsetMillis: number,
) {
  if (frames.length === 0) return null;
  const target =
    frames[0]!.timestampEpochMillis +
    Math.max(0, Number.isFinite(offsetMillis) ? offsetMillis : 0);
  let selected = frames[0]!;
  for (const frame of frames) {
    if (frame.timestampEpochMillis > target) break;
    selected = frame;
  }
  return selected;
}

export function recordedFrameToAircraft(
  frame: RecordedSessionFrame,
  liveAircraft: readonly Aircraft[],
): readonly Aircraft[] {
  const metadata = new Map(liveAircraft.map((item) => [item.id, item]));
  return frame.aircraft.map((record) => {
    const live = metadata.get(record.aircraftId);
    return {
      id: record.aircraftId,
      latitudeDegrees: record.latitudeDegrees,
      longitudeDegrees: record.longitudeDegrees,
      altitudeMeters: record.altitudeMeters,
      headingDegrees: record.headingDegrees,
      groundSpeedMetersPerSecond: record.groundSpeedMetersPerSecond,
      lifecycle: record.lifecycle ?? undefined,
      positionTimestampEpochMillis: frame.timestampEpochMillis,
      callsign: live?.callsign ?? null,
      registration: live?.registration ?? null,
      category: live?.category ?? "unknown",
      onGround: false,
      verticalRateMetersPerSecond: null,
    };
  });
}

function createRecordedFrame(
  timestampEpochMillis: number,
  aircraft: readonly Aircraft[],
): RecordedSessionFrame {
  return {
    timestampEpochMillis,
    aircraft: [...aircraft]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item) => ({
        aircraftId: item.id,
        latitudeDegrees: item.latitudeDegrees,
        longitudeDegrees: item.longitudeDegrees,
        altitudeMeters: item.altitudeMeters,
        headingDegrees: item.headingDegrees,
        groundSpeedMetersPerSecond: item.groundSpeedMetersPerSecond,
        lifecycle: item.lifecycle ?? null,
      })),
  };
}

function frameFingerprint(frame: RecordedSessionFrame) {
  return [
    frame.timestampEpochMillis,
    ...frame.aircraft.flatMap((item) => [
      item.aircraftId,
      item.latitudeDegrees,
      item.longitudeDegrees,
      item.altitudeMeters ?? "null",
      item.headingDegrees ?? "null",
      item.groundSpeedMetersPerSecond ?? "null",
      item.lifecycle ?? "null",
    ]),
  ].join("|");
}

class RingBuffer<T> {
  private readonly values: Array<T | undefined>;
  private readonly capacity: number;
  private head = 0;
  private size = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.values = new Array(capacity);
  }

  push(value: T) {
    const index = (this.head + this.size) % this.capacity;
    this.values[index] = value;
    if (this.size < this.capacity) {
      this.size += 1;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  removeWhile(predicate: (value: T) => boolean) {
    while (this.size > 0) {
      const value = this.values[this.head];
      if (value === undefined || !predicate(value)) break;
      this.values[this.head] = undefined;
      this.head = (this.head + 1) % this.capacity;
      this.size -= 1;
    }
  }

  toArray() {
    return Array.from({ length: this.size }, (_, index) => {
      return this.values[(this.head + index) % this.capacity]!;
    });
  }

  get length() {
    return this.size;
  }
}
