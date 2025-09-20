import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StorageObjectMeta, StorageProvider } from "../types/storage";

export type StorageIndexState = {
  byId: Record<string, StorageObjectMeta>;
  cursors: Partial<Record<StorageProvider, string>>;
  upsert: (meta: StorageObjectMeta) => void;
  remove: (id: string) => void;
  setCursor: (p: StorageProvider, cursor: string) => void;
};

export const useStorageIndex = create<StorageIndexState>()(
  persist(
    (set, get) => ({
      byId: {},
      cursors: {},
      upsert: (meta) => set((s) => ({ byId: { ...s.byId, [meta.id]: meta } })),
      remove: (id) => set((s) => { const next = { ...s.byId }; delete next[id]; return { byId: next }; }),
      setCursor: (p, cursor) => set((s) => ({ cursors: { ...s.cursors, [p]: cursor } })),
    }),
    { name: "storage-index", storage: createJSONStorage(() => AsyncStorage) }
  )
);
