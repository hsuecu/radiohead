import * as FileSystem from "expo-file-system";

export async function startUploadSession(stationId: string, metadata: any): Promise<string> {
  await new Promise((r) => setTimeout(r, 150));
  return `sess-${Math.random().toString(36).slice(2, 8)}`;
}

export async function uploadChunk(sessionId: string, localUri: string, startOffset = 0, onProgress?: (p: number) => void): Promise<{ offset: number }> {
  const info = await FileSystem.getInfoAsync(localUri);
  const size = (info as any).size ?? 1_000_000;
  const CHUNK = 512 * 1024;
  let offset = startOffset;
  while (offset < size) {
    await new Promise((r) => setTimeout(r, 120));
    offset = Math.min(size, offset + CHUNK);
    if (onProgress) onProgress(offset / size);
  }
  return { offset };
}

export async function finalizeUpload(sessionId: string, metadata: any): Promise<{ cloudPath: string; jobId: string }> {
  await new Promise((r) => setTimeout(r, 200));
  const cloudPath = metadata.path + metadata.filename;
  return { cloudPath, jobId: `job-${Math.random().toString(36).slice(2, 8)}` };
}

export async function getJobStatus(jobId: string): Promise<{ status: string; lufs: number; waveform: number[] }> {
  await new Promise((r) => setTimeout(r, 400));
  // Generate a deterministic-ish waveform
  function seedRnd(seed: string) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6d2b79f5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const rnd = seedRnd(jobId);
  const wf = Array.from({ length: 160 }, (_, i) => Math.max(0.08, Math.min(1, (Math.sin((i / 160) * Math.PI) * 0.7 + 0.3) * (rnd() * 0.9 + 0.1))))
  return { status: "done", lufs: -14.0, waveform: wf };
}
