import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useAudioStore } from "./audioStore";
import { startUploadSession, uploadChunk, finalizeUpload, getJobStatus } from "../api/upload";

export type QueueItem = {
  id: string; // recording id
  stationId: string;
  localUri: string;
  metadata: any;
  status: "pending" | "uploading" | "failed" | "complete";
  progress: number;
  error?: string;
  sessionId?: string;
  offset?: number;
  createdAt: number;
  lastTriedAt?: number;
};

interface UploadQueueState {
  items: QueueItem[];
  enqueue: (q: QueueItem) => void;
  update: (id: string, patch: Partial<QueueItem>) => void;
  remove: (id: string) => void;
  pump: () => Promise<void>;
  retry: (id: string) => Promise<void>;
}

export const useUploadQueue = create<UploadQueueState>()(
  persist(
    (set, get) => ({
      items: [],
      enqueue: (q) => set((s) => ({ items: [q, ...s.items] })),
      update: (id, patch) => set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })),
      remove: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
      pump: async () => {
        const { items, update } = get();
        for (const it of items) {
          if (it.status === "complete") continue;
          try {
            update(it.id, { status: "uploading", error: undefined });
            let sessionId = it.sessionId;
            let offset = it.offset || 0;
            if (!sessionId) {
              sessionId = await startUploadSession(it.stationId, it.metadata);
              update(it.id, { sessionId });
            }
            const stat = await uploadChunk(sessionId, it.localUri, offset, (p) => update(it.id, { progress: p }));
            offset = stat.offset;
            update(it.id, { offset });
            const fin = await finalizeUpload(sessionId, it.metadata);
            update(it.id, { status: "complete", progress: 1 });
            useAudioStore.getState().updateRecording(it.id, { syncStatus: "synced", uploadedAt: Date.now(), cloudPath: fin.cloudPath }, it.stationId);
            // optional: poll job status and update lufs + waveform
            setTimeout(async () => {
              try {
                const job = await getJobStatus(fin.jobId);
                const patch: any = {};
                if (job?.lufs != null) patch.lufs = job.lufs;
                if (Array.isArray(job?.waveform)) patch.waveform = job.waveform;
                if (Object.keys(patch).length > 0) useAudioStore.getState().updateRecording(it.id, patch, it.stationId);
              } catch {}
            }, 1500);
          } catch (e: any) {
            update(it.id, { status: "failed", error: e?.message || "Upload failed" });
            useAudioStore.getState().updateRecording(it.id, { syncStatus: "failed" }, it.stationId);
          }
        }
      },
      retry: async (id) => {
        const it = get().items.find((x) => x.id === id);
        if (!it) return;
        set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, status: "pending", error: undefined } : x)) }));
        await get().pump();
      },
    }),
    { name: "upload-queue", storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ items: s.items }) }
  )
);
