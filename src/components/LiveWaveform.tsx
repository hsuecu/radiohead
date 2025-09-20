import React, { useMemo } from "react";
import { View } from "react-native";

export type LiveWaveformProps = {
  values: number[];
  height?: number;
  barWidth?: number;
  gap?: number;
  color?: string;
  showPeaks?: boolean;
  minBarHeight?: number;
};

export default function LiveWaveform({ 
  values, 
  height = 64, 
  barWidth = 3, 
  gap = 1, 
  color = "#3B82F6",
  showPeaks = true,
  minBarHeight = 2
}: LiveWaveformProps) {
  
  // Optimize rendering by limiting bars and smoothing values
  const processedValues = useMemo(() => {
    if (!values || values.length === 0) return [];
    
    // Take last 150 values for performance
    const recent = values.slice(-150);
    
    // Apply smoothing to reduce jitter
    const smoothed = recent.map((value, index) => {
      if (index === 0) return value;
      const prev = recent[index - 1] || 0;
      // Simple exponential smoothing
      return prev * 0.3 + value * 0.7;
    });
    
    return smoothed;
  }, [values]);

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

  if (processedValues.length === 0) {
    // Show placeholder bars when no audio
    return (
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
    );
  }

  return (
    <View style={{ 
      height, 
      overflow: "hidden", 
      flexDirection: "row", 
      alignItems: "center",
      paddingHorizontal: 4
    }}>
      {barsData.map((bar, i) => (
        <View
          key={`${i}-${processedValues.length}`} // Include length to force re-render
          style={{
            width: barWidth,
            height: bar.height,
            backgroundColor: bar.isPeak ? "#EF4444" : color, // Red for peaks
            marginRight: gap,
            borderRadius: 1,
            alignSelf: "center",
            opacity: bar.value > 0.05 ? 1 : 0.4, // Fade very quiet bars
          }}
        />
      ))}
    </View>
  );
}
