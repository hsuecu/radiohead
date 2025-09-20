import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type LogItem = { id: string; type: "song" | "ad" | "slot"; title?: string; label?: string; postMs?: number };
export type ImportedLog = { id: string; name: string; source: "api" | "file"; importedAt: number; items: LogItem[] };

type Breadcrumb = { id: string; ts: number; tag: string; data?: any };

interface LogState {
  log: ImportedLog | null;
  setLog: (log: ImportedLog) => void;
  clearLog: () => void;
  getNextSlot: (afterId?: string) => LogItem | null;
  breadcrumbs: Breadcrumb[];
  addBreadcrumb: (tag: string, data?: any) => void;
  clearBreadcrumbs: () => void;
}

export const useLogStore = create<LogState>()(
  persist(
    (set, get) => ({
      log: null,
      setLog: (log) => set({ log }),
      clearLog: () => set({ log: null }),
      getNextSlot: (afterId) => {
        const items = get().log?.items || [];
        if (!afterId) return items.find((x) => x.type === "slot") || null;
        const idx = items.findIndex((x) => x.id === afterId);
        return items.slice(Math.max(0, idx + 1)).find((x) => x.type === "slot") || null;
      },
      breadcrumbs: [],
      addBreadcrumb: (tag, data) => set((s) => ({ breadcrumbs: [{ id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, ts: Date.now(), tag, data }, ...s.breadcrumbs].slice(0, 200) })),
      clearBreadcrumbs: () => set({ breadcrumbs: [] }),
    }),
    { name: "log-store", storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ log: s.log, breadcrumbs: s.breadcrumbs }) }
  )
);
