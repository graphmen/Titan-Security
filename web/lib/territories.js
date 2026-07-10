export function generateTerritoryId() {
  return `TER-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

export function generateSuburbId() {
  return `SUB-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 3).toUpperCase()}`;
}

export function generateSupervisorId() {
  return `SUP-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

export function getTerritoryName(state, tenantId, territoryId) {
  const list = state.territories?.[tenantId] || [];
  return list.find((t) => t.id === territoryId)?.name || territoryId || 'Unassigned';
}

export function getSuburbsForTerritory(state, tenantId, territoryId) {
  const territory = (state.territories?.[tenantId] || []).find((t) => t.id === territoryId);
  return territory?.suburbs || [];
}
