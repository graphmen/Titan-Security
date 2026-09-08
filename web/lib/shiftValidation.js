import { getShiftEndDate, todayDateStr } from './guards.js';

/** Stable key for exact duplicate detection (ignores id). */
export function shiftFingerprint(shift) {
  return [
    shift?.guardId,
    shift?.premiseId,
    shift?.date,
    shift?.startTime,
    shift?.endTime,
  ].join('|');
}

export function isExactDuplicateShift(a, b) {
  if (!a || !b || a.id === b.id) return false;
  if (a.status === 'Cancelled' || b.status === 'Cancelled') return false;
  return shiftFingerprint(a) === shiftFingerprint(b);
}

export function findExactDuplicateShift(shifts, candidate, excludeId = null) {
  return (shifts || []).find(
    (s) => s.id !== excludeId && isExactDuplicateShift(s, candidate)
  );
}

/** Keep the oldest row per guard/premise/date/times. */
export function dedupeShiftList(shifts) {
  const kept = new Map();
  const sorted = [...(shifts || [])].sort(
    (a, b) => String(a.createdAt || a.date).localeCompare(String(b.createdAt || b.date))
  );
  for (const shift of sorted) {
    const key = shiftFingerprint(shift);
    if (!kept.has(key)) kept.set(key, shift);
  }
  return [...kept.values()];
}

/** Mark past roster rows Completed or Missed instead of leaving them Scheduled forever. */
export function advancePastShiftStatuses(state, tenantId) {
  const shifts = state.shifts?.[tenantId];
  if (!shifts?.length) return;
  const attendance = state.attendance?.[tenantId] || [];
  const now = Date.now();

  shifts.forEach((shift) => {
    if (!shift || shift.status === 'Cancelled' || shift.status === 'Completed' || shift.status === 'Missed') {
      return;
    }
    const end = getShiftEndDate(shift);
    if (!end || end.getTime() > now) return;

    const records = attendance.filter(
      (a) =>
        a.guardId === shift.guardId &&
        (a.shiftId === shift.id ||
          (a.premiseId === shift.premiseId &&
            (a.clockIn?.slice(0, 10) === shift.date || !a.shiftId)))
    );

    const clockedIn = records.some((a) => a.clockIn);
    const clockedOut = records.some((a) => a.status === 'Clocked Out' || a.clockOut);

    if (clockedOut || shift.status === 'Active') {
      shift.status = 'Completed';
    } else if (!clockedIn) {
      shift.status = 'Missed';
    } else {
      shift.status = 'Completed';
    }
  });
}

/** UI-friendly status without mutating stored shift rows. */
export function resolveShiftDisplayStatus(shift, attendance = [], now = Date.now()) {
  if (!shift) return 'Scheduled';
  if (shift.status === 'Cancelled') return 'Cancelled';
  if (shift.status === 'Completed' || shift.status === 'Missed') return shift.status;

  const end = getShiftEndDate(shift);
  if (!end || end.getTime() > now) return shift.status || 'Scheduled';

  const records = attendance.filter(
    (a) =>
      a.guardId === shift.guardId &&
      (a.shiftId === shift.id ||
        (a.premiseId === shift.premiseId && a.clockIn?.slice(0, 10) === shift.date))
  );
  if (records.some((a) => a.status === 'Clocked Out' || a.clockOut)) return 'Completed';
  if (records.some((a) => a.clockIn)) return shift.status === 'Active' ? 'Completed' : 'Completed';
  return 'Missed';
}

/** Minutes from midnight for HH:MM. */
function timeToMinutes(timeStr) {
  const [h, m] = String(timeStr || '00:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Same calendar day or overnight shift spanning into next day. */
export function shiftsOverlap(a, b) {
  if (!a || !b || a.id === b.id) return false;
  if (a.guardId !== b.guardId) return false;
  if (a.status === 'Cancelled' || b.status === 'Cancelled') return false;
  if (a.date !== b.date) return false;

  const aStart = timeToMinutes(a.startTime);
  let aEnd = timeToMinutes(a.endTime);
  if (aEnd <= aStart) aEnd += 24 * 60;

  const bStart = timeToMinutes(b.startTime);
  let bEnd = timeToMinutes(b.endTime);
  if (bEnd <= bStart) bEnd += 24 * 60;

  return aStart < bEnd && bStart < aEnd;
}

export function findShiftConflicts(shifts, candidate, excludeId = null) {
  return (shifts || []).filter(
    (s) => s.id !== excludeId && shiftsOverlap(s, candidate)
  );
}

export function validateShiftAssignment(shifts, candidate, excludeId = null) {
  if (findExactDuplicateShift(shifts, candidate, excludeId)) {
    return {
      ok: false,
      error: 'This exact shift is already on the roster for this guard, site, date, and time.',
    };
  }

  const conflicts = findShiftConflicts(shifts, candidate, excludeId);
  if (!conflicts.length) return { ok: true };

  const samePremise = conflicts.filter((c) => c.premiseId === candidate.premiseId);
  if (samePremise.length) {
    return {
      ok: false,
      error: 'This guard is already scheduled at this premises for overlapping times. Assign only one shift at a time per site.',
    };
  }

  return {
    ok: false,
    error: 'This guard has another overlapping shift at the same time. Adjust times or assign a different guard.',
  };
}

const DURATION_DAYS = {
  day: 1,
  week: 7,
  two_weeks: 14,
  permanent: null,
};

/** Expand a roster entry into dated shift rows (day / week / 2 weeks). Permanent updates guard profile only. */
export function buildShiftsFromAssignment({
  tenantId,
  guardId,
  premiseId,
  startDate,
  startTime,
  endTime,
  shiftType = 'Day',
  durationType = 'day',
  generateShiftId,
}) {
  const days = DURATION_DAYS[durationType];
  if (durationType === 'permanent') {
    return { shifts: [], permanent: true };
  }

  const count = days ?? 1;
  const base = startDate || todayDateStr();
  const shifts = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(`${base}T12:00:00`);
    d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    shifts.push({
      id: generateShiftId(),
      tenantId,
      guardId,
      premiseId,
      date,
      startTime,
      endTime,
      shiftType,
      status: 'Scheduled',
      durationType,
      createdAt: new Date().toISOString(),
    });
  }
  return { shifts, permanent: false };
}

export function applyPermanentPremiseAssignment(guard, premiseId) {
  if (!guard || !premiseId) return guard;
  const ids = Array.isArray(guard.assignedPremiseIds) ? [...guard.assignedPremiseIds] : [];
  if (!ids.includes(premiseId)) ids.push(premiseId);
  return { ...guard, assignedPremiseIds: ids };
}
