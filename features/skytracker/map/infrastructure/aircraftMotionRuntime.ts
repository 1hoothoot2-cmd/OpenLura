import type { Aircraft, AircraftId } from "../../aircraft/domain/aircraft.ts";
import {
  createLiveMotionState,
  interpolateMotionPlan,
  sampleLiveMotionState,
  type LiveMotionState,
  type MotionPlan,
} from "../../aircraft/motion/aircraftMotion.ts";
import { ReplayClock } from "../../aircraft/motion/replayClock.ts";
import { createAircraftFeatureCollection } from "../../aircraft/presentation/aircraftGeoJson.ts";
import { presentAircraft } from "../../aircraft/presentation/presentedAircraft.ts";
import type { AircraftMapSourceWriter } from "./aircraftSourceWriter.ts";

const MIN_WRITE_INTERVAL_MILLIS = 1_000 / 30;

type AircraftMotionRuntimeOptions = Readonly<{
  aircraft: readonly Aircraft[];
  sourceWriter: AircraftMapSourceWriter;
  selectedAircraftId: AircraftId | null;
  favoriteAircraftIds?: ReadonlySet<string>;
  window: Window;
  document: Document;
  reducedMotionQuery: MediaQueryList;
  onFrame?: (aircraft: readonly Aircraft[], frameTimeMillis: number) => void;
  replayMode?: boolean;
  epochNow?: () => number;
}>;

export class AircraftMotionRuntime {
  private aircraft: readonly Aircraft[];
  private liveStates: readonly LiveMotionState[];
  private replayPlans: readonly MotionPlan[] = [];
  private replayMode: boolean;
  private readonly sourceWriter: AircraftMapSourceWriter;
  private readonly window: Window;
  private readonly document: Document;
  private readonly reducedMotionQuery: MediaQueryList;
  private readonly onFrame: AircraftMotionRuntimeOptions["onFrame"];
  private readonly epochNow: () => number;
  private readonly clock: ReplayClock;
  private selectedAircraftId: AircraftId | null;
  private favoriteAircraftIds: ReadonlySet<string>;
  private frameHandle: number | null = null;
  private lastWriteAtMillis = Number.NEGATIVE_INFINITY;
  private disposed = false;

  constructor(options: AircraftMotionRuntimeOptions) {
    this.aircraft = options.aircraft;
    this.replayMode = options.replayMode ?? false;
    this.epochNow = options.epochNow ?? Date.now;
    this.liveStates = options.aircraft.map((item) =>
      createLiveMotionState(
        item,
        {
          latitudeDegrees: item.latitudeDegrees,
          longitudeDegrees: item.longitudeDegrees,
        },
        item.headingDegrees,
        0,
        this.epochNow(),
      ),
    );
    this.sourceWriter = options.sourceWriter;
    this.selectedAircraftId = options.selectedAircraftId;
    this.favoriteAircraftIds = options.favoriteAircraftIds ?? new Set();
    this.window = options.window;
    this.document = options.document;
    this.reducedMotionQuery = options.reducedMotionQuery;
    this.onFrame = options.onFrame;
    this.clock = new ReplayClock(() => options.window.performance.now());
  }

  start() {
    if (this.disposed) return;
    this.document.addEventListener("visibilitychange", this.handleVisibility);
    this.reducedMotionQuery.addEventListener(
      "change",
      this.handleMotionPreference,
    );
    this.renderCurrentFrame(true);
    this.updatePlayback();
  }

  setSelectedAircraftId(aircraftId: AircraftId | null) {
    if (this.disposed || this.selectedAircraftId === aircraftId) return;
    this.selectedAircraftId = aircraftId;
    this.renderCurrentFrame(true);
  }

  setFavoriteAircraftIds(aircraftIds: ReadonlySet<string>) {
    if (this.disposed) return;
    this.favoriteAircraftIds = new Set(aircraftIds);
    this.renderCurrentFrame(true);
  }

  setAircraftSnapshot(aircraft: readonly Aircraft[], replayMode = false) {
    if (this.disposed) return;
    const time = this.clock.currentTime();
    const currentById = new Map(
      this.sampleAircraft(time).map((item) => [item.id, item]),
    );
    this.aircraft = aircraft;
    this.replayMode = replayMode;
    if (replayMode) {
      this.liveStates = [];
      this.replayPlans = aircraft.map((target) => {
        const current = currentById.get(target.id) ?? target;
        return {
          startPosition: {
            latitudeDegrees: current.latitudeDegrees,
            longitudeDegrees: current.longitudeDegrees,
          },
          targetPosition: {
            latitudeDegrees: target.latitudeDegrees,
            longitudeDegrees: target.longitudeDegrees,
          },
          headingDegrees: target.headingDegrees ?? 0,
          speedMetersPerSecond: target.groundSpeedMetersPerSecond ?? 0,
          startTimeMillis: time,
          durationMillis: 4_000,
        };
      });
    } else {
      this.replayPlans = [];
      const epochTime = this.epochNow();
      this.liveStates = aircraft.map((target) => {
        const current = currentById.get(target.id) ?? target;
        return createLiveMotionState(
          target,
          {
            latitudeDegrees: current.latitudeDegrees,
            longitudeDegrees: current.longitudeDegrees,
          },
          current.headingDegrees,
          time,
          epochTime,
        );
      });
    }
    this.renderCurrentFrame(true);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopFrameLoop();
    this.clock.pause();
    this.document.removeEventListener(
      "visibilitychange",
      this.handleVisibility,
    );
    this.reducedMotionQuery.removeEventListener(
      "change",
      this.handleMotionPreference,
    );
  }

  private readonly handleVisibility = () => {
    this.updatePlayback();
  };

  private readonly handleMotionPreference = () => {
    this.updatePlayback();
  };

  private updatePlayback() {
    const shouldPlay =
      !this.disposed &&
      !this.document.hidden &&
      !this.reducedMotionQuery.matches;

    if (!shouldPlay) {
      this.stopFrameLoop();
      this.clock.pause();
      return;
    }

    this.clock.play();
    if (this.frameHandle === null) {
      this.frameHandle = this.window.requestAnimationFrame(this.handleFrame);
    }
  }

  private readonly handleFrame = () => {
    this.frameHandle = null;
    if (this.disposed || this.document.hidden || this.reducedMotionQuery.matches) {
      this.updatePlayback();
      return;
    }

    this.renderCurrentFrame(false);
    this.frameHandle = this.window.requestAnimationFrame(this.handleFrame);
  };

  private renderCurrentFrame(force: boolean) {
    const currentTimeMillis = this.clock.currentTime();
    if (
      !force &&
      currentTimeMillis - this.lastWriteAtMillis < MIN_WRITE_INTERVAL_MILLIS
    ) {
      return;
    }

    const movedAircraft = this.sampleAircraft(currentTimeMillis);
    this.onFrame?.(movedAircraft, currentTimeMillis);
    const collection = createAircraftFeatureCollection(
      presentAircraft(
        movedAircraft,
        this.selectedAircraftId,
        this.favoriteAircraftIds,
      ),
    );
    if (this.sourceWriter.write(collection)) {
      this.lastWriteAtMillis = currentTimeMillis;
    }
  }

  private sampleAircraft(currentTimeMillis: number) {
    return this.aircraft.map((item, index) => {
      if (!this.replayMode) {
        const state = this.liveStates[index];
        return state
          ? sampleLiveMotionState(state, currentTimeMillis, this.epochNow())
          : item;
      }
      const plan = this.replayPlans[index];
      if (!plan) return item;
      const position = interpolateMotionPlan(plan, currentTimeMillis);
      return {
        ...item,
        latitudeDegrees: position.latitudeDegrees,
        longitudeDegrees: position.longitudeDegrees,
      };
    });
  }

  private stopFrameLoop() {
    if (this.frameHandle === null) return;
    this.window.cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
  }
}
