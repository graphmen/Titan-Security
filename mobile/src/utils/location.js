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

async function titanGetPosition() {
  const pos = await TitanLocation.getCurrentPosition();
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
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

  return checkLocationPermission();
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
