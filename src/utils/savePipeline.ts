import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import { trimToFile } from "../api/render";
import { ensureRecordingDirectory, generateUniqueFilename, getAudioFileInfo, moveAudioFile } from "./audioFileManager";
import { CATEGORY_OPTIONS } from "../types/station";
import { buildCloudPath } from "./pathing";
import { buildRecordingMetadata } from "./metadata";
import waveformManager from "./waveformManager";
import { createDefaultTracks, createDefaultViewport, createDefaultProjectSettings } from "./multitrackHelpers";
import type { AudioSegment, RecordingItem } from "../state/audioStore";
import { useAudioStore } from "../state/audioStore";
import { useUserStore } from "../state/userStore";
import { useUploadQueue } from "../state/uploadQueue";
import { useLogStore } from "../state/logStore";

export type SavePipelineParams = {
  stationId: string;
  baseUri: string;              // original recording file
  cropStartMs: number;
  cropEndMs: number;
  preCroppedUri?: string | null; // if provided, skip physical crop
  tempName: string;
  selectedCategoryId?: string;
  customCategory?: string;
  subcategory?: string;
  tagsText?: string;
  notes?: string;
  sessionWaveform?: number[] | null; // from live session; optional
};

export type SavePipelineResult = {
  id: string;
  dest: string;
  durationMs: number;
};

export async function saveAsIsRecording(p: Omit<SavePipelineParams, "preCroppedUri" | "cropStartMs" | "cropEndMs"> & { cropStartMs?: number; cropEndMs?: number }): Promise<SavePipelineResult> {
  const sid = p.stationId;
  const now = new Date();
  const id = Crypto.randomUUID();
  const dir = await ensureRecordingDirectory(sid);
  const selectedCat = (() => {
    if (p.customCategory && p.customCategory.trim()) return CATEGORY_OPTIONS.find(x => x.id === "other")!;
    const byId = CATEGORY_OPTIONS.find(x => x.id === (p.selectedCategoryId || ""));
    return byId || CATEGORY_OPTIONS.find(x => x.id === "other")!;
  })();
  const userPrefix = (useUserStore.getState().user.email || "user").split("@")[0];
  const filename = generateUniqueFilename(sid, selectedCat.code, userPrefix);
  const dest = `${dir}/${filename}`;
  const tags = (p.tagsText || "").split(",").map((t) => t.trim()).filter(Boolean);
  const path = buildCloudPath(sid, now, selectedCat.code);

  try { useLogStore.getState().addBreadcrumb("save:start", { id, sid, baseUri: p.baseUri, mode: "as_is" }); } catch {}

  // Move/copy file as-is
  const ok = await moveAudioFile(p.baseUri, dest);
  if (!ok) {
    await FileSystem.copyAsync({ from: p.baseUri, to: dest + ".tmp" });
    await FileSystem.moveAsync({ from: dest + ".tmp", to: dest });
  }

  // Verify
  const info0 = await FileSystem.getInfoAsync(dest);
  if (!info0.exists || (info0.size || 0) <= 0) {
    throw new Error("Saved file not ready");
  }

  const ai = await getAudioFileInfo(dest);
  const durationMs = (ai.durationMs && ai.durationMs > 0) ? Math.floor(ai.durationMs) : Math.max(100, Math.floor((p.cropEndMs || 0) - (p.cropStartMs || 0)) || 0);

  const item: RecordingItem = {
    id,
    uri: dest,
    createdAt: Date.now(),
    name: p.tempName.trim() || undefined,
    category: p.customCategory?.trim() || selectedCat.name,
    categoryCode: selectedCat.code,
    subcategory: p.subcategory || "",
    tags,
    notes: p.notes || "",
    version: 1,
    filename,
    cloudPath: path,
    syncStatus: "pending",
    progress: 0,
    stationId: sid,
    durationMs,
    trimStartMs: 0,
    trimEndMs: durationMs,
    tracks: createDefaultTracks(),
    segments: [],
    viewport: createDefaultViewport(durationMs),
    projectSettings: createDefaultProjectSettings(),
    waveform: p.sessionWaveform && p.sessionWaveform.length ? waveformManager.sliceWaveform(p.sessionWaveform, Math.max(durationMs, 1), 0, durationMs, 160) || undefined : waveformManager.generatePlaceholder(id, 160),
    workflowChoice: "save",
    workflowStatus: "ready_edit",
  } as any;

  const masterSegment: AudioSegment = {
    id: `master-${id}`,
    uri: dest,
    name: p.tempName.trim() || "Master Recording",
    startMs: 0,
    endMs: durationMs,
    trackId: "master-track",
    gain: 1,
    pan: 0,
    muted: false,
    fadeInMs: 0,
    fadeOutMs: 0,
    fadeInCurve: "linear",
    fadeOutCurve: "linear",
    color: "#3B82F6",
    sourceStartMs: 0,
    sourceDurationMs: durationMs,
    waveform: item.waveform,
  } as any;
  (item as any).segments = [masterSegment];

  useAudioStore.getState().addRecording(item as any, sid);
  try { useLogStore.getState().addBreadcrumb("save:added_to_store", { id, sid }); } catch {}

  const metadata = buildRecordingMetadata({
    stationId: sid,
    userId: useUserStore.getState().user.id,
    categoryCode: selectedCat.code,
    categoryName: p.customCategory?.trim() || selectedCat.name,
    subcategory: p.subcategory || "",
    tags,
    notes: p.notes || "",
    durationMs,
    trimStartMs: 0,
    trimEndMs: durationMs,
    version: 1,
    path,
    filename,
  });
  useUploadQueue.getState().enqueue({ id, stationId: sid, localUri: dest, metadata, status: "pending", progress: 0, createdAt: Date.now() });
  useUploadQueue.getState().pump();
  try { useLogStore.getState().addBreadcrumb("save:upload_enqueued", { id }); } catch {}

  return { id, dest, durationMs };
}

async function existsWithRetry(uri: string, tries = 3, delayMs = 150): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) return true;
    } catch {}
    if (i < tries - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

// Attempts physical crop first; if it fails, falls back to metadata-only crop
export async function saveCroppedRecording(p: SavePipelineParams): Promise<SavePipelineResult> {
  const sid = p.stationId;
  const startMs = Math.max(0, Math.floor(p.cropStartMs || 0));
  const endMs = Math.max(startMs + 100, Math.floor(p.cropEndMs || 0));
  const cropLen = Math.max(100, endMs - startMs);

  const now = new Date();
  const id = Crypto.randomUUID();
  const dir = await ensureRecordingDirectory(sid);

  const selectedCat = (() => {
    if (p.customCategory && p.customCategory.trim()) {
      return CATEGORY_OPTIONS.find(x => x.id === "other")!;
    }
    const byId = CATEGORY_OPTIONS.find(x => x.id === (p.selectedCategoryId || ""));
    return byId || CATEGORY_OPTIONS.find(x => x.id === "other")!;
  })();
  const userPrefix = (useUserStore.getState().user.email || "user").split("@")[0];
  const filename = generateUniqueFilename(sid, selectedCat.code, userPrefix);
  const dest = `${dir}/${filename}`;
  const tags = (p.tagsText || "").split(",").map((t) => t.trim()).filter(Boolean);
  const path = buildCloudPath(sid, now, selectedCat.code);

  // Decide source to move
  let workingUri: string = "";
  let physicallyTrimmed = false;

  // Breadcrumb: start
  try { useLogStore.getState().addBreadcrumb("save:start", { id, sid, baseUri: p.baseUri, preCropped: !!p.preCroppedUri, startMs, endMs }); } catch {}

  try {
    if (p.preCroppedUri) {
      // Use pre-cropped file
      const ok = await moveAudioFile(p.preCroppedUri, dest);
      if (!ok) throw new Error("move failed");
      workingUri = dest;
      physicallyTrimmed = true; // it is already cropped content
    } else {
      // Attempt physical crop
      const out = await trimToFile({ baseUri: p.baseUri, cropStartMs: startMs, cropEndMs: endMs, outExt: "m4a" }, sid);
      const ok = await moveAudioFile(out.uri, dest);
      if (!ok) throw new Error("move failed");
      workingUri = dest;
      physicallyTrimmed = true;
      // Clean up base file if it was temporary
      try { if (p.baseUri && p.baseUri.startsWith(FileSystem.cacheDirectory || "")) await FileSystem.deleteAsync(p.baseUri, { idempotent: true }); } catch {}
    }

    // Verify destination exists
    if (!(await existsWithRetry(workingUri))) {
      throw new Error("Saved file not found after write");
    }

    try { useLogStore.getState().addBreadcrumb("save:file_ready", { id, uri: workingUri }); } catch {}
  } catch (_e) {
    try { useLogStore.getState().addBreadcrumb("save:fallback_metadata", { id }); } catch {}
    // Fallback: copy original and mark trim via metadata
    await FileSystem.copyAsync({ from: p.baseUri, to: dest + ".tmp" });
    await FileSystem.moveAsync({ from: dest + ".tmp", to: dest });
    workingUri = dest;
    physicallyTrimmed = false;
  }

  // Probe duration
  const info = await getAudioFileInfo(workingUri);
  let durationMs = (info.durationMs && info.durationMs > 0) ? Math.floor(info.durationMs) : cropLen;
  if (!physicallyTrimmed) {
    // Respect crop range via metadata when fallback path used
    durationMs = cropLen;
  }

  // Build waveform
  let computedWaveform: number[] | undefined = undefined;
  try {
    if (p.sessionWaveform && p.sessionWaveform.length > 0) {
      const sliced = waveformManager.sliceWaveform(p.sessionWaveform, Math.max(endMs, 1), startMs, endMs, 160);
      computedWaveform = sliced || undefined;
    } else {
      // Placeholder; editor will try to backfill
      computedWaveform = waveformManager.generatePlaceholder(id, 160);
    }
  } catch {}

  // Build RecordingItem
  const item: RecordingItem = {
    id,
    uri: workingUri,
    createdAt: Date.now(),
    name: p.tempName.trim() || undefined,
    category: p.customCategory?.trim() || selectedCat.name,
    categoryCode: selectedCat.code,
    subcategory: p.subcategory || "",
    tags,
    notes: p.notes || "",
    version: 1,
    filename,
    cloudPath: path,
    syncStatus: "pending",
    progress: 0,
    stationId: sid,
    durationMs,
    trimStartMs: physicallyTrimmed ? 0 : startMs,
    trimEndMs: physicallyTrimmed ? durationMs : endMs,
    tracks: createDefaultTracks(),
    segments: [],
    viewport: createDefaultViewport(durationMs),
    projectSettings: createDefaultProjectSettings(),
    waveform: computedWaveform,
    workflowChoice: "crop",
    workflowStatus: "ready_edit",
  } as any;

  // Ensure master segment exists
  const masterSegment: AudioSegment = {
    id: `master-${id}`,
    uri: workingUri,
    name: p.tempName.trim() || "Master Recording",
    startMs: 0,
    endMs: durationMs,
    trackId: "master-track",
    gain: 1,
    pan: 0,
    muted: false,
    fadeInMs: 0,
    fadeOutMs: 0,
    fadeInCurve: "linear",
    fadeOutCurve: "linear",
    color: "#3B82F6",
    sourceStartMs: physicallyTrimmed ? 0 : startMs,
    sourceDurationMs: durationMs,
    waveform: computedWaveform,
  } as any;
  (item as any).segments = [masterSegment];

  // Add to store
  useAudioStore.getState().addRecording(item as any, sid);
  try { useLogStore.getState().addBreadcrumb("save:added_to_store", { id, sid }); } catch {}

  // Enqueue upload
  const metadata = buildRecordingMetadata({
    stationId: sid,
    userId: useUserStore.getState().user.id,
    categoryCode: selectedCat.code,
    categoryName: p.customCategory?.trim() || selectedCat.name,
    subcategory: p.subcategory || "",
    tags,
    notes: p.notes || "",
    durationMs,
    trimStartMs: item.trimStartMs || 0,
    trimEndMs: item.trimEndMs || durationMs,
    version: 1,
    path,
    filename,
  });
  useUploadQueue.getState().enqueue({ id, stationId: sid, localUri: workingUri, metadata, status: "pending", progress: 0, createdAt: Date.now() });
  useUploadQueue.getState().pump();
  try { useLogStore.getState().addBreadcrumb("save:upload_enqueued", { id }); } catch {}

  return { id, dest: workingUri, durationMs };
}
