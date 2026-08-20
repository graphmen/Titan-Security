import { Html5Qrcode } from 'html5-qrcode';
import { requestCameraPermission } from './permissions';

let activeScanner = null;

export async function scanQrFromCamera(elementId) {
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

export async function stopQrScanner() {
  if (!activeScanner) return;
  try {
    await activeScanner.stop();
  } catch {
    /* ignore */
  }
  activeScanner = null;
}
