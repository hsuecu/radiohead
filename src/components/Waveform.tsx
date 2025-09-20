import React, { useMemo, useState, useRef } from "react";
import { View, Text, Dimensions, ScrollView } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, withSpring } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import waveformManager from "../utils/waveformManager";

export type WaveformMode = "preview" | "edit" | "simple";

export type WaveformProps = {
  samples: number[] | null | undefined; // 0..1 heights
  overlaySamples?: number[] | null | undefined; // optional processed overlay
  overlayColorClass?: string;
  durationMs: number; // total media duration
  positionMs?: number; // current playhead position
  onSeek?: (ms: number) => void;
  // Optional trim markers
  markers?: { startMs: number; endMs: number } | null;
  onMarkersChange?: (startMs: number, endMs: number) => void; // commit onEnd
  interactive?: boolean; // allow seeking/marker drag
  height?: number; // px
  barWidth?: number; // px
  barGap?: number; // px
  colorClass?: string; // tailwind class for bars
  mode?: WaveformMode; // determines UI complexity and behavior
  showTimeLabels?: boolean; // show time labels below waveform
  enableHaptics?: boolean; // haptic feedback on interactions
  cropMode?: boolean; // simplified crop-only mode
};



// Use centralized waveform processing for consistency
export function processWaveformSamples(
  samples: number[] | null | undefined, 
  durationMs: number, 
  _mode: WaveformMode = "edit" // Keep for API compatibility but use standard processing
): number[] {
  if (!samples || samples.length === 0) {
    return waveformManager.generatePlaceholder(String(durationMs), waveformManager.getStandardSampleCount());
  }
  
  // Always use standard sample count for consistency across modes
  const targetCount = waveformManager.getStandardSampleCount();
  
  if (samples.length <= targetCount) return samples;
  
  // Use centralized downsampling for consistency
  return waveformManager.generateFromLiveValues(samples, targetCount);
}

function msToLabel(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Waveform({ 
  samples, 
  overlaySamples,
  overlayColorClass = "bg-purple-500",
  durationMs, 
  positionMs = 0, 
  onSeek, 
  markers, 
  onMarkersChange, 
  interactive = false, 
  height = 72, 
  barWidth = 2, 
  barGap = 2, 
  colorClass = "bg-blue-500",
  mode = "edit",
  showTimeLabels = false,
  enableHaptics = true,
  cropMode = false
}: WaveformProps) {
  const bars = useMemo(() => {
    return processWaveformSamples(samples, durationMs, mode);
  }, [samples, durationMs, mode]);
  const overlayBars = useMemo(() => {
    if (!overlaySamples || overlaySamples.length === 0) return null as any;
    return processWaveformSamples(overlaySamples, durationMs, mode);
  }, [overlaySamples, durationMs, mode]);

  const baseWidth = useMemo(() => Math.max(1, bars.length * (barWidth + barGap)), [bars.length, barWidth, barGap]);
  const screenWidth = Dimensions.get("window").width;
  
  // Zoom state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  
  const totalWidth = baseWidth;
  const safeTotalWidth = baseWidth || 1;
  const safeDurationMs = durationMs || 1;
  const isScrollable = baseWidth > screenWidth;

  const playheadX = useSharedValue(0);
  React.useEffect(() => {
    const ratio = durationMs > 0 ? Math.max(0, Math.min(1, positionMs / safeDurationMs)) : 0;
    const next = Math.max(0, Math.min(safeTotalWidth, ratio * safeTotalWidth));
    playheadX.value = withTiming(next, { duration: 120 });
  }, [positionMs, safeDurationMs, safeTotalWidth]);
  const playheadStyle = useAnimatedStyle(() => ({ transform: [{ translateX: playheadX.value }] }));

  // Bridge callbacks safely to JS using refs to avoid stale/undefined
  const onSeekRef = useRef<typeof onSeek | null>(onSeek ?? null);
  const onMarkersChangeRef = useRef<typeof onMarkersChange | null>(onMarkersChange ?? null);
  React.useEffect(() => { onSeekRef.current = onSeek ?? null; }, [onSeek]);
  React.useEffect(() => { onMarkersChangeRef.current = onMarkersChange ?? null; }, [onMarkersChange]);

  // Reset zoom when switching audio files
  React.useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    savedTranslateX.value = 0;
    isAnyGestureActive.value = false;
  }, [samples, durationMs]);

  // Cleanup gesture timeout on unmount and add gesture recovery
  React.useEffect(() => {
    // Recovery mechanism for stuck gestures
    const recoveryInterval = setInterval(() => {
      if (isAnyGestureActive.value) {
        // Reset gesture state if stuck for too long
        const now = Date.now();
        if (now - lastHapticTime.current > 5000) { // 5 second timeout
          console.warn("Gesture recovery: resetting stuck gesture state");
          isAnyGestureActive.value = false;
          isStartMarkerActive.value = false;
          isEndMarkerActive.value = false;
          startMarkerScale.value = withSpring(1, { damping: 15, stiffness: 200 });
          endMarkerScale.value = withSpring(1, { damping: 15, stiffness: 200 });
        }
      }
    }, 1000);

    return () => {
      clearInterval(recoveryInterval);
      if (gestureTimeout.current) {
        clearTimeout(gestureTimeout.current);
        gestureTimeout.current = null;
      }
    };
  }, []);

  // Seek gestures (pan + tap)
  const seekBaseX = useSharedValue(0);
  const lastSeekX = useSharedValue(-9999);
  // Optimized haptic feedback with device capability checks and queuing
  const lastHapticTime = useRef<number>(0);
  const hapticQueue = useRef<boolean>(false);
  
  const hapticLight = React.useCallback(() => { 
    try { 
      if (!enableHaptics || hapticQueue.current) return;
      const now = Date.now();
      if (now - lastHapticTime.current < 50) return; // Prevent rapid haptic calls
      
      hapticQueue.current = true;
      lastHapticTime.current = now;
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        .finally(() => {
          hapticQueue.current = false;
        });
    } catch (error) {
      hapticQueue.current = false;
      console.warn("Haptic light failed:", error);
    } 
  }, [enableHaptics]);
  
  const hapticMedium = React.useCallback(() => { 
    try { 
      if (!enableHaptics || hapticQueue.current) return;
      const now = Date.now();
      if (now - lastHapticTime.current < 100) return; // Longer delay for medium haptics
      
      hapticQueue.current = true;
      lastHapticTime.current = now;
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        .finally(() => {
          hapticQueue.current = false;
        });
    } catch (error) {
      hapticQueue.current = false;
      console.warn("Haptic medium failed:", error);
    } 
  }, [enableHaptics]);
  
  const hapticHeavy = React.useCallback(() => { 
    try { 
      if (!enableHaptics || hapticQueue.current) return;
      const now = Date.now();
      if (now - lastHapticTime.current < 150) return; // Longest delay for heavy haptics
      
      hapticQueue.current = true;
      lastHapticTime.current = now;
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        .finally(() => {
          hapticQueue.current = false;
        });
    } catch (error) {
      hapticQueue.current = false;
      console.warn("Haptic heavy failed:", error);
    } 
  }, [enableHaptics]);
  
  const callOnSeek = React.useCallback((ms: number) => { 
    try {
      if (onSeekRef.current && typeof ms === "number" && isFinite(ms)) {
        onSeekRef.current(ms);
      }
    } catch (error) {
      console.warn("Seek callback failed:", error);
    }
  }, []);
  
  // Debounced marker callback with increased debounce time for stability
  const lastMarkerUpdate = useRef<number>(0);
  const callOnMarkers = React.useCallback((s: number, e: number) => { 
    try {
      const now = Date.now();
      if (now - lastMarkerUpdate.current > 100) { // Increased debounce to 100ms for stability
        lastMarkerUpdate.current = now;
        if (onMarkersChangeRef.current && typeof s === "number" && typeof e === "number" && isFinite(s) && isFinite(e)) {
          onMarkersChangeRef.current(s, e);
        }
      }
    } catch (error) {
      console.warn("Marker callback failed:", error);
    }
  }, []);

  // Stable badge update callbacks to prevent inline function creation in worklets
  const updateStartBadge = React.useCallback((ms: number) => {
    try {
      if (typeof ms === "number" && isFinite(ms)) {
        setBadgeStartMs(Math.floor(ms));
      }
    } catch (error) {
      console.warn("Start badge update failed:", error);
    }
  }, []);

  const updateEndBadge = React.useCallback((ms: number) => {
    try {
      if (typeof ms === "number" && isFinite(ms)) {
        setBadgeEndMs(Math.floor(ms));
      }
    } catch (error) {
      console.warn("End badge update failed:", error);
    }
  }, []);

  const panSeek = React.useMemo(() => {
    if (!interactive || !onSeek) return null;
    return Gesture.Pan()
      .minDistance(3)
      .onStart(() => { 
        'worklet';
        seekBaseX.value = playheadX.value; 
        lastSeekX.value = -9999;
        if (enableHaptics) {
          runOnJS(hapticLight)();
        }
      })
      .onUpdate((e) => {
        'worklet';
        try {
          const width = Math.max(1, totalWidth);
          const scaleValue = Math.max(0.0001, scale.value);
          
          if (!isFinite(width) || !isFinite(e.translationX) || !isFinite(scaleValue)) {
            return;
          }
          
          const next = Math.max(0, Math.min(width, seekBaseX.value + e.translationX / scaleValue));
          if (isFinite(next) && next >= 0 && next <= width) {
            playheadX.value = next;
          }
        } catch (error) {
          console.warn("Seek pan update error:", error);
        }
      })
      .onEnd(() => {
        'worklet';
        try {
          const currentDurationMs = Math.max(1, durationMs);
          const currentTotalWidth = Math.max(1, totalWidth);
          const currentPlayheadX = playheadX.value;
          
          if (!isFinite(currentDurationMs) || !isFinite(currentTotalWidth) || !isFinite(currentPlayheadX)) {
            return;
          }
          
          const clampedPlayheadX = Math.max(0, Math.min(currentTotalWidth, currentPlayheadX));
          
          if (currentDurationMs > 0 && currentTotalWidth > 0) {
            const ms = (clampedPlayheadX / currentTotalWidth) * currentDurationMs;
            if (isFinite(ms)) {
              runOnJS(callOnSeek)(ms);
            }
            if (enableHaptics) {
              runOnJS(hapticMedium)();
            }
          }
        } catch (error) {
          console.warn("Seek pan end error:", error);
        }
      });
  }, [interactive, onSeek, totalWidth, durationMs, enableHaptics, callOnSeek, hapticLight, hapticMedium]);

  const tapSeek = React.useMemo(() => {
    if (!interactive || !onSeek) return null;
    return Gesture.Tap().onEnd((e, success) => {
      'worklet';
      try {
        if (!success) return;
        const width = Math.max(1, totalWidth);
        const dur = Math.max(1, durationMs);
        // Map tap to content space accounting for zoom/pan
        const rawX = e.x;
        const x = Math.max(0, Math.min(width, (rawX - translateX.value) / Math.max(0.0001, scale.value)));
        if (Number.isFinite(x)) {
          playheadX.value = withSpring(x, { damping: 15, stiffness: 150 });
        }
        
        if (dur > 0 && width > 0) {
          const ms = (x / width) * dur;
          runOnJS(callOnSeek)(ms);
          if (enableHaptics) runOnJS(hapticLight)();
        }
      } catch (e) {
        // Prevent worklet crashes
      }
    });
  }, [interactive, onSeek, totalWidth, durationMs, enableHaptics, callOnSeek, hapticLight]);

  const combinedSeek = panSeek && tapSeek ? Gesture.Simultaneous(panSeek, tapSeek) : panSeek || tapSeek || undefined;

  // Pinch gesture for zoom
  const pinchGesture = React.useMemo(() => {
    if (!interactive || cropMode !== true) return null;
    return Gesture.Pinch()
      .onStart((e) => {
        'worklet';
        savedScale.value = scale.value;
        savedTranslateX.value = translateX.value;
        focalX.value = e.focalX;
        focalY.value = e.focalY;
        if (enableHaptics) runOnJS(hapticLight)();
      })
      .onUpdate((e) => {
        'worklet';
        // Apply zoom with limits (0.5x to 5.0x)
        const newScale = Math.max(0.5, Math.min(5.0, savedScale.value * e.scale));
        scale.value = newScale;
        
        // Adjust translation to keep focal point centered
        const deltaScale = newScale - savedScale.value;
        const focalOffset = (focalX.value - screenWidth / 2) * deltaScale;
        translateX.value = savedTranslateX.value - focalOffset;
      })
      .onEnd(() => {
        'worklet';
        savedScale.value = scale.value;
        savedTranslateX.value = translateX.value;
        
        // Haptic feedback for zoom milestones
        const currentScale = scale.value;
        if (Math.abs(currentScale - 1.0) < 0.1 || Math.abs(currentScale - 2.0) < 0.1) {
          if (enableHaptics) runOnJS(hapticMedium)();
        }
      });
  }, [interactive, cropMode, enableHaptics, screenWidth, hapticLight, hapticMedium]);

  // Double tap to reset zoom
  const doubleTapGesture = React.useMemo(() => {
    if (!interactive || cropMode !== true) return null;
    return Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        'worklet';
        scale.value = withSpring(1, { damping: 15, stiffness: 150 });
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
        savedScale.value = 1;
        savedTranslateX.value = 0;
        if (enableHaptics) runOnJS(hapticMedium)();
      });
  }, [interactive, cropMode, enableHaptics, hapticMedium]);

  // Marker gestures and interaction state
  const startX = useSharedValue(0);
  const endX = useSharedValue(totalWidth);
  const [badgeStartMs, setBadgeStartMs] = useState(markers?.startMs ?? 0);
  const [badgeEndMs, setBadgeEndMs] = useState(markers?.endMs ?? durationMs);
  
  // Marker interaction state for visual feedback and gesture management
  const isStartMarkerActive = useSharedValue(false);
  const isEndMarkerActive = useSharedValue(false);
  const startMarkerScale = useSharedValue(1);
  const endMarkerScale = useSharedValue(1);
  
  // Gesture state management to prevent conflicts
  const isAnyGestureActive = useSharedValue(false);
  const gestureTimeout = useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (!markers) return;
    const s = Math.max(0, Math.min(1, markers.startMs / Math.max(1, durationMs)));
    const e = Math.max(0, Math.min(1, markers.endMs / Math.max(1, durationMs)));
    startX.value = s * totalWidth;
    endX.value = e * totalWidth;
    setBadgeStartMs(markers.startMs);
    setBadgeEndMs(markers.endMs);
  }, [markers?.startMs, markers?.endMs, durationMs, totalWidth]);

  const startBaseX = useSharedValue(0);
  const endBaseX = useSharedValue(0);

  function snapToLocalMin(px: number) {
    const n = Math.max(1, bars.length);
    const width = Math.max(1, totalWidth);
    const dur = Math.max(1, durationMs);
    if (n < 2) {
      const clampedPx = Math.max(0, Math.min(width, px));
      const snappedMsSingle = Math.max(0, Math.min(dur, (clampedPx / width) * dur));
      return { snappedPx: clampedPx, snappedMs: snappedMsSingle };
    }
    const idx = Math.max(0, Math.min(n - 1, Math.round((px / width) * (n - 1))));
    const radius = 8;
    let bestIdx = idx;
    let best = bars[idx] ?? 1;
    for (let i = Math.max(0, idx - radius); i <= Math.min(n - 1, idx + radius); i++) {
      const v = bars[i] ?? 1;
      if (v < best) { best = v; bestIdx = i; }
    }
    const snappedPx = (bestIdx / (n - 1)) * width;
    const snappedMs = (bestIdx / (n - 1)) * dur;
    return { snappedPx, snappedMs };
  }

  const startMarker = React.useMemo(() => {
    if (!interactive || !onMarkersChange || !markers) return null;
    return Gesture.Pan()
      .minDistance(2) // Reduced for more responsive dragging
      .hitSlop({ left: 15, right: 5, top: 25, bottom: 25 }) // Asymmetric to avoid overlap with end marker
      .onStart(() => { 
        'worklet';
        try {
          // Prevent gesture conflicts
          if (isAnyGestureActive.value) {
            return;
          }
          
          isAnyGestureActive.value = true;
          startBaseX.value = startX.value;
          isStartMarkerActive.value = true;
          startMarkerScale.value = withSpring(1.2, { damping: 15, stiffness: 200 });
          
          if (enableHaptics) {
            runOnJS(hapticMedium)();
          }
        } catch (error) {
          console.warn("Start marker start error:", error);
        }
      })
      .onUpdate((e) => {
        'worklet';
        try {
          const minGapPx = cropMode ? 20 : 12;
          const width = Math.max(1, totalWidth);
          const currentEndX = endX.value;
          
          // Validate all values before calculation
          if (!isFinite(width) || !isFinite(currentEndX) || !isFinite(e.translationX) || !isFinite(scale.value)) {
            return;
          }
          
          const maxPosition = Math.max(0, Math.min(width, currentEndX)) - minGapPx;
          const scaleValue = Math.max(0.0001, scale.value);
          const newValue = Math.max(0, Math.min(maxPosition, startBaseX.value + e.translationX / scaleValue));
          
          if (isFinite(newValue) && newValue >= 0 && newValue <= width) {
            startX.value = newValue;
            // Update badge with stable callback
            const currentMs = (newValue / width) * Math.max(1, durationMs);
            if (isFinite(currentMs)) {
              runOnJS(updateStartBadge)(currentMs);
            }
          }
        } catch (error) {
          // Prevent worklet crashes
          console.warn("Start marker update error:", error);
        }
      })
      .onEnd(() => {
        'worklet';
        try {
          // Reset marker state and gesture lock
          isStartMarkerActive.value = false;
          isAnyGestureActive.value = false;
          startMarkerScale.value = withSpring(1, { damping: 15, stiffness: 200 });
          
          // Validate all values before calculations
          const currentStartX = startX.value;
          const currentEndX = endX.value;
          const currentTotalWidth = Math.max(1, totalWidth);
          const currentDurationMs = Math.max(1, durationMs);
          
          if (!isFinite(currentStartX) || !isFinite(currentEndX) || !isFinite(currentTotalWidth) || !isFinite(currentDurationMs)) {
            return;
          }
          
          const clampedStartX = Math.max(0, Math.min(currentTotalWidth, currentStartX));
          const clampedEndX = Math.max(0, Math.min(currentTotalWidth, currentEndX));
          
          const { snappedPx, snappedMs } = snapToLocalMin(clampedStartX);
          
          if (isFinite(snappedPx) && isFinite(snappedMs)) {
            startX.value = withSpring(snappedPx, { damping: 15, stiffness: 150 });
            const endMs = (clampedEndX / currentTotalWidth) * currentDurationMs;
            const minGapMs = cropMode ? 500 : 250;
            const s = Math.max(0, Math.min(snappedMs, endMs - minGapMs));
            
            if (isFinite(s) && isFinite(endMs)) {
              runOnJS(callOnMarkers)(Math.floor(s), Math.floor(endMs));
            }
          }
          
          if (enableHaptics) {
            runOnJS(hapticHeavy)();
          }
        } catch (error) {
          console.warn("Start marker end error:", error);
        }
      });
  }, [interactive, onMarkersChange, markers, totalWidth, durationMs, enableHaptics, cropMode, callOnMarkers, hapticMedium, hapticHeavy, scale]);

  const endMarker = React.useMemo(() => {
    if (!interactive || !onMarkersChange || !markers) return null;
    return Gesture.Pan()
      .minDistance(2) // Reduced for more responsive dragging
      .hitSlop({ left: 5, right: 15, top: 25, bottom: 25 }) // Asymmetric to avoid overlap with start marker
      .onStart(() => { 
        'worklet';
        try {
          // Prevent gesture conflicts
          if (isAnyGestureActive.value) {
            return;
          }
          
          isAnyGestureActive.value = true;
          endBaseX.value = endX.value;
          isEndMarkerActive.value = true;
          endMarkerScale.value = withSpring(1.2, { damping: 15, stiffness: 200 });
          
          if (enableHaptics) {
            runOnJS(hapticMedium)();
          }
        } catch (error) {
          console.warn("End marker start error:", error);
        }
      })
      .onUpdate((e) => {
        'worklet';
        try {
          const minGapPx = cropMode ? 20 : 12;
          const width = Math.max(1, totalWidth);
          const currentStartX = startX.value;
          
          // Validate all values before calculation
          if (!isFinite(width) || !isFinite(currentStartX) || !isFinite(e.translationX) || !isFinite(scale.value)) {
            return;
          }
          
          const minPosition = Math.max(0, Math.min(width, currentStartX)) + minGapPx;
          const scaleValue = Math.max(0.0001, scale.value);
          const newValue = Math.min(width, Math.max(minPosition, endBaseX.value + e.translationX / scaleValue));
          
          if (isFinite(newValue) && newValue >= 0 && newValue <= width) {
            endX.value = newValue;
            // Update badge with stable callback
            const currentMs = (newValue / width) * Math.max(1, durationMs);
            if (isFinite(currentMs)) {
              runOnJS(updateEndBadge)(currentMs);
            }
          }
        } catch (error) {
          // Prevent worklet crashes
          console.warn("End marker update error:", error);
        }
      })
      .onEnd(() => {
        'worklet';
        try {
          // Reset marker state and gesture lock
          isEndMarkerActive.value = false;
          isAnyGestureActive.value = false;
          endMarkerScale.value = withSpring(1, { damping: 15, stiffness: 200 });
          
          // Validate all values before calculations
          const currentStartX = startX.value;
          const currentEndX = endX.value;
          const currentTotalWidth = Math.max(1, totalWidth);
          const currentDurationMs = Math.max(1, durationMs);
          
          if (!isFinite(currentStartX) || !isFinite(currentEndX) || !isFinite(currentTotalWidth) || !isFinite(currentDurationMs)) {
            return;
          }
          
          const clampedStartX = Math.max(0, Math.min(currentTotalWidth, currentStartX));
          const clampedEndX = Math.max(0, Math.min(currentTotalWidth, currentEndX));
          
          const { snappedPx, snappedMs } = snapToLocalMin(clampedEndX);
          
          if (isFinite(snappedPx) && isFinite(snappedMs)) {
            endX.value = withSpring(snappedPx, { damping: 15, stiffness: 150 });
            const startMs = (clampedStartX / currentTotalWidth) * currentDurationMs;
            const minGapMs = cropMode ? 500 : 250;
            const endMs = Math.max(startMs + minGapMs, Math.min(currentDurationMs, snappedMs));
            
            if (isFinite(startMs) && isFinite(endMs)) {
              runOnJS(callOnMarkers)(Math.floor(startMs), Math.floor(endMs));
            }
          }
          
          if (enableHaptics) {
            runOnJS(hapticHeavy)();
          }
        } catch (error) {
          console.warn("End marker end error:", error);
        }
      });
  }, [interactive, onMarkersChange, markers, totalWidth, durationMs, enableHaptics, cropMode, callOnMarkers, hapticMedium, hapticHeavy, scale]);

  const startStyle = useAnimatedStyle(() => ({ 
    transform: [
      { translateX: startX.value }
    ] 
  }));
  const endStyle = useAnimatedStyle(() => ({ 
    transform: [
      { translateX: endX.value }
    ] 
  }));
  const leftShade = useAnimatedStyle(() => ({ width: startX.value }));
  const rightShade = useAnimatedStyle(() => ({ left: endX.value }));
  const cropHighlight = useAnimatedStyle(() => ({
    left: startX.value,
    width: Math.max(0, endX.value - startX.value),
  }));

  // Zoom and scroll animated styles
  const waveformContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value }
    ],
  }));

  const zoomIndicatorStyle = useAnimatedStyle(() => ({
    opacity: scale.value > 1.1 ? withTiming(1, { duration: 200 }) : withTiming(0, { duration: 200 }),
  }));

  // Optimized bar styling with reduced re-renders and memory usage
  const getBarStyle = React.useCallback((h: number, i: number) => {
    try {
      const baseHeight = Math.max(2, Math.min(height, h * height)); // Clamp height
      const barPosition = bars.length > 0 ? (i / bars.length) * totalWidth : 0;
      
      // Simplified selection check to reduce shared value access
      const isSelected = !markers || (
        barPosition >= (startX.value || 0) && 
        barPosition <= (endX.value || totalWidth)
      );
      
      return {
        width: barWidth,
        height: baseHeight,
        marginRight: barGap,
        opacity: isSelected ? 1 : (cropMode ? 0.3 : 0.7),
      };
    } catch (error) {
      console.warn("Bar style calculation error:", error);
      return {
        width: barWidth,
        height: 2,
        marginRight: barGap,
        opacity: 1,
      };
    }
  }, [height, bars.length, totalWidth, markers, barWidth, barGap, cropMode]);

  const waveformContent = (
    <Animated.View style={[waveformContainerStyle]}>
      <View className="flex-row items-end" style={{ height, width: baseWidth, position: "relative" }}>
        {bars.map((h, i) => (
          <View 
            key={`b-${i}`} 
            className={`${colorClass} rounded-t`} 
            style={getBarStyle(h, i)}
          />
        ))}
        {overlayBars && (
          <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "flex-end" }}>
            {(overlayBars as number[]).map((h: number, i: number) => (
              <View 
                key={`o-${i}`} 
                className={`${overlayColorClass || "bg-purple-500"} rounded-t`} 
                style={{ ...getBarStyle(h, i), opacity: 0.55 }}
              />
            ))}
          </View>
        )}
        
        {/* Enhanced shading outside selection */}
        {markers && (
          <>
            <Animated.View style={[{ 
              position: "absolute", 
              top: 0, 
              bottom: 0, 
              left: 0, 
              backgroundColor: cropMode ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.06)" 
            }, leftShade]} />
            <Animated.View style={[{ 
              position: "absolute", 
              top: 0, 
              bottom: 0, 
              right: 0, 
              backgroundColor: cropMode ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.06)" 
            }, rightShade]} />
            
            {/* Crop selection highlight */}
            {cropMode && (
              <Animated.View style={[{
                position: "absolute",
                top: -2,
                bottom: -2,
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                borderTopWidth: 2,
                borderBottomWidth: 2,
                borderColor: "#3B82F6",
              }, cropHighlight]} />
            )}
          </>
        )}
      </View>
      
      {/* Enhanced playhead with better visibility */}
      <Animated.View style={[{ 
        position: "absolute", 
        top: 0, 
        bottom: 0, 
        width: mode === "simple" ? 3 : 2, 
        backgroundColor: mode === "simple" ? "#F59E0B" : "#1D4ED8",
        borderRadius: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
      }, playheadStyle]} />

      {/* Enhanced handles with better touch targets */}
      {markers && (
        <>
          {/* Start handle */}
          <Animated.View style={[{ position: "absolute", top: 0, bottom: 0 }, startStyle]}>
              <Animated.View style={{ 
                position: "absolute", 
                top: -25, 
                left: -25, 
                backgroundColor: "#10B981", 
                paddingHorizontal: 10, 
                paddingVertical: 4, 
                borderRadius: 12,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                borderWidth: 2,
                borderColor: "white",
                transform: [{ scale: startMarkerScale.value }]
              }}>
                <Text style={{ color: "white", fontSize: cropMode ? 12 : 11, fontWeight: "700" }}>
                  {msToLabel(badgeStartMs)}
                </Text>
              </Animated.View>
              <View style={{ 
                position: "absolute", 
                top: 0, 
                bottom: 0, 
                left: -15, 
                width: cropMode ? 30 : 24, 
                justifyContent: "center", 
                alignItems: "center" 
              }}>
                <Animated.View style={{ 
                  width: cropMode ? 10 : 8, 
                  height: cropMode ? 36 : 32, 
                  backgroundColor: "#10B981", 
                  borderRadius: 6,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.4,
                  shadowRadius: 3,
                  borderWidth: 1,
                  borderColor: "white",
                  transform: [{ scale: startMarkerScale.value }]
                }} />
              </View>
          </Animated.View>
          
          {/* End handle */}
          <Animated.View style={[{ position: "absolute", top: 0, bottom: 0 }, endStyle]}>
              <Animated.View style={{ 
                position: "absolute", 
                top: -25, 
                right: -25, 
                backgroundColor: "#EF4444", 
                paddingHorizontal: 10, 
                paddingVertical: 4, 
                borderRadius: 12,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                borderWidth: 2,
                borderColor: "white",
                transform: [{ scale: endMarkerScale.value }]
            }}>
              <Text style={{ color: "white", fontSize: cropMode ? 12 : 11, fontWeight: "700" }}>
                {msToLabel(badgeEndMs)}
              </Text>
            </Animated.View>
              <View style={{ 
                position: "absolute", 
                top: 0, 
                bottom: 0, 
                right: -15, 
                width: cropMode ? 30 : 24, 
                justifyContent: "center", 
                alignItems: "center" 
              }}>
                <Animated.View style={{ 
                  width: cropMode ? 10 : 8, 
                  height: cropMode ? 36 : 32, 
                  backgroundColor: "#EF4444", 
                  borderRadius: 6,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.4,
                  shadowRadius: 3,
                  borderWidth: 1,
                  borderColor: "white",
                  transform: [{ scale: endMarkerScale.value }]
                }} />
              </View>
          </Animated.View>
        </>
      )}
    </Animated.View>
  );

  const content = (
    <View className="w-full">
      <View className="w-full" style={{ height }}>
        {isScrollable && !cropMode ? (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ height }}
            contentContainerStyle={{ alignItems: "flex-end" }}
          >
            {waveformContent}
          </ScrollView>
        ) : (
          <View style={{ height, overflow: "hidden" }}>
            {waveformContent}
          </View>
        )}
      </View>

      {/* Zoom level indicator */}
      {cropMode && (
        <Animated.View style={[{
          position: "absolute",
          top: -30,
          right: 8,
          backgroundColor: "rgba(0,0,0,0.7)",
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
        }, zoomIndicatorStyle]}>
          <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>
            {scale.value.toFixed(1)}x
          </Text>
        </Animated.View>
      )}
      
      {/* Time labels */}
      {showTimeLabels && (
        <View className="flex-row justify-between mt-2 px-1">
          <Text className="text-gray-500 text-xs">{msToLabel(0)}</Text>
          <Text className="text-gray-500 text-xs">{msToLabel(durationMs / 2)}</Text>
          <Text className="text-gray-500 text-xs">{msToLabel(durationMs)}</Text>
        </View>
      )}
    </View>
  );

  if (interactive && (combinedSeek || startMarker || endMarker || pinchGesture || doubleTapGesture)) {
    // Separate gesture layers to prevent conflicts and crashes
    const markerGestures = [startMarker, endMarker].filter(Boolean) as any[];
    const zoomGestures = [pinchGesture, doubleTapGesture].filter(Boolean) as any[];
    const seekGestures = [combinedSeek].filter(Boolean) as any[];
    
    // Priority-based gesture composition to prevent simultaneous complex operations
    if (markerGestures.length > 0) {
      // Markers have highest priority - allow both to work together
      const markerCombo = markerGestures.length > 1 ? 
        Gesture.Simultaneous(...markerGestures) : markerGestures[0];
      
      if (zoomGestures.length > 0 && seekGestures.length > 0) {
        // Use Race to prevent all three types from running simultaneously
        const zoomCombo = zoomGestures.length > 1 ? 
          Gesture.Simultaneous(...zoomGestures) : zoomGestures[0];
        return <GestureDetector gesture={Gesture.Race(markerCombo, zoomCombo, seekGestures[0])}>{content}</GestureDetector>;
      } else if (zoomGestures.length > 0) {
        const zoomCombo = zoomGestures.length > 1 ? 
          Gesture.Simultaneous(...zoomGestures) : zoomGestures[0];
        return <GestureDetector gesture={Gesture.Race(markerCombo, zoomCombo)}>{content}</GestureDetector>;
      } else if (seekGestures.length > 0) {
        return <GestureDetector gesture={Gesture.Race(markerCombo, seekGestures[0])}>{content}</GestureDetector>;
      } else {
        return <GestureDetector gesture={markerCombo}>{content}</GestureDetector>;
      }
    } else if (zoomGestures.length > 0 && seekGestures.length > 0) {
      // Zoom and seek can work together when no markers
      const zoomCombo = zoomGestures.length > 1 ? 
        Gesture.Simultaneous(...zoomGestures) : zoomGestures[0];
      return <GestureDetector gesture={Gesture.Simultaneous(zoomCombo, seekGestures[0])}>{content}</GestureDetector>;
    } else if (zoomGestures.length > 0) {
      const zoomCombo = zoomGestures.length > 1 ? 
        Gesture.Simultaneous(...zoomGestures) : zoomGestures[0];
      return <GestureDetector gesture={zoomCombo}>{content}</GestureDetector>;
    } else if (seekGestures.length > 0) {
      return <GestureDetector gesture={seekGestures[0]}>{content}</GestureDetector>;
    }
  }
  return content;
}
