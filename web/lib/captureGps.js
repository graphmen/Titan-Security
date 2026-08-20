import { PREMISE_MAX_ACCURACY_METERS, premiseAccuracyError } from './gpsAccuracy.js';

const DEFAULT_TIMEOUT_MS = 60000;
const WARMUP_MS = 10000;
const STABILIZE_MS = 6000;
const MIN_SAMPLES = 3;
const EXCEPTIONAL_ACCURACY = 3;

function mapWebGeoError(err) {
  const code = err?.code;
  if (code === 1) return new Error('Location permission denied — allow location access in your browser');
  if (code === 2) return new Error('GPS unavailable — check that location services are on');
  if (code === 3) return new Error('GPS timed out — move to an open area and try again');
  return new Error('Could not get GPS location');
}

/**
 * Watch GPS with warmup + stabilization until accuracy meets maxAccuracyMeters or timeout.
 * Returns { lat, lng, accuracy }.
 */
export function captureHighAccuracyPosition(maxAccuracyMeters = PREMISE_MAX_ACCURACY_METERS, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not available in this browser'));
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
      if (bestQualified && qualifiedCount >= MIN_SAMPLES && bestQualified.accuracy <= maxAccuracyMeters) {
        finish(() => resolve(bestQualified));
        return;
      }
      if (bestQualified && bestQualified.accuracy <= maxAccuracyMeters) {
        finish(() => reject(new Error(
          `GPS still settling — got ±${Math.round(bestQualified.accuracy)}m but need ${MIN_SAMPLES} stable readings. Hold still in open sky 15–20s and retry.`
        )));
        return;
      }
      if (best) {
        finish(() => reject(new Error(premiseAccuracyError(best.accuracy))));
        return;
      }
      finish(() => reject(new Error('Could not get a GPS fix — enable location and try outdoors')));
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const accuracy = pos.coords.accuracy;
        const sample = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy,
        };
        if (!best || accuracy < best.accuracy) best = sample;

        const elapsed = Date.now() - startMs;
        const pastWarmup = elapsed >= WARMUP_MS;
        const exceptional = accuracy <= EXCEPTIONAL_ACCURACY;
        if (!pastWarmup && !exceptional) return;
        if (accuracy > maxAccuracyMeters) return;

        qualifiedCount += 1;
        if (!bestQualified || accuracy < bestQualified.accuracy) bestQualified = sample;

        if (!stabilizeTimerId) {
          stabilizeTimerId = setTimeout(tryFinishStabilized, STABILIZE_MS);
        }
      },
      (err) => finish(() => reject(mapWebGeoError(err))),
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs }
    );

    const timerId = setTimeout(() => {
      if (bestQualified && bestQualified.accuracy <= maxAccuracyMeters && qualifiedCount >= MIN_SAMPLES) {
        finish(() => resolve(bestQualified));
        return;
      }
      tryFinishStabilized();
    }, timeoutMs);
  });
}
