import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type StreamQuality = "high" | "medium" | "low";

export type RadioStreamConfig = {
  url: string;
  name?: string;
  quality: StreamQuality;
  fallbackUrls?: string[];
  metadata?: {
    title?: string;
    artist?: string;
    station?: string;
    genre?: string;
    bitrate?: number;
  };
};

export type RadioPlaybackState = "stopped" | "loading" | "playing" | "paused" | "buffering" | "error";

export type RadioStreamStatus = {
  state: RadioPlaybackState;
  position: number;
  duration: number;
  buffering: boolean;
  error?: string;
  metadata?: {
    title?: string;
    artist?: string;
    station?: string;
    nowPlaying?: string;
  };
};

interface RadioState {
  // Stream configuration per station
  streamsByStation: Record<string, RadioStreamConfig>;
  
  // Favorites (max 5)
  favorites: RadioStreamConfig[];
  addFavorite: (config: RadioStreamConfig) => void;
  removeFavorite: (url: string) => void;
  reorderFavorites: (fromIndex: number, toIndex: number) => void;
  setCurrentFromFavorite: (index: number) => void;
  
  // Current playback state
  currentStationId: string | null;
  playbackState: RadioPlaybackState;
  volume: number; // 0.0 - 1.0
  muted: boolean;
  
  // Stream status and metadata
  currentMetadata: RadioStreamStatus["metadata"];
  connectionStatus: "connected" | "connecting" | "disconnected" | "error";
  bufferHealth: number; // 0-100 percentage
  
  // Settings
  backgroundPlayEnabled: boolean;
  autoReconnect: boolean;
  preferredQuality: StreamQuality;
  
  // Actions
  setStreamConfig: (stationId: string, config: RadioStreamConfig) => void;
  removeStreamConfig: (stationId: string) => void;
  
  // Playback controls
  play: (stationId?: string) => void;
  pause: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  
  // Status updates
  updatePlaybackState: (state: RadioPlaybackState) => void;
  updateMetadata: (metadata: RadioStreamStatus["metadata"]) => void;
  updateConnectionStatus: (status: "connected" | "connecting" | "disconnected" | "error") => void;
  updateBufferHealth: (health: number) => void;
  
  // Settings
  setBackgroundPlayEnabled: (enabled: boolean) => void;
  setAutoReconnect: (enabled: boolean) => void;
  setPreferredQuality: (quality: StreamQuality) => void;
  
  // Utility
  getCurrentStreamConfig: () => RadioStreamConfig | null;
  isPlaying: () => boolean;
  isPaused: () => boolean;
  isStopped: () => boolean;
}

export const useRadioStore = create<RadioState>()(
  persist(
    (set, get) => ({
      streamsByStation: {},
      favorites: [],
      currentStationId: null,
      playbackState: "stopped",
      volume: 0.8,
      muted: false,
      currentMetadata: {},
      connectionStatus: "disconnected",
      bufferHealth: 0,
      backgroundPlayEnabled: true,
      autoReconnect: true,
      preferredQuality: "high",

      addFavorite: (config) => set((state) => {
        const exists = state.favorites.some((f) => f.url === config.url);
        if (exists) return state;
        const next = state.favorites.slice(0, 5);
        next.unshift(config);
        return { favorites: next.slice(0, 5) } as any;
      }),

      removeFavorite: (url) => set((state) => ({
        favorites: state.favorites.filter((f) => f.url !== url)
      })),

      reorderFavorites: (from, to) => set((state) => {
        const next = state.favorites.slice();
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return { favorites: next } as any;
      }),

      setCurrentFromFavorite: (index) => set((state) => {
        const f = state.favorites[index];
        if (!f) return state;
        // map to current station if any
        const stationId = state.currentStationId || Object.keys(state.streamsByStation)[0] || "station-a";
        return {
          streamsByStation: { ...state.streamsByStation, [stationId]: f },
          currentStationId: stationId
        } as any;
      }),

      setStreamConfig: (stationId, config) => set((state) => ({
        streamsByStation: {
          ...state.streamsByStation,
          [stationId]: config
        }
      })),

      removeStreamConfig: (stationId) => set((state) => {
        const { [stationId]: removed, ...remaining } = state.streamsByStation;
        return {
          streamsByStation: remaining,
          currentStationId: state.currentStationId === stationId ? null : state.currentStationId
        };
      }),

      play: (stationId) => set((state) => {
        const targetStationId = stationId || state.currentStationId;
        if (!targetStationId || !state.streamsByStation[targetStationId]) {
          return state;
        }
        
        return {
          currentStationId: targetStationId,
          playbackState: "loading",
          connectionStatus: "connecting"
        };
      }),

      pause: () => set((state) => ({
        playbackState: state.playbackState === "playing" ? "paused" : state.playbackState
      })),

      stop: () => set({
        playbackState: "stopped",
        connectionStatus: "disconnected",
        currentMetadata: {},
        bufferHealth: 0
      }),

      setVolume: (volume) => set({
        volume: Math.max(0, Math.min(1, volume))
      }),

      toggleMute: () => set((state) => ({
        muted: !state.muted
      })),

      updatePlaybackState: (state) => set({
        playbackState: state
      }),

      updateMetadata: (metadata) => set({
        currentMetadata: metadata
      }),

      updateConnectionStatus: (status) => set({
        connectionStatus: status
      }),

      updateBufferHealth: (health) => set({
        bufferHealth: Math.max(0, Math.min(100, health))
      }),

      setBackgroundPlayEnabled: (enabled) => set({
        backgroundPlayEnabled: enabled
      }),

      setAutoReconnect: (enabled) => set({
        autoReconnect: enabled
      }),

      setPreferredQuality: (quality) => set({
        preferredQuality: quality
      }),

      getCurrentStreamConfig: () => {
        const state = get();
        if (!state.currentStationId) return null;
        return state.streamsByStation[state.currentStationId] || null;
      },

      isPlaying: () => get().playbackState === "playing",
      isPaused: () => get().playbackState === "paused",
      isStopped: () => get().playbackState === "stopped"
    }),
    {
      name: "radio-store",
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: async (persisted: any, fromVersion: number) => {
        try {
          const base = persisted || {};
          const safe: any = {
            streamsByStation: base.streamsByStation || {},
            favorites: Array.isArray(base.favorites) ? base.favorites.slice(0, 5) : [],
            currentStationId: base.currentStationId ?? null,
            playbackState: base.playbackState || "stopped",
            volume: typeof base.volume === "number" ? Math.max(0, Math.min(1, base.volume)) : 0.8,
            muted: !!base.muted,
            currentMetadata: base.currentMetadata || {},
            connectionStatus: base.connectionStatus || "disconnected",
            bufferHealth: typeof base.bufferHealth === "number" ? Math.max(0, Math.min(100, base.bufferHealth)) : 0,
            backgroundPlayEnabled: base.backgroundPlayEnabled ?? true,
            autoReconnect: base.autoReconnect ?? true,
            preferredQuality: base.preferredQuality || "high"
          };

          if (fromVersion < 2) {
            // v1 → v2: add favorites
            if (!Array.isArray(base.favorites)) safe.favorites = [];
          }
          return safe;
        } catch {
          return {
            streamsByStation: {},
            favorites: [],
            currentStationId: null,
            playbackState: "stopped",
            volume: 0.8,
            muted: false,
            currentMetadata: {},
            connectionStatus: "disconnected",
            bufferHealth: 0,
            backgroundPlayEnabled: true,
            autoReconnect: true,
            preferredQuality: "high"
          };
        }
      },
      partialize: (state) => ({
        streamsByStation: state.streamsByStation,
        favorites: state.favorites,
        volume: state.volume,
        muted: state.muted,
        backgroundPlayEnabled: state.backgroundPlayEnabled,
        autoReconnect: state.autoReconnect,
        preferredQuality: state.preferredQuality
      })
    }
  )
);

// Selectors for optimized re-renders
export const useCurrentStreamConfig = () => useRadioStore((state) => {
  if (!state.currentStationId) return null;
  return state.streamsByStation[state.currentStationId] || null;
});

export const useRadioPlaybackState = () => useRadioStore((state) => state.playbackState);
export const useRadioMetadata = () => useRadioStore((state) => state.currentMetadata);
export const useRadioVolume = () => useRadioStore((state) => ({ volume: state.volume, muted: state.muted }));
export const useRadioConnectionStatus = () => useRadioStore((state) => ({
  status: state.connectionStatus,
  bufferHealth: state.bufferHealth
}));

// Optional: helper to clear persisted state if needed
export async function resetRadioStore() {
  try { await AsyncStorage.removeItem("radio-store"); } catch {}
}