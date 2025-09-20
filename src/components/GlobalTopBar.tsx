import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { navigationRef } from "../navigation/navigationRef";

export default function GlobalTopBar() {
  const insets = useSafeAreaInsets();
  const [routeName, setRouteName] = useState<string | undefined>(undefined);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const update = () => {
      try {
        setRouteName(navigationRef.getCurrentRoute()?.name);
        setCanGoBack(navigationRef.canGoBack());
      } catch {}
    };
    update();
    const id = setInterval(update, 300);
    return () => clearInterval(id);
  }, []);

  if (routeName === "Login") return null;

  const onBack = () => {
    try { if (navigationRef.isReady() && navigationRef.canGoBack()) navigationRef.goBack(); } catch {}
  };
  const onHome = () => {
    try {
      if (!navigationRef.isReady()) return;
      // Navigate to the Record tab inside Main tabs
      (navigationRef as any).navigate("Main", { screen: "Record" });
    } catch {}
  };

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000 }}>
      <View className="px-4" style={{ paddingTop: insets.top + 8 }} pointerEvents="box-none">
        <View className="flex-row items-center justify-between bg-white rounded-2xl px-3 py-2 shadow-sm border border-gray-200" pointerEvents="auto">
          <Pressable accessibilityRole="button" accessibilityLabel="Back" accessibilityHint="Go to previous screen" onPress={onBack} className="flex-row items-center px-2 py-1 rounded-lg" style={{ opacity: canGoBack ? 1 : 0.5 }}>
            <Ionicons name="chevron-back" size={20} color="#111827" />
            <Text className="ml-1 text-gray-900 font-medium">Back</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Home" accessibilityHint="Go to Content To Air" onPress={onHome} className="flex-row items-center px-2 py-1 rounded-lg">
            <Ionicons name="mic" size={18} color="#0EA5E9" />
            <Text className="ml-1 text-blue-600 font-medium">Home</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
