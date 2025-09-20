import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

export type ProviderKey = "openai" | "anthropic" | "grok" | "elevenlabs" | "perigon";

const KEY_PREFIX = "secret_" as const;
const keyName = (p: ProviderKey) => `${KEY_PREFIX}${p}`;

interface SecretsState {
  cached: Partial<Record<ProviderKey, string | null>>;
  hasKey: Partial<Record<ProviderKey, boolean>>;
  loading: boolean;
  hydrate: () => Promise<void>;
  getKey: (p: ProviderKey) => Promise<string | null>;
  getCached: (p: ProviderKey) => string | null;
  setKey: (p: ProviderKey, value: string) => Promise<void>;
  clearKey: (p: ProviderKey) => Promise<void>;
}

export const useSecretsStore = create<SecretsState>((set, get) => ({
  cached: {},
  hasKey: {},
  loading: false,
  hydrate: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const providers: ProviderKey[] = ["openai", "anthropic", "grok", "elevenlabs", "perigon"];
      const results = await Promise.all(providers.map(async (p) => {
        try {
          const v = await SecureStore.getItemAsync(keyName(p));
          return [p, v] as const;
        } catch { return [p, null] as const; }
      }));
      const cached: Partial<Record<ProviderKey, string | null>> = {};
      const hasKey: Partial<Record<ProviderKey, boolean>> = {};
      for (const [p, v] of results) {
        cached[p] = v ?? null;
        hasKey[p] = !!v;
      }
      set({ cached, hasKey });
    } finally {
      set({ loading: false });
    }
  },
  getKey: async (p) => {
    const cur = get().cached[p];
    if (typeof cur === "string") return cur;
    try {
      const v = await SecureStore.getItemAsync(keyName(p));
      set((s) => ({ cached: { ...s.cached, [p]: v ?? null }, hasKey: { ...s.hasKey, [p]: !!v } }));
      return v ?? null;
    } catch { return null; }
  },
  getCached: (p) => get().cached[p] ?? null,
  setKey: async (p, value) => {
    const val = value?.trim();
    if (!val) return;
    await SecureStore.setItemAsync(keyName(p), val);
    set((s) => ({ cached: { ...s.cached, [p]: val }, hasKey: { ...s.hasKey, [p]: true } }));
  },
  clearKey: async (p) => {
    try { await SecureStore.deleteItemAsync(keyName(p)); } catch {}
    set((s) => ({ cached: { ...s.cached, [p]: null }, hasKey: { ...s.hasKey, [p]: false } }));
  },
}));

// Best-effort eager hydrate on import (non-blocking)
useSecretsStore.getState().hydrate().catch(() => {});
