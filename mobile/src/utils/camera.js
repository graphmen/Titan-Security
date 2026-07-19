import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { requestCameraPermission } from './permissions';

function pickImageViaInput() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

/** Capture a photo from the device camera. Returns a data URL or null if cancelled. */
export async function captureIncidentPhoto() {
  if (Capacitor.isNativePlatform()) {
    try {
      await requestCameraPermission();
      const photo = await Camera.getPhoto({
        quality: 72,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: false,
      });
      return photo.dataUrl || null;
    } catch (err) {
      if (String(err?.message || err).toLowerCase().includes('cancel')) return null;
      throw err;
    }
  }
  return pickImageViaInput();
}

/** Pick or capture a profile photo (camera or gallery). Returns a data URL or null if cancelled. */
export async function pickProfilePhoto() {
  if (Capacitor.isNativePlatform()) {
    try {
      await requestCameraPermission();
      const photo = await Camera.getPhoto({
        quality: 65,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        saveToGallery: false,
      });
      return photo.dataUrl || null;
    } catch (err) {
      if (String(err?.message || err).toLowerCase().includes('cancel')) return null;
      throw err;
    }
  }
  return pickImageViaInput();
}
