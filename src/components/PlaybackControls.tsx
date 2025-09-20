import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { IconButton } from "./StandardButton";

export interface PlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSkipBackward: (ms: number) => void;
  onSkipForward: (ms: number) => void;
  positionMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  showVolume?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export default function PlaybackControls({
  isPlaying,
  onTogglePlay,
  onSkipBackward,
  onSkipForward,
  positionMs,
  durationMs,
  onSeek,
  volume = 0.8,
  onVolumeChange,
  showVolume = true,
  disabled = false,
  compact = false,
}: PlaybackControlsProps) {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };
  
  const buttonSize = compact ? "small" : "medium";
  const playButtonSize = compact ? "medium" : "large";
  
  return (
    <View>
      {/* Transport Controls */}
      <View className="flex-row items-center justify-center gap-4 mb-4">
        <IconButton
          icon="play-skip-back"
          onPress={() => onSkipBackward(compact ? 5000 : 15000)}
          variant="secondary"
          size={buttonSize}
          disabled={disabled}
        />
        
        <IconButton
          icon="play-back"
          onPress={() => onSkipBackward(compact ? 1000 : 5000)}
          variant="secondary"
          size={buttonSize}
          disabled={disabled}
        />
        
        <IconButton
          icon={isPlaying ? "pause" : "play"}
          onPress={onTogglePlay}
          variant="primary"
          size={playButtonSize}
          disabled={disabled}
        />
        
        <IconButton
          icon="play-forward"
          onPress={() => onSkipForward(compact ? 1000 : 5000)}
          variant="secondary"
          size={buttonSize}
          disabled={disabled}
        />
        
        <IconButton
          icon="play-skip-forward"
          onPress={() => onSkipForward(compact ? 5000 : 15000)}
          variant="secondary"
          size={buttonSize}
          disabled={disabled}
        />
      </View>
      
      {/* Time Display and Scrubber */}
      <View>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-gray-500 text-sm">
            {formatTime(positionMs)}
          </Text>
          <Text className="text-gray-500 text-sm">
            {formatTime(durationMs)}
          </Text>
        </View>
        
        <Slider
          style={{ width: "100%" }}
          minimumValue={0}
          maximumValue={Math.max(durationMs, 1)}
          value={Math.min(positionMs, durationMs)}
          onSlidingComplete={onSeek}
          disabled={disabled}
          minimumTrackTintColor="#3B82F6"
          maximumTrackTintColor="#E5E7EB"
          thumbTintColor="#3B82F6"
        />
      </View>
      
      {/* Volume Control */}
      {showVolume && onVolumeChange && (
        <View className="mt-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="font-medium text-gray-700">Volume</Text>
            <Text className="text-gray-500">{Math.round(volume * 100)}%</Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="volume-low" size={20} color="#6B7280" />
            <Slider
              style={{ flex: 1, marginHorizontal: 12 }}
              minimumValue={0}
              maximumValue={1}
              value={volume}
              onValueChange={onVolumeChange}
              disabled={disabled}
              minimumTrackTintColor="#3B82F6"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#3B82F6"
            />
            <Ionicons name="volume-high" size={20} color="#6B7280" />
          </View>
        </View>
      )}
    </View>
  );
}