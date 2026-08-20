import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Html5Qrcode } from 'html5-qrcode';
import { requestCameraPermission } from './permissions';

let activeScanner = null;
const HIDDEN_SCANNER_ID = 'titan-qr-file-scanner';

function ensureHiddenScannerElement() {
  let el = document.getElementById(HIDDEN_SCANNER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = HIDDEN_SCANNER_ID;
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return HIDDEN_SCANNER_ID;
}

async function decodeQrFromFile(file) {
  const elementId = ensureHiddenScannerElement();
  const scanner = new Html5Qrcode(elementId, { verbose: false });
  try {
    return await scanner.scanFile(file, false);
  } finally {
    try {
      await scanner.clear();
    } catch {
      /* ignore */
    }
  }
}

/** Native: open camera, capture one frame, decode QR (most reliable in Capacitor WebView). */
async function scanQrNativeSnapshot() {
  const perm = await requestCameraPermission();
  if (!perm.granted) {
    throw new Error('Camera permission required — enable Camera in your phone Settings');
  }

  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    saveToGallery: false,
    correctOrientation: true,
  });

  if (!photo.webPath) {
    throw new Error('Could not capture QR photo');
  }

  const response = await fetch(photo.webPath);
  const blob = await response.blob();
  const file = new File([blob], 'visitor-qr.jpg', { type: blob.type || 'image/jpeg' });
  return decodeQrFromFile(file);
}

async function scanQrLive(elementId) {
  const perm = await requestCameraPermission();
  if (!perm.granted) {
    throw new Error('Camera permission required — enable Camera in your phone Settings');
  }

  if (activeScanner) {
    try {
      await activeScanner.stop();
    } catch {
      /* ignore */
    }
    activeScanner = null;
  }

  const scanner = new Html5Qrcode(elementId, { verbose: false });
  activeScanner = scanner;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = async (fn) => {
      if (settled) return;
      settled = true;
      try {
        await scanner.stop();
      } catch {
        /* ignore */
      }
      if (activeScanner === scanner) activeScanner = null;
      fn();
    };

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        (decoded) => finish(() => resolve(decoded)),
        () => {}
      )
      .catch((err) => finish(() => reject(err)));
  });
}

export async function scanQrFromCamera(elementId) {
  if (Capacitor.isNativePlatform()) {
    return scanQrNativeSnapshot();
  }
  return scanQrLive(elementId);
}

export async function stopQrScanner() {
  if (!activeScanner) return;
  try {
    await activeScanner.stop();
  } catch {
    /* ignore */
  }
  activeScanner = null;
}
