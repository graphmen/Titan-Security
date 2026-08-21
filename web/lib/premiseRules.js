import { normalizeGeofenceRadius, mergeSystemSettings } from './systemSettings.js';

/** Per-site monitoring overrides stored in systemSettings.premiseMonitoringRules. */
export function getPremiseMonitoringRules(state, tenantId, premiseId) {
  const global = mergeSystemSettings(state?.systemSettings);
  const overrides = global.premiseMonitoringRules?.[premiseId] || {};
  return {
    geofenceRadiusMeters: normalizeGeofenceRadius(
      overrides.geofenceRadiusMeters ?? global.geofenceRadiusMeters
    ),
    patrolIntervalMinutes: Number(overrides.patrolIntervalMinutes) || null,
    welfareCheckEnabled: overrides.welfareCheckEnabled ?? global.welfareChecksEnabled ?? false,
    welfareIntervalMinutes: Number(overrides.welfareIntervalMinutes) || Number(global.welfareCheckIntervalMinutes) || 60,
    geofenceExitGraceMinutes: Number(overrides.geofenceExitGraceMinutes) || Number(global.geofenceExitGraceMinutes) || 3,
  };
}

export function setPremiseMonitoringRules(state, premiseId, rules) {
  if (!state.systemSettings) state.systemSettings = mergeSystemSettings(null);
  if (!state.systemSettings.premiseMonitoringRules) state.systemSettings.premiseMonitoringRules = {};
  state.systemSettings.premiseMonitoringRules[premiseId] = {
    ...(state.systemSettings.premiseMonitoringRules[premiseId] || {}),
    ...rules,
  };
}
