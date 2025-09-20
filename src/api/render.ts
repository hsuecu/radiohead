import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";
import { processAudioOffline } from "../utils/dsp/offlineProcessor";
import waveformManager from "../utils/waveformManager";

export type RenderPlan = {
  baseUri: string;
  segments: Array<{ uri: string; startMs: number; endMs: number; gainDb?: number | null }>;
  fx?: { normalizeGainDb?: number | null; fadeInMs?: number | null; fadeOutMs?: number | null; padHeadMs?: number | null; padTailMs?: number | null };
  outExt?: "m4a" | "wav" | "mp3";
};

export type TrimPlan = {
  baseUri: string;
  cropStartMs: number;
  cropEndMs: number;
  outExt?: "m4a" | "wav" | "mp3";
};

export function isTrimServiceConfigured(): boolean {
  return true; // Local processing is always available
}

// Local audio cropping using expo-av recording
export async function trimToFile(
  plan: TrimPlan,
  stationId: string,
  onProgress?: (p: number) => void
): Promise<{ uri: string; physicallyTrimmed: boolean }> {
  const outDir = FileSystem.documentDirectory + `Flattened/${stationId}/`;
  await FileSystem.makeDirectoryAsync(outDir, { intermediates: true }).catch(() => {});
  const outPath = outDir + `trim-${Math.random().toString(36).slice(2, 8)}.${plan.outExt || "m4a"}`;

  try {
    // Configure audio mode for recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false
    } as any);

    // Load the source audio for playback
    const { sound: sourceSound } = await Audio.Sound.createAsync(
      { uri: plan.baseUri },
      { shouldPlay: false, volume: 1.0 }
    );

    // Set up recording
    const recordingOptions = {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      ios: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.MAX,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      android: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
      }
    } as any;

    const { recording } = await Audio.Recording.createAsync(recordingOptions);
    
    // Calculate crop duration
    const cropDurationMs = plan.cropEndMs - plan.cropStartMs;
    if (cropDurationMs <= 0) {
      throw new Error("Invalid crop selection");
    }

    // Start progress reporting
    let progressInterval: NodeJS.Timeout | null = null;
    if (onProgress) {
      onProgress(0.1); // Initial progress
      progressInterval = setInterval(() => {
        // Simulate progress during processing
        const elapsed = Date.now() - startTime;
        const progress = Math.min(0.9, 0.1 + (elapsed / (cropDurationMs + 2000)) * 0.8);
        onProgress(progress);
      }, 100);
    }

    const startTime = Date.now();

    // Seek to crop start position and start recording
    await sourceSound.setPositionAsync(plan.cropStartMs);
    await recording.startAsync();
    await sourceSound.playAsync();

    // Record for the crop duration
    await new Promise(resolve => setTimeout(resolve, cropDurationMs));

    // Stop recording and playback
    await sourceSound.pauseAsync();
    await recording.stopAndUnloadAsync();
    await sourceSound.unloadAsync();

    // Clean up progress interval
    if (progressInterval) {
      clearInterval(progressInterval);
      if (onProgress) onProgress(1.0);
    }

    // Get the recorded file URI
    const recordedUri = recording.getURI();
    if (!recordedUri) {
      throw new Error("Recording failed - no output file");
    }

    // Move the recorded file to the final destination
    await FileSystem.moveAsync({ from: recordedUri, to: outPath });

    // Validate the output file exists and has reasonable size
    const fileInfo = await FileSystem.getInfoAsync(outPath);
    if (!fileInfo.exists || (fileInfo.size && fileInfo.size < 1000)) {
      throw new Error("Crop output file is invalid or too small");
    }

    return { uri: outPath, physicallyTrimmed: true };

  } catch (error) {
    // Clean up any partial files
    try {
      await FileSystem.deleteAsync(outPath, { idempotent: true });
      await FileSystem.deleteAsync(outPath + ".tmp", { idempotent: true });
    } catch {}
    
    // Reset audio mode on error
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false
      } as any);
    } catch {}
    
    const errorMessage = error instanceof Error ? error.message : "Local audio cropping failed";
    console.error("trimToFile error:", errorMessage, error);
    throw new Error(errorMessage);
  }
}

export async function startRender(plan: RenderPlan, stationId: string): Promise<{ jobId: string }> {
  // Simulated render job id
  const jobId = `render-${Math.random().toString(36).slice(2, 8)}`;
  await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + `Flattened/${stationId}/`, { intermediates: true }).catch(() => {});
  const tmpPath = FileSystem.documentDirectory + `Flattened/${stationId}/${jobId}.json`;
  await FileSystem.writeAsStringAsync(tmpPath, JSON.stringify(plan));
  return { jobId };
}

export async function getRenderStatus(jobId: string, stationId: string): Promise<{ progress: number; uri?: string | null }> {
  const outDir = FileSystem.documentDirectory + `Flattened/${stationId}/`;
  const outPath = outDir + `${jobId}.m4a`;
  const info = await FileSystem.getInfoAsync(outPath);
  if (info.exists) return { progress: 1, uri: outPath };
  try {
    const planStr = await FileSystem.readAsStringAsync(outDir + `${jobId}.json`);
    const plan = JSON.parse(planStr) as RenderPlan;
    await new Promise((r) => setTimeout(r, 300));

    const wantsFX = !!(plan.fx && (
      typeof plan.fx.normalizeGainDb === "number" ||
      typeof plan.fx.fadeInMs === "number" ||
      typeof plan.fx.fadeOutMs === "number"
    ));

    const isWav = (plan.outExt || "m4a") === "wav";

    if (wantsFX && isWav) {
      const tmp = outPath + ".tmp";
      const ok = await processAudioOffline({
        inputUri: plan.baseUri,
        outputUri: tmp,
        effects: {
          normalizeGainDb: plan.fx?.normalizeGainDb ?? undefined,
          fadeInMs: plan.fx?.fadeInMs ?? undefined,
          fadeOutMs: plan.fx?.fadeOutMs ?? undefined,
        },
      });
      if (ok) {
        await FileSystem.moveAsync({ from: tmp, to: outPath });
        const summary = {
          baked: true,
          normalizeGainDb: plan.fx?.normalizeGainDb ?? null,
          fadeInMs: plan.fx?.fadeInMs ?? null,
          fadeOutMs: plan.fx?.fadeOutMs ?? null,
          createdAt: Date.now(),
        };
        try { await FileSystem.writeAsStringAsync(outPath + ".json", JSON.stringify(summary)); } catch {}
        return { progress: 1, uri: outPath };
      }
      // Fall through to copy if processing failed
    }

    await FileSystem.copyAsync({ from: plan.baseUri, to: outPath + ".tmp" });
    await FileSystem.moveAsync({ from: outPath + ".tmp", to: outPath });
    return { progress: 1, uri: outPath };
  } catch {
    return { progress: 0.4 };
  }
}

// Generate waveform for processed audio file
export async function generateWaveformForFile(
  uri: string,
  recordingId: string,
  _durationMs?: number
): Promise<number[] | null> {
  try {
    // For now, generate a placeholder based on file URI
    // In a real implementation, this would analyze the actual audio file
    const waveform = waveformManager.generatePlaceholder(uri + recordingId, 160);
    
    // Store in waveform manager cache
    await waveformManager.setWaveform(recordingId, waveform);
    
    return waveform;
  } catch (error) {
    console.warn("Failed to generate waveform for file:", error);
    return null;
  }
}

// Update waveform when audio is processed
export async function updateWaveformAfterProcessing(
  recordingId: string,
  originalWaveform: number[],
  effects: {
    normalizeGainDb?: number | null;
    fadeInMs?: number | null;
    fadeOutMs?: number | null;
    durationMs: number;
  }
): Promise<number[] | null> {
  try {
    const processedWaveform = waveformManager.applyEffects(originalWaveform, effects);
    await waveformManager.setWaveform(recordingId, originalWaveform, processedWaveform);
    return processedWaveform;
  } catch (error) {
    console.warn("Failed to update waveform after processing:", error);
    return null;
  }
}
