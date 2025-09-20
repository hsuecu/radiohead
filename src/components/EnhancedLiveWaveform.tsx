import React, { useMemo, useState, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import waveformManager from "../utils/waveformManager";

export type EnhancedLiveWaveformProps = {
  values: number[];
  height?: number;
  barWidth?: number;
  gap?: number;
  color?: string;
  showPeaks?: boolean;
  minBarHeight?: number;
  
  // Crop functionality
  cropMode?: boolean;
  cropStartMs?: number;
  cropEndMs?: number;
  onCropStartChange?: (ms: number) => void;
  onCropEndChange?: (ms: number) => void;
  
  // Playback functionality
  durationMs?: number;
  positionMs?: number;
  onSeek?: (ms: number) => void;
  audioUri?: string;
  showPlaybackControls?: boolean;
  
  // Visual options
  showTimeLabels?: boolean;
  title?: string;
  subtitle?: string;
};

export default function EnhancedLiveWaveform({ 
  values, 
  height = 64, 
  barWidth = 3, 
  gap = 1, 
  color = "#3B82F6",
  showPeaks = true,
  minBarHeight = 2,
  
  // Crop props
  cropMode = false,
  cropStartMs = 0,
  cropEndMs = 0,
  onCropStartChange,
  onCropEndChange,
  
  // Playback props
  durationMs = 0,
  positionMs = 0,
  onSeek,
  audioUri,
  showPlaybackControls = false,
  
  // Visual props
  showTimeLabels = false,
  title,
  subtitle
}: EnhancedLiveWaveformProps) {
  
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  
  // Optimize rendering by limiting bars and smoothing values
  const processedValues = useMemo(() => {
    if (!values || values.length === 0) {
      // Generate placeholder based on duration or default count
      const count = durationMs > 0 ? Math.min(150, Math.max(50, Math.floor(durationMs / 1000))) : 150;
      return waveformManager.generatePlaceholder(String(durationMs || Date.now()), count);
    }
    
    // Take appropriate number of values for performance
    const targetCount = cropMode ? 200 : 150; // More detail for crop mode
    const recent = values.length > targetCount ? values.slice(-targetCount) : values;
    
    // Apply smoothing to reduce jitter
    const smoothed = recent.map((value, index) => {
      if (index === 0) return value;
      const prev = recent[index - 1] || 0;
      // Simple exponential smoothing
      return prev * 0.3 + value * 0.7;
    });
    
    return smoothed;
  }, [values, durationMs, cropMode]);

  // Calculate peak detection for more dynamic visualization
  const barsData = useMemo(() => {
    return processedValues.map((v, i) => {
      // Ensure value is between 0 and 1
      const normalizedValue = Math.max(0, Math.min(1, v));
      
      // Apply logarithmic scaling for better visual representation
      const logValue = normalizedValue > 0 ? Math.log10(normalizedValue * 9 + 1) : 0;
      
      // Calculate bar height with minimum height
      const barHeight = Math.max(
        minBarHeight, 
        Math.min(height * 0.9, Math.floor(logValue * height * 0.9))
      );
      
      // Determine if this is a peak (higher than neighbors)
      const isPeak = showPeaks && (
        (i === 0 || normalizedValue > (processedValues[i - 1] || 0)) &&
        (i === processedValues.length - 1 || normalizedValue > (processedValues[i + 1] || 0))
      ) && normalizedValue > 0.3;
      
      return {
        height: barHeight,
        isPeak,
        value: normalizedValue
      };
    });
  }, [processedValues, height, minBarHeight, showPeaks]);
  
  // Calculate crop positions for visual overlay
  const cropPositions = useMemo(() => {
    if (!cropMode || !durationMs) return null;
    
    const totalWidth = processedValues.length * (barWidth + gap);
    const cropStartPosition = (cropStartMs / Math.max(1, durationMs)) * totalWidth;
    const cropEndPosition = (cropEndMs / Math.max(1, durationMs)) * totalWidth;
    const playheadPosition = (positionMs / Math.max(1, durationMs)) * totalWidth;
    
    return {
      totalWidth,
      cropStartPosition,
      cropEndPosition,
      playheadPosition
    };
  }, [cropMode, durationMs, cropStartMs, cropEndMs, positionMs, processedValues.length, barWidth, gap]);
  
  // Audio playback functions
  const loadAudio = async () => {
    if (!audioUri || sound) return;
    
    try {
      setIsLoading(true);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: false }
      );
      
      setSound(newSound);
      soundRef.current = newSound;
      
      // Set up playback status updates
      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
          if (onSeek && status.positionMillis !== undefined) {
            onSeek(status.positionMillis);
          }
        }
      });
      
    } catch (error) {
      console.error("Failed to load audio:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const togglePlayback = async () => {
    if (!sound) {
      await loadAudio();
      return;
    }
    
    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        if (isPlaying) {
          await sound.pauseAsync();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          // Start playback from crop start if in crop mode
          const startPosition = cropMode ? cropStartMs : positionMs;
          await sound.setPositionAsync(startPosition);
          await sound.playAsync();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
    } catch (error) {
      console.error("Playback error:", error);
    }
  };
  
  const handleSeek = async (ms: number) => {
    if (onSeek) {
      onSeek(ms);
    }
    
    if (sound) {
      try {
        await sound.setPositionAsync(ms);
      } catch (error) {
        console.error("Seek error:", error);
      }
    }
  };
  
  // Format time for display
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
  };
  
  // Cleanup audio on unmount
  React.useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  if (processedValues.length === 0) {
    // Show placeholder bars when no audio
    return (
      <View className="w-full">
        {(title || subtitle) && (
          <View className="mb-3">
            {title && <Text className="font-semibold text-gray-900 text-base">{title}</Text>}
            {subtitle && <Text className="text-sm text-gray-600 mt-1">{subtitle}</Text>}
          </View>
        )}
        
        <View style={{ height, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: barWidth,
                height: minBarHeight,
                backgroundColor: "#E5E7EB",
                marginRight: gap,
                borderRadius: 1,
                alignSelf: "center",
              }}
            />
          ))}
        </View>
        
        {showPlaybackControls && audioUri && (
          <View className="mt-3 items-center">
            <Pressable
              onPress={togglePlayback}
              className="w-12 h-12 rounded-full bg-blue-600 items-center justify-center"
              disabled={isLoading}
            >
              <Ionicons 
                name={isLoading ? "hourglass" : "play"} 
                size={24} 
                color="white" 
              />
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="w-full">
      {/* Header */}
      {(title || subtitle) && (
        <View className="mb-3">
          {title && <Text className="font-semibold text-gray-900 text-base">{title}</Text>}
          {subtitle && <Text className="text-sm text-gray-600 mt-1">{subtitle}</Text>}
        </View>
      )}
      
      {/* Waveform Visualization */}
      <View className="relative" style={{ height }}>
        <View style={{ 
          height, 
          overflow: "hidden", 
          flexDirection: "row", 
          alignItems: "center",
          paddingHorizontal: 4,
          width: cropPositions?.totalWidth || "100%"
        }}>
          {barsData.map((bar, i) => {
            const barPosition = i * (barWidth + gap);
            let barOpacity = 1;
            let barColor = bar.isPeak ? "#EF4444" : color;
            
            // Apply crop mode styling
            if (cropMode && cropPositions) {
              const isInCropRange = barPosition >= cropPositions.cropStartPosition && 
                                   barPosition <= cropPositions.cropEndPosition;
              barOpacity = isInCropRange ? 1 : 0.3;
            } else {
              barOpacity = bar.value > 0.05 ? 1 : 0.4;
            }
            
            return (
              <View
                key={`${i}-${processedValues.length}`}
                style={{
                  width: barWidth,
                  height: bar.height,
                  backgroundColor: barColor,
                  marginRight: gap,
                  borderRadius: 1,
                  alignSelf: "center",
                  opacity: barOpacity,
                }}
              />
            );
          })}
        </View>
        
        {/* Crop Mode Overlays */}
        {cropMode && cropPositions && (
          <>
            {/* Crop Selection Overlay */}
            <View
              className="absolute top-0 bottom-0 bg-yellow-200 opacity-20"
              style={{
                left: cropPositions.cropStartPosition + 4,
                width: Math.max(0, cropPositions.cropEndPosition - cropPositions.cropStartPosition),
              }}
            />
            
            {/* Crop Start Handle */}
            <View
              className="absolute top-0 bottom-0 w-1 bg-yellow-500"
              style={{ left: cropPositions.cropStartPosition + 4 }}
            />
            
            {/* Crop End Handle */}
            <View
              className="absolute top-0 bottom-0 w-1 bg-yellow-500"
              style={{ left: cropPositions.cropEndPosition + 4 }}
            />
          </>
        )}
        
        {/* Playhead */}
        {(positionMs > 0 || isPlaying) && cropPositions && (
          <View
            className="absolute top-0 bottom-0 w-0.5 bg-blue-600"
            style={{ left: cropPositions.playheadPosition + 4 }}
          />
        )}
      </View>
      
      {/* Crop Controls */}
      {cropMode && onCropStartChange && onCropEndChange && durationMs > 0 && (
        <View className="mt-4">
          {/* Crop Start Slider */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Start Time: {formatTime(cropStartMs)}
            </Text>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={Math.max(1, cropEndMs - 500)}
              value={cropStartMs}
              onValueChange={onCropStartChange}
              minimumTrackTintColor="#10B981"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#10B981"
            />
          </View>

          {/* Crop End Slider */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              End Time: {formatTime(cropEndMs)}
            </Text>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={Math.max(1, cropStartMs + 500)}
              maximumValue={durationMs}
              value={cropEndMs}
              onValueChange={onCropEndChange}
              minimumTrackTintColor="#EF4444"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#EF4444"
            />
          </View>

          {/* Selection Info */}
          <View className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-blue-700 text-xs">Selection</Text>
                <Text className="text-blue-800 text-sm font-medium">
                  {formatTime(cropEndMs - cropStartMs)}
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-blue-700 text-xs">Range</Text>
                <Text className="text-blue-800 text-sm font-medium">
                  {formatTime(cropStartMs)} - {formatTime(cropEndMs)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-blue-700 text-xs">Total</Text>
                <Text className="text-blue-800 text-sm font-medium">
                  {formatTime(durationMs)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
      
      {/* Playback Controls */}
      {showPlaybackControls && audioUri && (
        <View className="mt-4 items-center">
          <View className="flex-row items-center gap-4">
            <Pressable
              onPress={() => handleSeek(Math.max(0, positionMs - 5000))}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
            >
              <Ionicons name="play-back" size={20} color="#374151" />
            </Pressable>
            
            <Pressable
              onPress={togglePlayback}
              className="w-12 h-12 rounded-full bg-blue-600 items-center justify-center"
              disabled={isLoading}
            >
              <Ionicons 
                name={isLoading ? "hourglass" : isPlaying ? "pause" : "play"} 
                size={24} 
                color="white" 
              />
            </Pressable>
            
            <Pressable
              onPress={() => handleSeek(Math.min(durationMs, positionMs + 5000))}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
            >
              <Ionicons name="play-forward" size={20} color="#374151" />
            </Pressable>
          </View>
          
          {/* Time Display */}
          {showTimeLabels && durationMs > 0 && (
            <View className="flex-row justify-between w-full mt-3">
              <Text className="text-xs text-gray-500">{formatTime(positionMs)}</Text>
              <Text className="text-xs text-gray-500">{formatTime(durationMs)}</Text>
            </View>
          )}
        </View>
      )}
      
      {/* Simple Time Labels */}
      {showTimeLabels && !showPlaybackControls && durationMs > 0 && (
        <View className="flex-row justify-between mt-2">
          <Text className="text-xs text-gray-500">0:00</Text>
          <Text className="text-xs text-gray-500">{formatTime(durationMs)}</Text>
        </View>
      )}
    </View>
  );
}