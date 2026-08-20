import { isValidGpsCoord } from './guards.js';
import { coordsFrom, resolveObEventCoords } from './mapLayers.js';

export const ACTIVITY_WINDOWS = [
  { id: '4h', label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { id: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
];

export const LAYER_PRESETS = {
  operations: {
    label: 'Operations',
    layers: {
      premises: true, geofences: true, guards: true, trails: true, alerts: true,
      places: false, checkpoints: false, activity: false, territories: false,
      patrolRoutes: false, heatmap: false, shiftRoster: false, gpsQuality: true,
    },
  },
  patrol: {
    label: 'Patrol',
    layers: {
      premises: true, geofences: false, guards: false, trails: false, alerts: false,
      places: true, checkpoints: false, activity: false, territories: false,
      patrolRoutes: false, heatmap: false, shiftRoster: false, gpsQuality: false,
    },
  },
  emergency: {
    label: 'Emergency',
    layers: {
      premises: true, geofences: true, guards: true, trails: true, alerts: true,
      places: false, checkpoints: false, activity: true, territories: false,
      patrolRoutes: false, heatmap: true, shiftRoster: false, gpsQuality: false,
    },
  },
  overview: {
    label: 'Overview',
    layers: {
      premises: true, geofences: false, guards: false, trails: false, alerts: false,
      places: true, checkpoints: false, activity: false, territories: false,
      patrolRoutes: false, heatmap: false, shiftRoster: false, gpsQuality: false,
    },
  },
};

export const EXTENDED_DEFAULT_LAYERS = {
  premises: true,
  geofences: false,
  places: true,
  checkpoints: false,
  guards: false,
  trails: false,
  alerts: false,
  activity: false,
  territories: false,
  patrolRoutes: false,
  heatmap: false,
  shiftRoster: false,
  gpsQuality: false,
};

const STALE_GPS_MS = 12 * 60 * 1000;

export function haversineMeters(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function guardStatusStyle(att) {
  if (att.geofenceViolation) {
    return { fill: '#b91c1c', stroke: '#fca5a5', label: '!', pulse: true, status: 'Outside geofence' };
  }
  if (att.needsMovementAck) {
    return { fill: '#b45309', stroke: '#fcd34d', label: '?', pulse: true, status: 'Movement check' };
  }
  if (att.status === 'Late' || (att.lateMinutes && att.lateMinutes > 5)) {
    return { fill: '#c2410c', stroke: '#fdba74', label: 'L', pulse: false, status: 'Late' };
  }
  if (isStaleGuardGps(att)) {
    return { fill: '#475569', stroke: '#94a3b8', label: 'G', pulse: false, status: 'Stale GPS' };
  }
  return { fill: '#1e40af', stroke: '#60a5fa', label: 'G', pulse: false, status: 'On duty' };
}

export function isStaleGuardGps(att) {
  const ts = att.lastMovementAt || att.lastHeartbeat || att.clockIn;
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() > STALE_GPS_MS;
}

export function gpsQualityLevel(premise) {
  const acc = Number(premise?.coordinates?.accuracyMeters);
  if (!isValidGpsCoord(premise?.coordinates?.lat, premise?.coordinates?.lng)) {
    return { level: 'none', color: '#64748b', label: 'No GPS' };
  }
  if (!acc || acc > 10) return { level: 'poor', color: '#f59e0b', label: `±${acc || '?'}m` };
  return { level: 'good', color: '#22c55e', label: `±${acc}m` };
}

export function checkpointDisplayStatus(cp) {
  if (cp.status === 'Scanned') return { tone: 'ok', label: 'Scanned', color: '#16a34a' };
  const schedule = cp.schedule || '';
  if (/hour/i.test(schedule) && cp.lastScanned) {
    const hours = parseInt(schedule, 10) || 2;
    const elapsed = Date.now() - new Date(cp.lastScanned).getTime();
    if (elapsed > hours * 60 * 60 * 1000) {
      return { tone: 'overdue', label: 'Overdue', color: '#dc2626' };
    }
  }
  return { tone: 'pending', label: cp.status || 'Pending', color: '#2563eb' };
}

/** Places are keyed by premise id; tolerate corrupted non-array values from the API. */
export function placesForPremise(places, premiseId) {
  const list = places?.[premiseId];
  return Array.isArray(list) ? list : [];
}

export function buildPatrolRoutes(places = {}) {
  const routes = [];
  Object.entries(places || {}).forEach(([premiseId, list]) => {
    const pts = (Array.isArray(list) ? list : [])
      .map((p) => ({ ...p, coords: coordsFrom(p.coordinates) }))
      .filter((p) => p.coords);
    if (pts.length < 2) return;
    routes.push({
      premiseId,
      points: pts.map((p) => [p.coords.lat, p.coords.lng]),
      names: pts.map((p) => p.name),
    });
  });
  return routes;
}

export function filterActivityByWindow(occurrenceBook, windowMs) {
  const cutoff = Date.now() - windowMs;
  return (occurrenceBook || []).filter((ob) => new Date(ob.timestamp).getTime() >= cutoff);
}

/** Grid-based heat intensity from resolved event points and trails. */
export function buildHeatmapCells(eventPoints, attendance, cellDeg = 0.002) {
  const counts = new Map();
  const add = (lat, lng, weight = 1) => {
    if (!isValidGpsCoord(lat, lng)) return;
    const key = `${Math.round(lat / cellDeg)}:${Math.round(lng / cellDeg)}`;
    counts.set(key, (counts.get(key) || 0) + weight);
  };

  (eventPoints || []).forEach((pt) => add(pt.lat, pt.lng, 2));
  (attendance || []).forEach((att) => {
    (att.movementTrail || []).forEach((pt) => add(pt.lat, pt.lng, 0.5));
  });

  const max = Math.max(1, ...counts.values());
  return [...counts.entries()].map(([key, count]) => {
    const [rLat, rLng] = key.split(':').map(Number);
    return {
      lat: rLat * cellDeg,
      lng: rLng * cellDeg,
      intensity: count / max,
      count,
    };
  });
}

export function resolveHeatmapEvents(occurrenceBook, ctx, windowMs) {
  return filterActivityByWindow(occurrenceBook, windowMs)
    .map((ob) => {
      const c = resolveObEventCoords(ob, ctx);
      if (!c) return null;
      return { ...ob, _mapLat: c.lat, _mapLng: c.lng };
    })
    .filter(Boolean);
}

export function buildSearchIndex({ premises, guards, places, checkpoints, territories }) {
  const items = [];
  (premises || []).forEach((p) => {
    const c = coordsFrom(p.coordinates);
    if (!c) return;
    items.push({ type: 'Site', label: p.name, sub: p.address || p.city, coords: c, id: p.id });
  });
  (guards || []).forEach((g) => {
    items.push({ type: 'Guard', label: g.fullName, sub: g.phone || g.employeeNumber, coords: null, id: g.id, guardId: g.id });
  });
  Object.entries(places || {}).forEach(([premiseId, list]) => {
    (Array.isArray(list) ? list : []).forEach((pl) => {
      const c = coordsFrom(pl.coordinates);
      if (!c) return;
      items.push({ type: 'Place', label: pl.name, sub: pl.type, coords: c, id: pl.id });
    });
  });
  (checkpoints || []).forEach((cp) => {
    const c = coordsFrom(cp.coordinates);
    if (!c) return;
    items.push({ type: 'NFC', label: cp.name, sub: cp.code, coords: c, id: cp.id });
  });
  (territories || []).forEach((t) => {
    items.push({ type: 'Territory', label: t.name, sub: t.city, coords: null, id: t.id, territoryId: t.id });
  });
  return items;
}

export function filterSearchIndex(items, query, limit = 12) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return items
    .filter((it) => `${it.label} ${it.sub || ''} ${it.type}`.toLowerCase().includes(q))
    .slice(0, limit);
}

export function todayShifts(shifts = []) {
  const today = new Date().toISOString().slice(0, 10);
  return shifts.filter((s) => s.date === today || (s.date && String(s.date).startsWith(today)));
}

export function territoryStats(territoryId, { premises, attendance, guardAlerts }) {
  const sites = premises.filter((p) => p.territoryId === territoryId);
  const siteIds = new Set(sites.map((s) => s.id));
  const onDuty = attendance.filter(
    (a) => siteIds.has(a.premiseId) && (a.status === 'On Duty' || a.status === 'Late')
  ).length;
  const alerts = guardAlerts.filter((a) => a.status === 'Active' && siteIds.has(a.premiseId)).length;
  return { sites: sites.length, onDuty, alerts };
}

export function formatMeasureDistance(meters) {
  if (meters == null) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function enrichedPremisePopupLines(premise, {
  territory,
  onDutyAttendance,
  placeCount,
  geofenceRadiusMeters,
  guardAlerts,
  shiftsToday,
  guards,
}) {
  const gq = gpsQualityLevel(premise);
  const openAlerts = guardAlerts.filter((a) => a.premiseId === premise.id && a.status === 'Active');
  const scheduled = shiftsToday.filter((s) => s.premiseId === premise.id);

  const lines = [
    premise.address,
    [premise.suburb, premise.city].filter(Boolean).join(', ') || null,
    territory ? `Territory: ${territory.name}` : 'Territory: unassigned',
    `GPS: ${gq.label}`,
    `${onDutyAttendance.length} guard(s) on duty · ${placeCount} patrol place(s)`,
    `Geofence: ${geofenceRadiusMeters}m`,
  ];

  if (premise.ownerName) lines.push(`Client: ${premise.ownerName}`);
  if (premise.ownerContact) lines.push(`Contact: ${premise.ownerContact}`);
  if (openAlerts.length) lines.push(`⚠ ${openAlerts.length} active alert(s)`);
  scheduled.slice(0, 3).forEach((s) => {
    const g = guards.find((x) => x.id === s.guardId);
    lines.push(`Scheduled: ${g?.fullName || 'Guard'} ${s.startTime || ''}–${s.endTime || ''}`);
  });
  return lines.filter(Boolean);
}
