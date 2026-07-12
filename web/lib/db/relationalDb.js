import { supabaseAdmin } from '../../app/supabase';
import { DEFAULT_SYSTEM_SETTINGS, TITAN_TENANT_ID } from '../systemSettings';
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

/** Count guards in DB — used to detect empty vs seeded DB. */
export async function countGuardsInDb() {
  const { count, error } = await db.from('guards').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
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

  return state;
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

async function syncTenantEntities(state, tenantId) {
  const territories = state.territories?.[tenantId] || [];
  const territoryIds = territories.map((t) => t.id);

  if (territories.length) {
    const { error } = await db.from('territories').upsert(territories.map((t) => territoryToRow(t, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('territories', 'tenant_id', tenantId, territoryIds);

  const suburbRows = [];
  territories.forEach((t) => {
    (t.suburbs || []).forEach((s) => suburbRows.push(suburbToRow(s, t.id)));
  });
  if (suburbRows.length) {
    const { error } = await db.from('territory_suburbs').upsert(suburbRows);
    if (error) throw error;
  }
  if (territoryIds.length) {
    const { data: allSuburbs, error: subSelErr } = await db
      .from('territory_suburbs')
      .select('id, territory_id');
    if (subSelErr && subSelErr.code !== 'PGRST116') throw subSelErr;
    const keepTerritories = new Set(territoryIds);
    const deleteSuburbIds = (allSuburbs || [])
      .filter((s) => !keepTerritories.has(s.territory_id))
      .map((s) => s.id);
    if (deleteSuburbIds.length) {
      const { error } = await db.from('territory_suburbs').delete().in('id', deleteSuburbIds);
      if (error && error.code !== 'PGRST116') throw error;
    }
  }

  const supervisors = state.supervisors?.[tenantId] || [];
  const supervisorIds = supervisors.map((s) => s.id);
  if (supervisors.length) {
    const { error } = await db.from('supervisors').upsert(supervisors.map((s) => supervisorToRow(s, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('supervisors', 'tenant_id', tenantId, supervisorIds);

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
  await deleteMissing('premises', 'tenant_id', tenantId, premiseIds);

  const placeRows = [];
  premiseIds.forEach((pid) => {
    (state.places?.[pid] || []).forEach((pl) => placeRows.push(placeToRow(pl, tenantId)));
  });
  const placeIds = placeRows.map((p) => p.id);
  if (placeRows.length) {
    const { error } = await db.from('places').upsert(placeRows);
    if (error) throw error;
  }
  if (placeIds.length > 0) {
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
  } else {
    const { data: tenantPlaces } = await db.from('places').select('id').eq('tenant_id', tenantId);
    const allPlaceIds = (tenantPlaces || []).map((p) => p.id);
    if (allPlaceIds.length) {
      await db.from('checkpoints').delete().in('place_id', allPlaceIds);
      await db.from('places').delete().in('id', allPlaceIds);
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
  await deleteMissing('guards', 'tenant_id', tenantId, guardIds);

  const gpRows = [];
  guards.forEach((g) => {
    (g.assignedPremiseIds || []).forEach((pid) => {
      gpRows.push({ guard_id: g.id, premise_id: pid });
    });
  });
  if (premiseIds.length) {
    await db.from('guard_premises').delete().in('premise_id', premiseIds);
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
  await deleteMissing('shifts', 'tenant_id', tenantId, shiftIds);

  const attendance = (state.attendance?.[tenantId] || []).filter((a) => !a.guardId || guardIdSet.has(a.guardId));
  const attIds = attendance.map((a) => a.id);
  if (attendance.length) {
    const { error } = await db.from('guard_attendance').upsert(attendance.map((a) => attendanceToRow(a, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('guard_attendance', 'tenant_id', tenantId, attIds);

  const checkpoints = state.checkpoints?.[tenantId] || [];
  const cpIds = checkpoints.map((c) => c.id);
  if (checkpoints.length) {
    const { error } = await db.from('checkpoints').upsert(checkpoints.map((c) => checkpointToRow(c, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('checkpoints', 'tenant_id', tenantId, cpIds);

  const alerts = (state.guardAlerts?.[tenantId] || []).filter((a) => !a.guardId || guardIdSet.has(a.guardId));
  const alertIds = alerts.map((a) => a.id);
  if (alerts.length) {
    const { error } = await db.from('guard_alerts').upsert(alerts.map((a) => alertToRow(a, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('guard_alerts', 'tenant_id', tenantId, alertIds);

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
  await deleteMissing('shift_swap_requests', 'tenant_id', tenantId, swapIds);

  const wa = state.whatsappOutbox?.[tenantId] || [];
  const waIds = wa.map((w) => w.id);
  if (wa.length) {
    const { error } = await db.from('whatsapp_outbox').upsert(wa.map((w) => waToRow(w, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('whatsapp_outbox', 'tenant_id', tenantId, waIds);
}

/** Persist full in-memory state to relational tables. */
export async function saveAppStateToRelationalDb(state) {
  const tenantList = Object.values(state.tenants || {});
  if (tenantList.length) {
    const { error } = await db.from('tenants').upsert(tenantList.map(tenantToRow));
    if (error) throw error;
  }

  await db.from('app_settings').upsert([
    { key: 'active_tenant_id', value: TITAN_TENANT_ID },
    { key: 'system_settings', value: state.systemSettings || DEFAULT_SYSTEM_SETTINGS },
  ]);

  for (const tenantId of Object.keys(state.tenants || {})) {
    await syncTenantEntities(state, tenantId);
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
  await db.from('app_settings').upsert({
    key: 'initial_seed_done',
    value: true,
  });
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
