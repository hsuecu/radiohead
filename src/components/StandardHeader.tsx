import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface StandardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBackgroundColor?: string;
  showDebugToggle?: boolean;
  debugActive?: boolean;
  onDebugToggle?: () => void;
  debugInfo?: React.ReactNode;
  rightAction?: {
    icon?: keyof typeof Ionicons.glyphMap;
    label?: string;
    onPress: () => void;
    variant?: "primary" | "secondary" | "ghost";
  };
  compact?: boolean;
}

export default function StandardHeader({
  title,
  subtitle,
  icon = "radio",
  iconColor = "white",
  iconBackgroundColor = "#3B82F6",
  showDebugToggle = false,
  debugActive = false,
  onDebugToggle,
  debugInfo,
  rightAction,
  compact = false,
}: StandardHeaderProps) {
  return (
    <View className={`bg-white border-b border-gray-200 ${compact ? "px-4 py-2" : "px-6 py-4"}`}>
      {/* Main Header Row */}
      <View className={`flex-row items-center justify-between ${compact ? "mb-2" : "mb-3"}`}>
        <View className="flex-1 flex-row items-center">
          {/* Icon */}
          <View 
            className={`rounded-full items-center justify-center shadow-sm ${compact ? "mr-3" : "mr-4"}`} 
            style={{ 
              width: compact ? 48 : 64, 
              height: compact ? 48 : 64, 
              backgroundColor: iconBackgroundColor 
            }}
          >
            <Ionicons name={icon} size={compact ? 24 : 34} color={iconColor} />
          </View>
          
          {/* Title and Subtitle */}
          <View className="flex-1">
            <Text className={`font-bold text-gray-800 ${compact ? "text-xl" : "text-2xl"}`}>{title}</Text>
            {subtitle && (
              <Text className={`text-gray-600 ${compact ? "text-sm mt-0.5" : "mt-1"}`}>{subtitle}</Text>
            )}
          </View>
        </View>
        
        {/* Right Actions */}
        <View className="flex-row items-center">
          {showDebugToggle && (
            <Pressable 
              onPress={onDebugToggle} 
              className="px-3 py-1 rounded-full bg-gray-200 mr-2"
            >
              <Text className="text-gray-700 text-xs">Debug</Text>
            </Pressable>
          )}
          
          {rightAction && (
            <Pressable 
              onPress={rightAction.onPress}
              className={`px-3 py-2 rounded-lg flex-row items-center ${
                rightAction.variant === "primary" ? "bg-blue-500" :
                rightAction.variant === "secondary" ? "bg-gray-200" :
                "bg-transparent"
              }`}
            >
              {rightAction.icon && (
                <Ionicons 
                  name={rightAction.icon} 
                  size={16} 
                  color={
                    rightAction.variant === "primary" ? "white" :
                    rightAction.variant === "secondary" ? "#374151" :
                    "#6B7280"
                  }
                />
              )}
              {rightAction.label && (
                <Text className={`text-sm font-medium ${
                  rightAction.icon ? "ml-2" : ""
                } ${
                  rightAction.variant === "primary" ? "text-white" :
                  rightAction.variant === "secondary" ? "text-gray-700" :
                  "text-gray-600"
                }`}>
                  {rightAction.label}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
      
      {/* Debug Info */}
      {debugActive && debugInfo && (
        <View className="mt-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
          {debugInfo}
        </View>
      )}
    </View>
  );
}