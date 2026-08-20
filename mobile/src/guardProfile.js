function parseShiftMinutes(timeStr) {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  return h * 60 + m;
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

export function getPremisesForTerritory(state, tenantId, territoryId) {
  if (!territoryId) return [];
  return (state.premises?.[tenantId] || []).filter((p) => p.territoryId === territoryId);
}

export function resolveGuardTerritoryId(state, tenantId, guard) {
  if (!guard) return null;
  if (guard.territoryId) return guard.territoryId;
  const premises = state.premises?.[tenantId] || [];
  for (const pid of guard.assignedPremiseIds || []) {
    const p = premises.find((x) => x.id === pid);
    if (p?.territoryId) return p.territoryId;
  }
  return null;
}

export function getSupervisorsForTerritory(state, tenantId, territoryId) {
  if (!territoryId) return [];
  return (state.supervisors?.[tenantId] || []).filter(
    (s) => s.status === 'Active' && (s.assignedTerritoryIds || []).includes(territoryId)
  );
}

function shiftEndMinutes(startTime, endTime) {
  const start = parseShiftMinutes(startTime);
  let end = parseShiftMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return end;
}

function isNowInShift(shift, nowMins) {
  const start = parseShiftMinutes(shift.startTime);
  const end = shiftEndMinutes(shift.startTime, shift.endTime);
  let adjNow = nowMins;
  if (end > 24 * 60 && nowMins < start) adjNow = nowMins + 24 * 60;
  return adjNow >= start && adjNow < end;
}

export function findReliefForShift(state, tenantId, shift, excludeGuardId) {
  if (!shift) return { reliefShift: null, reliefGuard: null };
  const shifts = state.shifts?.[tenantId] || [];
  const guards = state.guards?.[tenantId] || [];
  const candidates = shifts
    .filter(
      (s) =>
        s.premiseId === shift.premiseId &&
        s.date === shift.date &&
        s.guardId !== excludeGuardId &&
        s.status !== 'Cancelled'
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const myEnd = parseShiftMinutes(shift.endTime);
  let reliefShift =
    candidates.find((s) => parseShiftMinutes(s.startTime) === myEnd) ||
    candidates.find((s) => parseShiftMinutes(s.startTime) >= myEnd) ||
    candidates[0] ||
    null;

  const reliefGuard = reliefShift ? guards.find((g) => g.id === reliefShift.guardId) : null;
  return { reliefShift, reliefGuard };
}

export function resolveGuardSupervisor(state, tenantId, guard) {
  if (!guard) return null;
  const supervisors = state.supervisors?.[tenantId] || [];
  if (guard.supervisorId) {
    const direct = supervisors.find((s) => s.id === guard.supervisorId && s.status === 'Active');
    if (direct) return direct;
  }
  const territoryId = resolveGuardTerritoryId(state, tenantId, guard);
  const territorySupervisors = getSupervisorsForTerritory(state, tenantId, territoryId);
  return territorySupervisors.length === 1 ? territorySupervisors[0] : null;
}

/**
 * Pick the active site for a guard — never falls back to an unassigned tenant premise.
 */
export function resolveGuardPremiseId({
  guard,
  premises = [],
  premiseId = '',
  guardProfile = null,
  attendance = [],
  guardId = '',
}) {
  const assignedIds = guard?.assignedPremiseIds || [];
  if (assignedIds.length === 0) return '';

  const onDuty = attendance.find(
    (a) =>
      a.guardId === guardId &&
      (a.status === 'On Duty' || a.status === 'Late') &&
      assignedIds.includes(a.premiseId)
  );
  if (onDuty?.premiseId) return onDuty.premiseId;

  const shiftPremise =
    guardProfile?.currentShift?.premiseId || guardProfile?.focusShift?.premiseId;
  if (shiftPremise && assignedIds.includes(shiftPremise)) return shiftPremise;

  if (premiseId && assignedIds.includes(premiseId)) return premiseId;

  const firstAssigned = premises.find((p) => assignedIds.includes(p.id));
  return firstAssigned?.id || assignedIds[0] || '';
}

export function buildGuardProfileContext(state, tenantId, guardId) {
  const guards = state.guards?.[tenantId] || [];
  const guard = guards.find((g) => g.id === guardId);
  if (!guard) return null;

  const premises = state.premises?.[tenantId] || [];
  const territories = state.territories?.[tenantId] || [];
  const shifts = state.shifts?.[tenantId] || [];
  const today = todayDateStr();
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

  const assignedPremises = premises.filter((p) => (guard.assignedPremiseIds || []).includes(p.id));
  const territoryId = resolveGuardTerritoryId(state, tenantId, guard);
  const territory = territories.find((t) => t.id === territoryId) || null;
  const territoryPremises = getPremisesForTerritory(state, tenantId, territoryId);
  const supervisor = resolveGuardSupervisor(state, tenantId, guard);
  const supervisors = supervisor ? [supervisor] : [];

  const shiftsToday = shifts
    .filter((s) => s.guardId === guardId && s.date === today && s.status !== 'Cancelled')
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const upcomingShifts = shifts
    .filter((s) => s.guardId === guardId && s.date >= today && s.status !== 'Cancelled')
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 21);

  const currentShift = shiftsToday.find((s) => isNowInShift(s, nowMins)) || null;
  const nextShiftToday =
    shiftsToday.find((s) => parseShiftMinutes(s.startTime) > nowMins && s.id !== currentShift?.id) || null;

  const focusShift = currentShift || nextShiftToday || shiftsToday[0] || upcomingShifts[0] || null;
  const { reliefShift, reliefGuard } = findReliefForShift(state, tenantId, focusShift, guardId);

  const enrichShift = (s) => {
    if (!s) return null;
    const premise = premises.find((p) => p.id === s.premiseId);
    const terr = territories.find((t) => t.id === premise?.territoryId);
    return {
      ...s,
      premiseName: premise?.name || s.premiseId,
      premiseAddress: premise?.address,
      suburb: premise?.suburb,
      city: premise?.city,
      territoryName: terr?.name,
    };
  };

  return {
    guard,
    territory,
    territoryId,
    assignedPremises,
    territoryPremises,
    supervisor,
    supervisors,
    shiftsToday: shiftsToday.map(enrichShift),
    upcomingShifts: upcomingShifts.map(enrichShift),
    currentShift: enrichShift(currentShift),
    nextShiftToday: enrichShift(nextShiftToday),
    focusShift: enrichShift(focusShift),
    reliefShift: enrichShift(reliefShift),
    reliefGuard,
  };
}
