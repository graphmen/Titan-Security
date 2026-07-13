/** Shared Web Audio helpers — lightweight synthesized sounds (no asset files). */

let sharedCtx = null;

function getCtx() {
  if (!sharedCtx) {
    sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume();
  }
  return sharedCtx;
}

function tone({ freq, type = 'sine', start = 0, dur = 0.12, vol = 0.18, ramp = true }) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  gain.gain.setValueAtTime(vol, ctx.currentTime + start);
  if (ramp) {
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  }
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.02);
}

/** Immediate feedback when NFC tap starts */
export function playNfcScan() {
  try {
    tone({ freq: 520, type: 'triangle', vol: 0.12, dur: 0.06 });
    tone({ freq: 880, type: 'sine', start: 0.04, vol: 0.14, dur: 0.08 });
    if (navigator.vibrate) navigator.vibrate(8);
  } catch (_) { /* ignore */ }
}

/** Success chime after checkpoint logged */
export function playNfcSuccess() {
  try {
    tone({ freq: 784, vol: 0.16, dur: 0.1 });
    tone({ freq: 988, start: 0.07, vol: 0.18, dur: 0.12 });
    tone({ freq: 1175, start: 0.14, vol: 0.14, dur: 0.16 });
    if (navigator.vibrate) navigator.vibrate([12, 40, 18]);
  } catch (_) { /* ignore */ }
}

/** PIN pad key press */
export function playPinKey() {
  try {
    tone({ freq: 640, type: 'triangle', vol: 0.08, dur: 0.04 });
  } catch (_) { /* ignore */ }
}

/** Wrong PIN */
export function playPinError() {
  try {
    tone({ freq: 220, type: 'square', vol: 0.12, dur: 0.14 });
    tone({ freq: 180, type: 'square', start: 0.1, vol: 0.1, dur: 0.18 });
    if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
  } catch (_) { /* ignore */ }
}

/** Successful guard login */
export function playLoginSuccess() {
  try {
    tone({ freq: 523, vol: 0.14, dur: 0.1 });
    tone({ freq: 659, start: 0.08, vol: 0.16, dur: 0.1 });
    tone({ freq: 784, start: 0.16, vol: 0.18, dur: 0.2 });
    if (navigator.vibrate) navigator.vibrate(20);
  } catch (_) { /* ignore */ }
}

/** Movement alert (existing behaviour) */
export function playMovementAlertBeep() {
  try {
    [0, 0.35, 0.7].forEach((delay) => {
      tone({ freq: 440, type: 'square', start: delay, vol: 0.15, dur: 0.25 });
    });
  } catch (_) { /* ignore */ }
}

/** Generic short success (photos, etc.) */
export function playSuccessBeep() {
  playNfcSuccess();
}
