import React, { useState, useEffect, useMemo } from "react";
import { View, Text } from "react-native";
import { Audio } from "expo-av";
import EnhancedLiveWaveform from "./EnhancedLiveWaveform";
import waveformManager from "../utils/waveformManager";

export type EnhancedAudioPreviewProps = {
  // Audio source
  audioUri?: string;
  samples?: number[] | null;
  durationMs?: number;
  
  // Visual customization
  title?: string;
  subtitle?: string;
  height?: number;
  color?: string;
  showPeaks?: boolean;
  
  // Functionality
  showPlaybackControls?: boolean;
  showCropControls?: boolean;
  showTimeLabels?: boolean;
  
  // Crop functionality
  cropStartMs?: number;
  cropEndMs?: number;
  onCropChange?: (startMs: number, endMs: number) => void;
  
  // Playback state
  positionMs?: number;
  onPositionChange?: (positionMs: number) => void;
  
  // Loading state
  onLoadingChange?: (loading: boolean) => void;
  onError?: (error: string) => void;
};

export default function EnhancedAudioPreview({
  audioUri,
  samples,
  durationMs: propDurationMs,
  title,
  subtitle,
  height = 64,
  color = "#3B82F6",
  showPeaks = true,
  showPlaybackControls = false,
  showCropControls = false,
  showTimeLabels = false,
  cropStartMs = 0,
  cropEndMs = 0,
  onCropChange,
  positionMs = 0,
  onPositionChange,
  onLoadingChange,
  onError
}: EnhancedAudioPreviewProps) {
  
  const [audioSamples, setAudioSamples] = useState<number[]>(samples || []);
  const [audioDuration, setAudioDuration] = useState(propDurationMs || 0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  
  // Load audio file and generate waveform if needed
  useEffect(() => {
    const loadAudioData = async () => {
      if (!audioUri || samples) return; // Skip if we already have samples
      
      try {
        setIsLoadingAudio(true);
        setAudioError(null);
        onLoadingChange?.(true);
        
        // First, get audio duration
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: false }
        );
        
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
          setAudioDuration(status.durationMillis);
          
          // Generate placeholder waveform based on duration
          // TODO: In the future, we could implement actual waveform analysis
          const sampleCount = Math.min(200, Math.max(50, Math.floor(status.durationMillis / 1000)));
          const placeholderSamples = waveformManager.generatePlaceholder(audioUri, sampleCount);
          setAudioSamples(placeholderSamples);
        }
        
        await sound.unloadAsync();
        
      } catch (error) {
        console.error("Failed to load audio data:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to load audio";
        setAudioError(errorMessage);
        onError?.(errorMessage);
        
        // Generate placeholder for failed audio
        const placeholderSamples = waveformManager.generatePlaceholder(audioUri || "error", 100);
        setAudioSamples(placeholderSamples);
        setAudioDuration(60000); // Default 1 minute
        
      } finally {
        setIsLoadingAudio(false);
        onLoadingChange?.(false);
      }
    };
    
    loadAudioData();
  }, [audioUri, samples, onLoadingChange, onError]);
  
  // Use provided samples or loaded samples
  const finalSamples = useMemo(() => {
    return samples || audioSamples;
  }, [samples, audioSamples]);
  
  // Use provided duration or loaded duration
  const finalDuration = useMemo(() => {
    return propDurationMs || audioDuration;
  }, [propDurationMs, audioDuration]);
  
  // Handle crop changes
  const handleCropStartChange = (startMs: number) => {
    if (onCropChange) {
      onCropChange(startMs, cropEndMs);
    }
  };
  
  const handleCropEndChange = (endMs: number) => {
    if (onCropChange) {
      onCropChange(cropStartMs, endMs);
    }
  };
  
  // Handle seek/position changes
  const handleSeek = (ms: number) => {
    if (onPositionChange) {
      onPositionChange(ms);
    }
  };
  
  // Show loading state
  if (isLoadingAudio && finalSamples.length === 0) {
    return (
      <View className="bg-gray-50 rounded-lg p-4">
        {(title || subtitle) && (
          <View className="mb-3">
            {title && <Text className="font-semibold text-gray-900 text-base">{title}</Text>}
            {subtitle && <Text className="text-sm text-gray-600 mt-1">{subtitle}</Text>}
          </View>
        )}
        
        <View className="items-center py-8">
          <View className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mb-3" />
          <Text className="text-gray-600 text-sm">Loading audio...</Text>
        </View>
      </View>
    );
  }
  
  // Show error state
  if (audioError && finalSamples.length === 0) {
    return (
      <View className="bg-red-50 rounded-lg p-4 border border-red-200">
        {(title || subtitle) && (
          <View className="mb-3">
            {title && <Text className="font-semibold text-red-900 text-base">{title}</Text>}
            {subtitle && <Text className="text-sm text-red-600 mt-1">{subtitle}</Text>}
          </View>
        )}
        
        <View className="items-center py-4">
          <Text className="text-red-600 text-sm text-center">
            Failed to load audio: {audioError}
          </Text>
        </View>
      </View>
    );
  }
  
  return (
    <View className="bg-gray-50 rounded-lg p-4">
      <EnhancedLiveWaveform
        values={finalSamples}
        height={height}
        color={color}
        showPeaks={showPeaks}
        title={title}
        subtitle={subtitle}
        
        // Crop functionality
        cropMode={showCropControls}
        cropStartMs={cropStartMs}
        cropEndMs={cropEndMs}
        onCropStartChange={showCropControls ? handleCropStartChange : undefined}
        onCropEndChange={showCropControls ? handleCropEndChange : undefined}
        
        // Playback functionality
        durationMs={finalDuration}
        positionMs={positionMs}
        onSeek={handleSeek}
        audioUri={audioUri}
        showPlaybackControls={showPlaybackControls}
        showTimeLabels={showTimeLabels}
      />
      
      {/* Additional info footer */}
      {!showPlaybackControls && !showTimeLabels && finalDuration > 0 && (
        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-xs text-gray-500">
            {finalSamples.length} samples
          </Text>
          <Text className="text-xs text-gray-500">
            {Math.round(finalDuration / 1000)}s
          </Text>
        </View>
      )}
    </View>
  );
}