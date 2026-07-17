import { NextResponse } from 'next/server';
import { supabase } from '../../supabase';
import { getLocalState, getLocalStateWithMonitoring, processLocalAction } from '../../../lib/localStore';
import { getSupabaseAppState, runSupabaseAction, isSupabaseReady, syncLocalToSupabase, getStateSummary, persistStateToSupabase, hydrateStateFromSupabase, loadFreshStateFromDatabase } from '../../../lib/supabaseState';
import { applyDirectRowDelete, wipeEntireOperationalDatabase, isDestructiveDbAction, ensureMinimalTenantInDb } from '../../../lib/db/relationalDb';
import { getWhatsAppStatus } from '../../../lib/whatsapp';
import { getEmailStatus } from '../../../lib/email';
import { deliverPinNotifications } from '../../../lib/pinDeliveryServer';
import { sanitizeStateForClient, shouldIncludePinsForRequest } from '../../../lib/stateSanitize';
import { filterStateForSupervisor, assertSupervisorMutationAllowed } from '../../../lib/supervisorScope';
import { authorizeStateMutation, getSessionFromRequest } from '../../../lib/webAuth';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
  };
}

function jsonResponse(data, status = 200, origin, req, session = null) {
  let payload = data;
  if (req && data && typeof data === 'object') {
    const includePins = shouldIncludePinsForRequest(req, session);
    if (data.state) {
      payload = {
        ...data,
        state: sanitizeStateForClient(data.state, { includeGuardPins: includePins, includeSupervisorPins: includePins }),
      };
    } else if (data.guards || data.premises || data.tenants || data.supervisors) {
      payload = sanitizeStateForClient(data, { includeGuardPins: includePins, includeSupervisorPins: includePins });
    }
  }
  return NextResponse.json(payload, {
    status,
    headers: { ...CACHE_HEADERS, ...corsHeaders(origin) },
  });
}

let supabaseAvailable = false;
let supabaseChecked = false;
const SUPABASE_PROBE_MS = 2000;

function withProbeTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Supabase probe timed out')), SUPABASE_PROBE_MS);
    }),
  ]);
}

async function checkSupabase() {
  if (supabaseChecked) return supabaseAvailable;
  supabaseChecked = true;
  if (process.env.FORCE_SUPABASE !== '1') {
    supabaseAvailable = false;
    return false;
  }
  try {
    const { error } = await withProbeTimeout(supabase.from('tenants').select('id').limit(1));
    supabaseAvailable = !error;
  } catch {
    supabaseAvailable = false;
  }
  return supabaseAvailable;
}

async function fetchFromSupabase() {
  const { data: tenantsData, error: tenantsErr } = await supabase.from('tenants').select('*');
  if (tenantsErr) throw tenantsErr;

  const tenantsMap = {};
  tenantsData.forEach((t) => {
    tenantsMap[t.id] = {
      id: t.id,
      name: t.name,
      primaryColor: t.primary_color,
      logoText: t.logo_text,
      plan: t.plan,
      status: t.status,
    };
  });

  const { data: checkpointsData, error: checkpointsErr } = await supabase.from('checkpoints').select('*');
  if (checkpointsErr) throw checkpointsErr;

  const checkpointsMap = {};
  checkpointsData.forEach((cp) => {
    if (!checkpointsMap[cp.tenant_id]) checkpointsMap[cp.tenant_id] = [];
    checkpointsMap[cp.tenant_id].push({
      id: cp.id,
      name: cp.name,
      code: cp.code,
      status: cp.status,
      lastScanned: cp.last_scanned,
      coords: { x: cp.coords_x, y: cp.coords_y },
      schedule: cp.schedule,
    });
  });

  const { data: obData, error: obErr } = await supabase
    .from('occurrence_book')
    .select('*')
    .order('timestamp', { ascending: false });
  if (obErr) throw obErr;

  const obList = obData.map((item) => ({
    id: item.id,
    tenantId: item.tenant_id,
    timestamp: item.timestamp,
    guardName: item.guard_name,
    type: item.type,
    description: item.description,
    status: item.status,
    attachments: { photo: item.photo_url, voice: item.voice_url },
  }));

  const { data: templatesData, error: templatesErr } = await supabase.from('checklist_templates').select('*');
  if (templatesErr) throw templatesErr;

  const templatesMap = {};
  templatesData.forEach((temp) => {
    if (!templatesMap[temp.tenant_id]) templatesMap[temp.tenant_id] = [];
    templatesMap[temp.tenant_id].push({
      id: temp.id,
      name: temp.name,
      description: temp.description,
      fields: temp.fields,
    });
  });

  const { data: subsData, error: subsErr } = await supabase
    .from('checklist_submissions')
    .select('*')
    .order('timestamp', { ascending: false });
  if (subsErr) throw subsErr;

  const submissionsList = subsData.map((sub) => ({
    id: sub.id,
    tenantId: sub.tenant_id,
    templateId: sub.template_id,
    templateName: sub.template_name,
    timestamp: sub.timestamp,
    guardName: sub.guard_name,
    values: sub.values,
  }));

  const { data: visitorsData, error: visitorsErr } = await supabase
    .from('visitors')
    .select('*')
    .order('check_in_time', { ascending: false });
  if (visitorsErr) throw visitorsErr;

  const visitorsList = visitorsData.map((v) => ({
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

  const { data: sosData, error: sosErr } = await supabase.from('active_sos_alerts').select('*');
  if (sosErr) throw sosErr;

  const sosMap = {};
  sosData.forEach((alert) => {
    sosMap[alert.tenant_id] = {
      active: true,
      guardName: alert.guard_name,
      timestamp: alert.timestamp,
      message: alert.message,
    };
  });

  const localState = getLocalState();

  return {
    activeTenantId: localState.activeTenantId || tenantsData[0]?.id || 'titan',
    dataSource: 'supabase',
    tenants: tenantsMap,
    checkpoints: checkpointsMap,
    occurrenceBook: obList,
    checklistTemplates: templatesMap,
    checklistSubmissions: submissionsList,
    visitors: visitorsList,
    activeSosAlerts: sosMap,
  };
}

export async function OPTIONS(req) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(req) {
  const origin = req.headers.get('origin');
  const url = new URL(req.url);
  const client = url.searchParams.get('client');
  let supervisorId = url.searchParams.get('supervisorId');
  const tenantId = url.searchParams.get('tenantId') || 'titan';
  const session = await getSessionFromRequest(req);

  if (client === 'web' && session?.role !== 'admin') {
    return jsonResponse({ error: 'Master Admin sign-in required' }, 401, origin, req, session);
  }

  if (client === 'supervisor') {
    if (session?.role === 'supervisor') {
      supervisorId = session.supervisorId;
    } else if (!supervisorId) {
      return jsonResponse({ error: 'Supervisor sign-in required' }, 401, origin, req, session);
    }
  }

  const scopeSupervisor = client === 'supervisor' && supervisorId;

  try {
    if (process.env.FORCE_SUPABASE === '1') {
      if (await isSupabaseReady()) {
        let state = await getSupabaseAppState();
        if (scopeSupervisor) {
          const scoped = filterStateForSupervisor(state, tenantId, supervisorId);
          if (!scoped) {
            return jsonResponse({ error: 'Supervisor not found' }, 404, origin, req, session);
          }
          state = { ...scoped, dataSource: state.dataSource };
        }
        return jsonResponse(state, 200, origin, req, session);
      }
      return jsonResponse(
        { error: 'Database unavailable. Cannot load live data.' },
        503,
        origin,
        req,
        session
      );
    } else if (await checkSupabase()) {
      let state = await fetchFromSupabase();
      if (scopeSupervisor) {
        const scoped = filterStateForSupervisor(state, tenantId, supervisorId);
        if (!scoped) {
          return jsonResponse({ error: 'Supervisor not found' }, 404, origin, req, session);
        }
        state = { ...scoped, dataSource: state.dataSource };
      }
      return jsonResponse(state, 200, origin, req, session);
    }
  } catch (err) {
    console.warn('Supabase unavailable, using local store:', err.message);
  }

  const state = {
    ...getLocalStateWithMonitoring(),
    dataSource: 'local',
    whatsappStatus: getWhatsAppStatus(),
    emailStatus: getEmailStatus(),
  };
  if (scopeSupervisor) {
    const scoped = filterStateForSupervisor(state, tenantId, supervisorId);
    if (!scoped) {
      return jsonResponse({ error: 'Supervisor not found' }, 404, origin, req, session);
    }
    return jsonResponse({ ...scoped, dataSource: 'local' }, 200, origin, req, session);
  }
  return jsonResponse(state, 200, origin, req, session);
}

export async function POST(req) {
  const origin = req.headers.get('origin');

  try {
    const payload = await req.json();
    const { action, tenantId: payloadTenantId } = payload;
    const localState = getLocalState();
    const tenantId = payloadTenantId || localState.activeTenantId;

    const auth = await authorizeStateMutation(req, action, payload, localState, tenantId);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error }, auth.status || 401, origin, req);
    }
    const effectivePayload = auth.payload;

    if (
      effectivePayload.supervisorId &&
      action !== 'SUPERVISOR_LOGIN' &&
      action !== 'CHANGE_SUPERVISOR_PIN' &&
      auth.session?.role !== 'admin'
    ) {
      const scopeErr = assertSupervisorMutationAllowed(action, effectivePayload, localState, tenantId);
      if (scopeErr) {
        return jsonResponse({ error: scopeErr.error }, scopeErr.status || 403, origin, req);
      }
    }

    if (action === 'SYNC_LOCAL_TO_SUPABASE') {
      try {
        const result = await syncLocalToSupabase();
        return jsonResponse(
          {
            success: true,
            dataSource: 'supabase',
            message: 'All data saved to the server (guards, premises, territories, supervisors, shifts).',
            ...result,
          },
          200,
          origin
        );
      } catch (err) {
        console.error('Supabase sync failed:', err.message);
        return jsonResponse(
          {
            error: err.message,
            summary: getStateSummary(),
            hint: 'Could not reach the server database. Contact your system administrator.',
          },
          500,
          origin
        );
      }
    }

    if (await isSupabaseReady()) {
      try {
        const result = await runSupabaseAction({ ...effectivePayload, tenantId });
        if (result?.error) {
          return jsonResponse({ error: result.error }, result.status || 400, origin);
        }
        return jsonResponse(result, 200, origin, req);
      } catch (err) {
        console.error('Supabase action failed:', err.message);
        if (process.env.FORCE_SUPABASE === '1') {
          return jsonResponse(
            {
              error: `Could not save to database: ${err.message}. Nothing was deleted — please retry.`,
            },
            503,
            origin,
            req
          );
        }
        console.warn('Supabase action failed, using local store:', err.message);
      }
    }

    if (await checkSupabase()) {
      switch (action) {
        case 'TAP_NFC': {
          const { checkpointId, guardName = 'Officer John Dube' } = payload;
          const { data: cp, error: cpErr } = await supabase
            .from('checkpoints')
            .update({ status: 'Scanned', last_scanned: new Date().toISOString() })
            .eq('id', checkpointId)
            .select()
            .single();
          if (cpErr) throw cpErr;
          if (cp) {
            await supabase.from('occurrence_book').insert({
              id: `ob-nfc-${Date.now()}`,
              tenant_id: tenantId,
              timestamp: new Date().toISOString(),
              guard_name: guardName,
              type: 'Patrol Tap',
              description: `Check-in recorded at checkpoint: ${cp.name} (${cp.code}). Geofence verified.`,
              status: 'Resolved',
            });
          }
          break;
        }
        case 'LOG_INCIDENT': {
          const { guardName = 'Officer John Dube', type, description, photo = null, voice = null } = payload;
          await supabase.from('occurrence_book').insert({
            id: `ob-inc-${Date.now()}`,
            tenant_id: tenantId,
            timestamp: new Date().toISOString(),
            guard_name: guardName,
            type,
            description,
            status: 'Unassigned',
            photo_url: photo,
            voice_url: voice,
          });
          break;
        }
        case 'UPDATE_INCIDENT_STATUS': {
          const { incidentId, status } = payload;
          await supabase.from('occurrence_book').update({ status }).eq('id', incidentId);
          break;
        }
        case 'SUBMIT_CHECKLIST': {
          const { templateId, templateName, guardName = 'Officer John Dube', values } = payload;
          await supabase.from('checklist_submissions').insert({
            id: `sub-${Date.now()}`,
            tenant_id: tenantId,
            template_id: templateId,
            template_name: templateName,
            guard_name: guardName,
            values,
          });
          await supabase.from('occurrence_book').insert({
            id: `ob-chk-${Date.now()}`,
            tenant_id: tenantId,
            timestamp: new Date().toISOString(),
            guard_name: guardName,
            type: 'Checklist Submission',
            description: `Completed inspection checklist: "${templateName}" with compliance verification.`,
            status: 'Resolved',
          });
          break;
        }
        case 'REGISTER_VISITOR': {
          const { name, idNumber, company, vehiclePlate } = payload;
          await supabase.from('visitors').insert({
            id: `v-${Date.now()}`,
            tenant_id: tenantId,
            name,
            id_number: idNumber,
            company,
            vehicle_plate: vehiclePlate || 'N/A',
            check_in_time: new Date().toISOString(),
            status: 'Active',
          });
          break;
        }
        case 'CHECKOUT_VISITOR': {
          const { visitorId } = payload;
          await supabase.from('visitors').update({
            status: 'Checked Out',
            check_out_time: new Date().toISOString(),
          }).eq('id', visitorId);
          break;
        }
        case 'TRIGGER_SOS': {
          const { guardName = 'Officer John Dube', alertMessage = 'SOS Panic Triggered!' } = payload;
          await supabase.from('active_sos_alerts').upsert({
            tenant_id: tenantId,
            guard_name: guardName,
            timestamp: new Date().toISOString(),
            message: alertMessage,
          });
          await supabase.from('occurrence_book').insert({
            id: `ob-sos-${Date.now()}`,
            tenant_id: tenantId,
            timestamp: new Date().toISOString(),
            guard_name: guardName,
            type: 'SOS Panic Alarm',
            description: `EMERGENCY PANIC SIGNAL received from guard device: "${alertMessage}". Dispatching support units.`,
            status: 'Investigating',
          });
          break;
        }
        case 'CLEAR_SOS':
          await supabase.from('active_sos_alerts').delete().eq('tenant_id', tenantId);
          break;
        case 'CREATE_TENANT': {
          const { name, primaryColor } = payload;
          const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (id) {
            await supabase.from('tenants').insert({
              id,
              name,
              primary_color: primaryColor,
              logo_text: name.substring(0, 2).toUpperCase(),
              plan: 'Growth Trial',
              status: 'Active',
            });
            await supabase.from('checkpoints').insert({
              id: `${id}-cp1`,
              tenant_id: id,
              name: 'Reception Desk',
              code: `NFC-${id.toUpperCase()}-01`,
              status: 'Pending',
              coords_x: 250,
              coords_y: 250,
              schedule: 'Every 2 hours',
            });
          }
          break;
        }
        case 'CREATE_CHECKLIST_TEMPLATE': {
          const { name, description, fields } = payload;
          await supabase.from('checklist_templates').insert({
            id: `temp-${Date.now()}`,
            tenant_id: tenantId,
            name,
            description,
            fields,
          });
          break;
        }
        case 'RESET_STATE':
          await supabase.from('checkpoints').update({ status: 'Pending', last_scanned: null }).eq('tenant_id', tenantId);
          await supabase.from('active_sos_alerts').delete().eq('tenant_id', tenantId);
          break;
        case 'SWITCH_TENANT': {
          localState.activeTenantId = 'titan';
          break;
        }
        default:
          return jsonResponse({ error: 'Unknown Action type' }, 400, origin);
      }
      return jsonResponse({ success: true }, 200, origin);
    }

    const result = processLocalAction({ ...effectivePayload, tenantId });
    if (result.error) {
      return jsonResponse({ error: result.error }, result.status || 400, origin);
    }
    const { whatsapp, email } = await deliverPinNotifications(result, effectivePayload.action, tenantId);
    if (result.guard || result.generatedPin) {
      return jsonResponse({ ...result, whatsapp, email }, 200, origin, req);
    }
    return jsonResponse({ ...result, whatsapp, email, state: getLocalState() }, 200, origin, req);
  } catch (err) {
    console.error('POST api state error:', err);
    return jsonResponse({ error: err.message }, 500, origin);
  }
}
