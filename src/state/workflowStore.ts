import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type WorkflowType = "record" | "voice-track" | "edit" | "other";

export type WorkflowStep = {
  id: string;
  title: string;
  description: string;
  icon: string;
  isCompleted: boolean;
  isActive: boolean;
  isAvailable: boolean;
};

export type WorkflowDefinition = {
  id: WorkflowType;
  title: string;
  description: string;
  icon: string;
  color: string;
  steps: string[];
};

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    id: "record",
    title: "Record a new clip",
    description: "Record, crop, and save audio content",
    icon: "mic",
    color: "#3B82F6", // blue
    steps: ["setup", "record", "preview", "crop", "save"]
  },
  {
    id: "voice-track",
    title: "Voice track a show",
    description: "Record voice tracks with cart integration",
    icon: "radio",
    color: "#8B5CF6", // purple
    steps: ["setup", "record", "carts", "mix", "export"]
  },
  {
    id: "edit",
    title: "Edit an existing clip",
    description: "Open and edit previously recorded content",
    icon: "cut",
    color: "#10B981", // green
    steps: ["select", "edit", "enhance", "save"]
  },
  {
    id: "other",
    title: "Other",
    description: "Import, batch operations, and advanced tools",
    icon: "ellipsis-horizontal",
    color: "#F59E0B", // amber
    steps: ["select-action", "configure", "execute"]
  }
];

export const WORKFLOW_STEP_DEFINITIONS: Record<string, Omit<WorkflowStep, "isCompleted" | "isActive" | "isAvailable">> = {
  // Record workflow steps
  "setup": {
    id: "setup",
    title: "Setup",
    description: "Configure input source and levels",
    icon: "settings"
  },
  "record": {
    id: "record",
    title: "Record",
    description: "Record your audio content",
    icon: "mic"
  },
  "preview": {
    id: "preview",
    title: "Preview",
    description: "Listen to your recording",
    icon: "play"
  },
  "crop": {
    id: "crop",
    title: "Crop",
    description: "Trim and crop audio",
    icon: "cut"
  },
  "save": {
    id: "save",
    title: "Save",
    description: "Save and categorize recording",
    icon: "save"
  },
  
  // Voice track workflow steps
  "carts": {
    id: "carts",
    title: "Carts",
    description: "Add cart triggers",
    icon: "albums"
  },
  "mix": {
    id: "mix",
    title: "Mix",
    description: "Mix voice and carts",
    icon: "options"
  },
  "export": {
    id: "export",
    title: "Export",
    description: "Export final mix",
    icon: "share"
  },
  
  // Edit workflow steps
  "select": {
    id: "select",
    title: "Select File",
    description: "Choose file to edit",
    icon: "folder-open"
  },
  "edit": {
    id: "edit",
    title: "Edit",
    description: "Edit audio content",
    icon: "create"
  },
  "enhance": {
    id: "enhance",
    title: "Enhance",
    description: "Apply effects and enhancements",
    icon: "color-wand"
  },
  
  // Other workflow steps
  "select-action": {
    id: "select-action",
    title: "Select Action",
    description: "Choose what you want to do",
    icon: "list"
  },
  "configure": {
    id: "configure",
    title: "Configure",
    description: "Set up your action",
    icon: "cog"
  },
  "execute": {
    id: "execute",
    title: "Execute",
    description: "Run your action",
    icon: "play-circle"
  }
};

interface WorkflowState {
  // Current workflow state
  currentWorkflow: WorkflowType | null;
  currentStep: string | null;
  completedSteps: string[];
  
  // Breadcrumb navigation
  breadcrumbs: Array<{
    title: string;
    step?: string;
    workflow?: WorkflowType;
  }>;
  
  // Actions
  startWorkflow: (workflow: WorkflowType) => void;
  setCurrentStep: (step: string) => void;
  completeStep: (step: string) => void;
  resetWorkflow: () => void;
  addBreadcrumb: (title: string, step?: string, workflow?: WorkflowType) => void;
  clearBreadcrumbs: () => void;
  goBackInWorkflow: () => string | null;
  
  // Getters
  getCurrentWorkflowDefinition: () => WorkflowDefinition | null;
  getWorkflowSteps: () => WorkflowStep[];
  getAvailableSteps: () => string[];
  isStepCompleted: (step: string) => boolean;
  isStepAvailable: (step: string) => boolean;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      currentWorkflow: null,
      currentStep: null,
      completedSteps: [],
      breadcrumbs: [],
      
      startWorkflow: (workflow: WorkflowType) => {
        const definition = WORKFLOW_DEFINITIONS.find(w => w.id === workflow);
        if (!definition) return;
        
        set({
          currentWorkflow: workflow,
          currentStep: definition.steps[0],
          completedSteps: [],
          breadcrumbs: [{ title: definition.title, workflow }]
        });
      },
      
      setCurrentStep: (step: string) => {
        set({ currentStep: step });
      },
      
      completeStep: (step: string) => {
        set((state) => {
          const completedSteps = [...state.completedSteps];
          if (!completedSteps.includes(step)) {
            completedSteps.push(step);
          }
          return { completedSteps };
        });
      },
      
      resetWorkflow: () => {
        set({
          currentWorkflow: null,
          currentStep: null,
          completedSteps: [],
          breadcrumbs: []
        });
      },
      
      addBreadcrumb: (title: string, step?: string, workflow?: WorkflowType) => {
        set((state) => ({
          breadcrumbs: [...state.breadcrumbs, { title, step, workflow }]
        }));
      },
      
      clearBreadcrumbs: () => {
        set({ breadcrumbs: [] });
      },
      
      goBackInWorkflow: () => {
        const state = get();
        if (state.breadcrumbs.length <= 1) return null;
        
        const newBreadcrumbs = state.breadcrumbs.slice(0, -1);
        const previousBreadcrumb = newBreadcrumbs[newBreadcrumbs.length - 1];
        
        set({
          breadcrumbs: newBreadcrumbs,
          currentStep: previousBreadcrumb.step || null
        });
        
        return previousBreadcrumb.step || null;
      },
      
      getCurrentWorkflowDefinition: () => {
        const state = get();
        if (!state.currentWorkflow) return null;
        return WORKFLOW_DEFINITIONS.find(w => w.id === state.currentWorkflow) || null;
      },
      
      getWorkflowSteps: () => {
        const state = get();
        const definition = state.getCurrentWorkflowDefinition();
        if (!definition) return [];
        
        return definition.steps.map(stepId => {
          const stepDef = WORKFLOW_STEP_DEFINITIONS[stepId];
          if (!stepDef) return null;
          
          return {
            ...stepDef,
            isCompleted: state.completedSteps.includes(stepId),
            isActive: state.currentStep === stepId,
            isAvailable: state.isStepAvailable(stepId)
          };
        }).filter(Boolean) as WorkflowStep[];
      },
      
      getAvailableSteps: () => {
        const state = get();
        const definition = state.getCurrentWorkflowDefinition();
        if (!definition) return [];
        
        const available = [definition.steps[0]]; // First step always available
        
        // Add subsequent steps based on completed steps
        for (let i = 0; i < definition.steps.length - 1; i++) {
          const currentStepId = definition.steps[i];
          const nextStepId = definition.steps[i + 1];
          
          if (state.completedSteps.includes(currentStepId)) {
            available.push(nextStepId);
          }
        }
        
        return available;
      },
      
      isStepCompleted: (step: string) => {
        return get().completedSteps.includes(step);
      },
      
      isStepAvailable: (step: string) => {
        return get().getAvailableSteps().includes(step);
      }
    }),
    {
      name: "workflow-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentWorkflow: state.currentWorkflow,
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        breadcrumbs: state.breadcrumbs
      })
    }
  )
);

// Helper functions for workflow management
export function getWorkflowDefinition(workflowType: WorkflowType): WorkflowDefinition | null {
  return WORKFLOW_DEFINITIONS.find(w => w.id === workflowType) || null;
}

export function getStepDefinition(stepId: string): Omit<WorkflowStep, "isCompleted" | "isActive" | "isAvailable"> | null {
  return WORKFLOW_STEP_DEFINITIONS[stepId] || null;
}

export function getNextStep(currentStep: string, workflowType: WorkflowType): string | null {
  const definition = getWorkflowDefinition(workflowType);
  if (!definition) return null;
  
  const currentIndex = definition.steps.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex === definition.steps.length - 1) return null;
  
  return definition.steps[currentIndex + 1];
}

export function getPreviousStep(currentStep: string, workflowType: WorkflowType): string | null {
  const definition = getWorkflowDefinition(workflowType);
  if (!definition) return null;
  
  const currentIndex = definition.steps.indexOf(currentStep);
  if (currentIndex <= 0) return null;
  
  return definition.steps[currentIndex - 1];
}