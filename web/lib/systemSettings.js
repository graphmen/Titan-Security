export const TITAN_TENANT_ID = 'titan';

export const DEFAULT_SYSTEM_SETTINGS = {
  companyName: 'Titan Protection Security',
  companyShortName: 'Titan',
  sirenAlertsEnabled: true,
  geofenceRadiusMeters: 800,
  noMovementAlertMinutes: 45,
  licenseExpiryWarningDays: 60,
};

export function mergeSystemSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SYSTEM_SETTINGS };
  return { ...DEFAULT_SYSTEM_SETTINGS, ...raw };
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
