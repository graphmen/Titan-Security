export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Bearing from current position to target (0° = north, clockwise). */
export function bearingDegrees(fromLat, fromLng, toLat, toLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => ((r * 180) / Math.PI + 360) % 360;
  const dLng = toRad(toLng - fromLng);
  const y = Math.sin(dLng) * Math.cos(toRad(toLat));
  const x =
    Math.cos(toRad(fromLat)) * Math.sin(toRad(toLat)) -
    Math.sin(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.cos(dLng);
  return toDeg(Math.atan2(y, x));
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function compassDirection(degrees) {
  return COMPASS[Math.round(Number(degrees) / 45) % 8] || 'N';
}

export function formatDistance(meters) {
  const m = Number(meters);
  if (!Number.isFinite(m)) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** Open device maps app for walking navigation to a point. */
export function openMapsNavigation(lat, lng, label = 'Site') {
  const name = encodeURIComponent(label || 'Site');
  const latN = Number(lat);
  const lngN = Number(lng);
  const isAndroid = /android/i.test(navigator.userAgent || '');
  const url = isAndroid
    ? `geo:${latN},${lngN}?q=${latN},${lngN}(${name})`
    : `https://www.google.com/maps/dir/?api=1&destination=${latN},${lngN}&travelmode=walking`;
  window.open(url, '_blank', 'noopener,noreferrer') || (window.location.href = url);
}

export function isWithinRadiusMeters(fromLat, fromLng, toLat, toLng, radiusMeters) {
  return haversineMeters(fromLat, fromLng, toLat, toLng) <= Number(radiusMeters);
}
