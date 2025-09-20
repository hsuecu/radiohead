import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { StandardButton } from "../StandardButton";
import { StandardCard } from "../StandardCard";
import UniversalAudioPreview from "../UniversalAudioPreview";
import { useAudioEditWorkflowStore } from "../../state/audioEditWorkflowStore";
import { useAudioStore } from "../../state/audioStore";
import { hapticFeedback } from "../../utils/mobileOptimization";
import { useNavigation } from "@react-navigation/native";

export type BroadcastReadyStepProps = {
  recordingId: string;
  onNext: () => void;
  onPrevious?: () => void;
  onComplete: () => void;
};

export default function BroadcastReadyStep({
  recordingId,
  onNext,
  onPrevious,
  onComplete,
}: BroadcastReadyStepProps) {
  const navigation = useNavigation<any>();
  const [decision, setDecision] = useState<boolean | null>(null);
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewPositionMs, setPreviewPositionMs] = useState(0);
  const [previewDurationMs, setPreviewDurationMs] = useState(0);
  
  const recordings = useAudioStore((s) => s.recordingsByStation);
  const stationId = Object.keys(recordings)[0] || "station-a";
  const currentRec = recordings[stationId]?.find(r => r.id === recordingId);
  const setStatus = useAudioStore((s) => s.setStatus);
  
  const workflowData = useAudioEditWorkflowStore((s) => s.workflowData);
  
  // Load existing decision
  useEffect(() => {
    const existingDecision = useAudioEditWorkflowStore.getState().getStepDecision("broadcast_ready");
    
    if (existingDecision !== null) {
      setDecision(existingDecision);
    }
  }, [recordingId]);
  
  // Load preview audio
  useEffect(() => {
    if (!currentRec?.uri) return;
    
    let cancelled = false;
    
    const loadAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false
        } as any);
        
        // Use mixdown URI if available, otherwise use original recording
        const audioUri = workflowData.mixdown?.mixdownUri || currentRec.uri;
        
        const { sound: audioSound, status } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: false, progressUpdateIntervalMillis: 100 }
        );
        
        if (cancelled) {
          await audioSound.unloadAsync();
          return;
        }
        
        setPreviewSound(audioSound);
        
        const audioStatus = status as any;
        if (audioStatus?.isLoaded && audioStatus.durationMillis) {
          setPreviewDurationMs(audioStatus.durationMillis);
        }
        
        audioSound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.isLoaded) {
            setIsPreviewPlaying(status.isPlaying || false);
            setPreviewPositionMs(status.positionMillis || 0);
          }
        });
        
      } catch (error) {
        console.error("Failed to load preview audio:", error);
      }
    };
    
    loadAudio();
    
    return () => {
      cancelled = true;
      if (previewSound) {
        previewSound.unloadAsync().catch(() => {});
      }
    };
  }, [currentRec?.uri, workflowData.mixdown?.mixdownUri]);
  
  const togglePreviewPlayback = async () => {
    if (!previewSound) return;
    
    try {
      const status: any = await previewSound.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await previewSound.pauseAsync();
        } else {
          await previewSound.playAsync();
        }
      }
    } catch (error) {
      console.error("Preview playback error:", error);
    }
  };
  
  const handleDecision = (isReady: boolean) => {
    if (!currentRec) {
      useAudioEditWorkflowStore.getState().setError("Recording not found. Cannot proceed with broadcast ready step");
      return;
    }
    
    setDecision(isReady);
    hapticFeedback.selection();
    
    if (isReady) {
      // Mark recording as ready for broadcast
      setStatus(recordingId, "ready_broadcast", stationId);
      
      // Complete the workflow step and entire workflow
      useAudioEditWorkflowStore.getState().updateWorkflowData({ broadcastReady: { ready: true, timestamp: Date.now() } });
      useAudioEditWorkflowStore.getState().completeStep("broadcast_ready", true, { ready: true, timestamp: Date.now() });
      useAudioEditWorkflowStore.getState().completeWorkflow();
      
      hapticFeedback.success();
      onComplete();
    } else {
      // Complete step but continue to save/restart options
      useAudioEditWorkflowStore.getState().updateWorkflowData({ broadcastReady: { ready: false, timestamp: Date.now() } });
      useAudioEditWorkflowStore.getState().completeStep("broadcast_ready", false, { ready: false, timestamp: Date.now() });
      onNext();
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
  
  // Generate summary of what was done
  const getWorkflowSummary = () => {
    const summary: string[] = [];
    
    if (workflowData.crop?.applied) {
      summary.push("✓ Audio cropped and trimmed");
    }
    
    if (workflowData.recordMore?.additionalRecordings?.length) {
      summary.push(`✓ ${workflowData.recordMore.additionalRecordings.length} additional recording(s) added`);
    }
    
    if (workflowData.bed?.bedUri) {
      summary.push("✓ Background music added");
    }
    
    if (workflowData.audioProcess?.applied) {
      summary.push("✓ Audio quality enhanced");
    }
    
    if (workflowData.mixdown?.created) {
      summary.push("✓ Mixdown created");
    }
    
    if (summary.length === 0) {
      summary.push("• Original recording preserved");
    }
    
    return summary;
  };
  
  const workflowSummary = getWorkflowSummary();
  
  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-6">
        <StandardCard title="Ready for Broadcast?" variant="default">
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-800 mb-2">
              Is your clip ready for broadcast?
            </Text>
            <Text className="text-gray-600 mb-4">
              Review your work and decide if this recording is ready to go on air.
            </Text>
            
            {/* Recording Summary */}
            <View className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                  <Ionicons name="musical-note" size={20} color="#3B82F6" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-gray-800">{currentRec.name || "Untitled Recording"}</Text>
                  <Text className="text-sm text-gray-600">
                    Duration: {Math.floor((previewDurationMs || currentRec.durationMs || 0) / 60000)}:
                    {Math.floor(((previewDurationMs || currentRec.durationMs || 0) % 60000) / 1000).toString().padStart(2, "0")}
                  </Text>
                </View>
              </View>
              
              {/* Audio Preview */}
              {previewSound && (
                <View className="mb-3">
                  <UniversalAudioPreview
                    samples={currentRec.waveform}
                    durationMs={previewDurationMs || currentRec.durationMs || 60000}
                    height={48}
                    color="#3B82F6"
                    title={workflowData.mixdown?.mixdownUri ? "Final Mixdown" : "Original Recording"}
                    subtitle={`Ready for broadcast • ${Math.round((previewDurationMs || currentRec.durationMs || 0) / 1000)}s`}
                    mode="preview"
                    showTimeLabels={true}
                  />
                  
                  <View className="mt-3 items-center">
                    <View className="flex-row items-center gap-4">
                      <Pressable
                        onPress={() => previewSound.setPositionAsync(Math.max(0, previewPositionMs - 5000))}
                        className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center"
                      >
                        <Ionicons name="play-back" size={20} color="#3B82F6" />
                      </Pressable>
                      <Pressable
                        onPress={togglePreviewPlayback}
                        className="w-12 h-12 rounded-full bg-blue-600 items-center justify-center"
                      >
                        <Ionicons name={isPreviewPlaying ? "pause" : "play"} size={24} color="white" />
                      </Pressable>
                      <Pressable
                        onPress={() => previewSound.setPositionAsync(Math.min(previewDurationMs || 0, previewPositionMs + 5000))}
                        className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center"
                      >
                        <Ionicons name="play-forward" size={20} color="#3B82F6" />
                      </Pressable>
                    </View>
                    <View className="flex-row justify-between w-full mt-3">
                      <Text className="text-xs text-blue-600">{Math.floor((previewPositionMs || 0) / 1000)}s</Text>
                      <Text className="text-xs text-blue-600">{Math.floor((previewDurationMs || currentRec.durationMs || 0) / 1000)}s</Text>
                    </View>
                  </View>
                </View>
              )}
              
              <View className="border-t border-gray-200 pt-3">
                <Text className="text-sm font-medium text-gray-700 mb-2">Workflow Summary:</Text>
                {workflowSummary.map((item, index) => (
                  <Text key={index} className="text-sm text-gray-600 mb-1">{item}</Text>
                ))}
              </View>
            </View>
            
            {decision === null && (
              <View className="flex-row gap-3">
                <StandardButton
                  title="Yes, ready to broadcast"
                  onPress={() => handleDecision(true)}
                  variant="primary"
                  icon="radio"
                  style={{ flex: 1 }}
                />
                <StandardButton
                  title="No, needs more work"
                  onPress={() => handleDecision(false)}
                  variant="secondary"
                  icon="build"
                  style={{ flex: 1 }}
                />
              </View>
            )}
            
            {decision !== null && (
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <Ionicons 
                    name={decision ? "radio" : "build"} 
                    size={20} 
                    color={decision ? "#06B6D4" : "#F59E0B"} 
                  />
                  <Text className="ml-2 font-medium text-gray-800">
                    {decision ? "Ready for broadcast" : "Needs more work"}
                  </Text>
                </View>
                
                {decision && (
                  <View className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <Text className="text-green-800 text-sm">
                      🎉 Congratulations! Your recording has been marked as ready for broadcast and 
                      is now available in your content library.
                    </Text>
                    <Pressable onPress={() => (navigation as any).navigate("Main", { screen: "Export", params: { selectedIds: [recordingId] } })} className="mt-3 px-3 py-2 bg-purple-600 rounded-lg">
                      <Text className="text-white text-sm text-center">Share</Text>
                    </Pressable>
                  </View>
                )}
                
                <Pressable
                  onPress={() => setDecision(null)}
                  className="self-start mt-2"
                >
                  <Text className="text-blue-600 text-sm">Change decision</Text>
                </Pressable>
              </View>
            )}
          </View>
          
          <View className="flex-row gap-3">
            {onPrevious && !decision && (
              <StandardButton
                title="Previous"
                onPress={onPrevious}
                variant="secondary"
                icon="arrow-back"
                style={{ flex: 1 }}
              />
            )}
            
            {decision === true && (
              <StandardButton
                title="Complete Workflow"
                onPress={onComplete}
                variant="primary"
                icon="checkmark-circle"
                fullWidth
              />
            )}
            
            {decision === false && (
              <StandardButton
                title="Continue"
                onPress={onNext}
                variant="primary"
                icon="arrow-forward"
                fullWidth
              />
            )}
          </View>
        </StandardCard>
      </View>
    </View>
  );
}