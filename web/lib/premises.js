export function generatePremiseId() {
  return `PRM-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export function generatePlaceId() {
  return `PLC-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export function geoToCanvas(premiseCoords, placeCoords, fallbackIndex = 0) {
  if (!premiseCoords?.lat || !placeCoords?.lat) {
    const angle = (fallbackIndex / 6) * 2 * Math.PI;
    return { x: 280 + Math.cos(angle) * 90, y: 180 + Math.sin(angle) * 70 };
  }
  const scale = 80000;
  return {
    x: Math.round(280 + (placeCoords.lng - premiseCoords.lng) * scale),
    y: Math.round(180 - (placeCoords.lat - premiseCoords.lat) * scale),
  };
}

export function syncCheckpointFromPlace(state, tenantId, premise, place) {
  if (!place.hasNfc) return;

  if (!state.checkpoints[tenantId]) state.checkpoints[tenantId] = [];

  const coords = geoToCanvas(premise.coordinates, place.coordinates, state.checkpoints[tenantId].length);
  const existing = state.checkpoints[tenantId].find((cp) => cp.placeId === place.id);
  const checkpointData = {
    id: existing?.id || `${tenantId}-cp-${place.id.slice(-6)}`,
    name: place.name,
    code: place.nfcCode,
    status: existing?.status || 'Pending',
    lastScanned: existing?.lastScanned || null,
    coords,
    coordinates: place.coordinates,
    schedule: place.schedule || 'Every 2 hours',
    premiseId: premise.id,
    placeId: place.id,
    premiseName: premise.name,
  };

  if (existing) {
    Object.assign(existing, checkpointData);
  } else {
    state.checkpoints[tenantId].push(checkpointData);
  }
}

export function removeCheckpointForPlace(state, tenantId, placeId) {
  if (!state.checkpoints[tenantId]) return;
  state.checkpoints[tenantId] = state.checkpoints[tenantId].filter((cp) => cp.placeId !== placeId);
}
