import { normalizeTenantCollections } from './safeData.js';

function normalizePlaces(places) {
  if (!places || typeof places !== 'object' || Array.isArray(places)) return {};
  const out = {};
  for (const [premiseId, list] of Object.entries(places)) {
    out[premiseId] = Array.isArray(list) ? list : [];
  }
  return out;
}

/** Ensure API state always has arrays/objects the dashboard expects — prevents render crashes. */
export function normalizeClientState(state) {
  if (!state || typeof state !== 'object') return null;

  return {
    ...state,
    activeTenantId: state.activeTenantId || 'titan',
    systemSettings: state.systemSettings || {},
    tenants: state.tenants || {},
    territories: normalizeTenantCollections(state.territories),
    supervisors: normalizeTenantCollections(state.supervisors),
    premises: normalizeTenantCollections(state.premises),
    places: normalizePlaces(state.places),
    guards: normalizeTenantCollections(state.guards),
    shifts: normalizeTenantCollections(state.shifts),
    attendance: normalizeTenantCollections(state.attendance),
    checkpoints: normalizeTenantCollections(state.checkpoints),
    guardAlerts: normalizeTenantCollections(state.guardAlerts),
    shiftSwapRequests: normalizeTenantCollections(state.shiftSwapRequests),
    whatsappOutbox: normalizeTenantCollections(state.whatsappOutbox),
    checklistTemplates: normalizeTenantCollections(state.checklistTemplates),
    activeSosAlerts: state.activeSosAlerts || {},
    occurrenceBook: Array.isArray(state.occurrenceBook) ? state.occurrenceBook : [],
    visitors: Array.isArray(state.visitors) ? state.visitors : [],
    checklistSubmissions: Array.isArray(state.checklistSubmissions) ? state.checklistSubmissions : [],
  };
}
