import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AudioEditWorkflowStep = 
  | "crop" 
  | "record_more" 
  | "voice_change"
  | "insert_bed" 
  | "audio_process" 
  | "mixdown" 
  | "broadcast_ready" 
  | "save_or_restart";

export type WorkflowDecision = {
  step: AudioEditWorkflowStep;
  decision: boolean; // yes/no decision
  data?: any; // additional data for the step
  timestamp: number;
};

export type CropData = {
  startMs: number;
  endMs: number;
  applied: boolean;
};

export type RecordMoreData = {
  additionalRecordings: Array<{
    id: string;
    uri: string;
    name: string;
    durationMs: number;
    createdAt: number;
  }>;
};

export type VoiceChangeData = {
  originalUri?: string;
  transformedUri?: string;
  voiceName?: string;
  voiceId?: string;
  applied: boolean;
};

export type AudioTrack = {
  id: string;
  uri: string;
  name: string;
  durationMs: number;
  gain: number;
  startMs: number;
  endMs: number;
  trackIndex: number;
  muted?: boolean;
  solo?: boolean;
};

export type BedData = {
  // Simplified single bed support
  bedUri?: string;
  bedName?: string;
  bedDurationMs?: number;
  bedVolume?: number; // 0-100 percentage instead of gain
  bedStartMs?: number;
  bedEndMs?: number;
  bedFadeInMs?: number;
  bedFadeOutMs?: number;
  bedPlayMode?: "throughout" | "custom";
  
  // Legacy multi-track support (deprecated but kept for compatibility)
  tracks?: AudioTrack[];
  mainTrackId?: string;
  bedGain?: number; // Deprecated, use bedVolume instead
};

export type AudioProcessData = {
  // Legacy enhancement settings
  normalizeTargetLufs?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  eq?: any;
  compressor?: any;
  
  // Broadcast processing settings
  broadcastStandard?: string;
  cleanAndPolish?: boolean;
  processedUri?: string;
  analysisReport?: any;
  
  applied: boolean;
};

export type MixdownData = {
  mixdownUri?: string;
  mixdownName?: string;
  mixdownDurationMs?: number;
  created: boolean;
};

export type BroadcastReadyData = {
  ready: boolean;
  timestamp?: number;
};

export type SaveOrRestartData = {
  action: "save" | "restart";
  timestamp?: number;
};

export type WorkflowData = {
  crop?: CropData;
  recordMore?: RecordMoreData;
  voiceChange?: VoiceChangeData;
  bed?: BedData;
  audioProcess?: AudioProcessData;
  mixdown?: MixdownData;
  broadcastReady?: BroadcastReadyData;
  saveOrRestart?: SaveOrRestartData;
};

export type AudioEditWorkflowState = {
  // Current workflow session
  recordingId: string | null;
  currentStep: AudioEditWorkflowStep;
  completedSteps: AudioEditWorkflowStep[];
  decisions: WorkflowDecision[];
  workflowData: WorkflowData;
  
  // Workflow status
  isActive: boolean;
  startedAt: number | null;
  lastUpdatedAt: number | null;
  
  // Error handling
  lastError: string | null;
  canGoBack: boolean;
  
  // Actions
  startWorkflow: (recordingId: string) => void;
  setCurrentStep: (step: AudioEditWorkflowStep) => void;
  completeStep: (step: AudioEditWorkflowStep, decision: boolean, data?: any) => void;
  goToStep: (step: AudioEditWorkflowStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  updateWorkflowData: (stepData: Partial<WorkflowData>) => void;
  setError: (error: string | null) => void;
  resetWorkflow: () => void;
  discardWorkflow: () => void;
  completeWorkflow: () => void;
  
  // Utility methods
  getStepDecision: (step: AudioEditWorkflowStep) => boolean | null;
  getStepData: (step: AudioEditWorkflowStep) => any;
  isStepCompleted: (step: AudioEditWorkflowStep) => boolean;
  getNextStep: (currentStep: AudioEditWorkflowStep) => AudioEditWorkflowStep | null;
  getPreviousStep: (currentStep: AudioEditWorkflowStep) => AudioEditWorkflowStep | null;
};

// Define the workflow step sequence
const WORKFLOW_STEPS: AudioEditWorkflowStep[] = [
  "crop",
  "record_more", 
  "voice_change",
  "insert_bed",
  "audio_process",
  "mixdown",
  "broadcast_ready",
  "save_or_restart"
];

// Helper function to get step index
const getStepIndex = (step: AudioEditWorkflowStep): number => {
  return WORKFLOW_STEPS.indexOf(step);
};

// Helper function to determine if mixdown step should be shown
const shouldShowMixdown = (workflowData: WorkflowData): boolean => {
  return !!(
    workflowData.recordMore?.additionalRecordings?.length ||
    workflowData.bed?.bedUri ||
    workflowData.bed?.tracks?.length ||
    workflowData.voiceChange?.applied // Show mixdown if voice was changed
  );
};

// Helper function to get next step with conditional logic
const getNextStepLogic = (currentStep: AudioEditWorkflowStep, workflowData: WorkflowData): AudioEditWorkflowStep | null => {
  const currentIndex = getStepIndex(currentStep);
  
  // Special logic for voice change step - always show it
  if (currentStep === "record_more") {
    return "voice_change";
  }
  
  // Special logic for mixdown step
  if (currentStep === "audio_process") {
    if (shouldShowMixdown(workflowData)) {
      return "mixdown";
    } else {
      return "broadcast_ready";
    }
  }
  
  // Normal sequential flow
  if (currentIndex >= 0 && currentIndex < WORKFLOW_STEPS.length - 1) {
    return WORKFLOW_STEPS[currentIndex + 1];
  }
  
  return null;
};

// Helper function to get previous step
const getPreviousStepLogic = (currentStep: AudioEditWorkflowStep): AudioEditWorkflowStep | null => {
  const currentIndex = getStepIndex(currentStep);
  
  if (currentIndex > 0) {
    return WORKFLOW_STEPS[currentIndex - 1];
  }
  
  return null;
};

export const useAudioEditWorkflowStore = create<AudioEditWorkflowState>()(
  persist(
    (set, get) => ({
      // Initial state
      recordingId: null,
      currentStep: "crop",
      completedSteps: [],
      decisions: [],
      workflowData: {},
      isActive: false,
      startedAt: null,
      lastUpdatedAt: null,
      lastError: null,
      canGoBack: false,
      
      // Actions
      startWorkflow: (recordingId: string) => {
        if (!recordingId) {
          console.error("❌ Cannot start workflow: Recording ID is required");
          set({
            lastError: "Cannot start workflow: Recording ID is required",
            lastUpdatedAt: Date.now(),
          });
          return;
        }
        
        const state = get();
        console.log(`🎬 Starting audio edit workflow for recording: ${recordingId}`, {
          previousRecordingId: state.recordingId,
          wasActive: state.isActive,
          currentStep: state.currentStep
        });
        
        const now = Date.now();
        set({
          recordingId,
          currentStep: "crop",
          completedSteps: [],
          decisions: [],
          workflowData: {},
          isActive: true,
          startedAt: now,
          lastUpdatedAt: now,
          lastError: null,
          canGoBack: false,
        });
        
        console.log(`✅ Audio edit workflow started successfully for recording: ${recordingId}`);
      },
      
      setCurrentStep: (step: AudioEditWorkflowStep) => {
        set({
          currentStep: step,
          lastUpdatedAt: Date.now(),
          canGoBack: getStepIndex(step) > 0,
        });
      },
      
      completeStep: (step: AudioEditWorkflowStep, decision: boolean, data?: any) => {
        try {
          const state = get();
          const now = Date.now();
          
          const newDecision: WorkflowDecision = {
            step,
            decision,
            data,
            timestamp: now,
          };
          
          const updatedDecisions = [
            ...state.decisions.filter(d => d.step !== step), // Remove existing decision for this step
            newDecision
          ];
          
          const updatedCompletedSteps = state.completedSteps.includes(step) 
            ? state.completedSteps 
            : [...state.completedSteps, step];
          
          set({
            decisions: updatedDecisions,
            completedSteps: updatedCompletedSteps,
            lastUpdatedAt: now,
            lastError: null, // Clear any previous errors
          });
          
          console.log(`✅ Completed workflow step: ${step} with decision: ${decision}`);
        } catch (error) {
          console.error(`❌ Error completing step ${step}:`, error);
          set({
            lastError: `Failed to complete ${step} step`,
            lastUpdatedAt: Date.now(),
          });
        }
      },
      
      goToStep: (step: AudioEditWorkflowStep) => {
        const state = get();
        const stepIndex = getStepIndex(step);
        const currentIndex = getStepIndex(state.currentStep);
        
        // Only allow going to completed steps or the next step
        if (stepIndex <= currentIndex || state.completedSteps.includes(step)) {
          set({
            currentStep: step,
            lastUpdatedAt: Date.now(),
            canGoBack: stepIndex > 0,
          });
        }
      },
      
      nextStep: () => {
        const state = get();
        const nextStep = getNextStepLogic(state.currentStep, state.workflowData);
        
        if (nextStep) {
          set({
            currentStep: nextStep,
            lastUpdatedAt: Date.now(),
            canGoBack: true,
            lastError: null, // Clear any previous errors when advancing
          });
        } else {
          set({
            lastError: "No next step available. Workflow may be complete.",
            lastUpdatedAt: Date.now(),
          });
        }
      },
      
      previousStep: () => {
        const state = get();
        const prevStep = getPreviousStepLogic(state.currentStep);
        
        if (prevStep) {
          set({
            currentStep: prevStep,
            lastUpdatedAt: Date.now(),
            canGoBack: getStepIndex(prevStep) > 0,
          });
        }
      },
      
      updateWorkflowData: (stepData: Partial<WorkflowData>) => {
        const state = get();
        set({
          workflowData: { ...state.workflowData, ...stepData },
          lastUpdatedAt: Date.now(),
        });
      },
      
      setError: (error: string | null) => {
        set({
          lastError: error,
          lastUpdatedAt: Date.now(),
        });
      },
      
      resetWorkflow: () => {
        const state = get();
        console.log("🔄 Resetting workflow", {
          previousRecordingId: state.recordingId,
          wasActive: state.isActive,
          currentStep: state.currentStep,
          completedSteps: state.completedSteps.length
        });
        
        set({
          recordingId: null,
          currentStep: "crop",
          completedSteps: [],
          decisions: [],
          workflowData: {},
          isActive: false,
          startedAt: null,
          lastUpdatedAt: Date.now(),
          lastError: null,
          canGoBack: false,
        });
        
        console.log("✅ Workflow reset completed");
      },
      
      discardWorkflow: () => {
        console.log("🗑️ Discarding workflow - abandoning all progress");
        set({
          recordingId: null,
          currentStep: "crop",
          completedSteps: [],
          decisions: [],
          workflowData: {},
          isActive: false,
          startedAt: null,
          lastUpdatedAt: Date.now(),
          lastError: null,
          canGoBack: false,
        });
      },
      
      completeWorkflow: () => {
        set({
          isActive: false,
          lastUpdatedAt: Date.now(),
        });
      },
      
      // Utility methods
      getStepDecision: (step: AudioEditWorkflowStep) => {
        const state = get();
        const decision = state.decisions.find(d => d.step === step);
        return decision ? decision.decision : null;
      },
      
      getStepData: (step: AudioEditWorkflowStep) => {
        const state = get();
        const decision = state.decisions.find(d => d.step === step);
        return decision ? decision.data : null;
      },
      
      isStepCompleted: (step: AudioEditWorkflowStep) => {
        const state = get();
        return state.completedSteps.includes(step);
      },
      
      getNextStep: (currentStep: AudioEditWorkflowStep) => {
        const state = get();
        return getNextStepLogic(currentStep, state.workflowData);
      },
      
      getPreviousStep: (currentStep: AudioEditWorkflowStep) => {
        return getPreviousStepLogic(currentStep);
      },
    }),
    {
      name: "audio-edit-workflow-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist essential data, not temporary UI state
      partialize: (state) => ({
        recordingId: state.recordingId,
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        decisions: state.decisions,
        workflowData: state.workflowData,
        isActive: state.isActive,
        startedAt: state.startedAt,
        lastUpdatedAt: state.lastUpdatedAt,
      }),
    }
  )
);

// Export workflow step definitions for UI components
export const WORKFLOW_STEP_DEFINITIONS = {
  crop: {
    title: "Crop Audio",
    description: "Do you want to trim or crop your audio?",
    icon: "cut" as const,
    color: "#3B82F6",
  },
  record_more: {
    title: "Record More",
    description: "Do you want to record additional audio?",
    icon: "mic" as const,
    color: "#EF4444",
  },
  voice_change: {
    title: "Change Voice",
    description: "Do you want to transform your voice?",
    icon: "person" as const,
    color: "#F59E0B",
  },
  insert_bed: {
    title: "Add Background",
    description: "Do you want to add background music or beds?",
    icon: "musical-notes" as const,
    color: "#8B5CF6",
  },
  audio_process: {
    title: "Enhance Audio",
    description: "Do you want to enhance your audio quality?",
    icon: "options" as const,
    color: "#10B981",
  },
  mixdown: {
    title: "Create Mixdown",
    description: "Do you want to combine all tracks into one file?",
    icon: "layers" as const,
    color: "#F59E0B",
  },
  broadcast_ready: {
    title: "Ready for Broadcast",
    description: "Is your clip ready for broadcast?",
    icon: "radio" as const,
    color: "#06B6D4",
  },
  save_or_restart: {
    title: "Save or Restart",
    description: "Would you like to save for later or restart the workflow?",
    icon: "save" as const,
    color: "#6B7280",
  },
} as const;

export { WORKFLOW_STEPS };