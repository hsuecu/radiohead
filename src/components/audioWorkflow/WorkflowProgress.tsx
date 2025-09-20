import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AudioEditWorkflowStep, WORKFLOW_STEP_DEFINITIONS, useAudioEditWorkflowStore } from "../../state/audioEditWorkflowStore";

export type WorkflowProgressProps = {
  currentStep: AudioEditWorkflowStep;
  completedSteps: AudioEditWorkflowStep[];
  onStepPress?: (step: AudioEditWorkflowStep) => void;
  onDiscard?: () => void;
  showStepNames?: boolean;
  compact?: boolean;
};

export default function WorkflowProgress({
  currentStep,
  completedSteps,
  onStepPress,
  onDiscard,
  showStepNames = false,
  compact = false,
}: WorkflowProgressProps) {
  const workflowData = useAudioEditWorkflowStore((s) => s.workflowData);
  
  // Determine which steps to show based on workflow decisions
  const getVisibleSteps = (): AudioEditWorkflowStep[] => {
    const baseSteps: AudioEditWorkflowStep[] = [
      "crop",
      "record_more", 
      "voice_change",
      "insert_bed",
      "audio_process"
    ];
    
    // Add mixdown step if user has additional content
    const hasAdditionalContent = !!(
      workflowData.recordMore?.additionalRecordings?.length ||
      workflowData.bed?.bedUri
    );
    
    if (hasAdditionalContent) {
      baseSteps.push("mixdown");
    }
    
    baseSteps.push("broadcast_ready");
    
    // Only show save_or_restart if user said no to broadcast ready
    const broadcastDecision = useAudioEditWorkflowStore.getState().getStepDecision("broadcast_ready");
    if (broadcastDecision === false) {
      baseSteps.push("save_or_restart");
    }
    
    return baseSteps;
  };
  
  const visibleSteps = getVisibleSteps();
  const currentStepIndex = visibleSteps.indexOf(currentStep);
  const totalSteps = visibleSteps.length;
  
  const getStepStatus = (step: AudioEditWorkflowStep) => {
    if (completedSteps.includes(step)) {
      return "completed";
    } else if (step === currentStep) {
      return "current";
    } else if (visibleSteps.indexOf(step) < currentStepIndex) {
      return "available";
    } else {
      return "upcoming";
    }
  };
  
  const getStepColor = (step: AudioEditWorkflowStep, status: string) => {
    if (status === "completed") {
      return "#10B981"; // green
    } else if (status === "current") {
      return WORKFLOW_STEP_DEFINITIONS[step].color;
    } else if (status === "available") {
      return "#6B7280"; // gray
    } else {
      return "#D1D5DB"; // light gray
    }
  };
  
  const handleStepPress = (step: AudioEditWorkflowStep) => {
    const status = getStepStatus(step);
    if ((status === "completed" || status === "available") && onStepPress) {
      onStepPress(step);
    }
  };
  
  if (compact) {
    return (
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-medium text-gray-700">
            Step {currentStepIndex + 1} of {totalSteps}
          </Text>
          <View className="flex-1 mx-4">
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View 
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ 
                  width: `${((currentStepIndex + 1) / totalSteps) * 100}%` 
                }}
              />
            </View>
          </View>
          <Text className="text-sm text-gray-500">
            {WORKFLOW_STEP_DEFINITIONS[currentStep].title}
          </Text>
          {onDiscard && (
            <Pressable
              onPress={onDiscard}
              className="ml-3 w-8 h-8 rounded-full bg-red-500 items-center justify-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              accessibilityLabel="Discard workflow"
              accessibilityHint="Abandon current workflow and return to file selection"
            >
              <Ionicons name="close" size={16} color="white" />
            </Pressable>
          )}
        </View>
      </View>
    );
  }
  
  return (
    <View className="bg-white border-b border-gray-200 px-4 py-4">
      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-800 mb-1">
            Audio Editing Workflow
          </Text>
          <Text className="text-sm text-gray-600">
            Step {currentStepIndex + 1} of {totalSteps} • {WORKFLOW_STEP_DEFINITIONS[currentStep].title}
          </Text>
        </View>
        {onDiscard && (
          <Pressable
            onPress={onDiscard}
            className="w-9 h-9 rounded-full bg-red-500 items-center justify-center ml-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            accessibilityLabel="Discard workflow"
            accessibilityHint="Abandon current workflow and return to file selection"
          >
            <Ionicons name="close" size={18} color="white" />
          </Pressable>
        )}
      </View>
      
      <View className="flex-row items-center justify-between">
        {visibleSteps.map((step, index) => {
          const status = getStepStatus(step);
          const stepDef = WORKFLOW_STEP_DEFINITIONS[step];
          const color = getStepColor(step, status);
          const isClickable = status === "completed" || status === "available";
          
          return (
            <React.Fragment key={step}>
              <Pressable
                onPress={() => handleStepPress(step)}
                disabled={!isClickable}
                className={`items-center ${isClickable ? "opacity-100" : "opacity-60"}`}
                style={{ flex: 1 }}
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: color }}
                >
                  {status === "completed" ? (
                    <Ionicons name="checkmark" size={20} color="white" />
                  ) : (
                    <Ionicons name={stepDef.icon} size={18} color="white" />
                  )}
                </View>
                
                {showStepNames && (
                  <Text 
                    className="text-xs text-center font-medium"
                    style={{ color }}
                    numberOfLines={2}
                  >
                    {stepDef.title}
                  </Text>
                )}
              </Pressable>
              
              {index < visibleSteps.length - 1 && (
                <View className="flex-1 h-0.5 bg-gray-200 mx-2 mt-5">
                  <View 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ 
                      width: index < currentStepIndex ? "100%" : "0%" 
                    }}
                  />
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}