import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  runOnJS,
  withTiming 
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { AutomationPoint, AutomationCurve } from "../../state/audioStore";

export type VolumeAutomationProps = {
  automation?: AutomationCurve;
  durationMs: number;
  pixelsPerMs: number;
  height: number;
  width: number;
  onAutomationChange: (automation: AutomationCurve) => void;
  editable?: boolean;
};

export default function VolumeAutomation({
  automation,
  durationMs,
  pixelsPerMs,
  height,
  width,
  onAutomationChange,
  editable = true,
}: VolumeAutomationProps) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(false);
  
  // Default automation curve if none exists
  const defaultAutomation: AutomationCurve = {
    points: [
      { timeMs: 0, value: 1 },
      { timeMs: durationMs, value: 1 }
    ],
    type: "linear"
  };
  
  const currentAutomation = automation || defaultAutomation;
  
  // Convert automation points to screen coordinates
  const getPointScreenPosition = (point: AutomationPoint) => ({
    x: point.timeMs * pixelsPerMs,
    y: height - (point.value * height)
  });
  
  // Convert screen coordinates to automation point
  const getAutomationPoint = (x: number, y: number): AutomationPoint => ({
    timeMs: Math.max(0, Math.min(durationMs, x / pixelsPerMs)),
    value: Math.max(0, Math.min(1, 1 - (y / height)))
  });
  

  
  // Add automation point
  const addPoint = (x: number, y: number) => {
    if (!editable) return;
    
    const newPoint = getAutomationPoint(x, y);
    const newPoints = [...currentAutomation.points, newPoint]
      .sort((a, b) => a.timeMs - b.timeMs);
    
    onAutomationChange({
      ...currentAutomation,
      points: newPoints
    });
  };
  
  // Update automation point
  const updatePoint = (index: number, x: number, y: number) => {
    if (!editable || index < 0 || index >= currentAutomation.points.length) return;
    
    const newPoint = getAutomationPoint(x, y);
    const newPoints = [...currentAutomation.points];
    newPoints[index] = newPoint;
    
    // Sort points by time
    newPoints.sort((a, b) => a.timeMs - b.timeMs);
    
    onAutomationChange({
      ...currentAutomation,
      points: newPoints
    });
  };
  
  // Remove automation point
  const removePoint = (index: number) => {
    if (!editable || currentAutomation.points.length <= 2) return;
    
    const newPoints = currentAutomation.points.filter((_, i) => i !== index);
    onAutomationChange({
      ...currentAutomation,
      points: newPoints
    });
    setSelectedPointIndex(null);
  };
  
  // Gesture for adding points
  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      if (!editable) return;
      addPoint(event.x, event.y);
    });
  
  return (
    <View style={{ height, width, position: "relative" }}>
      {/* Background */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#1F2937",
          opacity: 0.3,
        }}
      />
      
      {/* Grid lines */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        {/* Horizontal grid lines (volume levels) */}
        {[0.25, 0.5, 0.75].map((level) => (
          <View
            key={level}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: height - (level * height),
              height: 1,
              backgroundColor: "#374151",
              opacity: 0.5,
            }}
          />
        ))}
      </View>
      
      {/* Automation curve */}
      <GestureDetector gesture={tapGesture}>
        <View style={{ flex: 1 }}>
          {/* Curve line */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {/* Simple line rendering for now - could be enhanced with SVG */}
            {currentAutomation.points.map((point, index) => {
              if (index === 0) return null;
              
              const prevPoint = currentAutomation.points[index - 1];
              const startPos = getPointScreenPosition(prevPoint);
              const endPos = getPointScreenPosition(point);
              
              return (
                <View
                  key={`line-${index}`}
                  style={{
                    position: "absolute",
                    left: startPos.x,
                    top: Math.min(startPos.y, endPos.y),
                    width: Math.abs(endPos.x - startPos.x),
                    height: Math.max(2, Math.abs(endPos.y - startPos.y)),
                    backgroundColor: "#3B82F6",
                    transform: [
                      {
                        rotate: `${Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x)}rad`
                      }
                    ],
                  }}
                />
              );
            })}
          </View>
          
          {/* Automation points */}
          {currentAutomation.points.map((point, index) => {
            const screenPos = getPointScreenPosition(point);
            const isSelected = selectedPointIndex === index;
            
            return (
              <AutomationPointHandle
                key={`point-${index}`}
                x={screenPos.x}
                y={screenPos.y}
                isSelected={isSelected}
                onMove={(newX, newY) => updatePoint(index, newX, newY)}
                onSelect={() => setSelectedPointIndex(index)}
                onRemove={() => removePoint(index)}
                editable={editable}
                canRemove={currentAutomation.points.length > 2}
              />
            );
          })}
        </View>
      </GestureDetector>
      
      {/* Controls */}
      {editable && (
        <View style={{ position: "absolute", top: 4, right: 4 }}>
          <Pressable
            onPress={() => setShowControls(!showControls)}
            style={{
              backgroundColor: "#374151",
              borderRadius: 4,
              padding: 4,
            }}
          >
            <Ionicons name="options" size={12} color="#FFFFFF" />
          </Pressable>
          
          {showControls && (
            <View
              style={{
                position: "absolute",
                top: 24,
                right: 0,
                backgroundColor: "#1F2937",
                borderRadius: 8,
                padding: 8,
                minWidth: 120,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 10, marginBottom: 4 }}>
                Curve Type
              </Text>
              {["linear", "exponential", "logarithmic"].map((type) => (
                <Pressable
                  key={type}
                  onPress={() => onAutomationChange({ ...currentAutomation, type: type as any })}
                  style={{
                    padding: 4,
                    backgroundColor: currentAutomation.type === type ? "#3B82F6" : "transparent",
                    borderRadius: 4,
                    marginBottom: 2,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 10 }}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
      
      {/* Volume scale */}
      <View style={{ position: "absolute", left: -20, top: 0, bottom: 0, width: 16 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((level) => (
          <Text
            key={level}
            style={{
              position: "absolute",
              top: height - (level * height) - 6,
              fontSize: 8,
              color: "#9CA3AF",
              textAlign: "right",
              width: 16,
            }}
          >
            {Math.round(level * 100)}
          </Text>
        ))}
      </View>
    </View>
  );
}

type AutomationPointHandleProps = {
  x: number;
  y: number;
  isSelected: boolean;
  onMove: (x: number, y: number) => void;
  onSelect: () => void;
  onRemove: () => void;
  editable: boolean;
  canRemove: boolean;
};

function AutomationPointHandle({
  x,
  y,
  isSelected,
  onMove,
  onSelect,
  onRemove,
  editable,
  canRemove,
}: AutomationPointHandleProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));
  
  const panGesture = Gesture.Pan()
    .onStart(() => {
      if (!editable) return;
      scale.value = withTiming(1.2, { duration: 100 });
      runOnJS(onSelect)();
    })
    .onUpdate((event) => {
      if (!editable) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (!editable) return;
      
      scale.value = withTiming(1, { duration: 100 });
      
      const newX = x + event.translationX;
      const newY = y + event.translationY;
      
      translateX.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
      
      runOnJS(onMove)(newX, newY);
    });
  
  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      if (!editable || !canRemove) return;
      runOnJS(onRemove)();
    });
  
  const combinedGesture = Gesture.Simultaneous(panGesture, longPressGesture);
  
  return (
    <GestureDetector gesture={combinedGesture}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: x - 6,
            top: y - 6,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: isSelected ? "#3B82F6" : "#FFFFFF",
            borderWidth: 2,
            borderColor: "#1F2937",
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.3,
            shadowRadius: 2,
            elevation: 3,
          },
          animatedStyle,
        ]}
      />
    </GestureDetector>
  );
}