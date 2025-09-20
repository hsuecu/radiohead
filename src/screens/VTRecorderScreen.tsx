import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Audio } from "expo-av";
import FourDeckPanel from "../components/FourDeckPanel";
import VUMeter from "../components/VUMeter";
import OnAirOverlay from "../components/OnAirOverlay";
import LiveWaveform from "../components/LiveWaveform";
import { useVTStore } from "../state/vtStore";
import { useVoiceFxStore } from "../state/voiceFxStore";
import { listVoices, convertVoice } from "../api/elevenlabs";
import { useUserStore } from "../state/userStore";
import { useMixStore } from "../state/mixStore";
import { useAudioStore } from "../state/audioStore";
import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import { createDefaultTracks, createDefaultViewport, createDefaultProjectSettings } from "../utils/multitrackHelpers";
import type { AudioSegment } from "../state/audioStore";

// Workflow integration
import { BreadcrumbNavigation } from "../components/WorkflowStepper";
import { useWorkflowStore, getWorkflowDefinition } from "../state/workflowStore";
import { useWorkflowRouter } from "../utils/workflowRouter";

function OpenMixButton() {
  const nav = useNavigation<any>();
  const vtCount = useMixStore((s)=> s.vtTriggers.length);
  if (vtCount === 0) return <View className="flex-1 rounded-lg p-3 bg-gray-200 items-center justify-center"><Text className="text-gray-600">No Carts</Text></View>;
  return (
    <Pressable onPress={() => nav.navigate("VTMix")} className="flex-1 rounded-lg p-3 bg-indigo-600"><Text className="text-white text-center font-medium">Open Mix</Text></Pressable>
  );
}

export default function VTRecorderScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const slotId = route.params?.slotId || "slot-1";
  const fromWorkflow = route.params?.fromWorkflow || false;
  const prevSlotRef = useRef<string | null>(null);
  
  // Workflow integration
  const currentWorkflow = useWorkflowStore((s) => s.currentWorkflow);
  const breadcrumbs = useWorkflowStore((s) => s.breadcrumbs);
  const workflowRouter = useWorkflowRouter();
  
  // VT Store
  const startVT = useVTStore((s)=> s.start);
  const setOutput = useVTStore((s)=> s.setOutput);
  const session = useVTStore((s)=> s.session);
  const user = useUserStore((s)=> s.user);
  const addRecording = useAudioStore((s)=> s.addRecording);
  const setCurrentEditId = useAudioStore((s)=> s.setCurrentEditId);

  // Voice FX state
  const fxEnabled = useVoiceFxStore((s)=> s.enabled);
  const setFxEnabled = useVoiceFxStore((s)=> s.setEnabled);
  const voiceId = useVoiceFxStore((s)=> s.voiceId);
  const setVoice = useVoiceFxStore((s)=> s.setVoice);
  const modelId = useVoiceFxStore((s)=> s.modelId);
  const outputFormat = useVoiceFxStore((s)=> s.outputFormat);
  const removeBg = useVoiceFxStore((s)=> s.removeBackgroundNoise);

  const [voices, setVoices] = useState<{ voice_id: string; name: string; preview_url?: string | null }[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  useEffect(() => {
    if (fxEnabled && voices.length === 0 && !loadingVoices) {
      (async () => { setLoadingVoices(true); try { const v = await listVoices(); setVoices(v.slice(0, 8)); if (!voiceId && v[0]) setVoice(v[0].voice_id); } catch {} finally { setLoadingVoices(false); } })();
    }
  }, [fxEnabled]);

  // mic record state
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [meterDb, setMeterDb] = useState<number | null>(null);
  const [liveWaveformValues, setLiveWaveformValues] = useState<number[]>([]);

  useEffect(() => {
    if (prevSlotRef.current === slotId) return;
    if (!session || session.slotId !== slotId) startVT(slotId, "Show", 10000);
    prevSlotRef.current = slotId;
  }, [slotId]);

  useEffect(() => {
    let t: any;
    if (isRecording && recording) {
      t = setInterval(async () => {
        try { 
          const st: any = await recording.getStatusAsync(); 
          if (typeof st?.metering === "number") {
            setMeterDb(st.metering);
            // Convert dB to normalized value for waveform (0-1)
            const normalizedValue = Math.max(0, Math.min(1, (st.metering + 60) / 60));
            setLiveWaveformValues(prev => [...prev.slice(-149), normalizedValue]);
          }
        } catch {}
      }, 120);
    } else {
      // Clear waveform when not recording
      setLiveWaveformValues([]);
    }
    return () => clearInterval(t);
  }, [isRecording, recording]);

  const startRec = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== "granted") return;
      const base = Audio.RecordingOptionsPresets.HIGH_QUALITY as any;
      const options = { ...base, ios: { ...(base?.ios || {}), isMeteringEnabled: true } } as any;
      const { recording } = await Audio.Recording.createAsync(options);
      setRecording(recording);
      recordStartRef.current = Date.now();
      setIsRecording(true);
    } catch {}
  };
  const stopRec = async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    recordStartRef.current = null;
    const uri = recording.getURI();
    setRecording(null);
    if (uri) {
      try {
        setConvertError(null);
        if (fxEnabled && voiceId && process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY) {
          setConverting(true);
          const { uri: out } = await convertVoice({ inputUri: uri, voiceId, modelId, outputFormat, removeBackgroundNoise: removeBg });
          setOutput(out);
        } else {
          setOutput(uri);
        }
      } catch (e: any) {
        setOutput(uri);
        setConvertError(typeof e?.message === "string" ? e.message : "Conversion failed");
      } finally {
        setConverting(false);
      }
    }
  };

  const saveVT = async () => {
    const uri = session?.outputUri;
    if (!uri) return;
    const sid = user.currentStationId ?? "station-a";
    const id = Crypto.randomUUID();
    const dir = `${FileSystem.documentDirectory}stations/${sid}/recordings`;
    try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
    const extMatch = (uri.split(".").pop() || "m4a").toLowerCase();
    const ext = extMatch.length <= 4 ? extMatch : "m4a";
    const dest = `${dir}/${id}.${ext}`;
    try { await FileSystem.copyAsync({ from: uri, to: dest }); } catch {}
    // Create unified multitrack data structure for VT recordings
    const tracks = createDefaultTracks();
    const viewport = createDefaultViewport(60000); // Default 1 minute
    const projectSettings = createDefaultProjectSettings();
    
    // Create master segment for the VT recording
    const masterSegment: AudioSegment = {
      id: `master-${id}`,
      uri: dest,
      name: `VT ${slotId} Master`,
      startMs: 0,
      endMs: 60000, // Will be updated when we get actual duration
      trackId: "master-track",
      gain: 1,
      pan: 0,
      muted: false,
      fadeInMs: 0,
      fadeOutMs: 0,
      fadeInCurve: "linear" as const,
      fadeOutCurve: "linear" as const,
      color: "#3B82F6",
      sourceStartMs: 0,
      sourceDurationMs: 60000,
    };
    
    addRecording({ 
      id, 
      uri: dest, 
      createdAt: Date.now(), 
      name: `VT ${slotId}`, 
      category: "VT", 
      version: 1, 
      stationId: sid,
      tracks,
      segments: [masterSegment],
      viewport,
      projectSettings,
      workflowStatus: "ready_edit" as const
    } as any, sid);
    setCurrentEditId(id);
    nav.navigate("Main", { screen: "Edit" });
  };

  const level = useMemo(() => {
    if (typeof meterDb !== "number") return 0; const k = Math.pow(10, meterDb / 20); return Math.max(0, Math.min(1, k));
  }, [meterDb]);

  // Four-deck timing
  const recordStartRef = useRef<number | null>(null);
  const getAtMs = () => {
    const t0 = recordStartRef.current || Date.now();
    return Date.now() - t0;
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <OnAirOverlay visible={isRecording} />
      
      {/* Breadcrumb Navigation for Workflow */}
      {currentWorkflow === "voice-track" && breadcrumbs.length > 0 && (
        <BreadcrumbNavigation
          breadcrumbs={breadcrumbs}
          onBreadcrumbPress={(breadcrumb, index) => workflowRouter.goBack()}
          workflowColor={getWorkflowDefinition("voice-track")?.color}
        />
      )}
      
      <View className="bg-white px-6 py-4 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-800">Voice Track Studio</Text>
        <Text className="text-gray-600">Professional VT recording • Slot {slotId} • {session?.showName || 'Show'}</Text>
        
        {/* Workflow Integration Notice */}
        <View className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
          <View className="flex-row items-center">
            <Ionicons name="information-circle" size={16} color="#3B82F6" />
            <Text className="text-blue-800 text-sm ml-2 flex-1">
              VT recordings use the same professional multitrack format as studio recordings
            </Text>
          </View>
        </View>
      </View>
      <ScrollView className="flex-1 p-6">
        <FourDeckPanel mode="vt" isRecording={isRecording} getAtMs={getAtMs} />

        {/* Voice FX */}
        <View className="bg-white rounded-lg p-4 border border-gray-200 mt-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-gray-800">Voice FX</Text>
            <Pressable onPress={() => setFxEnabled(!fxEnabled)} className={`px-3 py-1 rounded-full ${fxEnabled ? 'bg-green-600' : 'bg-gray-300'}`}><Text className="text-white text-sm">{fxEnabled ? "On" : "Off"}</Text></Pressable>
          </View>
          {fxEnabled && (
            <View className="mt-3">
              {loadingVoices ? (
                <Text className="text-gray-500">Loading voices...</Text>
              ) : voices.length === 0 ? (
                <Text className="text-gray-500">No voices available</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2">
                  {voices.map((v) => (
                    <Pressable key={v.voice_id} onPress={() => setVoice(v.voice_id)} className={`mx-2 px-3 py-2 rounded-full border-2 ${voiceId === v.voice_id ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}>
                      <Text className={`text-sm ${voiceId === v.voice_id ? 'text-blue-700' : 'text-gray-700'}`}>{v.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              <Text className="text-gray-500 text-xs mt-2">Applied automatically after you stop recording</Text>
            </View>
          )}
          {convertError && (
            <View className="mt-2 p-2 rounded bg-red-50 border border-red-200"><Text className="text-red-700 text-xs">{convertError}</Text></View>
          )}
        </View>

        <Text className="text-gray-700 mt-6 mb-2">Mic Level</Text>
        <VUMeter level={level} peak={level} unsupported={!isRecording} clip={level>0.95} showScale currentDb={meterDb ?? null} dbFloor={-60} />
        
        {/* Live Waveform Display */}
        {(isRecording || liveWaveformValues.length > 0) && (
          <View className="mt-4">
            <Text className="text-gray-700 mb-2">Live Audio</Text>
            <View className="bg-gray-50 rounded-lg p-3">
              <LiveWaveform 
                values={liveWaveformValues} 
                height={48} 
                barWidth={2} 
                gap={1} 
                color="#EF4444"
                showPeaks={true}
                minBarHeight={2}
              />
            </View>
            <Text className="text-xs text-gray-500 text-center mt-2">
              {isRecording ? "Recording..." : "Recording complete"}
            </Text>
          </View>
        )}
        
        <View className="items-center mt-6">
          {isRecording ? (
            <Pressable onPress={stopRec} className="w-24 h-24 rounded-full bg-red-500 items-center justify-center"><Ionicons name="stop" size={40} color="white" /></Pressable>
          ) : (
            <Pressable onPress={startRec} className="w-24 h-24 rounded-full bg-blue-500 items-center justify-center"><Ionicons name="mic" size={40} color="white" /></Pressable>
          )}
          <Text className="text-gray-600 mt-2">{isRecording ? "Tap to stop" : "Tap to record"}</Text>
        </View>
        <View className="mt-8">
          <View className="flex-row gap-3">
            <Pressable 
              disabled={!session?.outputUri} 
              onPress={saveVT} 
              className={`flex-1 rounded-lg p-3 ${session?.outputUri ? 'bg-blue-600' : 'bg-blue-300'}`}
            >
              <Text className="text-white text-center font-medium">
                Save & Edit (Professional)
              </Text>
            </Pressable>
            {/* Open Mix when we have captured cart triggers */}
            <OpenMixButton />
          </View>
          
          {/* Workflow Information */}
          {session?.outputUri && (
            <View className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
              <Text className="text-green-800 text-sm text-center">
                ✓ VT recorded successfully - ready for professional multitrack editing
              </Text>
            </View>
          )}
        </View>
         {converting && (
          <View pointerEvents="auto" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)" }} />
            <View className="bg-white rounded-2xl p-6 w-11/12 max-w-md self-center mt-24">
              <Text className="text-lg font-semibold text-gray-800 mb-2">Converting voice...</Text>
              <Text className="text-gray-600">This can take a few seconds.</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
