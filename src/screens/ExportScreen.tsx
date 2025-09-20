import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as MailComposer from "expo-mail-composer";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { useNavigation, useRoute } from "@react-navigation/native";

import { useAudioStore, useRecordingsForStation } from "../state/audioStore";
import { useUserStore } from "../state/userStore";
import { useAudioPreview } from "../hooks/useAudioPreview";
import { useDeliveryQueue } from "../state/deliveryQueue";
import { getAuth } from "../api/storage/oauth";
import { useStorageQueue } from "../state/storageQueue";
import { buildCloudPath } from "../utils/pathing";
import { StationProfile } from "../types/playout";
import { buildAssetPayload } from "../utils/assetPayload";
import { canEditFiles } from "../utils/rbac";
import { StationPill } from "../components/StationSwitcher";
import { useProfilesStore, buildDefaultProfile } from "../state/profileStore";
import { buildFileName, buildExportFilename } from "../utils/fileNaming";
import { buildMyriadCsv } from "../utils/sidecars/myriadCsv";
import { buildMyriadXml } from "../utils/sidecars/myriadXml";
import { buildMairlistMmd } from "../utils/sidecars/mairlistMmd";
import { buildEncoCsv } from "../utils/sidecars/encoCsv";

interface ExportOption {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  color: string;
}


function buildSidecarPreview(profile: StationProfile, filename: string, a: any): { name: string | null; body: string | null } {
  const base = filename.replace(/\.[^.]+$/, "");
  if (profile.sidecar.type === "csv") {
    if (profile.playout === "myriad") return { name: `${base}.csv`, body: buildMyriadCsv(filename, a) };
    if (profile.playout === "enco") return { name: `${base}.csv`, body: buildEncoCsv(filename, a) };
    return { name: `${base}.csv`, body: buildMyriadCsv(filename, a) };
  }
  if (profile.sidecar.type === "xml") return { name: `${base}.xml`, body: buildMyriadXml(filename, a) };
  if (profile.sidecar.type === "mmd") return { name: `${base}.mmd`, body: buildMairlistMmd(filename, a) };
  return { name: null, body: null };
}

export default function ExportScreen() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [showJobs, setShowJobs] = useState(false);
  const [showStorageJobs, setShowStorageJobs] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [manageMode, setManageMode] = useState(false);
  type Conn = { connected: boolean; verified: boolean; message?: string | null };
  const [connectionStatus, setConnectionStatus] = useState<Record<string, Conn>>({});
  const [showSendOptions, setShowSendOptions] = useState(false);
  const [selectedExportMethod, setSelectedExportMethod] = useState<string | null>(null);
  const route = useRoute<any>();

  // Preselect from navigation
  React.useEffect(() => {
    try {
      const ids = (route as any)?.params?.selectedIds as string[] | undefined;
      if (Array.isArray(ids) && ids.length) setSelectedFiles(ids);
    } catch {}
  }, [route]);

  const stationId = useUserStore((s) => s.user.currentStationId) ?? "station-a";
  const user = useUserStore((s) => s.user);
  const recordings = useRecordingsForStation(stationId);
  
  // Audio preview functionality
  const audioPreview = useAudioPreview(recordings, previewId);
  const removeRecording = useAudioStore((s) => s.removeRecording);
  const setCurrentEditId = useAudioStore((s) => s.setCurrentEditId);
  const memberships = Array.isArray(user?.memberships) ? user.memberships : [];
  const role = memberships.find((m: any) => m.stationId === stationId)?.role || "Viewer";
  const canEdit = canEditFiles(role);
  const navigation = useNavigation();
  
  // Queue and storage management
  const storageEnqueue = useStorageQueue((s)=> s.enqueue);
  const storagePump = useStorageQueue((s)=> s.pump);
  const storageJobs = useStorageQueue((s)=> s.jobs);
  const enqueueFrom = useDeliveryQueue((s) => s.enqueueFrom);
  const pump = useDeliveryQueue((s) => s.pump);
  const allItems = useDeliveryQueue((s) => s.items);
  const queueItems = useMemo(() => allItems.filter(i => i.stationId === stationId), [allItems, stationId]);
  
  // Check connection status for cloud providers (verified)
  React.useEffect(() => {
    const checkConnections = async () => {
      const providers = ['dropbox', 'gdrive', 'onedrive'] as const;
      const { verifyStorageProvider } = await import("../api/storage/verify");
      const status: Record<string, Conn> = {} as any;
      for (const provider of providers) {
        const res = await verifyStorageProvider(provider);
        status[provider] = { connected: res.connected, verified: res.verified, message: res.message };
      }
      setConnectionStatus(status);
    };
    checkConnections();
  }, []);
  
  // Calculate active uploads and queue status
  const activeUploads = useMemo(() => {
    const deliveryActive = queueItems.filter(item => 
      item.status === 'uploading' || item.status === 'connecting' || item.status === 'verifying'
    ).length;
    const storageActive = storageJobs.filter(job => 
      job.status === 'uploading' || job.status === 'pending'
    ).length;
    return deliveryActive + storageActive;
  }, [queueItems, storageJobs]);
  
  const totalQueued = queueItems.length + storageJobs.length;

  let station: any = undefined;
  try {
    const ss = require("../state/stationStore");
    const stState = ss?.useStationStore?.getState?.();
    const list = Array.isArray(stState?.stations) ? stState.stations : [];
    station = list.find((st: any) => st.id === stationId);
  } catch {}

  const savedProfile = useProfilesStore((s) => s.byStation[stationId]);
  const profile: StationProfile = savedProfile ?? buildDefaultProfile(stationId, station?.name);

  // Tagging form
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState(user.email || "Presenter");
  const [intro, setIntro] = useState("");
  const [eom, setEom] = useState(String(profile.defaults.eomSec ?? 0.5));
  const [explicit, setExplicit] = useState(false);
  const [isrc, setIsrc] = useState("");
  const [embargo, setEmbargo] = useState("");
  const [expires, setExpires] = useState("");

  const selected = useMemo(() => recordings.filter(r => selectedFiles.includes(r.id)), [recordings, selectedFiles]);
  const [includeFxTags, setIncludeFxTags] = useState(true);
  const effectsPresent = useMemo(() => selected.some(r => (r as any).effects || (r as any).segments?.length), [selected]);
  const preview = useMemo(() => {
    if (selected.length === 0) return null;
    const rec: any = selected[0];
    const payload = buildAssetPayload(rec, profile, {
      title: title || rec.name || 'Untitled',
      artist,
      category: rec.category || profile.defaults.category,
      intro_sec: intro ? parseFloat(intro) : undefined,
      eom_sec: eom ? parseFloat(eom) : undefined,
      explicit,
      isrc,
      embargo_start: embargo || undefined,
      expires_at: expires || undefined,
    });
    const fx = rec.effects || {};
    const segCount = Array.isArray(rec.segments) ? rec.segments.length : 0;
    const parts: string[] = [];
    if (fx.normalizeTargetLufs != null) parts.push(`nrm=${fx.normalizeTargetLufs}${typeof fx.normalizeGainDb==='number' ? `(${fx.normalizeGainDb.toFixed(1)}dB)` : ''}`);
    if (fx.fadeInMs) parts.push(`fi=${(fx.fadeInMs/1000).toFixed(2)}s`);
    if (fx.fadeOutMs) parts.push(`fo=${(fx.fadeOutMs/1000).toFixed(2)}s`);
    if (fx.padHeadMs) parts.push(`padH=${fx.padHeadMs}ms`);
    if (fx.padTailMs) parts.push(`padT=${fx.padTailMs}ms`);
    if (segCount>0) parts.push(`segments=${segCount}`);
    const fxMeta = includeFxTags && parts.length ? { fx: parts.join("_") } : undefined;
    const filename = buildFileName(payload.category, payload.title, payload.external_id, payload.intro_sec ?? undefined, payload.eom_sec ?? undefined, profile.defaults.fileFormat, fxMeta);
    const side = buildSidecarPreview(profile, filename.split("/").pop()!, payload);
    return { filename, sidecar: side };
  }, [selected, profile, title, artist, intro, eom, explicit, isrc, embargo, expires, includeFxTags]);

  const exportNamePreview = useMemo(() => {
    if (selected.length === 0) return null;
    const rec: any = selected[0];
    const ext = (rec.filename?.split(".").pop()?.toLowerCase()) || "m4a";
    return buildExportFilename({
      category: rec.category,
      subcategory: rec.subcategory,
      tags: rec.tags,
      title: rec.name || rec.id,
      id: rec.id,
      createdAt: rec.createdAt,
      ext,
    });
  }, [selected]);

  const deliverBlockReason = useMemo(() => {
    if (selected.length === 0) return "Select at least one recording";
    if (!title.trim()) return "Enter a title in Tagging";
    const notReady = selected.filter((r: any) => r.workflowStatus !== "ready_broadcast");
    if (notReady.length > 0) return "All selected must be Ready for broadcast";
    const needsFlatten = selected.some((r: any) => (r.segments?.length || 0) > 0 && !r.flattenedUri);
    if (needsFlatten) return "Flatten multi-clip edit first in Editor";
    return null;
  }, [selected, title]);
  const deliverDisabled = !!deliverBlockReason;

  const exportOptions: ExportOption[] = [
    { id: 'email', name: 'Email', icon: 'mail', description: 'Send via email attachment', color: 'bg-blue-500' },
    { id: 'dropbox', name: 'Dropbox', icon: 'cloud-upload', description: 'Upload to Dropbox folder', color: 'bg-green-500' },
    { id: 'share', name: 'Share', icon: 'share', description: 'Share to other apps', color: 'bg-purple-500' },
  ];



  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]);
  };

  const handleExport = async (method: string) => {
    setStatus(null);
    if (selectedFiles.length === 0) { setStatus({ type: "error", message: "Select at least one recording to export" }); return; }

    // For cloud storage methods, show send options modal
    if (method === 'dropbox' || method === 'gdrive' || method === 'onedrive') {
      setSelectedExportMethod(method);
      setShowSendOptions(true);
      return;
    }

    // For other methods, proceed directly
    await performExport(method, false);
  };

  const performExport = async (method: string, immediate: boolean = false) => {
    const selectedRecs = recordings.filter(r => selectedFiles.includes(r.id));
    const first = selectedRecs[0];
    const category = first?.category || "Export";

    try {
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
      const exportsDir = `${baseDir}Exports`;
      try { await FileSystem.makeDirectoryAsync(exportsDir, { intermediates: true }); } catch {}

      const exportPaths: string[] = [];
      for (const rec of selectedRecs) {
        const src = ((rec as any).flattenedUri as string) || rec.uri;
        const info = await FileSystem.getInfoAsync(src);
        if (!info.exists) { setStatus({ type: "error", message: "One or more files are missing" }); return; }
        const ext = (rec.filename?.split(".").pop()?.toLowerCase()) || "m4a";
        const fname = buildExportFilename({ category: rec.category, subcategory: (rec as any).subcategory, tags: (rec as any).tags, title: rec.name || rec.id, id: rec.id, createdAt: rec.createdAt, ext });
        const dest = `${exportsDir}/${fname}`;
        try { const di = await FileSystem.getInfoAsync(dest); if (di.exists) { await FileSystem.deleteAsync(dest, { idempotent: true }); } } catch {}
        await FileSystem.copyAsync({ from: src, to: dest });
        exportPaths.push(dest);
      }

      const ext0 = (first?.filename?.split(".").pop()?.toLowerCase()) || "m4a";
      const mime = ext0 === "m4a" ? "audio/m4a" : ext0 === "mp3" ? "audio/mpeg" : ext0 === "wav" ? "audio/wav" : "application/octet-stream";
      const uti = ext0 === "m4a" ? "public.mpeg-4-audio" : ext0 === "mp3" ? "public.mp3" : ext0 === "wav" ? "com.microsoft.waveform-audio" : undefined;

      if (method === "email") {
        if (!email.trim()) { setStatus({ type: "error", message: "Enter a recipient email for Email export" }); return; }
        await MailComposer.composeAsync({
          recipients: [email.trim()],
          subject: `${category} - ${selectedRecs.length} recording${selectedRecs.length > 1 ? "s" : ""}`,
          body: "Exported from Content To Air",
          attachments: exportPaths,
        });
        setStatus({ type: "success", message: `Draft email prepared with ${exportPaths.length} file${exportPaths.length > 1 ? "s" : ""}` });
      } else if (method === "share") {
        const available = await Sharing.isAvailableAsync();
        if (!available) { setStatus({ type: "error", message: "Sharing is not available on this device" }); return; }
        await Sharing.shareAsync(exportPaths[0], { dialogTitle: `${category}`, UTI: uti as any, mimeType: mime });
        setStatus({ type: "success", message: `Shared ${Math.min(1, exportPaths.length)} of ${exportPaths.length} file${exportPaths.length > 1 ? "s" : ""}` });
      } else if (method === "dropbox") {
        // If Dropbox connected, upload via storageQueue; otherwise fallback to system share
        const auth = await getAuth("dropbox");
        if (auth?.accessToken) {
          // If sending immediately, require verified connection
          if (immediate) {
            const { verifyStorageProvider } = await import("../api/storage/verify");
            const res = await verifyStorageProvider("dropbox");
            if (!res.verified) {
              setStatus({ type: "error", message: "Dropbox not verified. Please connect and verify in Storage Settings." });
              (navigation as any).navigate('StorageSettings');
              return;
            }
          }
          for (const rec of selectedRecs) {
            const src = ((rec as any).flattenedUri as string) || rec.uri;
            const ext = (rec.filename?.split(".").pop()?.toLowerCase()) || "m4a";
            const fname = buildExportFilename({ category: rec.category, subcategory: (rec as any).subcategory, tags: (rec as any).tags, title: rec.name || rec.id, id: rec.id, createdAt: rec.createdAt, ext });
            const dir = buildCloudPath(stationId, new Date(rec.createdAt), rec.categoryCode || "other");
            const remotePath = `${dir}${fname}`;
            storageEnqueue({ id: `${rec.id}-dbx`, provider: "dropbox", localUri: src, remotePath, status: "pending", progress: 0, retries: 0 });
          }
          
          if (immediate) {
            // Start upload immediately
            await storagePump();
            setStatus({ type: "success", message: `Uploading ${selectedRecs.length} file${selectedRecs.length>1?"s":""} to Dropbox now...` });
          } else {
            // Just queue for later
            setStatus({ type: "success", message: `Queued ${selectedRecs.length} file${selectedRecs.length>1?"s":""} to Dropbox` });
          }
        } else {
          const available = await Sharing.isAvailableAsync();
          if (!available) { setStatus({ type: "error", message: "Sharing is not available on this device" }); return; }
          await Sharing.shareAsync(exportPaths[0], { dialogTitle: `${category}`, UTI: uti as any, mimeType: mime });
          setStatus({ type: "success", message: `Shared ${Math.min(1, exportPaths.length)} of ${exportPaths.length} file${exportPaths.length > 1 ? "s" : ""}` });
        }
      }

      setSelectedFiles([]);
    } catch (e) {
      setStatus({ type: "error", message: "Export failed. Please try again." });
    }
  };

  const deliverToPlayout = async () => {
    setStatus(null);
    if (selectedFiles.length === 0) { setStatus({ type: 'error', message: 'Select at least one recording to deliver' }); return; }
    if (!title.trim()) { setStatus({ type: 'error', message: 'Enter a title in Tagging' }); return; }
    const selectedRecs = recordings.filter(r => selectedFiles.includes(r.id));
    try {
      const notReady = selectedRecs.filter((r: any) => (r.workflowStatus !== 'ready_broadcast'));
      if (notReady.length > 0) { setStatus({ type: 'error', message: 'All selected must be Ready for broadcast before delivery' }); return; }
      for (const rec of selectedRecs) {
        const anyRec: any = rec as any;
        const fx = anyRec.effects || {};
        const segCount = Array.isArray(anyRec.segments) ? anyRec.segments.length : 0;
        if (segCount > 0 && !anyRec.flattenedUri) { setStatus({ type: 'error', message: 'Flatten multi-clip edit first in Editor' }); return; }
        const parts: string[] = [];
        if (fx.normalizeTargetLufs != null) parts.push(`nrm=${fx.normalizeTargetLufs}${typeof fx.normalizeGainDb==='number' ? `(${fx.normalizeGainDb.toFixed(1)}dB)` : ''}`);
        if (fx.fadeInMs) parts.push(`fi=${(fx.fadeInMs/1000).toFixed(2)}s`);
        if (fx.fadeOutMs) parts.push(`fo=${(fx.fadeOutMs/1000).toFixed(2)}s`);
        if (fx.padHeadMs) parts.push(`padH=${fx.padHeadMs}ms`);
        if (fx.padTailMs) parts.push(`padT=${fx.padTailMs}ms`);
        if (segCount>0) parts.push(`segments=${segCount}`);
        const fxNotes = parts.length ? `FX ${parts.join(' ')}` : undefined;
        const payload = buildAssetPayload(rec, profile, {
          title: title || rec.name || 'Untitled',
          artist,
      category: rec.category || profile.defaults.category,
          intro_sec: intro ? parseFloat(intro) : undefined,
          eom_sec: eom ? parseFloat(eom) : undefined,
          explicit,
          isrc,
          embargo_start: embargo || undefined,
          expires_at: expires || undefined,
          notes: fxNotes,
        });
        const useUri = (anyRec.flattenedUri || rec.uri);
        await enqueueFrom({ id: rec.id, stationId, localUri: useUri, profile, asset: payload, ext: profile.defaults.fileFormat });
      }
      await pump();
      setStatus({ type: 'success', message: `Queued ${selectedRecs.length} item${selectedRecs.length>1?'s':''} to ${profile.delivery.method === 'local' ? 'Local Staging' : 'Delivery (local fallback)'}` });
    } catch {
      setStatus({ type: 'error', message: 'Delivery failed. Check settings.' });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="bg-white px-6 py-4 border-b border-gray-200">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-gray-800">Export & Share</Text>
              <Text className="text-gray-600">Send your recordings or deliver to playout</Text>
            </View>
          </View>
          
          {/* Connection Status & Queue Overview */}
          <View className="bg-gray-50 rounded-lg p-3 mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-gray-700">Cloud Storage</Text>
              <Pressable onPress={() => (navigation as any).navigate('StorageSettings')} className="px-2 py-1 rounded bg-blue-100">
                <Text className="text-blue-700 text-xs">Settings</Text>
              </Pressable>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center">
                <View className={`w-2 h-2 rounded-full mr-2 ${connectionStatus.dropbox?.verified ? 'bg-green-500' : (connectionStatus.dropbox?.connected ? 'bg-yellow-500' : 'bg-gray-300')}`} />
                <Text className="text-xs text-gray-600">Dropbox</Text>
              </View>
              <View className="flex-row items-center">
                <View className={`w-2 h-2 rounded-full mr-2 ${connectionStatus.gdrive?.verified ? 'bg-green-500' : (connectionStatus.gdrive?.connected ? 'bg-yellow-500' : 'bg-gray-300')}`} />
                <Text className="text-xs text-gray-600">Google Drive</Text>
              </View>
              <View className="flex-row items-center">
                <View className={`w-2 h-2 rounded-full mr-2 ${connectionStatus.onedrive?.verified ? 'bg-green-500' : (connectionStatus.onedrive?.connected ? 'bg-yellow-500' : 'bg-gray-300')}`} />
                <Text className="text-xs text-gray-600">OneDrive</Text>
              </View>
            </View>
          </View>
          
          {/* Queue Status */}
          {totalQueued > 0 && (
            <View className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-blue-800 font-medium text-sm">
                    {activeUploads > 0 ? `${activeUploads} uploading` : `${totalQueued} queued`}
                  </Text>
                  <Text className="text-blue-600 text-xs">
                    {activeUploads > 0 ? `${totalQueued - activeUploads} waiting` : 'Ready to upload'}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Pressable onPress={() => (navigation as any).navigate('UploadQueue')} className="px-3 py-2 rounded bg-blue-600">
                    <Text className="text-white text-xs">View Queue</Text>
                  </Pressable>
                  {activeUploads === 0 && totalQueued > 0 && (
                    <Pressable onPress={async () => { await pump(); await storagePump(); }} className="px-3 py-2 rounded bg-green-600">
                      <Text className="text-white text-xs">Upload Now</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          )}
          
          <View className="flex-row gap-2">
            <Pressable onPress={() => // @ts-ignore
              navigation.navigate('PlayoutSettings')} className="px-3 py-2 rounded-full bg-indigo-600"><Text className="text-white text-sm">Playout Settings</Text></Pressable>
            <Pressable onPress={() => (navigation as any).navigate('UploadQueue')} className="px-3 py-2 rounded-full bg-gray-800">
              <Text className="text-white text-sm">
                Queue ({totalQueued})
                {activeUploads > 0 && <Text className="text-green-300"> • {activeUploads} active</Text>}
              </Text>
            </Pressable>
          </View>
        </View>

        {status && (
          <View className={`${status.type === 'error' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border rounded-md mx-6 mt-3 px-3 py-2`}>
            <Text className={`${status.type === 'error' ? 'text-red-700' : 'text-green-700'} text-sm`}>{status.message}</Text>
          </View>
        )}

        <View className="px-6 mt-2"><StationPill /></View>

        {/* File Selection */}
        <View className="bg-white mt-2 px-6 py-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-semibold text-gray-800">Select Files ({selectedFiles.length} selected)</Text>
            <Pressable disabled={!canEdit} onPress={() => setManageMode(!manageMode)} className={`px-3 py-1 rounded-full ${canEdit ? 'bg-gray-200' : 'bg-gray-100'}`}>
              <Text className="text-gray-700 text-sm">{manageMode ? 'Done' : 'Manage'}</Text>
            </Pressable>
          </View>
          <View className="space-y-3">
            {recordings.map((rec) => (
              <Pressable key={rec.id} onPress={() => toggleFileSelection(rec.id)} className={`p-4 rounded-lg border-2 ${selectedFiles.includes(rec.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="font-medium text-gray-800 mr-2">{rec.name ?? "Recording"}</Text>
                      <View className="px-2 py-1 rounded-full bg-blue-50 border border-blue-200"><Text className="text-blue-700 text-xs">{rec.category}</Text></View>
                    </View>
                    <View className="flex-row items-center space-x-4 mt-1"><Text className="text-gray-500 text-sm">{new Date(rec.createdAt).toLocaleString()}</Text></View>
                    
                    {/* Audio Preview Progress Bar */}
                    {previewId === rec.id && (
                      <View className="mt-2">
                        <View className="h-1 bg-gray-200 rounded">
                          <View 
                            className="h-1 bg-blue-600 rounded" 
                            style={{ 
                              width: `${Math.max(0, Math.min(100, (audioPreview.positionMs / Math.max(1, audioPreview.durationMs)) * 100))}%` 
                            }} 
                          />
                        </View>
                        <Text className="text-gray-400 text-xs mt-1">
                          {Math.floor(audioPreview.positionMs / 1000)}s / {Math.floor(Math.max(1, audioPreview.durationMs) / 1000)}s
                        </Text>
                      </View>
                    )}
                  </View>
                  {manageMode ? (
                    <View className="flex-row items-center">
                      <Pressable 
                        onPress={async () => {
                          if (previewId === rec.id) {
                            await audioPreview.toggle();
                          } else {
                            setPreviewId(rec.id);
                          }
                        }} 
                        className="rounded-full w-9 h-9 items-center justify-center bg-blue-600 mr-2"
                      >
                        <Ionicons 
                          name={(previewId === rec.id && audioPreview.isPlaying) ? "pause" : "play"} 
                          size={16} 
                          color="white" 
                        />
                      </Pressable>
                      <Pressable disabled={!canEdit} onPress={() => { if (!canEdit) return; setCurrentEditId(rec.id); // @ts-ignore
                        navigation.navigate("Main", { screen: "Edit" }); }} className={`rounded-full w-9 h-9 items-center justify-center mr-2 ${canEdit ? 'bg-gray-200' : 'bg-gray-100'}`}>
                        <Ionicons name="pencil" size={16} color="#374151" />
                      </Pressable>
                      <Pressable disabled={!canEdit} onPress={async () => { if (!canEdit) return; try { await FileSystem.deleteAsync(rec.uri, { idempotent: true }); } catch {} removeRecording(rec.id, stationId); }} className={`rounded-full w-9 h-9 items-center justify-center ${canEdit ? 'bg-red-500' : 'bg-red-300'}`}>
                        <Ionicons name="trash" size={16} color="white" />
                      </Pressable>
                    </View>
                  ) : (
                    <View className="flex-row items-center">
                      <Pressable 
                        onPress={async () => {
                          if (previewId === rec.id) {
                            await audioPreview.toggle();
                          } else {
                            setPreviewId(rec.id);
                          }
                        }} 
                        className="rounded-full w-9 h-9 items-center justify-center bg-blue-600 mr-3"
                      >
                        <Ionicons 
                          name={(previewId === rec.id && audioPreview.isPlaying) ? "pause" : "play"} 
                          size={16} 
                          color="white" 
                        />
                      </Pressable>
                      <Ionicons name={selectedFiles.includes(rec.id) ? 'checkmark-circle' : 'radio-button-off'} size={24} color={selectedFiles.includes(rec.id) ? '#3B82F6' : '#9CA3AF'} />
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
        </View>
        </View>

        {exportNamePreview && (
          <View className="bg-white mt-2 px-6 py-4">
            <Text className="text-lg font-semibold text-gray-800 mb-1">Export filename preview</Text>
            <Text className="text-gray-900 text-xs">{exportNamePreview}</Text>
          </View>
        )}

        {/* Tagging for Playout Delivery */}
        <View className="bg-white mt-2 px-6 py-4">
          <Text className="text-lg font-semibold text-gray-800 mb-3">Tagging (Playout)</Text>
          <View className="space-y-2">
            <TextInput value={title} onChangeText={setTitle} placeholder="Title" className="border border-gray-300 rounded-lg px-3 py-2 bg-white" />
            <TextInput value={artist} onChangeText={setArtist} placeholder="Artist" className="border border-gray-300 rounded-lg px-3 py-2 bg-white" />
            <View className="flex-row gap-2">
              <TextInput value={intro} onChangeText={setIntro} placeholder="Intro sec" keyboardType="numeric" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white" />
              <TextInput value={eom} onChangeText={setEom} placeholder="EOM sec" keyboardType="numeric" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white" />
            </View>
            <TextInput value={isrc} onChangeText={setIsrc} placeholder="ISRC (optional)" className="border border-gray-300 rounded-lg px-3 py-2 bg-white" />
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-gray-700">Explicit content</Text>
              <Pressable onPress={() => setExplicit((v)=>!v)} className={`px-3 py-1 rounded-full ${explicit ? 'bg-red-500' : 'bg-gray-300'}`}>
                <Text className="text-white text-xs">{explicit ? 'Yes' : 'No'}</Text>
              </Pressable>
            </View>
            <View className="flex-row gap-2">
              <TextInput value={embargo} onChangeText={setEmbargo} placeholder="Embargo ISO (optional)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white" />
              <TextInput value={expires} onChangeText={setExpires} placeholder="Expires ISO (optional)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white" />
            </View>
          </View>

          {effectsPresent && (
            <View className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <Text className="text-yellow-800 text-sm">Effects/segments detected. Sidecar notes will include a concise FX summary.</Text>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-yellow-700 text-xs">Include FX tags in filename preview</Text>
                <Pressable onPress={() => setIncludeFxTags((v) => !v)} className={`px-3 py-1 rounded-full ${includeFxTags ? 'bg-yellow-600' : 'bg-gray-300'}`} accessibilityRole="button" accessibilityLabel="Toggle FX tags in filename">
                  <Text className="text-white text-xs">{includeFxTags ? 'On' : 'Off'}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Previews */}
          {preview && (
            <View className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <Text className="text-gray-700 text-sm">Filename preview</Text>
              <Text className="text-gray-900 text-xs mt-1">{preview.filename}</Text>
              {preview.sidecar.name && (
                <View className="mt-3">
                  <Text className="text-gray-700 text-sm">Sidecar preview ({preview.sidecar.name})</Text>
                  <View className="mt-1 p-2 border border-gray-200 rounded bg-white">
                    <Text className="text-gray-800 text-xs" numberOfLines={6}>{preview.sidecar.body}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {deliverBlockReason && (
            <View className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <Text className="text-yellow-800 text-sm">{deliverBlockReason}</Text>
            </View>
          )}
          <Pressable onPress={deliverToPlayout} disabled={deliverDisabled} className={`mt-3 rounded-lg p-3 ${deliverDisabled ? 'bg-blue-300' : 'bg-blue-600'}`} accessibilityRole="button" accessibilityLabel="Deliver to playout">
            <Text className="text-white text-center font-medium">Deliver to Playout ({profile.delivery.method === 'local' ? 'Local Staging' : 'Configured'})</Text>
          </Pressable>
        </View>

        {/* Email Input for Email Export */}
        <View className="bg-white mt-2 px-6 py-4">
          <Text className="text-lg font-semibold text-gray-800 mb-3">Email Address</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="Enter recipient email address" keyboardType="email-address" autoCapitalize="none" className="border border-gray-300 rounded-lg px-3 py-2 bg-white" />
        </View>

        {/* Bulk delete when managing */}
        {manageMode && canEdit && selectedFiles.length > 0 && (
          <View className="bg-white mt-2 px-6 py-4">
            <Pressable onPress={async () => {
              for (const id of selectedFiles) {
                const rec = recordings.find(r => r.id === id);
                if (rec) { try { await FileSystem.deleteAsync(rec.uri, { idempotent: true }); } catch {}; removeRecording(id, stationId); }
              }
              setSelectedFiles([]); setStatus({ type: 'success', message: 'Deleted selected recordings' });
            }} className="bg-red-500 rounded-lg p-4">
              <View className="flex-row items-center justify-center">
                <Ionicons name="trash" size={20} color="white" />
                <Text className="text-white font-medium ml-2">Delete selected</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Export Options */}
        <View className="bg-white mt-2 px-6 py-4 mb-6">
          <Text className="text-lg font-semibold text-gray-800 mb-4">Export Options</Text>
          <View className="space-y-3">
            {exportOptions.map((option) => (
              <Pressable key={option.id} onPress={() => handleExport(option.id)} className={`${option.color} rounded-lg p-4`}>
                <View className="flex-row items-center">
                  <Ionicons name={option.icon} size={24} color="white" />
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold text-lg">{option.name}</Text>
                    <Text className="text-white text-sm opacity-90">{option.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="white" />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>


      {/* Jobs Modal */}
      <Modal visible={showJobs} transparent animationType="slide" onRequestClose={() => setShowJobs(false)}>
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-xl p-6 pb-8 max-h-[70%]">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xl font-bold text-gray-800">Delivery Jobs</Text>
              <Pressable onPress={() => setShowJobs(false)} className="px-3 py-2 bg-gray-200 rounded-full"><Text className="text-gray-700">Close</Text></Pressable>
            </View>
            {queueItems.length === 0 ? (
              <Text className="text-gray-600">No jobs yet</Text>
            ) : (
              <View className="space-y-3">
                {queueItems.map((it) => (
                  <View key={it.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 mr-3">
                        <Text className="text-gray-800 text-sm" numberOfLines={1}>{it.remoteRelPath}</Text>
                        <Text className="text-gray-600 text-xs mt-1">{it.status.toUpperCase()} {it.error ? `• ${it.error}` : ''}</Text>
                        <View className="h-1 bg-gray-200 rounded mt-2"><View style={{ width: `${Math.round((it.progress||0)*100)}%` }} className="h-1 bg-blue-600 rounded" /></View>
                      </View>
                      <View className="flex-row gap-2">
                        {it.status === 'failed' && (
                          <Pressable onPress={async () => { await useDeliveryQueue.getState().retry(it.id); }} className="px-3 py-2 bg-yellow-500 rounded"><Text className="text-white text-xs">Retry</Text></Pressable>
                        )}
                        <Pressable onPress={() => useDeliveryQueue.getState().remove(it.id)} className="px-3 py-2 bg-red-500 rounded"><Text className="text-white text-xs">Remove</Text></Pressable>
                      </View>
                    </View>
                  </View>
                ))}
                <View className="flex-row gap-2">
                  <Pressable onPress={() => useDeliveryQueue.getState().clearCompleted()} className="flex-1 px-3 py-3 bg-gray-200 rounded"><Text className="text-center text-gray-800">Clear completed</Text></Pressable>
                  <Pressable onPress={async () => { await pump(); }} className="flex-1 px-3 py-3 bg-blue-600 rounded"><Text className="text-center text-white">Run now</Text></Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Send Options Modal */}
      <Modal visible={showSendOptions} transparent animationType="slide" onRequestClose={() => setShowSendOptions(false)}>
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-xl p-6 pb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-gray-800">
                Send to {selectedExportMethod === 'dropbox' ? 'Dropbox' : selectedExportMethod === 'gdrive' ? 'Google Drive' : 'OneDrive'}
              </Text>
              <Pressable onPress={() => setShowSendOptions(false)} className="px-3 py-2 bg-gray-200 rounded-full">
                <Text className="text-gray-700">Cancel</Text>
              </Pressable>
            </View>
            
            <Text className="text-gray-600 mb-6">
              How would you like to send {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}?
            </Text>
            
            <View className="space-y-3">
              {/* Send Now Option */}
              <Pressable 
                onPress={async () => {
                  setShowSendOptions(false);
                  await performExport(selectedExportMethod!, true);
                }} 
                className="bg-green-500 rounded-lg p-4"
              >
                <View className="flex-row items-center">
                  <Ionicons name="flash" size={24} color="white" />
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold text-lg">Send Now</Text>
                    <Text className="text-white text-sm opacity-90">Upload immediately</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="white" />
                </View>
              </Pressable>
              
              {/* Queue for Later Option */}
              <Pressable 
                onPress={async () => {
                  setShowSendOptions(false);
                  await performExport(selectedExportMethod!, false);
                }} 
                className="bg-blue-500 rounded-lg p-4"
              >
                <View className="flex-row items-center">
                  <Ionicons name="time" size={24} color="white" />
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold text-lg">Queue for Later</Text>
                    <Text className="text-white text-sm opacity-90">Add to upload queue</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="white" />
                </View>
              </Pressable>
            </View>
            
            {/* Connection Status */}
            <View className="mt-4 p-3 bg-gray-50 rounded-lg">
              <View className="flex-row items-center">
                <View className={`w-2 h-2 rounded-full mr-2 ${connectionStatus[selectedExportMethod!]?.verified ? 'bg-green-500' : (connectionStatus[selectedExportMethod!]?.connected ? 'bg-yellow-500' : 'bg-red-500')}`} />
                <Text className="text-gray-700 text-sm">
                  {connectionStatus[selectedExportMethod!]?.verified ? 'Verified' : (connectionStatus[selectedExportMethod!]?.connected ? 'Connected (mock)' : 'Not connected')}
                </Text>
                {!connectionStatus[selectedExportMethod!]?.connected && (
                  <Pressable onPress={() => (navigation as any).navigate('StorageSettings')} className="ml-auto px-2 py-1 bg-blue-100 rounded">
                    <Text className="text-blue-700 text-xs">Connect</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
