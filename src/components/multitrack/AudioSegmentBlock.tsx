import React, { useState, useMemo, useRef, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  runOnJS
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Track, AudioSegment } from "../../state/audioStore";
import EnhancedLiveWaveform from "../EnhancedLiveWaveform";
import waveformManager from "../../utils/waveformManager";
import { hapticFeedback, MOBILE_CONSTANTS } from "../../utils/mobileOptimization";

export type AudioSegmentBlockProps = {
  segment: AudioSegment;
  track: Track;
  pixelsPerMs: number;
  trackHeight: number;
  onUpdate: (patch: Partial<AudioSegment>) => void;
  onMove?: (segmentId: string, newTrackId: string, newStartMs: number) => void;
  onSelect?: (segmentId: string) => void;
  isSelected?: boolean;
  snapToGrid?: boolean;
  gridSizeMs?: number;
  editable?: boolean;
  allTracks?: Track[];
  trackIndex?: number;
  onDragHover?: (trackIndex: number) => void;
  onAutoScroll?: (absoluteX: number) => void;
  onDragStateChange?: (state: "start" | "end") => void;
};

type ResizeHandle = "left" | "right" | null;

export default function AudioSegmentBlock({
  segment,
  track,
  pixelsPerMs,
  trackHeight,
  onUpdate,
  onMove,
  onSelect,
  isSelected = false,
  snapToGrid = false,
  gridSizeMs = 1000,
  editable = true,
  allTracks = [],
  trackIndex = 0,
  onDragHover,
  onAutoScroll,
  onDragStateChange,
}: AudioSegmentBlockProps) {
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null);
  
  // Safe refs and wrappers for runOnJS
  const onUpdateFn = onUpdate || (() => {});
  const onUpdateRef = useRef(onUpdateFn);
  useEffect(() => { onUpdateRef.current = onUpdateFn; }, [onUpdateFn]);

  const clearActiveHandle = () => setActiveHandle(null);
  const setActiveLeft = () => setActiveHandle("left");
  const setActiveRight = () => setActiveHandle("right");
  const updateSegmentPositionJS = (startMs: number, endMs: number) => onUpdateRef.current?.({ startMs, endMs });
  const moveSegmentToTrackJS = (newTrackId: string, newStartMs: number) => onMove?.(segment.id, newTrackId, newStartMs);
  const updateStartJS = (startMs: number, sourceStartMs: number) => onUpdateRef.current?.({ startMs, sourceStartMs });
  const updateEndJS = (endMs: number) => onUpdateRef.current?.({ endMs });
  const hapticLight = () => hapticFeedback.light();
  const hapticSelection = () => hapticFeedback.selection();
  
  // Animated values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const leftHandleX = useSharedValue(0);
  const rightHandleX = useSharedValue(0);

  // Calculate segment dimensions
  const segmentDuration = segment.endMs - segment.startMs;
  const segmentWidth = Math.max(20, segmentDuration * pixelsPerMs);
  const segmentLeft = segment.startMs * pixelsPerMs;
  
  // Generate waveform if not available using centralized approach
  const waveformSamples = useMemo(() => {
    // Use processed waveform if available, otherwise original, otherwise placeholder
    if (segment.processedWaveform && waveformManager.isValidWaveform(segment.processedWaveform)) {
      return segment.processedWaveform;
    }
    if (segment.waveform && waveformManager.isValidWaveform(segment.waveform)) {
      return segment.waveform;
    }
    // Use centralized placeholder generation with standard sample count
    return waveformManager.generatePlaceholder(segment.id, waveformManager.getStandardSampleCount());
  }, [segment.waveform, segment.processedWaveform, segment.id]);

  // Worklet-safe helpers (do not call external functions inside worklets)
  const snapToGridValueW = (value: number) => {
    "worklet";
    if (!snapToGrid || !gridSizeMs) return value;
    return Math.round(value / gridSizeMs) * gridSizeMs;
  };
  const calculateSegmentPositionW = (
    rawPosition: number,
    ppm: number,
    snap: boolean,
    gridMs: number,
    snapThreshold: number
  ) => {
    "worklet";
    const timeMs = rawPosition / ppm;
    if (snap && gridMs > 0) {
      const gridPosition = Math.round(timeMs / gridMs) * gridMs;
      const gridPixelPosition = gridPosition * ppm;
      if (Math.abs(rawPosition - gridPixelPosition) <= snapThreshold) {
        return gridPosition;
      }
    }
    return timeMs;
  };
  const enforceMinimumSegmentWidthW = (startMs: number, endMs: number, minWidthMs: number = 100) => {
    "worklet";
    const currentWidth = endMs - startMs;
    if (currentWidth < minWidthMs) {
      return { startMs, endMs: startMs + minWidthMs };
    }
    return { startMs, endMs };
  };

  // Main segment animated style
  const segmentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: isSelected ? 1 : 0.9,
  }));

  // Left handle animated style
  const leftHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leftHandleX.value }],
    width: Math.max(14, -leftHandleX.value + 14),
  }));

  // Right handle animated style
  const rightHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rightHandleX.value }],
    width: Math.max(14, rightHandleX.value + 14),
  }));

  // Safe runOnJS guard
  const safeRunOnJS = (fn: any, ...args: any[]) => {
    "worklet";
    if (typeof fn === "function") {
      runOnJS(fn)(...args);
    }
  };

  // Left handle resize gesture
  const leftHandleGesture = Gesture.Pan()
    .onStart(() => {
      if (!editable) return;
      safeRunOnJS(setActiveLeft);
    })
    .onUpdate((event) => {
      if (!editable) return;
      leftHandleX.value = Math.min(0, event.translationX);
    })
    .onEnd((event) => {
      if (!editable) return;
      const deltaMs = event.translationX / pixelsPerMs;
      let newStartMs = Math.max(0, segment.startMs + deltaMs);
      const minEndMs = newStartMs + 100;
      if (minEndMs > segment.endMs) {
        newStartMs = segment.endMs - 100;
      }
      newStartMs = snapToGridValueW(newStartMs);
      leftHandleX.value = withTiming(0, { duration: 200 });
      safeRunOnJS(clearActiveHandle);
      if (Math.abs(deltaMs) > 10) {
        safeRunOnJS(updateStartJS, newStartMs, segment.sourceStartMs + (newStartMs - segment.startMs));
      }
    });

  // Right handle resize gesture
  const rightHandleGesture = Gesture.Pan()
    .onStart(() => {
      if (!editable) return;
      safeRunOnJS(setActiveRight);
    })
    .onUpdate((event) => {
      if (!editable) return;
      rightHandleX.value = Math.max(0, event.translationX);
    })
    .onEnd((event) => {
      if (!editable) return;
      const deltaMs = event.translationX / pixelsPerMs;
      let newEndMs = segment.endMs + deltaMs;
      const minEndMs = segment.startMs + 100;
      if (newEndMs < minEndMs) {
        newEndMs = minEndMs;
      }
      newEndMs = snapToGridValueW(newEndMs);
      rightHandleX.value = withTiming(0, { duration: 200 });
      safeRunOnJS(clearActiveHandle);
      if (Math.abs(deltaMs) > 10) {
        safeRunOnJS(updateEndJS, newEndMs);
      }
    });

  // Main drag gesture for moving segments - optimized for mobile
  const dragGesture = Gesture.Pan()
    .minDistance(10)
    .activateAfterLongPress(120)
    .onStart(() => {
      if (!editable) return;
      scale.value = withTiming(1.1, { duration: 90 });
      safeRunOnJS(hapticLight);
      safeRunOnJS(clearActiveHandle);
      safeRunOnJS(onSelect, segment.id);
      safeRunOnJS(onDragStateChange || (() => {}), "start");
    })
    .onUpdate((event: any) => {
      if (!editable) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      const trackChange = Math.round(event.translationY / trackHeight);
      const hoverIndex = trackIndex + trackChange;
      safeRunOnJS(onDragHover || (() => {}), hoverIndex);
      if (typeof event.absoluteX === "number") {
        safeRunOnJS(onAutoScroll || (() => {}), event.absoluteX);
      }
    })
    .onEnd((event: any) => {
      if (!editable) return;
      scale.value = withTiming(1, { duration: 140 });
      safeRunOnJS(onDragStateChange || (() => {}), "end");
      const dynamicSnapPx = Math.max(6, Math.min(24, (gridSizeMs || 1000) * (pixelsPerMs || 0.1) * 0.5));
      const newStartMs = calculateSegmentPositionW(
        segment.startMs * pixelsPerMs + event.translationX,
        pixelsPerMs,
        snapToGrid,
        gridSizeMs || 1000,
        dynamicSnapPx
      );
      const trackChange = Math.round(event.translationY / trackHeight);
      const newTrackIndex = trackIndex + trackChange;
      const { startMs: finalStartMs } = enforceMinimumSegmentWidthW(
        Math.max(0, newStartMs),
        Math.max(0, newStartMs) + segmentDuration
      );
      translateX.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(0, { duration: 180 });
      const movedSignificantly = Math.abs(event.translationX) > MOBILE_CONSTANTS.MIN_DRAG_DISTANCE || 
                                Math.abs(event.translationY) > MOBILE_CONSTANTS.MIN_DRAG_DISTANCE;
      if (movedSignificantly) {
        safeRunOnJS(hapticSelection);
        if (trackChange !== 0 && newTrackIndex >= 0 && newTrackIndex < allTracks.length && onMove) {
          const targetTrack = allTracks[newTrackIndex];
          if (targetTrack && targetTrack.id !== segment.trackId) {
            safeRunOnJS(moveSegmentToTrackJS, targetTrack.id, finalStartMs);
            return;
          }
        }
        const finalEndMs = finalStartMs + segmentDuration;
        safeRunOnJS(updateSegmentPositionJS, finalStartMs, finalEndMs);
      }
    })
    .requireExternalGestureToFail(leftHandleGesture)
    .requireExternalGestureToFail(rightHandleGesture);



  // Get segment color based on track type and segment properties
  const getSegmentColor = () => {
    if (segment.muted) return "#6B7280";
    if (isSelected) return "#3B82F6";
    return segment.color || track.color || "#10B981";
  };

  // Handle segment selection
  const handlePress = () => {
    if (!editable || !onSelect) return;
    onSelect(segment.id);
  };

  // Calculate fade overlay widths
  const fadeInWidth = Math.max(2, segment.fadeInMs * pixelsPerMs);
  const fadeOutWidth = Math.max(2, segment.fadeOutMs * pixelsPerMs);

  // Tap gesture for selection
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      if (!editable || !onSelect) return;
      safeRunOnJS(hapticSelection);
      safeRunOnJS(onSelect, segment.id);
    });

  // Combine gestures - use Race for better mobile touch handling
  const combinedGesture = Gesture.Race(tapGesture, dragGesture);

  // Mini nudge toolbar when selected
  const NudgeToolbar = () => (
    <View
      style={{
        position: "absolute",
        top: 2,
        right: 2,
        flexDirection: "row",
        backgroundColor: "rgba(0,0,0,0.3)",
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        gap: 6,
      }}
    >
      <Pressable onPress={() => safeRunOnJS(onUpdateRef.current, { startMs: Math.max(0, segment.startMs - 10), endMs: Math.max(segment.startMs - 10 + (segment.endMs - segment.startMs), segment.startMs + 90) })}>
        <Text style={{ color: "#FFFFFF", fontSize: 10 }}>◀︎ 10ms</Text>
      </Pressable>
      <Pressable onPress={() => safeRunOnJS(onUpdateRef.current, { startMs: Math.max(0, segment.startMs + 10), endMs: Math.max(segment.startMs + 10 + (segment.endMs - segment.startMs), segment.startMs + 110) })}>
        <Text style={{ color: "#FFFFFF", fontSize: 10 }}>10ms ▶︎</Text>
      </Pressable>
    </View>
  );

  return (
    <GestureDetector gesture={combinedGesture}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: segmentLeft,
            top: 2, // Reduced top margin for mobile
            width: Math.max(segmentWidth, 44), // Minimum touch target size
            height: trackHeight - 4, // Increased height for mobile
            backgroundColor: getSegmentColor(),
            borderRadius: 6, // Slightly more rounded for mobile
            borderWidth: isSelected ? 3 : 1, // Thicker border when selected
            borderColor: isSelected ? "#3B82F6" : "#E5E7EB",
            overflow: "hidden",
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: isSelected ? 0.4 : 0.2,
            shadowRadius: isSelected ? 6 : 3,
            elevation: isSelected ? 8 : 4,
          },
          segmentAnimatedStyle,
        ]}
      >
        <Pressable
          onPress={handlePress}
          style={{ flex: 1 }}
          disabled={!editable}
        >
          {/* Segment Background Gradient */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: getSegmentColor(),
              opacity: segment.muted ? 0.5 : 0.8,
            }}
          />

          {/* Waveform */}
          <View style={{ flex: 1, padding: 2 }}>
            <EnhancedLiveWaveform
              values={waveformSamples || []}
              durationMs={segmentDuration}
              height={trackHeight - 12}
              barWidth={1}
              gap={1}
              color="white"
              showPeaks={false}
              minBarHeight={1}
            />
          </View>

           {isSelected ? <NudgeToolbar /> : null}

           {/* Segment Label */}
           <View
             style={{
               position: "absolute",
               top: 2,
               left: 4,
               right: 4,
             }}
           >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 10,
                fontWeight: "600",
                textShadowColor: "#000000",
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 2,
              }}
              numberOfLines={1}
            >
              {segment.name || "Audio Clip"}
            </Text>
          </View>

          {/* Gain Indicator */}
          {segment.gain !== 1 && (
            <View
              style={{
                position: "absolute",
                bottom: 2,
                right: 4,
                backgroundColor: "#000000",
                borderRadius: 2,
                paddingHorizontal: 2,
                paddingVertical: 1,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 8,
                  fontWeight: "600",
                }}
              >
                {Math.round(segment.gain * 100)}%
              </Text>
            </View>
          )}

          {/* Fade In Overlay */}
          {segment.fadeInMs > 0 && (
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: fadeInWidth,
                backgroundColor: "#FFFFFF",
                opacity: 0.3,
              }}
            >
              {/* Fade curve visualization */}
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: "#3B82F6",
                }}
              />
            </View>
          )}
          
          {/* Fade Out Overlay */}
          {segment.fadeOutMs > 0 && (
            <View
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: fadeOutWidth,
                backgroundColor: "#FFFFFF",
                opacity: 0.3,
              }}
            >
              {/* Fade curve visualization */}
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: "#3B82F6",
                }}
              />
            </View>
          )}
        </Pressable>

        {/* Resize Handles */}
        {editable && isSelected && (
          <>
            {/* Left Resize Handle */}
            <GestureDetector gesture={leftHandleGesture}>
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 14,
                    backgroundColor: activeHandle === "left" ? "#3B82F6" : "#FFFFFF",
                    opacity: 0.9,
                    borderTopLeftRadius: 4,
                    borderBottomLeftRadius: 4,
                  },
                  leftHandleStyle,
                ]}
              >
                <View
                  style={{
                    position: "absolute",
                    left: 2,
                    top: "50%",
                     width: 6,
                     height: 16,
                    backgroundColor: "#1F2937",
                    borderRadius: 1,
                     transform: [{ translateY: -8 }],
                  }}
                />
              </Animated.View>
            </GestureDetector>
            
            {/* Right Resize Handle */}
            <GestureDetector gesture={rightHandleGesture}>
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 14,
                    backgroundColor: activeHandle === "right" ? "#3B82F6" : "#FFFFFF",
                    opacity: 0.9,
                    borderTopRightRadius: 4,
                    borderBottomRightRadius: 4,
                  },
                  rightHandleStyle,
                ]}
              >
                <View
                  style={{
                    position: "absolute",
                    right: 2,
                    top: "50%",
                     width: 6,
                     height: 16,
                    backgroundColor: "#1F2937",
                    borderRadius: 1,
                     transform: [{ translateY: -8 }],
                  }}
                />
              </Animated.View>
            </GestureDetector>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}