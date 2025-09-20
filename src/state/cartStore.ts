import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItem = { id: string; label: string; color?: string; uri: string };

interface CartState {
  carts: CartItem[];
  bedUri?: string | null;
  addCart: (c: CartItem) => void;
  removeCart: (id: string) => void;
  setBed: (uri: string | null) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      carts: [],
      bedUri: null,
      addCart: (c) => set((s) => ({ carts: [c, ...s.carts].slice(0, 12) })),
      removeCart: (id) => set((s) => ({ carts: s.carts.filter((x) => x.id !== id) })),
      setBed: (uri) => set({ bedUri: uri }),
    }),
    { name: "cart-store", storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ carts: s.carts, bedUri: s.bedUri }) }
  )
);
