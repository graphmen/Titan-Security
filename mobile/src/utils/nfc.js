import { Capacitor, registerPlugin } from '@capacitor/core';

const TitanNfc = registerPlugin('TitanNfc');

export async function getNfcAvailability() {
  if (!Capacitor.isNativePlatform()) {
    return { supported: false, enabled: false };
  }
  try {
    return await TitanNfc.isAvailable();
  } catch {
    return { supported: false, enabled: false };
  }
}

/**
 * Start NFC reader mode. Returns cleanup function.
 * @param {(tag: { tagId: string, ndefText?: string }) => void} onTag
 */
export async function startNfcScan(onTag) {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('NFC scanning requires the Titan Monitor Android app');
  }

  const avail = await getNfcAvailability();
  if (!avail.supported) throw new Error('NFC not supported on this device');
  if (!avail.enabled) throw new Error('NFC is off — enable it in Settings');

  const listener = await TitanNfc.addListener('nfcTag', (data) => {
    const tagId = String(data?.tagId || '').trim();
    const ndefText = data?.ndefText ? String(data.ndefText).trim() : '';
    if (tagId || ndefText) {
      onTag({ tagId, ndefText: ndefText || undefined });
    }
  });

  await TitanNfc.startScan();

  return async () => {
    try {
      await listener.remove();
    } catch { /* ignore */ }
    try {
      await TitanNfc.stopScan();
    } catch { /* ignore */ }
  };
}

/** Match scanned tag to checkpoint code (UID or NDEF text). */
export function matchCheckpointByNfcTag(checkpoints, { tagId, ndefText }) {
  const candidates = [tagId, ndefText].filter(Boolean).map((s) => s.toUpperCase());
  if (!candidates.length) return null;
  return checkpoints.find((cp) => {
    const code = String(cp.code || '').trim().toUpperCase();
    if (!code) return false;
    return candidates.some((c) => c === code);
  }) || null;
}
