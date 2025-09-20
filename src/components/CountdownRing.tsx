import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";

export type CountdownRingProps = {
  size?: number;
  dotRadius?: number;
  color?: string;
  bgColor?: string;
  target: Date; // top-of-hour target
  now: Date; // current time (updates each second)
};

export default function CountdownRing({ size = 88, dotRadius = 2.5, color = "#EF4444", bgColor = "#E5E7EB", target, now }: CountdownRingProps) {
  // Seconds remaining to top of hour and within the current minute
  const totalSecs = 60 * 60;
  const secsToTop = Math.max(0, Math.min(totalSecs, Math.floor((target.getTime() - now.getTime()) / 1000)));
  const mm = Math.floor(secsToTop / 60).toString().padStart(2, "0");
  const ssNum = Math.floor(secsToTop % 60);
  const ss = ssNum.toString().padStart(2, "0");

  const cx = size / 2;
  const cy = size / 2;
  const ringR = (size / 2) - (dotRadius + 4);

  // We will render 60 dots around the circle, starting from the top (-90°), clockwise
  const dots = Array.from({ length: 60 }, (_, i) => i);
  const secRemaining = ssNum; // red dots count down with seconds
  const activeIdx = Math.max(0, secRemaining - 1);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessibilityRole="image" accessibilityLabel={`${mm} minutes ${ss} seconds to the top of the hour`}>
      <Svg width={size} height={size}>
        {dots.map((i) => {
          const angle = (i / 60) * Math.PI * 2 - Math.PI / 2; // start at top
          const x = cx + ringR * Math.cos(angle);
          const y = cy + ringR * Math.sin(angle);
          const isRed = i < secRemaining; // countdown: fewer red dots as seconds decrease
          const isActive = i === activeIdx;
          const r = isActive ? dotRadius + 0.8 : dotRadius;
          return <Circle key={i} cx={x} cy={y} r={r} fill={isRed ? color : bgColor} />;
        })}
      </Svg>
      <Text style={{ position: "absolute", fontSize: 16, fontWeight: "700", color: "#111827" }}>{mm}:{ss}</Text>
    </View>
  );
}
