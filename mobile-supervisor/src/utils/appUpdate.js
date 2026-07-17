import { Capacitor, registerPlugin } from '@capacitor/core';
import { APP_VERSION_CODE } from '../config';

const ApkInstaller = registerPlugin('ApkInstaller');

export async function fetchRemoteVersion(apiBase, appId) {
  const base = String(apiBase || '').replace(/\/$/, '');
  const res = await fetch(`${base}/api/mobile/version?app=${appId}`, {
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || 'Could not check for updates');
  }
  return json;
}

export function isUpdateAvailable(remote, currentCode = APP_VERSION_CODE) {
  if (!remote?.versionCode) return false;
  return Number(remote.versionCode) > Number(currentCode);
}

export async function installApkUpdate(apkUrl) {
  if (!apkUrl) throw new Error('No update URL available');

  if (Capacitor.getPlatform() === 'android') {
    await ApkInstaller.installFromUrl({ url: apkUrl });
    return;
  }

  window.open(apkUrl, '_blank', 'noopener,noreferrer');
}

export function isNativeAndroid() {
  return Capacitor.getPlatform() === 'android';
}
