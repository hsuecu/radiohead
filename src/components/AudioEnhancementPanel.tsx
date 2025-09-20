import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";

export type AudioEnhancementSettings = {
  normalizeTargetLufs?: number;
  normalizeGainDb?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  eq?: {
    enabled: boolean;
    lowGain: number;
    midGain: number;
    highGain: number;
    lowFreq?: number;
    midFreq?: number;
    highFreq?: number;
  };
  compressor?: {
    enabled: boolean;
    threshold: number;
    ratio: number;
    attack?: number;
    release?: number;
    makeupGain?: number;
  };
  noiseSuppression?: {
    enabled: boolean;
    strength: number;
    threshold?: number;
    attack?: number;
    release?: number;
  };
};

export type AudioEnhancementPanelProps = {
  settings: AudioEnhancementSettings; // draft settings for preview/editing
  onSettingsChange: (settings: AudioEnhancementSettings) => void;
  lufsValue?: number;
  previewEnabled?: boolean;
  onPreviewToggle?: (enabled: boolean) => void;
  onApply?: () => void; // parent persists applied settings
  onApplyPreset?: (presetName: string) => void;
  activePresetId?: string | null; // which preset is currently being previewed
  abBypass?: boolean; // true = hearing BEFORE
  onABToggle?: () => void; // quick A/B
};

const ENHANCEMENT_PRESETS = [
  {
    id: "voice",
    name: "Voice Optimize",
    description: "Speech clarity for podcasts and voice-overs",
    guidance: "Optimized for spoken content with noise reduction",
    icon: "mic" as const,
    settings: {
      normalizeTargetLufs: -16, // Podcast standard
      fadeInMs: 100,
      fadeOutMs: 200,
      eq: { 
        enabled: true, 
        lowGain: -2, 
        midGain: 3, 
        highGain: 1,
        lowFreq: 100,
        midFreq: 1000,
        highFreq: 8000
      },
      compressor: { 
        enabled: true, 
        threshold: -18, 
        ratio: 3,
        attack: 5,
        release: 50,
        makeupGain: 2
      },
      noiseSuppression: { 
        enabled: true, 
        strength: 0.3,
        threshold: -40,
        attack: 1,
        release: 100
      },
    },
  },
  {
    id: "music",
    name: "Music Master",
    description: "Streaming-ready music enhancement",
    guidance: "Targets -14 LUFS for Spotify, Apple Music",
    icon: "musical-notes" as const,
    settings: {
      normalizeTargetLufs: -14, // Music streaming standard
      fadeInMs: 0,
      fadeOutMs: 500,
      eq: { 
        enabled: true, 
        lowGain: 1, 
        midGain: 0, 
        highGain: 2,
        lowFreq: 80,
        midFreq: 1200,
        highFreq: 12000
      },
      compressor: { 
        enabled: true, 
        threshold: -12, 
        ratio: 2.5,
        attack: 10,
        release: 100,
        makeupGain: 1
      },
      noiseSuppression: { enabled: false, strength: 0 },
    },
  },
  {
    id: "podcast",
    name: "Podcast Ready",
    description: "Professional podcast distribution",
    guidance: "Broadcast standard for podcast platforms",
    icon: "radio" as const,
    settings: {
      normalizeTargetLufs: -16, // Podcast platform standard
      fadeInMs: 150,
      fadeOutMs: 300,
      eq: { 
        enabled: true, 
        lowGain: -1, 
        midGain: 2, 
        highGain: 0,
        lowFreq: 120,
        midFreq: 2500,
        highFreq: 8000
      },
      compressor: { 
        enabled: true, 
        threshold: -20, 
        ratio: 4,
        attack: 3,
        release: 80,
        makeupGain: 3
      },
      noiseSuppression: { 
        enabled: true, 
        strength: 0.5,
        threshold: -45,
        attack: 2,
        release: 150
      },
    },
  },
  {
    id: "clean",
    name: "Clean & Clear",
    description: "Maximum noise reduction and clarity",
    guidance: "Heavy processing for noisy recordings",
    icon: "sparkles" as const,
    settings: {
      normalizeTargetLufs: -18, // Conservative for heavily processed audio
      fadeInMs: 200,
      fadeOutMs: 400,
      eq: { 
        enabled: true, 
        lowGain: -3, 
        midGain: 1, 
        highGain: -1,
        lowFreq: 60,
        midFreq: 3000,
        highFreq: 10000
      },
      compressor: { 
        enabled: true, 
        threshold: -24, 
        ratio: 6,
        attack: 1,
        release: 200,
        makeupGain: 4
      },
      noiseSuppression: { 
        enabled: true, 
        strength: 0.7,
        threshold: -50,
        attack: 0.5,
        release: 300
      },
    },
  },
];

export default function AudioEnhancementPanel({
  settings,
  onSettingsChange,
  lufsValue,
  previewEnabled,
  onPreviewToggle,
  onApply,
  onApplyPreset,
  activePresetId,
  abBypass,
  onABToggle,
}: AudioEnhancementPanelProps) {
  const [activeSection, setActiveSection] = useState<"presets" | "manual">("presets");

  const updateSettings = (patch: Partial<AudioEnhancementSettings>) => {
    onSettingsChange({ ...settings, ...patch });
  };

  const previewPreset = (preset: typeof ENHANCEMENT_PRESETS[0]) => {
    // Load preset settings into draft state and enable preview
    updateSettings(preset.settings);
    onPreviewToggle?.(true);
    onApplyPreset?.(preset.name); // Notify parent of preset selection for visual feedback
  };

  const getPresetGainPreview = (preset: typeof ENHANCEMENT_PRESETS[0]) => {
    if (typeof lufsValue === "number") {
      const raw = preset.settings.normalizeTargetLufs - lufsValue;
      return Math.max(-12, Math.min(12, raw));
    }
    return null;
  };

  const derivedGainDb = useMemo(() => {
    if (settings.normalizeTargetLufs != null && typeof lufsValue === "number") {
      const raw = settings.normalizeTargetLufs - lufsValue;
      return Math.max(-12, Math.min(12, raw));
    }
    return null;
  }, [settings.normalizeTargetLufs, lufsValue]);

  const canApplyNormalize = settings.normalizeTargetLufs != null && typeof lufsValue === "number";
  const canApplyAny = canApplyNormalize || !!settings.fadeInMs || !!settings.fadeOutMs;

  return (
    <View className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <View className="p-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-gray-800">Audio Enhancement</Text>
          <View className="flex-row items-center">
            {previewEnabled && (
              <View className="px-2 py-1 rounded-full bg-green-100 border border-green-300 mr-2">
                <Text className="text-green-700 text-xs font-medium">Processing ON</Text>
              </View>
            )}
            <Pressable onPress={onABToggle} disabled={!previewEnabled} className={`px-2 py-1 rounded-full mr-2 ${previewEnabled ? "bg-gray-100" : "bg-gray-200"}`}>
              <Text className={`text-xs ${previewEnabled ? "text-gray-700" : "text-gray-500"}`}>A/B</Text>
            </Pressable>
            <Text className="text-gray-600 mr-2 text-sm">Preview</Text>
            <Switch
              value={!!previewEnabled}
              onValueChange={(v) => onPreviewToggle?.(v)}
              trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
              thumbColor={previewEnabled ? "#FFFFFF" : "#9CA3AF"}
            />
          </View>
        </View>
        {/* Quick Apply Row */}
        <View className="flex-row items-center justify-between mt-3">
          <View className="flex-row items-center">
            <Ionicons name="speedometer" size={14} color="#6B7280" />
            <Text className="text-gray-600 text-sm ml-2">
              {typeof lufsValue === "number" ? `Current ${lufsValue.toFixed(1)} LUFS` : "LUFS unknown"}
              {derivedGainDb != null ? ` • Gain ${derivedGainDb >= 0 ? "+" : ""}${derivedGainDb.toFixed(1)} dB` : ""}
            </Text>
          </View>
          <Pressable
            onPress={() => onApply?.()}
            disabled={!canApplyAny}
            className={`px-3 py-2 rounded-lg ${canApplyAny ? "bg-blue-600" : "bg-gray-300"}`}
          >
            <Text className={`text-sm font-semibold ${canApplyAny ? "text-white" : "text-gray-700"}`}>Apply</Text>
          </Pressable>
        </View>
        {/* Section Toggle */}
        <View className="flex-row bg-gray-100 rounded-lg p-1 mt-3">
          <Pressable
            onPress={() => setActiveSection("presets")}
            className={`flex-1 py-2 px-3 rounded-md ${
              activeSection === "presets" ? "bg-white shadow-sm" : ""
            }`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                activeSection === "presets" ? "text-gray-900" : "text-gray-600"
              }`}
            >
              Presets
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveSection("manual")}
            className={`flex-1 py-2 px-3 rounded-md ${
              activeSection === "manual" ? "bg-white shadow-sm" : ""
            }`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                activeSection === "manual" ? "text-gray-900" : "text-gray-600"
              }`}
            >
              Manual
            </Text>
          </Pressable>
        </View>
        {!canApplyNormalize && settings.normalizeTargetLufs != null && (
          <Text className="text-amber-700 text-xs mt-2">
            Measured LUFS not available. Normalization will be skipped; fades can still be applied.
          </Text>
        )}
      </View>

      {/* Content */}
      <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
        {activeSection === "presets" ? (
          <View className="p-4">
            <Text className="text-gray-600 text-sm mb-4 leading-5">
              Choose a preset that matches your content type for instant optimization.
            </Text>
            
            <View className="space-y-3">
              {ENHANCEMENT_PRESETS.map((preset) => {
                const isActive = activePresetId === preset.id;
                const gainPreview = getPresetGainPreview(preset);
                
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => previewPreset(preset)}
                    className={`p-4 rounded-lg border-2 ${
                      isActive 
                        ? "bg-blue-50 border-blue-500" 
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <View className="flex-row items-center">
                      <View className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${
                        isActive ? "bg-blue-500" : "bg-blue-100"
                      }`}>
                        <Ionicons 
                          name={preset.icon} 
                          size={20} 
                          color={isActive ? "#FFFFFF" : "#3B82F6"} 
                        />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-1">
                          <Text className={`font-semibold ${
                            isActive ? "text-blue-800" : "text-gray-800"
                          }`}>
                            {preset.name}
                          </Text>
                          {isActive && previewEnabled && (
                            <View className="px-2 py-1 rounded-full bg-blue-500">
                              <Text className="text-white text-xs font-medium">PREVIEW</Text>
                            </View>
                          )}
                        </View>
                        <Text className={`text-sm mt-1 ${
                          isActive ? "text-blue-700" : "text-gray-600"
                        }`}>
                          {preset.description}
                        </Text>
                        <View className="flex-row items-center justify-between mt-2">
                          <Text className="text-xs text-gray-500">
                            Target: {preset.settings.normalizeTargetLufs} LUFS
                          </Text>
                          {gainPreview !== null && (
                            <Text className="text-xs text-blue-600 font-medium">
                              Gain: {gainPreview >= 0 ? "+" : ""}{gainPreview.toFixed(1)} dB
                            </Text>
                          )}
                        </View>
                        <Text className="text-xs text-gray-500 mt-1">
                          {preset.guidance}
                        </Text>
                      </View>
                      <Ionicons 
                        name={isActive ? "checkmark-circle" : "chevron-forward"} 
                        size={16} 
                        color={isActive ? "#3B82F6" : "#9CA3AF"} 
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View className="p-4 space-y-6">
            {/* Normalization */}
            <View>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="font-semibold text-gray-800">Normalize</Text>
                <View className="flex-row items-center">
                  <Pressable
                    onPress={() => updateSettings({ normalizeTargetLufs: undefined })}
                    className={`px-3 py-1 rounded-full mr-2 ${
                      settings.normalizeTargetLufs == null ? "bg-gray-300" : "bg-gray-200"
                    }`}
                  >
                    <Text className={`text-xs ${settings.normalizeTargetLufs == null ? "text-gray-800" : "text-gray-700"}`}>OFF</Text>
                  </Pressable>
                  {typeof lufsValue === "number" && (
                    <Text className="text-gray-500 text-sm">
                      Current: {lufsValue.toFixed(1)} LUFS
                    </Text>
                  )}
                </View>
              </View>
              
              <View className="flex-row flex-wrap gap-2 mb-3">
                {[-23, -20, -16, -14].map((target) => (
                  <Pressable
                    key={target}
                    onPress={() => updateSettings({ normalizeTargetLufs: target })}
                    className={`px-3 py-2 rounded-full border ${
                      settings.normalizeTargetLufs === target
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 bg-white"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        settings.normalizeTargetLufs === target
                          ? "text-blue-700"
                          : "text-gray-700"
                      }`}
                    >
                      {target} LUFS
                    </Text>
                  </Pressable>
                ))}
              </View>
              
              {derivedGainDb != null && (
                <View>
                  <Text className="text-gray-500 text-sm">
                    Applied gain: {derivedGainDb >= 0 ? "+" : ""}{derivedGainDb.toFixed(1)} dB
                  </Text>
                  {typeof lufsValue === "number" && (
                    <Text className="text-gray-400 text-xs">
                      Est. after: {(lufsValue + derivedGainDb).toFixed(1)} LUFS • Target {settings.normalizeTargetLufs} LUFS
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Fade Controls */}
            <View>
              <Text className="font-semibold text-gray-800 mb-3">Fade In/Out</Text>
              
              <View className="space-y-4">
                <View>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-gray-700">Fade In</Text>
                    <Text className="text-gray-500 text-sm">
                      {settings.fadeInMs || 0}ms
                    </Text>
                  </View>
                  <Slider
                    style={{ width: "100%" }}
                    minimumValue={0}
                    maximumValue={2000}
                    step={50}
                    value={settings.fadeInMs || 0}
                    onValueChange={(value) => updateSettings({ fadeInMs: value })}
                    minimumTrackTintColor="#3B82F6"
                    maximumTrackTintColor="#E5E7EB"
                    thumbTintColor="#3B82F6"
                  />
                </View>
                
                <View>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-gray-700">Fade Out</Text>
                    <Text className="text-gray-500 text-sm">
                      {settings.fadeOutMs || 0}ms
                    </Text>
                  </View>
                  <Slider
                    style={{ width: "100%" }}
                    minimumValue={0}
                    maximumValue={2000}
                    step={50}
                    value={settings.fadeOutMs || 0}
                    onValueChange={(value) => updateSettings({ fadeOutMs: value })}
                    minimumTrackTintColor="#3B82F6"
                    maximumTrackTintColor="#E5E7EB"
                    thumbTintColor="#3B82F6"
                  />
                </View>
              </View>
            </View>

            {/* EQ */}
            <View>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="font-semibold text-gray-800">Equalizer</Text>
                <Pressable
                  onPress={() =>
                    updateSettings({
                      eq: {
                        enabled: !settings.eq?.enabled,
                        lowGain: settings.eq?.lowGain || 0,
                        midGain: settings.eq?.midGain || 0,
                        highGain: settings.eq?.highGain || 0,
                      },
                    })
                  }
                  className={`px-3 py-1 rounded-full ${
                    settings.eq?.enabled ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      settings.eq?.enabled ? "text-white" : "text-gray-700"
                    }`}
                  >
                    {settings.eq?.enabled ? "ON" : "OFF"}
                  </Text>
                </Pressable>
              </View>
              
              {settings.eq?.enabled && (
                <View className="space-y-3">
                  {[
                    { key: "lowGain", label: "Low", value: settings.eq.lowGain },
                    { key: "midGain", label: "Mid", value: settings.eq.midGain },
                    { key: "highGain", label: "High", value: settings.eq.highGain },
                  ].map(({ key, label, value }) => (
                    <View key={key}>
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-gray-700">{label}</Text>
                        <Text className="text-gray-500 text-sm">
                          {value?.toFixed(1) || "0.0"} dB
                        </Text>
                      </View>
                      <Slider
                        style={{ width: "100%" }}
                        minimumValue={-12}
                        maximumValue={12}
                        step={0.5}
                        value={value || 0}
                        onValueChange={(newValue) =>
                          updateSettings({
                            eq: { 
                              enabled: true,
                              lowGain: settings.eq?.lowGain || 0,
                              midGain: settings.eq?.midGain || 0,
                              highGain: settings.eq?.highGain || 0,
                              [key]: newValue,
                            },
                          })
                        }
                        minimumTrackTintColor="#3B82F6"
                        maximumTrackTintColor="#E5E7EB"
                        thumbTintColor="#3B82F6"
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Compressor */}
            <View>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="font-semibold text-gray-800">Compressor</Text>
                <Pressable
                  onPress={() =>
                    updateSettings({
                      compressor: {
                        enabled: !settings.compressor?.enabled,
                        threshold: settings.compressor?.threshold || -12,
                        ratio: settings.compressor?.ratio || 2,
                      },
                    })
                  }
                  className={`px-3 py-1 rounded-full ${
                    settings.compressor?.enabled ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      settings.compressor?.enabled ? "text-white" : "text-gray-700"
                    }`}
                  >
                    {settings.compressor?.enabled ? "ON" : "OFF"}
                  </Text>
                </Pressable>
              </View>
              
              {settings.compressor?.enabled && (
                <View className="space-y-3">
                  <View>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-gray-700">Threshold</Text>
                      <Text className="text-gray-500 text-sm">
                        {settings.compressor.threshold?.toFixed(1) || "-12.0"} dB
                      </Text>
                    </View>
                    <Slider
                      style={{ width: "100%" }}
                      minimumValue={-40}
                      maximumValue={0}
                      step={1}
                      value={settings.compressor?.threshold || -12}
                      onValueChange={(value) =>
                        updateSettings({
                          compressor: {
                            enabled: true,
                            threshold: value,
                            ratio: settings.compressor?.ratio || 2,
                            attack: settings.compressor?.attack,
                            release: settings.compressor?.release,
                            makeupGain: settings.compressor?.makeupGain,
                          },
                        })
                      }
                      minimumTrackTintColor="#EF4444"
                      maximumTrackTintColor="#E5E7EB"
                      thumbTintColor="#EF4444"
                    />
                  </View>
                  
                  <View>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-gray-700">Ratio</Text>
                      <Text className="text-gray-500 text-sm">
                        {settings.compressor.ratio?.toFixed(1) || "2.0"}:1
                      </Text>
                    </View>
                    <Slider
                      style={{ width: "100%" }}
                      minimumValue={1}
                      maximumValue={10}
                      step={0.1}
                      value={settings.compressor?.ratio || 2}
                      onValueChange={(value) =>
                        updateSettings({
                          compressor: {
                            enabled: true,
                            threshold: settings.compressor?.threshold || -12,
                            ratio: value,
                            attack: settings.compressor?.attack,
                            release: settings.compressor?.release,
                            makeupGain: settings.compressor?.makeupGain,
                          },
                        })
                      }
                      minimumTrackTintColor="#F59E0B"
                      maximumTrackTintColor="#E5E7EB"
                      thumbTintColor="#F59E0B"
                    />
                  </View>
                  
                  <View>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-gray-700">Attack</Text>
                      <Text className="text-gray-500 text-sm">
                        {settings.compressor.attack?.toFixed(1) || "10.0"} ms
                      </Text>
                    </View>
                    <Slider
                      style={{ width: "100%" }}
                      minimumValue={0.1}
                      maximumValue={100}
                      step={0.1}
                      value={settings.compressor?.attack || 10}
                      onValueChange={(value) =>
                        updateSettings({
                          compressor: {
                            enabled: true,
                            threshold: settings.compressor?.threshold || -12,
                            ratio: settings.compressor?.ratio || 2,
                            attack: value,
                            release: settings.compressor?.release,
                            makeupGain: settings.compressor?.makeupGain,
                          },
                        })
                      }
                      minimumTrackTintColor="#8B5CF6"
                      maximumTrackTintColor="#E5E7EB"
                      thumbTintColor="#8B5CF6"
                    />
                  </View>
                  
                  <View>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-gray-700">Release</Text>
                      <Text className="text-gray-500 text-sm">
                        {settings.compressor.release?.toFixed(0) || "100"} ms
                      </Text>
                    </View>
                    <Slider
                      style={{ width: "100%" }}
                      minimumValue={10}
                      maximumValue={1000}
                      step={10}
                      value={settings.compressor?.release || 100}
                      onValueChange={(value) =>
                        updateSettings({
                          compressor: {
                            enabled: true,
                            threshold: settings.compressor?.threshold || -12,
                            ratio: settings.compressor?.ratio || 2,
                            attack: settings.compressor?.attack,
                            release: value,
                            makeupGain: settings.compressor?.makeupGain,
                          },
                        })
                      }
                      minimumTrackTintColor="#10B981"
                      maximumTrackTintColor="#E5E7EB"
                      thumbTintColor="#10B981"
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}