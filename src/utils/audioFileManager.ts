import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";

/**
 * Unified file management utilities for consistent audio file handling
 * Eliminates duplication and ensures proper cleanup
 */

export interface AudioFileInfo {
  uri: string;
  size: number;
  exists: boolean;
  durationMs?: number;
}

export interface TempFileManager {
  uri: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates a temporary file that will be automatically cleaned up
 */
export async function createTempFile(extension: string = "m4a"): Promise<TempFileManager> {
  const tempDir = `${FileSystem.cacheDirectory}temp/`;
  await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
  
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const uri = `${tempDir}${timestamp}_${randomId}.${extension}`;
  
  return {
    uri,
    cleanup: async () => {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (error) {
        console.warn("Failed to cleanup temp file:", uri, error);
      }
    }
  };
}

/**
 * Safely moves a file from source to destination, ensuring no duplication
 */
export async function moveAudioFile(
  sourceUri: string, 
  destinationUri: string,
  overwrite: boolean = false
): Promise<boolean> {
  try {
    // Check if source exists
    const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
    if (!sourceInfo.exists) {
      throw new Error(`Source file does not exist: ${sourceUri}`);
    }

    // Check if destination exists
    const destInfo = await FileSystem.getInfoAsync(destinationUri);
    if (destInfo.exists && !overwrite) {
      throw new Error(`Destination file already exists: ${destinationUri}`);
    }

    // Ensure destination directory exists
    const destDir = destinationUri.substring(0, destinationUri.lastIndexOf('/'));
    await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });

    // Move the file
    await FileSystem.moveAsync({
      from: sourceUri,
      to: destinationUri
    });

    return true;
  } catch (error) {
    console.error("Failed to move audio file:", error);
    return false;
  }
}

/**
 * Gets comprehensive information about an audio file
 */
export async function getAudioFileInfo(uri: string): Promise<AudioFileInfo> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    
    if (!fileInfo.exists) {
      return {
        uri,
        size: 0,
        exists: false
      };
    }

    let durationMs: number | undefined;
    
    // Try to get duration from audio metadata
    try {
      const { sound, status } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
      const audioStatus = status as any;
      if (audioStatus?.isLoaded && typeof audioStatus.durationMillis === "number") {
        durationMs = audioStatus.durationMillis;
      }
      await sound.unloadAsync();
    } catch (error) {
      console.warn("Could not get audio duration:", error);
    }

    return {
      uri,
      size: fileInfo.size || 0,
      exists: true,
      durationMs
    };
  } catch (error) {
    console.error("Failed to get audio file info:", error);
    return {
      uri,
      size: 0,
      exists: false
    };
  }
}

/**
 * Safely deletes an audio file with proper error handling
 */
export async function deleteAudioFile(uri: string): Promise<boolean> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    return true;
  } catch (error) {
    console.error("Failed to delete audio file:", uri, error);
    return false;
  }
}

/**
 * Cleans up orphaned temporary files older than specified age
 */
export async function cleanupOldTempFiles(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  try {
    const tempDir = `${FileSystem.cacheDirectory}temp/`;
    const dirInfo = await FileSystem.getInfoAsync(tempDir);
    
    if (!dirInfo.exists) {
      return 0;
    }

    const files = await FileSystem.readDirectoryAsync(tempDir);
    const now = Date.now();
    let deletedCount = 0;

    for (const filename of files) {
      const filePath = `${tempDir}${filename}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (fileInfo.exists && fileInfo.modificationTime) {
        const fileAge = now - fileInfo.modificationTime * 1000; // Convert to ms
        
        if (fileAge > maxAgeMs) {
          const deleted = await deleteAudioFile(filePath);
          if (deleted) {
            deletedCount++;
          }
        }
      }
    }

    return deletedCount;
  } catch (error) {
    console.error("Failed to cleanup old temp files:", error);
    return 0;
  }
}

/**
 * Validates that an audio file is not corrupted and can be played
 */
export async function validateAudioFile(uri: string): Promise<boolean> {
  try {
    const { sound, status } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
    const audioStatus = status as any;
    const isValid = audioStatus?.isLoaded === true;
    await sound.unloadAsync();
    return isValid;
  } catch (error) {
    console.error("Audio file validation failed:", uri, error);
    return false;
  }
}

/**
 * Creates a unique filename for recordings to prevent conflicts
 */
export function generateUniqueFilename(
  stationId: string,
  categoryCode: string,
  userPrefix: string,
  extension: string = "m4a"
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${stationId}_${categoryCode}_${userPrefix}_${timestamp}_${randomSuffix}.${extension}`;
}

/**
 * Ensures a directory exists for storing recordings
 */
export async function ensureRecordingDirectory(stationId: string): Promise<string> {
  const dir = `${FileSystem.documentDirectory}stations/${stationId}/recordings`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

/**
 * Gets the total size of all recordings for a station
 */
export async function getStationStorageUsage(stationId: string): Promise<number> {
  try {
    const dir = await ensureRecordingDirectory(stationId);
    const files = await FileSystem.readDirectoryAsync(dir);
    let totalSize = 0;

    for (const filename of files) {
      const filePath = `${dir}/${filename}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists && fileInfo.size) {
        totalSize += fileInfo.size;
      }
    }

    return totalSize;
  } catch (error) {
    console.error("Failed to calculate storage usage:", error);
    return 0;
  }
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Formats duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
}