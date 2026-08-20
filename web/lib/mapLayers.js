import { isValidGpsCoord } from './guards.js';

/** Free basemaps — no API keys required. */
export const BASEMAPS = {
  streets: {
    id: 'streets',
    label: 'Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  light: {
    id: 'light',
    label: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OSM &copy; CARTO',
    maxZoom: 20,
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OSM &copy; CARTO',
    maxZoom: 20,
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  },
  terrain: {
    id: 'terrain',
    label: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap (&copy; OSM)',
    maxZoom: 17,
  },
};

export const DEFAULT_MAP_CENTER = [-17.8292, 31.0522];
export const DEFAULT_MAP_ZOOM = 12;

export const DEFAULT_LAYER_VISIBILITY = {
  premises: true,
  geofences: true,
  places: true,
  checkpoints: true,
  guards: true,
  trails: true,
  alerts: true,
  activity: true,
  territories: true,
};

export function coordsFrom(obj) {
  if (!obj) return null;
  const lat = obj.lat ?? obj.latitude;
  const lng = obj.lng ?? obj.longitude;
  return isValidGpsCoord(lat, lng) ? { lat: Number(lat), lng: Number(lng) } : null;
}

export function guardByNameOrId(guards, { guardId, guardName }) {
  if (guardId) return guards.find((g) => g.id === guardId) || null;
  if (guardName) return guards.find((g) => g.fullName === guardName) || null;
  return null;
}

export function resolveGuardPosition(guardId, attendance) {
  const att = attendance.find(
    (a) => a.guardId === guardId && (a.status === 'On Duty' || a.status === 'Late')
  );
  return coordsFrom(att?.lastCoords) || coordsFrom(att?.clockInCoords);
}

export function resolvePremiseCoords(premiseId, premises) {
  const p = premises.find((x) => x.id === premiseId);
  return coordsFrom(p?.coordinates);
}

export function resolveAlertCoords(alert, { attendance, premises, guards }) {
  const live = resolveGuardPosition(alert.guardId, attendance);
  if (live) return live;
  if (alert.premiseId) return resolvePremiseCoords(alert.premiseId, premises);
  const guard = guards.find((g) => g.id === alert.guardId);
  const assigned = guard?.assignedPremiseIds?.[0];
  if (assigned) return resolvePremiseCoords(assigned, premises);
  return null;
}

export function resolveObEventCoords(ob, { guards, attendance, premises, checkpoints }) {
  if (ob.type === 'Patrol Tap' && checkpoints?.length) {
    const cp = checkpoints.find(
      (c) => c.name && ob.description?.includes(c.name)
    );
    const cpCoords = coordsFrom(c.coordinates);
    if (cpCoords) return cpCoords;
  }

  const guard = guardByNameOrId(guards, ob);
  if (!guard) return null;

  const live = resolveGuardPosition(guard.id, attendance);
  if (live) return live;

  const att = attendance.find((a) => a.guardId === guard.id);
  const premiseId = att?.premiseId || guard.assignedPremiseIds?.[0];
  return resolvePremiseCoords(premiseId, premises);
}

export function parseSosCoords(activeSos, attendance, guards) {
  if (!activeSos?.active) return null;
  const msg = activeSos.message || '';
  const match = msg.match(/Location:\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (isValidGpsCoord(lat, lng)) return { lat, lng };
  }
  if (activeSos.guardId) {
    return resolveGuardPosition(activeSos.guardId, attendance);
  }
  const guard = guardByNameOrId(guards, activeSos);
  if (guard) return resolveGuardPosition(guard.id, attendance);
  return null;
}

export function territoryBounds(territoryId, premises) {
  const pts = premises
    .filter((p) => p.territoryId === territoryId)
    .map((p) => coordsFrom(p.coordinates))
    .filter(Boolean);
  if (pts.length === 0) return null;
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  return {
    south: Math.min(...lats),
    north: Math.max(...lats),
    west: Math.min(...lngs),
    east: Math.max(...lngs),
    center: {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    },
  };
}

export function activityColor(type) {
  switch (type) {
    case 'SOS Panic Alarm': return '#dc2626';
    case 'Patrol Tap': return '#2563eb';
    case 'Shift Clock-In': return '#16a34a';
    case 'Shift Clock-Out': return '#64748b';
    default: return '#7c3aed';
  }
}

export function countMapStats({
  premises = [],
  places = {},
  checkpoints = [],
  attendance = [],
  guardAlerts = [],
  occurrenceBook = [],
  activeSos,
}) {
  const mappedPremises = premises.filter((p) => isValidGpsCoord(p.coordinates?.lat, p.coordinates?.lng));
  let placeCount = 0;
  mappedPremises.forEach((p) => {
    placeCount += (places[p.id] || []).filter((pl) => isValidGpsCoord(pl.coordinates?.lat, pl.coordinates?.lng)).length;
  });
  const gpsCheckpoints = checkpoints.filter((c) => isValidGpsCoord(c.coordinates?.lat, c.coordinates?.lng));
  const onDuty = attendance.filter((a) => a.status === 'On Duty' || a.status === 'Late');
  const activeAlerts = guardAlerts.filter((a) => a.status === 'Active');
  const recentActivity = occurrenceBook.filter((ob) => {
    const age = Date.now() - new Date(ob.timestamp).getTime();
    return age < 24 * 60 * 60 * 1000;
  });

  return {
    premises: mappedPremises.length,
    places: placeCount,
    checkpoints: gpsCheckpoints.length,
    onDuty: onDuty.length,
    alerts: activeAlerts.length,
    activity: recentActivity.length,
    sos: activeSos?.active ? 1 : 0,
  };
}
