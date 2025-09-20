import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as Crypto from "expo-crypto";
import { useUserStore } from "./userStore";

interface AuthState {
  isAuthenticated: boolean;
  error?: string | null;
  userEmail?: string | null;
  passwordHash?: string | null; // mock local hash
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (current: string, next: string) => Promise<boolean>;
}

async function hash(pw: string) {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pw);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: true, // default logged in for development
      error: null,
      userEmail: "host@example.com",
      passwordHash: undefined,
      login: async (email, password) => {
        const h = await hash(password);
        const saved = get().passwordHash;
        if (saved && saved !== h) { set({ error: "Invalid credentials", isAuthenticated: false }); return false; }
        set({ isAuthenticated: true, error: null, userEmail: email });
        return true;
      },
      logout: () => set({ isAuthenticated: false }),
      changePassword: async (current, next) => {
        const saved = get().passwordHash;
        if (saved) {
          const hc = await hash(current);
          if (hc !== saved) { set({ error: "Current password incorrect" }); return false; }
        }
        const hn = await hash(next);
        set({ passwordHash: hn, error: null });
        return true;
      },
    }),
    { name: "auth-store", storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ isAuthenticated: s.isAuthenticated, userEmail: s.userEmail, passwordHash: s.passwordHash }) }
  )
);
