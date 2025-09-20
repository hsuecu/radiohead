import { Dimensions, Platform } from "react-native";
import * as Haptics from "expo-haptics";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Mobile-optimized constants
export const MOBILE_CONSTANTS = {
  // Touch target sizes (Apple HIG recommends 44pt minimum)
  MIN_TOUCH_TARGET: 44,
  COMFORTABLE_TOUCH_TARGET: 48,
  
  // Gesture thresholds
  MIN_DRAG_DISTANCE: 8,
  LONG_PRESS_DURATION: 500,
  DOUBLE_TAP_DELAY: 300,
  
  // Timeline specific
  MIN_SEGMENT_WIDTH: 40, // Minimum width for segments to be touchable
  RESIZE_HANDLE_WIDTH: 12, // Wider handles for easier touch
  SNAP_THRESHOLD: 20, // Pixels within which snapping occurs
  
  // Zoom limits for mobile
  MIN_ZOOM: 0.005, // Very zoomed out for overview
  MAX_ZOOM: 2.0, // Very zoomed in for precision
  
  // Screen dimensions
  SCREEN_WIDTH: screenWidth,
  SCREEN_HEIGHT: screenHeight,
  IS_SMALL_SCREEN: screenWidth < 375,
  IS_TABLET: screenWidth >= 768,
};

// Haptic feedback helpers
export const hapticFeedback = {
  light: () => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  },
  
  medium: () => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  },
  
  heavy: () => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  },
  
  selection: () => {
    if (Platform.OS === "ios") {
      Haptics.selectionAsync();
    }
  },
  
  success: () => {
    if (Platform.OS === "ios") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },
  
  warning: () => {
    if (Platform.OS === "ios") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  },
  
  error: () => {
    if (Platform.OS === "ios") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  },
};

// Touch area calculation helpers
export const touchHelpers = {
  // Expand touch area for small targets
  expandTouchArea: (size: number) => {
    const minSize = MOBILE_CONSTANTS.MIN_TOUCH_TARGET;
    if (size < minSize) {
      const expansion = (minSize - size) / 2;
      return {
        top: expansion,
        bottom: expansion,
        left: expansion,
        right: expansion,
      };
    }
    return { top: 8, bottom: 8, left: 8, right: 8 };
  },
  
  // Check if point is within touch area
  isWithinTouchArea: (
    touchX: number,
    touchY: number,
    targetX: number,
    targetY: number,
    targetWidth: number,
    targetHeight: number,
    padding = 8
  ) => {
    return (
      touchX >= targetX - padding &&
      touchX <= targetX + targetWidth + padding &&
      touchY >= targetY - padding &&
      touchY <= targetY + targetHeight + padding
    );
  },
  
  // Calculate optimal zoom level for mobile viewing
  calculateOptimalZoom: (contentWidth: number, availableWidth: number) => {
    const zoom = availableWidth / contentWidth;
    return Math.max(MOBILE_CONSTANTS.MIN_ZOOM, Math.min(MOBILE_CONSTANTS.MAX_ZOOM, zoom));
  },
};

// Gesture state management
export class GestureStateManager {
  private activeGestures = new Set<string>();
  private gestureData = new Map<string, any>();
  
  startGesture(id: string, data?: any) {
    this.activeGestures.add(id);
    if (data) {
      this.gestureData.set(id, data);
    }
    hapticFeedback.light();
  }
  
  updateGesture(id: string, data: any) {
    if (this.activeGestures.has(id)) {
      this.gestureData.set(id, { ...this.gestureData.get(id), ...data });
    }
  }
  
  endGesture(id: string) {
    this.activeGestures.delete(id);
    this.gestureData.delete(id);
    hapticFeedback.selection();
  }
  
  isGestureActive(id: string) {
    return this.activeGestures.has(id);
  }
  
  getGestureData(id: string) {
    return this.gestureData.get(id);
  }
  
  hasActiveGestures() {
    return this.activeGestures.size > 0;
  }
  
  cancelAllGestures() {
    this.activeGestures.clear();
    this.gestureData.clear();
  }
}

// Timeline-specific mobile optimizations
export const timelineHelpers = {
  // Calculate segment position with mobile-friendly snapping
  calculateSegmentPosition: (
    rawPosition: number,
    pixelsPerMs: number,
    snapToGrid: boolean,
    gridSizeMs: number,
    snapThreshold = MOBILE_CONSTANTS.SNAP_THRESHOLD
  ) => {
    const timeMs = rawPosition / pixelsPerMs;
    
    if (snapToGrid && gridSizeMs > 0) {
      const gridPosition = Math.round(timeMs / gridSizeMs) * gridSizeMs;
      const gridPixelPosition = gridPosition * pixelsPerMs;
      
      // Only snap if within threshold
      if (Math.abs(rawPosition - gridPixelPosition) <= snapThreshold) {
        return gridPosition;
      }
    }
    
    return timeMs;
  },
  
  // Ensure minimum segment width for touch interaction
  enforceMinimumSegmentWidth: (
    startMs: number,
    endMs: number,
    minWidthMs = 100 // 100ms minimum
  ) => {
    const currentWidth = endMs - startMs;
    if (currentWidth < minWidthMs) {
      return {
        startMs,
        endMs: startMs + minWidthMs,
      };
    }
    return { startMs, endMs };
  },
  
  // Calculate zoom level that maintains usable segment sizes
  calculateMobileOptimalZoom: (
    segments: Array<{ startMs: number; endMs: number }>,
    availableWidth: number,
    totalDurationMs: number
  ) => {
    if (segments.length === 0) {
      return touchHelpers.calculateOptimalZoom(totalDurationMs, availableWidth);
    }
    
    // Find shortest segment
    const shortestSegment = segments.reduce((shortest, segment) => {
      const duration = segment.endMs - segment.startMs;
      return duration < shortest ? duration : shortest;
    }, Infinity);
    
    // Ensure shortest segment is at least minimum width
    const minZoom = MOBILE_CONSTANTS.MIN_SEGMENT_WIDTH / shortestSegment;
    const maxZoom = availableWidth / totalDurationMs;
    
    return Math.max(
      MOBILE_CONSTANTS.MIN_ZOOM,
      Math.min(MOBILE_CONSTANTS.MAX_ZOOM, Math.max(minZoom, maxZoom))
    );
  },
};

// Performance optimization helpers
export const performanceHelpers = {
  // Throttle function for high-frequency events
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return function (this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },
  
  // Debounce function for expensive operations
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout;
    return function (this: any, ...args: Parameters<T>) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  },
  
  // Check if device has sufficient performance for smooth animations
  shouldUseReducedAnimations: () => {
    // Simple heuristic based on screen size and platform
    return MOBILE_CONSTANTS.IS_SMALL_SCREEN || Platform.OS === "android";
  },
};

export default {
  MOBILE_CONSTANTS,
  hapticFeedback,
  touchHelpers,
  GestureStateManager,
  timelineHelpers,
  performanceHelpers,
};