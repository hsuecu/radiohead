import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type ZoomPreset = {
  label: string;
  pixelsPerMs: number;
};

export type ZoomControlsProps = {
  pixelsPerMs: number;
  onZoomChange: (newPixelsPerMs: number) => void;
  onFitToWindow: () => void;
  onToggleSnap: () => void;
  snapEnabled: boolean;
  zoomPresets?: ZoomPreset[];
  onFitSelection?: () => void;
  onToggleFollow?: () => void;
  followEnabled?: boolean;
};

export default function ZoomControls({
  pixelsPerMs,
  onZoomChange,
  onFitToWindow,
  onToggleSnap,
  snapEnabled,
  zoomPresets = [],
  onFitSelection,
  onToggleFollow,
  followEnabled = false,
}: ZoomControlsProps) {
  const zoomIn = () => {
    onZoomChange(Math.min(1.0, pixelsPerMs * 1.5));
  };

  const zoomOut = () => {
    onZoomChange(Math.max(0.01, pixelsPerMs / 1.5));
  };

  const getZoomLabel = () => {
    if (pixelsPerMs >= 0.5) return "High";
    if (pixelsPerMs >= 0.1) return "Medium";
    if (pixelsPerMs >= 0.05) return "Low";
    return "Very Low";
  };

  return (
    <View className="px-3 py-2 bg-gray-100 border-b border-gray-200">
      {/* Mobile-friendly zoom presets */}
      {zoomPresets.length > 0 ? (
        <View className="flex-row items-center justify-between">
          <Text className="text-gray-600 text-sm font-medium">View:</Text>
          <View className="flex-row gap-1">
            {zoomPresets.map((preset, index) => (
              <Pressable
                key={index}
                onPress={() => onZoomChange(preset.pixelsPerMs)}
                className={`px-3 py-1 rounded-lg ${
                  Math.abs(pixelsPerMs - preset.pixelsPerMs) < 0.001
                    ? "bg-blue-600"
                    : "bg-gray-300"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    Math.abs(pixelsPerMs - preset.pixelsPerMs) < 0.001
                      ? "text-white"
                      : "text-gray-700"
                  }`}
                >
                  {preset.label}
                </Text>
              </Pressable>
            ))}
          </View>
          
          <View className="flex-row items-center gap-1">
            <Pressable
              onPress={onFitSelection}
              className="px-2 py-1 rounded-lg bg-blue-500"
            >
              <Text className="text-white text-xs">Fit</Text>
            </Pressable>
            <Pressable
              onPress={onToggleFollow}
              className={`px-2 py-1 rounded-lg ${followEnabled ? "bg-purple-600" : "bg-gray-300"}`}
            >
              <Ionicons name="play-forward-circle" size={16} color={followEnabled ? "#FFFFFF" : "#6B7280"} />
            </Pressable>
            <Pressable
              onPress={onToggleSnap}
              className={`px-2 py-1 rounded-lg ${
                snapEnabled ? "bg-green-600" : "bg-gray-300"
              }`}
            >
              <Ionicons 
                name="grid-outline" 
                size={16} 
                color={snapEnabled ? "#FFFFFF" : "#6B7280"} 
              />
            </Pressable>
          </View>
        </View>
      ) : (
        // Fallback to traditional zoom controls
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Pressable
              onPress={zoomOut}
              className="px-3 py-1 bg-gray-300 rounded-l-lg"
            >
              <Ionicons name="remove" size={16} color="#4B5563" />
            </Pressable>
            
            <View className="px-3 py-1 bg-gray-200">
              <Text className="text-gray-700 text-sm min-w-[50px] text-center">
                {getZoomLabel()}
              </Text>
            </View>
            
            <Pressable
              onPress={zoomIn}
              className="px-3 py-1 bg-gray-300 rounded-r-lg"
            >
              <Ionicons name="add" size={16} color="#4B5563" />
            </Pressable>
          </View>

          <Pressable
            onPress={onToggleSnap}
            className={`px-2 py-1 rounded-lg ${
              snapEnabled ? "bg-green-600" : "bg-gray-300"
            }`}
          >
            <Ionicons 
              name="grid-outline" 
              size={16} 
              color={snapEnabled ? "#FFFFFF" : "#6B7280"} 
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}