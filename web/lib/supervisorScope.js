/** Territory-scoped data access for supervisor mobile clients. */

export function getSupervisor(state, tenantId, supervisorId) {
  return (state.supervisors?.[tenantId] || []).find((s) => s.id === supervisorId) || null;
}

export function getSupervisorTerritoryIds(supervisor) {
  return new Set(supervisor?.assignedTerritoryIds || []);
}

export function getPremisesInTerritories(state, tenantId, territoryIds) {
  const ids = territoryIds instanceof Set ? territoryIds : new Set(territoryIds || []);
  return (state.premises?.[tenantId] || []).filter((p) => ids.has(p.territoryId));
}

export function getPremiseIdSetForTerritories(state, tenantId, territoryIds) {
  return new Set(getPremisesInTerritories(state, tenantId, territoryIds).map((p) => p.id));
}

export function guardInSupervisorScope(guard, territoryIds, premiseIds) {
  if (!guard) return false;
  if (guard.territoryId && territoryIds.has(guard.territoryId)) return true;
  return (guard.assignedPremiseIds || []).some((id) => premiseIds.has(id));
}

export function filterStateForSupervisor(state, tenantId, supervisorId) {
  const supervisor = getSupervisor(state, tenantId, supervisorId);
  if (!supervisor) return null;

  const territoryIds = getSupervisorTerritoryIds(supervisor);
  const territories = (state.territories?.[tenantId] || []).filter((t) => territoryIds.has(t.id));
  const premises = getPremisesInTerritories(state, tenantId, territoryIds);
  const premiseIds = new Set(premises.map((p) => p.id));

  const places = {};
  premiseIds.forEach((pid) => {
    places[pid] = state.places?.[pid] || [];
  });

  const guards = (state.guards?.[tenantId] || []).filter((g) =>
    guardInSupervisorScope(g, territoryIds, premiseIds)
  );
  const guardIds = new Set(guards.map((g) => g.id));

  const shifts = (state.shifts?.[tenantId] || []).filter(
    (s) => guardIds.has(s.guardId) || premiseIds.has(s.premiseId)
  );
  const attendance = (state.attendance?.[tenantId] || []).filter((a) => guardIds.has(a.guardId));
  const guardAlerts = (state.guardAlerts?.[tenantId] || []).filter((a) => guardIds.has(a.guardId));
  const shiftSwapRequests = (state.shiftSwapRequests?.[tenantId] || []).filter((s) =>
    guardIds.has(s.requestingGuardId || s.requesterGuardId)
  );
  const whatsappOutbox = (state.whatsappOutbox?.[tenantId] || []).filter(
    (w) => !w.guardId || guardIds.has(w.guardId)
  );
  const checkpoints = (state.checkpoints?.[tenantId] || []).filter(
    (cp) => !cp.premiseId || premiseIds.has(cp.premiseId)
  );

  const guardNames = new Set(guards.map((g) => g.fullName));
  const occurrenceBook = (state.occurrenceBook || []).filter(
    (item) => item.tenantId === tenantId && guardNames.has(item.guardName)
  );

  const visitors = (state.visitors || []).filter((v) => v.tenantId === tenantId);

  const tenant = state.tenants?.[tenantId] || state.tenants?.[Object.keys(state.tenants || {})[0]];

  return {
    activeTenantId: tenantId,
    scopedForSupervisor: supervisorId,
    supervisor: sanitizeSupervisorPublic(supervisor),
    tenants: tenant ? { [tenantId]: tenant } : {},
    territories: { [tenantId]: territories },
    supervisors: { [tenantId]: [sanitizeSupervisorPublic(supervisor)] },
    premises: { [tenantId]: premises },
    places,
    guards: { [tenantId]: guards },
    shifts: { [tenantId]: shifts },
    attendance: { [tenantId]: attendance },
    guardAlerts: { [tenantId]: guardAlerts },
    shiftSwapRequests: { [tenantId]: shiftSwapRequests },
    whatsappOutbox: { [tenantId]: whatsappOutbox },
    checkpoints: { [tenantId]: checkpoints },
    occurrenceBook,
    visitors,
    activeSosAlerts: state.activeSosAlerts?.[tenantId]
      ? { [tenantId]: state.activeSosAlerts[tenantId] }
      : {},
    systemSettings: state.systemSettings || {},
    dataSource: state.dataSource,
  };
}

export function sanitizeSupervisorPublic(supervisor) {
  if (!supervisor) return null;
  const { loginPin, ...safe } = supervisor;
  return safe;
}

const SUPERVISOR_ALLOWED_ACTIONS = new Set([
  'SUPERVISOR_LOGIN',
  'CHANGE_SUPERVISOR_PIN',
  'CREATE_PREMISE',
  'UPDATE_PREMISE',
  'CREATE_PLACE',
  'UPDATE_PLACE',
  'CREATE_GUARD',
  'UPDATE_GUARD',
  'RESET_GUARD_PIN',
  'CREATE_SHIFT',
  'UPDATE_SHIFT',
  'SEND_GUARD_WHATSAPP',
  'DISMISS_GUARD_ALERT',
  'RESOLVE_SHIFT_SWAP',
  'UPDATE_INCIDENT_STATUS',
  'CLEAR_SOS',
]);

export function assertSupervisorMutationAllowed(action, payload, state, tenantId) {
  const supervisorId = payload.supervisorId;
  if (!supervisorId) return null;
  if (!SUPERVISOR_ALLOWED_ACTIONS.has(action)) {
    return { error: 'Action not permitted for supervisor mobile', status: 403 };
  }

  const supervisor = getSupervisor(state, tenantId, supervisorId);
  if (!supervisor || supervisor.status !== 'Active') {
    return { error: 'Supervisor not found or inactive', status: 403 };
  }

  const territoryIds = getSupervisorTerritoryIds(supervisor);
  if (!territoryIds.size) {
    return { error: 'No territories assigned to your supervisor profile', status: 403 };
  }

  const premiseIds = getPremiseIdSetForTerritories(state, tenantId, territoryIds);

  switch (action) {
    case 'CREATE_PREMISE': {
      const { territoryId } = payload;
      if (territoryId && !territoryIds.has(territoryId)) {
        return { error: 'You can only register premises in your assigned territories', status: 403 };
      }
      break;
    }
    case 'UPDATE_PREMISE': {
      const premise = (state.premises?.[tenantId] || []).find((p) => p.id === payload.premiseId);
      if (!premise || !territoryIds.has(premise.territoryId)) {
        return { error: 'Premises not in your assigned territories', status: 403 };
      }
      if (payload.updates?.territoryId && !territoryIds.has(payload.updates.territoryId)) {
        return { error: 'Cannot move premises outside your territories', status: 403 };
      }
      break;
    }
    case 'CREATE_PLACE':
    case 'UPDATE_PLACE': {
      const pid = payload.premiseId || payload.updates?.premiseId;
      const premise = (state.premises?.[tenantId] || []).find((p) => p.id === pid);
      if (!premise || !premiseIds.has(premise.id)) {
        return { error: 'Place must belong to a premises in your territories', status: 403 };
      }
      break;
    }
    case 'CREATE_GUARD':
    case 'UPDATE_GUARD':
    case 'RESET_GUARD_PIN': {
      const guardId = payload.guardId;
      if (action === 'CREATE_GUARD') {
        const tid = payload.territoryId;
        const pids = payload.assignedPremiseIds || [];
        const territoryOk = tid && territoryIds.has(tid);
        const premiseOk = pids.some((id) => premiseIds.has(id));
        if (!territoryOk && !premiseOk) {
          return { error: 'Guard must be assigned within your territories', status: 403 };
        }
        break;
      }
      const guard = (state.guards?.[tenantId] || []).find((g) => g.id === guardId);
      if (!guardInSupervisorScope(guard, territoryIds, premiseIds)) {
        return { error: 'Guard is outside your assigned territories', status: 403 };
      }
      break;
    }
    case 'CREATE_SHIFT':
    case 'UPDATE_SHIFT': {
      const shift = action === 'UPDATE_SHIFT'
        ? (state.shifts?.[tenantId] || []).find((s) => s.id === payload.shiftId)
        : null;
      const guardId = payload.guardId || shift?.guardId;
      const premiseId = payload.premiseId || shift?.premiseId;
      const guard = (state.guards?.[tenantId] || []).find((g) => g.id === guardId);
      if (guard && !guardInSupervisorScope(guard, territoryIds, premiseIds)) {
        return { error: 'Shift guard is outside your territories', status: 403 };
      }
      if (premiseId && !premiseIds.has(premiseId)) {
        return { error: 'Shift premises is outside your territories', status: 403 };
      }
      break;
    }
    case 'SEND_GUARD_WHATSAPP':
    case 'DISMISS_GUARD_ALERT': {
      let guardId = payload.guardId;
      if (action === 'DISMISS_GUARD_ALERT') {
        const alert = (state.guardAlerts?.[tenantId] || []).find((a) => a.id === payload.alertId);
        guardId = alert?.guardId;
      }
      const guard = (state.guards?.[tenantId] || []).find((g) => g.id === guardId);
      if (!guardInSupervisorScope(guard, territoryIds, premiseIds)) {
        return { error: 'Guard is outside your assigned territories', status: 403 };
      }
      break;
    }
    case 'RESOLVE_SHIFT_SWAP': {
      const swap = (state.shiftSwapRequests?.[tenantId] || []).find((s) => s.id === payload.swapId);
      const requesterId = swap?.requestingGuardId || swap?.requesterGuardId;
      const guard = (state.guards?.[tenantId] || []).find((g) => g.id === requesterId);
      if (!guardInSupervisorScope(guard, territoryIds, premiseIds)) {
        return { error: 'Swap request is outside your territories', status: 403 };
      }
      break;
    }
    default:
      break;
  }

  return null;
}
