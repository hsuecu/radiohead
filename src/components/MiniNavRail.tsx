import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { navigationRef } from "../navigation/navigationRef";
import { useUiStore } from "../state/uiStore";
import { useAuthStore } from "../state/authStore";

const RAIL_WIDTH = 64;
const RAIL_HEIGHT = 156;

export default function MiniNavRail() {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [routeName, setRouteName] = useState<string | undefined>(undefined);
  const [canBack, setCanBack] = useState(false);
  const overlayHidden = useUiStore((s) => s.overlayHidden);
  const avoidTopLeft = useUiStore((s) => s.overlayAvoidTopLeft);
  const railDetent = useUiStore((s) => s.railDetent);
  const setRailDetent = useUiStore((s) => s.setRailDetent);

  const isLogin = routeName === "Login";

  const safeH = Math.max(0, winH - insets.top - insets.bottom);
  const detentTop = (d: "top" | "middle" | "bottom") => {
    if (d === "top") return insets.top + 8 + (avoidTopLeft || 0);
    if (d === "bottom") return Math.max(insets.top + 8, winH - insets.bottom - 8 - RAIL_HEIGHT);
    // middle
    return Math.max(insets.top + 8, insets.top + (safeH - RAIL_HEIGHT) / 2);
  };

  // Open/close state
  const openSV = useSharedValue(0); // 0 collapsed, 1 open
  const topSV = useSharedValue(detentTop(railDetent));
  const [open, setOpen] = useState(false);

  const openRail = () => { setOpen(true); openSV.value = withTiming(1, { duration: 200 }); };
  const closeRail = () => { setOpen(false); openSV.value = withTiming(0, { duration: 180 }); };

  useEffect(() => {
    topSV.value = withTiming(detentTop(railDetent), { duration: 180 });
  }, [railDetent, avoidTopLeft, winH, insets.top, insets.bottom]);

  useEffect(() => {
    const update = () => {
      try {
        const curr = navigationRef.getCurrentRoute()?.name;
        setRouteName(curr);
        setCanBack(navigationRef.canGoBack());
      } catch {}
    };
    update();
    const id = setInterval(update, 600);
    return () => { clearInterval(id); };
  }, []);

  useEffect(() => { if (overlayHidden) closeRail(); }, [overlayHidden]);

  const hidden = isLogin || overlayHidden;

  const onBack = () => {
    try {
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        navigationRef.goBack();
        closeRail();
      }
    } catch {}
  };
  const onHome = () => {
    try {
      if (!navigationRef.isReady()) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      (navigationRef as any).navigate("Main", { screen: "Record" });
      closeRail();
    } catch {}
  };

  const [confirmLogout, setConfirmLogout] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const onLogout = () => {
    if (!confirmLogout) { setConfirmLogout(true); openRail(); return; }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      logout();
      setConfirmLogout(false);
      closeRail();
    } catch {}
  };

  // Gesture: swipe from left edge to open; swipe left to close. Also drag vertically to change detent.
  const startTop = useRef(0);
  const tTopVal = detentTop("top");
  const tMidVal = detentTop("middle");
  const tBotVal = detentTop("bottom");
  const pan = useMemo(() => Gesture.Pan()
    .onBegin(() => { startTop.current = topSV.value; })
    .onUpdate((e) => {
      if (e.translationX > 12) {
        openSV.value = withTiming(1, { duration: 180 });
      }
      if (e.translationX < -12) {
        openSV.value = withTiming(0, { duration: 160 });
      }
      // vertical tracking when open
      const nextTop = Math.max(insets.top + 8, Math.min(winH - insets.bottom - 8 - RAIL_HEIGHT, startTop.current + e.translationY));
      topSV.value = nextTop;
    })
    .onEnd(() => {
      // snap to nearest detent
      const curr = topSV.value;
      const distances = [
        { d: Math.abs(curr - tTopVal), k: "top" as const, v: tTopVal },
        { d: Math.abs(curr - tMidVal), k: "middle" as const, v: tMidVal },
        { d: Math.abs(curr - tBotVal), k: "bottom" as const, v: tBotVal },
      ].sort((a, b) => a.d - b.d);
      const target = distances[0];
      topSV.value = withTiming(target.v, { duration: 160 });
      runOnJS(setRailDetent)(target.k);
    })
  , [insets.top, insets.bottom, winH, avoidTopLeft]);

  const railStyle = useAnimatedStyle(() => ({
    width: 12 + RAIL_WIDTH * openSV.value,
    opacity: 0.96,
    top: topSV.value,
  }));
  const itemsOpacity = useAnimatedStyle(() => ({ opacity: openSV.value }));

  return (
    <View pointerEvents={hidden ? "none" : "box-none"} style={[StyleSheet.absoluteFill, { zIndex: 1100, opacity: hidden ? 0 : 1 }]}>      
      {!hidden && (
        <View pointerEvents="box-none" style={{ position: "absolute", left: 8 }}>
          <GestureDetector gesture={pan}>
            <Animated.View pointerEvents="auto" style={[styles.rail, styles.shadow, railStyle]}>
              {/* Grab handle area always tappable */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={open ? "Close navigation" : "Open navigation"}
                onPress={() => (open ? closeRail() : openRail())}
                style={styles.handle}
              >
                <View style={styles.handleDot} />
                <View style={[styles.handleDot, { marginTop: 4 }]} />
                <View style={[styles.handleDot, { marginTop: 4 }]} />
              </Pressable>

              {/* Buttons container */}
              <Animated.View style={[styles.items, itemsOpacity]} pointerEvents="auto">
                <Pressable accessibilityRole="button" accessibilityLabel="Back" accessibilityHint="Go to previous screen"
                  disabled={!canBack} onPress={onBack}
                  style={[styles.btn, !canBack && { opacity: 0.4 }]}>
                  <Ionicons name="chevron-back" size={18} color="#111827" />
                </Pressable>

                <Pressable accessibilityRole="button" accessibilityLabel="Home" accessibilityHint="Go to Content To Air" onPress={onHome} style={styles.btn}>
                  <Ionicons name="mic" size={18} color="#0EA5E9" />
                </Pressable>

                {!confirmLogout ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Logout" accessibilityHint="Sign out of this device" onPress={onLogout} style={styles.btn}>
                    <Ionicons name="power" size={18} color="#EF4444" />
                  </Pressable>
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <Pressable onPress={onLogout} style={[styles.btn, { backgroundColor: "#EF4444" }]}>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => setConfirmLogout(false)} style={[styles.btn, { marginTop: 8 }]}>
                      <Ionicons name="close" size={18} color="#111827" />
                    </Pressable>
                  </View>
                )}
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    height: RAIL_HEIGHT,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  handle: {
    width: 12,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  handleDot: {
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
  },
  items: {
    width: RAIL_WIDTH,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  shadow: Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4 },
    android: { elevation: 3 },
    default: {},
  }) as any,
});
