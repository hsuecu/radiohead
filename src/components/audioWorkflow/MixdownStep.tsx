import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { StandardButton } from "../StandardButton";
import { StandardCard } from "../StandardCard";
import UniversalAudioPreview from "../UniversalAudioPreview";
import { useAudioEditWorkflowStore, MixdownData } from "../../state/audioEditWorkflowStore";
import { useAudioStore } from "../../state/audioStore";
import { hapticFeedback } from "../../utils/mobileOptimization";
import { startRender, getRenderStatus } from "../../api/render";

export type MixdownStepProps = {
  recordingId: string;
  onNext: () => void;
  onPrevious?: () => void;
};

export default function MixdownStep({
  recordingId,
  onNext,
  onPrevious,
}: MixdownStepProps) {
  const [decision, setDecision] = useState<boolean | null>(null);
  const [mixdownData, setMixdownData] = useState<MixdownData>({ created: false });
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewPositionMs, setPreviewPositionMs] = useState(0);
  const [previewDurationMs, setPreviewDurationMs] = useState(0);
  
  const recordings = useAudioStore((s) => s.recordingsByStation);
  const stationId = Object.keys(recordings)[0] || "station-a";
  const currentRec = recordings[stationId]?.find(r => r.id === recordingId);
  const addRecording = useAudioStore((s) => s.addRecording);
  
  const workflowData = useAudioEditWorkflowStore((s) => s.workflowData);
  
  // Load existing decision and data
  useEffect(() => {
    const existingDecision = useAudioEditWorkflowStore.getState().getStepDecision("mixdown");
    const existingData = useAudioEditWorkflowStore.getState().getStepData("mixdown") as MixdownData;
    
    if (existingDecision !== null) {
      setDecision(existingDecision);
      
      if (existingData) {
        setMixdownData(existingData);
      }
    }
  }, [recordingId]);
  
  // Load preview audio when mixdown is created
  const loadPreviewAudio = async (uri: string) => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false
      } as any);
      
      const { sound: audioSound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, progressUpdateIntervalMillis: 100 }
      );
      
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
  
  // Load existing mixdown preview if available
  useEffect(() => {
    if (mixdownData.mixdownUri && !previewSound) {
      loadPreviewAudio(mixdownData.mixdownUri);
    }
  }, [mixdownData.mixdownUri]);
  
  // Cleanup preview audio
  useEffect(() => {
    return () => {
      if (previewSound) {
        previewSound.unloadAsync().catch(() => {});
      }
    };
  }, [previewSound]);
  
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
  
  const handleDecision = (wantsMixdown: boolean) => {
    setDecision(wantsMixdown);
    hapticFeedback.selection();
    
    if (!wantsMixdown) {
      // Complete step immediately if user doesn't want mixdown
      useAudioEditWorkflowStore.getState().completeStep("mixdown", false, { created: false });
    }
  };
  
  const createMixdown = async () => {
    if (!currentRec || isCreating) return;
    
    try {
      setIsCreating(true);
      setProgress(0);
      
      // Build mixdown plan from workflow data and multitrack
      const segments: any[] = [];

      // Include multitrack segments if present on the recording
      if (currentRec.segments && currentRec.segments.length > 0) {
        currentRec.segments.forEach((seg) => {
          segments.push({
            uri: seg.uri,
            startMs: seg.startMs,
            endMs: seg.endMs,
            trackId: seg.trackId,
            gain: seg.gain ?? 1,
            pan: seg.pan ?? 0,
            fadeInMs: seg.fadeInMs ?? 0,
            fadeOutMs: seg.fadeOutMs ?? 0,
          });
        });
      }
      
      // Add bed if present (simplified approach)
      if (workflowData.bed?.bedUri) {
        const bedVolume = workflowData.bed.bedVolume || (workflowData.bed.bedGain ? workflowData.bed.bedGain * 100 : 30);
        const bedGain = bedVolume / 100;
        
        segments.push({
          uri: workflowData.bed.bedUri,
          startMs: workflowData.bed.bedStartMs || 0,
          endMs: workflowData.bed.bedEndMs || workflowData.bed.bedDurationMs || currentRec.durationMs || 60000,
          trackId: "bed",
          gain: bedGain,
          pan: 0,
          fadeInMs: workflowData.bed.bedFadeInMs || 0,
          fadeOutMs: workflowData.bed.bedFadeOutMs || 0,
        });
      }
      
      // Add additional recordings if present
      if (workflowData.recordMore?.additionalRecordings) {
        workflowData.recordMore.additionalRecordings.forEach((rec, index) => {
          segments.push({
            uri: rec.uri,
            startMs: 0,
            endMs: rec.durationMs,
            trackId: `additional-${index}`,
            gain: 1,
            pan: 0,
          });
        });
      }
      
      const mixdownPlan = {
        baseUri: currentRec.uri,
        segments,
        trackGains: {
          clip: 1,
          bed: workflowData.bed?.bedVolume ? workflowData.bed.bedVolume / 100 : (workflowData.bed?.bedGain || 0.3),
          sfx: 1,
        },
        ducking: { enabled: false, amountDb: 6, attackMs: 50, releaseMs: 200 },
        fx: {
          normalizeGainDb: workflowData.audioProcess?.normalizeTargetLufs ? 
            (workflowData.audioProcess.normalizeTargetLufs - (currentRec.lufs || -23)) : null,
          fadeInMs: workflowData.audioProcess?.fadeInMs ?? null,
          fadeOutMs: workflowData.audioProcess?.fadeOutMs ?? null,
        },
        outExt: "m4a",
        mixdown: true,
      };
      
      console.log("🎛️ Creating mixdown with plan:", mixdownPlan);
      
      const { jobId } = await startRender(mixdownPlan as any, stationId);
      console.log("🎛️ Mixdown job started:", jobId);
      
      // Poll for completion with progress updates
      let res = await getRenderStatus(jobId, stationId);
      for (let i = 0; i < 30 && !res.uri; i++) {
        await new Promise((r) => setTimeout(r, 200));
        res = await getRenderStatus(jobId, stationId);
        setProgress(Math.min(90, (i / 30) * 100));
      }
      
      console.log("🎛️ Mixdown result:", res);
      
      if (res.uri) {
        const mixdownId = `${recordingId}-mixdown-${Date.now()}`;
        const mixdownRecording = {
          ...currentRec,
          id: mixdownId,
          uri: res.uri,
          name: `${currentRec.name || "Recording"} (Mixdown)`,
          workflowStatus: "ready_edit" as const,
          segments: [],
          tracks: [],
          createdAt: Date.now(),
        };
        
        addRecording(mixdownRecording as any, stationId);
        
        const newMixdownData: MixdownData = {
          mixdownUri: res.uri,
          mixdownName: mixdownRecording.name,
          mixdownDurationMs: currentRec.durationMs,
          created: true,
        };
        
        setMixdownData(newMixdownData);
        setProgress(100);
        hapticFeedback.success();
        
        // Load preview audio
        loadPreviewAudio(res.uri);
        
      } else {
        throw new Error("Mixdown failed - no URI returned");
      }
      
    } catch (error) {
      console.error("❌ Mixdown error:", error);
      hapticFeedback.error();
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleNext = () => {
    if (decision === null) return;
    
    useAudioEditWorkflowStore.getState().updateWorkflowData({ mixdown: mixdownData });
    useAudioEditWorkflowStore.getState().completeStep("mixdown", decision, mixdownData);
    
    onNext();
  };
  
  // Check if mixdown is needed
  const needsMixdown = !!(
    workflowData.recordMore?.additionalRecordings?.length ||
    workflowData.bed?.bedUri ||
    workflowData.bed?.tracks?.length
  );
  
  if (!needsMixdown) {
    // Skip this step if no additional content was added
    useEffect(() => {
      useAudioEditWorkflowStore.getState().completeStep("mixdown", false, { created: false });
      onNext();
    }, []);
    
    return null;
  }
  
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
        <StandardCard title="Create Mixdown" variant="default">
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-800 mb-2">
              Do you want to create a mixdown?
            </Text>
            <Text className="text-gray-600 mb-4">
              A mixdown combines all your tracks into a single file. This is recommended when you have 
              background music or additional recordings.
            </Text>
            
            {/* Show what will be mixed */}
            <View className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <Text className="text-blue-800 font-medium mb-2">Your mix includes:</Text>
              <View className="space-y-1">
                <Text className="text-blue-700 text-sm">• Main recording: {currentRec.name}</Text>
                {workflowData.bed?.bedUri && (
                  <Text className="text-blue-700 text-sm">
                    • Background music: {workflowData.bed.bedName} ({workflowData.bed.bedVolume || Math.round((workflowData.bed.bedGain || 0.3) * 100)}% volume)
                  </Text>
                )}
                {workflowData.recordMore?.additionalRecordings?.map((rec) => (
                  <Text key={rec.id} className="text-blue-700 text-sm">• Additional audio: {rec.name}</Text>
                ))}
              </View>
            </View>
            
            {decision === null && (
              <View className="flex-row gap-3">
                <StandardButton
                  title="Yes, create mixdown"
                  onPress={() => handleDecision(true)}
                  variant="primary"
                  icon="layers"
                  style={{ flex: 1 }}
                />
                <StandardButton
                  title="No, keep separate"
                  onPress={() => handleDecision(false)}
                  variant="secondary"
                  icon="arrow-forward"
                  style={{ flex: 1 }}
                />
              </View>
            )}
            
            {decision !== null && (
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <Ionicons 
                    name={decision ? "layers" : "arrow-forward"} 
                    size={20} 
                    color={decision ? "#F59E0B" : "#10B981"} 
                  />
                  <Text className="ml-2 font-medium text-gray-800">
                    {decision ? "Creating mixdown" : "Keeping tracks separate"}
                  </Text>
                </View>
                
                <Pressable
                  onPress={() => {
                    setDecision(null);
                    setMixdownData({ created: false });
                  }}
                  className="self-start"
                >
                  <Text className="text-blue-600 text-sm">Change decision</Text>
                </Pressable>
              </View>
            )}
          </View>
          
          {decision === true && (
            <View className="mb-6">
              {!mixdownData.created ? (
                <View>
                  <StandardButton
                    title={isCreating ? `Creating... ${Math.round(progress)}%` : "Create Mixdown"}
                    onPress={createMixdown}
                    variant="primary"
                    icon={isCreating ? "hourglass" : "layers"}
                    disabled={isCreating}
                    fullWidth
                  />
                  
                  {isCreating && (
                    <View className="mt-3">
                      <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <View 
                          className="h-full bg-orange-500 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </View>
                      <Text className="text-center text-sm text-gray-600 mt-2">
                        Processing your mixdown...
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text className="ml-2 text-green-800 font-medium">Mixdown Created Successfully</Text>
                  </View>
                  <Text className="text-green-700 text-sm mb-4">
                    Your mixdown "{mixdownData.mixdownName}" has been added to your recordings library.
                  </Text>
                  
                  {/* Preview Controls */}
                  {previewSound && (
                    <View className="mt-3 p-3 bg-white rounded-lg border border-green-300">
                      <Text className="text-green-800 font-medium mb-3">Preview Mixdown</Text>
                      
                      <UniversalAudioPreview
                        samples={currentRec?.waveform}
                        durationMs={previewDurationMs || mixdownData.mixdownDurationMs || 60000}
                        height={48}
                        color="#10B981"
                        title="Final Mixdown"
                        subtitle={`Duration: ${Math.round((previewDurationMs || mixdownData.mixdownDurationMs || 0) / 1000)}s`}
                        mode="preview"
                        showTimeLabels={true}
                      />
                      
                      <View className="mt-3 items-center">
                        <View className="flex-row items-center gap-4">
                          <Pressable
                            onPress={() => previewSound.setPositionAsync(Math.max(0, previewPositionMs - 5000))}
                            className="w-10 h-10 rounded-full bg-green-100 items-center justify-center"
                          >
                            <Ionicons name="play-back" size={20} color="#059669" />
                          </Pressable>
                          <Pressable
                            onPress={togglePreviewPlayback}
                            className="w-12 h-12 rounded-full bg-green-600 items-center justify-center"
                          >
                            <Ionicons name={isPreviewPlaying ? "pause" : "play"} size={24} color="white" />
                          </Pressable>
                          <Pressable
                            onPress={() => previewSound.setPositionAsync(Math.min(previewDurationMs || 0, previewPositionMs + 5000))}
                            className="w-10 h-10 rounded-full bg-green-100 items-center justify-center"
                          >
                            <Ionicons name="play-forward" size={20} color="#059669" />
                          </Pressable>
                        </View>
                        <View className="flex-row justify-between w-full mt-3">
                          <Text className="text-xs text-green-600">{Math.floor((previewPositionMs || 0) / 1000)}s</Text>
                          <Text className="text-xs text-green-600">{Math.floor((previewDurationMs || mixdownData.mixdownDurationMs || 0) / 1000)}s</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}
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
              title="Continue"
              onPress={handleNext}
              variant="primary"
              icon="arrow-forward"
              disabled={decision === null || (decision && !mixdownData.created && !isCreating)}
              style={{ flex: 1 }}
            />
          </View>
        </StandardCard>
      </View>
    </View>
  );
}