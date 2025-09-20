import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { Audio } from "expo-av";

export type RecordStatus = "idle" | "recording" | "saving" | "error" | "permission_denied";

export interface RecordingResult {
  success: boolean;
  assetUri?: string;
  error?: string;
  savedToAlbum?: boolean;
}

class StreamRecorder {
  private download: FileSystem.DownloadResumable | null = null;
  private recording: Audio.Recording | null = null;
  private startTs: number = 0;
  private fileUri: string | null = null;
  private status: RecordStatus = "idle";
  private bytes: number = 0;
  private lastError: string | null = null;
  private recordingMethod: "download" | "audio" = "download";

  getStatus() {
    return { 
      status: this.status, 
      fileUri: this.fileUri, 
      durationMs: this.startTs ? Date.now() - this.startTs : 0, 
      bytes: this.bytes,
      sizeMB: this.bytes / (1024 * 1024),
      method: this.recordingMethod,
      error: this.lastError
    };
  }

  async start(url: string, mode: "auto" | "stream" | "mic" = "auto"): Promise<boolean> {
    if (this.status === "recording") return false;
    
    try {
      console.log("🎙️ Starting recording process...");
      console.log("Stream URL:", url);
      
      // Pre-recording validation
      const validationResult = await this.validateRecordingSetup(url);
      if (!validationResult.success) {
        this.status = "error";
        this.lastError = validationResult.error || "Validation failed";
        console.error("❌ Recording validation failed:", this.lastError);
        return false;
      }
      
      const isHls = url.includes(".m3u8");
      if (mode === "mic" || (mode === "auto" && isHls)) {
        console.log(isHls ? "HLS detected; using Mic mode" : "Mic mode selected");
        this.status = "recording";
        this.startTs = Date.now();
        this.lastError = null;
        this.bytes = 0;
        const ok = await this.startAlternativeRecording(url);
        return ok;
      }

      this.status = "recording";
      this.startTs = Date.now();
      this.lastError = null;
      this.bytes = 0;
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `radio_capture_${timestamp}.mp3`;
      this.fileUri = FileSystem.documentDirectory + filename;
      
      console.log("📁 Recording to:", this.fileUri);
      console.log("🕐 Start time:", new Date(this.startTs).toISOString());
      
      this.download = FileSystem.createDownloadResumable(
        url, 
        this.fileUri, 
        {
          headers: {
            'User-Agent': 'RadioApp/1.0',
            'Accept': 'audio/*',
            'Connection': 'keep-alive'
          }
        }, 
        (prog) => {
          this.bytes = prog.totalBytesWritten ?? 0;
          const sizeMB = this.bytes / (1024 * 1024);
          const durationSec = Math.floor((Date.now() - this.startTs) / 1000);
          console.log(`📊 Recording: ${sizeMB.toFixed(2)} MB, ${durationSec}s`);
        }
      );
      
      // Start download with better error handling
      this.recordingMethod = "download";
      this.download.downloadAsync()
        .then((result) => {
          console.log("✅ Download completed:", result);
        })
        .catch(async (error) => {
          console.error("❌ Download method failed:", error);
          console.log("🔄 Attempting alternative recording method...");
          
          // Try alternative recording method
          const altSuccess = await this.startAlternativeRecording(url);
          if (!altSuccess) {
            this.status = "error";
            this.lastError = `Both recording methods failed. Download: ${error.message}`;
          }
        });
      
      // Verify recording started successfully (and auto-fallback in Auto mode)
      setTimeout(async () => {
        if (this.status === "recording" && this.recordingMethod === "download") {
          const info = await FileSystem.getInfoAsync(this.fileUri!, { size: true });
          const size = (info as any).size ?? 0;
          if (!info.exists || size === 0) {
            console.warn("⚠️ No data written after 3 seconds");
            if (mode === "auto") {
              try {
                console.log("🔄 Auto-fallback to Mic mode...");
                if (this.download) {
                  try { await this.download.pauseAsync(); } catch {}
                }
                const ok = await this.startAlternativeRecording(url);
                if (!ok) {
                  this.status = "error";
                  this.lastError = "Fallback to microphone failed";
                }
              } catch (e: any) {
                this.status = "error";
                this.lastError = e?.message || "Auto-fallback failed";
              }
            } else {
              this.status = "error";
              this.lastError = "No data received from stream. Check stream URL and connection.";
            }
          } else {
            console.log("✅ Recording confirmed active, file size:", size, "bytes");
          }
        }
      }, 3000);
      
      return true;
    } catch (error: any) {
      console.error("❌ Failed to start recording:", error);
      this.status = "error";
      this.lastError = `Start failed: ${error.message}`;
      return false;
    }
  }

  private async validateRecordingSetup(url: string): Promise<{success: boolean, error?: string}> {
    try {
      console.log("🔍 Validating recording setup...");
      
      // Check media library permissions
      const mediaPermission = await MediaLibrary.getPermissionsAsync();
      if (!mediaPermission.granted) {
        console.log("📱 Requesting media library permissions...");
        const requestResult = await MediaLibrary.requestPermissionsAsync();
        if (!requestResult.granted) {
          return { success: false, error: "Media library permission required to save recordings" };
        }
      }
      console.log("✅ Media library permissions granted");
      
      // Check available storage space
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      const freeSpaceMB = freeSpace / (1024 * 1024);
      console.log(`💾 Available storage: ${freeSpaceMB.toFixed(0)} MB`);
      
      if (freeSpaceMB < 50) {
        return { success: false, error: `Insufficient storage space (${freeSpaceMB.toFixed(0)} MB available, need at least 50 MB)` };
      }
      
      // Test stream URL accessibility
      console.log("🌐 Testing stream URL accessibility...");
      try {
        const response = await fetch(url, { 
          method: 'HEAD',
          headers: {
            'User-Agent': 'RadioApp/1.0'
          }
        });
        
        if (!response.ok) {
          return { success: false, error: `Stream not accessible (HTTP ${response.status})` };
        }
        
        const contentType = response.headers.get('content-type');
        console.log("📻 Stream content type:", contentType);
        
        if (contentType && !contentType.includes('audio') && !contentType.includes('application/octet-stream')) {
          console.warn("⚠️ Unexpected content type, but proceeding:", contentType);
        }
        
      } catch (fetchError: any) {
        console.warn("⚠️ Stream URL test failed, but proceeding:", fetchError.message);
        // Don't fail validation for network issues, as the stream might still work
      }
      
      console.log("✅ Recording setup validation passed");
      return { success: true };
      
    } catch (error: any) {
      console.error("❌ Validation error:", error);
      return { success: false, error: `Setup validation failed: ${error.message}` };
    }
  }

  private async startAlternativeRecording(_url: string): Promise<boolean> {
    try {
      console.log("🎤 Starting alternative Audio.Recording method...");
      console.log("⚠️ Note: This records device audio, not the stream directly");
      
      // Request microphone permission and configure audio mode for recording
      const micPerm = await Audio.getPermissionsAsync();
      if (!micPerm.granted) {
        const req = await Audio.requestPermissionsAsync();
        if (!req.granted) {
          this.status = "permission_denied";
          this.lastError = "Microphone permission denied";
          return false;
        }
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      this.recording = new Audio.Recording();
      this.recordingMethod = "audio";
      
      const recordingOptions = Audio.RecordingOptionsPresets.HIGH_QUALITY;

      await this.recording.prepareToRecordAsync(recordingOptions);
      await this.recording.startAsync();
      
      // Update file URI for audio recording
      const uri = this.recording.getURI();
      if (uri) {
        this.fileUri = uri;
        console.log("📁 Audio recording URI:", uri);
      }
      
      console.log("✅ Alternative recording started successfully");
      return true;
      
    } catch (error: any) {
      console.error("❌ Alternative recording failed:", error);
      this.recording = null;
      return false;
    }
  }

  async stopAndSaveToLibrary(): Promise<RecordingResult> {
    if (!this.fileUri) {
      console.error("❌ No active recording to stop");
      return { success: false, error: "No active recording" };
    }

    try {
      this.status = "saving";
      const stopTime = Date.now();
      const actualDurationMs = stopTime - this.startTs;
      const actualDurationSec = Math.floor(actualDurationMs / 1000);
      
      console.log("🛑 Stopping recording...");
      console.log(`⏱️ Recording duration: ${actualDurationSec}s (${actualDurationMs}ms)`);
      console.log(`📊 Recording method: ${this.recordingMethod}`);

      // Stop recording based on method used
      if (this.recordingMethod === "audio" && this.recording) {
        try {
          console.log("⏸️ Stopping audio recording...");
          await this.recording.stopAndUnloadAsync();
          const uri = this.recording.getURI();
          if (uri) {
            this.fileUri = uri;
            console.log("📁 Final audio recording URI:", uri);
          }
          console.log("✅ Audio recording stopped successfully");
        } catch (audioErr: any) {
          console.warn("⚠️ Audio recording stop failed:", audioErr?.message || audioErr);
        }
      } else if (this.download) {
        try {
          console.log("⏸️ Pausing download...");
          await this.download.pauseAsync();
          console.log("✅ Download paused successfully");
        } catch (pauseErr: any) {
          console.warn("⚠️ pauseAsync failed, continuing to save:", pauseErr?.message || pauseErr);
          console.warn("Error details:", pauseErr);
        }
      }

      // Wait a moment for file system to sync
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if file exists and has content
      const info = await FileSystem.getInfoAsync(this.fileUri, { size: true });
      console.log("📁 File info:", {
        exists: info.exists,
        size: info.exists ? (info as any).size : 0,
        uri: info.uri,
        isDirectory: info.isDirectory
      });

      if (!info.exists) {
        this.status = "error";
        this.lastError = "Recording file not found - stream may not have been accessible";
        console.error("❌ Recording file not found at:", this.fileUri);
        return { success: false, error: "Recording file not found - check stream connection" };
      }

      // Check actual recording duration first
      if (actualDurationSec < 3) {
        this.status = "error";
        this.lastError = `Recording too short (${actualDurationSec}s). Try recording at least 5 seconds.`;
        console.error(`❌ Recording too short: ${actualDurationSec}s`);
        return { success: false, error: `Recording too short (${actualDurationSec}s). Try at least 5 seconds.` };
      }

      // Check file size (more lenient threshold)
      const fileSizeKB = Math.round((info.size ?? 0) / 1024);
      const fileSizeMB = (info.size ?? 0) / (1024 * 1024);
      
      console.log(`📊 File size: ${fileSizeMB.toFixed(2)} MB (${fileSizeKB} KB)`);
      
      if ((info.size ?? 0) <= 5 * 1024) { // 5KB minimum instead of 10KB
        this.status = "error";
        this.lastError = `Recording file too small (${fileSizeKB}KB). Stream may not be accessible or compatible.`;
        console.error(`❌ File too small: ${fileSizeKB}KB`);
        return { success: false, error: "Recording failed - no data captured from stream" };
      }

      console.log(`✅ Recording validation passed: ${fileSizeMB.toFixed(2)} MB, ${actualDurationSec}s`);

      // Request media library permissions
      const perm = await MediaLibrary.requestPermissionsAsync();
      console.log("Media library permissions:", perm);

      if (!perm.granted) {
        this.status = "permission_denied";
        this.lastError = "Media library permission denied";
        return { success: false, error: "Permission denied to save to Photos" };
      }

      // Create asset from the recorded file
      console.log("Creating asset from file:", this.fileUri);
      const asset = await MediaLibrary.createAssetAsync(this.fileUri);
      console.log("Created asset:", asset);

      let savedToAlbum = false;

      // Try to create/add to "Radio Captures" album
      try {
        let album = await MediaLibrary.getAlbumAsync("Radio Captures");
        if (!album) {
          console.log("Creating Radio Captures album...");
          album = await MediaLibrary.createAlbumAsync("Radio Captures", asset, false);
          savedToAlbum = true;
        } else {
          console.log("Adding to existing Radio Captures album...");
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          savedToAlbum = true;
        }
      } catch (albumError: any) {
        console.warn("Failed to save to Radio Captures album:", albumError);
        // Asset is still saved to default Photos, just not in custom album
      }

      // Cleanup
      this.status = "idle";
      const resultUri = asset.uri;
      this.download = null;
      this.fileUri = null;
      this.startTs = 0;
      this.bytes = 0;
      this.lastError = null;

      console.log("Recording saved successfully:", resultUri);

      return {
        success: true,
        assetUri: resultUri,
        savedToAlbum
      };

    } catch (error: any) {
      console.error("Failed to save recording:", error);
      this.status = "error";
      this.lastError = error.message;
      return { success: false, error: error.message };
    }
  }

  async cancel(): Promise<void> {
    console.log("🚫 Canceling recording...");
    
    // Stop recording based on method
    if (this.recordingMethod === "audio" && this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
        console.log("✅ Audio recording canceled");
      } catch (error) {
        console.warn("⚠️ Error canceling audio recording:", error);
      }
    } else if (this.download) {
      try {
        await this.download.pauseAsync();
        console.log("✅ Download canceled");
      } catch (error) {
        console.warn("⚠️ Error canceling download:", error);
      }
    }
    
    // Clean up temp file
    if (this.fileUri) {
      try {
        await FileSystem.deleteAsync(this.fileUri, { idempotent: true });
        console.log("🗑️ Temp file deleted");
      } catch (error) {
        console.warn("⚠️ Error deleting temp file:", error);
      }
    }
    
    this.download = null;
    this.recording = null;
    this.fileUri = null;
    this.startTs = 0;
    this.bytes = 0;
    this.status = "idle";
    this.lastError = null;
    this.recordingMethod = "download";
    console.log("✅ Recording canceled and cleaned up");
  }
}

export const streamRecorder = new StreamRecorder();
