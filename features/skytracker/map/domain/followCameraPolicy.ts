export type FollowCameraSample = Readonly<{
  longitudeDegrees: number;
  latitudeDegrees: number;
  timestampMillis: number;
}>;

export const FOLLOW_CAMERA_INTERVAL_MILLIS = 400;
export const FOLLOW_CAMERA_MINIMUM_DISTANCE_DEGREES = 0.0001;

export function shouldUpdateFollowCamera(
  previous: FollowCameraSample | null,
  next: FollowCameraSample,
): boolean {
  if (
    !Number.isFinite(next.longitudeDegrees) ||
    !Number.isFinite(next.latitudeDegrees) ||
    !Number.isFinite(next.timestampMillis)
  ) {
    return false;
  }
  if (previous === null) return true;
  if (next.timestampMillis - previous.timestampMillis < FOLLOW_CAMERA_INTERVAL_MILLIS) {
    return false;
  }
  return (
    Math.abs(next.longitudeDegrees - previous.longitudeDegrees) >=
      FOLLOW_CAMERA_MINIMUM_DISTANCE_DEGREES ||
    Math.abs(next.latitudeDegrees - previous.latitudeDegrees) >=
      FOLLOW_CAMERA_MINIMUM_DISTANCE_DEGREES
  );
}
