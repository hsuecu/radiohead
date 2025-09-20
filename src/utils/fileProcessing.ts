import * as FileSystem from "expo-file-system";
import { getAudioFileInfo } from "./audioFileManager";

export type FileProcessingResult = {
  uri: string;
  name: string;
  size: number;
  durationMs: number;
  isValid: boolean;
  error?: string;
};

export type FileValidationOptions = {
  maxSizeBytes?: number;
  maxDurationMs?: number;
  allowedFormats?: string[];
  timeoutMs?: number;
};

const DEFAULT_OPTIONS: Required<FileValidationOptions> = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  maxDurationMs: 600000, // 10 minutes
  allowedFormats: ["mp3", "m4a", "wav", "aac"],
  timeoutMs: 10000, // 10 seconds
};

// Fast file validation without audio processing
export async function validateFileQuick(
  uri: string, 
  name: string, 
  size: number,
  options: FileValidationOptions = {}
): Promise<{ isValid: boolean; error?: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Check file size
  if (size > opts.maxSizeBytes) {
    return { 
      isValid: false, 
      error: `File too large (max ${Math.round(opts.maxSizeBytes / 1024 / 1024)}MB)` 
    };
  }
  
  if (size === 0) {
    return { isValid: false, error: "File is empty" };
  }
  
  // Check file format
  const extension = name.toLowerCase().split('.').pop();
  if (extension && !opts.allowedFormats.includes(extension)) {
    return { 
      isValid: false, 
      error: `Unsupported format. Allowed: ${opts.allowedFormats.join(', ')}` 
    };
  }
  
  // Check if file exists and is accessible
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      return { isValid: false, error: "File not accessible" };
    }
  } catch (error) {
    return { isValid: false, error: "File access error" };
  }
  
  return { isValid: true };
}

// Background audio file processing with progress callback
export async function processAudioFileAsync(
  uri: string,
  name: string,
  size: number,
  onProgress?: (progress: number, status: string) => void,
  options: FileValidationOptions = {}
): Promise<FileProcessingResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    onProgress?.(0.1, "Validating file...");
    
    // Quick validation first
    const quickValidation = await validateFileQuick(uri, name, size, options);
    if (!quickValidation.isValid) {
      return {
        uri,
        name,
        size,
        durationMs: 0,
        isValid: false,
        error: quickValidation.error,
      };
    }
    
    onProgress?.(0.3, "Reading audio metadata...");
    
    // Get audio file info with timeout
    let audioInfo;
    try {
      audioInfo = await Promise.race([
        getAudioFileInfo(uri),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), opts.timeoutMs)
        )
      ]);
      
      onProgress?.(0.7, "Processing audio data...");
      
    } catch (error) {
      console.warn("Audio info timeout, using fallback:", error);
      // Fallback: estimate duration based on file size and format
      const estimatedDuration = estimateDurationFromSize(size, name);
      audioInfo = {
        uri,
        exists: true,
        size,
        durationMs: estimatedDuration,
      };
    }
    
    onProgress?.(0.9, "Finalizing...");
    
    // Validate duration
    const durationMs = audioInfo.durationMs || 0;
    if (durationMs > opts.maxDurationMs) {
      return {
        uri,
        name,
        size,
        durationMs,
        isValid: false,
        error: `Audio too long (max ${Math.round(opts.maxDurationMs / 60000)} minutes)`,
      };
    }
    
    onProgress?.(1.0, "Complete");
    
    return {
      uri,
      name,
      size,
      durationMs,
      isValid: true,
    };
    
  } catch (error) {
    console.error("File processing error:", error);
    return {
      uri,
      name,
      size,
      durationMs: 0,
      isValid: false,
      error: error instanceof Error ? error.message : "Processing failed",
    };
  }
}

// Estimate audio duration based on file size and format
function estimateDurationFromSize(sizeBytes: number, filename: string): number {
  const extension = filename.toLowerCase().split('.').pop();
  
  // Rough estimates based on typical bitrates
  const bitrateEstimates: Record<string, number> = {
    mp3: 128000, // 128 kbps
    m4a: 128000, // 128 kbps
    aac: 128000, // 128 kbps
    wav: 1411200, // 16-bit 44.1kHz stereo
  };
  
  const estimatedBitrate = bitrateEstimates[extension || 'mp3'] || 128000;
  const durationSeconds = (sizeBytes * 8) / estimatedBitrate;
  
  // Cap at reasonable limits
  return Math.min(Math.max(durationSeconds * 1000, 1000), 600000); // 1s to 10min
}

// Batch process multiple files
export async function processMultipleFilesAsync(
  files: Array<{ uri: string; name: string; size: number }>,
  onProgress?: (fileIndex: number, fileProgress: number, status: string) => void,
  options: FileValidationOptions = {}
): Promise<FileProcessingResult[]> {
  const results: FileProcessingResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    const result = await processAudioFileAsync(
      file.uri,
      file.name,
      file.size,
      (progress, status) => onProgress?.(i, progress, status),
      options
    );
    
    results.push(result);
  }
  
  return results;
}

// Cache for processed file metadata
const fileMetadataCache = new Map<string, FileProcessingResult>();

export function getCachedFileMetadata(uri: string): FileProcessingResult | null {
  return fileMetadataCache.get(uri) || null;
}

export function setCachedFileMetadata(uri: string, metadata: FileProcessingResult): void {
  fileMetadataCache.set(uri, metadata);
  
  // Limit cache size
  if (fileMetadataCache.size > 100) {
    const firstKey = fileMetadataCache.keys().next().value;
    if (firstKey) {
      fileMetadataCache.delete(firstKey);
    }
  }
}

export function clearFileMetadataCache(): void {
  fileMetadataCache.clear();
}