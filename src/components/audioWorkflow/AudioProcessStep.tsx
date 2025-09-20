import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StandardButton } from "../StandardButton";
import { StandardCard } from "../StandardCard";
import AudioEnhancementPanel from "../AudioEnhancementPanel";
import { useAudioEditWorkflowStore, AudioProcessData } from "../../state/audioEditWorkflowStore";
import { useAudioStore } from "../../state/audioStore";
import { hapticFeedback } from "../../utils/mobileOptimization";
import { 
  BROADCAST_STANDARDS, 
  BroadcastStandard, 
  ProcessingOptions,
  ProcessingJob,
  mockAudioProcessing,
  mockPollProcessingJob,
  AudioAnalysisReport
} from "../../api/audio-processing";

export type AudioProcessStepProps = {
  recordingId: string;
  onNext: () => void;
  onPrevious?: () => void;
};

export default function AudioProcessStep({
  recordingId,
  onNext,
  onPrevious,
}: AudioProcessStepProps) {
  const [decision, setDecision] = useState<boolean | null>(null);
  const [showProcessInterface, setShowProcessInterface] = useState(false);
  const [processData, setProcessData] = useState<AudioProcessData>({ applied: false });
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [abBypass, setAbBypass] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  
  // New broadcast processing state
  const [selectedStandard, setSelectedStandard] = useState<BroadcastStandard>("broadcast_uk_eu");
  const [cleanAndPolish, setCleanAndPolish] = useState(false);
  const [processingJob, setProcessingJob] = useState<ProcessingJob | null>(null);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<AudioAnalysisReport | null>(null);
  const [processedAudioUri, setProcessedAudioUri] = useState<string | null>(null);
  
  const recordings = useAudioStore((s) => s.recordingsByStation);
  const stationId = Object.keys(recordings)[0] || "station-a";
  const currentRec = recordings[stationId]?.find(r => r.id === recordingId);
  const setEffects = useAudioStore((s) => s.setEffects);
  
  // Load existing decision and data
  useEffect(() => {
    const existingDecision = useAudioEditWorkflowStore.getState().getStepDecision("audio_process");
    const existingData = useAudioEditWorkflowStore.getState().getStepData("audio_process") as AudioProcessData;
    
    if (existingDecision !== null) {
      setDecision(existingDecision);
      setShowProcessInterface(existingDecision);
      
      if (existingData) {
        setProcessData(existingData);
      }
    }
    
    // Initialize with current recording effects if available
    if (currentRec?.effects && !existingData) {
      setProcessData({
        normalizeTargetLufs: currentRec.effects.normalizeTargetLufs ?? undefined,
        fadeInMs: currentRec.effects.fadeInMs ?? undefined,
        fadeOutMs: currentRec.effects.fadeOutMs ?? undefined,
        applied: false,
      });
    }
  }, [recordingId, currentRec?.effects]);
  
  const handleDecision = (wantsProcessing: boolean) => {
    setDecision(wantsProcessing);
    setShowProcessInterface(wantsProcessing);
    hapticFeedback.selection();
    
    if (!wantsProcessing) {
      // Complete step immediately if user doesn't want processing
      useAudioEditWorkflowStore.getState().completeStep("audio_process", false, { applied: false });
    }
  };
  
  const handleSettingsChange = (settings: any) => {
    setProcessData({
      normalizeTargetLufs: settings.normalizeTargetLufs,
      fadeInMs: settings.fadeInMs,
      fadeOutMs: settings.fadeOutMs,
      eq: settings.eq,
      compressor: settings.compressor,
      applied: false,
    });
  };
  
  const handleApplyEffects = () => {
    if (!currentRec) return;
    
    // Compute normalize gain
    const computeNormalizeGainDb = (measuredLufs?: number | null, targetLufs?: number | null) => {
      if (typeof measuredLufs !== "number" || typeof targetLufs !== "number") return null;
      return Math.max(-12, Math.min(12, targetLufs - measuredLufs));
    };
    
    const normalizeGainDb = computeNormalizeGainDb(currentRec.lufs, processData.normalizeTargetLufs ?? null);
    
    const effects = {
      normalizeTargetLufs: processData.normalizeTargetLufs ?? null,
      normalizeGainDb,
      fadeInMs: processData.fadeInMs ?? 0,
      fadeOutMs: processData.fadeOutMs ?? 0,
      eq: processData.eq,
      compressor: processData.compressor,
    };
    
    // Apply effects to the recording
    setEffects(recordingId, effects, stationId);
    
    // Update process data
    const updatedProcessData: AudioProcessData = {
      ...processData,
      applied: true,
    };
    
    setProcessData(updatedProcessData);
    hapticFeedback.success();
  };

  const handleBroadcastProcessing = async () => {
    if (!currentRec?.uri) return;
    
    try {
      setShowProcessingModal(true);
      hapticFeedback.selection();
      
      const options: ProcessingOptions = {
        standard: selectedStandard,
        cleanAndPolish
      };
      
      // Start processing job
      const job = await mockAudioProcessing(currentRec.uri, options);
      setProcessingJob(job);
      
      // Poll for completion
      const completedJob = await mockPollProcessingJob(job.jobId, (updatedJob) => {
        setProcessingJob(updatedJob);
      });
      
      // Handle completion
      if (completedJob.outputFileUrl && completedJob.analysisReport) {
        setProcessedAudioUri(completedJob.outputFileUrl);
        setAnalysisReport(completedJob.analysisReport);
        
        // Update process data with broadcast processing info
        const updatedProcessData: AudioProcessData = {
          ...processData,
          broadcastStandard: selectedStandard,
          cleanAndPolish,
          analysisReport: completedJob.analysisReport,
          processedUri: completedJob.outputFileUrl,
          applied: true,
        };
        
        setProcessData(updatedProcessData);
        hapticFeedback.success();
      }
      
    } catch (error) {
      console.error("Broadcast processing failed:", error);
      useAudioEditWorkflowStore.getState().setError("Audio processing failed. Please try again.");
      hapticFeedback.error();
    } finally {
      setShowProcessingModal(false);
    }
  };
  
  const handleNext = () => {
    if (decision === null) {
      useAudioEditWorkflowStore.getState().setError("Please make a decision about audio processing before continuing");
      return;
    }
    
    if (!currentRec) {
      useAudioEditWorkflowStore.getState().setError("Recording not found. Cannot proceed with audio processing step");
      return;
    }
    
    useAudioEditWorkflowStore.getState().updateWorkflowData({ audioProcess: processData });
    useAudioEditWorkflowStore.getState().completeStep("audio_process", decision, processData);
    
    onNext();
  };
  
  if (!currentRec) {
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
        <StandardCard title="Enhance Audio Quality" variant="default">
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-800 mb-2">
              Do you want to enhance your audio quality?
            </Text>
            <Text className="text-gray-600 mb-4">
              Audio enhancement can improve loudness, reduce noise, and apply professional effects to your recording.
            </Text>
            
            {decision === null && (
              <View className="flex-row gap-3">
                <StandardButton
                  title="Yes, enhance audio"
                  onPress={() => handleDecision(true)}
                  variant="primary"
                  icon="options"
                  style={{ flex: 1 }}
                />
                <StandardButton
                  title="No, keep original"
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
                    name={decision ? "options" : "arrow-forward"} 
                    size={20} 
                    color={decision ? "#10B981" : "#10B981"} 
                  />
                  <Text className="ml-2 font-medium text-gray-800">
                    {decision ? "Enhancing audio quality" : "Keeping original audio"}
                  </Text>
                </View>
                
                <Pressable
                  onPress={() => {
                    setDecision(null);
                    setShowProcessInterface(false);
                  }}
                  className="self-start"
                >
                  <Text className="text-blue-600 text-sm">Change decision</Text>
                </Pressable>
              </View>
            )}
          </View>
          
          {showProcessInterface && (
            <View className="mb-6">
              {/* Broadcast Standards Section */}
              <View className="mb-6">
                <Text className="text-lg font-semibold text-gray-800 mb-3">
                  Choose Broadcast Standard
                </Text>
                <Text className="text-gray-600 mb-4 text-sm">
                  Select the appropriate standard for your content distribution
                </Text>
                
                <View className="space-y-3">
                  {Object.entries(BROADCAST_STANDARDS).map(([key, standard]) => {
                    const isSelected = selectedStandard === key;
                    
                    return (
                      <Pressable
                        key={key}
                        onPress={() => {
                          setSelectedStandard(key as BroadcastStandard);
                          hapticFeedback.selection();
                        }}
                        className={`p-4 rounded-lg border-2 ${
                          isSelected 
                            ? "bg-blue-50 border-blue-500" 
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <View className="flex-row items-center">
                          <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                            isSelected ? "bg-blue-500" : "bg-gray-300"
                          }`}>
                            <Ionicons 
                              name={standard.icon} 
                              size={18} 
                              color={isSelected ? "#FFFFFF" : "#6B7280"} 
                            />
                          </View>
                          <View className="flex-1">
                            <Text className={`font-semibold ${
                              isSelected ? "text-blue-800" : "text-gray-800"
                            }`}>
                              {standard.name}
                            </Text>
                            <Text className={`text-sm mt-1 ${
                              isSelected ? "text-blue-700" : "text-gray-600"
                            }`}>
                              {standard.description}
                            </Text>
                            {standard.targetLufs && (
                              <Text className="text-xs text-gray-500 mt-1">
                                Target: {standard.targetLufs} LUFS
                              </Text>
                            )}
                            <Text className="text-xs text-gray-500 mt-1">
                              {standard.guidance}
                            </Text>
                          </View>
                          <Ionicons 
                            name={isSelected ? "checkmark-circle" : "chevron-forward"} 
                            size={16} 
                            color={isSelected ? "#3B82F6" : "#9CA3AF"} 
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                
                {/* Clean & Polish Toggle */}
                <View className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="font-medium text-gray-800">Clean & Polish</Text>
                      <Text className="text-sm text-gray-600 mt-1">
                        Apply noise reduction and speech EQ for cleaner sound
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setCleanAndPolish(!cleanAndPolish);
                        hapticFeedback.selection();
                      }}
                      className={`w-12 h-6 rounded-full ${
                        cleanAndPolish ? "bg-blue-500" : "bg-gray-300"
                      } justify-center`}
                    >
                      <View className={`w-5 h-5 rounded-full bg-white transform transition-transform ${
                        cleanAndPolish ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </Pressable>
                  </View>
                </View>
                
                {/* Process Button */}
                <StandardButton
                  title="Process Audio"
                  onPress={handleBroadcastProcessing}
                  variant="primary"
                  icon="flash"
                  style={{ marginTop: 16 }}
                />
              </View>

              {/* Legacy Enhancement Panel (collapsed by default) */}
              <View className="border-t border-gray-200 pt-4">
                <Pressable
                  onPress={() => setPreviewEnabled(!previewEnabled)}
                  className="flex-row items-center justify-between mb-3"
                >
                  <Text className="font-medium text-gray-700">Manual Enhancement</Text>
                  <Ionicons 
                    name={previewEnabled ? "chevron-up" : "chevron-down"} 
                    size={16} 
                    color="#6B7280" 
                  />
                </Pressable>
                
                {previewEnabled && (
                  <AudioEnhancementPanel
                    settings={{
                      normalizeTargetLufs: processData.normalizeTargetLufs,
                      fadeInMs: processData.fadeInMs,
                      fadeOutMs: processData.fadeOutMs,
                      eq: processData.eq,
                      compressor: processData.compressor,
                    }}
                    lufsValue={currentRec.lufs}
                    previewEnabled={previewEnabled}
                    onPreviewToggle={(enabled) => {
                      setPreviewEnabled(enabled);
                      if (!enabled) setAbBypass(false);
                    }}
                    activePresetId={activePresetId}
                    abBypass={abBypass}
                    onABToggle={() => {
                      setAbBypass(!abBypass);
                      hapticFeedback.selection();
                    }}
                    onSettingsChange={handleSettingsChange}
                    onApply={handleApplyEffects}
                    onApplyPreset={(presetName) => {
                      const presets = [
                        { id: "voice", name: "Voice Optimize" },
                        { id: "music", name: "Music Master" },
                        { id: "podcast", name: "Podcast Ready" },
                        { id: "clean", name: "Clean & Clear" },
                      ];
                      const preset = presets.find(p => p.name === presetName);
                      if (preset) {
                        setActivePresetId(preset.id);
                      }
                      hapticFeedback.selection();
                    }}
                  />
                )}
              </View>
              
              {processData.applied && (
                <View className="mt-4 space-y-4">
                  <View className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <View className="flex-row items-center">
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      <Text className="ml-2 text-green-800 font-medium">
                        {processData.broadcastStandard 
                          ? "Broadcast processing completed successfully"
                          : "Audio enhancements applied successfully"
                        }
                      </Text>
                    </View>
                    {analysisReport && (
                      <View className="mt-2">
                        <Text className="text-sm text-green-700">
                          Quality Score: {analysisReport.qualityScore}/100 • 
                          {analysisReport.broadcastCompliant ? " Broadcast Compliant" : " Not Compliant"}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* A/B Comparison Player */}
                  {processedAudioUri && (
                    <View className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <Text className="font-semibold text-gray-800 mb-3">
                        Compare Before & After
                      </Text>
                      
                      <View className="flex-row gap-3">
                        <StandardButton
                          title="Play Original"
                          onPress={() => {
                            // TODO: Play original audio
                            hapticFeedback.selection();
                          }}
                          variant="secondary"
                          icon="play"
                          style={{ flex: 1 }}
                        />
                        <StandardButton
                          title="Play Processed"
                          onPress={() => {
                            // TODO: Play processed audio
                            hapticFeedback.selection();
                          }}
                          variant="primary"
                          icon="play"
                          style={{ flex: 1 }}
                        />
                      </View>
                      
                      {analysisReport && (
                        <View className="mt-3 pt-3 border-t border-gray-300">
                          <Text className="text-sm font-medium text-gray-700 mb-2">
                            Analysis Report
                          </Text>
                          <View className="space-y-1">
                            <View className="flex-row justify-between">
                              <Text className="text-xs text-gray-600">Input LUFS:</Text>
                              <Text className="text-xs text-gray-800">{analysisReport.inputLufs.toFixed(1)}</Text>
                            </View>
                            {analysisReport.outputLufs && (
                              <View className="flex-row justify-between">
                                <Text className="text-xs text-gray-600">Output LUFS:</Text>
                                <Text className="text-xs text-gray-800">{analysisReport.outputLufs.toFixed(1)}</Text>
                              </View>
                            )}
                            <View className="flex-row justify-between">
                              <Text className="text-xs text-gray-600">True Peak:</Text>
                              <Text className="text-xs text-gray-800">{analysisReport.inputTruePeak.toFixed(1)} dB</Text>
                            </View>
                            {analysisReport.gainAdjustment && (
                              <View className="flex-row justify-between">
                                <Text className="text-xs text-gray-600">Gain Applied:</Text>
                                <Text className="text-xs text-gray-800">
                                  {analysisReport.gainAdjustment >= 0 ? "+" : ""}{analysisReport.gainAdjustment.toFixed(1)} dB
                                </Text>
                              </View>
                            )}
                          </View>
                          
                          {analysisReport.recommendations.length > 0 && (
                            <View className="mt-2">
                              <Text className="text-xs font-medium text-gray-700 mb-1">
                                Recommendations:
                              </Text>
                              {analysisReport.recommendations.map((rec, index) => (
                                <Text key={index} className="text-xs text-gray-600">
                                  • {rec}
                                </Text>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}
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
              title={decision && !processData.applied ? "Apply & Continue" : "Continue"}
              onPress={handleNext}
              variant="primary"
              icon="arrow-forward"
              disabled={decision === null}
              style={{ flex: 1 }}
            />
          </View>
        </StandardCard>
      </View>

      {/* Processing Modal */}
      <Modal
        visible={showProcessingModal}
        transparent={true}
        animationType="fade"
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-6">
          <View className="bg-white rounded-lg p-6 w-full max-w-sm">
            <View className="items-center">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-lg font-semibold text-gray-800 mt-4 mb-2">
                Processing Audio
              </Text>
              <Text className="text-gray-600 text-center mb-4">
                {processingJob?.status === "uploading" && "Uploading audio file..."}
                {processingJob?.status === "queued" && "Queued for processing..."}
                {processingJob?.status === "processing" && "Applying broadcast standards..."}
                {processingJob?.status === "finalizing" && "Finalizing processed audio..."}
              </Text>
              
              {processingJob && (
                <View className="w-full">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-sm text-gray-600">Progress</Text>
                    <Text className="text-sm text-gray-600">{processingJob.progress}%</Text>
                  </View>
                  <View className="w-full h-2 bg-gray-200 rounded-full">
                    <View 
                      className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${processingJob.progress}%` }}
                    />
                  </View>
                </View>
              )}
              
              <Text className="text-xs text-gray-500 mt-3 text-center">
                This may take a few moments depending on audio length
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}