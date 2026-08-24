import { getDefaultPatrolSchedule } from './patrolSchedule.js';

export function generatePremiseId() {
  return `PRM-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export function generatePlaceId() {
  return `PLC-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export function geoToCanvas(premiseCoords, placeCoords, fallbackIndex = 0) {
  if (!premiseCoords?.lat || !placeCoords?.lat) {
    const angle = (fallbackIndex / 6) * 2 * Math.PI;
    return {
      x: Math.round(280 + Math.cos(angle) * 90),
      y: Math.round(180 + Math.sin(angle) * 70),
    };
  }
  const scale = 80000;
  return {
    x: Math.round(280 + (placeCoords.lng - premiseCoords.lng) * scale),
    y: Math.round(180 - (placeCoords.lat - premiseCoords.lat) * scale),
  };
}

export function syncCheckpointFromPlace(state, tenantId, premise, place) {
  if (!place?.id || !premise?.id) return null;

  if (!state.checkpoints[tenantId]) state.checkpoints[tenantId] = [];

  const coords = geoToCanvas(premise.coordinates, place.coordinates, state.checkpoints[tenantId].length);
  const existing = state.checkpoints[tenantId].find((cp) => cp.placeId === place.id);
  const code = place.hasNfc
    ? (place.nfcCode || `NFC-${place.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`)
    : (place.nfcCode || `GPS-${place.id.slice(-6).toUpperCase()}`);
  const checkpointData = {
    id: existing?.id || `${tenantId}-cp-${place.id.slice(-6)}`,
    name: place.name,
    code,
    status: existing?.status || 'Pending',
    lastScanned: existing?.lastScanned || null,
    coords,
    coordinates: place.coordinates,
    schedule: place.schedule || getDefaultPatrolSchedule(state),
    premiseId: premise.id,
    placeId: place.id,
    premiseName: premise.name,
    hasNfc: !!place.hasNfc,
  };

  if (existing) {
    Object.assign(existing, checkpointData);
    return existing;
  }
  state.checkpoints[tenantId].push(checkpointData);
  return checkpointData;
}

/** Ensure every GPS patrol place has a matching mobile patrol checkpoint. */
export function syncAllPlaceCheckpoints(state, tenantId) {
  let synced = 0;
  for (const premise of state.premises?.[tenantId] || []) {
    for (const place of state.places?.[premise.id] || []) {
      if (syncCheckpointFromPlace(state, tenantId, premise, place)) synced += 1;
    }
  }
  return synced;
}

export function removeCheckpointForPlace(state, tenantId, placeId) {
  if (!state.checkpoints[tenantId]) return;
  state.checkpoints[tenantId] = state.checkpoints[tenantId].filter((cp) => cp.placeId !== placeId);
}
