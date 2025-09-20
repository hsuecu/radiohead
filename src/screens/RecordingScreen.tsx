import React, { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput, Keyboard } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import Slider from "@react-native-community/slider";
import VUMeter from "../components/VUMeter";

import { useAudioStore } from "../state/audioStore";
import { useUserStore } from "../state/userStore";
import { useStationStore } from "../state/stationStore";
import { CATEGORY_OPTIONS } from "../types/station";
import { useUploadQueue } from "../state/uploadQueue";
import { getRoleForStation } from "../state/userStore";
import { canRecord } from "../utils/rbac";
import EnhancedLiveWaveform from "../components/EnhancedLiveWaveform";

import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation, interpolate } from "react-native-reanimated";
import LiveWaveform from "../components/LiveWaveform";
import WorkflowStepper, { createWorkflowSteps, getAvailableSteps, BreadcrumbNavigation } from "../components/WorkflowStepper";
import { useUiStore } from "../state/uiStore";
import { provideTactileFeedback } from "../utils/mobileUX";
import { trimToFile, isTrimServiceConfigured } from "../api/render";
import waveformManager from "../utils/waveformManager";
import { saveAsIsRecording } from "../utils/savePipeline";

// New workflow imports
import WorkflowWelcome from "../components/WorkflowWelcome";
import OtherWorkflow from "../components/OtherWorkflow";
import { useWorkflowStore, WorkflowType, getWorkflowDefinition } from "../state/workflowStore";
import { useWorkflowRouter } from "../utils/workflowRouter";
import { useScriptStore } from "../state/scriptStore";
import RecordingTeleprompter from "../components/RecordingTeleprompter";

// Import standardized components


export default function RecordingScreen() {
  const insets = useSafeAreaInsets();
  // Workflow state and router
  const currentWorkflow = useWorkflowStore((s) => s.currentWorkflow);
  const breadcrumbs = useWorkflowStore((s) => s.breadcrumbs);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const workflowRouter = useWorkflowRouter();

  // Preserve workflow state on tab focus to avoid unintended resets
  useFocusEffect(
    React.useCallback(() => {
      // Intentionally do not reset here; users may be mid-flow
      return undefined;
    }, [])
  );
  
  // Audio recording state
  const [recording, setRecording] = useState<Audio.Recording | undefined>();
  const [monitorRec, setMonitorRec] = useState<Audio.Recording | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const stationId = useUserStore((s) => s.user.currentStationId);
  const setCurrentEditId = useAudioStore((s) => s.setCurrentEditId);
  const navigation = useNavigation();

  const [isRecording, setIsRecording] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [liveValues, setLiveValues] = useState<number[]>([]);
  const [sessionWaveform, setSessionWaveform] = useState<number[] | null>(null);

  
  // Enhanced workflow with crop/save choice
  const [showWorkflowChoiceModal, setShowWorkflowChoiceModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  
  // UI Mode state for integrated interface
  const [uiMode, setUiMode] = useState<"record" | "initial-preview" | "preview" | "crop" | "workflow-choice">("record");
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewPositionMs, setPreviewPositionMs] = useState(0);
  const [previewDurationMs, setPreviewDurationMs] = useState(0);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // Recent recordings preview state
  const [workflowChoice, setWorkflowChoice] = useState<"crop" | "save" | null>(null);
  
  // Crop functionality
  const [cropStartMs, setCropStartMs] = useState(0);
  const [cropEndMs, setCropEndMs] = useState(0);
  
  // Refs for dynamic crop values in audio callbacks
  const cropStartRef = useRef(0);
  const cropEndRef = useRef(0);
  
  // Update refs when crop values change
  useEffect(() => {
    cropStartRef.current = cropStartMs;
    cropEndRef.current = cropEndMs;
  }, [cropStartMs, cropEndMs]);
  
  // Crop modal state
  const [showCropModal, setShowCropModal] = useState(false);
  const [showCroppedPreviewModal, setShowCroppedPreviewModal] = useState(false);
  const [croppedPreviewUri, setCroppedPreviewUri] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [croppingProgress, setCroppingProgress] = useState(0);
  const [croppingError, setCroppingError] = useState<string | null>(null);
  
  // Workflow state
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState<string>("record");
  const [completedWorkflowSteps, setCompletedWorkflowSteps] = useState<string[]>([]);
  
  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const trimConfigured = isTrimServiceConfigured();
  const [tempName, setTempName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [customCategory, setCustomCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [notes, setNotes] = useState("");
  
  const uploadEnqueue = useUploadQueue((s) => s.enqueue);
  const uploadPump = useUploadQueue((s) => s.pump);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const setOverlayHidden = useUiStore((s) => s.setOverlayHidden);
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const [meterDb, setMeterDb] = useState<number | null>(null);
  const [peakDb, setPeakDb] = useState<number | null>(null);

  const recordStartRef = useRef<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Script recording state
  const [showScriptSelector, setShowScriptSelector] = useState(false);
  const [scriptRecordingMode, setScriptRecordingMode] = useState(false);
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [teleAnchor, setTeleAnchor] = useState<"top"|"bottom">("top");
  const [teleHeightRatio, setTeleHeightRatio] = useState(0.5);
  const [teleMinimized, setTeleMinimized] = useState(false);
  const [controlsH, setControlsH] = useState(0);
  
  // Script store
  const { 
    listScripts, 
    setCurrentScript, 
    currentScript, 
    getCurrentScriptName,
    items: scriptItems 
  } = useScriptStore();

  // Default to high-quality recording (48kHz mono)
  const recordingQuality = "high" as const;

  const micGain = useAudioStore((s) => s.micGain);
  const setMicGain = useAudioStore((s) => s.setMicGain);
  const preferredInput = useAudioStore((s) => s.preferredInput);
  const setPreferredInput = useAudioStore((s) => s.setPreferredInput);

  const sid = stationId ?? "station-a";
  const userRole = getRoleForStation(sid);
  const allowRecord = canRecord(userRole);

  const stations = useStationStore((s) => s.stations);
  const stationName = useMemo(() => stations.find((st) => st.id === sid)?.name || sid, [stations, sid]);

  // Recording quality presets
  const qualityPresets = {
    standard: { sampleRate: 44100, bitDepth: 16, bitRate: 128000 },
    high: { sampleRate: 48000, bitDepth: 24, bitRate: 256000 },
    broadcast: { sampleRate: 48000, bitDepth: 32, bitRate: 320000 }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRecording || isMonitoring) {
      interval = setInterval(async () => {
        try {
          const src = (isRecording ? recording : monitorRec);
          if (!src) return;
          const status: any = await src.getStatusAsync();
          if (typeof status?.metering === "number") {
            const currentDb = status.metering as number;
            setMeterDb(currentDb);
            setPeakDb((prev) => {
              if (prev == null) return currentDb;
              return Math.max(currentDb, prev - 2); // Faster peak decay
            });
            
            if (isRecording) {
              // Improved linear conversion with gain compensation
              const rawLinear = dbToLinear(currentDb);
              const gainAdjusted = rawLinear * micGain;
              const normalizedValue = Math.max(0, Math.min(1, gainAdjusted));
              
              // Add some dynamic range compression for better visualization
              const compressed = normalizedValue > 0.1 ? 
                0.1 + (normalizedValue - 0.1) * 0.8 : 
                normalizedValue;
              
              setLiveValues((prev) => {
                const cap = 200; // Reduced for better performance
                const next = prev.length >= cap ? prev.slice(prev.length - (cap - 1)) : prev.slice();
                next.push(compressed);
                return next;
              });
            }
          }
          if (isRecording && typeof status?.durationMillis === "number") {
            const secs = Math.floor((status.durationMillis || 0) / 1000);
            setRecordingTime(secs);
          }
        } catch (error) {
          // Silently handle metering errors
        }
      }, 80); // Faster update rate for smoother waveform
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isRecording, isMonitoring, recording, monitorRec, micGain]);

   // Optimized preview sound management with timeout and better performance
    useEffect(() => {
     let active: Audio.Sound | null = null;
     let cancelled = false;
     let loadTimeout: NodeJS.Timeout | null = null;
     
     async function loadPreview() {
       if (!((uiMode === "initial-preview" || uiMode === "preview" || uiMode === "workflow-choice" || showWorkflowChoiceModal) && pendingUri)) return;

      
      // Set loading timeout to prevent hanging
      loadTimeout = setTimeout(() => {
        if (!cancelled) {
          setIsLoadingPreview(false);
          showToast("Audio loading timed out. Please try again.");
        }
      }, 8000);
      
      try {
        setIsLoadingPreview(true);
        
        // Quick file existence check
        const info = await FileSystem.getInfoAsync(pendingUri);
         if (!info.exists) {
          showToast("Preview file missing");
          setUiMode("record");
          return;
        }
        
        // Set audio mode for playback only
        try {
          await Audio.setAudioModeAsync({ 
            allowsRecordingIOS: false, 
            playsInSilentModeIOS: true, 
            staysActiveInBackground: false,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false
          } as any);
        } catch (audioModeError) {
          console.warn("Failed to set audio mode for preview:", audioModeError);
        }
        
        // Load audio with optimized settings
        const { sound, status } = await Audio.Sound.createAsync(
          { uri: pendingUri }, 
          { 
            progressUpdateIntervalMillis: 200, // Reduced frequency for better performance
            shouldPlay: false,
            volume: 1.0,
            rate: 1.0,
            shouldCorrectPitch: false // Disable pitch correction for better performance
          }
        );
        
        if (cancelled) { 
          try { sound.setOnPlaybackStatusUpdate(null as any); } catch {}
          await sound.unloadAsync(); 
          return; 
        }
        
        // Clear timeout on successful load
        if (loadTimeout) {
          clearTimeout(loadTimeout);
          loadTimeout = null;
        }
        
        active = sound;
        setPreviewSound(sound);
        const st: any = status;
        if (st?.isLoaded && typeof st?.durationMillis === "number") {
          setPreviewDurationMs(st.durationMillis);
          setCropStartMs(0);
          setCropEndMs(st.durationMillis);
        }
        
        // Simplified status update handler
        sound.setOnPlaybackStatusUpdate((s: any) => {
          if (cancelled || !s?.isLoaded) return;
          
          if (typeof s.positionMillis === "number") {
            const currentPos = s.positionMillis;
            setPreviewPositionMs(currentPos);
            
            // Only apply crop boundaries in full preview mode, not initial preview
            if (uiMode === "preview") {
              // Use current crop values from refs
              const currentCropStart = cropStartRef.current;
              const currentCropEnd = cropEndRef.current;
              
              // Stop playback when reaching crop end
              if (s.isPlaying && currentPos >= (currentCropEnd - 50)) {
                sound.pauseAsync().then(() => {
                  sound.setPositionAsync(currentCropStart).catch(() => {});
                  setIsPreviewPlaying(false);
                  setPreviewPositionMs(currentCropStart);
                }).catch(() => {});
              }
            }
          }
          
          if (typeof s.durationMillis === "number") setPreviewDurationMs(s.durationMillis);
          if (typeof s.isPlaying === "boolean") setIsPreviewPlaying(s.isPlaying);
          if (s.didJustFinish) { 
            setIsPreviewPlaying(false); 
            setPreviewPositionMs(cropStartRef.current); 
          }
        });
        
      } catch (error) {
        console.error("Preview load error:", error);
        showToast("Failed to load audio preview");
      } finally {
        setIsLoadingPreview(false);
        if (loadTimeout) {
          clearTimeout(loadTimeout);
          loadTimeout = null;
        }
      }
    }
    
    // Debounce loading to prevent rapid re-loads
    const debounceTimeout = setTimeout(loadPreview, 100);
    
    return () => {
      cancelled = true;
      clearTimeout(debounceTimeout);
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
      if (active) { 
        try { active.setOnPlaybackStatusUpdate(null as any); } catch {}
        active.unloadAsync().catch(() => {}); 
      }
      setPreviewSound(null);
      setIsPreviewPlaying(false);
      setPreviewPositionMs(0);
      setPreviewDurationMs(0);
    };
     }, [uiMode, showWorkflowChoiceModal, pendingUri, cropStartMs, cropEndMs]);



   // Removed problematic marker change effect that was causing playback issues
 
   const togglePreview = async () => {
     if (!previewSound || isLoadingPreview) {
       console.log("Cannot toggle preview:", { previewSound: !!previewSound, isLoadingPreview });
       return;
     }
     
     try {
       const st: any = await previewSound.getStatusAsync();
       console.log("Audio status:", st);
       
       if (!st?.isLoaded) {
         console.log("Audio not loaded");
         return;
       }
       
       if (st.isPlaying) { 
         console.log("Pausing preview");
         await previewSound.pauseAsync(); 
         setIsPreviewPlaying(false);
       } else { 
         // Ensure we start within crop boundaries
         const currentPos = st.positionMillis || 0;
         console.log(`Current position: ${currentPos}ms, crop range: ${cropStartMs}-${cropEndMs}ms`);
         
         if (currentPos < cropStartMs || currentPos > cropEndMs) {
           console.log(`Setting position to crop start: ${cropStartMs}ms`);
           await previewSound.setPositionAsync(cropStartMs);
           setPreviewPositionMs(cropStartMs);
         }
         
         // Verify we have a valid crop selection
         if (cropEndMs <= cropStartMs) {
           console.log("Invalid crop selection:", { cropStartMs, cropEndMs });
           showToast("Invalid crop selection");
           return;
         }
         
         console.log("Starting preview playback");
         await previewSound.playAsync(); 
         setIsPreviewPlaying(true);
         
         // Provide haptic feedback for play start
         provideTactileFeedback("light");
       }
     } catch (error) {
       console.error("Preview toggle error:", error);
       showToast("Preview failed");
     }
   };

  const seekPreview = async (ms: number) => {
    if (!previewSound || isLoadingPreview) return;
    
    // Clamp to crop boundaries without excessive buffer
    const clampedMs = Math.max(cropStartMs, Math.min(ms, cropEndMs));
    
    try { 
      const st: any = await previewSound.getStatusAsync();
      if (!st?.isLoaded) return;
      
      console.log(`Seeking to ${clampedMs}ms within crop range ${cropStartMs}-${cropEndMs}ms`);
      await previewSound.setPositionAsync(clampedMs);
      setPreviewPositionMs(clampedMs);
      
      // Provide haptic feedback for seeking
      provideTactileFeedback("light");
    } catch (error) {
      console.warn("Seek error:", error);
    }
  };

  const [isDiscarding, setIsDiscarding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
    provideTactileFeedback("light");
  };
  const applyCrop = async () => {
    if (!pendingUri || isCropping) return;
    
    setCroppingError(null);
    setCroppingProgress(0);
    setIsCropping(true);
    
    try {
      // Create temporary cropped file using local processing
      const croppedResult = await trimToFile(
        { baseUri: pendingUri, cropStartMs, cropEndMs, outExt: "m4a" }, 
        sid, 
        (p) => setCroppingProgress(p)
      );
      
      setCroppedPreviewUri(croppedResult.uri);
      setIsCropping(false);
      setShowCropModal(false);
      setShowCroppedPreviewModal(true);
      
    } catch (e) {
      setIsCropping(false);
      const msg = e instanceof Error ? e.message : "Crop failed. Please try again.";
      setCroppingError(msg);
      showToast(msg);
      
      // Reset audio mode on error
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false
        } as any);
      } catch {}
    }
  };

  const discardRecording = async () => {
    if (isDiscarding) return;
    setIsDiscarding(true);
    try {
      // Stop and cleanup preview sound
      if (previewSound) {
        try { 
          const st: any = await previewSound.getStatusAsync(); 
          if (st?.isLoaded && st.isPlaying) await previewSound.pauseAsync(); 
          try { previewSound.setOnPlaybackStatusUpdate(null as any); } catch {}
          await previewSound.unloadAsync(); 
        } catch (error) {
          console.warn("Error cleaning up preview sound:", error);
        }
      }
      

      
      // Delete temporary files
      if (pendingUri) { 
        try { 
          await FileSystem.deleteAsync(pendingUri, { idempotent: true }); 
        } catch (error) {
          console.warn("Error deleting pending file:", error);
        } 
      }
      if (croppedPreviewUri) { 
        try { 
          await FileSystem.deleteAsync(croppedPreviewUri, { idempotent: true }); 
        } catch (error) {
          console.warn("Error deleting cropped preview file:", error);
        } 
      }
      
      // Reset audio mode
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false
        } as any);
      } catch (error) {
        console.warn("Error resetting audio mode:", error);
      }
      
    } finally {
      // Reset all state
      setPendingUri(null);
      setCroppedPreviewUri(null);
      setShowDiscardConfirm(false);
      setShowPreviewModal(false);
      setShowCropModal(false);
      setShowCroppedPreviewModal(false);
      setShowSaveModal(false);
      setShowWorkflowChoiceModal(false);
      setWorkflowChoice(null);
      setCroppingError(null);
      setCroppingProgress(0);
      setIsCropping(false);
      
      // Reset workflow state
      setCurrentWorkflowStep("record");
      setCompletedWorkflowSteps([]);
      
      // Reset UI mode
      setUiMode("record");
      
      // Reset live waveform
      setLiveValues([]);
      setSessionWaveform(null);
      
      provideTactileFeedback("light");
      setIsDiscarding(false);
    }
  };

  function dbToLinear(db: number) { 
    // Improved dB to linear conversion with better range handling
    if (db <= -60) return 0; // Silence threshold
    if (db >= 0) return 1; // Clipping threshold
    return Math.pow(10, db / 20); 
  }

  async function applyAudioMode(next: "device" | "bluetooth" | "earpiece") {
    try {
      const audioModeConfig = {
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        staysActiveInBackground: true,
        // iOS specific settings
        ...(next === "earpiece" && {
          playThroughEarpieceAndroid: true,
        }),
        // Android specific settings
        ...(next === "bluetooth" && {
          // Bluetooth settings would go here if needed
        })
      };
      
      await Audio.setAudioModeAsync(audioModeConfig as any);
    } catch (error) {
      console.warn("Failed to apply audio mode:", error);
    }
  }

  const startLevelCheck = async () => {
    try {
      if (isRecording || isMonitoring) return;
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") { 
        setShowPermissionModal(true); 
        return; 
      }
      await applyAudioMode(preferredInput);
      
      const preset = qualityPresets[recordingQuality];
      const base = Audio.RecordingOptionsPresets.HIGH_QUALITY as any;
      const options = { 
        ...base, 
        ios: { 
          ...(base?.ios || {}), 
          isMeteringEnabled: true,
          audioQuality: Audio.IOSAudioQuality.MAX,
          sampleRate: preset.sampleRate,
          numberOfChannels: 1, // Always mono for simplicity
          bitRate: preset.bitRate,
          linearPCMBitDepth: preset.bitDepth,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: preset.bitDepth === 32
        },
        android: {
          ...(base?.android || {}),
          extension: ".m4a",
          sampleRate: preset.sampleRate,
          numberOfChannels: 1, // Always mono for simplicity
          bitRate: preset.bitRate
        }
      } as any;
      
      const { recording: rec } = await Audio.Recording.createAsync(options);
      setMonitorRec(rec);
      setIsMonitoring(true);
      setUiMessage(null);
    } catch { 
      setUiMessage("Unable to start level check. Please try again."); 
    }
  };

  const stopLevelCheck = async () => {
    try {
      const rec = monitorRec;
      setIsMonitoring(false);
      setMonitorRec(null);
      if (!rec) return;
      try { await rec.stopAndUnloadAsync(); } catch {}
      try { 
        const uri = rec.getURI(); 
        if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }); 
      } catch {}
    } catch {}
  };

  const onSelectInput = async (next: "device" | "bluetooth" | "earpiece") => {
    try {
      // Update the preferred input in store
      setPreferredInput(next);
      
      // Apply the new audio mode
      await applyAudioMode(next);
      
      // Restart monitoring if it was active to pick up new input
      if (isMonitoring) {
        try { 
          await stopLevelCheck(); 
          // Small delay to ensure cleanup
          setTimeout(async () => {
            try { await startLevelCheck(); } catch {}
          }, 100);
        } catch {}
      }
      
      // Provide haptic feedback
      provideTactileFeedback("light");
      
    } catch (error) {
      console.warn("Failed to select input:", error);
      showToast("Failed to switch input source");
    }
  };

  useEffect(() => { 
    // Apply initial audio mode when component mounts
    applyAudioMode(preferredInput); 
  }, [preferredInput]);

  // Hide global nav controls while modals are visible
  useEffect(() => {
    const anyModal = showWorkflowChoiceModal || showPreviewModal || showCropModal || showCroppedPreviewModal || showSaveModal || showPermissionModal || showDiscardConfirm;
    setOverlayHidden(!!anyModal);
    return () => setOverlayHidden(false);
  }, [showWorkflowChoiceModal, showPreviewModal, showCropModal, showCroppedPreviewModal, showSaveModal, showPermissionModal, showDiscardConfirm]);

  async function startRecording() {
    if (isTransitioning) return;
    setIsTransitioning(true);
    try {
      setUiMessage(null);
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") { 
        setShowPermissionModal(true); 
        return; 
      }
      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: true, 
        playsInSilentModeIOS: true,
        staysActiveInBackground: true
      });
      const base = Audio.RecordingOptionsPresets.HIGH_QUALITY as any;
      const options = { 
        ...base, 
        ios: { 
          ...(base?.ios || {}), 
          isMeteringEnabled: true,
          audioQuality: Audio.IOSAudioQuality.MAX,
          sampleRate: 48000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 24,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false
        },
        android: {
          ...(base?.android || {}),
          extension: ".m4a",
          sampleRate: 48000,
          numberOfChannels: 1,
          bitRate: 256000
        }
      } as any;
      const { recording } = await Audio.Recording.createAsync(options);
      setRecording(recording);
      recordStartRef.current = Date.now();
      setLiveValues([]);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Update workflow state
      setCurrentWorkflowStep("record");
      if (!completedWorkflowSteps.includes("record")) {
        setCompletedWorkflowSteps(prev => [...prev, "record"]);
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (err) {
      setUiMessage("Unable to start recording. Please try again.");
    } finally {
      setIsTransitioning(false);
    }
  }

  async function startScriptRecording() {
    // Show teleprompter and start recording
    setShowTeleprompter(true);
    setScriptRecordingMode(true);
    await startRecording();
  }

  async function stopRecording() {
    if (!recording || isTransitioning) return;
    setIsTransitioning(true);
    try {
      setIsRecording(false);
      
      // Close teleprompter if it was open
      if (scriptRecordingMode) {
        setShowTeleprompter(false);
        setScriptRecordingMode(false);
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await recording.stopAndUnloadAsync();
      recordStartRef.current = null;
      // Capture waveform snapshot using centralized manager
      const waveform = waveformManager.generateFromLiveValues(liveValues, 160);
      setSessionWaveform(waveform);
      // Switch to playback-friendly mode for preview
      try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: false } as any); } catch {}
      const uri = recording.getURI();
      if (uri) {
        setPendingUri(uri);
        setWorkflowChoice(null);
        setUiMode("workflow-choice");
        
        // Update workflow state - move to choice step
        setCurrentWorkflowStep("choice");
        if (!completedWorkflowSteps.includes("choice")) {
          setCompletedWorkflowSteps(prev => [...prev, "choice"]);
        }
      }
      setRecording(undefined);
    } finally {
      setIsTransitioning(false);
    }
  }



  // Slice a waveform array to a time region and resample using centralized manager
  function sliceSessionWaveform(
    full: number[] | null | undefined,
    fullDurationMs: number,
    startMs: number,
    endMs: number,
    targetCount: number = 160
  ): number[] | null {
    return waveformManager.sliceWaveform(full, fullDurationMs, startMs, endMs, targetCount);
  }



  function formatTime(seconds: number) { 
    const mins = Math.floor(seconds / 60); 
    const secs = seconds % 60; 
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`; 
  }


  // Pulsing halo around record button when recording
  const halo = useSharedValue(0);
  useEffect(() => {
    if (isRecording) {
      halo.value = 0;
      halo.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
    } else {
      cancelAnimation(halo);
      halo.value = 0;
    }
  }, [isRecording]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(halo.value, [0, 1], [0.55, 0]),
    transform: [{ scale: interpolate(halo.value, [0, 1], [1.0, 1.35]) }],
  }));

  // Workflow stepper configuration
  const availableSteps = getAvailableSteps(completedWorkflowSteps, workflowChoice || undefined);
  const workflowSteps = createWorkflowSteps(
    currentWorkflowStep,
    completedWorkflowSteps,
    availableSteps,
    workflowChoice || undefined
  );

  // Workflow handlers
  const handleWorkflowSelect = (workflowType: WorkflowType) => {
    workflowRouter.navigateToWorkflow(workflowType);
  };

  const handleBreadcrumbPress = (breadcrumb: any, index: number) => {
    // Navigate back in workflow
    workflowRouter.goBack();
  };

  const handleStepPress = (stepId: string) => {
    // Handle workflow step navigation
    if (stepId === "record" && !isRecording) {
      // Allow returning to record step
      setCurrentWorkflowStep("record");
    }
    // Add more step navigation logic as needed
  };

  // Determine what to render based on workflow state
  const renderContent = () => {
    if (!currentWorkflow) {
      // Show workflow selection screen
      return <WorkflowWelcome onWorkflowSelect={handleWorkflowSelect} />;
    }

    if (currentWorkflow === "record") {
      // Show recording interface with breadcrumbs
      const workflowDef = getWorkflowDefinition(currentWorkflow);
      return (
        <>
          {/* Breadcrumb Navigation */}
          {breadcrumbs.length > 0 && (
            <BreadcrumbNavigation
              breadcrumbs={breadcrumbs}
              onBreadcrumbPress={handleBreadcrumbPress}
              workflowColor={workflowDef?.color}
            />
          )}
          
          {/* Recording Interface */}
          {renderRecordingInterface()}
        </>
      );
    }

    if (currentWorkflow === "other") {
      // Show other workflow options
      return (
        <OtherWorkflow 
          onClose={() => workflowRouter.goBack()}
          onOptionSelect={(optionId) => {
            // Handle option selection
            console.log("Selected option:", optionId);
          }}
        />
      );
    }

    // For other workflows or no workflow, show workflow selection
    return <WorkflowWelcome onWorkflowSelect={handleWorkflowSelect} />;
  };

  const renderRecordingInterface = () => (
    <>
      {/* Workflow Stepper */}
      <WorkflowStepper 
        steps={workflowSteps}
        onStepPress={handleStepPress}
        compact={true}
      />
      
      {isRecording && (
        <View className="px-6 pt-2 pb-2 bg-red-50 border-b border-red-200">
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-red-600 mr-2" />
            <Text className="text-red-700 text-sm">Recording in progress</Text>
          </View>
        </View>
      )}
      <ScrollView ref={scrollRef} className="flex-1">
        <View className="p-3 pb-32">

            {uiMessage && (
              <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <Text className="text-yellow-800 text-sm">{uiMessage}</Text>
              </View>
            )}

            {toast && (
              <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <Text className="text-green-800 text-sm">{toast}</Text>
              </View>
            )}



           {/* Input Levels & Source */}
           <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
             {/* Input Source Selection */}
              <View className="mb-4">
                 <View className="flex-row items-center justify-between mb-2">
                   <Text className="text-base font-semibold text-gray-800">
                     {uiMode === "initial-preview" ? "Step 1: Listen to Your Recording" : 
                      uiMode === "workflow-choice" ? "Your Recording" : "Input"}
                   </Text>
                   {(uiMode === "initial-preview" || uiMode === "preview" || uiMode === "workflow-choice") && (
                    <Pressable
                      disabled={isLoadingPreview || !previewSound}
                      onPress={togglePreview}
                      className={`w-10 h-10 rounded-full items-center justify-center ${isLoadingPreview ? 'bg-blue-300' : 'bg-blue-500'}`}
                      accessibilityRole="button"
                      accessibilityLabel={isPreviewPlaying ? "Pause preview" : "Play preview"}
                    >
                      <Ionicons name={isPreviewPlaying ? "pause" : "play"} size={18} color="white" />
                    </Pressable>
                  )}
                </View>
                {uiMode === "record" && (
                  <View className="flex-row flex-wrap gap-2 mb-4">
                   {([
                     { id: "device", label: "Device mic", icon: "mic" },
                     { id: "bluetooth", label: "Bluetooth", icon: "logo-bluetooth" },
                     { id: "earpiece", label: "Earpiece", icon: "headset" },
                   ] as const).map((opt) => (
                     <Pressable 
                       key={opt.id} 
                       onPress={() => onSelectInput(opt.id)} 
                       className={`px-3 py-2 rounded-full border-2 ${preferredInput === opt.id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"}`}
                       style={({ pressed }) => ({
                         opacity: pressed ? 0.7 : 1,
                         transform: [{ scale: pressed ? 0.95 : 1 }]
                       })}
                     >
                       <View className="flex-row items-center">
                         <Ionicons name={opt.icon as any} size={14} color={preferredInput === opt.id ? "#3B82F6" : "#6B7280"} />
                         <Text className={`ml-1.5 text-xs ${preferredInput === opt.id ? "text-blue-700" : "text-gray-700"}`}>
                           {opt.label}
                         </Text>
                       </View>
                     </Pressable>
                   ))}
                 </View>
                )}
             </View>

             {(() => {
               const hasMeter = typeof meterDb === "number";
               const level = hasMeter ? Math.max(0, Math.min(1, dbToLinear(meterDb as number) * micGain)) : 0;
               const peak = typeof peakDb === "number" ? Math.max(0, Math.min(1, dbToLinear(peakDb as number) * micGain)) : 0;
               const clip = hasMeter && ((meterDb as number) > -3 || level >= 0.98 || peak >= 0.98);
               return (
                 <>
                    {/* Integrated Waveform */}
                    <View className="mb-4">
                      {isRecording ? (
                        <LiveWaveform 
                          values={liveValues}
                          height={80}
                          barWidth={2}
                          gap={1}
                          color="#3B82F6"
                          showPeaks={true}
                          minBarHeight={2}
                        />
                       ) : ((uiMode === "initial-preview" || uiMode === "workflow-choice") && previewDurationMs > 0) ? (
                         <View>
                           <Text className="text-gray-600 text-sm mb-2">
                             {uiMode === "workflow-choice" ? "Your recorded audio" : "Listen to your recording before choosing next steps"}
                           </Text>
                          <EnhancedLiveWaveform
                            values={sessionWaveform || []}
                            durationMs={previewDurationMs || 1}
                            positionMs={previewPositionMs}
                            cropMode={false}
                            showTimeLabels={true}
                            height={80}
                            color="#3B82F6"
                            showPeaks={true}
                          />
                        </View>
                      ) : (uiMode === "preview" && previewDurationMs > 0) ? (
                        <EnhancedLiveWaveform
                          values={sessionWaveform || []}
                          durationMs={previewDurationMs || 1}
                          positionMs={previewPositionMs}
                          cropMode={true}
                          cropStartMs={cropStartMs}
                          cropEndMs={cropEndMs}
                          onCropStartChange={(ms: number) => setCropStartMs(Math.min(ms, Math.max(0, cropEndMs - 500)))}
                          onCropEndChange={(ms: number) => setCropEndMs(Math.max(ms, Math.min(previewDurationMs || 0, cropStartMs + 500)))}
                          showTimeLabels={true}
                          height={80}
                          color="#3B82F6"
                          showPeaks={true}
                        />
                      ) : null}

                       {/* Workflow Choice Controls */}
                       {uiMode === "workflow-choice" && (
                         <View className="mt-3">
                           {/* Preview Controls */}
                           <View className="flex-row items-center justify-center gap-4 mb-4">
                             <Pressable 
                               disabled={isLoadingPreview || !previewSound}
                               onPress={() => {
                                 provideTactileFeedback("light");
                                 seekPreview(0);
                               }} 
                               className={`rounded-full w-10 h-10 items-center justify-center ${isLoadingPreview ? 'bg-gray-100' : 'bg-gray-200'}`}
                             >
                               <Ionicons name="play-skip-back" size={18} color="#374151" />
                             </Pressable>
                             <Pressable 
                               disabled={isLoadingPreview || !previewSound}
                               onPress={togglePreview} 
                               className={`rounded-full w-14 h-14 items-center justify-center ${isLoadingPreview ? 'bg-blue-300' : 'bg-blue-500'} shadow`}
                             >
                               {isLoadingPreview ? (
                                 <Ionicons name="hourglass" size={24} color="white" />
                               ) : (
                                 <Ionicons name={isPreviewPlaying ? "pause" : "play"} size={24} color="white" />
                               )}
                             </Pressable>
                             <Pressable 
                               disabled={isLoadingPreview || !previewSound}
                               onPress={() => {
                                 provideTactileFeedback("light");
                                 seekPreview(previewDurationMs - 1000);
                               }} 
                               className={`rounded-full w-10 h-10 items-center justify-center ${isLoadingPreview ? 'bg-gray-100' : 'bg-gray-200'}`}
                             >
                               <Ionicons name="play-skip-forward" size={18} color="#374151" />
                             </Pressable>
                           </View>
                           
                           {/* Progress Bar */}
                           <View className="px-2 mb-6">
                             <View className="h-1 bg-gray-200 rounded-full">
                               <View 
                                 className="h-1 bg-blue-500 rounded-full"
                                 style={{ 
                                   width: `${Math.max(0, Math.min(100, (previewPositionMs / Math.max(1, previewDurationMs)) * 100))}%` 
                                 }}
                               />
                             </View>
                             <View className="flex-row justify-between mt-1">
                               <Text className="text-xs text-gray-500">
                                 {Math.floor(previewPositionMs / 1000)}s
                               </Text>
                               <Text className="text-xs text-gray-500">
                                 {Math.floor(previewDurationMs / 1000)}s
                               </Text>
                             </View>
                           </View>
                           
                           <Text className="text-center text-gray-700 font-medium mb-4">What would you like to do with this recording?</Text>
                           
                           <View className="space-y-3">
                             <Pressable 
                               disabled={isLoadingPreview}
                               onPress={async () => {
                                 if (!pendingUri) return;
                                 provideTactileFeedback("medium");
                                 
                                  // Auto-save and start workflow
                                  try {
                                    console.log("🎬 Starting editing workflow from fresh recording");
                                    const res = await saveAsIsRecording({
                                      stationId: sid,
                                      baseUri: pendingUri,
                                      tempName: `Recording ${new Date().toLocaleTimeString()}`,
                                      selectedCategoryId: "voice",
                                      subcategory: "",
                                      tagsText: "",
                                      notes: "",
                                      sessionWaveform: sessionWaveform || liveValues,
                                    });
                                    
                                    console.log("💾 Recording saved:", { id: res.id, dest: res.dest });
                                    
                                    // Clean up current state
                                    setPendingUri(null);
                                    setUiMode("record");
                                    setCurrentWorkflowStep("record");
                                    
                                    // Navigate to editor and start workflow
                                    setCurrentEditId(res.id);
                                    showToast("Starting workflow...");
                                    
                                    // Verify file exists before navigating
                                    let fileReady = false;
                                    for (let i = 0; i < 3; i++) {
                                      try { 
                                        const info = await FileSystem.getInfoAsync(res.dest); 
                                        if (info.exists) { 
                                          fileReady = true; 
                                          break; 
                                        } 
                                      } catch {}
                                      await new Promise(r => setTimeout(r, 150));
                                    }
                                    
                                    if (!fileReady) { 
                                      showToast("File not ready. Please try again."); 
                                      return; 
                                    }
                                    
                                    console.log("🚀 Navigating to AudioEditScreen with freshStart: true");
                                    setTimeout(() => {
                                      (navigation as any).navigate("Main", { 
                                        screen: "Edit", 
                                        params: { id: res.id, uri: res.dest, stationId: sid, freshStart: true } 
                                      });
                                    }, 100);
                                 } catch (e: any) {
                                   showToast(e?.message || "Failed to save recording");
                                 }
                               }} 
                               className={`rounded-lg p-4 ${isLoadingPreview ? "bg-blue-300" : "bg-blue-500"}`}
                             >
                               <View className="flex-row items-center justify-center">
                                 <Ionicons name="construct" size={20} color="white" />
                                 <Text className="text-center text-white font-semibold ml-2">Start Editing Workflow</Text>
                               </View>
                               <Text className="text-center text-blue-100 text-sm mt-1">
                                 Crop, add voice effects, background music, and more
                               </Text>
                             </Pressable>
                             
                             <Pressable 
                               disabled={isLoadingPreview}
                               onPress={() => { 
                                 provideTactileFeedback("medium");
                                 setShowSaveModal(true); 
                               }} 
                               className={`rounded-lg p-4 ${isLoadingPreview ? "bg-green-300" : "bg-green-500"}`}
                             >
                               <View className="flex-row items-center justify-center">
                                 <Ionicons name="save" size={20} color="white" />
                                 <Text className="text-center text-white font-semibold ml-2">Save for Later</Text>
                               </View>
                               <Text className="text-center text-green-100 text-sm mt-1">
                                 Save recording and edit later
                               </Text>
                             </Pressable>
                             
                             <Pressable 
                               disabled={isLoadingPreview}
                               onPress={() => {
                                 provideTactileFeedback("light");
                                 setUiMode("initial-preview");
                               }} 
                               className="bg-gray-200 rounded-lg p-3"
                             >
                               <Text className="text-center text-gray-700 font-medium">Preview First</Text>
                             </Pressable>
                             
                             <Pressable 
                               disabled={isLoadingPreview}
                               onPress={() => {
                                 provideTactileFeedback("light");
                                 setUiMode("record");
                                 setPendingUri(null);
                                 setCurrentWorkflowStep("record");
                               }} 
                               className="bg-gray-100 rounded-lg p-3"
                             >
                               <Text className="text-center text-gray-600 font-medium">Discard & Record Again</Text>
                             </Pressable>
                           </View>
                         </View>
                       )}

                       {/* Initial Preview Controls */}
                       {uiMode === "initial-preview" && (
                        <View className="mt-3">
                          <View className="flex-row items-center justify-center gap-4 mb-3">
                            <Pressable 
                              disabled={isLoadingPreview || !previewSound}
                              onPress={() => {
                                provideTactileFeedback("light");
                                seekPreview(0);
                              }} 
                              className={`rounded-full w-10 h-10 items-center justify-center ${isLoadingPreview ? 'bg-gray-100' : 'bg-gray-200'}`}
                            >
                              <Ionicons name="play-skip-back" size={18} color="#374151" />
                            </Pressable>
                            <Pressable 
                              disabled={isLoadingPreview || !previewSound}
                              onPress={togglePreview} 
                              className={`rounded-full w-14 h-14 items-center justify-center ${isLoadingPreview ? 'bg-blue-300' : 'bg-blue-500'} shadow`}
                            >
                              {isLoadingPreview ? (
                                <Ionicons name="hourglass" size={24} color="white" />
                              ) : (
                                <Ionicons name={isPreviewPlaying ? "pause" : "play"} size={24} color="white" />
                              )}
                            </Pressable>
                            <Pressable 
                              disabled={isLoadingPreview || !previewSound}
                              onPress={() => {
                                provideTactileFeedback("light");
                                seekPreview(previewDurationMs - 1000);
                              }} 
                              className={`rounded-full w-10 h-10 items-center justify-center ${isLoadingPreview ? 'bg-gray-100' : 'bg-gray-200'}`}
                            >
                              <Ionicons name="play-skip-forward" size={18} color="#374151" />
                            </Pressable>
                          </View>
                          
                          {/* Progress Bar */}
                          <View className="px-2 mb-4">
                            <View className="h-1 bg-gray-200 rounded-full">
                              <View 
                                className="h-1 bg-blue-500 rounded-full"
                                style={{ 
                                  width: `${Math.max(0, Math.min(100, (previewPositionMs / Math.max(1, previewDurationMs)) * 100))}%` 
                                }}
                              />
                            </View>
                            <View className="flex-row justify-between mt-1">
                              <Text className="text-xs text-gray-500">
                                {Math.floor(previewPositionMs / 1000)}s
                              </Text>
                              <Text className="text-xs text-gray-500">
                                {Math.floor(previewDurationMs / 1000)}s
                              </Text>
                            </View>
                          </View>
                          
                          {/* Decision Buttons */}
                          <View className="space-y-3">
                            <Text className="text-center text-gray-700 font-medium">What would you like to do next?</Text>
                            <View className="flex-row gap-3">
                              <Pressable 
                                disabled={isLoadingPreview}
                                onPress={() => {
                                  provideTactileFeedback("medium");
                                  setWorkflowChoice("crop");
                                  setUiMode("preview");
                                  setCurrentWorkflowStep("choice");
                                  if (!completedWorkflowSteps.includes("choice")) {
                                    setCompletedWorkflowSteps(prev => [...prev, "choice"]);
                                  }
                                }} 
                                className={`flex-1 rounded-lg p-3 ${isLoadingPreview ? "bg-blue-300" : "bg-blue-500"}`}
                              >
                                <View className="flex-row items-center justify-center">
                                  <Ionicons name="cut" size={16} color="white" />
                                  <Text className="text-center text-white font-medium ml-2">Crop & Edit</Text>
                                </View>
                              </Pressable>
                              <Pressable 
                                disabled={isLoadingPreview}
                                onPress={() => { 
                                  provideTactileFeedback("medium");
                                  setWorkflowChoice("save"); 
                                  setCurrentWorkflowStep("choice");
                                  if (!completedWorkflowSteps.includes("choice")) {
                                    setCompletedWorkflowSteps(prev => [...prev, "choice"]);
                                  }
                                  setShowSaveModal(true); 
                                }} 
                                className={`flex-1 rounded-lg p-3 ${isLoadingPreview ? "bg-green-300" : "bg-green-500"}`}
                              >
                                <View className="flex-row items-center justify-center">
                                  <Ionicons name="save" size={16} color="white" />
                                  <Text className="text-center text-white font-medium ml-2">Save As-Is</Text>
                                </View>
                              </Pressable>
                            </View>
                            <Pressable 
                              disabled={isLoadingPreview}
                              onPress={() => {
                                provideTactileFeedback("light");
                                setUiMode("record");
                                setPendingUri(null);
                                setCurrentWorkflowStep("record");
                              }} 
                              className="bg-gray-200 rounded-lg p-3"
                            >
                              <Text className="text-center text-gray-700 font-medium">New Recording</Text>
                            </Pressable>
                          </View>
                        </View>
                      )}

                      {/* Compact playback controls in preview */}
                      {uiMode === "preview" && (
                       <View className="mt-3">
                         <View className="flex-row items-center justify-center gap-4">
                           <Pressable 
                             disabled={isLoadingPreview || !previewSound}
                             onPress={() => seekPreview(cropStartMs)} 
                             className={`rounded-full w-10 h-10 items-center justify-center ${isLoadingPreview ? 'bg-gray-100' : 'bg-gray-200'}`}
                           >
                             <Ionicons name="play-skip-back" size={18} color="#374151" />
                           </Pressable>
                           <Pressable 
                             disabled={isLoadingPreview || !previewSound}
                             onPress={togglePreview} 
                             className={`rounded-full w-12 h-12 items-center justify-center ${isLoadingPreview ? 'bg-blue-300' : 'bg-blue-500'} shadow`}
                           >
                             <Ionicons name={isPreviewPlaying ? "pause" : "play"} size={22} color="white" />
                           </Pressable>
                           <Pressable 
                             disabled={isLoadingPreview || !previewSound}
                             onPress={() => seekPreview(cropEndMs - 100)} 
                             className={`rounded-full w-10 h-10 items-center justify-center ${isLoadingPreview ? 'bg-gray-100' : 'bg-gray-200'}`}
                           >
                             <Ionicons name="play-skip-forward" size={18} color="#374151" />
                           </Pressable>
                         </View>
                         {/* Progress */}
                         <View className="mt-2 px-4">
                           <View className="h-1 bg-gray-200 rounded-full">
                             <View 
                               className="h-1 bg-blue-500 rounded-full"
                               style={{ 
                                 width: `${Math.max(0, Math.min(100, ((previewPositionMs - cropStartMs) / Math.max(1, (cropEndMs - cropStartMs))) * 100))}%` 
                               }}
                             />
                           </View>
                         </View>
                         {/* Actions */}
                         <View className="flex-row gap-3 mt-4">
                           <Pressable 
                             disabled={isLoadingPreview}
                             onPress={() => {
                               setUiMode("record");
                               setPendingUri(null);
                             }} 
                             className="flex-1 bg-gray-200 rounded-lg p-3"
                           >
                             <Text className="text-center text-gray-700 font-medium">New Recording</Text>
                           </Pressable>
                           <Pressable 
                             disabled={isLoadingPreview}
                             onPress={() => { setWorkflowChoice("save"); setShowSaveModal(true); }} 
                             className={`flex-1 rounded-lg p-3 ${isLoadingPreview ? "bg-green-300" : "bg-green-500"}`}
                           >
                             <Text className="text-center text-white font-medium">Save</Text>
                           </Pressable>
                           <Pressable 
                             disabled={isCropping || (cropEndMs - cropStartMs) < 500 || !pendingUri}
                             onPress={async () => {
                               if (!pendingUri) return;
                               if ((cropEndMs - cropStartMs) < 500) { showToast("Selection too short"); return; }
                               setWorkflowChoice("crop");
                               setCroppingError(null);
                               setCroppingProgress(0);
                               setIsCropping(true);
                               try {
                                 const croppedResult = await trimToFile(
                                   { baseUri: pendingUri, cropStartMs, cropEndMs, outExt: "m4a" },
                                   sid,
                                   (p) => setCroppingProgress(p)
                                 );
                                 setCroppedPreviewUri(croppedResult.uri);
                                 setIsCropping(false);
                                 setShowSaveModal(true);
                               } catch (e) {
                                 setIsCropping(false);
                                 const msg = e instanceof Error ? e.message : "Crop failed. Please try again.";
                                 setCroppingError(msg);
                                 showToast(msg);
                               }
                             }} 
                             className={`flex-1 rounded-lg p-3 ${(isCropping || (cropEndMs - cropStartMs) < 500 || !pendingUri) ? "bg-blue-300" : "bg-blue-500"}`}
                           >
                             <Text className="text-center text-white font-medium">Save Cropped</Text>
                           </Pressable>
                         </View>
                         {isCropping && (
                           <View className="mt-2 p-2 rounded-lg border border-blue-200 bg-blue-50">
                             <Text className="text-blue-800 text-xs">Preparing trimmed audio… {Math.round(croppingProgress * 100)}%</Text>
                           </View>
                         )}
                       </View>
                     )}
                   </View>

                    {/* VU Meter & Level - Only show in record mode */}
                    {uiMode === "record" && (
                      <>
                        <VUMeter 
                          level={level} 
                          peak={peak} 
                          unsupported={!hasMeter && (isRecording || isMonitoring)} 
                          clip={clip} 
                          showScale 
                          currentDb={meterDb ?? null} 
                          dbFloor={-60} 
                        />
                        <View className="mt-4">
                          <View className="flex-row items-center justify-between mb-2">
                            <Text className="font-medium text-gray-700">Mic Level</Text>
                            <Text className="text-gray-500">{Math.round(micGain * 100)}%</Text>
                          </View>
                          <View className="flex-row items-center">
                            <Ionicons name="volume-low" size={18} color="#6B7280" />
                            <Slider 
                              style={{ flex: 1, marginHorizontal: 12 }} 
                              minimumValue={0.5} 
                              maximumValue={2.0} 
                              step={0.01} 
                              value={micGain} 
                              onValueChange={setMicGain} 
                              minimumTrackTintColor="#3B82F6" 
                              maximumTrackTintColor="#E5E7EB" 
                              thumbTintColor="#3B82F6" 
                            />
                            <Ionicons name="volume-high" size={18} color="#6B7280" />
                          </View>
                          {!isRecording && (
                            <Text className="text-gray-400 text-xs mt-3 text-center">
                              Aim for −18 to −12 dB. Avoid red.
                            </Text>
                          )}
                        </View>
                      </>
                    )}
                 </>
               );
             })()}
           </View>

            {/* Recent Recordings */}

        </View>
      </ScrollView>

      {/* Bottom Controls: Record/Stop with Script Options */}
      <View className="px-6 pt-2 pb-4 bg-white border-t border-gray-200" onLayout={(e) => setControlsH(e.nativeEvent.layout.height)}>
        {/* Script Recording Toggle */}
        {uiMode === "record" && !isRecording && allowRecord && (
          <View className="flex-row items-center justify-center mb-4">
            <Pressable
              onPress={() => setShowScriptSelector(true)}
              className="flex-row items-center px-4 py-2 rounded-full bg-purple-100 border border-purple-300"
            >
              <Ionicons name="document-text" size={16} color="#7C3AED" />
              <Text className="text-purple-700 font-medium ml-2">
                {currentScript ? `Record with: ${getCurrentScriptName()}` : "Record with Script"}
              </Text>
            </Pressable>
            
            {currentScript && (
              <View className="flex-row items-center ml-3 space-x-2">
                <Pressable
                  onPress={() => setShowTeleprompter(true)}
                  className="p-2 rounded-full bg-purple-600"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Ionicons name="eye" size={16} color="white" />
                </Pressable>
                <Pressable
                  onPress={() => setShowScriptSelector(true)}
                  className="p-2 rounded-full bg-purple-500"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Ionicons name="swap-horizontal" size={16} color="white" />
                </Pressable>
              </View>
            )}
          </View>
        )}

        <View className="items-center">
          <View style={{ width: 96, height: 96, justifyContent: "center", alignItems: "center", position: "relative" }}>
            {isRecording && (
              <Animated.View style={[{ 
                position: "absolute", 
                width: 124, 
                height: 124, 
                borderRadius: 124/2, 
                backgroundColor: "#DC2626" 
              }, haloStyle]} />
            )}
              <Pressable 
              onPress={allowRecord ? (isRecording ? stopRecording : (currentScript ? startScriptRecording : startRecording)) : undefined} 
              className={`w-24 h-24 rounded-full items-center justify-center ${
                allowRecord ? (isRecording ? "bg-red-500" : (currentScript ? "bg-purple-600" : "bg-blue-500")) : "bg-gray-300"
              } shadow-lg`} 
              accessibilityRole="button" 
              accessibilityLabel={isRecording ? "Stop recording" : (currentScript ? "Start script recording" : "Start recording")} 
              disabled={!allowRecord || isTransitioning}
            >
              <Ionicons name={isRecording ? "stop" : "mic"} size={40} color="white" />
            </Pressable>
          </View>
          <Text className="text-gray-600 mt-2">
            {allowRecord ? (
              isRecording ? "Tap to stop" : (
                currentScript ? "Tap to record with script" : "Tap to record"
              )
            ) : "View-only in this station"}
          </Text>
        </View>
      </View>









      {/* Save Recording Modal */}
      <Modal 
        visible={showSaveModal} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-2xl p-6 max-h-5/6">
            <ScrollView showsVerticalScrollIndicator={false}>

              <Text className="text-xl font-bold text-gray-800 mb-4">Save Recording</Text>

              <Text className="text-gray-700 mb-2">Name</Text>
              <TextInput 
                value={tempName} 
                onChangeText={setTempName} 
                placeholder="My Recording" 
                className="border border-gray-300 rounded-lg px-3 py-3 mb-4 bg-white" 
              />

              <Text className="text-gray-700 mb-2">Station</Text>
              <View className="px-3 py-3 rounded-lg bg-gray-100 border border-gray-200 mb-4">
                <Text className="text-gray-700">{stationName}</Text>
              </View>

              <Text className="text-gray-700 mb-2">Category</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {CATEGORY_OPTIONS.map((c) => (
                  <Pressable 
                    key={c.id} 
                    onPress={() => { 
                      setSelectedCategory(c.id); 
                      setCustomCategory(""); 
                    }} 
                    className={`flex-row items-center px-3 py-2 rounded-full border-2 ${
                      selectedCategory === c.id ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
                    }`}
                  >
                    <Ionicons name={c.icon as any} size={16} color={selectedCategory === c.id ? "#3B82F6" : "#6B7280"} />
                    <Text className={`ml-2 text-sm ${selectedCategory === c.id ? "text-blue-700" : "text-gray-700"}`}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-gray-600 mb-2">Subcategory (optional)</Text>
              <TextInput 
                value={subcategory} 
                onChangeText={setSubcategory} 
                placeholder="e.g. Morning show intro" 
                className="border border-gray-300 rounded-lg px-3 py-3 bg-white mb-4" 
              />

              <Text className="text-gray-600 mb-2">Tags (comma separated)</Text>
              <TextInput 
                value={tagsText} 
                onChangeText={setTagsText} 
                placeholder="e.g. intro, music, voice" 
                className="border border-gray-300 rounded-lg px-3 py-3 bg-white mb-4" 
              />

              <Text className="text-gray-600 mb-2">Notes</Text>
              <TextInput 
                value={notes} 
                onChangeText={setNotes} 
                placeholder="Any additional notes..." 
                className="border border-gray-300 rounded-lg px-3 py-3 bg-white mb-6" 
                multiline 
                numberOfLines={3}
              />

              <View className="flex-row gap-3">
                <Pressable 
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowSaveModal(false);
                  }} 
                  className="flex-1 bg-gray-200 rounded-lg p-4"
                >
                  <Text className="text-center text-gray-700 font-medium">Back</Text>
                </Pressable>
                
                <Pressable 
                  onPress={async () => {
                    const sourceUri = croppedPreviewUri || pendingUri;
                    if (!sourceUri) return;
                    const cat = customCategory.trim() || selectedCategory;
                    if (!cat) return;

                    try {
                      if (previewSound) {
                        const st: any = await previewSound.getStatusAsync();
                        if (st?.isLoaded && st.isPlaying) await previewSound.pauseAsync();
                        await previewSound.unloadAsync();
                      }
                    } catch {}

                    try {
                      const res = await saveAsIsRecording({
                        stationId: sid,
                        baseUri: pendingUri!,
                        tempName,
                        selectedCategoryId: selectedCategory,
                        customCategory,
                        subcategory,
                        tagsText,
                        notes,
                        sessionWaveform: sessionWaveform || liveValues,
                      });
                      setPendingUri(null);
                      setCroppedPreviewUri(null);
                      setShowSaveModal(false);
                      setShowPreviewModal(false);
                      setShowCropModal(false);
                      setShowCroppedPreviewModal(false);
                      setShowWorkflowChoiceModal(false);
                      setCompletedWorkflowSteps(prev => [...prev, "save"]);
                      setCurrentWorkflowStep("record");
                      setWorkflowChoice(null);
                      setUiMode("record");
                      setTempName("");
                      setSelectedCategory("");
                      setSubcategory("");
                      setTagsText("");
                      setNotes("");
                      provideTactileFeedback("medium");
                      showToast("Saved recording");
                    } catch (e: any) {
                      showToast(e?.message || "Failed to save recording");
                    }
                  }} 
                     className={`flex-1 rounded-lg p-4 ${
                    (!selectedCategory && !customCategory.trim()) ? "bg-blue-300" : "bg-blue-500"
                  }`}
                  disabled={(!selectedCategory && !customCategory.trim())}
                >
                  <Text className="text-center text-white font-medium">Save</Text>
                </Pressable>
              </View>

              {/* Save & Open Editor */}
              <Pressable 
                onPress={async () => {
                  const sourceUri = croppedPreviewUri || pendingUri;
                  if (!sourceUri) return;
                  const cat = customCategory.trim() || selectedCategory;
                  if (!cat) return;
                  try {
                    if (previewSound) {
                      const st: any = await previewSound.getStatusAsync();
                      if (st?.isLoaded && st.isPlaying) await previewSound.pauseAsync();
                      await previewSound.unloadAsync();
                    }
                  } catch {}

                    try {
                      const res = await saveAsIsRecording({
                        stationId: sid,
                        baseUri: pendingUri!,
                        tempName,
                        selectedCategoryId: selectedCategory,
                        customCategory,
                        subcategory,
                        tagsText,
                        notes,
                        sessionWaveform: sessionWaveform || liveValues,
                      });
                      setPendingUri(null);
                      setCroppedPreviewUri(null);
                      setShowSaveModal(false);
                      setShowPreviewModal(false);
                      setShowCropModal(false);
                      setShowCroppedPreviewModal(false);
                      setShowWorkflowChoiceModal(false);
                      setWorkflowChoice(null);
                      setUiMode("record");
                      setTempName(""); setSelectedCategory(""); setSubcategory(""); setTagsText(""); setNotes("");
                      provideTactileFeedback("medium");
                      setCurrentEditId(res.id);
                      // Verify file exists before navigating (3 quick retries)
                      let ok = false;
                      for (let i = 0; i < 3; i++) {
                        try { const info = await FileSystem.getInfoAsync(res.dest); if (info.exists) { ok = true; break; } } catch {}
                        await new Promise(r => setTimeout(r, 150));
                      }
                      if (!ok) { showToast("Saved, but file not ready. Try again."); return; }
                      showToast("Saved. Opening editor...");
                      setTimeout(() => { (navigation as any).navigate("Main", { screen: "Edit", params: { id: res.id, uri: res.dest, stationId: sid, mode: "simple", freshStart: true } }); }, 0);
                    } catch (e: any) {
                      showToast(e?.message || "Failed to save recording");
                    }
                }} 
                className="w-full bg-purple-600 rounded-lg p-4 mt-3"
              >
                <Text className="text-center text-white font-medium">Save & Open Editor</Text>
              </Pressable>

              {/* Save & Append to Current Edit (jump to Record More) */}
              <Pressable 
                onPress={async () => {
                  const sourceUri = croppedPreviewUri || pendingUri;
                  if (!sourceUri) return;
                  const cat = customCategory.trim() || selectedCategory;
                  if (!cat) return;
                  try {
                    if (previewSound) {
                      const st: any = await previewSound.getStatusAsync();
                      if (st?.isLoaded && st.isPlaying) await previewSound.pauseAsync();
                      await previewSound.unloadAsync();
                    }
                  } catch {}

                  try {
                    const res = await saveAsIsRecording({
                      stationId: sid,
                      baseUri: pendingUri!,
                      tempName,
                      selectedCategoryId: selectedCategory,
                      customCategory,
                      subcategory,
                      tagsText,
                      notes,
                      sessionWaveform: sessionWaveform || liveValues,
                    });
                    setPendingUri(null);
                    setCroppedPreviewUri(null);
                    setShowSaveModal(false);
                    setShowPreviewModal(false);
                    setShowCropModal(false);
                    setShowCroppedPreviewModal(false);
                    setShowWorkflowChoiceModal(false);
                    setWorkflowChoice(null);
                    setUiMode("record");
                    setTempName(""); setSelectedCategory(""); setSubcategory(""); setTagsText(""); setNotes("");
                    provideTactileFeedback("medium");
                    setCurrentEditId(res.id);
                    // Quick exists check
                    let ok = false;
                    for (let i = 0; i < 3; i++) {
                      try { const info = await FileSystem.getInfoAsync(res.dest); if (info.exists) { ok = true; break; } } catch {}
                      await new Promise(r => setTimeout(r, 150));
                    }
                    if (!ok) { showToast("Saved, but file not ready. Try again."); return; }
                    showToast("Saved. Appending to editor...");
                    setTimeout(() => { (navigation as any).navigate("Main", { screen: "Edit", params: { id: res.id, uri: res.dest, stationId: sid, startAt: "record_more", resumePreferred: true } }); }, 0);
                  } catch (e: any) {
                    showToast(e?.message || "Failed to save recording");
                  }
                }} 
                className="w-full bg-emerald-600 rounded-lg p-4 mt-3"
              >
                <Text className="text-center text-white font-medium">Save & Append to Current Edit</Text>
              </Pressable>

            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Permission Modal */}
      <Modal 
        visible={showPermissionModal} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setShowPermissionModal(false)}
      >
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-xl font-bold text-gray-800 mb-2">Microphone Permission Needed</Text>
            <Text className="text-gray-600 mb-4">
              Please enable microphone access in Settings to record audio.
            </Text>
            <Pressable 
              onPress={() => setShowPermissionModal(false)} 
              className="bg-blue-500 rounded-lg p-3"
            >
              <Text className="text-white text-center font-medium">OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>


      {/* Script Selector Modal */}
      <Modal 
        visible={showScriptSelector} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setShowScriptSelector(false)}
      >
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-2xl p-6 max-h-4/5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-gray-800">Select Script</Text>
              <Pressable onPress={() => setShowScriptSelector(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {listScripts().length === 0 ? (
                <View className="items-center py-8">
                  <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
                  <Text className="text-gray-500 text-lg mt-4 mb-2">No scripts available</Text>
                  <Text className="text-gray-400 text-center mb-6">
                    Create a script first to use the teleprompter
                  </Text>
                  <Pressable 
                    onPress={() => {
                      setShowScriptSelector(false);
                      (navigation as any).navigate("Scripts");
                    }}
                    className="bg-blue-600 px-6 py-3 rounded-lg"
                  >
                    <Text className="text-white font-medium">Create Script</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="space-y-3">
                  {/* Clear selection option */}
                  <Pressable
                    onPress={() => {
                      setCurrentScript("");
                      setShowScriptSelector(false);
                    }}
                    className="p-4 rounded-lg border-2 border-gray-200 bg-gray-50"
                  >
                    <View className="flex-row items-center">
                      <Ionicons name="close-circle" size={20} color="#6B7280" />
                      <Text className="text-gray-700 font-medium ml-3">No Script (Regular Recording)</Text>
                    </View>
                  </Pressable>

                  {/* Script options */}
                  {listScripts().map((script) => (
                    <Pressable
                      key={script.id}
                      onPress={() => {
                        setCurrentScript(script.id);
                        setShowScriptSelector(false);
                      }}
                      className={`p-4 rounded-lg border-2 ${
                        currentScript === script.id 
                          ? "border-purple-500 bg-purple-50" 
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className={`font-medium ${
                            currentScript === script.id ? "text-purple-700" : "text-gray-800"
                          }`}>
                            {script.name}
                          </Text>
                          <Text className="text-gray-500 text-sm mt-1">
                            {script.count} items • {script.status}
                          </Text>
                          {script.description && (
                            <Text className="text-gray-400 text-sm mt-1">
                              {script.description}
                            </Text>
                          )}
                        </View>
                        {currentScript === script.id && (
                          <Ionicons name="checkmark-circle" size={24} color="#7C3AED" />
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Teleprompter Overlay */}
      {showTeleprompter && (
        <Modal 
          visible={showTeleprompter} 
          animationType="fade" 
          onRequestClose={() => setShowTeleprompter(false)}
        >
          <RecordingTeleprompter
            isRecording={isRecording}
            onClose={() => {
              setShowTeleprompter(false);
              setScriptRecordingMode(false);
            }}
          />
        </Modal>
      )}
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {renderContent()}
      {/* Enhanced Floating Show Teleprompter Button */}
      {currentScript && !showTeleprompter && uiMode === "record" && (
        <View className="absolute left-0 right-0 items-center" style={{ bottom: Math.max((insets?.bottom || 0) + controlsH + 12, (insets?.bottom || 0) + 160) }}>
          {/* Script Info */}
          <View className="bg-black/80 backdrop-blur-sm rounded-lg p-3 max-w-[240px] mb-2">
            <Text className="text-white text-xs font-medium mb-1 text-center">
              {getCurrentScriptName()}
            </Text>
            <Text className="text-gray-300 text-xs text-center">
              {scriptItems.length} items • Tap to open teleprompter
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setShowTeleprompter(true);
              provideTactileFeedback("medium");
            }}
            className="bg-purple-600 rounded-full p-4 shadow-lg"
            style={({ pressed }) => ({
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }]
            })}
          >
            <View className="flex-row items-center">
              <Ionicons name="document-text" size={20} color="white" />
              <Text className="text-white font-medium ml-2 text-sm">Show Script</Text>
            </View>
          </Pressable>
        </View>
      )}

      {/* Recording Status Integration with Teleprompter */}
      {showTeleprompter && isRecording && (
        <View className="absolute top-16 left-6 bg-red-600/90 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg">
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-white mr-2 animate-pulse" />
            <Text className="text-white text-xs font-bold">RECORDING WITH SCRIPT</Text>
          </View>
        </View>
      )}

      {/* Docked Teleprompter Overlay */}
      {showTeleprompter && (
        <RecordingTeleprompter
          isRecording={isRecording}
          visible
          anchor={teleAnchor}
          heightRatio={teleHeightRatio}
          minimized={teleMinimized}
          onRequestClose={() => { setShowTeleprompter(false); setTeleMinimized(false); }}
          onToggleAnchor={() => setTeleAnchor(prev => prev === "top" ? "bottom" : "top")}
          onToggleMinimize={() => setTeleMinimized(m => !m)}
          onHeightRatioChange={(r) => setTeleHeightRatio(r)}
          autoStartScrolling={true}
          smartPauseDetection={true}
          showProgressIndicator={true}
          enableGestures={true}
          onRecordingStart={() => {
            // Auto-start scrolling when recording begins
            console.log("Recording started with teleprompter");
          }}
          onRecordingStop={() => {
            // Auto-pause scrolling when recording stops
            console.log("Recording stopped with teleprompter");
          }}
        />
      )}
    </SafeAreaView>
  );
}