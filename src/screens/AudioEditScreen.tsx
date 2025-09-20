import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, BackHandler, Pressable, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenContainer from "../components/ScreenContainer";
import { useRoute, useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

// Workflow system imports
import { 
  useAudioEditWorkflowStore, 
  AudioEditWorkflowStep
} from "../state/audioEditWorkflowStore";
import WorkflowProgress from "../components/audioWorkflow/WorkflowProgress";

// Step components
import CropDecisionStep from "../components/audioWorkflow/CropDecisionStep";
import RecordMoreStep from "../components/audioWorkflow/RecordMoreStep";
import VoiceChangeStep from "../components/audioWorkflow/VoiceChangeStep";
import InsertBedStep from "../components/audioWorkflow/InsertBedStep";
import AudioProcessStep from "../components/audioWorkflow/AudioProcessStep";
import MixdownStep from "../components/audioWorkflow/MixdownStep";
import BroadcastReadyStep from "../components/audioWorkflow/BroadcastReadyStep";
import SaveOrRestartStep from "../components/audioWorkflow/SaveOrRestartStep";

// Existing imports
import { useAudioStore, useRecordingsForStation } from "../state/audioStore";
import { useUserStore } from "../state/userStore";
import { StandardButton } from "../components/StandardButton";
import { StandardCard } from "../components/StandardCard";
import StandardHeader from "../components/StandardHeader";
import { StationPill } from "../components/StationSwitcher";
import * as Haptics from "expo-haptics";

export default function AudioEditScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const stationId = useUserStore((s) => s.user.currentStationId) ?? "station-a";
  const recordings = useRecordingsForStation(stationId);
  const currentEditId = useAudioStore((s) => s.currentEditId);
  const setCurrentEditId = useAudioStore((s) => s.setCurrentEditId);
  
  // Workflow state
  const {
    recordingId: workflowRecordingId,
    currentStep,
    completedSteps,
    workflowData,
    isActive: workflowActive,
    startWorkflow,
    setCurrentStep,
    nextStep,
    previousStep,
    resetWorkflow,
    discardWorkflow,
    completeWorkflow,
    lastError,
    setError,
  } = useAudioEditWorkflowStore();
  
  const [showDebugHUD, setShowDebugHUD] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryMode, setEntryMode] = useState<"continue_or_new" | "start_on_current" | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const suppressEntryPromptRef = useRef(false);
  
  const routeId = (route as any)?.params?.id as string | undefined;
  const routeUri = (route as any)?.params?.uri as string | undefined;
  const freshStart = (route as any)?.params?.freshStart === true;
  const resumePreferred = (route as any)?.params?.resumePreferred === true;
  
  const currentRec = recordings.find((r) => r.id === currentEditId) || null;

  
  // Initialize workflow when recording is selected
  useEffect(() => {
    const id = routeId || currentEditId;
    if (id && id !== workflowRecordingId) {
      console.log("🔄 Starting workflow for recording:", id);
      startWorkflow(id);
      setCurrentEditId(id);
    }
  }, [routeId, currentEditId, workflowRecordingId]);
  
  // Handle route params
  useEffect(() => {
    const id = routeId;
    if (id) {
      const exists = recordings.find((r) => r.id === id);
      if (exists && currentEditId !== id) {
        setCurrentEditId(id);
      }
    }
  }, [routeId, recordings.length, currentEditId]);
  
  // Honor startAt route param to jump directly to a step
  useEffect(() => {
    const startAt = (route as any)?.params?.startAt as string | undefined;
    if (!startAt) return;
    if (startAt === "record_more") {
      setCurrentStep("record_more");
    }
  }, [route, setCurrentStep]);
  
  // Focus effect to handle navigation and entry prompt
  useFocusEffect(useCallback(() => {
    const id = routeId || currentEditId || null;

    console.log("🔍 AudioEditScreen focus effect:", { 
      routeId, 
      currentEditId, 
      freshStart, 
      resumePreferred, 
      workflowActive, 
      workflowRecordingId,
      suppressEntryPrompt: suppressEntryPromptRef.current 
    });

    // If starting fresh from a new recording, skip prompts and start a new workflow on that id
    if (freshStart && routeId) {
      console.log("🆕 Fresh start detected - starting new workflow without prompts");
      suppressEntryPromptRef.current = true;
      
      // Always reset workflow when starting fresh to ensure clean state
      if (workflowActive) {
        console.log("🔄 Resetting existing workflow for fresh start");
        resetWorkflow();
      }
      
      startWorkflow(routeId);
      setCurrentEditId(routeId);
      const startAt = (route as any)?.params?.startAt as string | undefined;
      if (startAt === "record_more") setCurrentStep("record_more");
      setShowEntryModal(false);
      try { (navigation as any).setParams?.({ freshStart: undefined, resumePreferred: undefined, startAt: undefined }); } catch {}
      return () => {};
    }

    // If appending/continuing is preferred, jump straight to record_more
    if (resumePreferred) {
      console.log("📎 Resume preferred - jumping to record_more step");
      suppressEntryPromptRef.current = true;
      if (workflowActive && (workflowRecordingId || currentEditId)) {
        setCurrentStep("record_more");
        setShowEntryModal(false);
      } else if (routeId) {
        startWorkflow(routeId);
        setCurrentEditId(routeId);
        setCurrentStep("record_more");
        setShowEntryModal(false);
      }
      try { (navigation as any).setParams?.({ freshStart: undefined, resumePreferred: undefined, startAt: undefined }); } catch {}
      return () => {};
    }

    // Default behavior (guarded to avoid flicker when flags were handled)
    if (!suppressEntryPromptRef.current) {
      console.log("🤔 Showing entry modal - no special flags detected");
      if (workflowActive && (workflowRecordingId || currentEditId)) {
        setEntryMode("continue_or_new");
        setShowEntryModal(true);
      } else if (!workflowActive && id) {
        setEntryMode("start_on_current");
        setShowEntryModal(true);
      } else if (!workflowActive && !id) {
        // No context: send to Manage to pick a file for edit
        console.log("📁 No recording context - navigating to file selection");
        (navigation as any).navigate("Main", { screen: "Export", params: { selectForEdit: true } });
      }
    } else {
      console.log("🚫 Entry modal suppressed by flag");
    }

    if (routeId && currentEditId !== routeId) {
      setCurrentEditId(routeId);
    }
    return () => { 
      console.log("🧹 Clearing suppressEntryPrompt flag");
      suppressEntryPromptRef.current = false; 
    };
  }, [routeId, currentEditId, workflowActive, workflowRecordingId, freshStart, resumePreferred]));
  
  // Handle Android back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (workflowActive && currentStep !== "crop") {
          // Go to previous step instead of exiting
          previousStep();
          return true;
        }
        return false;
      };
      
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [workflowActive, currentStep, previousStep])
  );
  
  // Toast helper
  const showToast = (message: string, duration: number = 3000) => {
    setToast(message);
    setTimeout(() => setToast(null), duration);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  
  // Error handling
  useEffect(() => {
    if (lastError) {
      showToast(lastError);
      setError(null);
    }
  }, [lastError]);
  
  // Step navigation handlers
  const handleNext = () => {
    console.log("🔄 Moving to next step from:", currentStep);
    console.log("📊 Completed steps:", completedSteps);
    console.log("💾 Workflow data:", workflowData);
    nextStep();
  };
  
  const handlePrevious = () => {
    console.log("🔄 Moving to previous step from:", currentStep);
    previousStep();
  };
  
  const handleStepJump = (step: AudioEditWorkflowStep) => {
    console.log("🔄 Jumping to step:", step);
    setCurrentStep(step);
  };
  
  const handleWorkflowComplete = () => {
    console.log("✅ Workflow completed successfully");
    showToast("🎉 Audio editing workflow completed!", 4000);
    completeWorkflow();
    
    // Navigate back or to a success screen
    setTimeout(() => {
      navigation.goBack();
    }, 2000);
  };
  
  const handleWorkflowRestart = () => {
    console.log("🔄 Restarting workflow");
    if (currentEditId) {
      startWorkflow(currentEditId);
    }
  };

  const handleDiscardRequest = () => {
    setShowDiscardModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleConfirmDiscard = () => {
    console.log("🗑️ User confirmed workflow discard");
    discardWorkflow();
    setShowDiscardModal(false);
    showToast("Workflow discarded", 2000);
    
    // Navigate back to audio management
    setTimeout(() => {
      (navigation as any).navigate("Main", { screen: "Export" });
    }, 500);
  };
  
  // Render current step component
  const renderCurrentStep = () => {
    if (!workflowActive || !currentEditId) {
      return null;
    }
    
    const commonProps = {
      recordingId: currentEditId,
      onNext: handleNext,
      onPrevious: currentStep !== "crop" ? handlePrevious : undefined,
    };
    
    switch (currentStep) {
      case "crop":
        return <CropDecisionStep {...commonProps} />;
        
      case "record_more":
        return <RecordMoreStep {...commonProps} />;
        
      case "voice_change":
        return <VoiceChangeStep {...commonProps} />;
        
      case "insert_bed":
        return <InsertBedStep {...commonProps} />;
        
      case "audio_process":
        return <AudioProcessStep {...commonProps} />;
        
      case "mixdown":
        return <MixdownStep {...commonProps} />;
        
      case "broadcast_ready":
        return (
          <BroadcastReadyStep 
            {...commonProps}
            onComplete={handleWorkflowComplete}
          />
        );
        
      case "save_or_restart":
        return (
          <SaveOrRestartStep
            recordingId={currentEditId}
            onRestart={handleWorkflowRestart}
            onComplete={handleWorkflowComplete}
          />
        );
        
      default:
        return (
          <View className="flex-1 items-center justify-center p-6">
            <Ionicons name="construct" size={48} color="#F59E0B" />
            <Text className="text-lg font-semibold text-gray-800 mt-4 mb-2">
              Step Under Construction
            </Text>
            <Text className="text-gray-600 text-center">
              The "{currentStep}" step is being developed.
            </Text>
          </View>
        );
    }
  };
  
  // Show recording selection if no workflow is active
  if (!workflowActive || !currentEditId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StandardHeader
          title="Audio Editor"
          subtitle="Select a recording to start editing"
          icon="cut"
          iconBackgroundColor="#10B981"
          showDebugToggle={true}
          debugActive={showDebugHUD}
          onDebugToggle={() => setShowDebugHUD((v) => !v)}
          debugInfo={
            showDebugHUD ? (
              <>
                <Text className="text-xs text-gray-600">routeId: {routeId || "none"}</Text>
                <Text className="text-xs text-gray-600">currentEditId: {currentEditId || "null"}</Text>
                <Text className="text-xs text-gray-600">workflowActive: {workflowActive ? "yes" : "no"}</Text>
                <Text className="text-xs text-gray-600">recordings: {recordings.length}</Text>
              </>
            ) : undefined
          }
        />
        
        <View className="px-6 mt-2">
          <StationPill />
        </View>
        
        {/* Temporary playback for route URI */}
        {!currentRec && routeUri && (
          <View className="bg-white mt-2 px-6 py-4">
            <View className="mb-3 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200">
              <Text className="text-yellow-800 text-sm">
                Temporary playback. Your library entry may appear shortly.
              </Text>
            </View>
            <Text className="text-lg font-semibold text-gray-800 mb-3">Now Playing</Text>
            <Text className="text-gray-600 text-center">
              Basic playback functionality would be here for temporary files.
            </Text>
          </View>
        )}
        
        {/* Recording Selection */}
        <View className="bg-white mt-2 px-6 py-4">
          {currentEditId && !recordings.find(r => r.id === currentEditId) ? (
            <View className="mb-3 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200">
              <Text className="text-yellow-800 text-sm">Loading recording…</Text>
            </View>
          ) : null}
          
          <Text className="text-lg font-semibold text-gray-800 mb-4">Select Recording to Edit</Text>
          
          {recordings.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Ionicons name="musical-notes-outline" size={64} color="#9CA3AF" />
              <Text className="text-gray-500 mt-4 text-lg">No recordings available</Text>
              <Text className="text-gray-400 text-center mt-2 px-8">
                Record something first on the Recording tab
              </Text>
            </View>
          ) : (
            <View className="space-y-3">
              {[...recordings]
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                .map((rec) => (
                  <StandardCard key={rec.id} variant="default">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-2">
                        <Text className="font-medium text-gray-800">{rec.name || "Untitled"}</Text>
                        <Text className="text-gray-500 text-sm">
                          {new Date(rec.createdAt).toLocaleString()}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          <View className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 mr-2">
                            <Text className="text-blue-700 text-xs">{rec.category || "Other"}</Text>
                          </View>
                          <View className={`px-2 py-0.5 rounded-full border ${
                            rec.workflowStatus === "ready_broadcast" ? "bg-green-50 border-green-200" :
                            rec.workflowStatus === "in_edit" ? "bg-blue-50 border-blue-200" :
                            "bg-amber-50 border-amber-200"
                          }`}>
                            <Text className={`text-xs ${
                              rec.workflowStatus === "ready_broadcast" ? "text-green-700" :
                              rec.workflowStatus === "in_edit" ? "text-blue-700" :
                              "text-amber-700"
                            }`}>
                              {rec.workflowStatus === "ready_broadcast" ? "Ready" :
                               rec.workflowStatus === "in_edit" ? "Editing" :
                               "Needs Edit"}
                            </Text>
                          </View>
                        </View>
                      </View>
                      
                      <StandardButton
                        title="Edit"
                        onPress={() => {
                          setCurrentEditId(rec.id);
                          startWorkflow(rec.id);
                        }}
                        variant="primary"
                        icon="cut"
                        size="small"
                      />
                    </View>
                  </StandardCard>
                ))}
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }
  
  // Main workflow interface
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Entry Modal */}
      {showEntryModal && (
        <View className="absolute top-0 left-0 right-0 bottom-0 z-50 bg-black bg-opacity-40 items-center justify-center">
          <View className="mx-6 p-5 rounded-2xl bg-white w-11/12 max-w-md">
            <Text className="text-xl font-bold text-gray-900 mb-2">{entryMode === "continue_or_new" ? "Continue editing?" : "Start a new workflow?"}</Text>
            <Text className="text-gray-600 mb-4">
              {entryMode === "continue_or_new" 
                ? `You have an existing workflow${currentRec?.name ? ` for ${currentRec.name}` : ""}. Continue or start a new one?`
                : currentRec?.name ? `Start a new workflow on ${currentRec.name}?` : "Pick a file to start editing."}
            </Text>
            <View className="flex-row gap-2">
              {entryMode === "continue_or_new" ? (
                <>
                  <Pressable onPress={() => { setShowEntryModal(false); }} className="flex-1 bg-blue-600 rounded-lg p-3">
                    <Text className="text-white text-center font-medium">Continue</Text>
                  </Pressable>
                  <Pressable onPress={() => { resetWorkflow(); if (currentEditId) { startWorkflow(currentEditId); } else { (navigation as any).navigate("Main", { screen: "Export", params: { selectForEdit: true } }); } setShowEntryModal(false); }} className="flex-1 bg-gray-200 rounded-lg p-3">
                    <Text className="text-gray-800 text-center font-medium">Start New</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {currentEditId ? (
                    <Pressable onPress={() => { startWorkflow(currentEditId); setShowEntryModal(false); }} className="flex-1 bg-blue-600 rounded-lg p-3">
                      <Text className="text-white text-center font-medium">Start</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => { (navigation as any).navigate("Main", { screen: "Export", params: { selectForEdit: true } }); setShowEntryModal(false); }} className="flex-1 bg-gray-200 rounded-lg p-3">
                    <Text className="text-gray-800 text-center font-medium">Pick Different</Text>
                  </Pressable>
                </>
              )}
            </View>
            <Pressable onPress={() => setShowEntryModal(false)} className="mt-2 p-2 rounded-lg bg-gray-100">
              <Text className="text-gray-600 text-center">Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Workflow Progress Header */}
        <WorkflowProgress
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepPress={handleStepJump}
          onDiscard={handleDiscardRequest}
          showStepNames={true}
          compact={true}
        />
      
      {/* Toast Messages */}
      {toast && (
        <View className="mx-4 mt-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
          <Text className="text-green-700 text-sm text-center">{toast}</Text>
        </View>
      )}
      
      {/* Current Step Content */}
      <ScreenContainer scroll keyboardAware contentClassName="px-4 py-3">
        {renderCurrentStep()}
      </ScreenContainer>
      
      {/* Debug HUD */}
      {showDebugHUD && (
        <View className="absolute bottom-4 right-4 bg-black bg-opacity-80 rounded-lg p-3">
          <Text className="text-white text-xs mb-1">Debug Info:</Text>
          <Text className="text-white text-xs">Step: {currentStep}</Text>
          <Text className="text-white text-xs">Recording: {currentEditId}</Text>
          <Text className="text-white text-xs">Completed: {completedSteps.length}</Text>
          <Text className="text-white text-xs mb-2">Active: {workflowActive ? "Yes" : "No"}</Text>
          <Pressable
            onPress={() => {
              resetWorkflow();
            }}
            className="mt-1 px-2 py-1 rounded bg-red-600"
          >
            <Text className="text-white text-xs">Reset Workflow</Text>
          </Pressable>
        </View>
      )}

      {/* Discard Confirmation Modal */}
      <Modal visible={showDiscardModal} transparent animationType="fade" onRequestClose={() => setShowDiscardModal(false)}>
        <View className="flex-1 items-center justify-center bg-black bg-opacity-50">
          <View className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-3">
                <Ionicons name="warning" size={32} color="#EF4444" />
              </View>
              <Text className="text-xl font-bold text-gray-900 mb-2">Discard Workflow?</Text>
              <Text className="text-gray-600 text-center">
                This will abandon all your current progress and return you to file selection. Your original recording will not be affected.
              </Text>
            </View>
            <View className="flex-row gap-3">
              <Pressable 
                onPress={() => setShowDiscardModal(false)} 
                className="flex-1 bg-gray-200 rounded-lg p-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-center text-gray-700 font-medium">Cancel</Text>
              </Pressable>
              <Pressable 
                onPress={handleConfirmDiscard} 
                className="flex-1 bg-red-600 rounded-lg p-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-center text-white font-medium">Discard</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}