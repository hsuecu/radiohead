export type AudioInputInfo = { uid: string; name: string; type?: string };

// Best-effort: tries expo-audio if available; falls back to empty list
export async function getAvailableInputs(): Promise<AudioInputInfo[]> {
  try {
    // Dynamic import to avoid bundling error if not installed
    // @ts-ignore
    const mod = await import("expo-audio");
    if (!mod || !mod.useAudioRecorder) return [];
    // Create a temporary recorder just to query inputs
    const { AudioModule, RecordingPresets, createAudioPlayer } = mod as any;
    // Some expo-audio APIs are hooks; inputs require a recorder instance with prepareToRecordAsync()
    const recorder = new (mod as any).AudioRecorder((mod as any).RecordingPresets?.HIGH_QUALITY || {});
    await recorder.prepareToRecordAsync();
    const inputs = await recorder.getAvailableInputs();
    try { await recorder.stop(); } catch {}
    if (Array.isArray(inputs)) {
      return inputs.map((i: any) => ({ uid: String(i.uid || i.id || i.name), name: String(i.name || i.label || "Input"), type: i.type }));
    }
    return [];
  } catch {
    return [];
  }
}
