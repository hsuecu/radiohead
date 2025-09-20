import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { navigationRef } from "../navigation/navigationRef";
import { useUiStore } from "../state/uiStore";

export default function GlobalNavControls() {
  const insets = useSafeAreaInsets();
  const [routeName, setRouteName] = useState<string | undefined>(undefined);
  const [canBack, setCanBack] = useState(false);
  const overlayHidden = useUiStore((s) => s.overlayHidden);
  const avoidTopLeft = useUiStore((s) => s.overlayAvoidTopLeft);
  const avoidTopRight = useUiStore((s) => s.overlayAvoidTopRight);
  const navHintSeen = useUiStore((s) => s.navHintSeen);
  const setNavHintSeen = useUiStore((s) => s.setNavHintSeen);

  const visibleSV = useSharedValue(1);
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRouteRef = useRef<string | undefined>(undefined);

  const showTemporarily = () => {
    setVisible(true);
    visibleSV.value = withTiming(1, { duration: 180 });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      visibleSV.value = withTiming(0, { duration: 240 });
    }, 2500);
  };

  useEffect(() => {
    const update = () => {
      try {
        const curr = navigationRef.getCurrentRoute()?.name;
        setRouteName(curr);
        setCanBack(navigationRef.canGoBack());
        if (curr !== lastRouteRef.current) {
          lastRouteRef.current = curr;
          showTemporarily();
        }
      } catch {}
    };
    update();
    const id = setInterval(update, 300);
    return () => { clearInterval(id); if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  useEffect(() => {
    if (!navHintSeen) {
      showTemporarily();
      const t = setTimeout(() => setNavHintSeen(true), 4000);
      return () => clearTimeout(t);
    }
  }, [navHintSeen]);

  if (routeName === "Login" || overlayHidden) return null;

  const onBack = () => {
    try {
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        navigationRef.goBack();
      }
    } catch {}
  };
  const onHome = () => {
    try {
      if (!navigationRef.isReady()) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      (navigationRef as any).navigate("Main", { screen: "Record" });
    } catch {}
  };

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: visibleSV.value,
    transform: [{ scale: 0.98 + 0.02 * visibleSV.value }],
  }));

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>      
      {/* Edge slivers to reveal controls */}
      <Pressable
        accessibilityLabel="Reveal navigation controls"
        onPress={showTemporarily}
        style={{ position: "absolute", top: insets.top + 2, left: 0, width: 18, height: 84 }}
      />
      <Pressable
        accessibilityLabel="Reveal navigation controls"
        onPress={showTemporarily}
        style={{ position: "absolute", top: insets.top + 2, right: 0, width: 18, height: 84 }}
      />

      {/* Controls container */}
      <View pointerEvents={visible ? "box-none" : "none"} style={{ position: "absolute", top: insets.top + 8, left: 8, right: 8 }}>
        <Animated.View style={[fadeStyle]}
          pointerEvents={visible ? "box-none" : "none"}
        >
          {/* Back button (top-left) */}
          {canBack && (
            <View pointerEvents="box-none" style={{ position: "absolute", left: 0, top: (avoidTopLeft || 0) }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                accessibilityHint="Go to previous screen"
                onPress={() => { showTemporarily(); onBack(); }}
                className="items-center justify-center"
                style={[styles.fab, styles.shadow]}
              >
                <Ionicons name="chevron-back" size={18} color="#111827" />
              </Pressable>
            </View>
          )}

          {/* Home mic button (top-right) */}
          <View pointerEvents="box-none" style={{ position: "absolute", right: 0, top: (avoidTopRight || 0) }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Home"
              accessibilityHint="Go to Content To Air"
              onPress={() => { showTemporarily(); onHome(); }}
              className="items-center justify-center"
              style={[styles.fab, styles.shadow]}
            >
              <Ionicons name="mic" size={16} color="#0EA5E9" />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.07)",
  },
  shadow: Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4 },
    android: { elevation: 2 },
    default: {},
  }) as any,
});
