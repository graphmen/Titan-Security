import { normalizeGeofenceRadius, GEOFENCE_DEFAULT_METERS, isGeofenceExitAlertsEnabled, getShiftTimingSettings } from './systemSettings.js';
import { getPremiseMonitoringRules } from './premiseRules.js';
import { hasPremiumFeature } from './subscription.js';

export function generateGuardId() {
  return `GRD-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

export function generateShiftId() {
  return `SHF-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

export function generateAttendanceId() {
  return `ATT-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

export function generateAlertId() {
  return `ALT-${Date.now().toString(36).toUpperCase()}`;
}

export function generateSwapId() {
  return `SWP-${Date.now().toString(36).toUpperCase()}`;
}

export const MOVEMENT_CHECK_MS = 45 * 60 * 1000;

export function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isValidGpsCoord(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln) && !(la === 0 && ln === 0);
}

export function isWithinPremiseGeofence(guardCoords, premiseCoords, radiusMeters = GEOFENCE_DEFAULT_METERS) {
  if (!isValidGpsCoord(premiseCoords?.lat, premiseCoords?.lng)) return false;
  if (!isValidGpsCoord(guardCoords?.lat, guardCoords?.lng)) return false;
  const radius = normalizeGeofenceRadius(radiusMeters);
  return haversineMeters(guardCoords.lat, guardCoords.lng, premiseCoords.lat, premiseCoords.lng) <= radius;
}

export function parseShiftMinutes(timeStr) {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  return h * 60 + m;
}

export function getGuardName(state, tenantId, guardId, fallback = 'Unknown Guard') {
  const list = state.guards?.[tenantId] || [];
  const g = list.find((x) => x.id === guardId);
  return g?.fullName || fallback;
}

export function getActiveAttendanceForGuard(state, tenantId, guardId) {
  return (state.attendance?.[tenantId] || []).find(
    (a) => a.guardId === guardId && (a.status === 'On Duty' || a.status === 'Late')
  );
}

export function getTodayShiftsForGuard(state, tenantId, guardId) {
  const today = todayDateStr();
  return (state.shifts?.[tenantId] || []).filter(
    (s) => s.guardId === guardId && s.date === today && s.status !== 'Cancelled'
  );
}

export function ensureAlertStore(state, tenantId) {
  if (!state.guardAlerts) state.guardAlerts = { titan: [], alpha: [], omega: [] };
  if (!state.guardAlerts[tenantId]) state.guardAlerts[tenantId] = [];
  if (!state.shiftSwapRequests) state.shiftSwapRequests = { titan: [], alpha: [], omega: [] };
  if (!state.shiftSwapRequests[tenantId]) state.shiftSwapRequests[tenantId] = [];
}

function alertDedupeKey(a) {
  return [
    a.type,
    a.guardId,
    a.premiseId || '',
    a.shiftId || '',
  ].join('|');
}

export function pushGuardAlert(state, tenantId, alert) {
  ensureAlertStore(state, tenantId);
  const key = alertDedupeKey(alert);
  const existing = state.guardAlerts[tenantId].find(
    (a) => alertDedupeKey(a) === key
  );
  if (existing) {
    // Active: already showing. Dismissed: supervisor acknowledged — do not recreate on poll.
    if (existing.status === 'Active' || existing.status === 'Dismissed') return null;
  }
  const entry = {
    id: generateAlertId(),
    status: 'Active',
    createdAt: new Date().toISOString(),
    ...alert,
  };
  state.guardAlerts[tenantId].unshift(entry);
  return entry;
}

/** Missed clock-in/out alerts repeat every N minutes until the guard clocks in or out. */
export function pushRecurringComplianceAlert(state, tenantId, alert, repeatMinutes = 30) {
  ensureAlertStore(state, tenantId);
  const key = alertDedupeKey(alert);
  const matching = state.guardAlerts[tenantId].filter((a) => alertDedupeKey(a) === key);
  if (matching.some((a) => a.status === 'Active')) return null;
  // Supervisor dismissed — do not recreate on the next dashboard poll.
  if (matching.some((a) => a.status === 'Dismissed')) return null;

  const repeatMs = Math.max(1, repeatMinutes) * 60 * 1000;
  const latest = matching.reduce((best, a) => {
    if (!best) return a;
    const aAt = new Date(a.resolvedAt || a.createdAt).getTime();
    const bAt = new Date(best.resolvedAt || best.createdAt).getTime();
    return aAt > bAt ? a : best;
  }, null);

  if (latest) {
    const lastAt = new Date(latest.resolvedAt || latest.createdAt).getTime();
    if (Date.now() - lastAt < repeatMs) return null;
  }

  const entry = {
    id: generateAlertId(),
    status: 'Active',
    createdAt: new Date().toISOString(),
    ...alert,
  };
  state.guardAlerts[tenantId].unshift(entry);
  return entry;
}

export function dismissGuardAlerts(state, tenantId, guardId, type) {
  ensureAlertStore(state, tenantId);
  state.guardAlerts[tenantId].forEach((a) => {
    if (a.guardId === guardId && a.type === type && a.status === 'Active') {
      a.status = 'Resolved';
      a.resolvedAt = new Date().toISOString();
    }
  });
}

function geofenceRadiusFromState(state) {
  return normalizeGeofenceRadius(state?.systemSettings?.geofenceRadiusMeters);
}

function noMovementMsFromState(state) {
  const raw = state?.systemSettings?.noMovementAlertMinutes;
  const mins = Number(raw);
  return (Number.isFinite(mins) && mins > 0 ? mins : 45) * 60 * 1000;
}

function licenseWarningDaysFromState(state) {
  const raw = state?.systemSettings?.licenseExpiryWarningDays;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

export function evaluateGuardMonitoring(state, tenantId, guardId, coords) {
  const record = getActiveAttendanceForGuard(state, tenantId, guardId);
  if (!record) return;

  const premise = (state.premises?.[tenantId] || []).find((p) => p.id === record.premiseId);
  const guardName = getGuardName(state, tenantId, guardId);
  const rules = getPremiseMonitoringRules(state, tenantId, record.premiseId);
  const geofenceRadius = rules.geofenceRadiusMeters;
  const geofenceExitEnabled =
    isGeofenceExitAlertsEnabled(state) && hasPremiumFeature(state, tenantId, 'geofenceExit');
  const exitGraceMs = rules.geofenceExitGraceMinutes * 60 * 1000;
  const repeatMinutes = Number(state?.systemSettings?.geofenceAlertRepeatMinutes) || 30;

  if (!geofenceExitEnabled) {
    record.geofenceViolation = false;
    record.geofenceExitSince = null;
  } else if (coords?.lat != null && coords?.lng != null && premise) {
    const inside = isWithinPremiseGeofence(coords, premise.coordinates, geofenceRadius);
    if (!inside) {
      if (!record.geofenceExitSince) record.geofenceExitSince = new Date().toISOString();
      const outsideMs = Date.now() - new Date(record.geofenceExitSince).getTime();
      if (outsideMs >= exitGraceMs) {
        pushRecurringComplianceAlert(state, tenantId, {
          type: 'geofence_exit',
          severity: 'critical',
          guardId,
          guardName,
          premiseId: record.premiseId,
          message: `${guardName} left the premises boundary (${Math.round(outsideMs / 60000)} min outside geofence).`,
        }, repeatMinutes);
        record.geofenceViolation = true;
      }
    } else {
      record.geofenceViolation = false;
      record.geofenceExitSince = null;
      dismissGuardAlerts(state, tenantId, guardId, 'geofence_exit');
    }
  }

  const noMovementMs = noMovementMsFromState(state);
  const noMovementMins = Math.round(noMovementMs / 60000);
  const lastMove = new Date(record.lastMovementAt || record.clockIn).getTime();
  if (Date.now() - lastMove >= noMovementMs) {
    record.needsMovementAck = true;
    pushGuardAlert(state, tenantId, {
      type: 'no_movement',
      severity: 'warning',
      guardId,
      guardName,
      premiseId: record.premiseId,
      message: `${guardName} has had no movement for ${noMovementMins}+ minutes — confirm patrol status.`,
    });
  }

  if (coords?.lat) {
    if (!record.movementTrail) record.movementTrail = [];
    record.movementTrail.push({ lat: coords.lat, lng: coords.lng, at: new Date().toISOString() });
    if (record.movementTrail.length > 50) record.movementTrail.shift();
    record.lastCoords = coords;
  }
}

export function getShiftStartDate(shift) {
  if (!shift?.date || !shift?.startTime) return null;
  const d = new Date(`${shift.date}T${shift.startTime}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getShiftEndDate(shift) {
  const start = getShiftStartDate(shift);
  if (!shift?.date || !shift?.endTime || !start) return null;
  let end = new Date(`${shift.date}T${shift.endTime}:00`);
  if (Number.isNaN(end.getTime())) return null;
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return end;
}

/** Alert supervisors when guards miss clock-in; alert guards when they miss clock-out. */
export function evaluateShiftCompliance(state, tenantId) {
  const {
    missedClockInGraceMinutes,
    missedClockOutGraceMinutes,
    missedShiftAlertRepeatMinutes,
  } = getShiftTimingSettings(state);
  const now = Date.now();
  const today = todayDateStr();
  const shifts = state.shifts?.[tenantId] || [];
  const attendance = state.attendance?.[tenantId] || [];
  const premises = state.premises?.[tenantId] || [];

  const isOnDuty = (guardId, shift) =>
    attendance.some(
      (a) =>
        a.guardId === guardId &&
        (a.status === 'On Duty' || a.status === 'Late') &&
        (shift?.id ? a.shiftId === shift.id || a.premiseId === shift.premiseId : true)
    );

  shifts.forEach((shift) => {
    if (shift.status === 'Cancelled' || shift.status === 'Completed') return;
    if (shift.date !== today) return;

    const start = getShiftStartDate(shift);
    if (!start) return;

    const missedInAt = start.getTime() + missedClockInGraceMinutes * 60 * 1000;
    if (now >= missedInAt && shift.status === 'Scheduled' && !isOnDuty(shift.guardId, shift)) {
      const guardName = getGuardName(state, tenantId, shift.guardId);
      const premise = premises.find((p) => p.id === shift.premiseId);
      pushRecurringComplianceAlert(state, tenantId, {
        type: 'missed_clock_in',
        severity: 'critical',
        guardId: shift.guardId,
        guardName,
        premiseId: shift.premiseId,
        shiftId: shift.id,
        message: `${guardName} has not clocked in at ${premise?.name || 'site'} (${shift.startTime}–${shift.endTime}).`,
      }, missedShiftAlertRepeatMinutes);
    }
  });

  attendance
    .filter((a) => a.status === 'On Duty' || a.status === 'Late')
    .forEach((att) => {
      const shift =
        (att.shiftId && shifts.find((s) => s.id === att.shiftId)) ||
        shifts.find(
          (s) =>
            s.guardId === att.guardId &&
            s.premiseId === att.premiseId &&
            s.status === 'Active' &&
            (s.date === today || s.date === att.clockIn?.slice(0, 10))
        );
      if (!shift) return;

      const end = getShiftEndDate(shift);
      if (!end) return;

      const missedOutAt = end.getTime() + missedClockOutGraceMinutes * 60 * 1000;
      if (now < missedOutAt) return;

      const guardName = getGuardName(state, tenantId, att.guardId);
      const premise = premises.find((p) => p.id === att.premiseId);
      pushRecurringComplianceAlert(state, tenantId, {
        type: 'missed_clock_out',
        severity: 'warning',
        guardId: att.guardId,
        guardName,
        premiseId: att.premiseId,
        shiftId: shift.id,
        message: `${guardName} has not clocked out from ${premise?.name || 'site'} — shift ended at ${shift.endTime}. Return to site geofence to clock out.`,
      }, missedShiftAlertRepeatMinutes);
    });
}

export function evaluateLicenseExpiryAlerts(state, tenantId) {
  const warningDays = licenseWarningDaysFromState(state);
  const guards = state.guards?.[tenantId] || [];
  guards.forEach((g) => {
    if (!g.licenseExpiry || g.status !== 'Active') return;
    const days = (new Date(g.licenseExpiry) - new Date()) / 86400000;
    if (days >= 0 && days <= warningDays) {
      pushGuardAlert(state, tenantId, {
        type: 'license_expiry',
        severity: days <= 14 ? 'critical' : 'warning',
        guardId: g.id,
        guardName: g.fullName,
        message: `${g.fullName}'s PSIRA license expires on ${g.licenseExpiry} (${Math.ceil(days)} days).`,
      });
    }
  });
}

export function evaluateAllOnDutyGuards(state, tenantId) {
  const onDuty = (state.attendance?.[tenantId] || []).filter(
    (a) => a.status === 'On Duty' || a.status === 'Late'
  );
  onDuty.forEach((a) => {
    evaluateGuardMonitoring(state, tenantId, a.guardId, a.lastCoords);
  });
  evaluateLicenseExpiryAlerts(state, tenantId);
  refreshGuardScores(state, tenantId);
}

export function computeGuardScore(state, tenantId, guardId) {
  const attendance = state.attendance?.[tenantId] || [];
  const guardRecords = attendance.filter((a) => a.guardId === guardId);
  const shifts = state.shifts?.[tenantId] || [];
  const guardShifts = shifts.filter((s) => s.guardId === guardId);
  const alerts = (state.guardAlerts?.[tenantId] || []).filter(
    (a) => a.guardId === guardId && a.severity === 'critical'
  );

  let punctuality = 100;
  if (guardRecords.length > 0) {
    const lateCount = guardRecords.filter((a) => (a.lateMinutes || 0) > 5).length;
    punctuality = Math.max(0, 100 - Math.round((lateCount / guardRecords.length) * 40));
  }

  const premiseIds = [...new Set(guardShifts.map((s) => s.premiseId))];
  let patrolScore = 100;
  if (premiseIds.length > 0) {
    const cps = (state.checkpoints?.[tenantId] || []).filter((cp) =>
      premiseIds.includes(cp.premiseId)
    );
    if (cps.length > 0) {
      const scanned = cps.filter((cp) => cp.status === 'Scanned').length;
      patrolScore = Math.round((scanned / cps.length) * 100);
    }
  }

  const shiftScore = guardShifts.length
    ? Math.round((guardShifts.filter((s) => s.status === 'Completed' || s.status === 'Active').length / guardShifts.length) * 100)
    : 80;

  const alertPenalty = Math.min(30, alerts.length * 10);
  const composite = Math.max(0, Math.min(100, Math.round(
    punctuality * 0.35 + patrolScore * 0.35 + shiftScore * 0.3 - alertPenalty
  )));

  return {
    composite,
    punctuality,
    patrolCompletion: patrolScore,
    shiftReliability: shiftScore,
    criticalAlerts: alerts.length,
  };
}

export function refreshGuardScores(state, tenantId) {
  const guards = state.guards?.[tenantId] || [];
  guards.forEach((g) => {
    g.performanceScore = computeGuardScore(state, tenantId, g.id);
  });
}

export function recordGuardMovement(state, tenantId, guardId, coords) {
  const record = getActiveAttendanceForGuard(state, tenantId, guardId);
  if (!record) return;
  record.lastMovementAt = new Date().toISOString();
  record.needsMovementAck = false;
  if (coords?.lat) {
    record.lastCoords = coords;
    if (!record.movementTrail) record.movementTrail = [];
    record.movementTrail.push({ lat: coords.lat, lng: coords.lng, at: record.lastMovementAt });
    if (record.movementTrail.length > 50) record.movementTrail.shift();
  }
  dismissGuardAlerts(state, tenantId, guardId, 'no_movement');
}
