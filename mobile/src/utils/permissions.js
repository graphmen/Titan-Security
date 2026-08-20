import { Capacitor, registerPlugin } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { requestLocationPermission, checkLocationPermission } from './location';

const TitanPermissions = registerPlugin('TitanPermissions');

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
    return { granted: false, status: 'prompt' };
  }

  try {
    const current = await Camera.checkPermissions();
    if (current.camera === 'granted') {
      return { granted: true, status: 'granted' };
    }
    const req = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    const granted = req.camera === 'granted';
    return { granted, status: req.camera || 'denied' };
  } catch (err) {
    if (isPluginNotImplemented(err)) {
      return { granted: false, status: 'prompt' };
    }
    return { granted: false, status: 'denied' };
  }
}

/** Ask for microphone access before voice memos. */
export async function requestMicrophonePermission() {
  if (!Capacitor.isNativePlatform()) {
    return { granted: true, status: 'granted' };
  }

  if (Capacitor.isPluginAvailable('TitanPermissions')) {
    try {
      const result = await TitanPermissions.requestMicrophone();
      const granted = !!result?.granted || result?.microphone === 'granted';
      return { granted, status: result?.microphone || 'denied' };
    } catch (err) {
      if (!isPluginNotImplemented(err)) {
        return { granted: false, status: 'denied' };
      }
    }
  }

  return { granted: false, status: 'denied' };
}

/** Request essential permissions (used after sign-in). */
export async function requestEssentialPermissions({ includeMicrophone = false } = {}) {
  const location = await requestLocationPermission();
  const camera = await requestCameraPermission();
  const microphone = includeMicrophone
    ? await requestMicrophonePermission()
    : { granted: true, status: 'granted' };
  return {
    location,
    camera,
    microphone,
    allGranted: location.granted && camera.granted && microphone.granted,
  };
}

export { checkLocationPermission, requestLocationPermission };
