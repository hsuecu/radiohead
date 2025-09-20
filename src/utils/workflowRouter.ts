import { useNavigation } from "@react-navigation/native";
import { useWorkflowStore, WorkflowType, getWorkflowDefinition } from "../state/workflowStore";

export interface WorkflowRouter {
  navigateToWorkflow: (workflowType: WorkflowType) => void;
  navigateToStep: (stepId: string) => void;
  goBack: () => boolean;
  canGoBack: () => boolean;
}

export function useWorkflowRouter(): WorkflowRouter {
  const navigation = useNavigation<any>();
  const {
    currentWorkflow,
    setCurrentStep,
    addBreadcrumb,
    goBackInWorkflow,
    breadcrumbs,
    startWorkflow
  } = useWorkflowStore();

  const navigateToWorkflow = (workflowType: WorkflowType) => {
    const definition = getWorkflowDefinition(workflowType);
    if (!definition) return;

    startWorkflow(workflowType);

    switch (workflowType) {
      case "record":
        // Stay on current screen (RecordingScreen)
        // The RecordingScreen will handle the workflow internally
        break;
        
      case "voice-track":
        // Navigate to VT Recorder with workflow context
        navigation.navigate("VTRecord", { 
          workflowType,
          fromWorkflow: true 
        });
        break;
        
      case "edit":
        // Navigate to file manager for file selection
        navigation.navigate("Main", { 
          screen: "Files",
          params: { 
            workflowType,
            selectMode: true,
            title: "Select File to Edit"
          }
        });
        break;
        
      case "other":
        // Could navigate to a dedicated "Other" screen or show modal
        // For now, we'll handle this in the component
        break;
    }
  };

  const navigateToStep = (stepId: string) => {
    if (!currentWorkflow) return;

    const definition = getWorkflowDefinition(currentWorkflow);
    if (!definition || !definition.steps.includes(stepId)) return;

    setCurrentStep(stepId);

    // Handle step-specific navigation
    switch (currentWorkflow) {
      case "record":
        handleRecordWorkflowStep(stepId);
        break;
      case "voice-track":
        handleVoiceTrackWorkflowStep(stepId);
        break;
      case "edit":
        handleEditWorkflowStep(stepId);
        break;
      case "other":
        handleOtherWorkflowStep(stepId);
        break;
    }
  };

  const handleRecordWorkflowStep = (stepId: string) => {
    switch (stepId) {
      case "setup":
        // Stay on recording screen, show setup UI
        addBreadcrumb("Setup", stepId);
        break;
      case "record":
        // Stay on recording screen, show recording UI
        addBreadcrumb("Record", stepId);
        break;
      case "preview":
        // Stay on recording screen, show preview UI
        addBreadcrumb("Preview", stepId);
        break;
      case "crop":
        // Stay on recording screen, show crop UI
        addBreadcrumb("Crop", stepId);
        break;
      case "save":
        // Stay on recording screen, show save UI
        addBreadcrumb("Save", stepId);
        break;
    }
  };

  const handleVoiceTrackWorkflowStep = (stepId: string) => {
    switch (stepId) {
      case "setup":
        // Ensure we're on VT Recorder screen
        if (navigation.getCurrentRoute()?.name !== "VTRecord") {
          navigation.navigate("VTRecord");
        }
        addBreadcrumb("Setup", stepId);
        break;
      case "record":
        addBreadcrumb("Record", stepId);
        break;
      case "carts":
        addBreadcrumb("Carts", stepId);
        break;
      case "mix":
        navigation.navigate("VTMix");
        addBreadcrumb("Mix", stepId);
        break;
      case "export":
        addBreadcrumb("Export", stepId);
        break;
    }
  };

  const handleEditWorkflowStep = (stepId: string) => {
    switch (stepId) {
      case "select":
        // Navigate to file manager
        navigation.navigate("Main", { 
          screen: "Files",
          params: { 
            workflowType: "edit",
            selectMode: true 
          }
        });
        addBreadcrumb("Select File", stepId);
        break;
      case "edit":
        // Navigate to audio editor
        navigation.navigate("Main", { screen: "Edit" });
        addBreadcrumb("Edit", stepId);
        break;
      case "enhance":
        // Stay on editor, show enhancement tools
        addBreadcrumb("Enhance", stepId);
        break;
      case "save":
        // Show save dialog
        addBreadcrumb("Save", stepId);
        break;
    }
  };

  const handleOtherWorkflowStep = (stepId: string) => {
    switch (stepId) {
      case "select-action":
        addBreadcrumb("Select Action", stepId);
        break;
      case "configure":
        addBreadcrumb("Configure", stepId);
        break;
      case "execute":
        addBreadcrumb("Execute", stepId);
        break;
    }
  };

  const goBack = (): boolean => {
    if (breadcrumbs.length <= 1) {
      // If we're at the root, go back to workflow selection
      return false;
    }

    const previousStep = goBackInWorkflow();
    if (previousStep) {
      navigateToStep(previousStep);
      return true;
    }

    return false;
  };

  const canGoBack = (): boolean => {
    return breadcrumbs.length > 1;
  };

  return {
    navigateToWorkflow,
    navigateToStep,
    goBack,
    canGoBack
  };
}

// Helper function to get workflow-specific colors
export function getWorkflowColor(workflowType: WorkflowType): string {
  const definition = getWorkflowDefinition(workflowType);
  return definition?.color || "#3B82F6";
}

// Helper function to check if a workflow step requires navigation
export function stepRequiresNavigation(workflowType: WorkflowType, stepId: string): boolean {
  switch (workflowType) {
    case "voice-track":
      return stepId === "mix"; // Mix step navigates to VTMix screen
    case "edit":
      return stepId === "select" || stepId === "edit"; // These steps navigate to different screens
    default:
      return false; // Record workflow stays on same screen
  }
}

// Helper function to get the target screen for a workflow step
export function getStepTargetScreen(workflowType: WorkflowType, stepId: string): string | null {
  if (!stepRequiresNavigation(workflowType, stepId)) return null;

  switch (workflowType) {
    case "voice-track":
      if (stepId === "mix") return "VTMix";
      break;
    case "edit":
      if (stepId === "select") return "Files";
      if (stepId === "edit") return "Edit";
      break;
  }

  return null;
}