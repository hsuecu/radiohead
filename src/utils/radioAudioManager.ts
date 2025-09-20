import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { useRadioStore, RadioPlaybackState, RadioStreamConfig } from "../state/radioStore";

class RadioAudioManager {
  private sound: Audio.Sound | null = null;

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private metadataInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  // Guards to prevent redundant store updates
  private lastPlaybackState: RadioPlaybackState | null = null;
  private lastBufferHealth: number = -1;
  private lastBufferAt: number = 0;

  // Concurrency and intent guards
  private op: Promise<void> | null = null;
  private currentLoadId = 0;
  private shouldAutoplay = false;

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.op || Promise.resolve();
    const run = prev.then(fn, fn);
    this.op = run.then(() => undefined, () => undefined);
    return run;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Configure audio session for background playback and streaming
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      });

      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize radio audio manager:", error);
      throw error;
    }
  }

  private async unloadSilently(): Promise<void> {
    this.stopMetadataPolling();
    this.clearReconnectTimeout();
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (e) {
        console.error("Error unloading sound:", e);
      }
      this.sound = null;
    }
  }

  async loadStream(config: RadioStreamConfig): Promise<void> {
    return this.withLock(async () => {
      await this.initialize();

      const myId = ++this.currentLoadId;

      try {
        // Do not reset store to stopped during a switch
        await this.unloadSilently();

        // Create new sound instance
        this.sound = new Audio.Sound();

        // Set up status update listener
        this.sound.setOnPlaybackStatusUpdate(this.handlePlaybackStatusUpdate.bind(this));

        // Load the stream (try fallbacks if provided)
        const urls = [config.url, ...(config.fallbackUrls || [])];
        const initialStatus = {
          shouldPlay: false,
          volume: useRadioStore.getState().volume,
          isMuted: useRadioStore.getState().muted,
          isLooping: false,
          progressUpdateIntervalMillis: 1000,
        } as const;

        useRadioStore.getState().updatePlaybackState("loading");
        useRadioStore.getState().updateConnectionStatus("connecting");

        let lastError: any = null;
        let loaded = false;
        for (const url of urls) {
          try {
            if (this.currentLoadId !== myId) break; // stale
            await this.sound.loadAsync({ uri: url }, initialStatus);
            const st = await this.sound.getStatusAsync();
            if ((st as AVPlaybackStatusSuccess).isLoaded) {
              loaded = true;
              break;
            }
          } catch (e) {
            lastError = e;
            // Try next URL if available
          }
        }

        if (!loaded) {
          throw lastError || new Error("Failed to load radio stream");
        }

        if (this.currentLoadId !== myId) {
          // Another load started; discard this
          await this.unloadSilently();
          return;
        }

        useRadioStore.getState().updateConnectionStatus("connected");
        this.reconnectAttempts = 0;
      } catch (error) {
        console.error("Failed to load radio stream:", error);
        useRadioStore.getState().updatePlaybackState("error");
        useRadioStore.getState().updateConnectionStatus("error");

        // Attempt reconnection if enabled
        if (useRadioStore.getState().autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect(config);
        }

        throw error;
      }
    });
  }

  async play(): Promise<void> {
    return this.withLock(async () => {
      if (!this.sound) {
        // If nothing loaded, try to load current stream
        const cfg = useRadioStore.getState().getCurrentStreamConfig();
        if (cfg) {
          await this.loadStream(cfg);
        } else {
          throw new Error("No stream loaded");
        }
      }

      try {
        // Ensure isLoaded before calling play
        let isLoaded = false;
        for (let i = 0; i < 60; i++) { // up to ~3s
          const st = await this.sound!.getStatusAsync();
          if ((st as AVPlaybackStatusSuccess).isLoaded) {
            isLoaded = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 50));
        }
        if (!isLoaded) {
          throw new Error("Cannot play: sound not loaded");
        }

        this.shouldAutoplay = true;
        await this.sound!.playAsync();
        this.startMetadataPolling();
      } catch (error) {
        console.error("Failed to play radio stream:", error);
        useRadioStore.getState().updatePlaybackState("error");
        throw error;
      }
    });
  }

  async pause(): Promise<void> {
    return this.withLock(async () => {
      if (!this.sound) return;

      try {
        this.shouldAutoplay = false;
        await this.sound.pauseAsync();
        this.stopMetadataPolling();
      } catch (error) {
        console.error("Failed to pause radio stream:", error);
        throw error;
      }
    });
  }

  async stop(): Promise<void> {
    return this.withLock(async () => {
      this.shouldAutoplay = false;
      await this.unloadSilently();

      useRadioStore.getState().updatePlaybackState("stopped");
      useRadioStore.getState().updateConnectionStatus("disconnected");
      useRadioStore.getState().updateBufferHealth(0);
    });
  }

  async setVolume(volume: number): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.setVolumeAsync(Math.max(0, Math.min(1, volume)));
    } catch (error) {
      console.error("Failed to set volume:", error);
    }
  }

  async setMuted(muted: boolean): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.setIsMutedAsync(muted);
    } catch (error) {
      console.error("Failed to set mute state:", error);
    }
  }

  private handlePlaybackStatusUpdate(status: AVPlaybackStatus): void {
    if (!status.isLoaded) {
      if ((status as any).error) {
        console.error("Playback error:", (status as any).error);
        useRadioStore.getState().updatePlaybackState("error");
        useRadioStore.getState().updateConnectionStatus("error");

        // Attempt reconnection
        const currentConfig = useRadioStore.getState().getCurrentStreamConfig();
        if (currentConfig && useRadioStore.getState().autoReconnect) {
          this.scheduleReconnect(currentConfig);
        }
      }
      return;
    }

    const successStatus = status as AVPlaybackStatusSuccess;

    // Update playback state
    let newState: RadioPlaybackState;
    if (successStatus.isPlaying) {
      newState = "playing";
    } else if (successStatus.isBuffering) {
      newState = "buffering";
    } else {
      newState = "paused";
    }

    // Only update playback state if changed
    if (this.lastPlaybackState !== newState) {
      this.lastPlaybackState = newState;
      useRadioStore.getState().updatePlaybackState(newState);
    }

    // Update buffer health (estimate based on playable duration), throttled
    const nowTs = Date.now();
    let nextBuffer = this.lastBufferHealth;
    if (successStatus.playableDurationMillis && successStatus.durationMillis) {
      nextBuffer = Math.min(100,
        (successStatus.playableDurationMillis / Math.max(successStatus.durationMillis, 30000)) * 100
      );
    } else if (successStatus.isPlaying && !successStatus.isBuffering) {
      nextBuffer = 100;
    }

    if (
      typeof nextBuffer === "number" &&
      (this.lastBufferHealth < 0 || Math.abs(nextBuffer - this.lastBufferHealth) > 2) &&
      nowTs - this.lastBufferAt > 500
    ) {
      this.lastBufferHealth = nextBuffer;
      this.lastBufferAt = nowTs;
      useRadioStore.getState().updateBufferHealth(nextBuffer);
    }

    // Handle stream interruptions
    if (successStatus.didJustFinish) {
      // Stream ended unexpectedly, attempt reconnection
      const currentConfig = useRadioStore.getState().getCurrentStreamConfig();
      if (currentConfig && useRadioStore.getState().autoReconnect) {
        this.scheduleReconnect(currentConfig);
      }
    }
  }

  private scheduleReconnect(config: RadioStreamConfig): void {
    if (this.reconnectTimeout) return;

    this.reconnectAttempts++;
    const delay = Math.min(5000 * this.reconnectAttempts, 30000); // Exponential backoff, max 30s

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;

      try {
        await this.loadStream(config);
        if (this.shouldAutoplay) {
          await this.play();
        }
      } catch (error) {
        console.error("Reconnect attempt failed:", error);
      }
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
  }

  private startMetadataPolling(): void {
    // Poll for metadata updates every 10 seconds
    this.metadataInterval = setInterval(() => {
      this.updateMetadata();
    }, 10000);
  }

  private stopMetadataPolling(): void {
    if (this.metadataInterval) {
      clearInterval(this.metadataInterval);
      this.metadataInterval = null;
    }
  }

  private async updateMetadata(): Promise<void> {
    // In a real implementation, this would fetch ICY metadata from the stream
    // For now, we'll simulate metadata updates
    const mockMetadata = {
      title: "Live Radio Stream",
      artist: "Various Artists",
      station: useRadioStore.getState().getCurrentStreamConfig()?.name || "Radio Station",
      nowPlaying: `Now Playing - ${new Date().toLocaleTimeString()}`
    };

    useRadioStore.getState().updateMetadata(mockMetadata);
  }

  // Public method to get current playback status
  async getStatus(): Promise<AVPlaybackStatus | null> {
    if (!this.sound) return null;

    try {
      return await this.sound.getStatusAsync();
    } catch (error) {
      console.error("Failed to get playback status:", error);
      return null;
    }
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    await this.stop();
    this.isInitialized = false;
  }
}

// Singleton instance
export const radioAudioManager = new RadioAudioManager();

// Hook for React components to interact with the radio manager
export function useRadioAudioManager() {
  const playStream = async (stationId?: string) => {
    const store = useRadioStore.getState();
    try {
      // Debounce if already loading/connecting
      if (store.playbackState === "loading" || store.connectionStatus === "connecting") return;

      const targetStationId = stationId || store.currentStationId;
      if (!targetStationId) return;

      store.play(targetStationId);

      const config = store.streamsByStation[targetStationId];
      if (!config) {
        throw new Error("No stream configuration found for station");
      }

      await radioAudioManager.loadStream(config);
      await radioAudioManager.play();
    } catch (error) {
      console.error("Failed to play stream:", error);
      useRadioStore.getState().updatePlaybackState("error");
    }
  };

  const pauseStream = async () => {
    const store = useRadioStore.getState();
    try {
      store.pause();
      await radioAudioManager.pause();
    } catch (error) {
      console.error("Failed to pause stream:", error);
    }
  };

  const stopStream = async () => {
    const store = useRadioStore.getState();
    try {
      store.stop();
      await radioAudioManager.stop();
    } catch (error) {
      console.error("Failed to stop stream:", error);
    }
  };

  const setStreamVolume = async (volume: number) => {
    const store = useRadioStore.getState();
    try {
      store.setVolume(volume);
      await radioAudioManager.setVolume(volume);
    } catch (error) {
      console.error("Failed to set volume:", error);
    }
  };

  const toggleStreamMute = async () => {
    const store = useRadioStore.getState();
    try {
      store.toggleMute();
      await radioAudioManager.setMuted(store.muted);
    } catch (error) {
      console.error("Failed to toggle mute:", error);
    }
  };

  return {
    playStream,
    pauseStream,
    stopStream,
    setStreamVolume,
    toggleStreamMute,
    manager: radioAudioManager
  };
}
