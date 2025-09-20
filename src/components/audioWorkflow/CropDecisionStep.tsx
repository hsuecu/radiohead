import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { StandardButton } from "../StandardButton";
import { StandardCard } from "../StandardCard";
import EnhancedLiveWaveform from "../EnhancedLiveWaveform";
import UniversalAudioPreview from "../UniversalAudioPreview";
import PlaybackControls from "../PlaybackControls";
import { useAudioEditWorkflowStore, CropData } from "../../state/audioEditWorkflowStore";
import { useAudioStore } from "../../state/audioStore";
import { useUserStore } from "../../state/userStore";
import { hapticFeedback } from "../../utils/mobileOptimization";

export type CropDecisionStepProps = {
  recordingId: string;
  onNext: () => void;
  onPrevious?: () => void;
};

export default function CropDecisionStep({
  recordingId,
  onNext,
  onPrevious,
}: CropDecisionStepProps) {
  const [decision, setDecision] = useState<boolean | null>(null);
  const [showCropInterface, setShowCropInterface] = useState(false);
  const [cropStartMs, setCropStartMs] = useState(0);
  const [cropEndMs, setCropEndMs] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  
  const completeStep = useAudioEditWorkflowStore((s) => s.completeStep);
  const updateWorkflowData = useAudioEditWorkflowStore((s) => s.updateWorkflowData);
  const getStepDecision = useAudioEditWorkflowStore((s) => s.getStepDecision);
  const getStepData = useAudioEditWorkflowStore((s) => s.getStepData);
  const setError = useAudioEditWorkflowStore((s) => s.setError);
  const setCurrentStep = useAudioEditWorkflowStore((s) => s.setCurrentStep);
  
  const recordings = useAudioStore((s) => s.recordingsByStation);
  const userStationId = useUserStore((s) => s.user.currentStationId) ?? "station-a";
  const stationId = userStationId;
  const updateRecording = useAudioStore((s) => s.updateRecording);
  
  const currentRec = React.useMemo(() => {
    const primary = recordings[stationId]?.find(r => r.id === recordingId);
    if (primary) return primary;
    for (const list of Object.values(recordings)) {
      const found = (list || []).find((r) => r.id === recordingId);
      if (found) return found;
    }
    return undefined;
  }, [recordings, stationId, recordingId]);
  
  // Load existing decision and data
  useEffect(() => {
    const existingDecision = getStepDecision("crop");
    const existingData = getStepData("crop") as CropData;
    
    if (existingDecision !== null) {
      setDecision(existingDecision);
      setShowCropInterface(existingDecision);
      
      if (existingData && currentRec) {
        setCropStartMs(existingData.startMs);
        setCropEndMs(existingData.endMs);
      }
    }
  }, [recordingId]);
  
  // Initialize crop bounds when recording loads
  useEffect(() => {
    if (currentRec && cropEndMs === 0) {
      const start = currentRec.trimStartMs || 0;
      const end = currentRec.trimEndMs || currentRec.durationMs || 60000;
      setCropStartMs(start);
      setCropEndMs(end);
    }
  }, [currentRec]);
  
  // Load audio for playback with existence check and retries
  useEffect(() => {
    if (!currentRec?.uri) return;

    let cancelled = false;

    const loadAudio = async () => {
      try {
        setIsLoadingAudio(true);

        // Quick existence retry loop (up to ~600ms)
        let exists = false;
        for (let i = 0; i < 5; i++) {
          const info = await FileSystem.getInfoAsync(currentRec.uri);
          if (info.exists) { exists = true; break; }
          await new Promise((r) => setTimeout(r, 120));
        }
        if (!exists) {
          setError("Audio file not found for preview");
          setIsLoadingAudio(false);
          return;
        }

        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false
          } as any);
        } catch {}

        const { sound: audioSound, status } = await Audio.Sound.createAsync(
          { uri: currentRec.uri },
          { shouldPlay: false, progressUpdateIntervalMillis: 120 }
        );

        if (cancelled) {
          try { audioSound.setOnPlaybackStatusUpdate(null as any); } catch {}
          await audioSound.unloadAsync();
          setIsLoadingAudio(false);
          return;
        }

        setSound(audioSound);

        const audioStatus = status as any;
        if (audioStatus?.isLoaded && audioStatus.durationMillis) {
          setDurationMs(audioStatus.durationMillis);
        }

        audioSound.setOnPlaybackStatusUpdate((status: any) => {
          if (!status?.isLoaded) return;
          setIsPlaying(status.isPlaying || false);
          setPositionMs(status.positionMillis || 0);

          // Handle reaching crop end
          if (status.positionMillis >= Math.max(0, cropEndMs - 50)) {
            if (repeatEnabled && status.isPlaying) {
              audioSound.setPositionAsync(cropStartMs).catch(() => {});
            } else if (status.isPlaying) {
              audioSound.pauseAsync().catch(() => {});
              // Reset to crop start for next play
              audioSound.setPositionAsync(cropStartMs).catch(() => {});
            }
          }
        });
      } catch (error) {
        console.error("Failed to load audio:", error);
        setError("Failed to load audio for preview. Please try again.");
      } finally {
        setIsLoadingAudio(false);
      }
    };

    loadAudio();

    return () => {
      cancelled = true;
      if (sound) {
        try { sound.setOnPlaybackStatusUpdate(null as any); } catch {}
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [currentRec?.uri]);
  
  const handleDecision = (wantsToCrop: boolean) => {
    setDecision(wantsToCrop);
    setShowCropInterface(wantsToCrop);
    hapticFeedback.selection();
    
    if (!wantsToCrop) {
      // If user doesn't want to crop, complete the step immediately
      completeStep("crop", false, {
        startMs: currentRec?.trimStartMs || 0,
        endMs: currentRec?.trimEndMs || currentRec?.durationMs || 0,
        applied: false,
      });
    }
  };
  
  const handleApplyCrop = () => {
    if (!currentRec) return;
    
    // Update the recording with new trim values
    updateRecording(recordingId, {
      trimStartMs: cropStartMs,
      trimEndMs: cropEndMs,
    }, stationId);
    
    // Save crop data to workflow
    const cropData: CropData = {
      startMs: cropStartMs,
      endMs: cropEndMs,
      applied: true,
    };
    
    updateWorkflowData({ crop: cropData });
    completeStep("crop", true, cropData);
    
    hapticFeedback.success();
  };
  
  const handleNext = () => {
    if (decision === null) {
      setError("Please make a decision about cropping before continuing");
      return;
    }
    
    if (!currentRec) {
      setError("Recording not found. Cannot proceed with crop step");
      return;
    }
    
    if (decision && !getStepData("crop")) {
      // User wants to crop but hasn't applied it yet
      handleApplyCrop();
    }
    
    onNext();
  };
  
  const togglePlayback = async () => {
    if (!sound || isLoadingAudio) return;
    try {
      const status: any = await sound.getStatusAsync();
      if (status?.isLoaded) {
        if (status.isPlaying) {
          await sound.pauseAsync();
        } else {
          // Always start from crop start position when playing
          await sound.setPositionAsync(cropStartMs);
          await sound.playAsync();
        }
      }
    } catch (error) {
      console.error("Playback error:", error);
    }
  };
  
  const seekTo = async (ms: number) => {
    if (!sound || isLoadingAudio) return;
    const clampedMs = Math.max(cropStartMs, Math.min(ms, cropEndMs));
    try {
      await sound.setPositionAsync(clampedMs);
    } catch (error) {
      console.error("Seek error:", error);
    }
  };
  
  if (!currentRec) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-lg font-semibold text-gray-800 mt-4 mb-2">
          Recording Not Found
        </Text>
        <Text className="text-gray-600 text-center">
          The selected recording could not be loaded.
        </Text>
      </View>
    );
  }
  
  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-6">
        <StandardCard title="Crop Audio" variant="default">
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-800 mb-2">
              Do you want to trim or crop your audio?
            </Text>
            <Text className="text-gray-600 mb-4">
              Cropping removes unwanted parts from the beginning or end of your recording.
            </Text>
            
            {/* Audio Preview */}
            <View className="mb-6">
              <UniversalAudioPreview
                samples={currentRec.waveform}
                durationMs={durationMs || currentRec.durationMs || 60000}
                height={56}
                color="#3B82F6"
                title={currentRec.name || "Current Recording"}
                subtitle={`Duration: ${Math.round((durationMs || currentRec.durationMs || 0) / 1000)}s`}
                mode="preview"
                showTimeLabels={true}
              />
              {/* Playback Controls for Step 1 */}
<View className="mt-4 items-center">
                <View className="flex-row items-center gap-4">
                  <Pressable
                    disabled={isLoadingAudio || !sound}
                    onPress={() => seekTo(Math.max(0, positionMs - 5000))}
                    className={`w-10 h-10 rounded-full items-center justify-center ${isLoadingAudio || !sound ? 'bg-gray-200' : 'bg-gray-100'}`}
                  >
                    <Ionicons name="play-back" size={20} color="#374151" />
                  </Pressable>
                  <Pressable
                    disabled={isLoadingAudio || !sound}
                    onPress={togglePlayback}
                    className={`w-12 h-12 rounded-full items-center justify-center ${isLoadingAudio || !sound ? 'bg-blue-300' : 'bg-blue-600'}`}
                  >
                    <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="white" />
                  </Pressable>
                  <Pressable
                    disabled={isLoadingAudio || !sound}
                    onPress={() => seekTo(Math.min(durationMs || 0, positionMs + 5000))}
                    className={`w-10 h-10 rounded-full items-center justify-center ${isLoadingAudio || !sound ? 'bg-gray-200' : 'bg-gray-100'}`}
                  >
                    <Ionicons name="play-forward" size={20} color="#374151" />
                  </Pressable>
                </View>
                {isLoadingAudio && (
                  <Text className="text-xs text-gray-400 mt-2">Preparing audio preview…</Text>
                )}
                <View className="flex-row justify-between w-full mt-3">
                  <Text className="text-xs text-gray-500">{Math.floor((positionMs || 0) / 1000)}s</Text>
                  <Text className="text-xs text-gray-500">{Math.floor(((durationMs || currentRec.durationMs || 0)) / 1000)}s</Text>
                </View>
              </View>
            </View>
            
            {decision === null && (
              <>
                <View className="mb-3">
                  <StandardButton
                    title="Record More"
                    onPress={() => setCurrentStep("record_more")}
                    variant="secondary"
                    icon="mic"
                  />
                </View>
                <View className="flex-row gap-3">
                  <StandardButton
                    title="Yes, crop it"
                    onPress={() => handleDecision(true)}
                    variant="primary"
                    icon="cut"
                    style={{ flex: 1 }}
                  />
                  <StandardButton
                    title="No, keep as-is"
                    onPress={() => handleDecision(false)}
                    variant="secondary"
                    icon="checkmark"
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            )}
            
            {decision !== null && (
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <Ionicons 
                    name={decision ? "cut" : "checkmark-circle"} 
                    size={20} 
                    color={decision ? "#3B82F6" : "#10B981"} 
                  />
                  <Text className="ml-2 font-medium text-gray-800">
                    {decision ? "Cropping enabled" : "Keeping original audio"}
                  </Text>
                </View>
                
                <Pressable
                  onPress={() => {
                    setDecision(null);
                    setShowCropInterface(false);
                  }}
                  className="self-start"
                >
                  <Text className="text-blue-600 text-sm">Change decision</Text>
                </Pressable>
              </View>
            )}
          </View>
          
          {showCropInterface && (
            <View className="mb-6">
              <Text className="text-gray-700 font-medium mb-3">Crop Settings</Text>
              
              <EnhancedLiveWaveform
                values={currentRec.waveform || []}
                durationMs={durationMs || currentRec.durationMs || 60000}
                positionMs={positionMs}
                cropMode={true}
                cropStartMs={cropStartMs}
                cropEndMs={cropEndMs}
                onCropStartChange={setCropStartMs}
                onCropEndChange={setCropEndMs}
                height={80}
                showTimeLabels={true}
                color="#3B82F6"
                showPeaks={true}
                audioUri={currentRec.uri}
                showPlaybackControls={true}
                onSeek={(ms) => setPositionMs(ms)}
              />
              
               <View className="mt-4">
                 <PlaybackControls
                   isPlaying={isPlaying}
                   onTogglePlay={togglePlayback}
                   onSkipBackward={(delta) => seekTo(positionMs - delta)}
                   onSkipForward={(delta) => seekTo(positionMs + delta)}
                   positionMs={positionMs}
                   durationMs={Math.max(0, (cropEndMs - cropStartMs))}
                   onSeek={(ms) => seekTo(cropStartMs + ms)}
                   volume={0.8}
                   onVolumeChange={() => {}}
                   showVolume={false}
                   disabled={isLoadingAudio || !sound}
                 />
                 <View className="flex-row items-center justify-center mt-3">
                   <Pressable onPress={() => setRepeatEnabled((v) => !v)} className={`px-3 py-1 rounded-full border ${repeatEnabled ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                     <View className="flex-row items-center">
                       <Ionicons name="repeat" size={16} color={repeatEnabled ? '#2563EB' : '#6B7280'} />
                       <Text className={`ml-2 text-sm ${repeatEnabled ? 'text-blue-700' : 'text-gray-700'}`}>Repeat selection</Text>
                     </View>
                   </Pressable>
                 </View>
               </View>
              
              <View className="mt-4 p-3 bg-blue-50 rounded-lg">
                <Text className="text-blue-800 text-sm">
                  Crop duration: {Math.floor((cropEndMs - cropStartMs) / 60000)}:
                  {Math.floor(((cropEndMs - cropStartMs) % 60000) / 1000).toString().padStart(2, "0")}
                </Text>
              </View>
            </View>
          )}
          
          <View className="flex-row gap-3">
            {onPrevious && (
              <StandardButton
                title="Previous"
                onPress={onPrevious}
                variant="secondary"
                icon="arrow-back"
                style={{ flex: 1 }}
              />
            )}
            <StandardButton
              title={decision ? "Apply & Continue" : "Continue"}
              onPress={handleNext}
              variant="primary"
              icon="arrow-forward"
              disabled={decision === null}
              style={{ flex: 1 }}
            />
          </View>
        </StandardCard>
      </View>
    </View>
  );
}