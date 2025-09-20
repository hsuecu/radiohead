import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { TimelineViewport } from "../../state/audioStore";

export type TimelineHeaderProps = {
  durationMs: number;
  viewport: TimelineViewport;
  timelineWidth: number;
  onSeek: (ms: number) => void;
};

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function TimelineHeader({
  durationMs,
  viewport,
  timelineWidth,
  onSeek,
}: TimelineHeaderProps) {
  const pixelsPerMs = viewport.pixelsPerMs || 0.1;
  
  // Calculate time markers
  const timeMarkers = useMemo(() => {
    const markers: Array<{ x: number; time: number; label: string; major: boolean }> = [];
    
    // Determine marker interval based on zoom level
    let intervalMs: number;
    if (pixelsPerMs >= 0.5) {
      intervalMs = 1000; // 1 second intervals at high zoom
    } else if (pixelsPerMs >= 0.1) {
      intervalMs = 5000; // 5 second intervals at medium zoom
    } else if (pixelsPerMs >= 0.05) {
      intervalMs = 10000; // 10 second intervals
    } else {
      intervalMs = 30000; // 30 second intervals at low zoom
    }
    
    const majorInterval = intervalMs * 4; // Major markers every 4 intervals
    
    for (let time = 0; time <= durationMs; time += intervalMs) {
      const x = time * pixelsPerMs;
      const isMajor = time % majorInterval === 0;
      
      markers.push({
        x,
        time,
        label: formatTime(time),
        major: isMajor,
      });
    }
    
    return markers;
  }, [durationMs, pixelsPerMs]);

  return (
    <View style={{ height: 24 }} className="bg-white border-b border-gray-200 relative">
      {/* Time Markers */}
      {timeMarkers.map((marker, index) => (
        <Pressable
          key={index}
          style={{
            position: "absolute",
            left: marker.x,
            top: 0,
            bottom: 0,
            minWidth: 1,
          }}
          onPress={() => onSeek(marker.time)}
        >
          {/* Tick Line */}
          <View
            style={{
              width: 1,
              height: marker.major ? 16 : 8, // Reduced for mobile
              backgroundColor: marker.major ? "#9CA3AF" : "#D1D5DB",
            }}
          />
          
          {/* Time Label - only show major markers on mobile */}
          {marker.major && pixelsPerMs > 0.05 && (
            <Text
              style={{
                position: "absolute",
                top: 18, // Adjusted for smaller header
                left: 2,
                fontSize: 8, // Smaller font for mobile
                color: "#6B7280",
                fontFamily: "monospace",
              }}
            >
              {marker.label}
            </Text>
          )}
        </Pressable>
      ))}
      
      {/* Grid Lines (if enabled) */}
      {viewport.snapToGrid && viewport.gridSizeMs && (
        <>
          {Array.from({ length: Math.ceil(durationMs / viewport.gridSizeMs) }, (_, i) => {
            const time = i * viewport.gridSizeMs!;
            const x = time * pixelsPerMs;
            return (
              <View
                key={`grid-${i}`}
                style={{
                  position: "absolute",
                  left: x,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  backgroundColor: "#E5E7EB",
                  opacity: 1,
                }}
              />
            );
          })}
        </>
      )}
    </View>
  );
}