/** Known seed/demo entity IDs — never write these back to Supabase. */
export const LEGACY_DEMO_GUARD_IDS = new Set(['GRD-001', 'GRD-002', 'GRD-003']);
export const LEGACY_DEMO_PREMISE_IDS = new Set(['PRM-TITAN01', 'PRM-KUW01']);
export const LEGACY_DEMO_TERRITORY_IDS = new Set(['TER-HRE-WEST', 'TER-HRE-CBD']);
export const LEGACY_DEMO_SUPERVISOR_IDS = new Set(['SUP-001', 'SUP-002']);
export const LEGACY_DEMO_TENANT_IDS = new Set(['alpha', 'omega']);

export function stripLegacyDemoEntities(state) {
  if (!state || typeof state !== 'object') return state;

  const next = { ...state };
  next.guards = {};
  for (const [tid, list] of Object.entries(state.guards || {})) {
    next.guards[tid] = (list || []).filter((g) => !LEGACY_DEMO_GUARD_IDS.has(g.id));
  }

  next.premises = {};
  for (const [tid, list] of Object.entries(state.premises || {})) {
    next.premises[tid] = (list || []).filter((p) => !LEGACY_DEMO_PREMISE_IDS.has(p.id));
  }

  next.territories = {};
  for (const [tid, list] of Object.entries(state.territories || {})) {
    next.territories[tid] = (list || []).filter((t) => !LEGACY_DEMO_TERRITORY_IDS.has(t.id));
  }

  next.supervisors = {};
  for (const [tid, list] of Object.entries(state.supervisors || {})) {
    next.supervisors[tid] = (list || []).filter((s) => !LEGACY_DEMO_SUPERVISOR_IDS.has(s.id));
  }

  next.tenants = { ...(state.tenants || {}) };
  for (const tid of LEGACY_DEMO_TENANT_IDS) {
    delete next.tenants[tid];
  }

  next.places = { ...(state.places || {}) };
  for (const pid of LEGACY_DEMO_PREMISE_IDS) {
    delete next.places[pid];
  }

  next.shifts = {};
  for (const [tid, list] of Object.entries(state.shifts || {})) {
    next.shifts[tid] = (list || []).filter((s) => !LEGACY_DEMO_GUARD_IDS.has(s.guardId));
  }

  next.guardAlerts = {};
  for (const [tid, list] of Object.entries(state.guardAlerts || {})) {
    next.guardAlerts[tid] = (list || []).filter((a) => !LEGACY_DEMO_GUARD_IDS.has(a.guardId));
  }

  next.checkpoints = {};
  for (const [tid, list] of Object.entries(state.checkpoints || {})) {
    next.checkpoints[tid] = (list || []).filter((c) => !LEGACY_DEMO_PREMISE_IDS.has(c.premiseId));
  }

  return next;
}

export function filterLegacyDemoFromLoadedState(state) {
  return stripLegacyDemoEntities(state);
}

/** All known legacy demo IDs — for physical DB purge. */
export function getAllLegacyDemoIds() {
  return {
    guardIds: [...LEGACY_DEMO_GUARD_IDS],
    premiseIds: [...LEGACY_DEMO_PREMISE_IDS],
    territoryIds: [...LEGACY_DEMO_TERRITORY_IDS],
    supervisorIds: [...LEGACY_DEMO_SUPERVISOR_IDS],
    tenantIds: [...LEGACY_DEMO_TENANT_IDS],
  };
}

/** Block any attempt to write demo seed IDs back to the database. */
export function assertNoLegacyDemoRowsInState(state) {
  const { guardIds, premiseIds, territoryIds, supervisorIds } = getAllLegacyDemoIds();
  for (const [tid, list] of Object.entries(state?.guards || {})) {
    for (const g of list || []) {
      if (guardIds.includes(g.id)) {
        throw new Error(`Refusing to save legacy demo guard ${g.id}. Run a full database wipe first.`);
      }
    }
  }
  for (const [tid, list] of Object.entries(state?.premises || {})) {
    for (const p of list || []) {
      if (premiseIds.includes(p.id)) {
        throw new Error(`Refusing to save legacy demo premise ${p.id}. Run a full database wipe first.`);
      }
    }
  }
  for (const [tid, list] of Object.entries(state?.territories || {})) {
    for (const t of list || []) {
      if (territoryIds.includes(t.id)) {
        throw new Error(`Refusing to save legacy demo territory ${t.id}. Run a full database wipe first.`);
      }
    }
  }
  for (const [tid, list] of Object.entries(state?.supervisors || {})) {
    for (const s of list || []) {
      if (supervisorIds.includes(s.id)) {
        throw new Error(`Refusing to save legacy demo supervisor ${s.id}. Run a full database wipe first.`);
      }
    }
  }
  for (const pid of premiseIds) {
    if (state?.places?.[pid]?.length) {
      throw new Error(`Refusing to save legacy demo places for ${pid}. Run a full database wipe first.`);
    }
  }
}
