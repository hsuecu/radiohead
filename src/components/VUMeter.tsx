import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface Props {
  level: number; // 0..1 linear
  peak?: number; // 0..1 linear
  unsupported?: boolean;
  clip?: boolean;
  showScale?: boolean;
  showScaleLabels?: boolean; // default false, hide numeric labels when using dB pill
  currentDb?: number | null; // negative dBFS
  dbFloor?: number; // e.g. -60
}

const NUM_BARS = 12;
const CONTAINER_HEIGHT = 96; // px
const PADDING_V = 8; // py-2

function barColor(idx: number, activeBars: number) {
  const ratio = idx / (NUM_BARS - 1);
  if (idx >= activeBars) return "bg-gray-200";
  if (ratio < 0.6) return "bg-green-500";
  if (ratio < 0.85) return "bg-yellow-500";
  return "bg-red-500";
}

function clamp(v: number, min = 0, max = 1) { return Math.max(min, Math.min(max, v)); }

export default function VUMeter({ level, peak = 0, unsupported, clip = false, showScale = false, showScaleLabels = false, currentDb = null, dbFloor = -60 }: Props) {
  const clamped = clamp(level);
  const activeBars = Math.round(clamped * NUM_BARS);
  const peakBar = Math.round(Math.max(clamped, peak) * NUM_BARS);

  const ticks = showScale ? [0, -6, -12, -18, -30, -60].filter((t) => t >= dbFloor) : [];
  const mapDbToRatio = (db: number) => clamp((db - dbFloor) / (0 - dbFloor));
  const contentH = CONTAINER_HEIGHT - PADDING_V * 2;

  // Smoothed dB readout
  const [smoothedDb, setSmoothedDb] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (typeof currentDb !== "number") { setSmoothedDb(null); return; }
    setSmoothedDb((prev) => {
      if (prev == null) return currentDb as number;
      const alpha = 0.2; // 20% new, 80% old
      return (1 - alpha) * prev + alpha * (currentDb as number);
    });
  }, [currentDb]);

  const pillText = smoothedDb != null ? `${smoothedDb.toFixed(1)} dB` : "";
  const inTarget = smoothedDb != null && smoothedDb <= -12 && smoothedDb >= -18;
  const pillColor = clip ? "#DC2626" : inTarget ? "#10B981" : "#F59E0B";

  return (
    <View>
      <View className="bg-gray-50 rounded-lg border border-gray-200" style={{ height: CONTAINER_HEIGHT, overflow: "hidden", position: "relative", paddingHorizontal: 8, paddingVertical: PADDING_V }}>
        {/* Bars */}
        <View className="flex-row items-end justify-between" style={{ height: contentH }}>
          {Array.from({ length: NUM_BARS }).map((_, i) => {
            const isPeak = i === peakBar - 1 && peakBar > 0;
            return (
              <View key={i} className="items-center" style={{ width: `${100 / NUM_BARS}%` }}>
                <View className={`${barColor(i, activeBars)} ${isPeak ? "ring-2 ring-red-400" : ""} w-2 rounded-t`} style={{ height: `${((i + 1) / NUM_BARS) * (clamped * 100)}%` }} />
              </View>
            );
          })}
        </View>
        {/* Grid overlay (ticks and labels) */}
        {showScale && (
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
            {ticks.map((db) => {
              const ratio = mapDbToRatio(db);
              const top = PADDING_V + (1 - ratio) * contentH;
              return (
                <View key={db} style={{ position: "absolute", left: 0, right: 0, top }}>
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "#E5E7EB" }} />
                  {showScaleLabels && (
                    <View style={{ position: "absolute", right: 2, top: -7 }}>
                      <Text className="text-gray-400" style={{ fontSize: 9 }}>{db}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
        {/* dB pill */}
        {pillText !== "" && (
          <View style={{ position: "absolute", right: 8, top: 6, backgroundColor: pillColor, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 }}>
            <Text style={{ color: "white", fontSize: 12 }}>{pillText}</Text>
          </View>
        )}
      </View>
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-gray-700 font-medium">Input Level</Text>
        {unsupported ? (
          <Text className="text-gray-400 text-xs">Metering not supported</Text>
        ) : clip ? (
          <Text className="text-red-600 text-xs font-semibold">Clipping - reduce level</Text>
        ) : (
          <Text className="text-gray-400 text-xs">Target -18 to -12 dB</Text>
        )}
      </View>
    </View>
  );
}
