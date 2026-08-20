/** Ensure API state always has arrays/objects the dashboard expects — prevents render crashes. */
export function normalizeClientState(state) {
  if (!state || typeof state !== 'object') return null;

  return {
    ...state,
    activeTenantId: state.activeTenantId || 'titan',
    systemSettings: state.systemSettings || {},
    tenants: state.tenants || {},
    territories: state.territories || {},
    supervisors: state.supervisors || {},
    premises: state.premises || {},
    places: state.places || {},
    guards: state.guards || {},
    shifts: state.shifts || {},
    attendance: state.attendance || {},
    checkpoints: state.checkpoints || {},
    guardAlerts: state.guardAlerts || {},
    shiftSwapRequests: state.shiftSwapRequests || {},
    whatsappOutbox: state.whatsappOutbox || {},
    checklistTemplates: state.checklistTemplates || {},
    activeSosAlerts: state.activeSosAlerts || {},
    occurrenceBook: Array.isArray(state.occurrenceBook) ? state.occurrenceBook : [],
    visitors: Array.isArray(state.visitors) ? state.visitors : [],
    checklistSubmissions: Array.isArray(state.checklistSubmissions) ? state.checklistSubmissions : [],
  };
}
