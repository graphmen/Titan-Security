export const TITAN_TENANT_ID = 'titan';

export const GEOFENCE_MIN_METERS = 10;
export const GEOFENCE_MAX_METERS = 50;
export const GEOFENCE_DEFAULT_METERS = 30;

export const DEFAULT_SYSTEM_SETTINGS = {
  companyName: 'Titan Protection Security',
  companyShortName: 'Titan',
  sirenAlertsEnabled: true,
  geofenceRadiusMeters: GEOFENCE_DEFAULT_METERS,
  noMovementAlertMinutes: 45,
  licenseExpiryWarningDays: 60,
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
