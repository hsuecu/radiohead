import AsyncStorage from "@react-native-async-storage/async-storage";


export type WaveformData = {
  original: number[];
  processed?: number[];
  version: number;
  lastUpdated: number;
};

export type EffectParams = {
  normalizeGainDb?: number | null;
  fadeInMs?: number | null;
  fadeOutMs?: number | null;
  durationMs: number;
};

// LRU Cache for in-memory waveform storage
class WaveformCache {
  private cache = new Map<string, WaveformData>();
  private maxSize = 50; // Maximum number of waveforms to keep in memory
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;

  get(key: string): WaveformData | null {
    const data = this.cache.get(key);
    if (data) {
      this.accessOrder.set(key, ++this.accessCounter);
      return data;
    }
    return null;
  }

  set(key: string, data: WaveformData): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.findOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.accessOrder.delete(oldestKey);
      }
    }

    this.cache.set(key, data);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.accessOrder.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  private findOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, access] of this.accessOrder) {
      if (access < oldestAccess) {
        oldestAccess = access;
        oldestKey = key;
      }
    }

    return oldestKey;
  }
}

class WaveformManager {
  private cache = new WaveformCache();
  private readonly STORAGE_PREFIX = "waveform_";
  private readonly STANDARD_SAMPLE_COUNT = 160;

  // Generate waveform from live recording values
  generateFromLiveValues(liveValues: number[], targetSamples = this.STANDARD_SAMPLE_COUNT): number[] {
    if (!liveValues || liveValues.length === 0) {
      return this.generatePlaceholder("live", targetSamples);
    }

    return this.downsample(liveValues, targetSamples);
  }

  // Generate placeholder waveform with consistent seeded randomness
  generatePlaceholder(seed: string, count = this.STANDARD_SAMPLE_COUNT): number[] {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    const rnd = () => {
      hash += 0x6d2b79f5;
      let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const samples: number[] = [];
    for (let i = 0; i < count; i++) {
      const base = rnd() * 0.9 + 0.1;
      const envelope = Math.sin((i / count) * Math.PI) * 0.7 + 0.3;
      samples.push(Math.max(0.08, Math.min(1, base * envelope)));
    }

    return samples;
  }

  // Downsample waveform using RMS for better peak representation
  private downsample(samples: number[], targetCount: number): number[] {
    if (samples.length <= targetCount) return [...samples];

    const step = samples.length / targetCount;
    const result: number[] = [];

    for (let i = 0; i < samples.length; i += step) {
      const end = Math.min(i + step, samples.length);
      const slice = samples.slice(Math.floor(i), Math.floor(end));
      
      // RMS calculation for better peak representation
      const rms = Math.sqrt(slice.reduce((sum, val) => sum + val * val, 0) / slice.length);
      result.push(Math.min(1, rms * 1.2)); // Slight boost for visibility
    }

    return result;
  }

  // Slice waveform to a specific time range
  sliceWaveform(
    samples: number[] | null | undefined,
    fullDurationMs: number,
    startMs: number,
    endMs: number,
    targetSamples = this.STANDARD_SAMPLE_COUNT
  ): number[] | null {
    if (!samples || samples.length === 0 || fullDurationMs <= 0 || endMs <= startMs) {
      return null;
    }

    const startRatio = Math.max(0, startMs) / fullDurationMs;
    const endRatio = Math.min(fullDurationMs, endMs) / fullDurationMs;
    
    const startIdx = Math.floor(startRatio * samples.length);
    const endIdx = Math.ceil(endRatio * samples.length);
    
    const sliced = samples.slice(startIdx, endIdx);
    return sliced.length > 0 ? this.downsample(sliced, targetSamples) : null;
  }

  // Apply effects to waveform samples
  applyEffects(samples: number[], effects: EffectParams): number[] {
    if (!samples || samples.length === 0) return samples;

    const result = [...samples];
    const { normalizeGainDb, fadeInMs, fadeOutMs, durationMs } = effects;

    // Apply normalization gain
    if (typeof normalizeGainDb === "number" && normalizeGainDb !== 0) {
      const gainLinear = Math.pow(10, normalizeGainDb / 20);
      for (let i = 0; i < result.length; i++) {
        result[i] = Math.max(0, Math.min(1, result[i] * gainLinear));
      }
    }

    // Apply fade in
    if (fadeInMs && fadeInMs > 0 && durationMs > 0) {
      const fadeInRatio = fadeInMs / durationMs;
      const fadeInSamples = Math.floor(result.length * fadeInRatio);
      
      for (let i = 0; i < Math.min(fadeInSamples, result.length); i++) {
        const fadeMultiplier = i / fadeInSamples;
        result[i] *= fadeMultiplier;
      }
    }

    // Apply fade out
    if (fadeOutMs && fadeOutMs > 0 && durationMs > 0) {
      const fadeOutRatio = fadeOutMs / durationMs;
      const fadeOutSamples = Math.floor(result.length * fadeOutRatio);
      const fadeStartIdx = result.length - fadeOutSamples;
      
      for (let i = fadeStartIdx; i < result.length; i++) {
        const fadeProgress = (i - fadeStartIdx) / fadeOutSamples;
        const fadeMultiplier = 1 - fadeProgress;
        result[i] *= fadeMultiplier;
      }
    }

    return result;
  }

  // Get waveform data for a recording
  async getWaveform(recordingId: string, useProcessed = false): Promise<number[] | null> {
    const cached = this.cache.get(recordingId);
    if (cached) {
      return useProcessed && cached.processed ? cached.processed : cached.original;
    }

    // Try to load from persistent storage
    try {
      const stored = await AsyncStorage.getItem(`${this.STORAGE_PREFIX}${recordingId}`);
      if (stored) {
        const data: WaveformData = JSON.parse(stored);
        this.cache.set(recordingId, data);
        return useProcessed && data.processed ? data.processed : data.original;
      }
    } catch (error) {
      console.warn("Failed to load waveform from storage:", error);
    }

    return null;
  }

  // Store waveform data
  async setWaveform(recordingId: string, original: number[], processed?: number[]): Promise<void> {
    const data: WaveformData = {
      original,
      processed,
      version: Date.now(),
      lastUpdated: Date.now(),
    };

    // Update cache
    this.cache.set(recordingId, data);

    // Persist to storage (non-blocking)
    this.persistWaveform(recordingId, data).catch(error => {
      console.warn("Failed to persist waveform:", error);
    });
  }

  // Update processed waveform
  async updateProcessedWaveform(recordingId: string, effects: EffectParams): Promise<number[] | null> {
    const cached = this.cache.get(recordingId);
    if (!cached) {
      console.warn("No original waveform found for processing");
      return null;
    }

    const processed = this.applyEffects(cached.original, effects);
    
    const updatedData: WaveformData = {
      ...cached,
      processed,
      version: Date.now(),
      lastUpdated: Date.now(),
    };

    this.cache.set(recordingId, updatedData);
    
    // Persist updated data
    this.persistWaveform(recordingId, updatedData).catch(error => {
      console.warn("Failed to persist processed waveform:", error);
    });

    return processed;
  }

  // Clear processed waveform (when effects are reset)
  async clearProcessedWaveform(recordingId: string): Promise<void> {
    const cached = this.cache.get(recordingId);
    if (!cached) return;

    const updatedData: WaveformData = {
      ...cached,
      processed: undefined,
      version: Date.now(),
      lastUpdated: Date.now(),
    };

    this.cache.set(recordingId, updatedData);
    this.persistWaveform(recordingId, updatedData).catch(error => {
      console.warn("Failed to persist waveform update:", error);
    });
  }

  // Remove waveform data
  async removeWaveform(recordingId: string): Promise<void> {
    this.cache.delete(recordingId);
    
    try {
      await AsyncStorage.removeItem(`${this.STORAGE_PREFIX}${recordingId}`);
    } catch (error) {
      console.warn("Failed to remove waveform from storage:", error);
    }
  }

  // Clear all cached waveforms
  clearCache(): void {
    this.cache.clear();
  }

  // Private method to persist waveform to storage
  private async persistWaveform(recordingId: string, data: WaveformData): Promise<void> {
    try {
      await AsyncStorage.setItem(`${this.STORAGE_PREFIX}${recordingId}`, JSON.stringify(data));
    } catch (error) {
      throw new Error(`Failed to persist waveform: ${error}`);
    }
  }

  // Get standard sample count for consistency
  getStandardSampleCount(): number {
    return this.STANDARD_SAMPLE_COUNT;
  }

  // Validate waveform data
  isValidWaveform(samples: any): samples is number[] {
    return Array.isArray(samples) && samples.length > 0 && samples.every(s => typeof s === "number" && s >= 0 && s <= 1);
  }
}

// Export singleton instance
export const waveformManager = new WaveformManager();
export default waveformManager;