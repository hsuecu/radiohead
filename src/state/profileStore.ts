import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { StationProfile, PlayoutSystem, DeliveryMethod } from "../types/playout";
import type { StorageProvider } from "../types/storage";

export type ProfilesState = {
  byStation: Record<string, StationProfile>;
  setProfile: (stationId: string, profile: StationProfile) => void;
  getProfile: (stationId: string) => StationProfile | undefined;
  resetProfile: (stationId: string) => void;
  setStorageProvider: (stationId: string, provider: import("../types/storage").StorageProvider | null, folderTemplate?: string | null) => void;
  copyPlayoutFrom: (fromStationId: string, toStationId: string) => void;
  copyStorageFrom: (fromStationId: string, toStationId: string) => void;
};

export function buildDefaultProfile(stationId: string, stationName?: string): StationProfile {
  return {
    id: stationId,
    name: stationName || "Station",
    playout: "myriad",
    storage: { 
      provider: null, 
      folderTemplate: null,
      categoryFolders: {},
      autoCreateFolders: true,
      conflictResolution: "rename",
      lastVerified: null,
      accountInfo: {}
    },
    delivery: { method: "local" as DeliveryMethod, host: null, remotePath: "DropIn" },
    defaults: { fileFormat: "wav", sampleRateHz: 44100, bitDepth: 16, loudnessLUFS: -16.0, truePeakDBTP: -1.0, category: "Links", eomSec: 0.5 },
    sidecar: { type: "csv", fields: ["title","artist","category","intro_sec","eom_sec","explicit","isrc","external_id","embargo_start","expires_at","notes"] },
    mappings: { categories: { Links: ["Links","VT","LINKS"], News: ["News","Bulletins"], Promos: ["Promos"], Imaging: ["Imaging","SFX"] } },
  };
}

export const useProfilesStore = create<ProfilesState>()(
  persist(
    (set, get) => ({
      byStation: {},
      setProfile: (stationId, profile) => set((s) => ({ byStation: { ...s.byStation, [stationId]: { ...profile, id: stationId } } })),
      getProfile: (stationId) => get().byStation[stationId],
      resetProfile: (stationId) => set((s) => {
        const next = { ...s.byStation };
        delete next[stationId];
        return { byStation: next };
      }),
      setStorageProvider: (stationId, provider, folderTemplate) => set((s) => {
        const cur = s.byStation[stationId] ?? buildDefaultProfile(stationId);
        return { byStation: { ...s.byStation, [stationId]: { ...cur, storage: { provider, folderTemplate: folderTemplate ?? cur.storage?.folderTemplate ?? null } } } };
      }),
      copyPlayoutFrom: (fromStationId, toStationId) => set((s) => {
        const src = s.byStation[fromStationId]; const dst = s.byStation[toStationId] ?? buildDefaultProfile(toStationId);
        if (!src) return { byStation: s.byStation } as any;
        const merged = { ...dst, playout: src.playout, sidecar: src.sidecar, mappings: src.mappings, defaults: { ...dst.defaults, fileFormat: src.defaults.fileFormat, bitDepth: src.defaults.bitDepth, loudnessLUFS: src.defaults.loudnessLUFS, truePeakDBTP: src.defaults.truePeakDBTP } } as StationProfile;
        return { byStation: { ...s.byStation, [toStationId]: merged } };
      }),
      copyStorageFrom: (fromStationId, toStationId) => set((s) => {
        const src = s.byStation[fromStationId]; const dst = s.byStation[toStationId] ?? buildDefaultProfile(toStationId);
        if (!src) return { byStation: s.byStation } as any;
        const merged = { ...dst, storage: src.storage ?? { provider: null, folderTemplate: null } } as StationProfile;
        return { byStation: { ...s.byStation, [toStationId]: merged } };
      }),
    }),
    { name: "profiles-store", storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ byStation: s.byStation }) }
  )
);
