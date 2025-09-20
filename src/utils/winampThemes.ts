// Winamp-inspired color themes and design constants
export const WinampColors = {
  // Classic Winamp Black Theme
  classic: {
    // Backgrounds
    mainBg: "#000000",
    darkBg: "#0a0a0a", 
    chromeBg: "#1a1a1a",
    chromeLight: "#333333",
    chromeDark: "#0f0f0f",
    
    // LED Displays
    ledGreen: "#00ff00",
    ledGreenDim: "#008800",
    ledOrange: "#ff6600",
    ledRed: "#ff0000",
    ledOff: "#003300",
    
    // Spectrum Colors
    spectrumLow: "#00ff00",    // Green for low frequencies
    spectrumMid: "#ffff00",    // Yellow for mid frequencies  
    spectrumHigh: "#ff0000",   // Red for high frequencies
    spectrumBg: "#000000",
    
    // Button States
    buttonNormal: "#1a1a1a",
    buttonPressed: "#0f0f0f",
    buttonHover: "#2a2a2a",
    
    // Text
    textPrimary: "#ffffff",
    textSecondary: "#cccccc",
    textLed: "#00ff00",
    textDim: "#666666",
  },
  
  // Alternative "Amp" theme (blue-black tint)
  amp: {
    mainBg: "#000011",
    darkBg: "#000008",
    chromeBg: "#1a1a2a",
    chromeLight: "#333344",
    chromeDark: "#0f0f1a",
    
    ledGreen: "#0088ff",
    ledGreenDim: "#004488",
    ledOrange: "#ff8800",
    ledRed: "#ff0044",
    ledOff: "#000033",
    
    spectrumLow: "#0088ff",
    spectrumMid: "#00ffff", 
    spectrumHigh: "#ff0088",
    spectrumBg: "#000011",
    
    buttonNormal: "#1a1a2a",
    buttonPressed: "#0f0f1a",
    buttonHover: "#2a2a3a",
    
    textPrimary: "#ffffff",
    textSecondary: "#ccccdd",
    textLed: "#0088ff",
    textDim: "#666677",
  }
} as const;

export type WinampTheme = keyof typeof WinampColors;

// Design constants for consistent Winamp styling
export const WinampDesign = {
  // Border and shadow styles
  borders: {
    chrome: {
      borderWidth: 1,
      borderTopColor: "#333333",
      borderLeftColor: "#333333", 
      borderRightColor: "#0f0f0f",
      borderBottomColor: "#0f0f0f",
    },
    chromePressed: {
      borderWidth: 1,
      borderTopColor: "#0f0f0f",
      borderLeftColor: "#0f0f0f",
      borderRightColor: "#333333", 
      borderBottomColor: "#333333",
    },
    dark: {
      borderWidth: 1,
      borderColor: "#333333",
    }
  },
  
  // Typography
  fonts: {
    led: {
      fontFamily: "Courier New, monospace",
      fontWeight: "bold" as const,
    },
    display: {
      fontFamily: "Courier New, monospace", 
      fontWeight: "normal" as const,
    },
    ui: {
      fontFamily: "system",
      fontWeight: "normal" as const,
    }
  },
  
  // Spacing and sizing
  spacing: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },
  
  // Component dimensions
  dimensions: {
    buttonHeight: 24,
    ledHeight: 16,
    spectrumBarWidth: 3,
    spectrumBarGap: 1,
    chromeInset: 2,
  },
  
  // Animation durations
  animations: {
    fast: 100,
    normal: 200,
    slow: 300,
  }
} as const;

// Helper function to get current theme colors
export function getWinampTheme(theme: WinampTheme = "classic") {
  return WinampColors[theme];
}

// Helper to create chrome button style
export function createChromeButtonStyle(pressed: boolean = false, theme: WinampTheme = "classic") {
  const colors = getWinampTheme(theme);
  const borders = pressed ? WinampDesign.borders.chromePressed : WinampDesign.borders.chrome;
  
  return {
    backgroundColor: pressed ? colors.buttonPressed : colors.buttonNormal,
    ...borders,
    minHeight: WinampDesign.dimensions.buttonHeight,
    paddingHorizontal: WinampDesign.spacing.md,
    paddingVertical: WinampDesign.spacing.sm,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
}

// Helper to create LED text style
export function createLedTextStyle(theme: WinampTheme = "classic", dim: boolean = false) {
  const colors = getWinampTheme(theme);
  
  return {
    ...WinampDesign.fonts.led,
    color: dim ? colors.ledGreenDim : colors.ledGreen,
    textShadowColor: colors.ledGreen,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  };
}

// Helper to create spectrum bar color based on frequency and amplitude
export function getSpectrumBarColor(frequency: number, amplitude: number, theme: WinampTheme = "classic") {
  const colors = getWinampTheme(theme);
  
  if (amplitude < 0.1) return colors.ledOff;
  
  // Color based on frequency bands
  if (frequency < 0.3) {
    // Bass - green to yellow
    const mix = Math.min(1, amplitude * 2);
    return mix > 0.7 ? colors.spectrumMid : colors.spectrumLow;
  } else if (frequency < 0.7) {
    // Mid - yellow to orange
    const mix = Math.min(1, amplitude * 2);
    return mix > 0.7 ? colors.ledOrange : colors.spectrumMid;
  } else {
    // Treble - orange to red
    const mix = Math.min(1, amplitude * 2);
    return mix > 0.7 ? colors.spectrumHigh : colors.ledOrange;
  }
}