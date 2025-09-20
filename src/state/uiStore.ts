import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface UiState {
  overlayHidden: boolean;
  overlayAvoidTopLeft: number;
  overlayAvoidTopRight: number;
  setOverlayHidden: (v: boolean) => void;
  setOverlayAvoid: (vals: Partial<Pick<UiState, "overlayAvoidTopLeft" | "overlayAvoidTopRight">>) => void;
  navHintSeen: boolean;
  setNavHintSeen: (v: boolean) => void;
  railDetent: "top" | "middle" | "bottom";
  setRailDetent: (d: UiState["railDetent"]) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      overlayHidden: false,
      overlayAvoidTopLeft: 0,
      overlayAvoidTopRight: 0,
      setOverlayHidden: (v) => set({ overlayHidden: v }),
      setOverlayAvoid: (vals) => set({ ...vals }),
      navHintSeen: false,
      setNavHintSeen: (v) => set({ navHintSeen: v }),
      railDetent: "middle",
      setRailDetent: (d) => set({ railDetent: d }),
    }),
    {
      name: "ui-store",
      storage: createJSONStorage(() => AsyncStorage),
      // Persist minimal UX prefs
      partialize: (s) => ({ 
        navHintSeen: s.navHintSeen, 
        railDetent: s.railDetent,
      }),
    }
  )
);
