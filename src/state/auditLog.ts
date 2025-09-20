import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AuditEvent = { id: string; who: string; action: string; provider?: string; objectId?: string; size?: number; checksum?: string | null; when: number; info?: string | null };

export type AuditState = {
  events: AuditEvent[];
  log: (e: Omit<AuditEvent, "id" | "when"> & { id?: string; when?: number }) => void;
  clear: () => void;
};

export const useAuditLog = create<AuditState>()(
  persist(
    (set) => ({
      events: [],
      log: (e) => set((s) => ({ events: [{ id: e.id ?? String(Date.now()), when: e.when ?? Date.now(), ...e }, ...s.events].slice(0, 5000) })),
      clear: () => set({ events: [] }),
    }),
    { name: "audit-log", storage: createJSONStorage(() => AsyncStorage) }
  )
);
