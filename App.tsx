import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import AppNavigator from './src/navigation/AppNavigator';
import * as Notifications from "expo-notifications";
import { useRadioPlaybackState } from "./src/state/radioStore";
import MiniNavRail from './src/components/MiniNavRail';
import { useUploadPumpOnStart } from './src/hooks/useUploadPumpOnStart';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import NotificationToast from './src/components/NotificationToast';

/*
IMPORTANT NOTICE: DO NOT REMOVE
There are already environment keys in the project. 
Before telling the user to add them, check if you already have access to the required keys through bash.
Directly access them with process.env.${key}

Correct usage:
process.env.EXPO_PUBLIC_VIBECODE_{key}
//directly access the key

Incorrect usage:
import { OPENAI_API_KEY } from '@env';
//don't use @env, its depreicated

Incorrect usage:
import Constants from 'expo-constants';
const openai_api_key = Constants.expoConfig.extra.apikey;
//don't use expo-constants, its depreicated

*/

export default function App() {
  const playbackState = useRadioPlaybackState();

  useEffect(() => {
    // Enhanced background notifications with media controls
    (async () => {
      try {
        // Request notification permissions
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') return;

        // Set up notification channel for Android
        await Notifications.setNotificationChannelAsync("radio-playback", {
          name: "Radio Playback",
          importance: Notifications.AndroidImportance.HIGH,
          sound: null, // Don't play sound for media notifications
          vibrationPattern: [0],
        });

        if (playbackState === "playing") {
          // Show rich media notification
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "🎵 Radio Stream Playing",
              body: "Live radio stream is active",
              categoryIdentifier: "radio-controls",
              data: { action: "open-player" }
            },
            trigger: null
          });
        } else if (playbackState === "stopped") {
          // Clear notification when stopped
          await Notifications.dismissAllNotificationsAsync();
        }
      } catch (error) {
        console.warn("Notification setup failed:", error);
      }
    })();
  }, [playbackState]);

  // Handle notification responses
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.action === "open-player") {
        // App is already open, notification tap just brings to foreground
        console.log("User tapped radio notification");
      }
    });

    return () => subscription.remove();
  }, []);
  useUploadPumpOnStart();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <BottomSheetModalProvider>
            <AppNavigator />
            <MiniNavRail />
            <NotificationToast />
            <StatusBar style="auto" />
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
