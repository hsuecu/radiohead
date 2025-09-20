import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StandardButton } from "../StandardButton";
import { StandardCard } from "../StandardCard";
import VoiceChangerModal from "../VoiceChangerModal";
import EnhancedAudioPreview from "../EnhancedAudioPreview";
import { useAudioEditWorkflowStore, VoiceChangeData } from "../../state/audioEditWorkflowStore";
import { useAudioStore } from "../../state/audioStore";
import { useUserStore } from "../../state/userStore";
import { hapticFeedback } from "../../utils/mobileOptimization";

export type VoiceChangeStepProps = {
  recordingId: string;
  onNext: () => void;
  onPrevious?: () => void;
};

export default function VoiceChangeStep({
  recordingId,
  onNext,
  onPrevious,
}: VoiceChangeStepProps) {
  const [decision, setDecision] = useState<boolean | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceChangeData, setVoiceChangeData] = useState<VoiceChangeData>({ applied: false });
  
  const recordings = useAudioStore((s) => s.recordingsByStation);
  const updateRecording = useAudioStore((s) => s.updateRecording);
  const stationId = useUserStore((s) => s.user.currentStationId) ?? "station-a";
  const stationRecordings = recordings[stationId] || [];
  const currentRecording = stationRecordings.find(r => r.id === recordingId);
  
  const { completeStep, updateWorkflowData, setError } = useAudioEditWorkflowStore();
  
  // Load existing decision and data
  useEffect(() => {
    const existingDecision = useAudioEditWorkflowStore.getState().getStepDecision("voice_change");
    const existingData = useAudioEditWorkflowStore.getState().getStepData("voice_change") as VoiceChangeData;
    
    if (existingDecision !== null) {
      setDecision(existingDecision);
      
      if (existingData) {
        setVoiceChangeData(existingData);
      }
    }
  }, [recordingId]);
  
  const handleDecision = (wantsVoiceChange: boolean) => {
    if (!currentRecording?.uri) {
      setError("Recording not found. Cannot proceed with voice change step.");
      return;
    }
    
    setDecision(wantsVoiceChange);
    hapticFeedback.selection();
    
    if (wantsVoiceChange) {
      setShowVoiceModal(true);
    } else {
      // Skip voice change - complete step with no transformation
      const skipData: VoiceChangeData = {
        originalUri: currentRecording?.uri,
        applied: false
      };
      
      setVoiceChangeData(skipData);
      updateWorkflowData({ voiceChange: skipData });
      completeStep("voice_change", false, skipData);
      onNext();
    }
  };
  
  const handleVoiceChanged = (newUri: string, voiceName: string) => {
    if (!newUri || !voiceName) {
      setError("Voice transformation failed. Please try again.");
      return;
    }
    
    const transformedData: VoiceChangeData = {
      originalUri: currentRecording?.uri,
      transformedUri: newUri,
      voiceName,
      applied: true
    };
    
    // Update the recording URI to use the transformed audio
    if (currentRecording) {
      updateRecording(recordingId, { 
        uri: newUri,
        // Update name to indicate voice transformation
        name: currentRecording.name ? `${currentRecording.name} (${voiceName})` : `Voice Changed (${voiceName})`
      }, stationId);
    }
    
    setVoiceChangeData(transformedData);
    updateWorkflowData({ voiceChange: transformedData });
    completeStep("voice_change", true, transformedData);
    
    hapticFeedback.success();
    onNext();
  };
  
  const handleModalClose = () => {
    setShowVoiceModal(false);
    // Reset decision if user cancels without selecting voice
    if (!voiceChangeData.applied) {
      setDecision(null);
    }
  };
  
  const handleRetry = () => {
    setDecision(null);
    setVoiceChangeData({ applied: false });
  };

  if (!currentRecording) {
    return (
      <StandardCard variant="error" title="Recording Not Found" icon="warning">
        <Text className="text-gray-600 text-center">
          Could not find the recording to process.
        </Text>
      </StandardCard>
    );
  }

  return (
    <View className="flex-1 p-4">
      {/* Header */}
      <View className="mb-6">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Change Voice</Text>
        <Text className="text-gray-600 text-base leading-6">
          Transform your voice using AI voice conversion. You can choose from various voice styles or keep your original voice.
        </Text>
      </View>

      {/* Current Recording Info */}
      <StandardCard>
        <View className="flex-row items-center">
          <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-4">
            <Ionicons name="mic" size={24} color="#3B82F6" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-gray-900">{currentRecording.name}</Text>
            <Text className="text-sm text-gray-600">
              Duration: {Math.round((currentRecording.durationMs || 0) / 1000)}s
            </Text>
          </View>
          {voiceChangeData.applied && (
            <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center">
              <Ionicons name="checkmark" size={16} color="#10B981" />
            </View>
          )}
        </View>
        
        {/* Audio Preview */}
        <View className="mt-4">
          <EnhancedAudioPreview
            audioUri={voiceChangeData.applied ? voiceChangeData.transformedUri : currentRecording.uri}
            samples={currentRecording.waveform}
            durationMs={currentRecording.durationMs}
            title={voiceChangeData.applied ? `Transformed Voice (${voiceChangeData.voiceName})` : "Original Recording"}
            showPlaybackControls={true}
            showTimeLabels={true}
            height={56}
            color={voiceChangeData.applied ? "#10B981" : "#3B82F6"}
          />
        </View>
        
        {voiceChangeData.applied && voiceChangeData.voiceName && (
          <View className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <Text className="text-green-800 font-medium">Voice Changed</Text>
            <Text className="text-green-700 text-sm">
              Transformed to: {voiceChangeData.voiceName}
            </Text>
          </View>
        )}
      </StandardCard>

      {/* Decision Interface */}
      {decision === null && (
        <StandardCard>
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Do you want to change your voice?
          </Text>
          
          <View className="space-y-3">
            <Pressable
              onPress={() => handleDecision(true)}
              className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-blue-600 items-center justify-center mr-3">
                  <Ionicons name="person" size={20} color="white" />
                </View>
                <View>
                  <Text className="font-semibold text-blue-800">Yes, change my voice</Text>
                  <Text className="text-blue-600 text-sm">Transform using AI voice conversion</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
            </Pressable>
            
            <Pressable
              onPress={() => handleDecision(false)}
              className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-gray-600 items-center justify-center mr-3">
                  <Ionicons name="close" size={20} color="white" />
                </View>
                <View>
                  <Text className="font-semibold text-gray-800">No, keep original</Text>
                  <Text className="text-gray-600 text-sm">Continue with current voice</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </Pressable>
          </View>
        </StandardCard>
      )}

      {/* Voice Change Result */}
      {decision !== null && (
        <StandardCard>
          <View className="items-center py-4">
            <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
              voiceChangeData.applied ? "bg-green-100" : "bg-gray-100"
            }`}>
              <Ionicons 
                name={voiceChangeData.applied ? "checkmark" : "person"} 
                size={32} 
                color={voiceChangeData.applied ? "#10B981" : "#6B7280"} 
              />
            </View>
            <Text className="text-lg font-semibold text-gray-900 mb-2">
              {voiceChangeData.applied ? "Voice Changed Successfully" : "Keeping Original Voice"}
            </Text>
            <Text className="text-gray-600 text-center">
              {voiceChangeData.applied 
                ? `Your voice has been transformed to ${voiceChangeData.voiceName}`
                : "Continuing with your original voice recording"
              }
            </Text>
          </View>
        </StandardCard>
      )}

      {/* Navigation */}
      <View className="flex-row gap-3 mt-auto">
        {onPrevious && (
          <StandardButton
            title="Previous"
            variant="secondary"
            onPress={onPrevious}
            icon="chevron-back"
            iconPosition="left"
            fullWidth
          />
        )}
        
        {decision !== null && (
          <StandardButton
            title="Continue"
            onPress={onNext}
            icon="chevron-forward"
            iconPosition="right"
            fullWidth
          />
        )}
        
        {decision !== null && (
          <StandardButton
            title="Change"
            variant="secondary"
            onPress={handleRetry}
            icon="refresh"
            iconPosition="left"
          />
        )}
      </View>

      {/* Voice Changer Modal */}
      <VoiceChangerModal
        visible={showVoiceModal}
        sourceUri={currentRecording.uri}
        sourceName={currentRecording.name || "Recording"}
        onClose={handleModalClose}
        onVoiceChanged={handleVoiceChanged}
      />
    </View>
  );
}