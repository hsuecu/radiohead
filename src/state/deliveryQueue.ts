import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { StationProfile, CanonicalAsset } from "../types/playout";
import { buildFileName } from "../utils/fileNaming";
import { buildMyriadCsv } from "../utils/sidecars/myriadCsv";
import { buildMyriadXml } from "../utils/sidecars/myriadXml";
import { buildMairlistMmd } from "../utils/sidecars/mairlistMmd";
import { buildEncoCsv } from "../utils/sidecars/encoCsv";
import { getDelivery } from "../api/delivery";

export type DeliveryItem = {
  id: string;
  stationId: string;
  localUri: string;
  profile: StationProfile;
  asset: CanonicalAsset;
  fileExt: "wav" | "mp3";
  remoteRelPath: string; // relative
  sidecarName?: string | null;
  sidecarBody?: string | null;
  status: "pending" | "connecting" | "uploading" | "verifying" | "complete" | "failed";
  progress: number;
  error?: string | null;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
};

type State = {
  items: DeliveryItem[];
  enqueue: (it: DeliveryItem) => void;
  enqueueFrom: (args: { id: string; stationId: string; localUri: string; profile: StationProfile; asset: CanonicalAsset; ext: "wav"|"mp3"; extraMeta?: Record<string, string | number> | null }) => Promise<void>;
  pump: () => Promise<void>;
  retry: (id: string) => Promise<void>;
  remove: (id: string) => void;
  clearCompleted: () => void;
};

function buildSidecar(profile: StationProfile, filename: string, a: CanonicalAsset): { name: string | null; body: string | null } {
  const base = filename.replace(/\.[^.]+$/, "");
  if (profile.sidecar.type === "csv") {
    if (profile.playout === "myriad") return { name: `${base}.csv`, body: buildMyriadCsv(filename, a) };
    if (profile.playout === "enco") return { name: `${base}.csv`, body: buildEncoCsv(filename, a) };
    return { name: `${base}.csv`, body: buildMyriadCsv(filename, a) };
  }
  if (profile.sidecar.type === "xml") {
    return { name: `${base}.xml`, body: buildMyriadXml(filename, a) };
  }
  if (profile.sidecar.type === "mmd") {
    return { name: `${base}.mmd`, body: buildMairlistMmd(filename, a) };
  }
  return { name: null, body: null };
}

export const useDeliveryQueue = create<State>()(
  persist(
    (set, get) => ({
      items: [],
      enqueue: (it) => set((s) => ({ items: [it, ...s.items] })),
       enqueueFrom: async ({ id, stationId, localUri, profile, asset, ext, extraMeta }) => {
         const rel = buildFileName(asset.category, asset.title, asset.external_id, asset.intro_sec ?? undefined, asset.eom_sec ?? undefined, ext, extraMeta || undefined);
        const { name: sideName, body: sideBody } = buildSidecar(profile, rel.split("/").pop()!, asset);
        const item: DeliveryItem = {
          id,
          stationId,
          localUri,
          profile,
          asset,
          fileExt: ext,
          remoteRelPath: rel,
          sidecarName: sideName,
          sidecarBody: sideBody,
          status: "pending",
          progress: 0,
          createdAt: Date.now(),
        };
        set((s) => ({ items: [item, ...s.items] }));
      },
      pump: async () => {
        const state = get();
        for (const it of state.items) {
          if (it.status === "complete") continue;
          try {
             set((s) => ({ items: s.items.map((x) => x.id === it.id ? { ...x, status: "connecting", startedAt: x.startedAt ?? Date.now(), error: null, progress: 0.15 } : x) }));
            const del = await getDelivery(it.profile.delivery.method || "local");
             set((s) => ({ items: s.items.map((x) => x.id === it.id ? { ...x, status: "uploading", progress: 0.5 } : x) }));
            // local staging path
            const baseRoot = FileSystem.documentDirectory + `Exports/${it.stationId}/`;
            const audioPath = `${baseRoot}${it.remoteRelPath}`;
            await del.put({ path: audioPath, uri: it.localUri });
            if (it.sidecarName && it.sidecarBody != null) {
              const sidePath = `${baseRoot}${it.remoteRelPath.replace(/\.[^.]+$/, "")}.${it.sidecarName.split(".").pop()}`;
              await FileSystem.writeAsStringAsync(sidePath + ".tmp", it.sidecarBody);
              await del.rename(sidePath + ".tmp", sidePath);
            }
             set((s) => ({ items: s.items.map((x) => x.id === it.id ? { ...x, status: "verifying", progress: 0.9 } : x) }));
            const ok = await del.verify(audioPath);
            if (!ok) throw new Error("VERIFY_MISMATCH");
            set((s) => ({ items: s.items.map((x) => x.id === it.id ? { ...x, status: "complete", finishedAt: Date.now(), progress: 1 } : x) }));
           } catch (e: any) {
             const msg = String(e?.message || "Delivery failed");
             const friendly = msg.includes("VERIFY_MISMATCH") ? "Uploaded but verify failed" : msg;
             set((s) => ({ items: s.items.map((x) => x.id === it.id ? { ...x, status: "failed", error: friendly } : x) }));
           }
        }
      },
      retry: async (id) => {
        set((s) => ({ items: s.items.map((x) => x.id === id ? { ...x, status: "pending", error: null } : x) }));
        await get().pump();
      },
      remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
      clearCompleted: () => set((s) => ({ items: s.items.filter((x) => x.status !== "complete") })),
    }),
    { name: "delivery-queue", storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ items: s.items }) }
  )
);
