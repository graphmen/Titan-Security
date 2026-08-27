/** Premise / patrol place GPS capture target (meters). Relaxed for real-world phones & browsers. */
export const PREMISE_MAX_ACCURACY_METERS = 15;

/** Best-effort accept on timeout (web admin / weak signal). */
export const PREMISE_FALLBACK_ACCURACY_METERS = 25;

/** Guard clock-in GPS must be at least this accurate (meters). */
export const GUARD_CLOCKIN_MAX_ACCURACY_METERS = 5;

/** Guard clock-out — relaxed for end-of-shift (indoors, weak signal). */
export const GUARD_CLOCKOUT_MAX_ACCURACY_METERS = 15;

/** Best-effort clock-out when high-accuracy watch times out. */
export const GUARD_CLOCKOUT_FALLBACK_ACCURACY_METERS = 25;

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
  return `GPS accuracy ${formatAccuracyMeters(accuracy)} is too low — move outdoors, hold still 5–10s, or retry (need ±${PREMISE_MAX_ACCURACY_METERS}m or better)`;
}

export function clockInAccuracyError(accuracy, geofenceRadiusMeters) {
  const radius = Number(geofenceRadiusMeters);
  const maxAllowed = Number.isFinite(radius)
    ? Math.min(GUARD_CLOCKIN_MAX_ACCURACY_METERS, radius)
    : GUARD_CLOCKIN_MAX_ACCURACY_METERS;
  return `GPS accuracy ${formatAccuracyMeters(accuracy)} is too low — need ±${maxAllowed}m or better to clock in`;
}

export function isClockOutAccuracyAcceptable(accuracy) {
  const a = Number(accuracy);
  return Number.isFinite(a) && a > 0 && a <= GUARD_CLOCKOUT_MAX_ACCURACY_METERS;
}

export function clockOutAccuracyError(accuracy) {
  return `GPS accuracy ${formatAccuracyMeters(accuracy)} is too low — move outdoors, hold still 5–10s, or retry (need ±${GUARD_CLOCKOUT_MAX_ACCURACY_METERS}m or better to clock out)`;
}
