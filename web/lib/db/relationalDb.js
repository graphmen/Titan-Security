import { supabase } from '../../app/supabase';
import { createSeedState } from '../localStore';
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

/** Probe that relational tables exist and are reachable. */
export async function probeRelationalDb() {
  const { error } = await supabase.from('guards').select('id').limit(1);
  if (error) throw error;
  return true;
}

/** Count guards in DB — used to detect empty vs seeded DB. */
export async function countGuardsInDb() {
  const { count, error } = await supabase.from('guards').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

/** Load full app state from relational tables. */
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

  const { data: tenants, error: tErr } = await supabase.from('tenants').select('*');
  if (tErr) throw tErr;
  (tenants || []).forEach((r) => {
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

  const { data: settings } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['active_tenant_id', 'system_settings']);

  (settings || []).forEach((row) => {
    if (row.key === 'system_settings' && row.value) {
      state.systemSettings =
        typeof row.value === 'object' ? { ...DEFAULT_SYSTEM_SETTINGS, ...row.value } : { ...DEFAULT_SYSTEM_SETTINGS };
    }
  });
  state.activeTenantId = TITAN_TENANT_ID;

  const { data: territories, error: terErr } = await supabase.from('territories').select('*');
  if (terErr) throw terErr;

  const { data: suburbs, error: subErr } = await supabase.from('territory_suburbs').select('*');
  if (subErr) throw subErr;

  const suburbsByTerritory = {};
  (suburbs || []).forEach((s) => {
    if (!suburbsByTerritory[s.territory_id]) suburbsByTerritory[s.territory_id] = [];
    suburbsByTerritory[s.territory_id].push({ id: s.id, name: s.name });
  });

  (territories || []).forEach((r) => {
    if (!state.territories[r.tenant_id]) state.territories[r.tenant_id] = [];
    state.territories[r.tenant_id].push(rowToTerritory(r, suburbsByTerritory[r.id] || []));
  });

  const { data: supRows, error: supErr } = await supabase.from('supervisors').select('*');
  if (supErr) throw supErr;

  const { data: supTer, error: stErr } = await supabase.from('supervisor_territories').select('*');
  if (stErr) throw stErr;

  const terBySup = {};
  (supTer || []).forEach((st) => {
    if (!terBySup[st.supervisor_id]) terBySup[st.supervisor_id] = [];
    terBySup[st.supervisor_id].push(st.territory_id);
  });

  (supRows || []).forEach((r) => {
    if (!state.supervisors[r.tenant_id]) state.supervisors[r.tenant_id] = [];
    state.supervisors[r.tenant_id].push(rowToSupervisor(r, terBySup[r.id] || []));
  });

  const { data: premRows, error: pErr } = await supabase.from('premises').select('*');
  if (pErr) throw pErr;
  (premRows || []).forEach((r) => {
    if (!state.premises[r.tenant_id]) state.premises[r.tenant_id] = [];
    state.premises[r.tenant_id].push(rowToPremise(r));
  });

  const { data: placeRows, error: plErr } = await supabase.from('places').select('*');
  if (plErr) throw plErr;
  (placeRows || []).forEach((r) => {
    const place = rowToPlace(r);
    if (!state.places[r.premise_id]) state.places[r.premise_id] = [];
    state.places[r.premise_id].push(place);
  });

  const { data: guardRows, error: gErr } = await supabase.from('guards').select('*');
  if (gErr) throw gErr;

  const { data: gpRows, error: gpErr } = await supabase.from('guard_premises').select('*');
  if (gpErr) throw gpErr;

  const premisesByGuard = {};
  (gpRows || []).forEach((gp) => {
    if (!premisesByGuard[gp.guard_id]) premisesByGuard[gp.guard_id] = [];
    premisesByGuard[gp.guard_id].push(gp.premise_id);
  });

  (guardRows || []).forEach((r) => {
    if (!state.guards[r.tenant_id]) state.guards[r.tenant_id] = [];
    state.guards[r.tenant_id].push(rowToGuard(r, premisesByGuard[r.id] || []));
  });

  const { data: shiftRows, error: shErr } = await supabase.from('shifts').select('*');
  if (shErr) throw shErr;
  (shiftRows || []).forEach((r) => {
    if (!state.shifts[r.tenant_id]) state.shifts[r.tenant_id] = [];
    state.shifts[r.tenant_id].push(rowToShift(r));
  });

  const { data: attRows, error: aErr } = await supabase.from('guard_attendance').select('*');
  if (aErr) throw aErr;
  (attRows || []).forEach((r) => {
    if (!state.attendance[r.tenant_id]) state.attendance[r.tenant_id] = [];
    state.attendance[r.tenant_id].push(rowToAttendance(r));
  });

  const { data: cpRows, error: cpErr } = await supabase.from('checkpoints').select('*');
  if (cpErr) throw cpErr;
  (cpRows || []).forEach((r) => {
    if (!state.checkpoints[r.tenant_id]) state.checkpoints[r.tenant_id] = [];
    state.checkpoints[r.tenant_id].push(rowToCheckpoint(r));
  });

  const { data: alertRows, error: alErr } = await supabase.from('guard_alerts').select('*');
  if (alErr) throw alErr;
  (alertRows || []).forEach((r) => {
    if (!state.guardAlerts[r.tenant_id]) state.guardAlerts[r.tenant_id] = [];
    state.guardAlerts[r.tenant_id].push(rowToAlert(r));
  });

  const { data: swapRows, error: swErr } = await supabase.from('shift_swap_requests').select('*');
  if (swErr) throw swErr;
  (swapRows || []).forEach((r) => {
    if (!state.shiftSwapRequests[r.tenant_id]) state.shiftSwapRequests[r.tenant_id] = [];
    state.shiftSwapRequests[r.tenant_id].push(rowToSwap(r));
  });

  const { data: waRows, error: waErr } = await supabase.from('whatsapp_outbox').select('*');
  if (waErr) throw waErr;
  (waRows || []).forEach((r) => {
    if (!state.whatsappOutbox[r.tenant_id]) state.whatsappOutbox[r.tenant_id] = [];
    state.whatsappOutbox[r.tenant_id].push(rowToWa(r));
  });

  // Legacy command-centre tables (if they exist)
  const { data: obRows } = await supabase.from('occurrence_book').select('*').order('timestamp', { ascending: false });
  if (obRows) {
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

  const { data: visRows } = await supabase.from('visitors').select('*').order('check_in_time', { ascending: false });
  if (visRows) {
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

  const { data: tplRows } = await supabase.from('checklist_templates').select('*');
  if (tplRows) {
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

  const { data: subRows } = await supabase.from('checklist_submissions').select('*').order('timestamp', { ascending: false });
  if (subRows) {
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

  const { data: sosRows } = await supabase.from('active_sos_alerts').select('*');
  if (sosRows) {
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
  let q = supabase.from(table).delete().eq(tenantColumn, tenantId);
  if (keepIds.length > 0) {
    q = q.not('id', 'in', `(${keepIds.map((id) => `"${id}"`).join(',')})`);
  }
  const { error } = await q;
  if (error) throw error;
}

async function syncTenantEntities(state, tenantId) {
  const territories = state.territories?.[tenantId] || [];
  const territoryIds = territories.map((t) => t.id);

  if (territories.length) {
    const { error } = await supabase.from('territories').upsert(territories.map((t) => territoryToRow(t, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('territories', 'tenant_id', tenantId, territoryIds);

  const suburbRows = [];
  territories.forEach((t) => {
    (t.suburbs || []).forEach((s) => suburbRows.push(suburbToRow(s, t.id)));
  });
  if (suburbRows.length) {
    const { error } = await supabase.from('territory_suburbs').upsert(suburbRows);
    if (error) throw error;
  }
  if (territoryIds.length) {
    const { error } = await supabase.from('territory_suburbs').delete().not('territory_id', 'in', `(${territoryIds.map((id) => `"${id}"`).join(',')})`);
    if (error && error.code !== 'PGRST116') throw error;
  }

  const supervisors = state.supervisors?.[tenantId] || [];
  const supervisorIds = supervisors.map((s) => s.id);
  if (supervisors.length) {
    const { error } = await supabase.from('supervisors').upsert(supervisors.map((s) => supervisorToRow(s, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('supervisors', 'tenant_id', tenantId, supervisorIds);

  if (supervisorIds.length) {
    await supabase.from('supervisor_territories').delete().in('supervisor_id', supervisorIds);
  }
  const stRows = [];
  supervisors.forEach((s) => {
    (s.assignedTerritoryIds || []).forEach((tid) => {
      stRows.push({ supervisor_id: s.id, territory_id: tid });
    });
  });
  if (stRows.length) {
    const { error } = await supabase.from('supervisor_territories').upsert(stRows);
    if (error) throw error;
  }

  const premises = state.premises?.[tenantId] || [];
  const premiseIds = premises.map((p) => p.id);
  if (premises.length) {
    const { error } = await supabase.from('premises').upsert(premises.map((p) => premiseToRow(p, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('premises', 'tenant_id', tenantId, premiseIds);

  const placeRows = [];
  premiseIds.forEach((pid) => {
    (state.places?.[pid] || []).forEach((pl) => placeRows.push(placeToRow(pl, tenantId)));
  });
  const placeIds = placeRows.map((p) => p.id);
  if (placeRows.length) {
    const { error } = await supabase.from('places').upsert(placeRows);
    if (error) throw error;
  }
  if (placeIds.length > 0) {
    const { error } = await supabase.from('places').delete().eq('tenant_id', tenantId).not('id', 'in', `(${placeIds.map((id) => `"${id}"`).join(',')})`);
    if (error) throw error;
  } else {
    await supabase.from('places').delete().eq('tenant_id', tenantId);
  }

  const guards = state.guards?.[tenantId] || [];
  const guardIds = guards.map((g) => g.id);
  if (guards.length) {
    const { error } = await supabase.from('guards').upsert(guards.map((g) => guardToRow(g, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('guards', 'tenant_id', tenantId, guardIds);

  if (guardIds.length) {
    await supabase.from('guard_premises').delete().in('guard_id', guardIds);
  }
  const gpRows = [];
  guards.forEach((g) => {
    (g.assignedPremiseIds || []).forEach((pid) => {
      gpRows.push({ guard_id: g.id, premise_id: pid });
    });
  });
  if (gpRows.length) {
    const { error } = await supabase.from('guard_premises').upsert(gpRows);
    if (error) throw error;
  }

  const shifts = state.shifts?.[tenantId] || [];
  const shiftIds = shifts.map((s) => s.id);
  if (shifts.length) {
    const { error } = await supabase.from('shifts').upsert(shifts.map((s) => shiftToRow(s, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('shifts', 'tenant_id', tenantId, shiftIds);

  const attendance = state.attendance?.[tenantId] || [];
  const attIds = attendance.map((a) => a.id);
  if (attendance.length) {
    const { error } = await supabase.from('guard_attendance').upsert(attendance.map((a) => attendanceToRow(a, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('guard_attendance', 'tenant_id', tenantId, attIds);

  const checkpoints = state.checkpoints?.[tenantId] || [];
  const cpIds = checkpoints.map((c) => c.id);
  if (checkpoints.length) {
    const { error } = await supabase.from('checkpoints').upsert(checkpoints.map((c) => checkpointToRow(c, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('checkpoints', 'tenant_id', tenantId, cpIds);

  const alerts = state.guardAlerts?.[tenantId] || [];
  const alertIds = alerts.map((a) => a.id);
  if (alerts.length) {
    const { error } = await supabase.from('guard_alerts').upsert(alerts.map((a) => alertToRow(a, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('guard_alerts', 'tenant_id', tenantId, alertIds);

  const swaps = state.shiftSwapRequests?.[tenantId] || [];
  const swapIds = swaps.map((s) => s.id);
  if (swaps.length) {
    const { error } = await supabase.from('shift_swap_requests').upsert(swaps.map((s) => swapToRow(s, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('shift_swap_requests', 'tenant_id', tenantId, swapIds);

  const wa = state.whatsappOutbox?.[tenantId] || [];
  const waIds = wa.map((w) => w.id);
  if (wa.length) {
    const { error } = await supabase.from('whatsapp_outbox').upsert(wa.map((w) => waToRow(w, tenantId)));
    if (error) throw error;
  }
  await deleteMissing('whatsapp_outbox', 'tenant_id', tenantId, waIds);
}

/** Persist full in-memory state to relational tables. */
export async function saveAppStateToRelationalDb(state) {
  const tenantList = Object.values(state.tenants || {});
  if (tenantList.length) {
    const { error } = await supabase.from('tenants').upsert(tenantList.map(tenantToRow));
    if (error) throw error;
  }

  await supabase.from('app_settings').upsert([
    { key: 'active_tenant_id', value: TITAN_TENANT_ID },
    { key: 'system_settings', value: state.systemSettings || DEFAULT_SYSTEM_SETTINGS },
  ]);

  for (const tenantId of Object.keys(state.tenants || {})) {
    await syncTenantEntities(state, tenantId);
  }
}

/** Seed relational DB from built-in seed state when tables are empty. */
export async function seedRelationalDbIfEmpty() {
  const count = await countGuardsInDb();
  if (count > 0) return false;
  const seed = createSeedState();
  await saveAppStateToRelationalDb(seed);
  return true;
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
