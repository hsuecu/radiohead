import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import Slider from "@react-native-community/slider";
import { StandardButton } from "./StandardButton";
import UniversalAudioPreview from "./UniversalAudioPreview";
import { hapticFeedback } from "../utils/mobileOptimization";

export type SimpleBedData = {
  uri: string;
  name: string;
  durationMs: number;
  volume: number; // 0-100
  startTimeMs: number;
  endTimeMs: number;
  fadeInMs: number;
  fadeOutMs: number;
  playMode: "throughout" | "custom";
};

export type SimpleBedCardProps = {
  bedData: SimpleBedData;
  mainRecordingDurationMs: number;
  onUpdate: (data: Partial<SimpleBedData>) => void;
  onRemove: () => void;
  onTestMix?: () => void;
  mainSamples?: number[] | null;
  bedSamples?: number[] | null;
};

export default function SimpleBedCard({
  bedData,
  mainRecordingDurationMs,
  onUpdate,
  onRemove,
  onTestMix,
  mainSamples,
  bedSamples,
}: SimpleBedCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(bedData.playMode === "custom");


  // Load audio for preview
  useEffect(() => {
    let cancelled = false;

    const loadAudio = async () => {
      try {
        setIsLoading(true);
        const { sound: audioSound } = await Audio.Sound.createAsync(
          { uri: bedData.uri },
          { shouldPlay: false, volume: bedData.volume / 100 }
        );

        if (cancelled) {
          await audioSound.unloadAsync();
          return;
        }

        setSound(audioSound);
        audioSound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying || false);
          }
        });
      } catch (error) {
        console.error("Failed to load background music:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAudio();

    return () => {
      cancelled = true;
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [bedData.uri]);

  // Update sound volume when volume changes
  useEffect(() => {
    if (sound) {
      sound.setVolumeAsync(bedData.volume / 100).catch(() => {});
    }
  }, [sound, bedData.volume]);

  const togglePlayback = async () => {
    if (!sound || isLoading) return;

    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        if (isPlaying) {
          await sound.pauseAsync();
        } else {
          await sound.playAsync();
        }
        hapticFeedback.light();
      }
    } catch (error) {
      console.error("Playback error:", error);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handlePlayModeChange = (mode: "throughout" | "custom") => {
    onUpdate({ 
      playMode: mode,
      startTimeMs: mode === "throughout" ? 0 : bedData.startTimeMs,
      endTimeMs: mode === "throughout" ? mainRecordingDurationMs : bedData.endTimeMs,
    });
    setShowAdvanced(mode === "custom");
    hapticFeedback.selection();
  };



  return (
    <View className="bg-white rounded-xl border border-gray-200 p-4 mb-3 shadow-sm">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900 mb-1" numberOfLines={1}>
            {bedData.name}
          </Text>
          <Text className="text-sm text-gray-600">
            Duration: {formatTime(bedData.durationMs)} • Volume: {bedData.volume}%
          </Text>
        </View>
        <View className="flex-row items-center ml-3">
          <Pressable
            onPress={togglePlayback}
            disabled={isLoading}
            className={`w-10 h-10 rounded-full items-center justify-center mr-2 ${
              isLoading ? "bg-gray-200" : "bg-blue-500"
            }`}
          >
            <Ionicons 
              name={isLoading ? "hourglass" : isPlaying ? "pause" : "play"} 
              size={18} 
              color="white" 
            />
          </Pressable>
          <Pressable
            onPress={onRemove}
            className="w-10 h-10 rounded-full items-center justify-center bg-red-50"
          >
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
          </Pressable>
        </View>
      </View>

      {/* Visual Timeline - Main and Bed */}
      <View className="mb-4">
        <Text className="text-sm text-gray-600 mb-2">Main recording</Text>
        <UniversalAudioPreview
          samples={mainSamples || undefined}
          durationMs={mainRecordingDurationMs}
          height={42}
          color="#3B82F6"
          showTimeLabels={true}
          mode="static"
        />
        <Text className="text-sm text-gray-600 mt-3 mb-2">Background music</Text>
        <UniversalAudioPreview
          samples={bedSamples || undefined}
          durationMs={mainRecordingDurationMs}
          height={42}
          color="#8B5CF6"
          showTimeLabels={false}
          mode="static"
        />
      </View>

      {/* Volume Control */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="font-medium text-gray-700">Volume</Text>
          <Text className="text-gray-500">{bedData.volume}%</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="volume-low" size={16} color="#6B7280" />
          <Slider
            style={{ flex: 1, marginHorizontal: 12 }}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={bedData.volume}
            onValueChange={(value) => onUpdate({ volume: Math.round(value) })}
            minimumTrackTintColor="#8B5CF6"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#8B5CF6"
          />
          <Ionicons name="volume-high" size={16} color="#6B7280" />
        </View>
      </View>

      {/* Play Mode Selection */}
      <View className="mb-4">
        <Text className="font-medium text-gray-700 mb-3">Playback Mode</Text>
        <View className="space-y-2">
          <Pressable
            onPress={() => handlePlayModeChange("throughout")}
            className={`p-3 rounded-lg border-2 flex-row items-center ${
              bedData.playMode === "throughout" 
                ? "border-purple-500 bg-purple-50" 
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <View className={`w-4 h-4 rounded-full border-2 mr-3 ${
              bedData.playMode === "throughout" 
                ? "border-purple-500 bg-purple-500" 
                : "border-gray-300"
            }`}>
              {bedData.playMode === "throughout" && (
                <View className="w-2 h-2 rounded-full bg-white m-0.5" />
              )}
            </View>
            <View>
              <Text className={`font-medium ${
                bedData.playMode === "throughout" ? "text-purple-800" : "text-gray-800"
              }`}>
                Play throughout entire recording
              </Text>
              <Text className="text-sm text-gray-600">
                Background music plays from start to finish
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => handlePlayModeChange("custom")}
            className={`p-3 rounded-lg border-2 flex-row items-center ${
              bedData.playMode === "custom" 
                ? "border-purple-500 bg-purple-50" 
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <View className={`w-4 h-4 rounded-full border-2 mr-3 ${
              bedData.playMode === "custom" 
                ? "border-purple-500 bg-purple-500" 
                : "border-gray-300"
            }`}>
              {bedData.playMode === "custom" && (
                <View className="w-2 h-2 rounded-full bg-white m-0.5" />
              )}
            </View>
            <View>
              <Text className={`font-medium ${
                bedData.playMode === "custom" ? "text-purple-800" : "text-gray-800"
              }`}>
                Custom timing
              </Text>
              <Text className="text-sm text-gray-600">
                Set specific start and end times
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Positioning Controls */}
      {showAdvanced && (
        <View className="mb-4 p-3 bg-gray-50 rounded-lg">
          <Text className="font-medium text-gray-700 mb-3">Positioning</Text>
          
          {/* Start Slider */}
          <View className="mb-4">
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-600">Start</Text>
              <Text className="text-sm text-gray-800">{formatTime(bedData.startTimeMs)}</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 36 }}
              minimumValue={0}
              maximumValue={Math.max(0, bedData.endTimeMs - 1000)}
              value={bedData.startTimeMs}
              onValueChange={(v) => onUpdate({ startTimeMs: Math.min(Math.max(0, Math.round(v)), Math.max(0, bedData.endTimeMs - 1000)) })}
              minimumTrackTintColor="#8B5CF6"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#8B5CF6"
            />
          </View>

          {/* End Slider */}
          <View className="mb-4">
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-600">End</Text>
              <Text className="text-sm text-gray-800">{formatTime(bedData.endTimeMs)}</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 36 }}
              minimumValue={Math.min(mainRecordingDurationMs, bedData.startTimeMs + 1000)}
              maximumValue={mainRecordingDurationMs}
              value={bedData.endTimeMs}
              onValueChange={(v) => onUpdate({ endTimeMs: Math.max(Math.round(v), bedData.startTimeMs + 1000) })}
              minimumTrackTintColor="#8B5CF6"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#8B5CF6"
            />
          </View>

          {/* Fade In Slider */}
          <View className="mb-4">
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-600">Fade in</Text>
              <Text className="text-sm text-gray-800">{Math.round(bedData.fadeInMs / 1000)}s</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 36 }}
              minimumValue={0}
              maximumValue={Math.min(5000, Math.max(0, bedData.endTimeMs - bedData.startTimeMs))}
              value={bedData.fadeInMs}
              onValueChange={(v) => onUpdate({ fadeInMs: Math.round(v) })}
              minimumTrackTintColor="#8B5CF6"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#8B5CF6"
            />
          </View>

          {/* Fade Out Slider */}
          <View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-600">Fade out</Text>
              <Text className="text-sm text-gray-800">{Math.round(bedData.fadeOutMs / 1000)}s</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 36 }}
              minimumValue={0}
              maximumValue={Math.min(5000, Math.max(0, bedData.endTimeMs - bedData.startTimeMs))}
              value={bedData.fadeOutMs}
              onValueChange={(v) => onUpdate({ fadeOutMs: Math.round(v) })}
              minimumTrackTintColor="#8B5CF6"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#8B5CF6"
            />
          </View>
        </View>
      )}

      {/* Test Mix Button */}
      {onTestMix && (
        <StandardButton
          title="Test Mix (10s preview)"
          onPress={onTestMix}
          variant="secondary"
          icon="play-circle"
          fullWidth
        />
      )}
    </View>
  );
}