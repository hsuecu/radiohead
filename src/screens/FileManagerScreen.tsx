import React from "react";
import { Audio } from "expo-av";
import { View, Text, ScrollView, Pressable, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { useUserStore } from "../state/userStore";
import { useRecordingsForStation, useAudioStore } from "../state/audioStore";
import { CATEGORY_OPTIONS } from "../types/station";
import { useUploadQueue } from "../state/uploadQueue";
import { useNavigation, useRoute } from "@react-navigation/native";

// Workflow integration
import { BreadcrumbNavigation } from "../components/WorkflowStepper";
import { useWorkflowStore, getWorkflowDefinition } from "../state/workflowStore";
import { useWorkflowRouter } from "../utils/workflowRouter";

export default function FileManagerScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  
  // Workflow integration
  const currentWorkflow = useWorkflowStore((s) => s.currentWorkflow);
  const breadcrumbs = useWorkflowStore((s) => s.breadcrumbs);
  const workflowRouter = useWorkflowRouter();
  
  // Check if we're in workflow mode
  const workflowType = route.params?.workflowType;
  const selectMode = route.params?.selectMode || false;
  const workflowTitle = route.params?.title || "Files";
  
  const [showDetailsId, setShowDetailsId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [subcategory, setSubcategory] = React.useState("");
  const [tagsText, setTagsText] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const stationId = useUserStore((s) => s.user.currentStationId) ?? "station-a";
  const recordings = useRecordingsForStation(stationId);
  const removeRecording = useAudioStore((s) => s.removeRecording);
  const setCurrentEditId = useAudioStore((s) => s.setCurrentEditId);
  const updateRecording = useAudioStore((s) => s.updateRecording);
  const retry = useUploadQueue((s) => s.retry);
  const enqueue = useUploadQueue((s) => s.enqueue);
  const pump = useUploadQueue((s) => s.pump);

  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [previewSound, setPreviewSound] = React.useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [positionMs, setPositionMs] = React.useState(0);
  const [durationMs, setDurationMs] = React.useState(0);
  const [autoPlayNext, setAutoPlayNext] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    let active: Audio.Sound | null = null;
    (async () => {
      try {
        if (!previewId) return;
        const rec = recordings.find(r => r.id === previewId);
        if (!rec?.uri) return;
        const info = await FileSystem.getInfoAsync(rec.uri);
        if (!mounted) return;
        if (!info.exists) return;
        const { sound, status } = await Audio.Sound.createAsync({ uri: rec.uri }, { shouldPlay: false, progressUpdateIntervalMillis: 200 });
        active = sound;
        setPreviewSound(sound);
        const st: any = status;
        if (typeof st?.durationMillis === "number") setDurationMs(st.durationMillis);
        if (autoPlayNext) { try { sound.playAsync(); } catch {} setAutoPlayNext(false); }
        sound.setOnPlaybackStatusUpdate((s: any) => {
          if (!s?.isLoaded) return;
          if (typeof s?.positionMillis === "number") setPositionMs(s.positionMillis);
          if (typeof s?.durationMillis === "number") setDurationMs(s.durationMillis);
          if (typeof s?.isPlaying === "boolean") setIsPlaying(s.isPlaying);
        });
      } catch {} 
    })();
    return () => { mounted = false; try { active?.unloadAsync(); } catch {}; setPreviewSound(null); setIsPlaying(false); setPositionMs(0); setDurationMs(0); };
  }, [previewId]);

  // Handle file selection for edit workflow
  const handleFileSelect = (recording: any) => {
    if (selectMode && workflowType === "edit") {
      // Navigate to editor with selected file
      setCurrentEditId(recording.id);
      workflowRouter.navigateToStep("edit");
      navigation.navigate("Main", { 
        screen: "Edit", 
        params: { 
          id: recording.id, 
          uri: recording.uri, 
          stationId,
          fromWorkflow: true 
        } 
      });
    } else {
      // Normal edit behavior
      setCurrentEditId(recording.id);
      navigation.navigate("Main", { 
        screen: "Edit", 
        params: { 
          id: recording.id, 
          uri: recording.uri, 
          stationId 
        } 
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Breadcrumb Navigation for Workflow */}
      {currentWorkflow === "edit" && breadcrumbs.length > 0 && (
        <BreadcrumbNavigation
          breadcrumbs={breadcrumbs}
          onBreadcrumbPress={(breadcrumb, index) => workflowRouter.goBack()}
          workflowColor={getWorkflowDefinition("edit")?.color}
        />
      )}
      
      <ScrollView className="flex-1">
        <View className="bg-white px-6 py-4 border-b border-gray-200">
          <Text className="text-2xl font-bold text-gray-800">
            {selectMode ? workflowTitle : "Files"}
          </Text>
          <Text className="text-gray-600">
            {selectMode 
              ? "Select a file to edit in your workflow" 
              : "Your station files and sync status"
            }
          </Text>
          
          {/* Workflow indicator */}
          {selectMode && (
            <View className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text className="text-green-800 text-sm ml-2">
                  Tap a file to continue with your edit workflow
                </Text>
              </View>
            </View>
          )}
        </View>

        <View className="bg-white mt-2 px-6 py-4">
          <Text className="text-lg font-semibold text-gray-800 mb-3">Station Files ({recordings.length})</Text>
          <View className="space-y-3">
            {recordings.map((rec) => (
              <View key={rec.id} className="p-4 rounded-lg border-2 border-gray-200 bg-gray-50">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="font-medium text-gray-800">{rec.name || rec.filename || rec.id}</Text>
                    <Text className="text-gray-500 text-xs">{rec.category} • {new Date(rec.createdAt).toLocaleString()}</Text>
                    {rec.syncStatus && (
                      <Text className={`mt-1 text-xs ${rec.syncStatus==='synced' ? 'text-green-700' : rec.syncStatus==='failed' ? 'text-red-700' : 'text-yellow-800'}`}>
                        {rec.syncStatus==='uploading' ? `Uploading ${Math.round((rec.progress||0)*100)}%` : rec.syncStatus==='pending' ? 'Pending Sync' : rec.syncStatus==='failed' ? 'Retry required' : 'Synced'}
                      </Text>
                    )}
                    {previewId===rec.id && (
                      <View className="mt-2">
                        <View className="h-1 bg-gray-200 rounded">
                          <View className="h-1 bg-green-600 rounded" style={{ width: `${Math.max(0, Math.min(100, (positionMs/Math.max(1, durationMs))*100))}%` }} />
                        </View>
                        <Text className="text-gray-400 text-xs mt-1">{Math.floor(positionMs/1000)}s / {Math.floor(Math.max(1, durationMs)/1000)}s</Text>
                      </View>
                    )}
                  </View>
                 <View className="flex-row items-center">
                     <Pressable 
                       onPress={() => handleFileSelect(rec)} 
                       className={`rounded-full px-3 h-9 items-center justify-center mr-2 ${
                         selectMode ? 'bg-green-600' : 'bg-gray-200'
                       }`}
                     >
                       <Text className={`text-xs ${selectMode ? 'text-white' : 'text-gray-700'}`}>
                         {selectMode ? 'Select' : 'Edit'}
                       </Text>
                     </Pressable>
                      <Pressable 
                        onPress={async () => {
                          if (previewId === rec.id && previewSound) {
                            try { 
                              const st: any = await previewSound.getStatusAsync();
                              if (st?.isLoaded && st.isPlaying) { await previewSound.pauseAsync(); } else { await previewSound.playAsync(); }
                            } catch {}
                          } else {
                            setAutoPlayNext(true);
                            setPreviewId(rec.id);
                          }
                        }} 
                        className="rounded-full w-9 h-9 items-center justify-center bg-green-600 mr-2"
                      >
                        <Ionicons name={(previewId===rec.id && isPlaying) ? "pause" : "play"} size={16} color="white" />
                      </Pressable>
                      <Pressable 
                        onPress={() => (navigation as any).navigate("Main", { screen: "Export", params: { selectedIds: [rec.id] } })} 
                        className="rounded-full w-9 h-9 items-center justify-center bg-purple-600 mr-2"
                      >
                        <Ionicons name="share" size={16} color="white" />
                      </Pressable>
                     <Pressable onPress={() => {

                      setShowDetailsId(rec.id);
                      setName(rec.name || "");
                      const byCode = rec.categoryCode ? CATEGORY_OPTIONS.find(c => c.code === rec.categoryCode) : undefined;
                      const byName = !byCode ? CATEGORY_OPTIONS.find(c => c.name === rec.category) : undefined;
                      setCategoryId((byCode || byName)?.id || "");
                      setSubcategory(rec.subcategory || "");
                      setTagsText((rec.tags || []).join(", "));
                      setNotes(rec.notes || "");
                    }} className="rounded-full px-3 h-9 items-center justify-center bg-blue-500 mr-2">
                      <Text className="text-white text-xs">Details</Text>
                    </Pressable>
                    {rec.syncStatus==='failed' && (
                      <Pressable onPress={() => retry(rec.id)} className="rounded-full w-9 h-9 items-center justify-center bg-yellow-500 mr-2">
                        <Ionicons name="refresh" size={16} color="white" />
                      </Pressable>
                    )}
                    <Pressable onPress={async () => { try { await FileSystem.deleteAsync(rec.uri, { idempotent: true }); } catch {}; removeRecording(rec.id, stationId); }} className="rounded-full w-9 h-9 items-center justify-center bg-red-500">
                      <Ionicons name="trash" size={16} color="white" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
            {recordings.length === 0 && <Text className="text-gray-500">No files yet</Text>}
          </View>
        </View>
      </ScrollView>



      {/* Details Modal */}
      <Modal visible={!!showDetailsId} transparent animationType="slide" onRequestClose={() => setShowDetailsId(null)}>

        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-2xl p-6 max-h-5/6">
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-xl font-bold text-gray-800 mb-4">Edit File Details</Text>

              <Text className="text-gray-700 mb-2">Name</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Untitled" className="border border-gray-300 rounded-lg px-3 py-3 mb-4 bg-white" />

              <Text className="text-gray-700 mb-2">Category</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {CATEGORY_OPTIONS.map((c) => (
                  <Pressable key={c.id} onPress={() => setCategoryId(c.id)} className={`flex-row items-center px-3 py-2 rounded-full border-2 ${categoryId === c.id ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"}`}>
                    <Ionicons name={(c.icon as any) || "folder"} size={16} color={categoryId === c.id ? "#3B82F6" : "#6B7280"} />
                    <Text className={`ml-2 text-sm ${categoryId === c.id ? "text-blue-700" : "text-gray-700"}`}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-gray-600 mb-2">Subcategory (optional)</Text>
              <TextInput value={subcategory} onChangeText={setSubcategory} placeholder="e.g. Morning show intro" className="border border-gray-300 rounded-lg px-3 py-3 bg-white mb-4" />

              <Text className="text-gray-600 mb-2">Tags (comma separated)</Text>
              <TextInput value={tagsText} onChangeText={setTagsText} placeholder="e.g. intro, music, voice" className="border border-gray-300 rounded-lg px-3 py-3 bg-white mb-4" />

              <Text className="text-gray-600 mb-2">Notes</Text>
              <TextInput value={notes} onChangeText={setNotes} placeholder="Any additional notes..." className="border border-gray-300 rounded-lg px-3 py-3 bg-white mb-6" multiline numberOfLines={3} />

              <View className="flex-row gap-3 mb-3">
                <Pressable onPress={() => setShowDetailsId(null)} className="flex-1 bg-gray-200 rounded-lg p-4">
                  <Text className="text-center text-gray-700 font-medium">Cancel</Text>
                </Pressable>
                <Pressable onPress={() => {
                  if (!showDetailsId) return;
                  const sel = CATEGORY_OPTIONS.find(c => c.id === categoryId) || CATEGORY_OPTIONS.find(c => c.name === (recordings.find(r=>r.id===showDetailsId)?.category || "")) || CATEGORY_OPTIONS.find(c => c.id === "other")!;
                  const tags = tagsText.split(',').map(t=>t.trim()).filter(Boolean);
                  updateRecording(showDetailsId, { name: name.trim() || undefined, category: sel.name, categoryCode: sel.code, subcategory, tags, notes }, stationId);
                  setShowDetailsId(null);
                }} className="flex-1 bg-blue-500 rounded-lg p-4">
                  <Text className="text-center text-white font-medium">Save</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => {
                if (!showDetailsId) return;
                const rec = recordings.find(r=>r.id===showDetailsId);
                if (!rec) { setShowDetailsId(null); return; }
                const sel = CATEGORY_OPTIONS.find(c => c.id === categoryId) || CATEGORY_OPTIONS.find(c => c.name === rec.category) || CATEGORY_OPTIONS.find(c => c.id === "other")!;
                const tags = tagsText.split(',').map(t=>t.trim()).filter(Boolean);
                const patch = { name: name.trim() || undefined, category: sel.name, categoryCode: sel.code, subcategory, tags, notes } as any;
                updateRecording(showDetailsId, patch, stationId);
                const user = useUserStore.getState().user;
                const path = (rec.cloudPath && rec.filename) ? rec.cloudPath.replace(rec.filename, "") : require("../utils/pathing").buildCloudPath(stationId, new Date(rec.createdAt), sel.code);
                const filename = rec.filename || `${rec.id}.m4a`;
                const meta = require("../utils/metadata").buildRecordingMetadata({
                  stationId,
                  userId: user.id,
                  categoryCode: sel.code,
                  categoryName: sel.name,
                  subcategory,
                  tags,
                  notes,
                  durationMs: rec.durationMs || 0,
                  trimStartMs: rec.trimStartMs || 0,
                  trimEndMs: rec.trimEndMs || rec.durationMs || 0,
                  version: rec.version || 1,
                  path,
                  filename
                });
                enqueue({ id: rec.id, stationId, localUri: rec.uri, metadata: meta, status: "pending", progress: 0, createdAt: Date.now() });
                pump();
                setShowDetailsId(null);
              }} className="w-full bg-purple-600 rounded-lg p-4">
                <Text className="text-center text-white font-medium">Save & Re-upload Metadata</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
