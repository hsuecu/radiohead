import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Modal, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";

import { StandardButton } from "../StandardButton";
import { StandardCard } from "../StandardCard";
import SimpleBedCard, { SimpleBedData } from "../SimpleBedCard";
import { useAudioEditWorkflowStore, BedData } from "../../state/audioEditWorkflowStore";
import { useAudioStore } from "../../state/audioStore";
import { hapticFeedback } from "../../utils/mobileOptimization";
import { processAudioFileAsync } from "../../utils/fileProcessing";

export type InsertBedStepProps = {
  recordingId: string;
  onNext: () => void;
  onPrevious?: () => void;
};

export default function InsertBedStep({
  recordingId,
  onNext,
  onPrevious,
}: InsertBedStepProps) {
  const [decision, setDecision] = useState<boolean | null>(null);
  const [bedData, setBedData] = useState<SimpleBedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  
  const recordings = useAudioStore((s) => s.recordingsByStation);
  const stationId = Object.keys(recordings)[0] || "station-a";
  const stationRecordings = recordings[stationId] || [];
  
  // Get the main recording for duration reference
  const mainRecording = stationRecordings.find(r => r.id === recordingId);
  const mainDurationMs = mainRecording?.durationMs || 60000;
  
  // Load existing decision and data
  useEffect(() => {
    const existingDecision = useAudioEditWorkflowStore.getState().getStepDecision("insert_bed");
    const existingData = useAudioEditWorkflowStore.getState().getStepData("insert_bed") as BedData;
    
    if (existingDecision !== null) {
      setDecision(existingDecision);
      
      if (existingData && existingData.bedUri) {
        // Convert legacy BedData to SimpleBedData
        const simpleBedData: SimpleBedData = {
          uri: existingData.bedUri,
          name: existingData.bedName || "Background Music",
          durationMs: existingData.bedDurationMs || 60000,
          volume: existingData.bedVolume || (existingData.bedGain ? existingData.bedGain * 100 : 30),
          startTimeMs: existingData.bedStartMs || 0,
          endTimeMs: existingData.bedEndMs || mainDurationMs,
          fadeInMs: existingData.bedFadeInMs || 0,
          fadeOutMs: existingData.bedFadeOutMs || 0,
          playMode: existingData.bedPlayMode || "throughout",
        };
        setBedData(simpleBedData);
      }
    }
  }, [recordingId, mainDurationMs]);
  
  const handleDecision = (wantsBed: boolean) => {
    setDecision(wantsBed);
    hapticFeedback.selection();
    
    if (!wantsBed) {
      // Complete step immediately if user doesn't want a bed
      useAudioEditWorkflowStore.getState().updateWorkflowData({ bed: {} });
      useAudioEditWorkflowStore.getState().completeStep("insert_bed", false, {});
    }
  };
  
  const handlePickFromFiles = async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      setLoadingMessage("Selecting audio file...");
      
      const res = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        multiple: false,
        copyToCacheDirectory: true,
      });
      
      if (res.canceled || !res.assets || res.assets.length === 0) {
        return;
      }
      
      const file = res.assets[0];
      if (!file || !file.uri) {
        Alert.alert("Error", "Invalid file selected");
        return;
      }
      
      // Validate file format
      const validFormats = ['.mp3', '.m4a', '.wav', '.aac', '.mp4'];
      const fileExtension = file.name?.toLowerCase().split('.').pop();
      if (!fileExtension || !validFormats.some(format => format.includes(fileExtension))) {
        Alert.alert(
          "Unsupported Format", 
          `Please select an audio file in one of these formats: ${validFormats.join(', ')}`
        );
        return;
      }
      
      setLoadingMessage("Processing audio file...");
      
      // Process the audio file with progress callback
      const result = await processAudioFileAsync(
        file.uri,
        file.name || "Background Music",
        file.size || 0,
        (progress) => {
          setLoadingMessage(`Processing audio... ${Math.round(progress * 100)}%`);
        }
      );
      
      if (!result.isValid) {
        console.error("Invalid bed file:", result.error);
        Alert.alert("Error", "Invalid audio file format or corrupted file");
        return;
      }

      setLoadingMessage("Setting up background music...");
      
      // Create simplified bed data
      const newBedData: SimpleBedData = {
        uri: file.uri,
        name: file.name || "Background Music",
        durationMs: result.durationMs,
        volume: 30, // Default to 30% volume
        startTimeMs: 0,
        endTimeMs: mainDurationMs,
        fadeInMs: 2000, // Default 2s fade in
        fadeOutMs: 2000, // Default 2s fade out
        playMode: "throughout",
      };
      
      setBedData(newBedData);
      hapticFeedback.success();
      
    } catch (error) {
      console.error("Failed to pick bed file:", error);
      Alert.alert("Error", "Failed to load audio file. Please try again.");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleBedDataUpdate = (updates: Partial<SimpleBedData>) => {
    if (!bedData) return;
    
    const updatedBedData = { ...bedData, ...updates };
    setBedData(updatedBedData);
    hapticFeedback.light();
  };

  const handleRemoveBed = () => {
    Alert.alert(
      "Remove Background Music",
      "Are you sure you want to remove the background music?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: () => {
            setBedData(null);
            hapticFeedback.light();
          }
        }
      ]
    );
  };

  const handleTestMix = async () => {
    if (!bedData || !mainRecording) return;
    
    try {
      // Simple test: show preview info and play background music sample
      Alert.alert(
        "Test Mix Preview",
        `This will play your background music "${bedData.name}" at ${bedData.volume}% volume for 10 seconds.\n\nIn the final mix, this will be combined with your main recording.`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Play Preview", 
            onPress: async () => {
              // This would trigger the SimpleBedCard's built-in preview
              hapticFeedback.light();
            }
          }
        ]
      );
    } catch (error) {
      console.error("Test mix error:", error);
      Alert.alert("Error", "Failed to create test mix");
    }
  };

  const handleNext = () => {
    if (decision === null) {
      useAudioEditWorkflowStore.getState().setError("Please make a decision about background music before continuing");
      return;
    }
    
    if (!mainRecording) {
      useAudioEditWorkflowStore.getState().setError("Recording not found. Cannot proceed with background music step");
      return;
    }
    
    // Convert SimpleBedData back to BedData for workflow storage
    const workflowBedData: BedData = bedData ? {
      bedUri: bedData.uri,
      bedName: bedData.name,
      bedDurationMs: bedData.durationMs,
      bedVolume: bedData.volume,
      bedStartMs: bedData.startTimeMs,
      bedEndMs: bedData.endTimeMs,
      bedFadeInMs: bedData.fadeInMs,
      bedFadeOutMs: bedData.fadeOutMs,
      bedPlayMode: bedData.playMode,
      // Legacy compatibility
      bedGain: bedData.volume / 100,
    } : {};
    
    useAudioEditWorkflowStore.getState().updateWorkflowData({ bed: workflowBedData });
    useAudioEditWorkflowStore.getState().completeStep("insert_bed", decision, workflowBedData);
    
    onNext();
  };
  
  if (!mainRecording) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-lg font-semibold text-gray-800 mt-4 mb-2">
          Recording Not Found
        </Text>
        <Text className="text-gray-600 text-center">
          The selected recording could not be loaded.
        </Text>
      </View>
    );
  }
  
  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-6">
        <StandardCard title="Add Background Music" variant="default">
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-800 mb-2">
              Do you want to add background music?
            </Text>
            <Text className="text-gray-600 mb-4">
              Background music (beds) can enhance your content by providing atmosphere and continuity.
            </Text>
            
            {decision === null && (
              <View className="flex-row gap-3">
                <StandardButton
                  title="Yes, add background"
                  onPress={() => handleDecision(true)}
                  variant="primary"
                  icon="musical-notes"
                  style={{ flex: 1 }}
                />
                <StandardButton
                  title="No, continue"
                  onPress={() => handleDecision(false)}
                  variant="secondary"
                  icon="arrow-forward"
                  style={{ flex: 1 }}
                />
              </View>
            )}
            
            {decision !== null && (
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <Ionicons 
                    name={decision ? "musical-notes" : "arrow-forward"} 
                    size={20} 
                    color={decision ? "#8B5CF6" : "#10B981"} 
                  />
                  <Text className="ml-2 font-medium text-gray-800">
                    {decision ? "Adding background music" : "Skipping background music"}
                  </Text>
                </View>
                
                <Pressable
                  onPress={() => {
                    setDecision(null);
                    setBedData(null);
                  }}
                  className="self-start"
                >
                  <Text className="text-blue-600 text-sm">Change decision</Text>
                </Pressable>
              </View>
            )}
          </View>
          
          {decision === true && (
            <View className="mb-6">
              {!bedData ? (
                <View>
                  <Text className="text-gray-700 font-medium mb-3">Select Background Music</Text>
                  
                  <View className="space-y-3">
                    <StandardButton
                      title={isLoading ? (loadingMessage || "Processing...") : "Choose from Files"}
                      onPress={handlePickFromFiles}
                      variant="primary"
                      icon="document"
                      disabled={isLoading}
                      fullWidth
                    />
                    
                    <StandardButton
                      title="Choose from Library"
                      onPress={() => setShowLibraryModal(true)}
                      variant="secondary"
                      icon="library"
                      fullWidth
                    />
                  </View>
                  
                  {isLoading && (
                    <View className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <Text className="text-blue-800 text-sm text-center">
                        {loadingMessage}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View>
                  <Text className="text-gray-700 font-medium mb-3">Background Music Settings</Text>
                  
                  <SimpleBedCard
                    bedData={bedData}
                    mainRecordingDurationMs={mainDurationMs}
                    onUpdate={handleBedDataUpdate}
                    onRemove={handleRemoveBed}
                    onTestMix={handleTestMix}
                    mainSamples={mainRecording.waveform}
                    bedSamples={undefined}
                  />
                  
                  <View className="mt-3">
                    <StandardButton
                      title="Replace Background Music"
                      onPress={handlePickFromFiles}
                      variant="secondary"
                      icon="refresh"
                      disabled={isLoading}
                      fullWidth
                    />
                  </View>
                </View>
              )}
            </View>
          )}
          
          <View className="flex-row gap-3">
            {onPrevious && (
              <StandardButton
                title="Previous"
                onPress={onPrevious}
                variant="secondary"
                icon="arrow-back"
                style={{ flex: 1 }}
              />
            )}
            <StandardButton
              title="Continue"
              onPress={handleNext}
              variant="primary"
              icon="arrow-forward"
              disabled={decision === null || (decision && !bedData && !isLoading)}
              style={{ flex: 1 }}
            />
          </View>
        </StandardCard>
      </View>

      {/* Library Selection Modal (Placeholder) */}
      <Modal
        visible={showLibraryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLibraryModal(false)}
      >
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-2xl p-6 max-h-5/6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-gray-800">Music Library</Text>
              <Pressable onPress={() => setShowLibraryModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>
            
            <View className="items-center justify-center py-12">
              <Ionicons name="library-outline" size={64} color="#9CA3AF" />
              <Text className="text-gray-500 text-lg mt-4 mb-2">Music Library Coming Soon</Text>
              <Text className="text-gray-400 text-center px-8">
                The music library feature will allow you to browse and select from a collection of royalty-free background music.
              </Text>
            </View>
            
            <StandardButton
              title="Close"
              onPress={() => setShowLibraryModal(false)}
              variant="secondary"
              fullWidth
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}