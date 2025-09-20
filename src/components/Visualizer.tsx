import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable, Text } from "react-native";
import { Canvas, Rect, Circle, Path, Skia } from "@shopify/react-native-skia";
import { getWinampTheme, getSpectrumBarColor, WinampDesign, type WinampTheme } from "../utils/winampThemes";

interface VisualizerProps {
  width: number;
  height: number;
  theme?: "spectrum" | "waveform" | "particles" | "rings" | "pulse";
  intensity?: number; // 0..1
  isActive?: boolean;
  onThemeChange?: (theme: "spectrum" | "waveform" | "particles" | "rings" | "pulse") => void;
  winampTheme?: WinampTheme;
}

// Enhanced music-reactive pseudo-signal with multiple frequency bands
function useReactiveSignal(isActive: boolean, intensity: number) {
  const [signal, setSignal] = useState({ bass: 0.2, mid: 0.2, treble: 0.2, overall: 0.2 });
  
  useEffect(() => {
    let raf: number;
    let t = 0;
    const loop = () => {
      t += 0.033; // 30fps for performance
      
      if (!isActive) {
        setSignal({ bass: 0.1, mid: 0.1, treble: 0.1, overall: 0.1 });
        raf = requestAnimationFrame(loop);
        return;
      }
      
      // Simulate different frequency bands with realistic patterns
      const bassFreq = Math.sin(t * 0.8) + Math.sin(t * 1.2 + 0.5) * 0.7;
      const midFreq = Math.sin(t * 2.1 + 1.2) + Math.sin(t * 1.8 + 2.1) * 0.6;
      const trebleFreq = Math.sin(t * 3.2 + 2.5) + Math.sin(t * 2.9 + 1.8) * 0.5;
      
      // Add some randomness for natural feel
      const randomBass = Math.sin(t * 0.3 + Math.sin(t * 0.1) * 2) * 0.3;
      const randomMid = Math.sin(t * 0.7 + Math.sin(t * 0.15) * 1.5) * 0.25;
      const randomTreble = Math.sin(t * 1.1 + Math.sin(t * 0.2) * 1.2) * 0.2;
      
      const bass = Math.max(0, (bassFreq + randomBass) * 0.5 + 0.3) * intensity;
      const mid = Math.max(0, (midFreq + randomMid) * 0.5 + 0.3) * intensity;
      const treble = Math.max(0, (trebleFreq + randomTreble) * 0.5 + 0.3) * intensity;
      const overall = (bass + mid + treble) / 3;
      
      setSignal(prev => ({
        bass: prev.bass * 0.8 + bass * 0.2,
        mid: prev.mid * 0.8 + mid * 0.2,
        treble: prev.treble * 0.8 + treble * 0.2,
        overall: prev.overall * 0.8 + overall * 0.2
      }));
      
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isActive, intensity]);
  
  return signal;
}

function SpectrumVisualizer({ width, height, signal, winampTheme = "classic" }: { width: number; height: number; signal: any; winampTheme?: WinampTheme }) {
  const colors = getWinampTheme(winampTheme);
  const bars = 64; // Classic Winamp bar count
  const barGap = WinampDesign.dimensions.spectrumBarGap;
  const barW = Math.max(WinampDesign.dimensions.spectrumBarWidth, (width - (bars - 1) * barGap) / bars);
  
  const barsData = useMemo(() => {
    return Array.from({ length: bars }, (_, i) => {
      const freq = i / bars;
      let amplitude = 0;
      
      // Different frequency bands respond differently
      if (freq < 0.3) amplitude = signal.bass; // Bass
      else if (freq < 0.7) amplitude = signal.mid; // Mid
      else amplitude = signal.treble; // Treble
      
      // Add some variation across the spectrum for realism
      const variation = Math.sin(freq * Math.PI * 4) * 0.2 + 0.8;
      const finalAmplitude = amplitude * variation;
      const barHeight = Math.max(2, height * (0.05 + finalAmplitude * 0.9));
      
      return {
        x: i * (barW + barGap),
        y: height - barHeight,
        width: barW,
        height: barHeight,
        color: getSpectrumBarColor(freq, finalAmplitude, winampTheme),
        frequency: freq,
        amplitude: finalAmplitude
      };
    });
  }, [signal, bars, height, barW, barGap, winampTheme]);
  
  return (
    <>
      {/* Dark background */}
      <Rect x={0} y={0} width={width} height={height} color={colors.spectrumBg} />
      
      {/* Grid lines for classic look */}
      {Array.from({ length: 5 }, (_, i) => (
        <Rect
          key={`grid-${i}`}
          x={0}
          y={height * (i + 1) / 6}
          width={width}
          height={0.5}
          color={colors.chromeDark}
          opacity={0.3}
        />
      ))}
      
      {/* Spectrum bars */}
      {barsData.map((bar, i) => (
        <Rect
          key={i}
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={bar.height}
          color={bar.color}
        />
      ))}
    </>
  );
}

function WaveformVisualizer({ width, height, signal, winampTheme = "classic" }: { width: number; height: number; signal: any; winampTheme?: WinampTheme }) {
  const colors = getWinampTheme(winampTheme);
  const points = 100;
  const path = Skia.Path.Make();
  
  const wavePoints = useMemo(() => {
    const pts = [];
    for (let i = 0; i < points; i++) {
      const x = (i / (points - 1)) * width;
      const phase = (i / points) * Math.PI * 4;
      const amplitude = signal.overall * 0.4;
      const y = height / 2 + Math.sin(phase) * amplitude * height * 0.3;
      pts.push({ x, y });
    }
    return pts;
  }, [signal, width, height, points]);
  
  path.moveTo(wavePoints[0].x, wavePoints[0].y);
  wavePoints.slice(1).forEach(point => path.lineTo(point.x, point.y));
  
  return (
    <>
      <Rect x={0} y={0} width={width} height={height} color={colors.spectrumBg} />
      <Path path={path} style="stroke" strokeWidth={2} color={colors.ledGreen} />
    </>
  );
}

function ParticlesVisualizer({ width, height, signal, winampTheme = "classic" }: { width: number; height: number; signal: any; winampTheme?: WinampTheme }) {
  const colors = getWinampTheme(winampTheme);
  const particleCount = 30;
  
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => {
      const baseX = (i / particleCount) * width;
      const baseY = height / 2;
      const offsetX = (Math.sin(i * 0.5 + signal.overall * 10) * signal.overall * 50);
      const offsetY = (Math.cos(i * 0.3 + signal.overall * 8) * signal.overall * 40);
      const size = 2 + signal.overall * 8;
      
      return {
        x: baseX + offsetX,
        y: baseY + offsetY,
        size,
        opacity: 0.3 + signal.overall * 0.7
      };
    });
  }, [signal, width, height, particleCount]);
  
  return (
    <>
      <Rect x={0} y={0} width={width} height={height} color={colors.spectrumBg} />
      {particles.map((particle, i) => (
        <Circle
          key={i}
          cx={particle.x}
          cy={particle.y}
          r={particle.size}
          color={colors.ledGreen}
          opacity={particle.opacity}
        />
      ))}
    </>
  );
}

function RingsVisualizer({ width, height, signal, winampTheme = "classic" }: { width: number; height: number; signal: any; winampTheme?: WinampTheme }) {
  const colors = getWinampTheme(winampTheme);
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) / 2 - 10;
  
  const rings = useMemo(() => {
    return [
      { radius: maxRadius * 0.8 * signal.bass, color: colors.spectrumHigh, opacity: signal.bass },
      { radius: maxRadius * 0.6 * signal.mid, color: colors.spectrumMid, opacity: signal.mid },
      { radius: maxRadius * 0.4 * signal.treble, color: colors.spectrumLow, opacity: signal.treble },
    ];
  }, [signal, maxRadius, colors]);
  
  return (
    <>
      <Rect x={0} y={0} width={width} height={height} color={colors.spectrumBg} />
      {rings.map((ring, i) => (
        <Circle
          key={i}
          cx={centerX}
          cy={centerY}
          r={ring.radius}
          style="stroke"
          strokeWidth={2}
          color={ring.color}
          opacity={ring.opacity}
        />
      ))}
    </>
  );
}

function PulseVisualizer({ width, height, signal, winampTheme = "classic" }: { width: number; height: number; signal: any; winampTheme?: WinampTheme }) {
  const colors = getWinampTheme(winampTheme);
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) / 3;
  const radius = maxRadius * (0.3 + signal.overall * 0.7);
  
  return (
    <>
      <Rect x={0} y={0} width={width} height={height} color={colors.spectrumBg} />
      <Circle
        cx={centerX}
        cy={centerY}
        r={radius}
        color={colors.ledGreen}
        opacity={0.3 + signal.overall * 0.5}
      />
    </>
  );
}

export function Visualizer({ width, height, theme = "spectrum", intensity = 0.8, isActive = false, onThemeChange, winampTheme = "classic" }: VisualizerProps) {
  const signal = useReactiveSignal(isActive, intensity);
  const colors = getWinampTheme(winampTheme);
  
  const themes: Array<"spectrum" | "waveform" | "particles" | "rings" | "pulse"> = ["spectrum", "waveform", "particles", "rings", "pulse"];
  const currentIndex = themes.indexOf(theme);
  
  const handleThemeChange = () => {
    const nextIndex = (currentIndex + 1) % themes.length;
    onThemeChange?.(themes[nextIndex]);
  };
  
  return (
    <Pressable onPress={handleThemeChange} style={{ width, height }}>
      <Canvas style={{ width, height }}>
        {theme === "spectrum" && <SpectrumVisualizer width={width} height={height} signal={signal} winampTheme={winampTheme} />}
        {theme === "waveform" && <WaveformVisualizer width={width} height={height} signal={signal} winampTheme={winampTheme} />}
        {theme === "particles" && <ParticlesVisualizer width={width} height={height} signal={signal} winampTheme={winampTheme} />}
        {theme === "rings" && <RingsVisualizer width={width} height={height} signal={signal} winampTheme={winampTheme} />}
        {theme === "pulse" && <PulseVisualizer width={width} height={height} signal={signal} winampTheme={winampTheme} />}
      </Canvas>
      
      {/* Winamp-style theme indicator */}
      <View style={{
        position: "absolute",
        bottom: WinampDesign.spacing.sm,
        right: WinampDesign.spacing.sm,
        backgroundColor: colors.darkBg,
        paddingHorizontal: WinampDesign.spacing.sm,
        paddingVertical: WinampDesign.spacing.xs,
        borderRadius: 2,
        ...WinampDesign.borders.dark
      }}>
        <Text style={{
          ...WinampDesign.fonts.display,
          color: colors.ledGreen,
          fontSize: 10,
          textTransform: "uppercase"
        }}>{theme}</Text>
      </View>
    </Pressable>
  );
}
