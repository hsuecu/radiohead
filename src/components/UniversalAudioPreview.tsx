import React, { useMemo } from "react";
import { View, Text } from "react-native";
import EnhancedLiveWaveform from "./EnhancedLiveWaveform";
import waveformManager from "../utils/waveformManager";

export type UniversalAudioPreviewProps = {
  samples?: number[] | null;
  durationMs?: number;
  height?: number;
  barWidth?: number;
  gap?: number;
  color?: string;
  showPeaks?: boolean;
  minBarHeight?: number;
  showTimeLabels?: boolean;
  title?: string;
  subtitle?: string;
  mode?: "live" | "static" | "preview";
};

export default function UniversalAudioPreview({
  samples,
  durationMs = 60000,
  height = 64,
  barWidth = 3,
  gap = 1,
  color = "#3B82F6",
  showPeaks = true,
  minBarHeight = 2,
  showTimeLabels = false,
  title,
  subtitle,
  mode = "preview"
}: UniversalAudioPreviewProps) {
  
  // Process samples for consistent display
  const processedSamples = useMemo(() => {
    if (!samples || samples.length === 0) {
      // Generate placeholder based on duration
      return waveformManager.generatePlaceholder(String(durationMs), 150);
    }
    
    // For static mode, ensure we have a reasonable number of samples
    if (mode === "static" && samples.length > 300) {
      return waveformManager.generateFromLiveValues(samples, 150);
    }
    
    return samples;
  }, [samples, durationMs, mode]);
  
  // Format duration for display
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <View className="bg-gray-50 rounded-lg p-4">
      {/* Header */}
      {(title || subtitle) && (
        <View className="mb-3">
          {title && (
            <Text className="font-semibold text-gray-900 text-base">{title}</Text>
          )}
          {subtitle && (
            <Text className="text-sm text-gray-600 mt-1">{subtitle}</Text>
          )}
        </View>
      )}
      
      {/* Waveform */}
      <View className="bg-white rounded-md p-3 border border-gray-200">
        <EnhancedLiveWaveform
          values={processedSamples}
          height={height}
          barWidth={barWidth}
          gap={gap}
          color={color}
          showPeaks={showPeaks}
          minBarHeight={minBarHeight}
          durationMs={durationMs}
          showTimeLabels={showTimeLabels}
        />
        
        {/* Time Labels */}
        {showTimeLabels && (
          <View className="flex-row justify-between mt-2">
            <Text className="text-xs text-gray-500">0:00</Text>
            <Text className="text-xs text-gray-500">{formatDuration(durationMs)}</Text>
          </View>
        )}
      </View>
      
      {/* Footer Info */}
      {mode === "preview" && (
        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-xs text-gray-500">
            {processedSamples.length} samples
          </Text>
          <Text className="text-xs text-gray-500">
            {formatDuration(durationMs)}
          </Text>
        </View>
      )}
    </View>
  );
}