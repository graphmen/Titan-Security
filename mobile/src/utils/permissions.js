import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { requestLocationPermission, checkLocationPermission } from './location';

function isPluginNotImplemented(err) {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('not implemented') || msg.includes('plugin is not');
}

/** Ask for camera access before capture (native Android permission dialog). */
export async function requestCameraPermission() {
  if (!Capacitor.isNativePlatform()) {
    return { granted: true, status: 'granted' };
  }

  if (!Capacitor.isPluginAvailable('Camera')) {
    return { granted: true, status: 'prompt' };
  }

  try {
    const current = await Camera.checkPermissions();
    if (current.camera === 'granted' || current.photos === 'granted') {
      return { granted: true, status: 'granted' };
    }
    const req = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    const granted = req.camera === 'granted' || req.photos === 'granted';
    return { granted, status: req.camera || req.photos || 'denied' };
  } catch (err) {
    if (isPluginNotImplemented(err)) {
      return { granted: true, status: 'prompt' };
    }
    return { granted: false, status: 'denied' };
  }
}

/** Request location + camera permissions (used on app install/update). */
export async function requestEssentialPermissions() {
  const location = await requestLocationPermission();
  const camera = await requestCameraPermission();
  return {
    location,
    camera,
    allGranted: location.granted && camera.granted,
  };
}

export { checkLocationPermission, requestLocationPermission };
