import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

function mapWebGeoError(err) {
  const code = err?.code;
  if (code === 1) return new Error('Location permission denied — enable GPS in your phone Settings');
  if (code === 2) return new Error('GPS unavailable — check that location services are on');
  if (code === 3) return new Error('GPS timed out — move to an open area and try again');
  return new Error('Could not get GPS location');
}

function isPluginNotImplemented(err) {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('not implemented') || msg.includes('plugin is not');
}

function webGetPosition(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS not available on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(mapWebGeoError(err)),
      options
    );
  });
}

async function webGetPositionWithRetries() {
  try {
    return await webGetPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
  } catch (firstErr) {
    try {
      return await webGetPosition({ enableHighAccuracy: false, timeout: 25000, maximumAge: 30000 });
    } catch {
      throw firstErr;
    }
  }
}

async function ensureNativePermissions() {
  const status = await Geolocation.checkPermissions();
  if (status.location === 'granted' || status.coarseLocation === 'granted') return;
  const req = await Geolocation.requestPermissions();
  if (req.location !== 'granted' && req.coarseLocation !== 'granted') {
    throw new Error('Location permission denied — enable GPS in your phone Settings');
  }
}

async function nativeGetPosition(highAccuracy, timeoutMs) {
  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: highAccuracy,
    timeout: timeoutMs,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

async function capacitorGetPosition() {
  await ensureNativePermissions();
  try {
    return await nativeGetPosition(true, 20000);
  } catch (firstErr) {
    if (isPluginNotImplemented(firstErr)) throw firstErr;
    try {
      return await nativeGetPosition(false, 25000);
    } catch (secondErr) {
      if (isPluginNotImplemented(secondErr)) throw secondErr;
      if (firstErr instanceof Error) throw firstErr;
      throw new Error('Could not get GPS location');
    }
  }
}

function canUseCapacitorGeolocation() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Geolocation');
}

/** Get current GPS coordinates. Requires permission; throws with a clear message on failure. */
export async function getLocation() {
  if (canUseCapacitorGeolocation()) {
    try {
      return await capacitorGetPosition();
    } catch (err) {
      if (!isPluginNotImplemented(err)) throw err;
      // Repacked APKs may ship without the native Geolocation plugin — use WebView GPS.
    }
  }

  return webGetPositionWithRetries();
}
