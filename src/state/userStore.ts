import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { StationMembership } from "../types/station";

export type User = {
  id: string;
  email: string;
  name: string;
  memberships: StationMembership[];
  currentStationId: string | null;
  defaultLocation?: { city?: string; lat?: number; lon?: number };
  currentLocationOverride?: { city?: string; lat?: number; lon?: number } | null;
};

interface UserState {
  user: User;
  setCurrentStation: (stationId: string) => void;
  addMembership: (stationId: string, role: string) => void;
  removeMembership: (stationId: string) => void;
}

const MOCK_USER: User = {
  id: "user-1",
  email: "host@example.com",
  name: "Station Host",
  memberships: [
    { stationId: "station-a", role: "Owner" },
    { stationId: "station-b", role: "Viewer" },
  ],
  currentStationId: "station-a",
  defaultLocation: { city: "San Francisco" },
  currentLocationOverride: null,
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: MOCK_USER,
      setCurrentStation: (stationId) => set((s) => ({ user: { ...s.user, currentStationId: stationId } })),
      addMembership: (stationId, role) => set((s) => {
        if (s.user.memberships.find((m) => m.stationId === stationId)) return s as any;
        const memberships = [...s.user.memberships, { stationId, role: role as any }];
        return { user: { ...s.user, memberships, currentStationId: s.user.currentStationId ?? stationId } } as any;
      }),
      removeMembership: (stationId) => set((s) => {
        const memberships = s.user.memberships.filter((m) => m.stationId !== stationId);
        let currentStationId = s.user.currentStationId;
        if (currentStationId === stationId) currentStationId = memberships[0]?.stationId ?? null;
        return { user: { ...s.user, memberships, currentStationId } } as any;
      }),
    }),
    {
      name: "user-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ user: s.user }),
    }
  )
);

export function getCurrentStationId() {
  return useUserStore.getState().user.currentStationId;
}

export function getRoleForStation(stationId: string) {
  const m = useUserStore.getState().user.memberships.find((x) => x.stationId === stationId);
  return m?.role ?? "Viewer";
}

export function getEffectiveCity(stationDefault?: string | null) {
  const u = useUserStore.getState().user as any;
  return u?.currentLocationOverride?.city || u?.defaultLocation?.city || stationDefault || null;
}
