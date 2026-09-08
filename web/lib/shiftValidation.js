import { todayDateStr } from './guards.js';

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
