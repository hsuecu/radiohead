import React, { useMemo } from "react";
import { View, Text } from "react-native";

export default function TimelineRuler({ durationMs, pxPerMs = 0.1 }: { durationMs: number; pxPerMs?: number }) {
  const ticks = useMemo(() => {
    const totalSec = Math.ceil(durationMs / 1000);
    const majorEvery = totalSec > 180 ? 10 : totalSec > 60 ? 5 : 1;
    const out: Array<{ x: number; label?: string; major: boolean }> = [];
    for (let s = 0; s <= totalSec; s++) {
      const major = s % majorEvery === 0;
      const x = s * 1000 * pxPerMs;
      const label = major ? `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}` : undefined;
      out.push({ x, label, major });
    }
    return out;
  }, [durationMs, pxPerMs]);

  return (
    <View style={{ height: 24, width: Math.max(1, durationMs * pxPerMs), backgroundColor: "#F3F4F6", borderColor: "#E5E7EB", borderWidth: 1 }}>
      {ticks.map((t, i) => (
        <View key={i} style={{ position: "absolute", left: t.x, top: 0, bottom: 0, width: 1, backgroundColor: t.major ? "#9CA3AF" : "#D1D5DB" }}>
          {t.label && (
            <Text style={{ position: "absolute", top: 2, left: 4, fontSize: 10, color: "#6B7280" }}>{t.label}</Text>
          )}
        </View>
      ))}
    </View>
  );
}
