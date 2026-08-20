/** Premise / patrol place GPS must be captured within this accuracy (meters). */
export const PREMISE_MAX_ACCURACY_METERS = 5;

/** Guard clock-in GPS must be at least this accurate (meters). */
export const GUARD_CLOCKIN_MAX_ACCURACY_METERS = 5;

export function formatAccuracyMeters(accuracy) {
  if (!Number.isFinite(Number(accuracy))) return 'unknown';
  return `±${Math.round(Number(accuracy))}m`;
}

export function isPremiseAccuracyAcceptable(accuracy) {
  const a = Number(accuracy);
  return Number.isFinite(a) && a > 0 && a <= PREMISE_MAX_ACCURACY_METERS;
}

export function isClockInAccuracyAcceptable(accuracy, geofenceRadiusMeters) {
  const a = Number(accuracy);
  const radius = Number(geofenceRadiusMeters);
  const maxAllowed = Number.isFinite(radius)
    ? Math.min(GUARD_CLOCKIN_MAX_ACCURACY_METERS, radius)
    : GUARD_CLOCKIN_MAX_ACCURACY_METERS;
  return Number.isFinite(a) && a > 0 && a <= maxAllowed;
}

export function premiseAccuracyError(accuracy) {
  return `GPS accuracy ${formatAccuracyMeters(accuracy)} is too low — capture on site with ±${PREMISE_MAX_ACCURACY_METERS}m or better (open sky, hold still 15–20s)`;
}

export function clockInAccuracyError(accuracy, geofenceRadiusMeters) {
  const radius = Number(geofenceRadiusMeters);
  const maxAllowed = Number.isFinite(radius)
    ? Math.min(GUARD_CLOCKIN_MAX_ACCURACY_METERS, radius)
    : GUARD_CLOCKIN_MAX_ACCURACY_METERS;
  return `GPS accuracy ${formatAccuracyMeters(accuracy)} is too low — need ±${maxAllowed}m or better to clock in`;
}
