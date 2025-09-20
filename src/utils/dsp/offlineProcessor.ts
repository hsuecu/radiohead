/**
 * Offline DSP Processing for Export-Time Audio Enhancement
 * 
 * This module provides true DSP processing for audio files during export,
 * offering higher quality effects than real-time simulation.
 */

import * as FileSystem from "expo-file-system";
import { AudioEffectsSettings, AudioEffectsProcessor } from "./audioEffects";

export interface OfflineProcessingOptions {
  inputUri: string;
  outputUri: string;
  effects: AudioEffectsSettings;
  trimStartMs?: number;
  trimEndMs?: number;
  onProgress?: (progress: number, status: string) => void;
}

export interface AudioBuffer {
  sampleRate: number;
  channels: number;
  length: number;
  data: Float32Array[];
}

/**
 * Simple WAV file parser for offline processing
 * Note: This is a basic implementation for demonstration
 * Production use would require more robust audio file handling
 */
export class SimpleWAVProcessor {
  // Minimal base64 encoder/decoder (no external deps)
  private static b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  private static base64ToBytes(b64: string): Uint8Array {
    let clean = b64.replace(/[^A-Za-z0-9+/=]/g, "");
    let p = 0;
    const bytes: number[] = [];
    while (p < clean.length) {
      const enc1 = this.b64chars.indexOf(clean.charAt(p++));
      const enc2 = this.b64chars.indexOf(clean.charAt(p++));
      const enc3 = this.b64chars.indexOf(clean.charAt(p++));
      const enc4 = this.b64chars.indexOf(clean.charAt(p++));
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      bytes.push(chr1);
      if (enc3 !== 64) bytes.push(chr2);
      if (enc4 !== 64) bytes.push(chr3);
    }
    return new Uint8Array(bytes);
  }
  private static bytesToBase64(bytes: Uint8Array): string {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const b1 = bytes[i] || 0;
      const b2 = bytes[i + 1] || 0;
      const b3 = bytes[i + 2] || 0;
      const enc1 = b1 >> 2;
      const enc2 = ((b1 & 3) << 4) | (b2 >> 4);
      const enc3 = ((b2 & 15) << 2) | (b3 >> 6);
      const enc4 = b3 & 63;
      if (i + 1 >= bytes.length) {
        out += this.b64chars.charAt(enc1) + this.b64chars.charAt(enc2) + "==";
      } else if (i + 2 >= bytes.length) {
        out += this.b64chars.charAt(enc1) + this.b64chars.charAt(enc2) + this.b64chars.charAt(enc3) + "=";
      } else {
        out += this.b64chars.charAt(enc1) + this.b64chars.charAt(enc2) + this.b64chars.charAt(enc3) + this.b64chars.charAt(enc4);
      }
    }
    return out;
  }

  static async readWAVFile(uri: string): Promise<AudioBuffer | null> {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error("Audio file not found");

      const ext = (uri.split(".").pop() || "").toLowerCase();
      if (ext !== "wav") {
        throw new Error("Only WAV input supported for processing");
      }

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const bytes = this.base64ToBytes(base64);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

      // Parse RIFF/WAVE
      const riff = view.getUint32(0, true);
      const wave = view.getUint32(8, true);
      if (riff !== 0x46464952 || wave !== 0x45564157) {
        throw new Error("Invalid WAV header");
      }

      let offset = 12; // skip RIFF + WAVE
      let fmtFound = false;
      let dataFound = false;
      let audioFormat = 1;
      let numChannels = 1;
      let sampleRate = 44100;
      let bitsPerSample = 16;
      let dataOffset = 0;
      let dataSize = 0;

      while (offset + 8 <= view.byteLength) {
        const chunkId = view.getUint32(offset, true); // e.g. 'fmt ' or 'data'
        const chunkSize = view.getUint32(offset + 4, true);
        offset += 8;
        if (chunkId === 0x20746d66) { // 'fmt '
          fmtFound = true;
          audioFormat = view.getUint16(offset, true);
          numChannels = view.getUint16(offset + 2, true);
          sampleRate = view.getUint32(offset + 4, true);
          // skip byteRate(4), blockAlign(2)
          bitsPerSample = view.getUint16(offset + 14, true);
        } else if (chunkId === 0x61746164) { // 'data'
          dataFound = true;
          dataOffset = offset;
          dataSize = chunkSize;
          break;
        }
        offset += chunkSize + (chunkSize % 2); // chunks are word aligned
      }

      if (!fmtFound || !dataFound) throw new Error("WAV missing fmt or data chunk");
      if (audioFormat !== 1 || bitsPerSample !== 16) throw new Error("Only 16-bit PCM supported");

      const bytesPerSample = bitsPerSample / 8;
      const frameCount = Math.floor(dataSize / (numChannels * bytesPerSample));
      const out: AudioBuffer = {
        sampleRate,
        channels: numChannels,
        length: frameCount,
        data: Array.from({ length: numChannels }, () => new Float32Array(frameCount))
      };

      // Read interleaved PCM
      let idx = dataOffset;
      for (let i = 0; i < frameCount; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          const sample = view.getInt16(idx, true);
          out.data[ch][i] = Math.max(-1, Math.min(1, sample / 0x7FFF));
          idx += 2;
        }
      }

      return out;
    } catch (error) {
      console.error("Error reading WAV file:", error);
      return null;
    }
  }

  static async writeWAVFile(buffer: AudioBuffer, outputUri: string): Promise<boolean> {
    try {
      const header = this.createWAVHeader(buffer);
      const pcm = this.convertToInt16PCM(buffer);
      const wav = new Uint8Array(header.length + pcm.length);
      wav.set(header, 0);
      wav.set(pcm, header.length);
      const b64 = this.bytesToBase64(wav);
      await FileSystem.writeAsStringAsync(outputUri, b64, { encoding: FileSystem.EncodingType.Base64 });
      return true;
    } catch (error) {
      console.error("Error writing WAV file:", error);
      return false;
    }
  }

  private static createWAVHeader(buffer: AudioBuffer): Uint8Array {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const sampleRate = buffer.sampleRate;
    const numChannels = buffer.channels;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = buffer.length * numChannels * bitsPerSample / 8;
    // 'RIFF'
    view.setUint32(0, 0x46464952, true);
    view.setUint32(4, 36 + dataSize, true);
    // 'WAVE'
    view.setUint32(8, 0x45564157, true);
    // 'fmt '
    view.setUint32(12, 0x20746d66, true);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    // 'data'
    view.setUint32(36, 0x61746164, true);
    view.setUint32(40, dataSize, true);
    return new Uint8Array(header);
  }

  private static convertToInt16PCM(buffer: AudioBuffer): Uint8Array {
    const out = new Int16Array(buffer.length * buffer.channels);
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < buffer.channels; ch++) {
        const f = Math.max(-1, Math.min(1, buffer.data[ch][i] || 0));
        out[i * buffer.channels + ch] = Math.round(f * 0x7FFF);
      }
    }
    return new Uint8Array(out.buffer);
  }
}

/**
 * Offline audio processor that applies DSP effects to audio files
 */
export class OfflineAudioProcessor {
  private processor: AudioEffectsProcessor;
  private cancelled: boolean = false;

  constructor(effects: AudioEffectsSettings) {
    this.processor = new AudioEffectsProcessor(effects);
  }

  async processAudio(options: OfflineProcessingOptions): Promise<boolean> {
    const { inputUri, outputUri, trimStartMs = 0, trimEndMs, onProgress } = options;
    
    try {
      this.cancelled = false;
      onProgress?.(0.1, "Loading audio file...");

      // Load audio file
      const audioBuffer = await SimpleWAVProcessor.readWAVFile(inputUri);
      if (!audioBuffer) {
        throw new Error("Failed to load audio file");
      }

      onProgress?.(0.2, "Analyzing audio...");

      // Calculate processing parameters
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor((trimStartMs / 1000) * sampleRate);
      const endSample = trimEndMs 
        ? Math.floor((trimEndMs / 1000) * sampleRate)
        : audioBuffer.length;
      
      const processLength = endSample - startSample;
      const processedBuffer: AudioBuffer = {
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.channels,
        length: processLength,
        data: audioBuffer.data.map(() => new Float32Array(processLength))
      };

      onProgress?.(0.3, "Applying audio effects...");

      // Process audio with DSP effects
      const blockSize = 1024; // Process in blocks for better performance
      const totalBlocks = Math.ceil(processLength / blockSize);

      for (let block = 0; block < totalBlocks; block++) {
        if (this.cancelled) {
          throw new Error("Processing cancelled");
        }

        const blockStart = block * blockSize;
        const blockEnd = Math.min(blockStart + blockSize, processLength);
        
        // Process each sample in the block
        for (let i = blockStart; i < blockEnd; i++) {
          const sourceIndex = startSample + i;
          const timeMs = (sourceIndex / sampleRate) * 1000;
          
          // Process each channel
          for (let channel = 0; channel < audioBuffer.channels; channel++) {
            const inputSample = audioBuffer.data[channel][sourceIndex] || 0;
            
            // Apply DSP effects
            const processedSample = this.processor.process(
              Math.abs(inputSample), // Use absolute value for gain processing
              timeMs,
              trimStartMs,
              trimEndMs || (audioBuffer.length / sampleRate) * 1000
            );
            
            // Preserve original sign and apply processed gain
            processedBuffer.data[channel][i] = inputSample >= 0 
              ? processedSample 
              : -processedSample;
          }
        }

        // Update progress
        const progress = 0.3 + (block / totalBlocks) * 0.5;
        onProgress?.(progress, `Processing audio... ${Math.round((block / totalBlocks) * 100)}%`);
      }

      onProgress?.(0.8, "Saving processed audio...");

      // Save processed audio
      const success = await SimpleWAVProcessor.writeWAVFile(processedBuffer, outputUri);
      if (!success) {
        throw new Error("Failed to save processed audio");
      }

      onProgress?.(1.0, "Processing complete");
      return true;

    } catch (error) {
      console.error("Offline processing error:", error);
      onProgress?.(0, `Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
    }
  }

  cancel(): void {
    this.cancelled = true;
  }
}

/**
 * High-level interface for offline audio processing
 */
export async function processAudioOffline(options: OfflineProcessingOptions): Promise<boolean> {
  const processor = new OfflineAudioProcessor(options.effects);
  return processor.processAudio(options);
}

/**
 * Utility function to create a temporary output file path
 */
export function createTempAudioPath(prefix: string = "processed"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${FileSystem.documentDirectory}${prefix}_${timestamp}_${random}.wav`;
}

/**
 * Estimate processing time based on audio duration and effects complexity
 */
export function estimateProcessingTime(durationMs: number, effects: AudioEffectsSettings): number {
  let complexity = 1;
  
  if (effects.eq?.enabled) complexity += 0.5;
  if (effects.compressor?.enabled) complexity += 0.3;
  if (effects.noiseGate?.enabled) complexity += 0.2;
  
  // Base processing time: ~10% of audio duration for simple effects
  const baseTime = durationMs * 0.1 * complexity;
  
  // Add overhead for file I/O
  const overhead = Math.min(5000, durationMs * 0.05);
  
  return baseTime + overhead;
}