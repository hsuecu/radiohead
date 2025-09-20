import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StoragePolicy, StorageProvider } from "../types/storage";

export type PolicyState = StoragePolicy & {
  setAllowed: (p: StorageProvider[], maxMB?: number) => void;
  setMax: (mb: number) => void;
  setTemplate: (tpl: string | null) => void;
};

export const useStoragePolicy = create<PolicyState>()(
  persist(
    (set) => ({
      allowedProviders: ["gdrive", "onedrive", "dropbox"],
      maxFileSizeMB: 1024,
      requireFolderTemplate: null,
      setAllowed: (p, maxMB) => set((s) => ({ allowedProviders: p, maxFileSizeMB: maxMB ?? s.maxFileSizeMB })),
      setMax: (mb) => set({ maxFileSizeMB: mb }),
      setTemplate: (tpl) => set({ requireFolderTemplate: tpl }),
    }),
    { name: "storage-policy", storage: createJSONStorage(() => AsyncStorage) }
  )
);
