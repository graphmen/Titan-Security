/** After logging a point, show "Done" for this long before switching to "waiting for next interval". */
export const PATROL_DONE_DISPLAY_MS = 5 * 60 * 1000;

/** Parse schedule strings like "Every 30 mins" or "Every 2 hours" → milliseconds. */
export function parseScheduleIntervalMs(schedule = '') {
  const s = String(schedule).trim();
  if (/shift/i.test(s)) return 12 * 60 * 60 * 1000;
  const minMatch = s.match(/(\d+)\s*min/i);
  if (minMatch) return Math.max(1, parseInt(minMatch[1], 10)) * 60 * 1000;
  const hourMatch = s.match(/(\d+)\s*hour/i);
  if (hourMatch) return Math.max(1, parseInt(hourMatch[1], 10)) * 60 * 60 * 1000;
  return 30 * 60 * 1000;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatCountdown(ms) {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${totalMin} min`;
}

/**
 * Per-checkpoint UI state for recurring patrol intervals.
 * done (≤5 min) → waiting (until interval) → due (can log again)
 */
export function getCheckpointPatrolUi(cp, now = Date.now()) {
  const intervalMs = parseScheduleIntervalMs(cp?.schedule);
  const last = cp?.lastScanned ? new Date(cp.lastScanned).getTime() : null;

  if (!last) {
    return {
      phase: 'due',
      canScan: true,
      buttonLabel: 'Log scan',
      tag: 'Not scanned',
      isDoneVisual: false,
    };
  }

  const elapsed = now - last;

  if (elapsed < PATROL_DONE_DISPLAY_MS) {
    return {
      phase: 'done',
      canScan: false,
      buttonLabel: 'Done',
      tag: `✓ ${formatTime(last)}`,
      isDoneVisual: true,
    };
  }

  if (elapsed >= intervalMs) {
    return {
      phase: 'due',
      canScan: true,
      buttonLabel: 'Log scan',
      tag: `Due · last ${formatTime(last)}`,
      isDoneVisual: false,
    };
  }

  const msUntilDue = intervalMs - elapsed;
  return {
    phase: 'waiting',
    canScan: false,
    buttonLabel: 'Waiting',
    tag: `Next in ${formatCountdown(msUntilDue)}`,
    isDoneVisual: false,
    msUntilDue,
  };
}

export function getShiftWindow({ myAttendance, todayShifts, now = Date.now() }) {
  const shift = (todayShifts || []).find((s) => s.status !== 'Cancelled' && s.status !== 'Completed')
    || todayShifts?.[0];

  let shiftStartMs = myAttendance?.clockIn ? new Date(myAttendance.clockIn).getTime() : null;
  let shiftEndMs = null;

  if (shift?.date && shift?.startTime) {
    const start = new Date(`${shift.date}T${shift.startTime}:00`).getTime();
    if (!Number.isNaN(start)) {
      if (!shiftStartMs || start < shiftStartMs) shiftStartMs = start;
    }
    if (shift.endTime) {
      let end = new Date(`${shift.date}T${shift.endTime}:00`).getTime();
      if (!Number.isNaN(end)) {
        if (start && end <= start) end += 24 * 60 * 60 * 1000;
        shiftEndMs = end;
      }
    }
  }

  if (!shiftStartMs && myAttendance?.clockIn) {
    shiftStartMs = new Date(myAttendance.clockIn).getTime();
  }
  if (!shiftEndMs && shiftStartMs) {
    shiftEndMs = shiftStartMs + 12 * 60 * 60 * 1000;
  }

  return { shiftStartMs, shiftEndMs, shift };
}

/** Shift progress = patrol taps logged vs expected (shift length ÷ interval × points). */
export function computePatrolShiftProgress({
  checkpoints = [],
  occurrenceBook = [],
  guardId,
  guardName,
  premiseId,
  myAttendance,
  todayShifts,
  defaultIntervalMinutes = 30,
  now = Date.now(),
}) {
  const { shiftStartMs, shiftEndMs } = getShiftWindow({ myAttendance, todayShifts, now });

  if (!checkpoints.length || !shiftStartMs) {
    return {
      completed: 0,
      expected: 0,
      percent: 0,
      roundsExpected: 0,
      dueNow: checkpoints.length,
    };
  }

  const intervals = checkpoints.map((cp) => parseScheduleIntervalMs(cp.schedule));
  const intervalMs = Math.min(...intervals) || defaultIntervalMinutes * 60 * 1000;
  const shiftMs = Math.max(intervalMs, (shiftEndMs || now) - shiftStartMs);
  const roundsExpected = Math.max(1, Math.ceil(shiftMs / intervalMs));
  const expected = roundsExpected * checkpoints.length;

  const completed = (occurrenceBook || []).filter((item) => {
    if (item.type !== 'Patrol Tap') return false;
    const ts = new Date(item.timestamp).getTime();
    if (Number.isNaN(ts) || ts < shiftStartMs) return false;
    if (shiftEndMs && ts > shiftEndMs + intervalMs) return false;
    if (premiseId && item.premiseId && item.premiseId !== premiseId) return false;
    if (guardId && item.guardId) return item.guardId === guardId;
    if (guardName && item.guardName) {
      return item.guardName.trim().toLowerCase() === guardName.trim().toLowerCase();
    }
    return !!guardId || !!guardName;
  }).length;

  const dueNow = checkpoints.filter((cp) => getCheckpointPatrolUi(cp, now).canScan).length;
  const percent = expected > 0 ? Math.min(100, Math.round((completed / expected) * 100)) : 0;

  return { completed, expected, percent, roundsExpected, dueNow, intervalMs, shiftStartMs, shiftEndMs };
}
