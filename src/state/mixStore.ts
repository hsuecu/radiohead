import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type DeckAssignment = { id: string; label: string; uri: string; color?: string };
export type DeckNumber = 1 | 2 | 3 | 4;
export type Trigger = { id: string; deck: DeckNumber; uri: string; atMs: number; durationMs: number; gain: number };

interface MixState {
  assignments: Partial<Record<DeckNumber, DeckAssignment>>;
  gains: Record<DeckNumber, number>;
  vtTriggers: Trigger[];
  clipTriggers: Trigger[];
  assignDeck: (n: DeckNumber, a: DeckAssignment) => void;
  clearDeck: (n: DeckNumber) => void;
  setDeckGain: (n: DeckNumber, gain: number) => void;
  addTrigger: (mode: "vt" | "clip", t: Trigger) => void;
  clearTriggers: (mode: "vt" | "clip") => void;
}

export const useMixStore = create<MixState>()(
  persist(
    (set, get) => ({
      assignments: {},
      gains: { 1: 1, 2: 1, 3: 1, 4: 1 },
      vtTriggers: [],
      clipTriggers: [],
      assignDeck: (n, a) => set((s) => ({ assignments: { ...s.assignments, [n]: a } })),
      clearDeck: (n) => set((s) => { const x = { ...s.assignments }; delete (x as any)[n]; return { assignments: x }; }),
      setDeckGain: (n, gain) => set((s) => ({ gains: { ...s.gains, [n]: Math.max(0.5, Math.min(2.0, gain)) } })),
      addTrigger: (mode, t) => set((s) => mode === "vt" ? ({ vtTriggers: [...s.vtTriggers, t] }) : ({ clipTriggers: [...s.clipTriggers, t] })),
      clearTriggers: (mode) => set((s) => mode === "vt" ? ({ vtTriggers: [] }) : ({ clipTriggers: [] })),
    }),
    {
      name: "mix-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ assignments: s.assignments, gains: s.gains }),
    }
  )
);
