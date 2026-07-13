/** Start recording audio from the device microphone. Returns { stop(): Promise<string|null> }. */
export async function startVoiceMemo() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone not available on this device');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
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
