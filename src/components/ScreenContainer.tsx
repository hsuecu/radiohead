import React from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { cn } from "../utils/cn";

export type ScreenContainerProps = {
  children: React.ReactNode;
  scroll?: boolean;
  keyboardAware?: boolean;
  contentClassName?: string;
  className?: string;
  bottomInsetPadding?: boolean;
};

export default function ScreenContainer({
  children,
  scroll = true,
  keyboardAware = true,
  contentClassName = "px-6 py-4",
  className,
  bottomInsetPadding = true,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = (bottomInsetPadding ? insets.bottom : 0) + 24;

  const Content = (
    <View className={contentClassName}>
      {children}
    </View>
  );

  const Body = scroll ? (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomPad }}
    >
      {Content}
    </ScrollView>
  ) : (
    <View className="flex-1" style={{ paddingBottom: bottomPad }}>
      {Content}
    </View>
  );

  const MaybeKAV = keyboardAware ? (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      {Body}
    </KeyboardAvoidingView>
  ) : Body;

  return (
    <SafeAreaView className={cn("flex-1 bg-gray-50", className)}>
      {MaybeKAV}
    </SafeAreaView>
  );
}
