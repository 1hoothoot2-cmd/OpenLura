import type { Aircraft } from "../domain/aircraft.ts";
import { applyAircraftLifecycle } from "../domain/aircraftLifecycle.ts";

const EARTH_RADIUS_METERS = 6_371_000;
const DEFAULT_PLAN_DURATION_MILLIS = 4_000;
export const NORMAL_EXTRAPOLATION_MILLIS = 120_000;
// The focused global tile refreshes every six minutes. A seven-minute ceiling
// prevents a hard stop at a tile boundary while preserving the existing
// progressive slowdown after the normal extrapolation window.
export const MAXIMUM_EXTRAPOLATION_MILLIS = 420_000;
export const MINIMUM_RELIABLE_SPEED_METERS_PER_SECOND = 5;
const MINIMUM_CORRECTION_MILLIS = 1_500;
const MAXIMUM_CORRECTION_MILLIS = 8_000;
export const MAXIMUM_PLAUSIBLE_SPEED_METERS_PER_SECOND = 450;
export const POSITION_UPDATE_TOLERANCE_METERS = 5_000;

export type MotionPosition = Readonly<{
  latitudeDegrees: number;
  longitudeDegrees: number;
}>;

export type MotionPlan = Readonly<{
  startPosition: MotionPosition;
  targetPosition: MotionPosition;
  headingDegrees: number;
  speedMetersPerSecond: number;
  startTimeMillis: number;
  durationMillis: number;
}>;

export type LiveMotionState = Readonly<{
  aircraft: Aircraft;
  correctionStartPosition: MotionPosition;
  correctionStartHeadingDegrees: number | null;
  snapshotReceivedAtMonotonicMillis: number;
  snapshotReceivedAtEpochMillis: number;
  correctionDurationMillis: number;
}>;

export function createMotionPlan(
  aircraft: Aircraft,
  startTimeMillis = 0,
  durationMillis = DEFAULT_PLAN_DURATION_MILLIS,
): MotionPlan {
  const headingDegrees = aircraft.headingDegrees ?? 0;
  const speedMetersPerSecond = aircraft.groundSpeedMetersPerSecond ?? 0;
  const startPosition = {
    latitudeDegrees: aircraft.latitudeDegrees,
    longitudeDegrees: aircraft.longitudeDegrees,
  };

  return {
    startPosition,
    targetPosition: projectPosition(
      startPosition,
      headingDegrees,
      speedMetersPerSecond * (durationMillis / 1_000),
    ),
    headingDegrees,
    speedMetersPerSecond,
    startTimeMillis,
    durationMillis,
  };
}

export function interpolateMotionPlan(
  plan: MotionPlan,
  timeMillis: number,
): MotionPosition {
  const progress = clamp(
    (timeMillis - plan.startTimeMillis) / plan.durationMillis,
    0,
    1,
  );
  return interpolatePosition(plan.startPosition, plan.targetPosition, progress);
}

export function sampleRepeatingMotionPlan(
  plan: MotionPlan,
  timeMillis: number,
): MotionPosition {
  const elapsedMillis = Math.max(0, timeMillis - plan.startTimeMillis);
  const segmentIndex = Math.floor(elapsedMillis / plan.durationMillis);
  const segmentStartTime =
    plan.startTimeMillis + segmentIndex * plan.durationMillis;
  const segmentDistanceMeters =
    plan.speedMetersPerSecond * (plan.durationMillis / 1_000);
  const segmentStart = projectPosition(
    plan.startPosition,
    plan.headingDegrees,
    segmentDistanceMeters * segmentIndex,
  );
  const segmentTarget = projectPosition(
    segmentStart,
    plan.headingDegrees,
    segmentDistanceMeters,
  );

  return interpolateMotionPlan(
    {
      ...plan,
      startPosition: segmentStart,
      targetPosition: segmentTarget,
      startTimeMillis: segmentStartTime,
    },
    timeMillis,
  );
}

export function applyMotionSample(
  aircraft: Aircraft,
  plan: MotionPlan,
  timeMillis: number,
): Aircraft {
  const position = sampleRepeatingMotionPlan(plan, timeMillis);
  return {
    ...aircraft,
    latitudeDegrees: position.latitudeDegrees,
    longitudeDegrees: position.longitudeDegrees,
    positionTimestampEpochMillis:
      aircraft.positionTimestampEpochMillis + Math.max(0, timeMillis),
  };
}

export function createLiveMotionState(
  aircraft: Aircraft,
  correctionStartPosition: MotionPosition,
  correctionStartHeadingDegrees: number | null,
  monotonicTimeMillis: number,
  epochTimeMillis: number,
): LiveMotionState {
  const targetAtReceipt = extrapolateAircraftPosition(
    aircraft,
    Math.max(0, epochTimeMillis - aircraft.positionTimestampEpochMillis),
  );
  return {
    aircraft,
    correctionStartPosition,
    correctionStartHeadingDegrees,
    snapshotReceivedAtMonotonicMillis: monotonicTimeMillis,
    snapshotReceivedAtEpochMillis: epochTimeMillis,
    correctionDurationMillis: correctionDurationMillis(
      distanceMeters(correctionStartPosition, targetAtReceipt),
    ),
  };
}

export function sampleLiveMotionState(
  state: LiveMotionState,
  monotonicTimeMillis: number,
  epochTimeMillis =
    state.snapshotReceivedAtEpochMillis +
    Math.max(0, monotonicTimeMillis - state.snapshotReceivedAtMonotonicMillis),
): Aircraft {
  const elapsedSinceReceipt = Math.max(
    0,
    monotonicTimeMillis - state.snapshotReceivedAtMonotonicMillis,
  );
  const effectiveEpochMillis = Math.max(
    state.snapshotReceivedAtEpochMillis,
    epochTimeMillis,
  );
  const sourceAgeMillis = Math.max(
    0,
    effectiveEpochMillis - state.aircraft.positionTimestampEpochMillis,
  );
  const targetPosition = extrapolateAircraftPosition(
    state.aircraft,
    sourceAgeMillis,
  );
  const correctionProgress =
    state.correctionDurationMillis === 0
      ? 1
      : clamp(elapsedSinceReceipt / state.correctionDurationMillis, 0, 1);
  const easedProgress = easeOutCubic(correctionProgress);
  const position = interpolatePosition(
    state.correctionStartPosition,
    targetPosition,
    easedProgress,
  );
  const headingDegrees = interpolateHeadingDegrees(
    state.correctionStartHeadingDegrees,
    state.aircraft.headingDegrees,
    easedProgress,
  );
  const movementFactor = freshnessMovementFactor(sourceAgeMillis);
  const extrapolatedSeconds =
    effectiveExtrapolationMillis(sourceAgeMillis) / 1_000;
  const altitudeMeters =
    state.aircraft.altitudeMeters !== null &&
    state.aircraft.altitudeMeters !== undefined &&
    state.aircraft.verticalRateMetersPerSecond != null &&
    !state.aircraft.onGround
      ? state.aircraft.altitudeMeters +
        state.aircraft.verticalRateMetersPerSecond * extrapolatedSeconds
      : state.aircraft.altitudeMeters;

  return applyAircraftLifecycle({
    ...state.aircraft,
    ...position,
    headingDegrees,
    altitudeMeters:
      altitudeMeters == null || !Number.isFinite(altitudeMeters)
        ? state.aircraft.altitudeMeters
        : Math.max(0, altitudeMeters),
    lifecycle: movementFactor === 0 ? "STALE" : state.aircraft.lifecycle,
  }, effectiveEpochMillis);
}

export function extrapolateAircraftPosition(
  aircraft: Aircraft,
  sourceAgeMillis: number,
): MotionPosition {
  const position = {
    latitudeDegrees: aircraft.latitudeDegrees,
    longitudeDegrees: aircraft.longitudeDegrees,
  };
  const heading = aircraft.headingDegrees;
  const speed = aircraft.groundSpeedMetersPerSecond;
  if (
    aircraft.onGround ||
    heading == null ||
    speed == null ||
    !Number.isFinite(heading) ||
    !Number.isFinite(speed) ||
    speed < MINIMUM_RELIABLE_SPEED_METERS_PER_SECOND ||
    !Number.isFinite(aircraft.positionTimestampEpochMillis) ||
    sourceAgeMillis <= 0
  ) {
    return position;
  }
  const distance = speed * (effectiveExtrapolationMillis(sourceAgeMillis) / 1_000);
  return projectPosition(position, heading, distance);
}

export function effectiveExtrapolationMillis(sourceAgeMillis: number): number {
  const age = clamp(sourceAgeMillis, 0, MAXIMUM_EXTRAPOLATION_MILLIS);
  if (age <= NORMAL_EXTRAPOLATION_MILLIS) return age;
  const fadeDuration =
    MAXIMUM_EXTRAPOLATION_MILLIS - NORMAL_EXTRAPOLATION_MILLIS;
  const fadedAge = age - NORMAL_EXTRAPOLATION_MILLIS;
  return (
    NORMAL_EXTRAPOLATION_MILLIS +
    fadedAge -
    (fadedAge * fadedAge) / (2 * fadeDuration)
  );
}

export function freshnessMovementFactor(sourceAgeMillis: number): number {
  if (sourceAgeMillis <= NORMAL_EXTRAPOLATION_MILLIS) return 1;
  if (sourceAgeMillis >= MAXIMUM_EXTRAPOLATION_MILLIS) return 0;
  return (
    1 -
    (sourceAgeMillis - NORMAL_EXTRAPOLATION_MILLIS) /
      (MAXIMUM_EXTRAPOLATION_MILLIS - NORMAL_EXTRAPOLATION_MILLIS)
  );
}

export function interpolateHeadingDegrees(
  startDegrees: number | null,
  targetDegrees: number | null,
  progress: number,
): number | null {
  if (targetDegrees == null || !Number.isFinite(targetDegrees)) {
    return startDegrees;
  }
  if (startDegrees == null || !Number.isFinite(startDegrees)) {
    return normalizeHeading(targetDegrees);
  }
  const start = normalizeHeading(startDegrees);
  const target = normalizeHeading(targetDegrees);
  const delta = ((target - start + 540) % 360) - 180;
  return normalizeHeading(start + delta * clamp(progress, 0, 1));
}

export function isPlausiblePositionUpdate(
  previous: Aircraft,
  candidate: Aircraft,
): boolean {
  if (
    previous.id !== candidate.id ||
    !validPosition(previous) ||
    !validPosition(candidate) ||
    candidate.positionTimestampEpochMillis <
      previous.positionTimestampEpochMillis
  ) {
    return false;
  }
  const elapsedSeconds = Math.max(
    0,
    (candidate.positionTimestampEpochMillis -
      previous.positionTimestampEpochMillis) /
      1_000,
  );
  const maximumDistanceMeters =
    POSITION_UPDATE_TOLERANCE_METERS +
    MAXIMUM_PLAUSIBLE_SPEED_METERS_PER_SECOND * elapsedSeconds;
  return (
    distanceMeters(previous, candidate) <= maximumDistanceMeters
  );
}

export function projectPosition(
  position: MotionPosition,
  headingDegrees: number,
  distanceMeters: number,
): MotionPosition {
  if (distanceMeters === 0) return position;

  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = degreesToRadians(headingDegrees);
  const latitude = degreesToRadians(position.latitudeDegrees);
  const longitude = degreesToRadians(position.longitudeDegrees);
  const targetLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const targetLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) -
        Math.sin(latitude) * Math.sin(targetLatitude),
    );

  return {
    latitudeDegrees: radiansToDegrees(targetLatitude),
    longitudeDegrees: normalizeLongitude(radiansToDegrees(targetLongitude)),
  };
}

function interpolatePosition(
  start: MotionPosition,
  target: MotionPosition,
  progress: number,
): MotionPosition {
  if (progress <= 0) return start;
  if (progress >= 1) return target;
  const longitudeDelta =
    ((target.longitudeDegrees - start.longitudeDegrees + 540) % 360) - 180;
  return {
    latitudeDegrees:
      start.latitudeDegrees +
      (target.latitudeDegrees - start.latitudeDegrees) * progress,
    longitudeDegrees: normalizeLongitude(
      start.longitudeDegrees + longitudeDelta * progress,
    ),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function normalizeLongitude(value: number) {
  return ((value + 540) % 360) - 180;
}

function normalizeHeading(value: number) {
  return ((value % 360) + 360) % 360;
}

function correctionDurationMillis(distance: number) {
  if (!Number.isFinite(distance) || distance <= 1) return 0;
  return clamp(
    MINIMUM_CORRECTION_MILLIS + distance * 2,
    MINIMUM_CORRECTION_MILLIS,
    MAXIMUM_CORRECTION_MILLIS,
  );
}

function distanceMeters(start: MotionPosition, target: MotionPosition) {
  const latitude1 = degreesToRadians(start.latitudeDegrees);
  const latitude2 = degreesToRadians(target.latitudeDegrees);
  const latitudeDelta = latitude2 - latitude1;
  const longitudeDelta = degreesToRadians(
    target.longitudeDegrees - start.longitudeDegrees,
  );
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)))
  );
}

function validPosition(position: MotionPosition) {
  return (
    Number.isFinite(position.latitudeDegrees) &&
    position.latitudeDegrees >= -90 &&
    position.latitudeDegrees <= 90 &&
    Number.isFinite(position.longitudeDegrees) &&
    position.longitudeDegrees >= -180 &&
    position.longitudeDegrees <= 180
  );
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}
