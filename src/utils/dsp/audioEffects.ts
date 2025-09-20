/**
 * Enhanced DSP Audio Effects for React Native
 * Phase 1: Improved simulation with better frequency-band processing
 * 
 * These effects provide enhanced audio processing while maintaining
 * compatibility with Expo managed workflow and expo-av limitations.
 */

// Basic DSP utilities
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

export function linearToDb(linear: number): number {
  return 20 * Math.log10(Math.max(0.000001, linear));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Envelope follower for dynamic processing
export class EnvelopeFollower {
  private level: number = 0;
  private attackCoeff: number;
  private releaseCoeff: number;

  constructor(attackMs: number, releaseMs: number, sampleRate: number = 44100) {
    // Convert milliseconds to coefficients for exponential smoothing
    this.attackCoeff = Math.exp(-1 / (attackMs * 0.001 * sampleRate));
    this.releaseCoeff = Math.exp(-1 / (releaseMs * 0.001 * sampleRate));
  }

  process(inputLevel: number): number {
    const targetLevel = Math.abs(inputLevel);
    
    if (targetLevel > this.level) {
      // Attack: fast response to increasing levels
      this.level = targetLevel + (this.level - targetLevel) * this.attackCoeff;
    } else {
      // Release: slower response to decreasing levels
      this.level = targetLevel + (this.level - targetLevel) * this.releaseCoeff;
    }
    
    return this.level;
  }

  reset(): void {
    this.level = 0;
  }
}

// Enhanced EQ with frequency-band simulation
export interface EQSettings {
  enabled: boolean;
  lowGain: number;    // -12 to +12 dB
  midGain: number;    // -12 to +12 dB
  highGain: number;   // -12 to +12 dB
  lowFreq?: number;   // Hz, default 100
  midFreq?: number;   // Hz, default 1000
  highFreq?: number;  // Hz, default 10000
}

export class EnhancedEQ {
  private lowGainLinear: number = 1;
  private midGainLinear: number = 1;
  private highGainLinear: number = 1;
  
  // Simple frequency content estimation based on gain changes
  private lowContent: number = 0.33;  // Assume equal distribution
  private midContent: number = 0.33;
  private highContent: number = 0.34;

  constructor(private settings: EQSettings) {
    this.updateSettings(settings);
  }

  updateSettings(settings: EQSettings): void {
    this.settings = settings;
    if (settings.enabled) {
      this.lowGainLinear = dbToLinear(clamp(settings.lowGain, -12, 12));
      this.midGainLinear = dbToLinear(clamp(settings.midGain, -12, 12));
      this.highGainLinear = dbToLinear(clamp(settings.highGain, -12, 12));
    } else {
      this.lowGainLinear = this.midGainLinear = this.highGainLinear = 1;
    }
  }

  process(inputGain: number): number {
    if (!this.settings.enabled) return inputGain;

    // Simulate frequency-dependent processing
    // In a real implementation, this would use actual frequency analysis
    const processedGain = (
      inputGain * this.lowContent * this.lowGainLinear +
      inputGain * this.midContent * this.midGainLinear +
      inputGain * this.highContent * this.highGainLinear
    );

    // Apply gentle limiting to prevent extreme values
    return clamp(processedGain, 0.1, 3.0);
  }

  // Estimate frequency content based on audio characteristics
  // This is a simplified approach - real implementation would use FFT
  updateFrequencyContent(audioLevel: number, previousLevel: number): void {
    const levelChange = Math.abs(audioLevel - previousLevel);
    
    // Heuristic: rapid changes suggest high frequency content
    // Steady levels suggest low frequency content
    if (levelChange > 0.1) {
      this.highContent = Math.min(0.6, this.highContent + 0.01);
      this.lowContent = Math.max(0.2, this.lowContent - 0.005);
    } else {
      this.lowContent = Math.min(0.6, this.lowContent + 0.01);
      this.highContent = Math.max(0.2, this.highContent - 0.005);
    }
    
    // Ensure content weights sum to 1
    const total = this.lowContent + this.midContent + this.highContent;
    this.lowContent /= total;
    this.midContent /= total;
    this.highContent /= total;
  }
}

// Enhanced Compressor with envelope following
export interface CompressorSettings {
  enabled: boolean;
  threshold: number;  // dB
  ratio: number;      // 1:1 to 20:1
  attack: number;     // ms
  release: number;    // ms
  makeupGain?: number; // dB
}

export class EnhancedCompressor {
  private envelope: EnvelopeFollower;
  private thresholdLinear: number = 1;
  private ratio: number = 1;
  private makeupGainLinear: number = 1;
  private previousGainReduction: number = 1;

  constructor(private settings: CompressorSettings) {
    this.envelope = new EnvelopeFollower(
      settings.attack || 10,
      settings.release || 100
    );
    this.updateSettings(settings);
  }

  updateSettings(settings: CompressorSettings): void {
    this.settings = settings;
    this.thresholdLinear = dbToLinear(settings.threshold);
    this.ratio = clamp(settings.ratio, 1, 20);
    this.makeupGainLinear = dbToLinear(settings.makeupGain || 0);
    
    // Update envelope timing if changed
    this.envelope = new EnvelopeFollower(
      settings.attack || 10,
      settings.release || 100
    );
  }

  process(inputGain: number): number {
    if (!this.settings.enabled) return inputGain;

    // Follow the input level
    const level = this.envelope.process(inputGain);
    
    // Calculate gain reduction
    let gainReduction = 1;
    if (level > this.thresholdLinear) {
      const overThreshold = level / this.thresholdLinear;
      const compressedRatio = 1 + (overThreshold - 1) / this.ratio;
      gainReduction = compressedRatio / overThreshold;
    }

    // Smooth gain reduction changes to avoid artifacts
    const smoothingFactor = 0.1;
    gainReduction = this.previousGainReduction + 
      (gainReduction - this.previousGainReduction) * smoothingFactor;
    this.previousGainReduction = gainReduction;

    // Apply compression and makeup gain
    const compressedGain = inputGain * gainReduction * this.makeupGainLinear;
    
    return clamp(compressedGain, 0.01, 2.0);
  }

  reset(): void {
    this.envelope.reset();
    this.previousGainReduction = 1;
  }
}

// Noise Gate with smooth transitions
export interface NoiseGateSettings {
  enabled: boolean;
  threshold: number;  // dB
  ratio: number;      // Expansion ratio
  attack: number;     // ms
  release: number;    // ms
  holdTime?: number;  // ms
}

export class NoiseGate {
  private envelope: EnvelopeFollower;
  private thresholdLinear: number = 1;
  private ratio: number = 1;
  private holdCounter: number = 0;
  private holdSamples: number;
  private isGateOpen: boolean = true;
  private previousGain: number = 1;

  constructor(private settings: NoiseGateSettings, sampleRate: number = 44100) {
    this.envelope = new EnvelopeFollower(
      settings.attack || 1,
      settings.release || 50
    );
    this.holdSamples = ((settings.holdTime || 10) * 0.001 * sampleRate);
    this.updateSettings(settings);
  }

  updateSettings(settings: NoiseGateSettings): void {
    this.settings = settings;
    this.thresholdLinear = dbToLinear(settings.threshold);
    this.ratio = clamp(settings.ratio, 1, 10);
  }

  process(inputGain: number): number {
    if (!this.settings.enabled) return inputGain;

    const level = this.envelope.process(inputGain);
    let gateGain = 1;

    if (level < this.thresholdLinear) {
      // Below threshold - apply gating
      if (this.isGateOpen) {
        // Start closing gate
        this.holdCounter = this.holdSamples;
        this.isGateOpen = false;
      }
      
      if (this.holdCounter > 0) {
        this.holdCounter--;
        gateGain = 1; // Hold open during hold time
      } else {
        // Apply expansion (inverse compression)
        const belowThreshold = this.thresholdLinear / level;
        const expandedRatio = 1 + (belowThreshold - 1) * (this.ratio - 1);
        gateGain = 1 / expandedRatio;
        gateGain = Math.max(0.01, gateGain); // Minimum gate reduction
      }
    } else {
      // Above threshold - gate open
      this.isGateOpen = true;
      this.holdCounter = 0;
      gateGain = 1;
    }

    // Smooth gain changes
    const smoothingFactor = 0.05;
    gateGain = this.previousGain + (gateGain - this.previousGain) * smoothingFactor;
    this.previousGain = gateGain;

    return inputGain * gateGain;
  }

  reset(): void {
    this.envelope.reset();
    this.holdCounter = 0;
    this.isGateOpen = true;
    this.previousGain = 1;
  }
}

// Combined audio processor for all effects
export interface AudioEffectsSettings {
  eq?: EQSettings;
  compressor?: CompressorSettings;
  noiseGate?: NoiseGateSettings;
  noiseSuppression?: NoiseGateSettings; // Alias for backward compatibility
  normalizeTargetLufs?: number;
  normalizeGainDb?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
}

export class AudioEffectsProcessor {
  private eq: EnhancedEQ | null = null;
  private compressor: EnhancedCompressor | null = null;
  private noiseGate: NoiseGate | null = null;
  private previousLevel: number = 0;

  constructor(private settings: AudioEffectsSettings) {
    this.updateSettings(settings);
  }

  updateSettings(settings: AudioEffectsSettings): void {
    this.settings = settings;
    
    // Initialize or update EQ
    if (settings.eq?.enabled) {
      if (!this.eq) {
        this.eq = new EnhancedEQ(settings.eq);
      } else {
        this.eq.updateSettings(settings.eq);
      }
    } else {
      this.eq = null;
    }

    // Initialize or update Compressor
    if (settings.compressor?.enabled) {
      if (!this.compressor) {
        this.compressor = new EnhancedCompressor(settings.compressor);
      } else {
        this.compressor.updateSettings(settings.compressor);
      }
    } else {
      this.compressor = null;
    }

    // Initialize or update Noise Gate
    if (settings.noiseGate?.enabled) {
      if (!this.noiseGate) {
        this.noiseGate = new NoiseGate(settings.noiseGate);
      } else {
        this.noiseGate.updateSettings(settings.noiseGate);
      }
    } else {
      this.noiseGate = null;
    }
  }

  process(inputGain: number, positionMs: number, startMs: number, endMs: number): number {
    let processedGain = inputGain;

    // Apply normalization (LUFS-based gain adjustment)
    if (this.settings.normalizeGainDb != null) {
      const normalizeGain = dbToLinear(clamp(this.settings.normalizeGainDb, -12, 12));
      processedGain *= normalizeGain;
    }

    // Apply fade in
    if (this.settings.fadeInMs && this.settings.fadeInMs > 0) {
      const fadeProgress = Math.max(0, Math.min(1, (positionMs - startMs) / this.settings.fadeInMs));
      processedGain *= fadeProgress;
    }

    // Apply fade out
    if (this.settings.fadeOutMs && this.settings.fadeOutMs > 0) {
      const fadeProgress = Math.max(0, Math.min(1, (endMs - positionMs) / this.settings.fadeOutMs));
      processedGain *= fadeProgress;
    }

    // Apply noise gate (first in chain)
    if (this.noiseGate) {
      processedGain = this.noiseGate.process(processedGain);
    }

    // Apply EQ
    if (this.eq) {
      // Update frequency content estimation
      this.eq.updateFrequencyContent(processedGain, this.previousLevel);
      processedGain = this.eq.process(processedGain);
    }

    // Apply compressor (last in chain)
    if (this.compressor) {
      processedGain = this.compressor.process(processedGain);
    }

    this.previousLevel = processedGain;
    
    // Final safety limiting
    return clamp(processedGain, 0.001, 3.0);
  }

  reset(): void {
    this.compressor?.reset();
    this.noiseGate?.reset();
    this.previousLevel = 0;
  }
}