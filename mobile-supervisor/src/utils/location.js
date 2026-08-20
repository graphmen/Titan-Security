import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

const TitanLocation = registerPlugin('TitanLocation');

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

function mapPosition(pos) {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  };
}

function webGetPosition(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS not available on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(mapPosition(pos)),
      (err) => reject(mapWebGeoError(err)),
      options
    );
  });
}

function webWatchBestPosition(maxAccuracyMeters, timeoutMs = 35000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS not available on this device'));
      return;
    }
    let best = null;
    let settled = false;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timerId);
      fn();
    };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const sample = mapPosition(pos);
        if (!best || (sample.accuracy != null && sample.accuracy < best.accuracy)) best = sample;
        if (sample.accuracy != null && sample.accuracy <= maxAccuracyMeters) {
          finish(() => resolve(sample));
        }
      },
      (err) => finish(() => reject(mapWebGeoError(err))),
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs }
    );
    const timerId = setTimeout(() => {
      if (best?.accuracy != null && best.accuracy <= maxAccuracyMeters) {
        finish(() => resolve(best));
        return;
      }
      if (best?.accuracy != null) {
        finish(() => reject(new Error(`GPS accuracy ±${Math.round(best.accuracy)}m — need ±${maxAccuracyMeters}m or better. Move to open sky and retry.`)));
        return;
      }
      finish(() => reject(new Error('Could not get a GPS fix — enable location and try outdoors')));
    }, timeoutMs);
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
  return mapPosition(pos);
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

async function titanGetPosition() {
  const pos = await TitanLocation.getCurrentPosition();
  return mapPosition({ coords: pos.coords });
}

function canUseCapacitorGeolocation() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Geolocation');
}

const PERM_VERSION_KEY = 'titan_location_perm_version';

function isGrantedStatus(status) {
  return status === 'granted' || status === 'limited';
}

/** Whether this app version still needs the install/update location prompt. */
export function shouldPromptLocationPermission(appVersionCode) {
  if (!Capacitor.isNativePlatform()) return false;
  const last = parseInt(localStorage.getItem(PERM_VERSION_KEY) || '0', 10);
  return !Number.isFinite(last) || last < appVersionCode;
}

export function markLocationPermissionPrompted(appVersionCode) {
  localStorage.setItem(PERM_VERSION_KEY, String(appVersionCode));
}

async function readNativePermissionStatus() {
  if (Capacitor.isPluginAvailable('TitanLocation')) {
    try {
      const status = await TitanLocation.checkPermissions();
      if (status?.location) return status.location;
    } catch (_) {
      /* fall through */
    }
  }

  if (canUseCapacitorGeolocation()) {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location === 'granted' || status.coarseLocation === 'granted') return 'granted';
      if (status.location === 'denied' || status.coarseLocation === 'denied') return 'denied';
      return status.location || status.coarseLocation || 'prompt';
    } catch (_) {
      /* fall through */
    }
  }

  return 'prompt';
}

/** Check current location permission without triggering the system dialog. */
export async function checkLocationPermission() {
  if (!Capacitor.isNativePlatform()) {
    return { granted: true, status: 'granted' };
  }
  const status = await readNativePermissionStatus();
  return { granted: isGrantedStatus(status), status };
}

/** Ask the user for location access (shows the Android permission dialog). */
export async function requestLocationPermission() {
  if (!Capacitor.isNativePlatform()) {
    return { granted: true, status: 'granted' };
  }

  const current = await checkLocationPermission();
  if (current.granted) return current;

  if (Capacitor.isPluginAvailable('TitanLocation')) {
    try {
      const result = await TitanLocation.requestPermissions();
      const status = result?.location || 'denied';
      return { granted: isGrantedStatus(status), status };
    } catch (err) {
      if (!isPluginNotImplemented(err)) {
        const msg = String(err?.message || err);
        if (!msg.toLowerCase().includes('not implemented')) {
          return { granted: false, status: 'denied' };
        }
      }
    }
  }

  if (canUseCapacitorGeolocation()) {
    try {
      const req = await Geolocation.requestPermissions();
      const granted = req.location === 'granted' || req.coarseLocation === 'granted';
      return { granted, status: granted ? 'granted' : req.location || req.coarseLocation || 'denied' };
    } catch (err) {
      if (!isPluginNotImplemented(err)) {
        return { granted: false, status: 'denied' };
      }
    }
  }

  try {
    await Geolocation.requestPermissions();
  } catch (_) {
    /* repacked APK fallback */
  }

  await triggerWebViewLocationPermission();

  return checkLocationPermission();
}

/** Nudge Capacitor WebView to show the Android location permission dialog. */
function triggerWebViewLocationPermission() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve(),
      () => resolve(),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  });
}

/** Run on app launch — returns whether to show the in-app permission explainer. */
export async function initLocationPermissionFlow(appVersionCode) {
  if (!Capacitor.isNativePlatform()) {
    return { needsPrompt: false, granted: true };
  }

  const { granted, status } = await checkLocationPermission();
  if (granted) {
    markLocationPermissionPrompted(appVersionCode);
    return { needsPrompt: false, granted: true, status };
  }

  return {
    needsPrompt: shouldPromptLocationPermission(appVersionCode),
    granted: false,
    status,
  };
}

/** Get current GPS coordinates. Requires permission; throws with a clear message on failure. */
export async function getLocation() {
  if (Capacitor.isNativePlatform()) {
    if (Capacitor.isPluginAvailable('TitanLocation')) {
      try {
        return await titanGetPosition();
      } catch (err) {
        if (!isPluginNotImplemented(err)) {
          const msg = String(err?.message || err);
          if (!msg.toLowerCase().includes('not implemented')) throw err;
        }
      }
    }

    if (canUseCapacitorGeolocation()) {
      try {
        return await capacitorGetPosition();
      } catch (err) {
        if (!isPluginNotImplemented(err)) throw err;
      }
    }

    try {
      await Geolocation.requestPermissions();
    } catch (_) {
      /* Native plugin may be missing in repacked APKs — still try WebView GPS. */
    }
  }

  return webGetPositionWithRetries();
}

export const PREMISE_MAX_ACCURACY_METERS = 10;
export const GUARD_CLOCKIN_MAX_ACCURACY_METERS = 8;

/** High-accuracy GPS for registering premises or patrol places on site. */
export async function getLocationForPremiseCapture() {
  if (Capacitor.isNativePlatform()) {
    try {
      if (canUseCapacitorGeolocation()) {
        await ensureNativePermissions();
        const pos = await nativeGetPosition(true, 35000);
        if (pos.accuracy != null && pos.accuracy <= PREMISE_MAX_ACCURACY_METERS) return pos;
        if (pos.accuracy != null) {
          throw new Error(`GPS accuracy ±${Math.round(pos.accuracy)}m — need ±${PREMISE_MAX_ACCURACY_METERS}m or better. Move to open sky and retry.`);
        }
      }
    } catch (err) {
      if (!isPluginNotImplemented(err)) throw err;
    }
  }
  return webWatchBestPosition(PREMISE_MAX_ACCURACY_METERS);
}

/** High-accuracy GPS for guard clock-in geofencing (5–8m zone). */
export async function getLocationForClockIn(maxAccuracyMeters = GUARD_CLOCKIN_MAX_ACCURACY_METERS) {
  const target = Math.min(GUARD_CLOCKIN_MAX_ACCURACY_METERS, maxAccuracyMeters);
  if (Capacitor.isNativePlatform()) {
    try {
      if (canUseCapacitorGeolocation()) {
        await ensureNativePermissions();
        const pos = await nativeGetPosition(true, 35000);
        if (pos.accuracy != null && pos.accuracy <= target) return pos;
        if (pos.accuracy != null) {
          throw new Error(`GPS accuracy ±${Math.round(pos.accuracy)}m — need ±${target}m or better to clock in.`);
        }
      }
    } catch (err) {
      if (!isPluginNotImplemented(err)) throw err;
    }
  }
  return webWatchBestPosition(target);
}
