import { isValidGpsCoord } from './guards.js';

const MAX_SPEED_MPS = 55; // ~200 km/h — flag impossible jumps

export function validateGuardLocation(payload, previousCoords = null) {
  const lat = parseFloat(payload.lat);
  const lng = parseFloat(payload.lng);
  const accuracy = parseFloat(payload.accuracyMeters);
  const mock = payload.mock === true || payload.isMock === true;

  if (!isValidGpsCoord(lat, lng)) {
    return { ok: false, error: 'Invalid GPS coordinates', flags: ['invalid_coords'] };
  }
  if (mock) {
    return { ok: false, error: 'Mock location detected — disable fake GPS apps to clock in', flags: ['mock_location'] };
  }
  if (Number.isFinite(accuracy) && accuracy > 25) {
    return { ok: false, error: `GPS accuracy too poor (±${Math.round(accuracy)}m). Wait for a better fix.`, flags: ['poor_accuracy'] };
  }

  const flags = [];
  if (previousCoords?.lat != null && previousCoords?.lng != null && payload.previousAt) {
    const dt = (Date.now() - new Date(payload.previousAt).getTime()) / 1000;
    if (dt > 0 && dt < 120) {
      const dist = haversineM(previousCoords.lat, previousCoords.lng, lat, lng);
      const speed = dist / dt;
      if (speed > MAX_SPEED_MPS) {
        flags.push('teleport');
        return { ok: false, error: 'GPS jump detected — location change too fast. Try again.', flags };
      }
    }
  }

  return { ok: true, flags, coords: { lat, lng, accuracyMeters: accuracy } };
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
