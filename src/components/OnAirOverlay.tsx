import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation, interpolate } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function OnAirOverlay({ visible }: { visible: boolean }) {
  const inset = useSafeAreaInsets();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      pulse.value = 0;
      pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [visible]);

  const edgeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 0.9]),
  }));
  const signStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.98, 1.02]) }],
  }));

  if (!visible) return null;

  const edgeThickness = 8;

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Edges */}
      <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, height: edgeThickness, backgroundColor: "#DC2626" }, edgeOpacity]} />
      <Animated.View style={[{ position: "absolute", bottom: 0, left: 0, right: 0, height: edgeThickness, backgroundColor: "#DC2626" }, edgeOpacity]} />
      <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, width: edgeThickness, backgroundColor: "#DC2626" }, edgeOpacity]} />
      <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, right: 0, width: edgeThickness, backgroundColor: "#DC2626" }, edgeOpacity]} />

      {/* ON AIR sign */}
      <View style={{ position: "absolute", top: inset.top + 8, left: 0, right: 0, alignItems: "center" }}>
        <Animated.View style={[{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#DC2626", borderRadius: 9999, shadowColor: "#DC2626", shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }, signStyle]}>
          <Text style={{ color: "white", fontWeight: "800", letterSpacing: 2 }}>ON AIR</Text>
        </Animated.View>
      </View>
    </View>
  );
}
