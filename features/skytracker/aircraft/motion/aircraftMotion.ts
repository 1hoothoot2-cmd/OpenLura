import type { Aircraft } from "../domain/aircraft.ts";

const EARTH_RADIUS_METERS = 6_371_000;
const DEFAULT_PLAN_DURATION_MILLIS = 4_000;

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

function projectPosition(
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
  return {
    latitudeDegrees:
      start.latitudeDegrees +
      (target.latitudeDegrees - start.latitudeDegrees) * progress,
    longitudeDegrees:
      start.longitudeDegrees +
      (target.longitudeDegrees - start.longitudeDegrees) * progress,
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
