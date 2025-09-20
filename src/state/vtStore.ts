import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type VTTrackType = "mic" | "bed" | "cart";
export type VTTrack = { id: string; type: VTTrackType; uri?: string | null; gain: number; mute: boolean; solo: boolean; markers?: number[] };
export type VTSession = { id: string; slotId: string; showName: string; date: number; postMs?: number | null; tracks: VTTrack[]; outputUri?: string | null; status: "idle"|"recording"|"ready"|"mixed" };

type VTState = {
  session: VTSession | null;
  start: (slotId: string, showName: string, postMs?: number | null) => void;
  end: () => void;
  setPost: (ms: number | null) => void;
  setTrackGain: (id: string, gain: number) => void;
  toggleMute: (id: string) => void;
  addMarker: (id: string, ms: number) => void;
  setOutput: (uri: string | null) => void;
};

export const useVTStore = create<VTState>()(
  persist(
    (set, get) => ({
      session: null,
      start: (slotId, showName, postMs) => set((s) => {
        if (s.session && s.session.slotId === slotId) return s;
        return { session: { id: String(Date.now()), slotId, showName, date: Date.now(), postMs: postMs ?? null, tracks: [ { id: "mic", type: "mic", gain: 1, mute: false, solo: false }, { id: "bed", type: "bed", gain: 0.8, mute: false, solo: false }, { id: "cart", type: "cart", gain: 1, mute: false, solo: false } ], status: "idle" } };
      }),
      end: () => set({ session: null }),
      setPost: (ms) => set((s)=> s.session ? ({ session: { ...s.session, postMs: ms } }) : s),
      setTrackGain: (id, gain) => set((s)=> s.session ? ({ session: { ...s.session, tracks: s.session.tracks.map(t=> t.id===id ? { ...t, gain } : t) } }) : s),
      toggleMute: (id) => set((s)=> s.session ? ({ session: { ...s.session, tracks: s.session.tracks.map(t=> t.id===id ? { ...t, mute: !t.mute } : t) } }) : s),
      addMarker: (id, ms) => set((s)=> s.session ? ({ session: { ...s.session, tracks: s.session.tracks.map(t=> t.id===id ? { ...t, markers: [...(t.markers||[]), ms] } : t) } }) : s),
      setOutput: (uri) => set((s)=> s.session ? ({ session: { ...s.session, outputUri: uri, status: uri ? "mixed" : s.session.status } }) : s),
    }),
    { name: "vt-store", storage: createJSONStorage(() => AsyncStorage), partialize: (s)=> ({ session: s.session }) }
  )
);
