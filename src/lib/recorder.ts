"use client";

// Records mono audio and encodes 16 kHz 16-bit PCM WAV in the browser: the standard format for speech
// datasets, and one every browser and the grader can read (no codec differences between Chrome and Safari).
export type Rec = { stop: () => Promise<{ blob: Blob; durationMs: number }>; cancel: () => void };

export async function startRecording(): Promise<Rec> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  const t0 = Date.now();
  proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  src.connect(proc); proc.connect(ctx.destination);
  const rate = ctx.sampleRate;
  const release = () => { proc.disconnect(); src.disconnect(); stream.getTracks().forEach((t) => t.stop()); void ctx.close(); };
  return {
    cancel: release,
    stop: async () => {
      release();
      const n = chunks.reduce((a, c) => a + c.length, 0);
      const all = new Float32Array(n); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
      const outRate = 16000, ratio = rate / outRate, len = Math.floor(n / ratio);
      const pcm = new Int16Array(len);
      for (let i = 0; i < len; i++) { const x = Math.max(-1, Math.min(1, all[Math.floor(i * ratio)])); pcm[i] = x < 0 ? x * 0x8000 : x * 0x7fff; }
      const buf = new ArrayBuffer(44 + pcm.length * 2); const v = new DataView(buf);
      const w = (off: number, s: string) => [...s].forEach((ch, i) => v.setUint8(off + i, ch.charCodeAt(0)));
      w(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
      v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, pcm.length * 2, true);
      new Int16Array(buf, 44).set(pcm);
      return { blob: new Blob([buf], { type: "audio/wav" }), durationMs: Date.now() - t0 };
    },
  };
}

export const blobToBase64 = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(b);
});
