import React, { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { 
  useAnimatedRef, 
  useSharedValue, 
  useAnimatedStyle,
  useFrameCallback, 
  withTiming, 
  withRepeat,
  Easing, 
  scrollTo, 
  runOnJS,
  cancelAnimation,
  clamp
} from "react-native-reanimated";
import { useScriptStore } from "../state/scriptStore";
import { cn } from "../utils/cn";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

interface RecordingTeleprompterProps {
  isRecording: boolean;
  visible?: boolean;
  anchor?: "top" | "bottom";
  heightRatio?: number; // 0-1 of screen height
  minimized?: boolean;
  onRequestClose?: () => void;
  onToggleAnchor?: () => void;
  onToggleMinimize?: () => void;
  onHeightRatioChange?: (ratio: number) => void;
  onClose?: () => void; // backward compat
  className?: string;
  // Enhanced props for better UX
  autoStartScrolling?: boolean;
  smartPauseDetection?: boolean;
  showProgressIndicator?: boolean;
  enableGestures?: boolean;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
}

export default function RecordingTeleprompter({ 
  isRecording,
  visible = true,
  anchor = "top",
  heightRatio = 0.5,
  minimized = false,
  onRequestClose,
  onToggleAnchor,
  onToggleMinimize,
  onHeightRatioChange,
  onClose,
  className,
  autoStartScrolling = true,
  smartPauseDetection = true,
  showProgressIndicator = true,
  enableGestures = true,
  onRecordingStart,
  onRecordingStop
}: RecordingTeleprompterProps) {
  const {
    items,
    playbackSpeed,
    fontSize,
    setPlaybackSpeed,
    setFontSize,
    currentScript,
    getCurrentScriptName
  } = useScriptStore();

  const [isScrolling, setIsScrolling] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [scriptProgress, setScriptProgress] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);
  const [bottomBarHeight, setBottomBarHeight] = useState(0);

  // Refs to avoid state loops
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingRef = useRef(false);
  const scrollYRef = useRef(0);
  const isMountedRef = useRef(true);

  // React-side sizes for progress calc
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const animatedRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const scrollingSV = useSharedValue(false);
  const targetSpeedPxPerMs = useSharedValue(0);
  const smoothSpeedPxPerMs = useSharedValue(0);
  const contentH = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const touchingSV = useSharedValue(false);
  const controlsOpacity = useSharedValue(1);
  const recordingPulse = useSharedValue(0);
  const bottomBarAnimatedStyle = useAnimatedStyle(() => ({ opacity: controlsOpacity.value }));

  // Animated styles
  const liveBadgeStyle = useAnimatedStyle(() => ({
    opacity: 0.8 + 0.2 * recordingPulse.value,
    transform: [{ scale: 1 + 0.05 * recordingPulse.value }],
  }));
  const playPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.02 * recordingPulse.value }],
  }));

  const [isTouching, setIsTouching] = useState(false);
  const lastTapTime = useRef(0);
  const tapCount = useRef(0);

  // JS helpers for runOnJS
  const resetDoubleTap = () => { tapCount.current = 0; };
  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => { try { Haptics.impactAsync(style); } catch {} };
  const closeTeleprompter = () => { if (onRequestClose) onRequestClose(); else if (onClose) onClose(); };

  const dims = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ratioSV = useSharedValue(heightRatio);

  // Mirror responsive inputs to shared values for worklet safety
  const screenW = useSharedValue(dims.width);
  const screenH = useSharedValue(dims.height);
  const insetTopSV = useSharedValue(insets.top);
  const insetBottomSV = useSharedValue(insets.bottom);
const insetLeftSV = useSharedValue(insets.left || 0);
const insetRightSV = useSharedValue(insets.right || 0);

// Mirror props into shared values for worklet safety
const anchorSV = useSharedValue(anchor === "top" ? 0 : 1);
const minimizedSV = useSharedValue(minimized ? 1 : 0);

  // Responsive sizing based on device
  const isTablet = dims.width > 768;
  const primaryButtonSize = isTablet ? 72 : 64;

  // Keep shared values in sync
  useEffect(() => { screenW.value = dims.width; screenH.value = dims.height; }, [dims.width, dims.height]);
  useEffect(() => { insetTopSV.value = insets.top; insetBottomSV.value = insets.bottom; insetLeftSV.value = insets.left || 0; insetRightSV.value = insets.right || 0; }, [insets.top, insets.bottom, insets.left, insets.right]);
  useEffect(() => { ratioSV.value = heightRatio; }, [heightRatio]);
useEffect(() => { anchorSV.value = anchor === "top" ? 0 : 1; }, [anchor]);
useEffect(() => { minimizedSV.value = minimized ? 1 : 0; }, [minimized]);

  

  const containerStyle = useAnimatedStyle(() => {
    const tablet = screenW.value > 768;
    const minRatio = tablet ? 0.3 : 0.2; // Larger minimum on tablets
    const maxRatio = tablet ? 0.9 : 0.85; // Larger maximum on tablets
    const isMin = minimizedSV.value === 1;
    const isTop = anchorSV.value === 0;
    const r = isMin ? minRatio : clamp(ratioSV.value, minRatio, maxRatio);
    const h = r * screenH.value;
    
    // Add safe area considerations
    const topOffset = isTop ? insetTopSV.value : 0;
    const bottomOffset = isTop ? 0 : insetBottomSV.value;
    
    return {
      position: "absolute",
      left: insetLeftSV.value,
      right: insetRightSV.value,
      height: h - (isTop ? topOffset : bottomOffset),
      top: isTop ? topOffset : undefined,
      bottom: isTop ? undefined : bottomOffset,
    } as any;
  });

  // Drag handle to resize
  const handlePan = useMemo(() =>
    Gesture.Pan()
      .onUpdate((e) => {
        const direction = anchorSV.value === 0 ? 1 : -1;
        const delta = (direction * e.translationY) / screenH.value;
        ratioSV.value = clamp(ratioSV.value + delta, 0.2, 0.85);
      })
      .onEnd(() => {
        const detents = [0.35, 0.5, 0.7];
        // snap to nearest detent
        let nearest = detents[0];
        let best = Math.abs(ratioSV.value - detents[0]);
        for (let i = 1; i < detents.length; i++) {
          const d = Math.abs(ratioSV.value - detents[i]);
          if (d < best) { best = d; nearest = detents[i]; }
        }
        ratioSV.value = withTiming(nearest, { duration: 180, easing: Easing.out(Easing.quad) });
        if (onHeightRatioChange) runOnJS(onHeightRatioChange)(nearest);
      })
  , []);

  // Swipe up gesture on bottom control bar to reveal advanced controls
  const bottomControlSwipe = useMemo(() =>
    Gesture.Pan()
      .onUpdate((e) => {
        if (e.translationY < -30 && !showAdvancedControls) {
          runOnJS(setShowAdvancedControls)(true);
          runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
        } else if (e.translationY > 30 && showAdvancedControls) {
          runOnJS(setShowAdvancedControls)(false);
          runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
        }
      })
  , [showAdvancedControls]);

  // Enhanced gesture system with double-tap, long-press, and swipe
  const enhancedTouchGesture = useMemo(() => {
    const tap = Gesture.Tap()
      .numberOfTaps(1)
      .onStart(() => {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTime.current;
        
        if (timeSinceLastTap < 300) {
          tapCount.current += 1;
        } else {
          tapCount.current = 1;
        }
        
        lastTapTime.current = now;
        
        // Double tap to toggle scrolling
          if (tapCount.current === 2) {
          runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
          runOnJS(toggleScrolling)();
          runOnJS(resetDoubleTap)();
        } else {
          // Single tap to show controls
          runOnJS(setShowControls)(true);
        }
      });

    const longPress = Gesture.LongPress()
      .minDuration(600)
      .onStart(() => {
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Heavy);
        runOnJS(setShowAdvancedControls)(true);
        runOnJS(setShowControls)(true);
      });

    const swipeDown = Gesture.Fling()
      .direction(2) // DOWN
      .onStart(() => {
        if (anchor === "top") {
          runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
          runOnJS(closeTeleprompter)();
        }
      });

    const swipeUp = Gesture.Fling()
      .direction(1) // UP
      .onStart(() => {
        if (anchor === "bottom") {
          runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
          runOnJS(closeTeleprompter)();
        }
      });

    const pinch = Gesture.Pinch()
      .onUpdate((event) => {
        const newSize = Math.max(16, Math.min(32, fontSize * event.scale));
        runOnJS(setFontSize)(newSize);
      })
      .onEnd(() => {
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
      });

    return Gesture.Race(
      Gesture.Simultaneous(tap, longPress),
      swipeDown,
      swipeUp,
      pinch
    );
  }, [anchor, fontSize, onRequestClose, onClose]);

  // Touch gesture to pause scrolling when user touches (legacy support)
  const touchGesture = useMemo(
    () =>
      Gesture.Native()
        .onTouchesDown(() => {
          touchingSV.value = true;
          runOnJS(setIsTouching)(true);
        })
        .onTouchesUp(() => {
          touchingSV.value = false;
          runOnJS(setIsTouching)(false);
        })
        .onTouchesCancelled(() => {
          touchingSV.value = false;
          runOnJS(setIsTouching)(false);
        })
        .onFinalize(() => {
          touchingSV.value = false;
          runOnJS(setIsTouching)(false);
        }),
    []
  );

  // Keep ref in sync to avoid effect loops
  useEffect(() => { isScrollingRef.current = isScrolling; }, [isScrolling]);

  // Auto-start scrolling when recording begins (loop-safe)
  useEffect(() => {
    if (!autoStartScrolling) return;
    if (isRecording && !isScrollingRef.current) {
      setIsScrolling(true);
      onRecordingStart?.();
    }
    if (!isRecording && isScrollingRef.current) {
      setIsScrolling(false);
      onRecordingStop?.();
    }
  }, [isRecording, autoStartScrolling]);

  // Update scrolling state
  useEffect(() => { 
    scrollingSV.value = isScrolling; 
  }, [isScrolling]);

  // Recording pulse animation
  useEffect(() => {
    if (isRecording) {
      recordingPulse.value = withRepeat(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      cancelAnimation(recordingPulse);
      recordingPulse.value = 0;
    }
  }, [isRecording]);

  // Ensure animation is cancelled on unmount and mark unmounted
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cancelAnimation(recordingPulse);
    };
  }, []);

  // Smart controls auto-hide with enhanced timing (loop-safe)
  useEffect(() => {
    // Clear previous timer
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }

    if (showControls && isScrolling && !isTouching) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        setShowControls(false);
        controlsOpacity.value = withTiming(0.3, { duration: 300 });
      }, smartPauseDetection ? 4000 : 3000);
    } else if (showControls) {
      controlsOpacity.value = withTiming(1, { duration: 200 });
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
    };
  }, [showControls, isScrolling, isTouching, smartPauseDetection]);

  // Calculate script progress and time remaining (throttled)
  useEffect(() => {
    const id = setInterval(() => {
      if (contentHeight > 0 && viewportHeight > 0) {
        const maxY = Math.max(0, contentHeight - viewportHeight);
        const y = scrollYRef.current;
        const progress = Math.min(1, y / Math.max(1, maxY));
        setScriptProgress(progress);
        if (isScrolling) {
          const lineHeight = fontSize * 1.25;
          const wordsPerLine = 7;
          const pxPerSec = (playbackSpeed / 60) * (lineHeight * (1 / wordsPerLine) * 7);
          const pxPerMs = pxPerSec / 1000;
          if (pxPerMs > 0) {
            const remainingPixels = Math.max(0, maxY - y);
            const remainingMs = remainingPixels / pxPerMs;
            setEstimatedTimeRemaining(Math.ceil(remainingMs / 1000));
          }
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [contentHeight, viewportHeight, isScrolling, playbackSpeed, fontSize]);

  // Calculate scroll speed based on playback speed and font size
  useEffect(() => {
    const lineHeight = fontSize * 1.25; // px per line
    const wordsPerLine = 7; // assumption for average words per line
    const pxPerSec = (playbackSpeed / 60) * (lineHeight * (1 / wordsPerLine) * 7);
    const pxPerMs = pxPerSec / 1000;
    targetSpeedPxPerMs.value = pxPerMs;
    smoothSpeedPxPerMs.value = withTiming(pxPerMs, { 
      duration: 250, 
      easing: Easing.linear 
    });
  }, [playbackSpeed, fontSize]);

  // Frame-driven auto-scroll
  useFrameCallback((frame) => {
    if (!scrollingSV.value || touchingSV.value) return;
    
    const dt = frame.timeSincePreviousFrame ?? 16;
    const maxY = Math.max(0, contentH.value - viewportH.value);
    const nextY = scrollY.value + smoothSpeedPxPerMs.value * dt;
    
    if (nextY >= Math.max(0, maxY - 0.5)) {
      scrollY.value = maxY;
      scrollTo(animatedRef, 0, maxY, false);
      runOnJS(setIsScrolling)(false);
      return;
    }
    
    scrollY.value = Math.min(maxY, Math.max(0, nextY));
    scrollTo(animatedRef, 0, scrollY.value, false);
  });



  // Show controls when user touches screen
  useEffect(() => {
    if (isTouching) {
      setShowControls(true);
    }
  }, [isTouching]);

  const toggleScrolling = () => {
    setIsScrolling(!isScrolling);
    setShowControls(true);
  };

  const resetPosition = () => {
    scrollY.value = 0;
    scrollTo(animatedRef, 0, 0, true);
    setShowControls(true);
  };

  const adjustSpeed = (delta: number) => {
    const newSpeed = Math.max(60, Math.min(300, playbackSpeed + delta));
    setPlaybackSpeed(newSpeed);
    setShowControls(true);
  };

  const adjustFontSize = (delta: number) => {
    const newSize = Math.max(16, Math.min(32, fontSize + delta));
    setFontSize(newSize);
    setShowControls(true);
  };

  if (!currentScript || items.length === 0) {
    return (
      <View className={cn("flex-1 items-center justify-center bg-black/80", className)}>
        <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
        <Text className="text-gray-400 text-lg mt-4 mb-2">No script selected</Text>
        <Text className="text-gray-500 text-center mb-6 px-8">
          Select a script to use the teleprompter while recording
        </Text>
        <Pressable onPress={() => (onRequestClose ? onRequestClose() : onClose && onClose())} className="bg-blue-600 px-6 py-3 rounded-lg">
          <Text className="text-white font-medium">Close</Text>
        </Pressable>
      </View>
    );
  }

  if (!visible) return null;

  const roundedStyle = anchor === "top" ? { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 } : { borderTopLeftRadius: 16, borderTopRightRadius: 16 };

  return (
    <Animated.View style={[containerStyle]} pointerEvents="box-none">
      <View className={cn("flex-1 bg-black/85", className)} style={roundedStyle}>
      {/* Minimal Header with Script Info Only */}
      <View className="bg-black/90 px-4 py-2 border-b border-gray-600/30 backdrop-blur-sm">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-white text-sm font-medium">
              {getCurrentScriptName() || "Script"}
            </Text>
            {showProgressIndicator && (
              <View className="flex-row items-center mt-1">
                <View className="flex-1 h-1 bg-gray-700 rounded-full mr-2">
                  <View 
                    className="h-1 bg-blue-500 rounded-full"
                    style={{ width: `${Math.round(scriptProgress * 100)}%` }}
                  />
                </View>
                <Text className="text-gray-300 text-xs min-w-[40px]">
                  {Math.round(scriptProgress * 100)}%
                </Text>
              </View>
            )}
          </View>
          
          {/* Recording Status Indicator with Enhanced Animation */}
          {isRecording && (
            <Animated.View 
              className="flex-row items-center bg-red-600/90 px-3 py-1.5 rounded-full ml-3 shadow-lg"
              style={liveBadgeStyle}
            >
              <View className="w-2 h-2 rounded-full bg-white mr-2" />
              <Text className="text-white text-xs font-bold tracking-wide">LIVE</Text>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Script content with enhanced gesture support */}
      <GestureDetector gesture={enableGestures ? enhancedTouchGesture : touchGesture}>
        <Animated.ScrollView
          ref={animatedRef}
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingTop: 20,
            paddingBottom: Math.max(180, (insets?.bottom || 0) + 120) // Extra space for bottom controls
          }}
          onLayout={(e) => { 
            const h = e.nativeEvent.layout.height;
            viewportH.value = h; 
            setViewportHeight(h);
          }}
          onContentSizeChange={(_, h) => { 
            contentH.value = h; 
            setContentHeight(h);
          }}
          onScroll={(event: any) => {
            const y = event.nativeEvent.contentOffset.y;
            scrollY.value = y;
            scrollYRef.current = y;
          }}
          scrollEventThrottle={16}
        >
          {items.map((item, index) => (
            <View key={item.id} className="mb-6">
              {/* Item header */}
              <Text className="text-blue-400 text-lg font-semibold mb-2">
                {item.title}
              </Text>
              
              {/* Item content */}
              <Text
                className="text-white leading-relaxed"
                style={{ 
                  fontSize,
                  lineHeight: fontSize * 1.4,
                  textShadowColor: "rgba(0, 0, 0, 0.8)",
                  textShadowOffset: { width: 1, height: 1 },
                  textShadowRadius: 2
                }}
              >
                {item.content}
              </Text>

              {/* Separator line */}
              {index < items.length - 1 && (
                <View className="h-px bg-gray-700 mt-6" />
              )}
            </View>
          ))}
          
          {/* End marker */}
          <View className="items-center py-8">
            <Text className="text-gray-500 text-lg">— End of Script —</Text>
            {estimatedTimeRemaining > 0 && isScrolling && (
              <Text className="text-gray-400 text-sm mt-2">
                ~{Math.floor(estimatedTimeRemaining / 60)}:{String(estimatedTimeRemaining % 60).padStart(2, "0")} remaining
              </Text>
            )}
          </View>
        </Animated.ScrollView>
      </GestureDetector>

      {/* Bottom Control Bar - Always Accessible */}
      <GestureDetector gesture={bottomControlSwipe}>
        <Animated.View 
          className="bg-black/95 backdrop-blur-sm border-t border-gray-600/50"
          style={[
            bottomBarAnimatedStyle,
            {
              paddingBottom: (insets?.bottom || 0) + 8,
              paddingTop: 12,
              paddingHorizontal: 16
            }
          ]}
          onLayout={(e) => {
            try { setBottomBarHeight(e.nativeEvent.layout.height || 0); } catch {}
          }}
        >
          {/* Swipe Indicator */}
          <View className="w-full items-center mb-2">
            <View className="w-12 h-1 bg-gray-600 rounded-full" />
          </View>

          {/* Primary Controls Row */}
          <View className="flex-row items-center justify-between mb-3">
            {/* Large Play/Pause Button with Enhanced Status */}
            <View className="items-center">
              <Animated.View style={playPulseStyle}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    toggleScrolling();
                  }}
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    setShowAdvancedControls(true);
                  }}
                  delayLongPress={500}
                  className={cn(
                    "rounded-full items-center justify-center shadow-lg mb-1 border-2",
                    isScrolling ? "bg-red-600 border-red-400" : "bg-green-600 border-green-400"
                  )}
                  style={({ pressed }: { pressed: boolean }) => ({
                    width: primaryButtonSize,
                    height: primaryButtonSize,
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }]
                  })}
                >
                  <Ionicons 
                    name={isScrolling ? "pause" : "play"} 
                    size={32} 
                    color="white" 
                  />
                </Pressable>
              </Animated.View>
              <Text className={cn(
                "text-xs font-medium",
                isScrolling ? "text-red-300" : "text-green-300"
              )}>
                {isScrolling ? "Scrolling" : "Paused"}
              </Text>
              {isScrolling && estimatedTimeRemaining > 0 && (
                <Text className="text-gray-400 text-xs mt-0.5">
                  {Math.floor(estimatedTimeRemaining / 60)}:{String(estimatedTimeRemaining % 60).padStart(2, "0")}
                </Text>
              )}
            </View>

            {/* Secondary Controls Group */}
            <View className="flex-row items-center space-x-4">
              <View className="items-center">
                <Pressable 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    resetPosition();
                  }} 
                  className="w-12 h-12 rounded-full bg-gray-700 items-center justify-center mb-1"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Ionicons name="refresh" size={20} color="white" />
                </Pressable>
                <Text className="text-gray-400 text-xs">Reset</Text>
              </View>

            {showControls && (
              <View className="items-center">
                <Pressable 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowAdvancedControls(!showAdvancedControls);
                  }} 
                  className={cn(
                    "w-12 h-12 rounded-full items-center justify-center mb-1",
                    showAdvancedControls ? "bg-blue-600" : "bg-gray-700"
                  )}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Ionicons name="settings" size={20} color="white" />
                </Pressable>
                <Text className="text-gray-400 text-xs">Settings</Text>
              </View>
            )}
            </View>

            {/* Close Button */}
            <View className="items-center">
              <Pressable 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onRequestClose?.() || onClose?.();
                }} 
                className="w-16 h-16 rounded-full bg-red-600 items-center justify-center shadow-lg mb-1"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Ionicons name="close" size={28} color="white" />
              </Pressable>
              <Text className="text-gray-300 text-xs font-medium">Close</Text>
            </View>
          </View>

          {/* Advanced Controls Row - Expandable */}
          {showAdvancedControls && (
            <Animated.View 
              style={{
                opacity: withTiming(1, { duration: 200 })
              }}
              className="border-t border-gray-700/50 pt-3 mt-2"
            >
              <View className="flex-row items-center justify-around">
                {/* Speed Controls */}
                <View className="items-center">
                  <Text className="text-gray-300 text-xs mb-2 font-medium">Speed</Text>
                  <View className="flex-row items-center">
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        adjustSpeed(-10);
                      }}
                      className="w-10 h-10 rounded-full bg-gray-700 items-center justify-center mr-2"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Ionicons name="remove" size={16} color="white" />
                    </Pressable>
                    <Text className="text-white text-sm mx-2 min-w-[60px] text-center font-medium">
                      {playbackSpeed}
                    </Text>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        adjustSpeed(10);
                      }}
                      className="w-10 h-10 rounded-full bg-gray-700 items-center justify-center ml-2"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Ionicons name="add" size={16} color="white" />
                    </Pressable>
                  </View>
                </View>

                {/* Font Size Controls */}
                <View className="items-center">
                  <Text className="text-gray-300 text-xs mb-2 font-medium">Font Size</Text>
                  <View className="flex-row items-center">
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        adjustFontSize(-2);
                      }}
                      className="w-10 h-10 rounded-full bg-gray-700 items-center justify-center mr-2"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Ionicons name="remove" size={16} color="white" />
                    </Pressable>
                    <Text className="text-white text-sm mx-2 min-w-[50px] text-center font-medium">
                      {fontSize}px
                    </Text>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        adjustFontSize(2);
                      }}
                      className="w-10 h-10 rounded-full bg-gray-700 items-center justify-center ml-2"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Ionicons name="add" size={16} color="white" />
                    </Pressable>
                  </View>
                </View>

                {/* Position Controls */}
                <View className="items-center">
                  <Text className="text-gray-300 text-xs mb-2 font-medium">Position</Text>
                  <View className="flex-row items-center space-x-2">
                    <Pressable 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onToggleAnchor?.();
                      }} 
                      className="w-10 h-10 rounded-full bg-gray-700 items-center justify-center"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Ionicons name={anchor === "top" ? "arrow-down" : "arrow-up"} size={16} color="white" />
                    </Pressable>
                    <Pressable 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onToggleMinimize?.();
                      }} 
                      className="w-10 h-10 rounded-full bg-gray-700 items-center justify-center"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Ionicons name={minimized ? "expand" as any : "remove"} size={16} color="white" />
                    </Pressable>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Floating Show Controls Button */}
      {!showControls && (
        <Pressable
          onPress={() => {
            setShowControls(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={({ pressed }) => ({
            position: "absolute",
            left: 16,
            bottom: (bottomBarHeight || 56) + (insets?.bottom || 0) + 12,
            opacity: pressed ? 0.7 : 1,
            backgroundColor: "rgba(0,0,0,0.8)",
            padding: 12,
            borderRadius: 9999,
            shadowColor: "#000",
            shadowOpacity: 0.4,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
          })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Show controls"
        >
          <Ionicons name="settings" size={20} color="white" />
        </Pressable>
      )}

      {/* Resize handle */}
      <GestureDetector gesture={handlePan}>
        <View style={{ position: "absolute", left: 0, right: 0, [anchor === "top" ? "bottom" : "top"]: 0 } as any} pointerEvents="box-only">
          <View className="w-full items-center">
            <View className="w-16 h-1.5 bg-gray-500 rounded-full my-2" />
          </View>
        </View>
      </GestureDetector>
      </View>
    </Animated.View>
  );
}