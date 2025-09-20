import React from "react";
import { View, Text } from "react-native";
import Slider from "@react-native-community/slider";
import waveformManager from "../utils/waveformManager";

export type SimpleCropWaveformProps = {
  samples: number[] | null | undefined; // 0..1 heights
  durationMs: number; // total media duration
  positionMs?: number; // current playhead position
  cropStartMs: number; // crop start position
  cropEndMs: number; // crop end position
  onCropStartChange: (ms: number) => void;
  onCropEndChange: (ms: number) => void;
  height?: number; // px
  barWidth?: number; // px
  barGap?: number; // px
  colorClass?: string; // tailwind class for bars
  showTimeLabels?: boolean; // show time labels
};

// Generate placeholder waveform data using centralized manager
function generatePlaceholderSamples(key: string, count = 100) {
  return waveformManager.generatePlaceholder(key || "wf", count);
}

function msToLabel(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${m}:${s.toString().padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
}

export default function SimpleCropWaveform({
  samples,
  durationMs,
  positionMs = 0,
  cropStartMs,
  cropEndMs,
  onCropStartChange,
  onCropEndChange,
  height = 80,
  barWidth = 3,
  barGap = 1,
  colorClass = "bg-blue-500",
  showTimeLabels = true,
}: SimpleCropWaveformProps) {
  // Process samples for display
  const displaySamples = samples && samples.length > 0 
    ? samples 
    : generatePlaceholderSamples(String(durationMs), 80);

  // Calculate positions for visual elements
  const totalWidth = displaySamples.length * (barWidth + barGap);
  const cropStartPosition = (cropStartMs / Math.max(1, durationMs)) * totalWidth;
  const cropEndPosition = (cropEndMs / Math.max(1, durationMs)) * totalWidth;
  const playheadPosition = (positionMs / Math.max(1, durationMs)) * totalWidth;

  return (
    <View className="w-full">
      {/* Waveform Visualization (Static - No Gestures) */}
      <View className="w-full mb-4" style={{ height }}>
        <View className="flex-row items-end relative" style={{ height, width: totalWidth, alignSelf: "center" }}>
          {displaySamples.map((h, i) => {
            const barPosition = i * (barWidth + barGap);
            const isInCropRange = barPosition >= cropStartPosition && barPosition <= cropEndPosition;
            
            return (
              <View
                key={i}
                className={`${colorClass} rounded-t`}
                style={{
                  width: barWidth,
                  height: Math.max(2, h * height),
                  marginRight: barGap,
                  opacity: isInCropRange ? 1 : 0.3,
                }}
              />
            );
          })}
          
          {/* Crop Selection Overlay */}
          <View
            className="absolute top-0 bottom-0 bg-yellow-200 opacity-20"
            style={{
              left: cropStartPosition,
              width: Math.max(0, cropEndPosition - cropStartPosition),
            }}
          />
          
          {/* Crop Start Handle */}
          <View
            className="absolute top-0 bottom-0 w-1 bg-yellow-500"
            style={{ left: cropStartPosition }}
          />
          
          {/* Crop End Handle */}
          <View
            className="absolute top-0 bottom-0 w-1 bg-yellow-500"
            style={{ left: cropEndPosition }}
          />
          
          {/* Playhead */}
          <View
            className="absolute top-0 bottom-0 w-0.5 bg-blue-600"
            style={{ left: playheadPosition }}
          />
        </View>
      </View>

      {/* Crop Start Slider */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Start Time: {msToLabel(cropStartMs)}
        </Text>
        <Slider
          style={{ width: "100%", height: 40 }}
          minimumValue={0}
          maximumValue={Math.max(1, cropEndMs - 500)} // Ensure minimum 500ms selection
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
          End Time: {msToLabel(cropEndMs)}
        </Text>
        <Slider
          style={{ width: "100%", height: 40 }}
          minimumValue={Math.max(1, cropStartMs + 500)} // Ensure minimum 500ms selection
          maximumValue={durationMs}
          value={cropEndMs}
          onValueChange={onCropEndChange}
          minimumTrackTintColor="#EF4444"
          maximumTrackTintColor="#E5E7EB"
          thumbTintColor="#EF4444"
        />
      </View>

      {/* Selection Info */}
      {showTimeLabels && (
        <View className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-blue-700 text-xs">Selection</Text>
              <Text className="text-blue-800 text-sm font-medium">
                {msToLabel(cropEndMs - cropStartMs)}
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-blue-700 text-xs">Range</Text>
              <Text className="text-blue-800 text-sm font-medium">
                {msToLabel(cropStartMs)} - {msToLabel(cropEndMs)}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-blue-700 text-xs">Total</Text>
              <Text className="text-blue-800 text-sm font-medium">
                {msToLabel(durationMs)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}