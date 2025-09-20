import React, { useMemo, useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as FileSystem from "expo-file-system";
import * as MailComposer from "expo-mail-composer";
import * as Sharing from "expo-sharing";
import { useUserStore } from "../state/userStore";
import { canEditFiles } from "../utils/rbac";
import { useAudioStore, useRecordingsForStation } from "../state/audioStore";
import { CATEGORY_OPTIONS } from "../types/station";
import ExportPanel from "../components/ExportPanel";
import { useAudioPreview } from "../hooks/useAudioPreview";

const STATUS = [
  { id: "all", label: "All" },
  { id: "created", label: "New" },
  { id: "ready_edit", label: "Ready Edit" },
  { id: "in_edit", label: "Editing" },
  { id: "ready_broadcast", label: "Ready" },
  { id: "delivered", label: "Delivered" },
] as const;

type StatusId = typeof STATUS[number]["id"];

export default function AudioManagementScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const stationId = useUserStore((s) => s.user.currentStationId) ?? "station-a";
  const recordings = useRecordingsForStation(stationId);
  const removeRecording = useAudioStore((s) => s.removeRecording);
  const setCurrentEditId = useAudioStore((s) => s.setCurrentEditId);
  const user = useUserStore((s) => s.user);
  const role = (Array.isArray(user?.memberships) ? user.memberships : []).find((m: any) => m.stationId === stationId)?.role || "Viewer";
  const canEdit = canEditFiles(role);

  const [categoryId, setCategoryId] = useState<string>("all");
  const [statusId, setStatusId] = useState<StatusId>("all");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const selectForEdit = Boolean((route as any)?.params?.selectForEdit);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  
  // Single-item action modal state
  const [actionId, setActionId] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionEmail, setActionEmail] = useState("");
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  // Preselect from navigation
  useEffect(() => {
    try {
      const ids = (route as any)?.params?.selectedIds as string[] | undefined;
      if (Array.isArray(ids) && ids.length) setSelectedIds(ids);
    } catch {}
  }, [route]);

  const filtered = useMemo(() => {
    return recordings.filter((r) => {
      if (categoryId !== "all" && r.category !== CATEGORY_OPTIONS.find(c => c.id === categoryId)?.name) return false;
      if (statusId !== "all" && r.workflowStatus !== statusId) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const fields = [r.name || "", r.category || "", (r.tags || []).join(" "), r.notes || ""]; 
        if (!fields.some((f) => f.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [recordings, categoryId, statusId, query]);

  const audioPreview = useAudioPreview(recordings, previewId);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const deleteOne = async (id: string) => {
    try {
      const rec = recordings.find(r => r.id === id);
      if (!rec) { setConfirmDeleteId(null); return; }
      try { await FileSystem.deleteAsync(rec.uri, { idempotent: true }); } catch {}
      removeRecording(id, stationId);
      setSelectedIds((prev) => prev.filter(x => x !== id));
      setStatusMsg("Deleted"); setTimeout(()=>setStatusMsg(null), 2000);
    } catch {
      setStatusMsg("Delete failed"); setTimeout(()=>setStatusMsg(null), 2500);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const deleteMany = async () => {
    const ids = [...selectedIds];
    let fails = 0;
    for (const id of ids) {
      try {
        const rec = recordings.find(r => r.id === id);
        if (rec) { try { await FileSystem.deleteAsync(rec.uri, { idempotent: true }); } catch {} removeRecording(id, stationId); }
      } catch { fails++; }
    }
    setSelectedIds([]);
    setConfirmBulkDelete(false);
    if (fails) { setStatusMsg("Some items could not be deleted"); setTimeout(()=>setStatusMsg(null), 2500); }
    else { setStatusMsg(`Deleted ${ids.length} file${ids.length===1?"":"s"}`); setTimeout(()=>setStatusMsg(null), 2000); }
  };

  const goExportSelected = () => {
    try { // @ts-ignore
      navigation.navigate("ExportOptions", { selectedIds });
    } catch {}
  };

  const getExt = (name?: string | null) => {
    const ext = name?.split(".").pop()?.toLowerCase();
    return ext === "mp3" || ext === "wav" || ext === "m4a" ? ext : "m4a";
  };
  const getMime = (ext: string) => ext === "m4a" ? "audio/m4a" : ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : "application/octet-stream";
  const getUti = (ext: string) => ext === "m4a" ? "public.mpeg-4-audio" : ext === "mp3" ? "public.mp3" : ext === "wav" ? "com.microsoft.waveform-audio" : undefined;

  const doShareOne = async () => {
    if (!actionId) return;
    setActionStatus(null);
    try {
      const rec = recordings.find(r => r.id === actionId);
      if (!rec) { setActionStatus("File not found"); return; }
      const src = (rec.flattenedUri || rec.uri);
      const info = await FileSystem.getInfoAsync(src);
      if (!info.exists) { setActionStatus("File missing. Try again."); return; }
      const ext = getExt(rec.filename || rec.uri);
      const dest = `${FileSystem.cacheDirectory}share-${rec.id}.${ext}`;
      try { const di = await FileSystem.getInfoAsync(dest); if (di.exists) await FileSystem.deleteAsync(dest, { idempotent: true }); } catch {}
      try { await FileSystem.copyAsync({ from: src, to: dest }); } catch {}
      const available = await Sharing.isAvailableAsync();
      if (!available) { setActionStatus("Sharing is not available on this device"); return; }
      await Sharing.shareAsync(dest, { dialogTitle: rec.category || "Share", UTI: getUti(ext) as any, mimeType: getMime(ext) });
      setShowActionModal(false); setActionId(null);
    } catch (e) {
      setActionStatus("Share failed. Try again.");
    }
  };

  const doEmailOne = async () => {
    if (!actionId) return;
    setActionStatus(null);
    try {
      if (!actionEmail.trim()) { setActionStatus("Enter a recipient email"); return; }
      const can = await MailComposer.isAvailableAsync();
      if (!can) { setActionStatus("Mail not available on this device"); return; }
      const rec = recordings.find(r => r.id === actionId);
      if (!rec) { setActionStatus("File not found"); return; }
      const src = (rec.flattenedUri || rec.uri);
      const info = await FileSystem.getInfoAsync(src);
      if (!info.exists) { setActionStatus("File missing. Try again."); return; }
      const ext = getExt(rec.filename || rec.uri);
      const dest = `${FileSystem.cacheDirectory}send-${rec.id}.${ext}`;
      try { const di = await FileSystem.getInfoAsync(dest); if (di.exists) await FileSystem.deleteAsync(dest, { idempotent: true }); } catch {}
      try { await FileSystem.copyAsync({ from: src, to: dest }); } catch {}
      await MailComposer.composeAsync({ recipients: [actionEmail.trim()], subject: rec.category || "Audio", body: "Exported from Content To Air", attachments: [dest] });
      setShowActionModal(false); setActionId(null); setActionEmail(""); setStatusMsg("Email draft created"); setTimeout(()=>setStatusMsg(null), 2000);
    } catch (e) {
      setActionStatus("Email failed. Try again.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
        <View className="bg-white px-6 py-4 border-b border-gray-200">
          <Text className="text-2xl font-bold text-gray-800">Audio Management</Text>
          <Text className="text-gray-600">Browse, preview, select, and export your audio</Text>

          {/* Search */}
          <View className="mt-3 flex-row items-center rounded-xl border border-gray-300 bg-white px-3">
            <Ionicons name="search" size={16} color="#6B7280" />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search by name, tags, notes" className="flex-1 ml-2 py-2" />
          </View>

          {/* Filters */}
          <View className="mt-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                <Pressable onPress={() => setCategoryId("all")} className={`px-3 py-2 rounded-full border-2 ${categoryId === "all" ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"}`}>
                  <Text className={`${categoryId === "all" ? "text-blue-700" : "text-gray-700"}`}>All Categories</Text>
                </Pressable>
                {CATEGORY_OPTIONS.map((c) => (
                  <Pressable key={c.id} onPress={() => setCategoryId(c.id)} className={`px-3 py-2 rounded-full border-2 ${categoryId === c.id ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"}`}>
                    <Text className={`${categoryId === c.id ? "text-blue-700" : "text-gray-700"}`}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
              <View className="flex-row gap-2">
                {STATUS.map((s) => (
                  <Pressable key={s.id} onPress={() => setStatusId(s.id)} className={`px-3 py-2 rounded-full border-2 ${statusId === s.id ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"}`}>
                    <Text className={`${statusId === s.id ? "text-blue-700" : "text-gray-700"}`}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {statusMsg && (
          <View className="mx-6 mt-2 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
            <Text className="text-gray-700 text-sm text-center">{statusMsg}</Text>
          </View>
        )}
 
        {/* List */}
        <View className="bg-white mt-2 px-6 py-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-lg font-semibold text-gray-800">Files ({filtered.length})</Text>
              {selectedIds.length > 0 ? (
                <View className="flex-row gap-2">
                  <Pressable onPress={goExportSelected} className="px-3 py-1 rounded-full bg-blue-600">
                    <Text className="text-white text-sm">Export Selected</Text>
                  </Pressable>
                  <Pressable onPress={() => setSelectedIds([])} className="px-3 py-1 rounded-full bg-gray-200">
                    <Text className="text-gray-700 text-sm">Clear Selection</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

          <View className="space-y-3">
            {filtered.map((rec) => (
              <View key={rec.id} className={`p-4 rounded-lg border-2 ${selectedIds.includes(rec.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="font-medium text-gray-800 mr-2">{rec.name ?? "Recording"}</Text>
                      <View className="px-2 py-1 rounded-full bg-blue-50 border border-blue-200"><Text className="text-blue-700 text-xs">{rec.category}</Text></View>
                    </View>
                    <Text className="text-gray-500 text-xs mt-0.5">{new Date(rec.createdAt).toLocaleString()}</Text>

                    {/* Progress bar */}
                    {previewId === rec.id && (
                      <View className="mt-2">
                        <View className="h-1 bg-gray-200 rounded">
                          <View className="h-1 bg-green-600 rounded" style={{ width: `${Math.max(0, Math.min(100, (audioPreview.positionMs/Math.max(1, audioPreview.durationMs))*100))}%` }} />
                        </View>
                        <Text className="text-gray-400 text-xs mt-1">{Math.floor(audioPreview.positionMs/1000)}s / {Math.floor(Math.max(1, audioPreview.durationMs)/1000)}s</Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-row items-center">
                    <Pressable onPress={async () => { if (previewId === rec.id) { await audioPreview.toggle(); } else { setPreviewId(rec.id); } }} className="rounded-full w-9 h-9 items-center justify-center bg-green-600 mr-2">
                      <Ionicons name={(previewId===rec.id && audioPreview.isPlaying) ? "pause" : "play"} size={16} color="white" />
                    </Pressable>
                    {!selectForEdit && (
                      <Pressable onPress={() => toggleSelect(rec.id)} className="rounded-full w-9 h-9 items-center justify-center bg-blue-600 mr-2">
                        <Ionicons name={selectedIds.includes(rec.id) ? "checkmark" : "add"} size={16} color="white" />
                      </Pressable>
                    )}
                    <Pressable onPress={() => { setCurrentEditId(rec.id); navigation.navigate("Main", { screen: "Edit", params: { id: rec.id, uri: rec.uri, stationId } }); }} className="rounded-full w-9 h-9 items-center justify-center bg-gray-200 mr-2">
                      <Ionicons name={selectForEdit ? "checkmark" : "cut"} size={16} color="#374151" />
                    </Pressable>
                    <Pressable onPress={() => { setActionId(rec.id); setActionEmail(""); setActionStatus(null); setShowActionModal(true); }} className="rounded-full w-9 h-9 items-center justify-center bg-gray-200 mr-2" accessibilityLabel="More actions">
                      <Ionicons name="ellipsis-horizontal" size={16} color="#374151" />
                    </Pressable>
                    <Pressable disabled={!canEdit} onPress={() => setConfirmDeleteId(rec.id)} className={`rounded-full w-9 h-9 items-center justify-center ${canEdit ? 'bg-red-500' : 'bg-red-300'}`}>
                      <Ionicons name="trash" size={16} color="white" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
            {filtered.length === 0 && (
              <Text className="text-gray-500">No files match your filters</Text>
            )}
          </View>

          {/* Bulk actions */}
          {selectedIds.length > 0 && !selectForEdit && (
            <View className="mt-3 flex-row gap-3">
              <Pressable onPress={() => setConfirmBulkDelete(true)} className="flex-1 rounded-xl p-3 bg-red-600">
                <Text className="text-white text-center font-medium">Delete ({selectedIds.length})</Text>
              </Pressable>
            </View>
          )}

          {/* Export Panel */}
          {selectedIds.length > 0 && (
            <ExportPanel selectedIds={selectedIds} onClear={() => setSelectedIds([])} />
          )}
        </View>
      </ScrollView>
      {/* Confirm delete (single) */}
      <Modal visible={!!confirmDeleteId} transparent animationType="fade" onRequestClose={() => setConfirmDeleteId(null)}>
        <View className="flex-1 items-center justify-center bg-black bg-opacity-50">
          <View className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
            <Text className="text-lg font-semibold text-gray-800 mb-2">Delete file?</Text>
            <Text className="text-gray-600 mb-4">This action cannot be undone.</Text>
            <View className="flex-row gap-3">
              <Pressable onPress={() => setConfirmDeleteId(null)} className="flex-1 bg-gray-200 rounded-lg p-3">
                <Text className="text-center text-gray-700 font-medium">Cancel</Text>
              </Pressable>
              <Pressable onPress={() => { if (confirmDeleteId) deleteOne(confirmDeleteId); }} className="flex-1 bg-red-600 rounded-lg p-3">
                <Text className="text-center text-white font-medium">Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm delete (bulk) */}
      <Modal visible={confirmBulkDelete} transparent animationType="fade" onRequestClose={() => setConfirmBulkDelete(false)}>
        <View className="flex-1 items-center justify-center bg-black bg-opacity-50">
          <View className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
            <Text className="text-lg font-semibold text-gray-800 mb-2">Delete selected files?</Text>
            <Text className="text-gray-600 mb-4">You are about to delete {selectedIds.length} file{selectedIds.length===1?"":"s"}. This cannot be undone.</Text>
            <View className="flex-row gap-3">
              <Pressable onPress={() => setConfirmBulkDelete(false)} className="flex-1 bg-gray-200 rounded-lg p-3">
                <Text className="text-center text-gray-700 font-medium">Cancel</Text>
              </Pressable>
              <Pressable onPress={deleteMany} className="flex-1 bg-red-600 rounded-lg p-3">
                <Text className="text-center text-white font-medium">Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Single item actions */}
      <Modal visible={showActionModal} transparent animationType="fade" onRequestClose={() => setShowActionModal(false)}>
        <View className="flex-1 items-center justify-center bg-black bg-opacity-50">
          <View className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
            <Text className="text-lg font-semibold text-gray-800 mb-2">File actions</Text>
            <Text className="text-gray-600 mb-3">Share, email, or export this file</Text>

            <View className="mb-3">
              <Text className="text-gray-700 mb-1">Recipient email (for Email)</Text>
              <TextInput value={actionEmail} onChangeText={setActionEmail} placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address" className="border border-gray-300 rounded-lg px-3 py-2 bg-white" />
            </View>

            {actionStatus && (
              <View className="mb-3 p-2 rounded-lg bg-gray-100">
                <Text className="text-gray-700 text-xs">{actionStatus}</Text>
              </View>
            )}

            <View className="flex-row gap-2">
              <Pressable onPress={doShareOne} className="flex-1 bg-purple-600 rounded-lg p-3">
                <Text className="text-center text-white font-medium">Share…</Text>
              </Pressable>
              <Pressable onPress={doEmailOne} className="flex-1 bg-blue-600 rounded-lg p-3">
                <Text className="text-center text-white font-medium">Email…</Text>
              </Pressable>
            </View>
            <View className="flex-row gap-2 mt-2">
              <Pressable onPress={() => { if (actionId) { // @ts-ignore
                navigation.navigate("ExportOptions", { selectedIds: [actionId] }); setShowActionModal(false); } }} className="flex-1 bg-gray-800 rounded-lg p-3">
                <Text className="text-center text-white font-medium">Export…</Text>
              </Pressable>
              <Pressable onPress={() => { setShowActionModal(false); }} className="flex-1 bg-gray-200 rounded-lg p-3">
                <Text className="text-center text-gray-800 font-medium">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
