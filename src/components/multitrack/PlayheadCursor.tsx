import React from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, withTiming, interpolate } from "react-native-reanimated";

export type PlayheadCursorProps = {
  positionMs: number;
  pixelsPerMs: number;
  height: number;
  isPlaying: boolean;
};

export default function PlayheadCursor({
  positionMs,
  pixelsPerMs,
  height,
  isPlaying,
}: PlayheadCursorProps) {
  const x = positionMs * pixelsPerMs;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: withTiming(x, { duration: 100 }) }],
      opacity: isPlaying ? withTiming(1, { duration: 200 }) : withTiming(0.7, { duration: 200 }),
    };
  });

  const pulseStyle = useAnimatedStyle(() => {
    if (!isPlaying) return { opacity: 0 };
    
    return {
      opacity: interpolate(
        Date.now() % 1000,
        [0, 500, 1000],
        [0.3, 0.8, 0.3]
      ),
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          width: 2,
          height,
          backgroundColor: "#EF4444",
          zIndex: 1000,
        },
        animatedStyle,
      ]}
    >
      {/* Playhead Handle */}
      <View
        style={{
          position: "absolute",
          top: -8,
          left: -6,
          width: 14,
          height: 16,
          backgroundColor: "#EF4444",
          borderRadius: 2,
        }}
      />
      
      {/* Pulse Effect When Playing */}
      {isPlaying && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: -8,
              left: -6,
              width: 14,
              height: 16,
              backgroundColor: "#FCA5A5",
              borderRadius: 2,
            },
            pulseStyle,
          ]}
        />
      )}
      
      {/* Vertical Line */}
      <View
        style={{
          position: "absolute",
          top: 8,
          left: 0,
          width: 2,
          height: height - 8,
          backgroundColor: "#EF4444",
          opacity: 0.8,
        }}
      />
    </Animated.View>
  );
}