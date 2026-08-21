export const TITAN_TENANT_ID = 'titan';

export const GEOFENCE_MIN_METERS = 5;
export const GEOFENCE_MAX_METERS = 8;
export const GEOFENCE_DEFAULT_METERS = 6;

export const DEFAULT_SYSTEM_SETTINGS = {
  companyName: 'Titan Protection Security',
  companyShortName: 'Titan',
  sirenAlertsEnabled: true,
  geofenceRadiusMeters: GEOFENCE_DEFAULT_METERS,
  /** Parked — re-enable when boundary-exit alerting is ready for production. */
  geofenceExitAlertsEnabled: false,
  noMovementAlertMinutes: 45,
  licenseExpiryWarningDays: 60,
  /** Minutes before shift start — guard app plays a reminder sound. */
  shiftClockInReminderMinutes: 30,
  /** Minutes after scheduled start before supervisor is alerted (no clock-in). */
  missedClockInGraceMinutes: 30,
  /** Minutes after scheduled end before guard is reminded to clock out. */
  missedClockOutGraceMinutes: 30,
  /** How often to re-alert for missed clock-in/out after dismiss or prior alert (supervisor/guard). */
  missedShiftAlertRepeatMinutes: 30,
  /** Minutes outside geofence before exit alert fires (avoids GPS jitter). */
  geofenceExitGraceMinutes: 3,
  geofenceAlertRepeatMinutes: 30,
  overduePatrolRepeatMinutes: 30,
  /** Welfare / dead-man's switch */
  welfareChecksEnabled: false,
  welfareCheckIntervalMinutes: 60,
  welfareResponseGraceMinutes: 5,
  welfareAlertRepeatMinutes: 30,
  /** Per-premise overrides: { [premiseId]: { geofenceRadiusMeters, welfareCheckEnabled, ... } } */
  premiseMonitoringRules: {},
};

export function mergeSystemSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SYSTEM_SETTINGS };
  const merged = { ...DEFAULT_SYSTEM_SETTINGS, ...raw };
  merged.geofenceRadiusMeters = normalizeGeofenceRadius(merged.geofenceRadiusMeters);
  return merged;
}

export function normalizeGeofenceRadius(raw) {
  const n = Number(raw);
  const base = Number.isFinite(n) && n > 0 ? n : GEOFENCE_DEFAULT_METERS;
  return Math.min(GEOFENCE_MAX_METERS, Math.max(GEOFENCE_MIN_METERS, Math.round(base)));
}

export function ensureSystemSettings(state) {
  if (!state) return mergeSystemSettings(null);
  state.systemSettings = mergeSystemSettings(state.systemSettings);
  state.activeTenantId = TITAN_TENANT_ID;
  return state.systemSettings;
}

export function getGeofenceRadius(state) {
  return mergeSystemSettings(state?.systemSettings).geofenceRadiusMeters;
}

export function getNoMovementMs(state) {
  const mins = mergeSystemSettings(state?.systemSettings).noMovementAlertMinutes;
  return Math.max(5, mins) * 60 * 1000;
}

export function getLicenseExpiryWarningDays(state) {
  return mergeSystemSettings(state?.systemSettings).licenseExpiryWarningDays;
}

export function isSirenEnabled(state) {
  return mergeSystemSettings(state?.systemSettings).sirenAlertsEnabled !== false;
}

export function isGeofenceExitAlertsEnabled(state) {
  return mergeSystemSettings(state?.systemSettings).geofenceExitAlertsEnabled === true;
}

export function getShiftTimingSettings(state) {
  const s = mergeSystemSettings(state?.systemSettings);
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    clockInReminderMinutes: num(s.shiftClockInReminderMinutes, 30),
    missedClockInGraceMinutes: num(s.missedClockInGraceMinutes, 30),
    missedClockOutGraceMinutes: num(s.missedClockOutGraceMinutes, 30),
    missedShiftAlertRepeatMinutes: num(s.missedShiftAlertRepeatMinutes, 30),
  };
}
