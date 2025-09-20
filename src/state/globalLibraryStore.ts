import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Asset = { id: string; name: string; uri: string; version: number; createdAt: number; createdBy: string };
export type ShareMode = "Mirror" | "Sync" | "Copy";
export type ShareTarget = { all?: boolean; stationIds?: string[] };
export type Share = { id: string; assetId: string; mode: ShareMode; target: ShareTarget; startAt?: number; endAt?: number; pinnedVersion?: number; priority?: number; createdAt: number; createdBy: string };
export type Rollout = { id: string; assetId: string; stationId: string; status: "pending" | "delivered" | "failed"; lastAttemptAt?: number; error?: string };
export type AuditEntry = { id: string; actorId: string; type: "upload" | "share" | "update"; assetId?: string; stationId?: string; details?: string; at: number };

interface GlobalLibState {
  assets: Asset[];
  shares: Share[];
  rollouts: Rollout[];
  audit: AuditEntry[];
  addAsset: (a: Asset) => void;
  addShare: (s: Share, stations: string[]) => void;
}

export const useGlobalLibrary = create<GlobalLibState>()(
  persist(
    (set, get) => ({
      assets: [],
      shares: [],
      rollouts: [],
      audit: [],
      addAsset: (a) => set((s) => ({ assets: [a, ...s.assets], audit: [{ id: `audit-${a.id}`, actorId: a.createdBy, type: "upload", assetId: a.id, at: Date.now() }, ...s.audit] })),
      addShare: (share, stations) => set((s) => ({
        shares: [share, ...s.shares],
        rollouts: [...stations.map((sid) => ({ id: `${share.id}-${sid}`, assetId: share.assetId, stationId: sid, status: "delivered" as const, lastAttemptAt: Date.now() })), ...s.rollouts],
        audit: [{ id: `audit-${share.id}`, actorId: share.createdBy, type: "share", assetId: share.assetId, at: Date.now() }, ...s.audit],
      })),
    }),
    {
      name: "global-library",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ assets: s.assets, shares: s.shares, rollouts: s.rollouts, audit: s.audit }),
    }
  )
);
