import React, { useRef } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  runOnJS,
  withSpring
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Track } from "../../state/audioStore";
import { hapticFeedback } from "../../utils/mobileOptimization";

export type TrackHeaderProps = {
  track: Track;
  height: number;
  onUpdate: (patch: Partial<Track>) => void;
  onRemove: () => void;
  onReorder: (direction: "up" | "down") => void;
  onAddClip?: () => void;
  onDragStart?: (trackId: string) => void;
  onDragEnd?: (fromTrackId: string, toIndex: number) => void;
  isDragging?: boolean;
  dragOffset?: number;
  editable?: boolean;
  durationMs?: number;
};

export default function TrackHeader({
  track,
  height,
  onUpdate,
  onRemove,
  onReorder,
  onDragStart,
  onDragEnd,
  isDragging = false,
  dragOffset = 0,
  editable = true,
}: TrackHeaderProps) {
  
  // Animation values for drag feedback
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  
  // Safe refs for runOnJS
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  useRef(() => {
    onDragStartRef.current = onDragStart;
    onDragEndRef.current = onDragEnd;
  });
  
  const safeRunOnJS = (fn: any, ...args: any[]) => {
    "worklet";
    if (typeof fn === "function") {
      runOnJS(fn)(...args);
    }
  };

  // Simplified drag gesture for mobile
  const dragGesture = Gesture.Pan()
    .onUpdate((event) => {
      "worklet";
      if (!editable) return;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      "worklet";
      if (!editable || !onDragEnd) return;
      
      // Calculate drop position based on translation
      const dropIndex = Math.round(event.translationY / height);
      const newIndex = Math.max(0, track.index + dropIndex);
      
      // Reset animations
      translateY.value = withSpring(0);
      
      safeRunOnJS(hapticFeedback.selection);
      safeRunOnJS(onDragEndRef.current, track.id, newIndex);
    });

  // Animated style for drag feedback
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value + dragOffset },
      { scale: scale.value }
    ],
    opacity: opacity.value,
    zIndex: isDragging ? 1000 : 1,
  }));

  const getTrackColor = () => {
    switch (track.type) {
      case "master":
        return "bg-blue-600";
      case "audio":
        return "bg-green-600";
      case "aux":
        return "bg-purple-600";
      default:
        return "bg-gray-600";
    }
  };

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View
        style={[
          { height },
          animatedStyle,
          {
            backgroundColor: isDragging ? "#374151" : "#1F2937",
            borderBottomWidth: 1,
            borderBottomColor: "#374151",
            paddingHorizontal: 12,
            paddingVertical: 8,
          }
        ]}
      >
      {/* Simplified Mobile Track Header */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center">
          {/* Track Color Indicator */}
          <View className={`w-2 h-2 rounded-full mr-2 ${getTrackColor()}`} />
          
          {/* Track Name - Simplified */}
          <View className="flex-1">
            <Text className="text-white text-xs font-medium" numberOfLines={1}>
              {track.name}
            </Text>
          </View>
        </View>

        {/* Essential Mobile Controls Only */}
        <View className="flex-row items-center">
          {/* Volume Slider - Compact */}
          <View className="w-16 mr-2">
            <Slider
              style={{ width: 64, height: 20 }}
              minimumValue={0}
              maximumValue={1.5}
              value={track.gain}
              step={0.1}
              onValueChange={(value) => onUpdate({ gain: value })}
              minimumTrackTintColor="#3B82F6"
              maximumTrackTintColor="#374151"
              thumbTintColor="#3B82F6"
            />
          </View>
          
          {/* Mute Toggle */}
          <Pressable
            onPress={() => onUpdate({ muted: !track.muted })}
            className={`p-1 rounded ${track.muted ? "bg-red-600" : "bg-gray-600"}`}
            hitSlop={4}
          >
            <Ionicons 
              name={track.muted ? "volume-mute" : "volume-medium"} 
              size={14} 
              color="white" 
            />
          </Pressable>
          
          {/* Remove Track - Only for non-main tracks */}
          {editable && track.id !== "main-track" && (
            <Pressable
              onPress={onRemove}
              className="p-1 rounded bg-red-600 ml-1"
              hitSlop={4}
            >
              <Ionicons name="trash" size={12} color="white" />
            </Pressable>
          )}
        </View>
      </View>


      </Animated.View>
    </GestureDetector>
  );
}