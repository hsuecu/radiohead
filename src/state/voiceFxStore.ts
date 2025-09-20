import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type VoiceFxState = {
  enabled: boolean;
  voiceId: string | null;
  modelId: string;
  outputFormat: string; // e.g. mp3_44100_128
  removeBackgroundNoise: boolean;
  setEnabled: (v: boolean) => void;
  setVoice: (id: string | null) => void;
  setModel: (id: string) => void;
  setOutputFormat: (fmt: string) => void;
  setRemoveBg: (v: boolean) => void;
};

export const useVoiceFxStore = create<VoiceFxState>()(
  persist(
    (set) => ({
      enabled: false,
      voiceId: null,
      modelId: "eleven_multilingual_sts_v2",
      outputFormat: "mp3_44100_128",
      removeBackgroundNoise: false,
      setEnabled: (v) => set({ enabled: v }),
      setVoice: (id) => set({ voiceId: id }),
      setModel: (id) => set({ modelId: id }),
      setOutputFormat: (fmt) => set({ outputFormat: fmt }),
      setRemoveBg: (v) => set({ removeBackgroundNoise: v }),
    }),
    { name: "voice-fx", storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ enabled: s.enabled, voiceId: s.voiceId, modelId: s.modelId, outputFormat: s.outputFormat, removeBackgroundNoise: s.removeBackgroundNoise }) }
  )
);
