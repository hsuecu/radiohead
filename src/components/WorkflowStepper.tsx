import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WorkflowType } from "../state/workflowStore";

export type WorkflowStep = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  isCompleted: boolean;
  isActive: boolean;
  isAvailable: boolean;
};

export type BreadcrumbItem = {
  title: string;
  step?: string;
  workflow?: WorkflowType;
};

export type WorkflowStepperProps = {
  steps: WorkflowStep[];
  onStepPress: (stepId: string) => void;
  compact?: boolean;
  showBreadcrumbs?: boolean;
  breadcrumbs?: BreadcrumbItem[];
  onBreadcrumbPress?: (breadcrumb: BreadcrumbItem, index: number) => void;
  workflowColor?: string;
};

const WORKFLOW_STEPS: Omit<WorkflowStep, "isCompleted" | "isActive" | "isAvailable">[] = [
  {
    id: "record",
    title: "Record",
    description: "Select input and record audio clip",
    icon: "mic",
  },
  {
    id: "preview",
    title: "Preview",
    description: "Listen to your recording",
    icon: "play",
  },
  {
    id: "choice",
    title: "Choose Workflow",
    description: "Crop & edit or save as-is",
    icon: "git-branch",
  },
  {
    id: "trim",
    title: "Trim/Crop",
    description: "Trim and crop audio clip (crop workflow)",
    icon: "cut",
  },
  {
    id: "save",
    title: "Save & Categorize",
    description: "Save and categorize recording",
    icon: "save",
  },
  {
    id: "voice",
    title: "Voice Change",
    description: "Apply voice effects (optional)",
    icon: "person",
  },
  {
    id: "multitrack",
    title: "Multitrack & Mix",
    description: "Add beds and additional audio",
    icon: "layers",
  },
  {
    id: "enhance",
    title: "Enhance Audio",
    description: "EQ, normalize, and enhance",
    icon: "options",
  },
  {
    id: "mixdown",
    title: "Mixdown",
    description: "Combine tracks to single file (optional)",
    icon: "layers",
  },
  {
    id: "export",
    title: "Export",
    description: "Export final audio",
    icon: "share",
  },
];

// Breadcrumb Navigation Component
export function BreadcrumbNavigation({
  breadcrumbs,
  onBreadcrumbPress,
  workflowColor = "#3B82F6"
}: {
  breadcrumbs: BreadcrumbItem[];
  onBreadcrumbPress?: (breadcrumb: BreadcrumbItem, index: number) => void;
  workflowColor?: string;
}) {
  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  return (
    <View className="bg-white border-b border-gray-200 px-4 py-3">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="flex-row"
      >
        {breadcrumbs.map((breadcrumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const isClickable = onBreadcrumbPress && !isLast;
          
          return (
            <View key={index} className="flex-row items-center">
              <Pressable
                onPress={() => isClickable && onBreadcrumbPress(breadcrumb, index)}
                disabled={!isClickable}
                className={`px-2 py-1 rounded ${isClickable ? 'active:bg-gray-100' : ''}`}
              >
                <Text 
                  className={`text-sm ${
                    isLast 
                      ? 'font-semibold' 
                      : isClickable 
                        ? 'text-blue-600' 
                        : 'text-gray-600'
                  }`}
                  style={isLast ? { color: workflowColor } : {}}
                >
                  {breadcrumb.title}
                </Text>
              </Pressable>
              
              {!isLast && (
                <Ionicons 
                  name="chevron-forward" 
                  size={14} 
                  color="#9CA3AF" 
                  style={{ marginHorizontal: 4 }}
                />
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function WorkflowStepper({
  steps,
  onStepPress,
  compact = false,
  showBreadcrumbs = false,
  breadcrumbs = [],
  onBreadcrumbPress,
  workflowColor = "#3B82F6"
}: WorkflowStepperProps) {
  
  // Render breadcrumbs if enabled
  const breadcrumbComponent = showBreadcrumbs ? (
    <BreadcrumbNavigation 
      breadcrumbs={breadcrumbs}
      onBreadcrumbPress={onBreadcrumbPress}
      workflowColor={workflowColor}
    />
  ) : null;

  if (compact) {
    return (
      <View>
        {breadcrumbComponent}
        <View className="flex-row items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            
            return (
              <View key={step.id} className="flex-row items-center flex-1">
                <Pressable
                  onPress={() => step.isAvailable && onStepPress(step.id)}
                  disabled={!step.isAvailable}
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    step.isCompleted
                      ? "bg-green-500"
                      : step.isActive
                      ? "bg-blue-500"
                      : step.isAvailable
                      ? "bg-gray-300"
                      : "bg-gray-200"
                  }`}
                >
                  {step.isCompleted ? (
                    <Ionicons name="checkmark" size={16} color="white" />
                  ) : (
                    <Ionicons
                      name={step.icon}
                      size={14}
                      color={
                        step.isActive
                          ? "white"
                          : step.isAvailable
                          ? "#374151"
                          : "#9CA3AF"
                      }
                    />
                  )}
                </Pressable>
                
                {!isLast && (
                  <View
                    className={`flex-1 h-0.5 mx-2 ${
                      step.isCompleted ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View>
      {breadcrumbComponent}
      <View className="bg-white border-b border-gray-200">
        <View className="px-4 py-3">
          <Text className="text-lg font-semibold text-gray-800 mb-2">
            Audio Production Workflow
          </Text>
          
          <View className="space-y-3">
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              
              return (
                <View key={step.id}>
                  <Pressable
                    onPress={() => step.isAvailable && onStepPress(step.id)}
                    disabled={!step.isAvailable}
                    className={`flex-row items-center p-3 rounded-lg ${
                      step.isActive
                        ? "bg-blue-50 border-2 border-blue-200"
                        : step.isCompleted
                        ? "bg-green-50 border border-green-200"
                        : step.isAvailable
                        ? "bg-gray-50 border border-gray-200"
                        : "bg-gray-100 border border-gray-200 opacity-50"
                    }`}
                  >
                    {/* Step Icon */}
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                        step.isCompleted
                          ? "bg-green-500"
                          : step.isActive
                          ? "bg-blue-500"
                          : step.isAvailable
                          ? "bg-gray-300"
                          : "bg-gray-200"
                      }`}
                    >
                      {step.isCompleted ? (
                        <Ionicons name="checkmark" size={20} color="white" />
                      ) : (
                        <Ionicons
                          name={step.icon}
                          size={18}
                          color={
                            step.isActive
                              ? "white"
                              : step.isAvailable
                              ? "#374151"
                              : "#9CA3AF"
                          }
                        />
                      )}
                    </View>
                    
                    {/* Step Content */}
                    <View className="flex-1">
                      <Text
                        className={`font-semibold ${
                          step.isActive
                            ? "text-blue-800"
                            : step.isCompleted
                            ? "text-green-800"
                            : step.isAvailable
                            ? "text-gray-800"
                            : "text-gray-500"
                        }`}
                      >
                        {index + 1}. {step.title}
                      </Text>
                      <Text
                        className={`text-sm ${
                          step.isActive
                            ? "text-blue-600"
                            : step.isCompleted
                            ? "text-green-600"
                            : step.isAvailable
                            ? "text-gray-600"
                            : "text-gray-400"
                        }`}
                      >
                        {step.description}
                      </Text>
                    </View>
                    
                    {/* Step Status */}
                    {step.isActive && (
                      <View className="ml-2">
                        <Ionicons name="chevron-forward" size={16} color="#3B82F6" />
                      </View>
                    )}
                  </Pressable>
                  
                  {/* Connection Line */}
                  {!isLast && (
                    <View className="flex-row items-center ml-8 py-1">
                      <View
                        className={`w-0.5 h-4 ${
                          step.isCompleted ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

export function createWorkflowSteps(
  currentStep: string,
  completedSteps: string[],
  availableSteps: string[],
  workflowChoice?: "crop" | "save"
): WorkflowStep[] {
  return WORKFLOW_STEPS.map((step) => {
    let isAvailable = availableSteps.includes(step.id);
    
    // Hide steps that don't apply to the chosen workflow
    if (workflowChoice === "save" && step.id === "trim") {
      isAvailable = false;
    }
    
    return {
      ...step,
      isCompleted: completedSteps.includes(step.id),
      isActive: currentStep === step.id,
      isAvailable,
    };
  }).filter(step => {
    // Filter out steps that shouldn't be shown for the current workflow
    if (workflowChoice === "save" && step.id === "trim") {
      return false;
    }
    return true;
  });
}

// Workflow state management helpers
export function getNextAvailableStep(
  currentStep: string,
  _completedSteps: string[]
): string | null {
  const currentIndex = WORKFLOW_STEPS.findIndex(s => s.id === currentStep);
  if (currentIndex === -1 || currentIndex === WORKFLOW_STEPS.length - 1) {
    return null;
  }
  
  return WORKFLOW_STEPS[currentIndex + 1].id;
}

export function getPreviousStep(currentStep: string): string | null {
  const currentIndex = WORKFLOW_STEPS.findIndex(s => s.id === currentStep);
  if (currentIndex <= 0) {
    return null;
  }
  
  return WORKFLOW_STEPS[currentIndex - 1].id;
}

export function getAvailableSteps(completedSteps: string[], workflowChoice?: "crop" | "save"): string[] {
  const available = ["record"]; // Always available
  
  if (completedSteps.includes("record")) {
    available.push("preview");
  }
  
  if (completedSteps.includes("preview")) {
    available.push("choice");
  }
  
  // Branching logic based on workflow choice
  if (completedSteps.includes("choice")) {
    if (workflowChoice === "crop") {
      available.push("trim");
      if (completedSteps.includes("trim")) {
        available.push("save");
      }
    } else if (workflowChoice === "save") {
      available.push("save");
    }
  }
  
  if (completedSteps.includes("save")) {
    available.push("voice", "multitrack", "enhance", "export");
  }
  
  // Mixdown only available if multitrack is used
  if (completedSteps.includes("multitrack")) {
    available.push("mixdown");
  }
  
  return available;
}

export function isStepRequired(stepId: string, workflowChoice?: "crop" | "save"): boolean {
  const baseRequired = ["record", "choice", "save", "export"];
  
  if (workflowChoice === "crop") {
    return [...baseRequired, "trim"].includes(stepId);
  }
  
  return baseRequired.includes(stepId);
}

export function isStepOptional(stepId: string): boolean {
  return ["voice", "multitrack", "enhance", "mixdown"].includes(stepId);
}

export function getWorkflowDescription(workflowChoice?: "crop" | "save"): string {
  if (workflowChoice === "crop") {
    return "Crop & Edit Workflow - Trim your recording and apply effects";
  } else if (workflowChoice === "save") {
    return "Save As-Is Workflow - Save your recording without editing";
  }
  return "Choose your workflow after recording";
}