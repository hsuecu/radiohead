import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRadioStore, useRadioPlaybackState, useRadioMetadata } from "../state/radioStore";
import { useStationStore } from "../state/stationStore";
import VUMeter from "./VUMeter";
import { cn } from "../utils/cn";
import { useRadioAudioManager } from "../utils/radioAudioManager";

interface RadioStreamPlayerProps {
  position?: "top" | "bottom";
  compact?: boolean;
  className?: string;
}

export function RadioStreamPlayer({ position = "bottom", compact = false, className }: RadioStreamPlayerProps) {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [volumeAnimation] = useState(new Animated.Value(0));
  const [pulseAnimation] = useState(new Animated.Value(1));
  const [connectionPulse] = useState(new Animated.Value(0.5));
  
  // Store selectors
  const currentStationId = useRadioStore((s) => s.currentStationId);
  const getCurrentStreamConfig = useRadioStore((s) => s.getCurrentStreamConfig);
  
  const playbackState = useRadioPlaybackState();
  const metadata = useRadioMetadata();
  const volume = useRadioStore((s) => s.volume);
  const muted = useRadioStore((s) => s.muted);
  const connectionStatus = useRadioStore((s) => s.connectionStatus);
  const bufferHealth = useRadioStore((s) => s.bufferHealth);
  
  const stations = useStationStore((state) => state.stations);
  const currentStation = currentStationId ? stations.find(s => s.id === currentStationId) : null;
  const streamConfig = getCurrentStreamConfig();

  // Show/hide volume slider animation
  useEffect(() => {
    Animated.timing(volumeAnimation, {
      toValue: showVolumeSlider ? 1 : 0,
      duration: 200,
      useNativeDriver: false
    }).start();
  }, [showVolumeSlider]);

  // Pulse animation for play button when playing
  useEffect(() => {
    if (playbackState === "playing") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true
          })
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [playbackState]);

  // Connection status pulse animation
  useEffect(() => {
    if (connectionStatus === "connecting" || playbackState === "loading") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(connectionPulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true
          }),
          Animated.timing(connectionPulse, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true
          })
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      connectionPulse.setValue(connectionStatus === "connected" ? 1 : 0.5);
    }
  }, [connectionStatus, playbackState]);

  const { playStream, pauseStream, stopStream, toggleStreamMute, setStreamVolume } = useRadioAudioManager();

  const handlePlayPause = () => {
    if (playbackState === "playing") {
      pauseStream();
    } else if (playbackState === "paused") {
      playStream();
    } else if (currentStationId) {
      playStream(currentStationId);
    }
  };

  const handleStop = () => {
    stopStream();
  };



  const getPlayButtonIcon = () => {
    switch (playbackState) {
      case "loading":
      case "buffering":
        return "hourglass-outline";
      case "playing":
        return "pause";
      case "paused":
        return "play";
      default:
        return "play";
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "text-green-500";
      case "connecting":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      default:
        return "text-gray-400";
    }
  };

  const formatMetadata = () => {
    if (metadata?.nowPlaying) return metadata.nowPlaying;
    if (metadata?.title && metadata?.artist) return `${metadata.artist} - ${metadata.title}`;
    if (metadata?.title) return metadata.title;
    if (streamConfig?.name) return streamConfig.name;
    if (currentStation?.name) return `${currentStation.name} Live`;
    return "No stream selected";
  };

  if (!currentStationId && playbackState === "stopped") {
    return null; // Hide player when no stream is active
  }

  return (
    <View className={cn(
      "bg-gray-900 border-t border-gray-700",
      position === "top" && "border-b border-t-0",
      compact ? "px-4 py-2" : "px-6 py-4",
      className
    )}>
      {/* Main Player Controls */}
      <View className="flex-row items-center justify-between">
        {/* Station Info & Metadata */}
        <View className="flex-1 mr-4">
          <View className="flex-row items-center mb-1">
            <Animated.View 
              className={cn("w-2 h-2 rounded-full mr-2", getConnectionStatusColor())}
              style={{ opacity: connectionPulse }}
            />
            <Text className="text-white font-semibold text-sm">
              {currentStation?.name || "Radio Stream"}
            </Text>
            {streamConfig?.quality && (
              <View className="ml-2 px-2 py-0.5 bg-gray-700 rounded">
                <Text className="text-gray-300 text-xs uppercase">
                  {streamConfig.quality}
                </Text>
              </View>
            )}
            {playbackState === "playing" && (
              <View className="ml-2 flex-row items-end">
                <View className="w-1 h-3 bg-green-400 rounded-full mr-0.5" />
                <View className="w-1 h-2 bg-green-400 rounded-full mr-0.5" />
                <View className="w-1 h-4 bg-green-400 rounded-full" />
              </View>
            )}
          </View>
          
          <Text className="text-gray-300 text-xs" numberOfLines={1}>
            {formatMetadata()}
          </Text>
          
          {/* Buffer Health Indicator */}
          {(playbackState === "buffering" || bufferHealth < 100) && (
            <View className="mt-1">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-xs text-gray-400">Buffer</Text>
                <Text className="text-xs text-gray-400">{Math.round(bufferHealth)}%</Text>
              </View>
              <View className="h-1 bg-gray-700 rounded-full overflow-hidden">
                <Animated.View 
                  className={cn(
                    "h-full rounded-full",
                    bufferHealth > 80 ? "bg-green-500" :
                    bufferHealth > 50 ? "bg-yellow-500" :
                    "bg-red-500"
                  )}
                  style={{ 
                    width: `${bufferHealth}%`,
                    opacity: playbackState === "buffering" ? connectionPulse : 1
                  }}
                />
              </View>
            </View>
          )}
        </View>

        {/* VU Meter (if playing) */}
        {!compact && playbackState === "playing" && (
          <View className="mr-4 w-10">
            <VUMeter 
              level={volume * 0.8} // Simulate VU level based on volume
              showScale={false}
            />
          </View>
        )}

        {/* Control Buttons */}
        <View className="flex-row items-center space-x-3">
          {/* Volume Control */}
          <Pressable
            onPress={() => setShowVolumeSlider(!showVolumeSlider)}
            className="p-2"
          >
            <Ionicons
              name={muted ? "volume-mute" : volume > 0.5 ? "volume-high" : "volume-low"}
              size={compact ? 20 : 24}
              color={muted ? "#ef4444" : "#ffffff"}
            />
          </Pressable>

          {/* Play/Pause Button */}
          <Animated.View style={{ transform: [{ scale: pulseAnimation }] }}>
            <Pressable
              onPress={handlePlayPause}
              disabled={playbackState === "loading" || connectionStatus === "connecting"}
              className={cn(
                "p-3 rounded-full",
                playbackState === "playing" ? "bg-red-600" : "bg-green-600",
                playbackState === "loading" && "bg-gray-600"
              )}
            >
              <Ionicons
                name={getPlayButtonIcon()}
                size={compact ? 20 : 24}
                color="#ffffff"
              />
            </Pressable>
          </Animated.View>

          {/* Stop Button */}
          <Pressable
            onPress={handleStop}
            disabled={playbackState === "stopped"}
            className="p-2"
          >
            <Ionicons
              name="stop"
              size={compact ? 20 : 24}
              color={playbackState === "stopped" ? "#6b7280" : "#ffffff"}
            />
          </Pressable>
        </View>
      </View>

      {/* Volume Slider (Animated) */}
      <Animated.View
        style={{
          height: volumeAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 60]
          }),
          opacity: volumeAnimation
        }}
        className="overflow-hidden"
      >
        <View className="pt-4 pb-2">
          <View className="flex-row items-center space-x-4">
            {/* Volume Down */}
            <Pressable onPress={() => setStreamVolume(Math.max(0, volume - 0.1))} className="p-1">
              <Ionicons name="remove" size={16} color="#9ca3af" />
            </Pressable>
            
            {/* Custom Volume Slider (display only) */}
            <View className="flex-1 h-6 justify-center">
              <View className="h-2 bg-gray-700 rounded-full">
                <View
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${volume * 100}%` }}
                />
              </View>
              <View className="absolute inset-0 justify-center">
                <View
                  className="w-4 h-4 bg-white rounded-full shadow-lg"
                  style={{
                    marginLeft: `${Math.max(0, Math.min(92, volume * 100 - 8))}%`
                  }}
                />
              </View>
            </View>
            
            {/* Volume Up */}
            <Pressable onPress={() => setStreamVolume(Math.min(1, volume + 0.1))} className="p-1">
              <Ionicons name="add" size={16} color="#9ca3af" />
            </Pressable>
            
            {/* Mute Toggle */}
            <Pressable onPress={toggleStreamMute} className="p-1">
              <Ionicons
                name={muted ? "volume-mute" : "volume-high"}
                size={16}
                color={muted ? "#ef4444" : "#9ca3af"}
              />
            </Pressable>
          </View>
          
          <Text className="text-center text-gray-400 text-xs mt-1">
            {Math.round(volume * 100)}%
          </Text>
        </View>
      </Animated.View>

      {/* Connection Status Details (when expanded) */}
      {showVolumeSlider && connectionStatus !== "connected" && (
        <View className="pt-2 border-t border-gray-700">
          <Text className={cn("text-xs text-center", getConnectionStatusColor())}>
            {connectionStatus === "connecting" && "Connecting to stream..."}
            {connectionStatus === "error" && "Connection failed - check stream URL"}
            {connectionStatus === "disconnected" && "Stream disconnected"}
          </Text>
        </View>
      )}
    </View>
  );
}