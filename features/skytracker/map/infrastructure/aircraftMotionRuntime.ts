import type { Aircraft, AircraftId } from "../../aircraft/domain/aircraft.ts";
import {
  applyMotionSample,
  createMotionPlan,
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
  window: Window;
  document: Document;
  reducedMotionQuery: MediaQueryList;
}>;

export class AircraftMotionRuntime {
  private readonly aircraft: readonly Aircraft[];
  private readonly plans: readonly MotionPlan[];
  private readonly sourceWriter: AircraftMapSourceWriter;
  private readonly window: Window;
  private readonly document: Document;
  private readonly reducedMotionQuery: MediaQueryList;
  private readonly clock: ReplayClock;
  private selectedAircraftId: AircraftId | null;
  private frameHandle: number | null = null;
  private lastWriteAtMillis = Number.NEGATIVE_INFINITY;
  private disposed = false;

  constructor(options: AircraftMotionRuntimeOptions) {
    this.aircraft = options.aircraft;
    this.plans = options.aircraft.map((item) => createMotionPlan(item));
    this.sourceWriter = options.sourceWriter;
    this.selectedAircraftId = options.selectedAircraftId;
    this.window = options.window;
    this.document = options.document;
    this.reducedMotionQuery = options.reducedMotionQuery;
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

    const movedAircraft = this.aircraft.map((item, index) =>
      applyMotionSample(item, this.plans[index], currentTimeMillis),
    );
    const collection = createAircraftFeatureCollection(
      presentAircraft(movedAircraft, this.selectedAircraftId),
    );
    if (this.sourceWriter.write(collection)) {
      this.lastWriteAtMillis = currentTimeMillis;
    }
  }

  private stopFrameLoop() {
    if (this.frameHandle === null) return;
    this.window.cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
  }
}
