import React from "react";
import { View, Text } from "react-native";
import { cn } from "../utils/cn";

type Props = {
  title?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export default function Card({ title, right, children, className }: Props) {
  return (
    <View className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-4", className)} style={{ elevation: 1 }}>
      {(title || right) && (
        <View className="flex-row items-center justify-between mb-2">
          {title ? <Text className="text-lg font-semibold text-gray-800">{title}</Text> : <View />}
          {right ? <View>{right}</View> : null}
        </View>
      )}
      {children}
    </View>
  );
}
