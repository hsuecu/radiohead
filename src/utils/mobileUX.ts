import { Dimensions, Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Mobile UX optimization utilities for better touch interactions and responsive design
 */

export interface ScreenDimensions {
  width: number;
  height: number;
  isSmallScreen: boolean;
  isTablet: boolean;
  orientation: "portrait" | "landscape";
}

export interface TouchTargetSizes {
  minimum: number;
  comfortable: number;
  large: number;
}

/**
 * Gets current screen dimensions and device characteristics
 */
export function getScreenDimensions(): ScreenDimensions {
  const { width, height } = Dimensions.get("window");
  const isLandscape = width > height;
  const smallerDimension = Math.min(width, height);
  
  return {
    width,
    height,
    isSmallScreen: smallerDimension < 375, // iPhone SE and smaller
    isTablet: smallerDimension >= 768, // iPad and larger
    orientation: isLandscape ? "landscape" : "portrait"
  };
}

/**
 * Gets recommended touch target sizes based on platform guidelines
 */
export function getTouchTargetSizes(): TouchTargetSizes {
  const { isTablet } = getScreenDimensions();
  
  if (Platform.OS === "ios") {
    return {
      minimum: 44, // Apple HIG minimum
      comfortable: isTablet ? 50 : 44,
      large: isTablet ? 60 : 50
    };
  } else {
    return {
      minimum: 48, // Material Design minimum
      comfortable: isTablet ? 56 : 48,
      large: isTablet ? 64 : 56
    };
  }
}

/**
 * Calculates optimal spacing based on screen size
 */
export function getOptimalSpacing(): {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
} {
  const { isSmallScreen, isTablet } = getScreenDimensions();
  
  if (isTablet) {
    return { xs: 6, sm: 12, md: 20, lg: 32, xl: 48 };
  } else if (isSmallScreen) {
    return { xs: 4, sm: 8, md: 12, lg: 20, xl: 28 };
  } else {
    return { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
  }
}

/**
 * Provides haptic feedback with fallback for unsupported devices
 */
export async function provideTactileFeedback(
  type: "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error" = "light"
): Promise<void> {
  try {
    switch (type) {
      case "light":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case "medium":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case "heavy":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case "selection":
        await Haptics.selectionAsync();
        break;
      case "success":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case "warning":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case "error":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch (error) {
    // Haptics not supported on this device, fail silently
    console.debug("Haptic feedback not available:", error);
  }
}

/**
 * Calculates responsive font sizes based on screen size
 */
export function getResponsiveFontSizes(): {
  xs: number;
  sm: number;
  base: number;
  lg: number;
  xl: number;
  "2xl": number;
  "3xl": number;
} {
  const { isSmallScreen, isTablet } = getScreenDimensions();
  
  if (isTablet) {
    return {
      xs: 14,
      sm: 16,
      base: 18,
      lg: 22,
      xl: 26,
      "2xl": 32,
      "3xl": 40
    };
  } else if (isSmallScreen) {
    return {
      xs: 11,
      sm: 13,
      base: 15,
      lg: 17,
      xl: 20,
      "2xl": 24,
      "3xl": 28
    };
  } else {
    return {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 22,
      "2xl": 28,
      "3xl": 32
    };
  }
}

/**
 * Gets safe area padding for different screen areas
 */
export function getSafeAreaPadding(): {
  horizontal: number;
  vertical: number;
  bottom: number;
} {
  const { isSmallScreen, isTablet } = getScreenDimensions();
  
  if (isTablet) {
    return {
      horizontal: 32,
      vertical: 24,
      bottom: 32
    };
  } else if (isSmallScreen) {
    return {
      horizontal: 16,
      vertical: 12,
      bottom: 20
    };
  } else {
    return {
      horizontal: 24,
      vertical: 16,
      bottom: 24
    };
  }
}

/**
 * Calculates optimal button sizes for different contexts
 */
export function getButtonSizes(): {
  small: { height: number; paddingHorizontal: number };
  medium: { height: number; paddingHorizontal: number };
  large: { height: number; paddingHorizontal: number };
} {
  const { comfortable, large } = getTouchTargetSizes();
  const { isTablet } = getScreenDimensions();
  
  return {
    small: {
      height: comfortable - 8,
      paddingHorizontal: isTablet ? 16 : 12
    },
    medium: {
      height: comfortable,
      paddingHorizontal: isTablet ? 20 : 16
    },
    large: {
      height: large,
      paddingHorizontal: isTablet ? 24 : 20
    }
  };
}

/**
 * Provides optimal hit slop for touch targets
 */
export function getHitSlop(size: "small" | "medium" | "large" = "medium"): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  const slopSizes = {
    small: 8,
    medium: 12,
    large: 16
  };
  
  const slop = slopSizes[size];
  
  return {
    top: slop,
    bottom: slop,
    left: slop,
    right: slop
  };
}

/**
 * Determines if the current device supports advanced gestures
 */
export function supportsAdvancedGestures(): boolean {
  // Most modern devices support advanced gestures
  // This could be expanded to check specific capabilities
  if (Platform.OS === "ios") {
    return true;
  }
  // For Android, check if version is a number and >= 21
  return typeof Platform.Version === "number" && Platform.Version >= 21;
}

/**
 * Gets optimal waveform bar configuration for current screen
 */
export function getWaveformConfig(): {
  barWidth: number;
  barGap: number;
  maxBars: number;
  height: number;
} {
  const { width, isSmallScreen, isTablet } = getScreenDimensions();
  
  if (isTablet) {
    return {
      barWidth: 3,
      barGap: 2,
      maxBars: Math.floor(width / 5),
      height: 100
    };
  } else if (isSmallScreen) {
    return {
      barWidth: 2,
      barGap: 1,
      maxBars: Math.floor(width / 3),
      height: 60
    };
  } else {
    return {
      barWidth: 2,
      barGap: 2,
      maxBars: Math.floor(width / 4),
      height: 80
    };
  }
}

/**
 * Calculates optimal modal sizing and positioning
 */
export function getModalConfig(): {
  maxWidth: number;
  maxHeight: string;
  borderRadius: number;
  padding: number;
} {
  const { width, isTablet } = getScreenDimensions();
  
  if (isTablet) {
    return {
      maxWidth: Math.min(600, width * 0.8),
      maxHeight: "80%",
      borderRadius: 16,
      padding: 24
    };
  } else {
    return {
      maxWidth: width * 0.95,
      maxHeight: "90%",
      borderRadius: 12,
      padding: 20
    };
  }
}

/**
 * Provides optimized scroll behavior settings
 */
export function getScrollConfig(): {
  showsVerticalScrollIndicator: boolean;
  showsHorizontalScrollIndicator: boolean;
  bounces: boolean;
  decelerationRate: "normal" | "fast" | number;
} {
  return {
    showsVerticalScrollIndicator: Platform.OS === "ios",
    showsHorizontalScrollIndicator: false,
    bounces: Platform.OS === "ios",
    decelerationRate: Platform.OS === "ios" ? "normal" : 0.98
  };
}

/**
 * Determines if the device is in a low-power or accessibility mode
 */
export function shouldReduceMotion(): boolean {
  // This would ideally check system accessibility settings
  // For now, we'll use a simple heuristic
  const { isSmallScreen } = getScreenDimensions();
  return isSmallScreen; // Reduce motion on smaller devices
}

/**
 * Gets animation duration based on device capabilities and user preferences
 */
export function getAnimationDuration(type: "fast" | "normal" | "slow" = "normal"): number {
  const shouldReduce = shouldReduceMotion();
  
  const durations = {
    fast: shouldReduce ? 150 : 200,
    normal: shouldReduce ? 200 : 300,
    slow: shouldReduce ? 300 : 500
  };
  
  return durations[type];
}

/**
 * Provides optimal keyboard handling configuration
 */
export function getKeyboardConfig(): {
  behavior: "padding" | "height" | "position";
  keyboardVerticalOffset: number;
} {
  const { isTablet } = getScreenDimensions();
  
  return {
    behavior: Platform.OS === "ios" ? "padding" : "height",
    keyboardVerticalOffset: Platform.OS === "ios" ? (isTablet ? 0 : 64) : 0
  };
}