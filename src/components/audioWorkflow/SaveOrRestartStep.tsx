import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StandardButton } from "../StandardButton";
import { StandardCard } from "../StandardCard";
import { useAudioEditWorkflowStore } from "../../state/audioEditWorkflowStore";
import { useAudioStore } from "../../state/audioStore";
import { hapticFeedback } from "../../utils/mobileOptimization";

export type SaveOrRestartStepProps = {
  recordingId: string;
  onRestart: () => void;
  onComplete: () => void;
};

export default function SaveOrRestartStep({
  recordingId,
  onRestart,
  onComplete,
}: SaveOrRestartStepProps) {
  const [decision, setDecision] = useState<"save" | "restart" | null>(null);
  
  const recordings = useAudioStore((s) => s.recordingsByStation);
  const stationId = Object.keys(recordings)[0] || "station-a";
  const currentRec = recordings[stationId]?.find(r => r.id === recordingId);
  const setStatus = useAudioStore((s) => s.setStatus);
  
  // Load existing decision
  useEffect(() => {
    const existingDecision = useAudioEditWorkflowStore.getState().getStepDecision("save_or_restart");
    
    if (existingDecision !== null) {
      // Map boolean to string decision
      setDecision(existingDecision ? "save" : "restart");
    }
  }, [recordingId]);
  
  const handleDecision = (choice: "save" | "restart") => {
    if (!currentRec) {
      useAudioEditWorkflowStore.getState().setError("Recording not found. Cannot proceed with save or restart step");
      return;
    }
    
    setDecision(choice);
    hapticFeedback.selection();
    
    if (choice === "save") {
      // Save for later - mark as in_edit
      setStatus(recordingId, "in_edit", stationId);
      
      // Complete the workflow step and entire workflow
      useAudioEditWorkflowStore.getState().updateWorkflowData({ saveOrRestart: { action: "save", timestamp: Date.now() } });
      useAudioEditWorkflowStore.getState().completeStep("save_or_restart", true, { action: "save", timestamp: Date.now() });
      useAudioEditWorkflowStore.getState().completeWorkflow();
      
      hapticFeedback.success();
      onComplete();
    } else {
      // Restart workflow
      useAudioEditWorkflowStore.getState().updateWorkflowData({ saveOrRestart: { action: "restart", timestamp: Date.now() } });
      useAudioEditWorkflowStore.getState().completeStep("save_or_restart", false, { action: "restart", timestamp: Date.now() });
      useAudioEditWorkflowStore.getState().resetWorkflow();
      
      hapticFeedback.medium();
      onRestart();
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
        <StandardCard title="Save or Restart?" variant="default">
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-800 mb-2">
              What would you like to do?
            </Text>
            <Text className="text-gray-600 mb-4">
              Since your clip isn't ready for broadcast yet, you can save your progress 
              to continue later, or restart the workflow to try again.
            </Text>
            
            {decision === null && (
              <View className="space-y-3">
                <Pressable
                  onPress={() => handleDecision("save")}
                  className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50"
                >
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 rounded-full bg-blue-500 items-center justify-center mr-4">
                      <Ionicons name="save" size={24} color="white" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-lg font-semibold text-blue-800 mb-1">
                        Save for Later
                      </Text>
                      <Text className="text-blue-700 text-sm">
                        Keep your current progress and return to edit this recording later. 
                        It will be marked as "In Edit" status.
                      </Text>
                    </View>
                  </View>
                </Pressable>
                
                <Pressable
                  onPress={() => handleDecision("restart")}
                  className="p-4 rounded-lg border-2 border-orange-200 bg-orange-50"
                >
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 rounded-full bg-orange-500 items-center justify-center mr-4">
                      <Ionicons name="refresh" size={24} color="white" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-lg font-semibold text-orange-800 mb-1">
                        Restart Workflow
                      </Text>
                      <Text className="text-orange-700 text-sm">
                        Start the editing workflow over from the beginning. 
                        Your original recording will be preserved.
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            )}
            
            {decision !== null && (
              <View className="mb-4">
                <View className={`p-4 rounded-lg border-2 ${
                  decision === "save" 
                    ? "border-blue-200 bg-blue-50" 
                    : "border-orange-200 bg-orange-50"
                }`}>
                  <View className="flex-row items-center mb-2">
                    <Ionicons 
                      name={decision === "save" ? "save" : "refresh"} 
                      size={20} 
                      color={decision === "save" ? "#3B82F6" : "#F59E0B"} 
                    />
                    <Text className={`ml-2 font-medium ${
                      decision === "save" ? "text-blue-800" : "text-orange-800"
                    }`}>
                      {decision === "save" ? "Saving for later" : "Restarting workflow"}
                    </Text>
                  </View>
                  
                  <Text className={`text-sm ${
                    decision === "save" ? "text-blue-700" : "text-orange-700"
                  }`}>
                    {decision === "save" 
                      ? "Your progress has been saved and you can continue editing this recording anytime."
                      : "The workflow will restart from the beginning, allowing you to make different choices."
                    }
                  </Text>
                </View>
                
                <Pressable
                  onPress={() => setDecision(null)}
                  className="self-start mt-3"
                >
                  <Text className="text-blue-600 text-sm">Change decision</Text>
                </Pressable>
              </View>
            )}
          </View>
          
          {decision && (
            <View className="flex-row gap-3">
              <StandardButton
                title={decision === "save" ? "Save & Exit" : "Restart Workflow"}
                onPress={() => handleDecision(decision)}
                variant="primary"
                icon={decision === "save" ? "save" : "refresh"}
                fullWidth
              />
            </View>
          )}
        </StandardCard>
      </View>
    </View>
  );
}