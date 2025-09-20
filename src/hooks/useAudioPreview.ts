import { useState, useEffect } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

export type AudioPreviewState = {
  sound: Audio.Sound | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  isLoading: boolean;
  error: string | null;
};

export type AudioPreviewActions = {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  toggle: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  stop: () => Promise<void>;
};

export type UseAudioPreviewReturn = AudioPreviewState & AudioPreviewActions;

export function useAudioPreview(
  recordings: Array<{ id: string; uri: string }>,
  previewId: string | null
): UseAudioPreviewReturn {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Load audio when preview ID changes
  useEffect(() => {
    let active: Audio.Sound | null = null;
    let cancelled = false;

    async function loadAudio() {
      if (!previewId) {
        setSound(null);
        setIsPlaying(false);
        setPositionMs(0);
        setDurationMs(0);
        setError(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const recording = recordings.find(r => r.id === previewId);
        if (!recording?.uri) {
          throw new Error("Recording not found");
        }

        // Check if file exists
        const info = await FileSystem.getInfoAsync(recording.uri);
        if (!info.exists) {
          throw new Error("Audio file not found");
        }

        if (cancelled) return;

        // Set audio mode for playback
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false
          } as any);
        } catch (audioModeError) {
          console.warn("Failed to set audio mode:", audioModeError);
        }

        // Create audio sound
        const { sound: newSound, status } = await Audio.Sound.createAsync(
          { uri: recording.uri },
          { 
            shouldPlay: false, 
            progressUpdateIntervalMillis: 200,
            volume: 1.0,
            rate: 1.0,
            shouldCorrectPitch: false
          }
        );

        if (cancelled) {
          await newSound.unloadAsync();
          return;
        }

        active = newSound;
        setSound(newSound);

        // Set initial duration
        const st: any = status;
        if (st?.isLoaded && typeof st?.durationMillis === "number") {
          setDurationMs(st.durationMillis);
        }

        // Set up playback status updates
        newSound.setOnPlaybackStatusUpdate((s: any) => {
          if (!s?.isLoaded || cancelled) return;
          
          if (typeof s.positionMillis === "number") {
            setPositionMs(s.positionMillis);
          }
          if (typeof s.durationMillis === "number") {
            setDurationMs(s.durationMillis);
          }
          if (typeof s.isPlaying === "boolean") {
            setIsPlaying(s.isPlaying);
          }
          if (s.didJustFinish) {
            setIsPlaying(false);
            setPositionMs(0);
          }
        });

      } catch (err) {
        console.error("Failed to load audio preview:", err);
        setError(err instanceof Error ? err.message : "Failed to load audio");
      } finally {
        setIsLoading(false);
      }
    }

    loadAudio();

    return () => {
      cancelled = true;
      if (active) {
        active.unloadAsync().catch(() => {});
      }
      setSound(null);
      setIsPlaying(false);
      setPositionMs(0);
      setDurationMs(0);
    };
  }, [previewId, recordings]);



  const play = async () => {
    if (!sound) return;
    try {
      await sound.playAsync();
    } catch (error) {
      console.error("Failed to play audio:", error);
      setError("Failed to play audio");
    }
  };

  const pause = async () => {
    if (!sound) return;
    try {
      await sound.pauseAsync();
    } catch (error) {
      console.error("Failed to pause audio:", error);
      setError("Failed to pause audio");
    }
  };

  const toggle = async () => {
    if (!sound) return;
    try {
      const status: any = await sound.getStatusAsync();
      if (status?.isLoaded) {
        if (status.isPlaying) {
          await sound.pauseAsync();
        } else {
          await sound.playAsync();
        }
      }
    } catch (error) {
      console.error("Failed to toggle audio:", error);
      setError("Failed to toggle audio");
    }
  };

  const seek = async (positionMs: number) => {
    if (!sound) return;
    try {
      await sound.setPositionAsync(positionMs);
    } catch (error) {
      console.error("Failed to seek audio:", error);
      setError("Failed to seek audio");
    }
  };

  const stop = async () => {
    if (!sound) return;
    try {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
    } catch (error) {
      console.error("Failed to stop audio:", error);
      setError("Failed to stop audio");
    }
  };

  return {
    sound,
    isPlaying,
    positionMs,
    durationMs,
    isLoading,
    error,
    play,
    pause,
    toggle,
    seek,
    stop
  };
}