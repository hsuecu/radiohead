import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StandardButton } from "../StandardButton";
import { StandardCard } from "../StandardCard";
import { useAudioEditWorkflowStore, RecordMoreData } from "../../state/audioEditWorkflowStore";
import { hapticFeedback } from "../../utils/mobileOptimization";

export type RecordMoreStepProps = {
  recordingId: string;
  onNext: () => void;
  onPrevious?: () => void;
};

export default function RecordMoreStep({
  recordingId,
  onNext,
  onPrevious,
}: RecordMoreStepProps) {
  const [decision, setDecision] = useState<boolean | null>(null);
  const [additionalRecordings, setAdditionalRecordings] = useState<RecordMoreData["additionalRecordings"]>([]);
  
  // Load existing decision and data
  useEffect(() => {
    const existingDecision = useAudioEditWorkflowStore.getState().getStepDecision("record_more");
    const existingData = useAudioEditWorkflowStore.getState().getStepData("record_more") as RecordMoreData;
    
    if (existingDecision !== null) {
      setDecision(existingDecision);
      
      if (existingData?.additionalRecordings) {
        setAdditionalRecordings(existingData.additionalRecordings);
      }
    }
  }, [recordingId]);
  
  const handleDecision = (wantsToRecord: boolean) => {
    setDecision(wantsToRecord);
    hapticFeedback.selection();
    
    if (!wantsToRecord) {
      // Complete step immediately if user doesn't want to record more
      const recordMoreData: RecordMoreData = { additionalRecordings: [] };
      useAudioEditWorkflowStore.getState().updateWorkflowData({ recordMore: recordMoreData });
      useAudioEditWorkflowStore.getState().completeStep("record_more", false, recordMoreData);
    }
  };
  
  const handleNext = () => {
    if (decision === null) return;
    
    const recordMoreData: RecordMoreData = {
      additionalRecordings,
    };
    
    useAudioEditWorkflowStore.getState().updateWorkflowData({ recordMore: recordMoreData });
    useAudioEditWorkflowStore.getState().completeStep("record_more", decision, recordMoreData);
    
    onNext();
  };
  
  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 p-6">
        <StandardCard title="Record Additional Audio" variant="default">
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-800 mb-2">
              Do you want to record additional audio?
            </Text>
            <Text className="text-gray-600 mb-4">
              You can record multiple additional clips to layer with your main recording.
            </Text>
            
            {decision === null && (
              <View className="flex-row gap-3">
                <StandardButton
                  title="Yes, record more"
                  onPress={() => handleDecision(true)}
                  variant="primary"
                  icon="mic"
                  style={{ flex: 1 }}
                />
                <StandardButton
                  title="No, continue"
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
                    name={decision ? "mic" : "arrow-forward"} 
                    size={20} 
                    color={decision ? "#EF4444" : "#10B981"} 
                  />
                  <Text className="ml-2 font-medium text-gray-800">
                    {decision ? "Recording additional audio" : "Skipping additional recording"}
                  </Text>
                </View>
                
                <Pressable
                  onPress={() => {
                    setDecision(null);
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
              <View className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="information-circle" size={20} color="#3B82F6" />
                  <Text className="ml-2 font-medium text-blue-800">Recording Feature Coming Soon</Text>
                </View>
                <Text className="text-blue-700 text-sm">
                  The ability to record additional audio clips will be available in a future update. 
                  For now, you can continue to the next step.
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
              title="Continue"
              onPress={handleNext}
              variant="primary"
              icon="arrow-forward"
              disabled={decision === null}
              style={{ flex: 1 }}
            />
          </View>
        </StandardCard>
      </ScrollView>
    </View>
  );
}