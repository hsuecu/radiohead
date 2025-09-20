import { create } from "zustand";

interface RadioUiState {
  isOpen: boolean;
  // Command channel
  lastCmdAt: number;
  desiredOpen: boolean | null;
  openPlayer: () => void;
  closePlayer: () => void;
  togglePlayer: () => void;
  // Sync actual open state from UI component
  setOpenState: (open: boolean) => void;
}

export const useRadioUiStore = create<RadioUiState>()((set, get) => ({
  isOpen: false,
  lastCmdAt: 0,
  desiredOpen: null,
  openPlayer: () => set({ desiredOpen: true, lastCmdAt: Date.now() }),
  closePlayer: () => set({ desiredOpen: false, lastCmdAt: Date.now() }),
  togglePlayer: () => {
    const next = !get().isOpen;
    set({ desiredOpen: next, lastCmdAt: Date.now() });
  },
  setOpenState: (open: boolean) => set({ isOpen: open })
}));
