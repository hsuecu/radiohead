import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useUserStore } from "../state/userStore";
import { useWorkflowStore, WORKFLOW_DEFINITIONS, WorkflowType } from "../state/workflowStore";
import { cn } from "../utils/cn";

interface WorkflowWelcomeProps {
  onWorkflowSelect?: (workflow: WorkflowType) => void;
}

export default function WorkflowWelcome({ onWorkflowSelect }: WorkflowWelcomeProps) {
  const navigation = useNavigation<any>();
  const user = useUserStore((s) => s.user);
  const startWorkflow = useWorkflowStore((s) => s.startWorkflow);
  
  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const handleWorkflowSelect = (workflowType: WorkflowType) => {
    startWorkflow(workflowType);
    
    if (onWorkflowSelect) {
      onWorkflowSelect(workflowType);
      return;
    }

    // Default navigation logic
    switch (workflowType) {
      case "record":
        // Stay on current screen but switch to recording mode
        break;
      case "voice-track":
        navigation.navigate("VTRecord");
        break;
      case "edit":
        navigation.navigate("Main", { screen: "Files" });
        break;
      case "other":
        // Handle other workflow
        break;
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      <View className="p-6">
        {/* Welcome Header */}
        <View className="mb-8">
          <View className="items-center mb-6">
            <View 
              className="mb-4 rounded-full items-center justify-center shadow-lg" 
              style={{ width: 80, height: 80, backgroundColor: "#0EA5E9" }}
            >
              <Ionicons name="radio" size={40} color="white" />
            </View>
            <Text className="text-3xl font-bold text-gray-800 mb-2">
              {getGreeting()}, {user.name}!
            </Text>
            <Text className="text-gray-600 text-center text-lg">
              What would you like to create today?
            </Text>
          </View>
        </View>

        {/* Workflow Options */}
        <View className="space-y-4">
          {WORKFLOW_DEFINITIONS.map((workflow) => (
            <Pressable
              key={workflow.id}
              onPress={() => handleWorkflowSelect(workflow.id)}
              className={cn(
                "bg-white rounded-2xl p-6 shadow-sm border-2 border-transparent",
                "active:scale-95 active:bg-gray-50"
              )}
              style={{
                shadowColor: workflow.color,
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
                  style={{ backgroundColor: workflow.color }}
                >
                  <Ionicons 
                    name={workflow.icon as any} 
                    size={28} 
                    color="white" 
                  />
                </View>
                
                {/* Content */}
                <View className="flex-1">
                  <Text className="text-xl font-bold text-gray-800 mb-1">
                    {workflow.title}
                  </Text>
                  <Text className="text-gray-600 text-base leading-5">
                    {workflow.description}
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
              
              {/* Workflow Steps Preview */}
              <View className="mt-4 pt-4 border-t border-gray-100">
                <View className="flex-row items-center">
                  <Text className="text-sm text-gray-500 mr-3">Steps:</Text>
                  <View className="flex-row items-center flex-1">
                    {workflow.steps.slice(0, 4).map((step, stepIndex) => (
                      <View key={step} className="flex-row items-center">
                        <View 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: workflow.color, opacity: 0.6 }}
                        />
                        {stepIndex < Math.min(workflow.steps.length - 1, 3) && (
                          <View 
                            className="w-3 h-0.5 mx-1"
                            style={{ backgroundColor: workflow.color, opacity: 0.3 }}
                          />
                        )}
                      </View>
                    ))}
                    {workflow.steps.length > 4 && (
                      <Text className="text-xs text-gray-400 ml-2">
                        +{workflow.steps.length - 4} more
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Quick Stats */}
        <View className="mt-8 bg-white rounded-2xl p-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-800 mb-4">
            Quick Stats
          </Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-2xl font-bold text-blue-600">12</Text>
              <Text className="text-sm text-gray-600">This Week</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">45</Text>
              <Text className="text-sm text-gray-600">This Month</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-purple-600">2.3h</Text>
              <Text className="text-sm text-gray-600">Total Time</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View className="mt-6 bg-white rounded-2xl p-6 shadow-sm">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-800">
              Recent Activity
            </Text>
            <Pressable 
              onPress={() => navigation.navigate("Main", { screen: "Files" })}
              className="px-3 py-1 rounded-full bg-gray-100"
            >
              <Text className="text-sm text-gray-600">View All</Text>
            </Pressable>
          </View>
          
          <View className="space-y-3">
            {[
              { title: "Morning Show Intro", time: "2 hours ago", type: "record" },
              { title: "Weather Update", time: "Yesterday", type: "voice-track" },
              { title: "Station ID", time: "2 days ago", type: "edit" }
            ].map((item, index) => (
              <View key={index} className="flex-row items-center py-2">
                <View 
                  className="w-8 h-8 rounded-full items-center justify-center mr-3"
                  style={{ 
                    backgroundColor: WORKFLOW_DEFINITIONS.find(w => w.id === item.type)?.color + "20" 
                  }}
                >
                  <Ionicons 
                    name={WORKFLOW_DEFINITIONS.find(w => w.id === item.type)?.icon as any} 
                    size={16} 
                    color={WORKFLOW_DEFINITIONS.find(w => w.id === item.type)?.color} 
                  />
                </View>
                <View className="flex-1">
                  <Text className="font-medium text-gray-800">{item.title}</Text>
                  <Text className="text-sm text-gray-500">{item.time}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </View>
            ))}
          </View>
        </View>

        {/* Bottom Padding */}
        <View className="h-8" />
      </View>
    </ScrollView>
  );
}