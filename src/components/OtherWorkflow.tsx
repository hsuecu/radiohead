import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useWorkflowStore } from "../state/workflowStore";
import { cn } from "../utils/cn";

interface OtherWorkflowOption {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  comingSoon?: boolean;
  onPress?: () => void;
}

const OTHER_WORKFLOW_OPTIONS: OtherWorkflowOption[] = [
  {
    id: "import",
    title: "Import Audio",
    description: "Import audio files from external sources",
    icon: "download",
    color: "#8B5CF6",
    comingSoon: true
  },
  {
    id: "batch",
    title: "Batch Operations",
    description: "Process multiple files at once",
    icon: "layers",
    color: "#F59E0B",
    comingSoon: true
  },
  {
    id: "templates",
    title: "Audio Templates",
    description: "Create and manage audio templates",
    icon: "copy",
    color: "#EF4444",
    comingSoon: true
  },
  {
    id: "automation",
    title: "Automation Tools",
    description: "Set up automated audio processing",
    icon: "cog",
    color: "#06B6D4",
    comingSoon: true
  },
  {
    id: "analytics",
    title: "Usage Analytics",
    description: "View detailed usage statistics",
    icon: "analytics",
    color: "#10B981",
    comingSoon: true
  },
  {
    id: "backup",
    title: "Backup & Restore",
    description: "Manage your audio library backups",
    icon: "cloud-upload",
    color: "#6366F1",
    comingSoon: true
  },
  {
    id: "settings",
    title: "Advanced Settings",
    description: "Configure advanced audio settings",
    icon: "settings",
    color: "#64748B"
  },
  {
    id: "help",
    title: "Help & Tutorials",
    description: "Learn how to use all features",
    icon: "help-circle",
    color: "#84CC16"
  }
];

interface OtherWorkflowProps {
  onClose?: () => void;
  onOptionSelect?: (optionId: string) => void;
}

export default function OtherWorkflow({ onClose, onOptionSelect }: OtherWorkflowProps) {
  const navigation = useNavigation<any>();
  const { setCurrentStep, addBreadcrumb } = useWorkflowStore();
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [selectedOption, setSelectedOption] = useState<OtherWorkflowOption | null>(null);

  const handleOptionPress = (option: OtherWorkflowOption) => {
    if (option.comingSoon) {
      setSelectedOption(option);
      setShowComingSoonModal(true);
      return;
    }

    // Handle specific options
    switch (option.id) {
      case "settings":
        // Navigate to settings or show settings modal
        navigation.navigate("PlayoutSettings");
        break;
      case "help":
        // Could navigate to help screen or show help modal
        // For now, we'll show a simple modal
        setSelectedOption(option);
        setShowComingSoonModal(true);
        break;
      default:
        if (option.onPress) {
          option.onPress();
        }
        break;
    }

    // Update workflow state
    setCurrentStep("configure");
    addBreadcrumb(option.title, "configure");

    if (onOptionSelect) {
      onOptionSelect(option.id);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-6">
          {/* Header */}
          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1">
                <Text className="text-3xl font-bold text-gray-800 mb-2">
                  Other Tools
                </Text>
                <Text className="text-gray-600 text-lg">
                  Additional features and advanced tools
                </Text>
              </View>
              {onClose && (
                <Pressable 
                  onPress={onClose}
                  className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#374151" />
                </Pressable>
              )}
            </View>
          </View>

          {/* Options Grid */}
          <View className="space-y-4">
            {OTHER_WORKFLOW_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => handleOptionPress(option)}
                className={cn(
                  "bg-white rounded-2xl p-6 shadow-sm border-2 border-transparent",
                  "active:scale-95 active:bg-gray-50",
                  option.comingSoon && "opacity-75"
                )}
                style={{
                  shadowColor: option.color,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <View className="flex-row items-center">
                  {/* Icon */}
                  <View 
                    className="w-16 h-16 rounded-2xl items-center justify-center mr-4 shadow-sm"
                    style={{ backgroundColor: option.color }}
                  >
                    <Ionicons 
                      name={option.icon} 
                      size={28} 
                      color="white" 
                    />
                  </View>
                  
                  {/* Content */}
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-xl font-bold text-gray-800">
                        {option.title}
                      </Text>
                      {option.comingSoon && (
                        <View className="ml-2 px-2 py-1 rounded-full bg-amber-100">
                          <Text className="text-amber-800 text-xs font-medium">
                            Coming Soon
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-gray-600 text-base leading-5 mt-1">
                      {option.description}
                    </Text>
                  </View>
                  
                  {/* Arrow */}
                  <View className="ml-2">
                    <Ionicons 
                      name="chevron-forward" 
                      size={24} 
                      color="#9CA3AF" 
                    />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Footer */}
          <View className="mt-8 bg-white rounded-2xl p-6 shadow-sm">
            <View className="flex-row items-center mb-3">
              <Ionicons name="bulb" size={20} color="#F59E0B" />
              <Text className="text-lg font-semibold text-gray-800 ml-2">
                Need Something Else?
              </Text>
            </View>
            <Text className="text-gray-600 mb-4">
              Have an idea for a new feature or workflow? We'd love to hear from you!
            </Text>
            <Pressable className="bg-blue-500 rounded-lg p-3">
              <Text className="text-white text-center font-medium">
                Send Feedback
              </Text>
            </Pressable>
          </View>

          {/* Bottom Padding */}
          <View className="h-8" />
        </View>
      </ScrollView>

      {/* Coming Soon Modal */}
      <Modal
        visible={showComingSoonModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowComingSoonModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50 p-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
            {selectedOption && (
              <>
                <View className="items-center mb-4">
                  <View 
                    className="w-16 h-16 rounded-2xl items-center justify-center mb-3"
                    style={{ backgroundColor: selectedOption.color }}
                  >
                    <Ionicons 
                      name={selectedOption.icon} 
                      size={28} 
                      color="white" 
                    />
                  </View>
                  <Text className="text-xl font-bold text-gray-800 text-center">
                    {selectedOption.title}
                  </Text>
                </View>

                <Text className="text-gray-600 text-center mb-6">
                  {selectedOption.comingSoon 
                    ? "This feature is coming soon! We're working hard to bring you the best audio production tools."
                    : "This feature is currently being developed. Stay tuned for updates!"
                  }
                </Text>

                <View className="flex-row gap-3">
                  <Pressable 
                    onPress={() => setShowComingSoonModal(false)}
                    className="flex-1 bg-gray-200 rounded-lg p-3"
                  >
                    <Text className="text-center text-gray-700 font-medium">
                      Got it
                    </Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => {
                      setShowComingSoonModal(false);
                      // Could navigate to feedback or notification signup
                    }}
                    className="flex-1 bg-blue-500 rounded-lg p-3"
                  >
                    <Text className="text-center text-white font-medium">
                      Notify Me
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}