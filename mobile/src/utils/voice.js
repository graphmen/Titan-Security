import { requestMicrophonePermission } from './permissions';

function mapMicError(err) {
  const msg = String(err?.message || err).toLowerCase();
  if (msg.includes('not allowed') || msg.includes('permission')) {
    return new Error('Microphone permission denied — enable Microphone in your phone Settings');
  }
  if (msg.includes('could not start audio source') || msg.includes('notfound')) {
    return new Error('Microphone unavailable — close other apps using the mic and try again');
  }
  if (msg.includes('notreadable') || msg.includes('in use')) {
    return new Error('Microphone is in use — close other recording apps and try again');
  }
  return new Error(err?.message || 'Could not start voice recording');
}

/** Start recording audio from the device microphone. Returns { stop(): Promise<string|null> }. */
export async function startVoiceMemo() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone not available on this device');
  }

  const mic = await requestMicrophonePermission();
  if (!mic.granted) {
    throw new Error('Microphone permission denied — enable Microphone in your phone Settings');
  }

  await new Promise((r) => setTimeout(r, 350));

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err) {
    throw mapMicError(err);
  }

  let recorder;
  try {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : undefined;
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    throw mapMicError(err);
  }

  const chunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (!chunks.length) {
        resolve(null);
        return;
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    };
  });

  recorder.start();

  return {
    stop: async () => {
      if (recorder.state !== 'inactive') recorder.stop();
      return stopped;
    },
  };
}
