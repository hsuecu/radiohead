import React, { useState, useEffect } from "react";
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { listVoices, convertVoice, ElevenVoice } from "../api/elevenlabs";
import { hapticFeedback } from "../utils/mobileOptimization";

export type VoiceChangerModalProps = {
  visible: boolean;
  sourceUri: string;
  sourceName: string;
  onClose: () => void;
  onVoiceChanged: (newUri: string, voiceName: string) => void;
};

export default function VoiceChangerModal({
  visible,
  sourceUri,
  sourceName,
  onClose,
  onVoiceChanged,
}: VoiceChangerModalProps) {
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<ElevenVoice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available voices on mount
  useEffect(() => {
    if (visible) {
      loadVoices();
    }
  }, [visible]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewSound) {
        previewSound.unloadAsync().catch(() => {});
      }
    };
  }, [previewSound]);

  const loadVoices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const voiceList = await listVoices();
      console.log("🎤 ElevenLabs voices loaded:", voiceList.length, "voices");
      console.log("🎤 First few voices:", voiceList.slice(0, 3));
      setVoices(voiceList);
      
      if (voiceList.length === 0) {
        setError("No voices available. Check your ElevenLabs API key.");
      }
    } catch (error) {
      console.error("Failed to load voices:", error);
      setError("Failed to load voices. Check your internet connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const playVoicePreview = async (voice: ElevenVoice) => {
    if (!voice.preview_url) return;
    
    try {
      // Stop current preview
      if (previewSound) {
        await previewSound.stopAsync();
        await previewSound.unloadAsync();
        setPreviewSound(null);
      }
      
      setIsPlayingPreview(true);
      hapticFeedback.light();
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: voice.preview_url },
        { shouldPlay: true }
      );
      
      setPreviewSound(sound);
      
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setIsPlayingPreview(false);
          sound.unloadAsync().catch(() => {});
          setPreviewSound(null);
        }
      });
      
    } catch (error) {
      console.error("Failed to play preview:", error);
      setIsPlayingPreview(false);
    }
  };

  const convertWithSelectedVoice = async () => {
    if (!selectedVoice || !sourceUri) return;
    
    try {
      setIsConverting(true);
      setConversionProgress(0);
      setError(null);
      
      hapticFeedback.medium();
      
      // Simulate progress updates (ElevenLabs API doesn't provide real progress)
      const progressInterval = setInterval(() => {
        setConversionProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);
      
      const result = await convertVoice({
        inputUri: sourceUri,
        voiceId: selectedVoice.voice_id,
        removeBackgroundNoise: true,
      });
      
      clearInterval(progressInterval);
      setConversionProgress(100);
      
      hapticFeedback.success();
      
      // Wait a moment to show completion
      setTimeout(() => {
        onVoiceChanged(result.uri, selectedVoice.name);
        onClose();
      }, 500);
      
    } catch (error) {
      console.error("Voice conversion failed:", error);
      setError(error instanceof Error ? error.message : "Conversion failed");
      hapticFeedback.error();
    } finally {
      setIsConverting(false);
      setConversionProgress(0);
    }
  };

  const handleClose = () => {
    if (previewSound) {
      previewSound.stopAsync().catch(() => {});
      previewSound.unloadAsync().catch(() => {});
      setPreviewSound(null);
    }
    setIsPlayingPreview(false);
    setSelectedVoice(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">Voice Changer</Text>
            <Text className="text-sm text-gray-600 mt-1">
              Transform: {sourceName}
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            className="p-2 rounded-full bg-gray-100"
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color="#374151" />
          </Pressable>
        </View>

        {/* Content */}
        <View className="flex-1">
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-gray-600 mt-4">Loading voices...</Text>
            </View>
          ) : error ? (
            <View className="flex-1 items-center justify-center p-6">
              <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
                <Ionicons name="warning" size={32} color="#EF4444" />
              </View>
              <Text className="text-red-600 text-center text-lg font-medium mb-2">
                Error
              </Text>
              <Text className="text-gray-600 text-center mb-4">{error}</Text>
              <Pressable
                onPress={loadVoices}
                className="px-6 py-3 bg-blue-600 rounded-lg"
              >
                <Text className="text-white font-medium">Retry</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
              <Text className="text-gray-700 text-base mb-4 leading-6">
                Choose a voice to transform your audio. Tap the play button to preview each voice.
              </Text>
              
              {voices.map((voice) => (
                <Pressable
                  key={voice.voice_id}
                  onPress={() => {
                    setSelectedVoice(voice);
                    hapticFeedback.selection();
                  }}
                  className={`p-4 rounded-xl mb-3 border-2 ${
                    selectedVoice?.voice_id === voice.voice_id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text
                        className={`font-semibold text-lg ${
                          selectedVoice?.voice_id === voice.voice_id
                            ? "text-blue-800"
                            : "text-gray-800"
                        }`}
                      >
                        {voice.name}
                      </Text>
                      <Text
                        className={`text-sm mt-1 ${
                          selectedVoice?.voice_id === voice.voice_id
                            ? "text-blue-600"
                            : "text-gray-600"
                        }`}
                      >
                        Voice ID: {voice.voice_id.slice(0, 8)}...
                      </Text>
                    </View>
                    
                    {voice.preview_url && (
                      <Pressable
                        onPress={() => playVoicePreview(voice)}
                        className="w-12 h-12 rounded-full bg-blue-600 items-center justify-center ml-3"
                      >
                        <Ionicons
                          name={isPlayingPreview ? "pause" : "play"}
                          size={20}
                          color="white"
                        />
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              ))}
              
              {voices.length === 0 && !isLoading && (
                <View className="items-center py-12">
                  <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
                    <Ionicons name="person-outline" size={32} color="#9CA3AF" />
                  </View>
                  <Text className="text-gray-500 text-center mb-2">No voices available</Text>
                  <Text className="text-gray-400 text-center text-sm px-8">
                    This could be due to API key issues or network connectivity. Check the console for more details.
                  </Text>
                  <Pressable
                    onPress={loadVoices}
                    className="mt-4 px-4 py-2 bg-blue-600 rounded-lg"
                  >
                    <Text className="text-white font-medium">Retry Loading</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          )}
        </View>

        {/* Footer */}
        {!isLoading && !error && (
          <View className="p-4 border-t border-gray-200">
            {isConverting ? (
              <View className="items-center py-4">
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text className="text-gray-600 mt-2">
                  Converting voice... {conversionProgress}%
                </Text>
                <View className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <View
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${conversionProgress}%` }}
                  />
                </View>
              </View>
            ) : (
              <View className="flex-row gap-3">
                <Pressable
                  onPress={handleClose}
                  className="flex-1 p-4 bg-gray-100 rounded-xl"
                >
                  <Text className="text-gray-700 text-center font-semibold text-base">
                    Cancel
                  </Text>
                </Pressable>
                
                <Pressable
                  onPress={convertWithSelectedVoice}
                  disabled={!selectedVoice}
                  className={`flex-1 p-4 rounded-xl ${
                    selectedVoice
                      ? "bg-blue-600"
                      : "bg-gray-300"
                  }`}
                >
                  <Text
                    className={`text-center font-semibold text-base ${
                      selectedVoice ? "text-white" : "text-gray-500"
                    }`}
                  >
                    Convert Voice
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}