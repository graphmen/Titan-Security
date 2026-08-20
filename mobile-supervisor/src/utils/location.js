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

function webWatchBestPosition(maxAccuracyMeters, timeoutMs = 60000, options = {}) {
  const warmupMs = options.warmupMs ?? 10000;
  const stabilizeMs = options.stabilizeMs ?? 6000;
  const minSamples = options.minSamples ?? 3;
  const exceptionalAccuracy = 3;

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS not available on this device'));
      return;
    }
    let best = null;
    let bestQualified = null;
    let qualifiedCount = 0;
    let settled = false;
    let stabilizeTimerId = null;
    const startMs = Date.now();

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timerId);
      if (stabilizeTimerId) clearTimeout(stabilizeTimerId);
      fn();
    };

    const tryFinishStabilized = () => {
      if (bestQualified && qualifiedCount >= minSamples && bestQualified.accuracy <= maxAccuracyMeters) {
        finish(() => resolve(bestQualified));
        return;
      }
      if (bestQualified && bestQualified.accuracy <= maxAccuracyMeters) {
        finish(() => reject(new Error(
          `GPS still settling — got ±${Math.round(bestQualified.accuracy)}m but need ${minSamples} stable readings. Hold still in open sky 15–20s and retry.`
        )));
        return;
      }
      if (best?.accuracy != null) {
        finish(() => reject(new Error(`GPS accuracy ±${Math.round(best.accuracy)}m — need ±${maxAccuracyMeters}m or better. Move to open sky, hold still 15–20s, and retry.`)));
        return;
      }
      finish(() => reject(new Error('Could not get a GPS fix — enable location and try outdoors')));
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const sample = mapPosition(pos);
        if (!best || (sample.accuracy != null && sample.accuracy < best.accuracy)) best = sample;

        const elapsed = Date.now() - startMs;
        const pastWarmup = elapsed >= warmupMs;
        const exceptional = sample.accuracy != null && sample.accuracy <= exceptionalAccuracy;
        if (!pastWarmup && !exceptional) return;
        if (sample.accuracy == null || sample.accuracy > maxAccuracyMeters) return;

        qualifiedCount += 1;
        if (!bestQualified || sample.accuracy < bestQualified.accuracy) bestQualified = sample;

        if (!stabilizeTimerId) {
          stabilizeTimerId = setTimeout(tryFinishStabilized, stabilizeMs);
        }
      },
      (err) => finish(() => reject(mapWebGeoError(err))),
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs }
    );

    const timerId = setTimeout(() => {
      if (bestQualified && bestQualified.accuracy <= maxAccuracyMeters && qualifiedCount >= minSamples) {
        finish(() => resolve(bestQualified));
        return;
      }
      tryFinishStabilized();
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
  if (status.location === 'granted') return;
  const req = await Geolocation.requestPermissions();
  if (req.location !== 'granted') {
    throw new Error('Precise location permission required — enable GPS in your phone Settings');
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

async function titanWatchBestPosition(maxAccuracyMeters, timeoutMs = 60000, options = {}) {
  const pos = await TitanLocation.getHighAccuracyPosition({
    maxAccuracyMeters,
    timeoutMs,
    warmupMs: options.warmupMs ?? 10000,
    stabilizeMs: options.stabilizeMs ?? 6000,
    minSamples: options.minSamples ?? 3,
  });
  const mapped = mapPosition({ coords: pos.coords });
  if (mapped.accuracy == null) {
    throw new Error('Could not get a GPS fix — enable location and try outdoors');
  }
  return mapped;
}

function canUseCapacitorGeolocation() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Geolocation');
}

const PERM_VERSION_KEY = 'titan_location_perm_version';
const PERM_SKIPPED_KEY = 'titan_location_perm_skipped';

function isGrantedStatus(status) {
  return status === 'granted' || status === 'limited';
}

/** Whether install/update should auto-request and show the permission explainer. */
export function shouldPromptLocationPermission(appVersionCode) {
  if (!Capacitor.isNativePlatform()) return false;
  const skipped = localStorage.getItem(PERM_SKIPPED_KEY) === '1';
  const last = parseInt(localStorage.getItem(PERM_VERSION_KEY) || '0', 10);
  if (!Number.isFinite(last) || last < appVersionCode) return true;
  return !skipped;
}

export function markLocationPermissionPrompted(appVersionCode) {
  localStorage.removeItem(PERM_SKIPPED_KEY);
  localStorage.setItem(PERM_VERSION_KEY, String(appVersionCode));
}

/** User chose to continue without granting — don't nag every launch until next app update. */
export function markLocationPermissionSkipped(appVersionCode) {
  localStorage.setItem(PERM_SKIPPED_KEY, '1');
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
      if (status.location === 'granted') return 'granted';
      if (status.location === 'denied') return 'denied';
      return status.location || 'prompt';
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
      const granted = req.location === 'granted';
      return { granted, status: granted ? 'granted' : req.location || 'denied' };
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

/** Run on app launch — auto-requests Android location dialog on install/update. */
export async function initLocationPermissionFlow(appVersionCode) {
  if (!Capacitor.isNativePlatform()) {
    return { needsPrompt: false, granted: true };
  }

  let { granted, status } = await checkLocationPermission();
  if (granted) {
    markLocationPermissionPrompted(appVersionCode);
    return { needsPrompt: false, granted: true, status };
  }

  const shouldAutoRequest = shouldPromptLocationPermission(appVersionCode);
  if (shouldAutoRequest) {
    const result = await requestLocationPermission();
    granted = result.granted;
    status = result.status;
    if (granted) {
      markLocationPermissionPrompted(appVersionCode);
      return { needsPrompt: false, granted: true, status };
    }
  }

  return {
    needsPrompt: shouldAutoRequest || status === 'denied',
    granted: false,
    status,
    autoRequested: shouldAutoRequest,
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

export const PREMISE_MAX_ACCURACY_METERS = 5;
export const GUARD_CLOCKIN_MAX_ACCURACY_METERS = 5;
export const PREMISE_CAPTURE_TIMEOUT_MS = 60000;
export const PREMISE_GPS_WARMUP_MS = 10000;
export const PREMISE_GPS_STABILIZE_MS = 6000;
export const PREMISE_GPS_MIN_SAMPLES = 3;

const premiseCaptureOptions = {
  warmupMs: PREMISE_GPS_WARMUP_MS,
  stabilizeMs: PREMISE_GPS_STABILIZE_MS,
  minSamples: PREMISE_GPS_MIN_SAMPLES,
};

/** High-accuracy GPS for registering premises or patrol places on site. */
export async function getLocationForPremiseCapture() {
  const perm = await requestLocationPermission();
  if (!perm.granted) {
    throw new Error('Precise location permission required — enable GPS in your phone Settings');
  }

  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('TitanLocation')) {
    try {
      return await titanWatchBestPosition(PREMISE_MAX_ACCURACY_METERS, PREMISE_CAPTURE_TIMEOUT_MS, premiseCaptureOptions);
    } catch (err) {
      if (!isPluginNotImplemented(err)) throw err;
    }
  }

  if (Capacitor.isNativePlatform()) {
    try {
      if (canUseCapacitorGeolocation()) {
        await ensureNativePermissions();
        return webWatchBestPosition(PREMISE_MAX_ACCURACY_METERS, PREMISE_CAPTURE_TIMEOUT_MS, premiseCaptureOptions);
      }
    } catch (err) {
      if (!isPluginNotImplemented(err)) throw err;
    }
  }
  return webWatchBestPosition(PREMISE_MAX_ACCURACY_METERS, PREMISE_CAPTURE_TIMEOUT_MS, premiseCaptureOptions);
}

/** High-accuracy GPS for guard clock-in geofencing (5m zone). */
export async function getLocationForClockIn(maxAccuracyMeters = GUARD_CLOCKIN_MAX_ACCURACY_METERS) {
  const target = Math.min(GUARD_CLOCKIN_MAX_ACCURACY_METERS, maxAccuracyMeters);
  const perm = await requestLocationPermission();
  if (!perm.granted) {
    throw new Error('Precise location permission required — enable GPS in your phone Settings');
  }

  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('TitanLocation')) {
    try {
      return await titanWatchBestPosition(target, PREMISE_CAPTURE_TIMEOUT_MS, premiseCaptureOptions);
    } catch (err) {
      if (!isPluginNotImplemented(err)) throw err;
    }
  }

  if (Capacitor.isNativePlatform()) {
    try {
      if (canUseCapacitorGeolocation()) {
        await ensureNativePermissions();
        return webWatchBestPosition(target, PREMISE_CAPTURE_TIMEOUT_MS, premiseCaptureOptions);
      }
    } catch (err) {
      if (!isPluginNotImplemented(err)) throw err;
    }
  }
  return webWatchBestPosition(target, PREMISE_CAPTURE_TIMEOUT_MS, premiseCaptureOptions);
}
