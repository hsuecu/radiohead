import React, { useEffect, useState } from "react";
import { View, Text, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRadioStore, useRadioPlaybackState } from "../state/radioStore";
import { cn } from "../utils/cn";

interface StreamHealthIndicatorProps {
  compact?: boolean;
  showDetails?: boolean;
}

export function StreamHealthIndicator({ compact = false, showDetails = true }: StreamHealthIndicatorProps) {
  const playbackState = useRadioPlaybackState();
  const connectionStatus = useRadioStore((s) => s.connectionStatus);
  const bufferHealth = useRadioStore((s) => s.bufferHealth);
  const [pulseAnimation] = useState(new Animated.Value(1));

  // Pulse animation for connection status
  useEffect(() => {
    if (connectionStatus === "connecting" || playbackState === "loading") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true
          })
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [connectionStatus, playbackState]);

  const getHealthStatus = () => {
    if (connectionStatus === "error" || playbackState === "error") {
      return { status: "error", color: "text-red-600", bgColor: "bg-red-100", icon: "alert-circle" as const };
    }
    if (connectionStatus === "connecting" || playbackState === "loading") {
      return { status: "connecting", color: "text-yellow-600", bgColor: "bg-yellow-100", icon: "hourglass-outline" as const };
    }
    if (playbackState === "playing") {
      if (bufferHealth > 80) {
        return { status: "excellent", color: "text-green-600", bgColor: "bg-green-100", icon: "checkmark-circle" as const };
      } else if (bufferHealth > 50) {
        return { status: "good", color: "text-yellow-600", bgColor: "bg-yellow-100", icon: "warning" as const };
      } else {
        return { status: "poor", color: "text-red-600", bgColor: "bg-red-100", icon: "alert-circle" as const };
      }
    }
    if (connectionStatus === "connected") {
      return { status: "ready", color: "text-blue-600", bgColor: "bg-blue-100", icon: "radio" as const };
    }
    return { status: "disconnected", color: "text-gray-500", bgColor: "bg-gray-100", icon: "radio-outline" as const };
  };

  const health = getHealthStatus();

  const getStatusText = () => {
    switch (health.status) {
      case "excellent": return "Excellent Connection";
      case "good": return "Good Connection";
      case "poor": return "Poor Connection";
      case "connecting": return "Connecting...";
      case "ready": return "Ready to Stream";
      case "error": return "Connection Error";
      default: return "Disconnected";
    }
  };

  if (compact) {
    return (
      <View className="flex-row items-center">
        <Animated.View style={{ opacity: pulseAnimation }}>
          <Ionicons name={health.icon} size={16} color={health.color.replace("text-", "#")} />
        </Animated.View>
        {showDetails && (
          <Text className={cn("text-xs ml-1", health.color)}>
            {health.status === "excellent" || health.status === "good" || health.status === "poor" 
              ? `${Math.round(bufferHealth)}%` 
              : getStatusText()}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View className={cn("rounded-lg p-3", health.bgColor)}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Animated.View style={{ opacity: pulseAnimation }}>
            <Ionicons name={health.icon} size={20} color={health.color.replace("text-", "#")} />
          </Animated.View>
          <Text className={cn("ml-2 font-medium", health.color)}>
            {getStatusText()}
          </Text>
        </View>
        
        {(playbackState === "playing" || playbackState === "buffering") && (
          <Text className={cn("text-sm", health.color)}>
            {Math.round(bufferHealth)}%
          </Text>
        )}
      </View>

      {showDetails && (playbackState === "playing" || playbackState === "buffering") && (
        <View className="mt-2">
          <View className="h-2 bg-white bg-opacity-50 rounded-full overflow-hidden">
            <View 
              className={cn(
                "h-full rounded-full",
                bufferHealth > 80 ? "bg-green-500" :
                bufferHealth > 50 ? "bg-yellow-500" :
                "bg-red-500"
              )}
              style={{ width: `${bufferHealth}%` }}
            />
          </View>
        </View>
      )}

      {health.status === "error" && showDetails && (
        <Text className="text-xs text-red-600 mt-1">
          Check stream URL and internet connection
        </Text>
      )}
    </View>
  );
}