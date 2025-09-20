import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Station, Invitation } from "../types/station";

interface StationState {
  stations: Station[];
  invitations: Invitation[];
  upsertStation: (s: Station) => void;
  deleteStation: (id: string) => void;
  createInvitation: (inv: Invitation) => void;
  cancelInvitation: (id: string) => void;
  markInvitationAccepted: (id: string) => void;
}

const DEFAULTS: Station[] = [
  { id: "station-a", name: "WAVE 101", branding: { primaryColor: "#2563EB" }, location: { city: "San Francisco" }, dashboardSections: [
    { id: "localNews", name: "Local News", type: "news", enabled: true, order: 0, config: { category: "local", refreshInterval: 300 } },
    { id: "traffic", name: "Traffic", type: "api", enabled: true, order: 1, config: { refreshInterval: 300 } },
    { id: "nationalNews", name: "National News", type: "news", enabled: true, order: 2, config: { category: "national", refreshInterval: 600 } }
  ] },
  { id: "station-b", name: "CITY FM", branding: { primaryColor: "#10B981" }, location: { city: "New York" }, dashboardSections: [
    { id: "localNews", name: "Local News", type: "news", enabled: true, order: 0, config: { category: "local", refreshInterval: 300 } },
    { id: "traffic", name: "Traffic", type: "api", enabled: true, order: 1, config: { refreshInterval: 300 } },
    { id: "nationalNews", name: "National News", type: "news", enabled: true, order: 2, config: { category: "national", refreshInterval: 600 } }
  ] },
];

export const useStationStore = create<StationState>()(
  persist(
    (set) => ({
      stations: DEFAULTS,
      invitations: [],
      upsertStation: (st) => set((s) => {
        const exists = s.stations.findIndex((x) => x.id === st.id);
        if (exists >= 0) {
          const next = [...s.stations];
          next[exists] = { ...next[exists], ...st };
          return { stations: next };
        }
        return { stations: [...s.stations, st] };
      }),
      deleteStation: (id) => set((s) => ({
        stations: s.stations.filter((x) => x.id !== id),
        invitations: s.invitations.filter((i) => i.stationId !== id),
      })),
      createInvitation: (inv) => set((s) => ({ invitations: [inv, ...s.invitations] })),
      cancelInvitation: (id) => set((s) => ({ invitations: s.invitations.map((i) => (i.id === id ? { ...i, status: "cancelled" } : i)) })),
      markInvitationAccepted: (id) => set((s) => ({ invitations: s.invitations.map((i) => (i.id === id ? { ...i, status: "accepted" } : i)) })),
    }),
    {
      name: "station-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ stations: s.stations, invitations: s.invitations }),
    }
  )
);
