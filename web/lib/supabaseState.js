import { getLocalState, processLocalAction } from './localStore';
import {
  probeRelationalDb,
  loadAppStateFromRelationalDb,
  saveAppStateToRelationalDb,
  ensureMinimalTenantInDb,
  ensurePlaceCheckpointsSynced,
  applyDirectRowDelete,
  applyDirectRowUpsert,
  usesDirectRowUpsert,
  clearTenantOperationalData,
  wipeEntireOperationalDatabase,
  purgeLegacyDemoRowsFromDb,
  isDestructiveDbAction,
  countGuardsInDb,
  getRelationalSummary,
  persistSystemSettingsToDb,
  persistTenantToDb,
} from './db/relationalDb';
import { normalizeGuardSupervisorAssignments } from './guardProfile.js';
import { syncAllPlaceCheckpoints } from './premises.js';
import {
  usesOperationalDbWrite,
  persistOperationalActionToDb,
} from './db/operationalWrites.js';
import { evaluateLicenseExpiryAlerts, evaluateShiftCompliance } from './guards';
import { runMonitoringEvaluators } from './monitoringEngine.js';
import { enrichStateWithSubscription, applyEvalSubscriptionOverrides, registerEvalPremiumSession, isLocalEvalSubscriptionMode } from './subscription.js';
import { getWhatsAppStatus } from './whatsapp';
import { getEmailStatus } from './email';
import { deliverPinNotifications } from './pinDeliveryServer';

const PROBE_TIMEOUT_MS = 8000;
const CACHE_OK_MS = 30_000;
const CACHE_FAIL_MS = 60_000;

let readyCache = { ok: null, at: 0, error: null };

function withTimeout(promise, ms = PROBE_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database request timed out')), ms);
    }),
  ]);
}

export function invalidateSupabaseCache() {
  readyCache = { ok: null, at: 0, error: null };
}

/** Load live data from Supabase into memory for this request only. */
export async function loadFreshStateFromDatabase() {
  await ensureMinimalTenantInDb();
  const state = await loadAppStateFromRelationalDb();
  for (const tenantId of Object.keys(state.tenants || {})) {
    normalizeGuardSupervisorAssignments(state, tenantId);
    syncAllPlaceCheckpoints(state, tenantId);
  }
  await ensurePlaceCheckpointsSynced(state);
  globalThis.__titanState = state;
  globalThis.__titanFreshLoadAt = Date.now();
  return state;
}

function buildAppStateResponse(state) {
  const tenantId = state.activeTenantId || 'titan';
  runMonitoringEvaluators(state, tenantId);
  return enrichStateWithSubscription({
    ...state,
    dataSource: 'supabase',
    storage: 'relational',
    whatsappStatus: getWhatsAppStatus(),
    emailStatus: getEmailStatus(),
  });
}

export function getStateSummary(state = getLocalState()) {
  return getRelationalSummary(state);
}

/** Save in-memory state to relational tables — only after loadFreshStateFromDatabase in this request. */
export async function persistStateToSupabase() {
  if (!globalThis.__titanFreshLoadAt) {
    throw new Error('Refusing to write stale server memory to the database. Reload from database first.');
  }
  await saveAppStateToRelationalDb(getLocalState());
}

/** Pull latest data from Supabase (never pushes in-memory demo/stale data). */
export async function syncLocalToSupabase() {
  invalidateSupabaseCache();
  const ready = await isSupabaseReady();
  if (!ready) {
    throw new Error(
      'Could not reach the server database. Contact your system administrator.'
    );
  }
  const state = await loadFreshStateFromDatabase();
  const summary = getRelationalSummary(state);
  readyCache = { ok: true, at: Date.now() };
  return {
    summary,
    syncedAt: new Date().toISOString(),
    storage: 'relational',
    direction: 'pull',
  };
}

export async function hydrateStateFromSupabase() {
  await loadFreshStateFromDatabase();
  return true;
}

/** When true: read live production data, but never write back to Supabase. */
export function isLocalEvalMode() {
  return process.env.LOCAL_EVAL_MODE === '1';
}

export function getLastDbProbeError() {
  return readyCache.error;
}

export async function isSupabaseReady() {
  if (process.env.FORCE_SUPABASE !== '1') return false;

  const now = Date.now();
  const ttl = readyCache.ok ? CACHE_OK_MS : CACHE_FAIL_MS;
  if (readyCache.ok !== null && now - readyCache.at < ttl) {
    return readyCache.ok;
  }

  try {
    await withTimeout(probeRelationalDb());
    readyCache = { ok: true, at: now, error: null };
    return true;
  } catch (err) {
    const message = String(err?.message || err || 'Database unavailable');
    readyCache = { ok: false, at: now, error: message };
    return false;
  }
}

export async function getDbGuardCount() {
  try {
    return await countGuardsInDb();
  } catch {
    return null;
  }
}

/** Every read loads directly from Supabase — no stale server memory. */
export async function getSupabaseAppState(adminSessionKey = null) {
  const state = await loadFreshStateFromDatabase();
  applyEvalSubscriptionOverrides(state, adminSessionKey);
  const dbGuardCount = await getDbGuardCount();
  return {
    ...buildAppStateResponse(state),
    dbGuardCount,
    localEvalMode: isLocalEvalMode(),
    dataSource: isLocalEvalMode() ? 'supabase-eval' : 'supabase',
  };
}

const READ_ONLY_ACTIONS = new Set(['GUARD_LOGIN', 'SUPERVISOR_LOGIN', 'SWITCH_TENANT']);

/** Actions that change guards/premises/etc. and need a relational write after memory update. */
const RELATIONAL_WRITE_ACTIONS = new Set([
  'CREATE_GUARD', 'UPDATE_GUARD', 'BULK_ASSIGN_GUARD_SUPERVISOR', 'AUTO_ASSIGN_GUARD_SUPERVISORS_BY_TERRITORY',
  'RESET_GUARD_PIN', 'CHANGE_GUARD_PIN',
  'CREATE_SHIFT', 'UPDATE_SHIFT',
  'CREATE_PREMISE', 'UPDATE_PREMISE', 'CREATE_PLACE', 'UPDATE_PLACE',
  'CREATE_TERRITORY', 'UPDATE_TERRITORY', 'CREATE_SUPERVISOR', 'UPDATE_SUPERVISOR', 'UPDATE_SUPERVISOR_PHOTO',
  'RESET_SUPERVISOR_PIN', 'CHANGE_SUPERVISOR_PIN',
  'GUARD_CLOCK_IN', 'GUARD_CLOCK_OUT', 'GUARD_HEARTBEAT', 'GUARD_MOVEMENT_ACK',
  'ADD_GUARD_DOCUMENT', 'ADD_GUARD_TRAINING', 'UPDATE_GUARD_PHOTO',
  'REQUEST_SHIFT_SWAP', 'RESOLVE_SHIFT_SWAP',
  'SEND_GUARD_WHATSAPP', 'RESEND_WHATSAPP', 'UPDATE_SYSTEM_SETTINGS',
  'TAP_NFC', 'LOG_INCIDENT', 'UPDATE_INCIDENT_STATUS', 'SUBMIT_CHECKLIST',
  'REGISTER_VISITOR', 'CHECKOUT_VISITOR', 'TRIGGER_SOS', 'CLEAR_SOS',
  'CREATE_TENANT', 'CREATE_CHECKLIST_TEMPLATE', 'RESET_STATE', 'ACTIVATE_PREMIUM_TOKEN',
]);

export async function runSupabaseAction(payload, adminSessionKey = null) {
  invalidateSupabaseCache();
  await loadFreshStateFromDatabase();

  const result = processLocalAction(payload);
  if (result?.error) return result;

  const tenantId = payload.tenantId || getLocalState().activeTenantId || 'titan';
  const destructive = isDestructiveDbAction(payload.action);
  const action = payload.action;

  if (action === 'ACTIVATE_PREMIUM_TOKEN' && isLocalEvalSubscriptionMode() && adminSessionKey) {
    const tenant = getLocalState().tenants?.[tenantId];
    registerEvalPremiumSession(adminSessionKey, tenantId, {
      subscriptionTier: 'premium',
      plan: 'Premium',
      premiumActivatedAt: tenant?.premiumActivatedAt || new Date().toISOString(),
      subscriptionSource: 'token',
    });
  }

  if (isLocalEvalMode()) {
    const blocked = new Set(['SYNC_LOCAL_TO_SUPABASE', 'CLEAR_TENANT_DEMO_DATA']);
    if (blocked.has(action) || destructive) {
      return {
        error: 'Local evaluation mode — this action would change production and is blocked.',
        status: 403,
      };
    }
    const mem = getLocalState();
    applyEvalSubscriptionOverrides(mem, adminSessionKey);
    const state = {
      ...buildAppStateResponse(mem),
      localEvalMode: true,
      dataSource: 'supabase-eval',
    };
    if (result?.guard) return { ...result, state, localEvalMode: true };
    if (result?.supervisor && !result?.generatedPin) return { ...result, state, localEvalMode: true };
    if (result?.generatedPin) return { ...result, state, localEvalMode: true };
    if (result?.waLink) return { ...result, state, localEvalMode: true };
    return { success: true, state, localEvalMode: true, evalNote: 'Preview only — not saved to production' };
  }

  if (action === 'CLEAR_TENANT_DEMO_DATA') {
    const wipeResult = await wipeEntireOperationalDatabase();
    await purgeLegacyDemoRowsFromDb();
    await ensureMinimalTenantInDb();
    const { whatsapp, email } = await deliverPinNotifications(result, action, tenantId);
    return {
      success: true,
      wiped: true,
      wipeMethod: wipeResult.method,
      whatsapp,
      email,
      state: await loadFreshStateFromDatabase(),
    };
  } else if (destructive) {
    await applyDirectRowDelete(action, payload, tenantId);
  } else if (usesOperationalDbWrite(action)) {
    await persistOperationalActionToDb(action, payload, tenantId, getLocalState(), result);
  } else if (action === 'UPDATE_SYSTEM_SETTINGS') {
    await persistSystemSettingsToDb(getLocalState().systemSettings);
  } else if (action === 'ACTIVATE_PREMIUM_TOKEN') {
    await persistTenantToDb(getLocalState().tenants[tenantId]);
  } else if (!READ_ONLY_ACTIONS.has(action) && RELATIONAL_WRITE_ACTIONS.has(action)) {
    if (usesDirectRowUpsert(action)) {
      await applyDirectRowUpsert(action, { ...payload, ...result }, tenantId, getLocalState());
    } else {
      await persistStateToSupabase();
    }
  }

  const { whatsapp, email } = await deliverPinNotifications(result, action, tenantId);

  globalThis.__titanFreshLoadAt = null;
  const state = await loadAppStateFromRelationalDb();
  globalThis.__titanState = state;
  globalThis.__titanFreshLoadAt = Date.now();

  const loginOnly = action === 'GUARD_LOGIN' || action === 'SUPERVISOR_LOGIN';
  const withState = (payload) => (loginOnly ? payload : { ...payload, state });

  if (result?.guard) return withState({ ...result, whatsapp, email });
  if (result?.supervisor && !result?.generatedPin) return withState({ ...result, whatsapp, email });
  if (result?.generatedPin) return { ...result, whatsapp, email, state };
  if (result?.waLink) return { ...result, whatsapp, email, state };
  return { success: true, whatsapp, email, state };
}
