import { parseShiftMinutes, todayDateStr } from './guards';

export function getPremisesForTerritory(state, tenantId, territoryId) {
  if (!territoryId) return [];
  return (state.premises?.[tenantId] || []).filter((p) => p.territoryId === territoryId);
}

export function getGuardsForPremise(state, tenantId, premiseId) {
  return (state.guards?.[tenantId] || []).filter(
    (g) => (g.assignedPremiseIds || []).includes(premiseId)
  );
}

export function getGuardsForTerritory(state, tenantId, territoryId) {
  const premiseIds = getPremisesForTerritory(state, tenantId, territoryId).map((p) => p.id);
  return (state.guards?.[tenantId] || []).filter(
    (g) =>
      g.territoryId === territoryId ||
      (g.assignedPremiseIds || []).some((pid) => premiseIds.includes(pid))
  );
}

export function getSupervisorsForTerritory(state, tenantId, territoryId) {
  if (!territoryId) return [];
  return (state.supervisors?.[tenantId] || []).filter(
    (s) => s.status === 'Active' && (s.assignedTerritoryIds || []).includes(territoryId)
  );
}

/** Premises a supervisor may assign guards to (all territories they manage). */
export function premisesForSupervisor(state, tenantId, supervisorId) {
  if (!supervisorId) return [];
  const supervisor = (state.supervisors?.[tenantId] || []).find((s) => s.id === supervisorId);
  if (!supervisor) return [];
  const territoryIds = new Set(supervisor.assignedTerritoryIds || []);
  if (!territoryIds.size) return state.premises?.[tenantId] || [];
  return (state.premises?.[tenantId] || []).filter((p) => territoryIds.has(p.territoryId));
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

/** Backfill supervisorId when exactly one supervisor matches the guard territory. */
export function normalizeGuardSupervisorAssignments(state, tenantId) {
  const guards = state.guards?.[tenantId] || [];
  for (const guard of guards) {
    if (guard.supervisorId) continue;
    const territoryId = resolveGuardTerritoryId(state, tenantId, guard);
    const candidates = getSupervisorsForTerritory(state, tenantId, territoryId);
    if (candidates.length === 1) guard.supervisorId = candidates[0].id;
  }
}

export function validateGuardSupervisorAssignment(state, tenantId, supervisorId) {
  if (!supervisorId) {
    return { ok: false, error: 'Each guard must be assigned exactly one supervisor' };
  }
  const supervisor = (state.supervisors?.[tenantId] || []).find(
    (s) => s.id === supervisorId && s.status === 'Active'
  );
  if (!supervisor) {
    return { ok: false, error: 'Supervisor not found or inactive' };
  }
  return { ok: true, supervisor };
}

export function filterAssignedPremisesForSupervisor(state, tenantId, supervisorId, assignedPremiseIds = []) {
  const allowed = new Set(premisesForSupervisor(state, tenantId, supervisorId).map((p) => p.id));
  return assignedPremiseIds.filter((id) => allowed.has(id));
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

export function syncGuardTerritoryFromPremises(state, tenantId, guard) {
  if (!guard) return;
  const premises = state.premises?.[tenantId] || [];
  const assigned = premises.filter((p) => (guard.assignedPremiseIds || []).includes(p.id));
  if (assigned.length === 0) return;
  const primary = assigned[0];
  guard.territoryId = primary.territoryId || guard.territoryId;
  if (!guard.city && primary.city) guard.city = primary.city;
  if (!guard.suburb && primary.suburb) guard.suburb = primary.suburb;
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
