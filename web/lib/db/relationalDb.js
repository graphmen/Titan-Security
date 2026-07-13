import { supabaseAdmin } from '../../app/supabase';
import { DEFAULT_SYSTEM_SETTINGS, TITAN_TENANT_ID } from '../systemSettings';
import { stripLegacyDemoEntities, filterLegacyDemoFromLoadedState, LEGACY_DEMO_GUARD_IDS, getAllLegacyDemoIds, assertNoLegacyDemoRowsInState } from './legacyDemo';
import { wipeOperationalTablesDirectSql } from './directWipe';
import {
  tenantToRow,
  rowToTenant,
  territoryToRow,
  rowToTerritory,
  suburbToRow,
  supervisorToRow,
  rowToSupervisor,
  premiseToRow,
  rowToPremise,
  placeToRow,
  rowToPlace,
  guardToRow,
  rowToGuard,
  shiftToRow,
  rowToShift,
  attendanceToRow,
  rowToAttendance,
  checkpointToRow,
  rowToCheckpoint,
  alertToRow,
  rowToAlert,
  swapToRow,
  rowToSwap,
  waToRow,
  rowToWa,
} from './mappers';

/** Server-side DB client — service role when configured, otherwise anon. */
const db = supabaseAdmin;

async function requireDbOk(result, context) {
  if (result?.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result;
}

export function isDestructiveDbAction(action) {
  return action === 'CLEAR_TENANT_DEMO_DATA'
    || (typeof action === 'string' && action.startsWith('DELETE_'));
}

/** Probe that relational tables exist and are reachable. */
export async function probeRelationalDb() {
  const { error } = await db.from('guards').select('id').limit(1);
  if (error) throw error;
  return true;
}

/** Count non-demo guards in DB. */
export async function countGuardsInDb() {
  const { data, error } = await db.from('guards').select('id');
  if (error) throw error;
  return (data || []).filter((g) => !LEGACY_DEMO_GUARD_IDS.has(g.id)).length;
}

/** Load full app state from relational tables (parallel queries for faster serverless cold starts). */
export async function loadAppStateFromRelationalDb() {
  const state = {
    activeTenantId: TITAN_TENANT_ID,
    systemSettings: { ...DEFAULT_SYSTEM_SETTINGS },
    tenants: {},
    territories: {},
    supervisors: {},
    premises: {},
    places: {},
    guards: {},
    shifts: {},
    attendance: {},
    checkpoints: {},
    guardAlerts: {},
    shiftSwapRequests: {},
    whatsappOutbox: {},
    occurrenceBook: [],
    checklistTemplates: {},
    checklistSubmissions: [],
    visitors: [],
    activeSosAlerts: {},
  };

  const [
    tenantsRes,
    settingsRes,
    territoriesRes,
    suburbsRes,
    supRowsRes,
    supTerRes,
    premRowsRes,
    placeRowsRes,
    guardRowsRes,
    gpRowsRes,
    shiftRowsRes,
    attRowsRes,
    cpRowsRes,
    alertRowsRes,
    swapRowsRes,
    waRowsRes,
    obRowsRes,
    visRowsRes,
    tplRowsRes,
    subRowsRes,
    sosRowsRes,
  ] = await Promise.all([
    db.from('tenants').select('*'),
    db.from('app_settings').select('key, value').in('key', ['active_tenant_id', 'system_settings']),
    db.from('territories').select('*'),
    db.from('territory_suburbs').select('*'),
    db.from('supervisors').select('*'),
    db.from('supervisor_territories').select('*'),
    db.from('premises').select('*'),
    db.from('places').select('*'),
    db.from('guards').select('*'),
    db.from('guard_premises').select('*'),
    db.from('shifts').select('*'),
    db.from('guard_attendance').select('*'),
    db.from('checkpoints').select('*'),
    db.from('guard_alerts').select('*'),
    db.from('shift_swap_requests').select('*'),
    db.from('whatsapp_outbox').select('*'),
    db.from('occurrence_book').select('*').order('timestamp', { ascending: false }),
    db.from('visitors').select('*').order('check_in_time', { ascending: false }),
    db.from('checklist_templates').select('*'),
    db.from('checklist_submissions').select('*').order('timestamp', { ascending: false }),
    db.from('active_sos_alerts').select('*'),
  ]);

  if (tenantsRes.error) throw tenantsRes.error;
  if (settingsRes.error) throw settingsRes.error;
  if (territoriesRes.error) throw territoriesRes.error;
  if (suburbsRes.error) throw suburbsRes.error;
  if (supRowsRes.error) throw supRowsRes.error;
  if (supTerRes.error) throw supTerRes.error;
  if (premRowsRes.error) throw premRowsRes.error;
  if (placeRowsRes.error) throw placeRowsRes.error;
  if (guardRowsRes.error) throw guardRowsRes.error;
  if (gpRowsRes.error) throw gpRowsRes.error;
  if (shiftRowsRes.error) throw shiftRowsRes.error;
  if (attRowsRes.error) throw attRowsRes.error;
  if (cpRowsRes.error) throw cpRowsRes.error;
  if (alertRowsRes.error) throw alertRowsRes.error;
  if (swapRowsRes.error) throw swapRowsRes.error;
  if (waRowsRes.error) throw waRowsRes.error;

  const tenants = tenantsRes.data || [];
  tenants.forEach((r) => {
    state.tenants[r.id] = rowToTenant(r);
    state.territories[r.id] = [];
    state.supervisors[r.id] = [];
    state.premises[r.id] = [];
    state.guards[r.id] = [];
    state.shifts[r.id] = [];
    state.attendance[r.id] = [];
    state.checkpoints[r.id] = [];
    state.guardAlerts[r.id] = [];
    state.shiftSwapRequests[r.id] = [];
    state.whatsappOutbox[r.id] = [];
    state.checklistTemplates[r.id] = [];
  });

  (settingsRes.data || []).forEach((row) => {
    if (row.key === 'system_settings' && row.value) {
      state.systemSettings =
        typeof row.value === 'object' ? { ...DEFAULT_SYSTEM_SETTINGS, ...row.value } : { ...DEFAULT_SYSTEM_SETTINGS };
    }
  });
  state.activeTenantId = TITAN_TENANT_ID;

  const suburbsByTerritory = {};
  (suburbsRes.data || []).forEach((s) => {
    if (!suburbsByTerritory[s.territory_id]) suburbsByTerritory[s.territory_id] = [];
    suburbsByTerritory[s.territory_id].push({ id: s.id, name: s.name });
  });

  (territoriesRes.data || []).forEach((r) => {
    if (!state.territories[r.tenant_id]) state.territories[r.tenant_id] = [];
    state.territories[r.tenant_id].push(rowToTerritory(r, suburbsByTerritory[r.id] || []));
  });

  const terBySup = {};
  (supTerRes.data || []).forEach((st) => {
    if (!terBySup[st.supervisor_id]) terBySup[st.supervisor_id] = [];
    terBySup[st.supervisor_id].push(st.territory_id);
  });

  (supRowsRes.data || []).forEach((r) => {
    if (!state.supervisors[r.tenant_id]) state.supervisors[r.tenant_id] = [];
    state.supervisors[r.tenant_id].push(rowToSupervisor(r, terBySup[r.id] || []));
  });

  (premRowsRes.data || []).forEach((r) => {
    if (!state.premises[r.tenant_id]) state.premises[r.tenant_id] = [];
    state.premises[r.tenant_id].push(rowToPremise(r));
  });

  (placeRowsRes.data || []).forEach((r) => {
    const place = rowToPlace(r);
    if (!state.places[r.premise_id]) state.places[r.premise_id] = [];
    state.places[r.premise_id].push(place);
  });

  const premisesByGuard = {};
  (gpRowsRes.data || []).forEach((gp) => {
    if (!premisesByGuard[gp.guard_id]) premisesByGuard[gp.guard_id] = [];
    premisesByGuard[gp.guard_id].push(gp.premise_id);
  });

  (guardRowsRes.data || []).forEach((r) => {
    if (!state.guards[r.tenant_id]) state.guards[r.tenant_id] = [];
    state.guards[r.tenant_id].push(rowToGuard(r, premisesByGuard[r.id] || []));
  });

  (shiftRowsRes.data || []).forEach((r) => {
    if (!state.shifts[r.tenant_id]) state.shifts[r.tenant_id] = [];
    state.shifts[r.tenant_id].push(rowToShift(r));
  });

  (attRowsRes.data || []).forEach((r) => {
    if (!state.attendance[r.tenant_id]) state.attendance[r.tenant_id] = [];
    state.attendance[r.tenant_id].push(rowToAttendance(r));
  });

  (cpRowsRes.data || []).forEach((r) => {
    if (!state.checkpoints[r.tenant_id]) state.checkpoints[r.tenant_id] = [];
    state.checkpoints[r.tenant_id].push(rowToCheckpoint(r));
  });

  (alertRowsRes.data || []).forEach((r) => {
    if (!state.guardAlerts[r.tenant_id]) state.guardAlerts[r.tenant_id] = [];
    state.guardAlerts[r.tenant_id].push(rowToAlert(r));
  });

  (swapRowsRes.data || []).forEach((r) => {
    if (!state.shiftSwapRequests[r.tenant_id]) state.shiftSwapRequests[r.tenant_id] = [];
    state.shiftSwapRequests[r.tenant_id].push(rowToSwap(r));
  });

  (waRowsRes.data || []).forEach((r) => {
    if (!state.whatsappOutbox[r.tenant_id]) state.whatsappOutbox[r.tenant_id] = [];
    state.whatsappOutbox[r.tenant_id].push(rowToWa(r));
  });

  const obRows = obRowsRes.data;
  if (obRows && !obRowsRes.error) {
    state.occurrenceBook = obRows.map((item) => ({
      id: item.id,
      tenantId: item.tenant_id,
      timestamp: item.timestamp,
      guardName: item.guard_name,
      type: item.type,
      description: item.description,
      status: item.status,
      attachments: { photo: item.photo_url, voice: item.voice_url },
    }));
  }

  const visRows = visRowsRes.data;
  if (visRows && !visRowsRes.error) {
    state.visitors = visRows.map((v) => ({
      id: v.id,
      tenantId: v.tenant_id,
      name: v.name,
      idNumber: v.id_number,
      company: v.company,
      vehiclePlate: v.vehicle_plate,
      checkInTime: v.check_in_time,
      checkOutTime: v.check_out_time,
      status: v.status,
    }));
  }

  const tplRows = tplRowsRes.data;
  if (tplRows && !tplRowsRes.error) {
    tplRows.forEach((temp) => {
      if (!state.checklistTemplates[temp.tenant_id]) state.checklistTemplates[temp.tenant_id] = [];
      state.checklistTemplates[temp.tenant_id].push({
        id: temp.id,
        name: temp.name,
        description: temp.description,
        fields: temp.fields,
      });
    });
  }

  const subRows = subRowsRes.data;
  if (subRows && !subRowsRes.error) {
    state.checklistSubmissions = subRows.map((sub) => ({
      id: sub.id,
      tenantId: sub.tenant_id,
      templateId: sub.template_id,
      templateName: sub.template_name,
      timestamp: sub.timestamp,
      guardName: sub.guard_name,
      values: sub.values,
    }));
  }

  const sosRows = sosRowsRes.data;
  if (sosRows && !sosRowsRes.error) {
    sosRows.forEach((alert) => {
      state.activeSosAlerts[alert.tenant_id] = {
        active: true,
        guardName: alert.guard_name,
        timestamp: alert.timestamp,
        message: alert.message,
      };
    });
  }

  return filterLegacyDemoFromLoadedState(state);
}

/** Wipe all operational data — direct SQL first (bypasses RLS), then Supabase API fallback. */
export async function wipeEntireOperationalDatabase() {
  const usedDirectSql = await wipeOperationalTablesDirectSql();
  if (usedDirectSql) {
    return { method: 'direct_sql' };
  }

  // Fallback: delete every row from all operational tables (service role required on server).
  const wipeTables = [
    { table: 'shift_swap_requests', column: 'id' },
    { table: 'guard_alerts', column: 'id' },
    { table: 'whatsapp_outbox', column: 'id' },
    { table: 'guard_attendance', column: 'id' },
    { table: 'shifts', column: 'id' },
    { table: 'checkpoints', column: 'id' },
    { table: 'guard_premises', column: 'guard_id' },
    { table: 'guards', column: 'id' },
    { table: 'places', column: 'id' },
    { table: 'premises', column: 'id' },
    { table: 'supervisor_territories', column: 'supervisor_id' },
    { table: 'supervisors', column: 'id' },
    { table: 'territory_suburbs', column: 'id' },
    { table: 'territories', column: 'id' },
    { table: 'visitors', column: 'id' },
    { table: 'active_sos_alerts', column: 'tenant_id' },
    { table: 'occurrence_book', column: 'id' },
    { table: 'checklist_submissions', column: 'id' },
    { table: 'checklist_templates', column: 'id' },
    { table: 'titan_state', column: 'id' },
    { table: 'app_settings', column: 'key' },
    { table: 'tenants', column: 'id' },
  ];

  for (const { table, column } of wipeTables) {
    const { error } = await db.from(table).delete().not(column, 'is', null);
    if (error && error.code !== 'PGRST116') {
      throw new Error(`${table} wipe: ${error.message}`);
    }
  }

  return { method: 'supabase_api' };
}

async function deleteMissing(table, tenantColumn, tenantId, keepIds) {
  const { data: existing, error: selErr } = await db
    .from(table)
    .select('id')
    .eq(tenantColumn, tenantId);
  if (selErr) throw new Error(`${table} select: ${selErr.message}`);
  const keep = new Set(keepIds);
  const toDelete = (existing || []).map((r) => r.id).filter((id) => !keep.has(id));
  if (toDelete.length === 0) return;
  await requireDbOk(await db.from(table).delete().in('id', toDelete), `${table} delete`);
}

/** Sync suburbs for one territory — scoped to that territory only. */
async function syncSuburbsForTerritory(territoryId, suburbs = []) {
  const suburbList = suburbs || [];
  const keepIds = new Set(suburbList.map((s) => s.id));
  const { data: existing, error: selErr } = await db
    .from('territory_suburbs')
    .select('id')
    .eq('territory_id', territoryId);
  if (selErr) throw new Error(`territory_suburbs select: ${selErr.message}`);
  const toDelete = (existing || []).map((r) => r.id).filter((id) => !keepIds.has(id));
  if (suburbList.length) {
    const { error } = await db.from('territory_suburbs').upsert(suburbList.map((s) => suburbToRow(s, territoryId)));
    if (error) throw error;
  }
  if (toDelete.length) {
    await requireDbOk(await db.from('territory_suburbs').delete().in('id', toDelete), 'territory_suburbs delete');
  }
}

/** Remove DB rows that reference a guard before the guard row is deleted. */
async function deleteGuardDependenciesFromDb(guardId, tenantId) {
  await requireDbOk(await db.from('guard_alerts').delete().eq('guard_id', guardId), 'guard_alerts');
  await requireDbOk(await db.from('guard_attendance').delete().eq('guard_id', guardId), 'guard_attendance');

  const { data: shifts, error: shiftSelErr } = await db.from('shifts').select('id').eq('guard_id', guardId).eq('tenant_id', tenantId);
  if (shiftSelErr) throw new Error(`shifts select: ${shiftSelErr.message}`);
  const shiftIds = (shifts || []).map((s) => s.id);
  if (shiftIds.length) {
    await requireDbOk(await db.from('shift_swap_requests').delete().in('shift_id', shiftIds), 'shift_swap_requests');
  }
  await requireDbOk(await db.from('shift_swap_requests').delete().eq('requester_guard_id', guardId), 'shift_swap_requests requester');
  await requireDbOk(await db.from('shift_swap_requests').delete().eq('target_guard_id', guardId), 'shift_swap_requests target');
  await requireDbOk(await db.from('shifts').delete().eq('guard_id', guardId).eq('tenant_id', tenantId), 'shifts');
  await requireDbOk(await db.from('guard_premises').delete().eq('guard_id', guardId), 'guard_premises');
}

/** Immediate row delete for DELETE_* actions — ensures DB rows are removed even if sync diff fails. */
export async function applyDirectRowDelete(action, payload, tenantId) {
  switch (action) {
    case 'DELETE_GUARD': {
      const { guardId } = payload;
      await deleteGuardDependenciesFromDb(guardId, tenantId);
      const { error } = await db.from('guards').delete().eq('id', guardId).eq('tenant_id', tenantId);
      if (error) throw error;
      break;
    }
    case 'DELETE_PREMISE': {
      const { premiseId } = payload;
      const { data: placeRows } = await db.from('places').select('id').eq('premise_id', premiseId);
      const placeIds = (placeRows || []).map((p) => p.id);
      if (placeIds.length) {
        await db.from('checkpoints').delete().in('place_id', placeIds);
        await db.from('places').delete().in('id', placeIds);
      }
      await db.from('guard_premises').delete().eq('premise_id', premiseId);
      const { error } = await db.from('premises').delete().eq('id', premiseId).eq('tenant_id', tenantId);
      if (error) throw error;
      break;
    }
    case 'DELETE_PLACE': {
      const { placeId } = payload;
      await db.from('checkpoints').delete().eq('place_id', placeId);
      const { error } = await db.from('places').delete().eq('id', placeId);
      if (error) throw error;
      break;
    }
    case 'DELETE_TERRITORY': {
      const { territoryId } = payload;
      await db.from('territory_suburbs').delete().eq('territory_id', territoryId);
      await db.from('supervisor_territories').delete().eq('territory_id', territoryId);
      const { error } = await db.from('territories').delete().eq('id', territoryId).eq('tenant_id', tenantId);
      if (error) throw error;
      break;
    }
    case 'DELETE_SUPERVISOR': {
      const { supervisorId } = payload;
      await db.from('supervisor_territories').delete().eq('supervisor_id', supervisorId);
      const { error } = await db.from('supervisors').delete().eq('id', supervisorId).eq('tenant_id', tenantId);
      if (error) throw error;
      break;
    }
    case 'DELETE_SHIFT': {
      const { shiftId } = payload;
      const { error } = await db.from('shifts').delete().eq('id', shiftId).eq('tenant_id', tenantId);
      if (error) throw error;
      break;
    }
    default:
      break;
  }
}

/** Upsert rows changed by a single create/update action — avoids full-state diff deletes. */
export async function applyDirectRowUpsert(action, payload, tenantId, state) {
  switch (action) {
    case 'CREATE_TERRITORY':
    case 'UPDATE_TERRITORY': {
      const territoryId = payload.territoryId
        || (state.territories?.[tenantId] || []).slice(-1)[0]?.id;
      const territory = (state.territories?.[tenantId] || []).find((t) => t.id === territoryId);
      if (!territory) throw new Error('Territory not found in memory after save');
      await requireDbOk(
        await db.from('territories').upsert(territoryToRow(territory, tenantId)),
        'territories upsert'
      );
      await syncSuburbsForTerritory(territory.id, territory.suburbs || []);
      break;
    }
    case 'CREATE_SUPERVISOR':
    case 'UPDATE_SUPERVISOR': {
      const supervisorId = payload.supervisorId
        || (state.supervisors?.[tenantId] || []).slice(-1)[0]?.id;
      const supervisor = (state.supervisors?.[tenantId] || []).find((s) => s.id === supervisorId);
      if (!supervisor) throw new Error('Supervisor not found in memory after save');
      await requireDbOk(
        await db.from('supervisors').upsert(supervisorToRow(supervisor, tenantId)),
        'supervisors upsert'
      );
      await requireDbOk(
        await db.from('supervisor_territories').delete().eq('supervisor_id', supervisor.id),
        'supervisor_territories clear'
      );
      const stRows = (supervisor.assignedTerritoryIds || []).map((tid) => ({
        supervisor_id: supervisor.id,
        territory_id: tid,
      }));
      if (stRows.length) {
        await requireDbOk(await db.from('supervisor_territories').upsert(stRows), 'supervisor_territories upsert');
      }
      break;
    }
    case 'CREATE_GUARD':
    case 'UPDATE_GUARD':
    case 'UPDATE_GUARD_PHOTO':
    case 'ADD_GUARD_DOCUMENT':
    case 'ADD_GUARD_TRAINING':
    case 'RESET_GUARD_PIN':
    case 'CHANGE_GUARD_PIN': {
      const guardId = payload.guardId
        || (state.guards?.[tenantId] || []).slice(-1)[0]?.id;
      const guard = (state.guards?.[tenantId] || []).find((g) => g.id === guardId);
      if (!guard) throw new Error('Guard not found in memory after save');
      await requireDbOk(await db.from('guards').upsert(guardToRow(guard, tenantId)), 'guards upsert');
      await requireDbOk(await db.from('guard_premises').delete().eq('guard_id', guard.id), 'guard_premises clear');
      const gpRows = (guard.assignedPremiseIds || []).map((pid) => ({
        guard_id: guard.id,
        premise_id: pid,
      }));
      if (gpRows.length) {
        await requireDbOk(await db.from('guard_premises').upsert(gpRows), 'guard_premises upsert');
      }
      const wa = state.whatsappOutbox?.[tenantId] || [];
      if (wa.length) {
        await requireDbOk(
          await db.from('whatsapp_outbox').upsert(wa.map((w) => waToRow(w, tenantId))),
          'whatsapp_outbox upsert'
        );
      }
      break;
    }
    case 'CREATE_PREMISE':
    case 'UPDATE_PREMISE': {
      const premiseId = payload.premiseId
        || (state.premises?.[tenantId] || []).slice(-1)[0]?.id;
      const premise = (state.premises?.[tenantId] || []).find((p) => p.id === premiseId);
      if (!premise) throw new Error('Premise not found in memory after save');
      await requireDbOk(await db.from('premises').upsert(premiseToRow(premise, tenantId)), 'premises upsert');
      break;
    }
    case 'CREATE_PLACE':
    case 'UPDATE_PLACE': {
      const premiseId = payload.premiseId;
      const placeId = payload.placeId
        || (state.places?.[premiseId] || []).slice(-1)[0]?.id;
      const place = (state.places?.[premiseId] || []).find((p) => p.id === placeId);
      if (!place) throw new Error('Place not found in memory after save');
      await requireDbOk(await db.from('places').upsert(placeToRow(place, tenantId)), 'places upsert');
      break;
    }
    case 'CREATE_SHIFT':
    case 'UPDATE_SHIFT': {
      const shiftId = payload.shiftId
        || (state.shifts?.[tenantId] || []).slice(-1)[0]?.id;
      const shift = (state.shifts?.[tenantId] || []).find((s) => s.id === shiftId);
      if (!shift) throw new Error('Shift not found in memory after save');
      await requireDbOk(await db.from('shifts').upsert(shiftToRow(shift, tenantId)), 'shifts upsert');
      break;
    }
    default:
      break;
  }
}

const DIRECT_UPSERT_ACTIONS = new Set([
  'CREATE_TERRITORY', 'UPDATE_TERRITORY',
  'CREATE_SUPERVISOR', 'UPDATE_SUPERVISOR',
  'CREATE_GUARD', 'UPDATE_GUARD', 'UPDATE_GUARD_PHOTO', 'ADD_GUARD_DOCUMENT', 'ADD_GUARD_TRAINING',
  'RESET_GUARD_PIN', 'CHANGE_GUARD_PIN',
  'CREATE_PREMISE', 'UPDATE_PREMISE',
  'CREATE_PLACE', 'UPDATE_PLACE',
  'CREATE_SHIFT', 'UPDATE_SHIFT',
]);

export function usesDirectRowUpsert(action) {
  return DIRECT_UPSERT_ACTIONS.has(action);
}

async function syncTenantEntities(state, tenantId, { allowDiffDeletes = false } = {}) {
  const territories = state.territories?.[tenantId] || [];
  const territoryIds = territories.map((t) => t.id);

  if (territories.length) {
    const { error } = await db.from('territories').upsert(territories.map((t) => territoryToRow(t, tenantId)));
    if (error) throw error;
  }
  if (allowDiffDeletes) {
    await deleteMissing('territories', 'tenant_id', tenantId, territoryIds);
  }

  for (const territory of territories) {
    await syncSuburbsForTerritory(territory.id, territory.suburbs || []);
  }

  const supervisors = state.supervisors?.[tenantId] || [];
  const supervisorIds = supervisors.map((s) => s.id);
  if (supervisors.length) {
    const { error } = await db.from('supervisors').upsert(supervisors.map((s) => supervisorToRow(s, tenantId)));
    if (error) throw error;
  }
  if (allowDiffDeletes) {
    await deleteMissing('supervisors', 'tenant_id', tenantId, supervisorIds);
  }

  if (supervisorIds.length) {
    await db.from('supervisor_territories').delete().in('supervisor_id', supervisorIds);
  }
  const stRows = [];
  supervisors.forEach((s) => {
    (s.assignedTerritoryIds || []).forEach((tid) => {
      stRows.push({ supervisor_id: s.id, territory_id: tid });
    });
  });
  if (stRows.length) {
    const { error } = await db.from('supervisor_territories').upsert(stRows);
    if (error) throw error;
  }

  const premises = state.premises?.[tenantId] || [];
  const premiseIds = premises.map((p) => p.id);
  if (premises.length) {
    const { error } = await db.from('premises').upsert(premises.map((p) => premiseToRow(p, tenantId)));
    if (error) throw error;
  }
  if (allowDiffDeletes) {
    await deleteMissing('premises', 'tenant_id', tenantId, premiseIds);
  }

  const placeRows = [];
  premiseIds.forEach((pid) => {
    (state.places?.[pid] || []).forEach((pl) => placeRows.push(placeToRow(pl, tenantId)));
  });
  const placeIds = placeRows.map((p) => p.id);
  if (placeRows.length) {
    const { error } = await db.from('places').upsert(placeRows);
    if (error) throw error;
  }
  if (allowDiffDeletes && placeIds.length > 0) {
    const { data: existingPlaces, error: plSelErr } = await db
      .from('places')
      .select('id')
      .eq('tenant_id', tenantId);
    if (plSelErr) throw plSelErr;
    const keepPlaces = new Set(placeIds);
    const deletePlaceIds = (existingPlaces || []).map((r) => r.id).filter((id) => !keepPlaces.has(id));
    if (deletePlaceIds.length) {
      await db.from('checkpoints').delete().in('place_id', deletePlaceIds);
      const { error } = await db.from('places').delete().in('id', deletePlaceIds);
      if (error) throw error;
    }
  }

  const guards = state.guards?.[tenantId] || [];
  const guardIds = guards.map((g) => g.id);
  const guardIdSet = new Set(guardIds);
  const shiftIdsSet = new Set((state.shifts?.[tenantId] || []).map((s) => s.id));
  if (guards.length) {
    const { error } = await db.from('guards').upsert(guards.map((g) => guardToRow(g, tenantId)));
    if (error) throw error;
  }
  if (allowDiffDeletes) {
    await deleteMissing('guards', 'tenant_id', tenantId, guardIds);
  }

  const gpRows = [];
  guards.forEach((g) => {
    (g.assignedPremiseIds || []).forEach((pid) => {
      gpRows.push({ guard_id: g.id, premise_id: pid });
    });
  });
  if (guardIds.length) {
    await db.from('guard_premises').delete().in('guard_id', guardIds);
  }
  if (gpRows.length) {
    const { error } = await db.from('guard_premises').upsert(gpRows);
    if (error) throw error;
  }

  const shifts = (state.shifts?.[tenantId] || []).filter((s) => guardIdSet.has(s.guardId));
  const shiftIds = shifts.map((s) => s.id);
  if (shifts.length) {
    const { error } = await db.from('shifts').upsert(shifts.map((s) => shiftToRow(s, tenantId)));
    if (error) throw error;
  }
  if (allowDiffDeletes) {
    await deleteMissing('shifts', 'tenant_id', tenantId, shiftIds);
  }

  const attendance = (state.attendance?.[tenantId] || []).filter((a) => !a.guardId || guardIdSet.has(a.guardId));
  const attIds = attendance.map((a) => a.id);
  if (attendance.length) {
    const { error } = await db.from('guard_attendance').upsert(attendance.map((a) => attendanceToRow(a, tenantId)));
    if (error) throw error;
  }
  if (allowDiffDeletes) {
    await deleteMissing('guard_attendance', 'tenant_id', tenantId, attIds);
  }

  const checkpoints = state.checkpoints?.[tenantId] || [];
  const cpIds = checkpoints.map((c) => c.id);
  if (checkpoints.length) {
    const { error } = await db.from('checkpoints').upsert(checkpoints.map((c) => checkpointToRow(c, tenantId)));
    if (error) throw error;
  }
  if (allowDiffDeletes) {
    await deleteMissing('checkpoints', 'tenant_id', tenantId, cpIds);
  }

  const alerts = (state.guardAlerts?.[tenantId] || []).filter((a) => !a.guardId || guardIdSet.has(a.guardId));
  const alertIds = alerts.map((a) => a.id);
  if (alerts.length) {
    const { error } = await db.from('guard_alerts').upsert(alerts.map((a) => alertToRow(a, tenantId)));
    if (error) throw error;
  }
  if (allowDiffDeletes) {
    await deleteMissing('guard_alerts', 'tenant_id', tenantId, alertIds);
  }

  const swaps = (state.shiftSwapRequests?.[tenantId] || []).filter((s) => {
    const requesterId = s.requestingGuardId || s.requesterGuardId;
    return shiftIdsSet.has(s.shiftId)
      && guardIdSet.has(requesterId)
      && (!s.targetGuardId || guardIdSet.has(s.targetGuardId));
  });
  const swapIds = swaps.map((s) => s.id);
  if (swaps.length) {
    const { error } = await db.from('shift_swap_requests').upsert(swaps.map((s) => swapToRow(s, tenantId)));
    if (error) throw error;
  }
  if (allowDiffDeletes) {
    await deleteMissing('shift_swap_requests', 'tenant_id', tenantId, swapIds);
  }

  const wa = state.whatsappOutbox?.[tenantId] || [];
  const waIds = wa.map((w) => w.id);
  if (wa.length) {
    const { error } = await db.from('whatsapp_outbox').upsert(wa.map((w) => waToRow(w, tenantId)));
    if (error) throw error;
  }
  if (allowDiffDeletes) {
    await deleteMissing('whatsapp_outbox', 'tenant_id', tenantId, waIds);
  }
}

/** Persist full in-memory state to relational tables (upsert-only by default — deletes use applyDirectRowDelete). */
export async function saveAppStateToRelationalDb(state, { allowDiffDeletes = false } = {}) {
  const clean = stripLegacyDemoEntities(state);
  assertNoLegacyDemoRowsInState(clean);
  const tenantList = Object.values(clean.tenants || {});
  if (tenantList.length) {
    const { error } = await db.from('tenants').upsert(tenantList.map(tenantToRow));
    if (error) throw error;
  }

  await db.from('app_settings').upsert([
    { key: 'active_tenant_id', value: TITAN_TENANT_ID },
    { key: 'system_settings', value: clean.systemSettings || DEFAULT_SYSTEM_SETTINGS },
  ]);

  for (const tenantId of Object.keys(clean.tenants || {})) {
    await syncTenantEntities(clean, tenantId, { allowDiffDeletes });
  }
}

/** Remove all operational records for a tenant (guards, premises, territories, etc.). */
export async function clearTenantOperationalData(tenantId) {
  await requireDbOk(await db.from('shift_swap_requests').delete().eq('tenant_id', tenantId), 'shift_swap_requests');
  await requireDbOk(await db.from('guard_alerts').delete().eq('tenant_id', tenantId), 'guard_alerts');
  await requireDbOk(await db.from('whatsapp_outbox').delete().eq('tenant_id', tenantId), 'whatsapp_outbox');
  await requireDbOk(await db.from('guard_attendance').delete().eq('tenant_id', tenantId), 'guard_attendance');
  await requireDbOk(await db.from('shifts').delete().eq('tenant_id', tenantId), 'shifts');
  await requireDbOk(await db.from('checkpoints').delete().eq('tenant_id', tenantId), 'checkpoints');

  const { data: guardRows, error: guardSelErr } = await db.from('guards').select('id').eq('tenant_id', tenantId);
  if (guardSelErr) throw new Error(`guards select: ${guardSelErr.message}`);
  const guardIds = (guardRows || []).map((g) => g.id);
  if (guardIds.length) {
    await requireDbOk(await db.from('guard_premises').delete().in('guard_id', guardIds), 'guard_premises');
    await requireDbOk(await db.from('guards').delete().in('id', guardIds), 'guards');
  }

  const { data: premRows, error: premSelErr } = await db.from('premises').select('id').eq('tenant_id', tenantId);
  if (premSelErr) throw new Error(`premises select: ${premSelErr.message}`);
  const premiseIds = (premRows || []).map((p) => p.id);
  if (premiseIds.length) {
    const { data: placeRows } = await db.from('places').select('id').in('premise_id', premiseIds);
    const placeIds = (placeRows || []).map((p) => p.id);
    if (placeIds.length) {
      await requireDbOk(await db.from('checkpoints').delete().in('place_id', placeIds), 'checkpoints by place');
      await requireDbOk(await db.from('places').delete().in('id', placeIds), 'places');
    }
    await requireDbOk(await db.from('guard_premises').delete().in('premise_id', premiseIds), 'guard_premises by premise');
    await requireDbOk(await db.from('premises').delete().in('id', premiseIds), 'premises');
  }

  const { data: supRows, error: supSelErr } = await db.from('supervisors').select('id').eq('tenant_id', tenantId);
  if (supSelErr) throw new Error(`supervisors select: ${supSelErr.message}`);
  const supervisorIds = (supRows || []).map((s) => s.id);
  if (supervisorIds.length) {
    await requireDbOk(await db.from('supervisor_territories').delete().in('supervisor_id', supervisorIds), 'supervisor_territories');
    await requireDbOk(await db.from('supervisors').delete().in('id', supervisorIds), 'supervisors');
  }

  const { data: terRows, error: terSelErr } = await db.from('territories').select('id').eq('tenant_id', tenantId);
  if (terSelErr) throw new Error(`territories select: ${terSelErr.message}`);
  const territoryIds = (terRows || []).map((t) => t.id);
  if (territoryIds.length) {
    await requireDbOk(await db.from('territory_suburbs').delete().in('territory_id', territoryIds), 'territory_suburbs');
    await requireDbOk(await db.from('supervisor_territories').delete().in('territory_id', territoryIds), 'supervisor_territories by territory');
    await requireDbOk(await db.from('territories').delete().in('id', territoryIds), 'territories');
  }

  await requireDbOk(await db.from('visitors').delete().eq('tenant_id', tenantId), 'visitors');
  await requireDbOk(await db.from('active_sos_alerts').delete().eq('tenant_id', tenantId), 'active_sos_alerts');

  // Legacy blob table — can re-seed relational rows if left intact
  await db.from('titan_state').delete().neq('id', '');
}

/** Physically remove legacy seed rows from Supabase (not just hide them in the API). */
export async function purgeLegacyDemoRowsFromDb() {
  const { guardIds, premiseIds, territoryIds, supervisorIds, tenantIds } = getAllLegacyDemoIds();

  for (const guardId of guardIds) {
    try {
      await deleteGuardDependenciesFromDb(guardId, TITAN_TENANT_ID);
    } catch {
      /* row may not exist */
    }
  }
  if (guardIds.length) {
    await db.from('guards').delete().in('id', guardIds);
  }

  if (premiseIds.length) {
    const { data: placeRows } = await db.from('places').select('id').in('premise_id', premiseIds);
    const placeIds = (placeRows || []).map((p) => p.id);
    if (placeIds.length) {
      await db.from('checkpoints').delete().in('place_id', placeIds);
      await db.from('places').delete().in('id', placeIds);
    }
    await db.from('guard_premises').delete().in('premise_id', premiseIds);
    await db.from('premises').delete().in('id', premiseIds);
  }

  if (supervisorIds.length) {
    await db.from('supervisor_territories').delete().in('supervisor_id', supervisorIds);
    await db.from('supervisors').delete().in('id', supervisorIds);
  }

  if (territoryIds.length) {
    await db.from('territory_suburbs').delete().in('territory_id', territoryIds);
    await db.from('supervisor_territories').delete().in('territory_id', territoryIds);
    await db.from('territories').delete().in('id', territoryIds);
  }

  if (tenantIds.length) {
    await db.from('checkpoints').delete().in('tenant_id', tenantIds);
    await db.from('tenants').delete().in('id', tenantIds);
  }

  await db.from('titan_state').delete().neq('id', '');
}

/** Ensure the Titan tenant exists — never inject demo/sample records. */
export async function ensureMinimalTenantInDb() {
  const { data: tenant } = await db.from('tenants').select('id').eq('id', TITAN_TENANT_ID).maybeSingle();
  if (!tenant) {
    const { error } = await db.from('tenants').upsert({
      id: TITAN_TENANT_ID,
      name: 'Titan Protection',
      primary_color: '#1b4332',
      logo_text: 'TP',
      plan: 'Growth Trial',
      status: 'Active',
    });
    if (error) throw error;
  }

  const { data: existingRows, error: settingsErr } = await db
    .from('app_settings')
    .select('key')
    .in('key', ['active_tenant_id', 'initial_seed_done', 'system_settings']);
  if (settingsErr) throw settingsErr;

  const existingKeys = new Set((existingRows || []).map((row) => row.key));
  const seeds = [];
  if (!existingKeys.has('active_tenant_id')) {
    seeds.push({ key: 'active_tenant_id', value: TITAN_TENANT_ID });
  }
  if (!existingKeys.has('initial_seed_done')) {
    seeds.push({ key: 'initial_seed_done', value: true });
  }
  if (!existingKeys.has('system_settings')) {
    seeds.push({ key: 'system_settings', value: DEFAULT_SYSTEM_SETTINGS });
  }
  if (seeds.length) {
    const { error } = await db.from('app_settings').insert(seeds);
    if (error) throw error;
  }
}

/** Persist system settings only — used by UPDATE_SYSTEM_SETTINGS. */
export async function persistSystemSettingsToDb(systemSettings) {
  await requireDbOk(
    await db.from('app_settings').upsert({
      key: 'system_settings',
      value: systemSettings || DEFAULT_SYSTEM_SETTINGS,
    }),
    'app_settings system_settings'
  );
}

/** @deprecated Demo seeding is disabled — kept as no-op alias for compatibility. */
export async function seedRelationalDbIfEmpty() {
  await ensureMinimalTenantInDb();
  return false;
}

export function getRelationalSummary(state) {
  const tid = state.activeTenantId || 'titan';
  return {
    tenantId: tid,
    guards: (state.guards?.[tid] || []).length,
    premises: (state.premises?.[tid] || []).length,
    territories: (state.territories?.[tid] || []).length,
    supervisors: (state.supervisors?.[tid] || []).length,
    shifts: (state.shifts?.[tid] || []).length,
    tenants: Object.keys(state.tenants || {}).length,
    storage: 'relational',
  };
}
