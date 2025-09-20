import React, { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Track, EffectChain } from "../../state/audioStore";

export type EffectsModalProps = {
  visible: boolean;
  track: Track;
  onClose: () => void;
  onUpdate: (effects: EffectChain) => void;
  onReorder?: (direction: "up" | "down") => void;
  onRemove?: () => void;
};

export default function EffectsModal({
  visible,
  track,
  onClose,
  onUpdate,
  onReorder,
  onRemove,
}: EffectsModalProps) {
  const [activeTab, setActiveTab] = useState<"eq" | "compressor" | "reverb" | "track">("track");
  const effects = track.effects;

  const updateEQ = (patch: Partial<typeof effects.eq>) => {
    onUpdate({
      ...effects,
      eq: { ...effects.eq, ...patch },
    });
  };

  const updateCompressor = (patch: Partial<typeof effects.compressor>) => {
    onUpdate({
      ...effects,
      compressor: { ...effects.compressor, ...patch },
    });
  };

  const updateReverb = (patch: Partial<typeof effects.reverb>) => {
    onUpdate({
      ...effects,
      reverb: { ...effects.reverb, ...patch },
    });
  };

  const renderEQTab = () => (
    <View className="p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-white font-semibold">3-Band EQ</Text>
        <Pressable
          onPress={() => updateEQ({ enabled: !effects.eq.enabled })}
          className={`px-3 py-1 rounded-full ${
            effects.eq.enabled ? "bg-green-600" : "bg-gray-600"
          }`}
        >
          <Text className="text-white text-sm">
            {effects.eq.enabled ? "ON" : "OFF"}
          </Text>
        </Pressable>
      </View>

      {effects.eq.enabled && (
        <>
          {/* Low Band */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300">Low ({effects.eq.lowFreq}Hz)</Text>
              <Text className="text-gray-300">{effects.eq.lowGain.toFixed(1)}dB</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={-12}
              maximumValue={12}
              value={effects.eq.lowGain}
              step={0.1}
              onValueChange={(value) => updateEQ({ lowGain: value })}
              minimumTrackTintColor="#3B82F6"
              maximumTrackTintColor="#374151"
              thumbTintColor="#3B82F6"
            />
            <Slider
              style={{ width: "100%", height: 30 }}
              minimumValue={20}
              maximumValue={500}
              value={effects.eq.lowFreq}
              step={10}
              onValueChange={(value) => updateEQ({ lowFreq: value })}
              minimumTrackTintColor="#10B981"
              maximumTrackTintColor="#374151"
              thumbTintColor="#10B981"
            />
          </View>

          {/* Mid Band */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300">Mid ({effects.eq.midFreq}Hz)</Text>
              <Text className="text-gray-300">{effects.eq.midGain.toFixed(1)}dB</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={-12}
              maximumValue={12}
              value={effects.eq.midGain}
              step={0.1}
              onValueChange={(value) => updateEQ({ midGain: value })}
              minimumTrackTintColor="#3B82F6"
              maximumTrackTintColor="#374151"
              thumbTintColor="#3B82F6"
            />
            <Slider
              style={{ width: "100%", height: 30 }}
              minimumValue={200}
              maximumValue={5000}
              value={effects.eq.midFreq}
              step={50}
              onValueChange={(value) => updateEQ({ midFreq: value })}
              minimumTrackTintColor="#10B981"
              maximumTrackTintColor="#374151"
              thumbTintColor="#10B981"
            />
          </View>

          {/* High Band */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300">High ({effects.eq.highFreq}Hz)</Text>
              <Text className="text-gray-300">{effects.eq.highGain.toFixed(1)}dB</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={-12}
              maximumValue={12}
              value={effects.eq.highGain}
              step={0.1}
              onValueChange={(value) => updateEQ({ highGain: value })}
              minimumTrackTintColor="#3B82F6"
              maximumTrackTintColor="#374151"
              thumbTintColor="#3B82F6"
            />
            <Slider
              style={{ width: "100%", height: 30 }}
              minimumValue={2000}
              maximumValue={20000}
              value={effects.eq.highFreq}
              step={100}
              onValueChange={(value) => updateEQ({ highFreq: value })}
              minimumTrackTintColor="#10B981"
              maximumTrackTintColor="#374151"
              thumbTintColor="#10B981"
            />
          </View>
        </>
      )}
    </View>
  );

  const renderCompressorTab = () => (
    <View className="p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-white font-semibold">Compressor</Text>
        <Pressable
          onPress={() => updateCompressor({ enabled: !effects.compressor.enabled })}
          className={`px-3 py-1 rounded-full ${
            effects.compressor.enabled ? "bg-green-600" : "bg-gray-600"
          }`}
        >
          <Text className="text-white text-sm">
            {effects.compressor.enabled ? "ON" : "OFF"}
          </Text>
        </Pressable>
      </View>

      {effects.compressor.enabled && (
        <>
          {/* Threshold */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300">Threshold</Text>
              <Text className="text-gray-300">{effects.compressor.threshold.toFixed(1)}dB</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={-40}
              maximumValue={0}
              value={effects.compressor.threshold}
              step={0.5}
              onValueChange={(value) => updateCompressor({ threshold: value })}
              minimumTrackTintColor="#EF4444"
              maximumTrackTintColor="#374151"
              thumbTintColor="#EF4444"
            />
          </View>

          {/* Ratio */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300">Ratio</Text>
              <Text className="text-gray-300">{effects.compressor.ratio.toFixed(1)}:1</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={1}
              maximumValue={20}
              value={effects.compressor.ratio}
              step={0.1}
              onValueChange={(value) => updateCompressor({ ratio: value })}
              minimumTrackTintColor="#F59E0B"
              maximumTrackTintColor="#374151"
              thumbTintColor="#F59E0B"
            />
          </View>

          {/* Attack */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300">Attack</Text>
              <Text className="text-gray-300">{effects.compressor.attack.toFixed(0)}ms</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0.1}
              maximumValue={100}
              value={effects.compressor.attack}
              step={0.1}
              onValueChange={(value) => updateCompressor({ attack: value })}
              minimumTrackTintColor="#8B5CF6"
              maximumTrackTintColor="#374151"
              thumbTintColor="#8B5CF6"
            />
          </View>

          {/* Release */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300">Release</Text>
              <Text className="text-gray-300">{effects.compressor.release.toFixed(0)}ms</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={10}
              maximumValue={1000}
              value={effects.compressor.release}
              step={10}
              onValueChange={(value) => updateCompressor({ release: value })}
              minimumTrackTintColor="#8B5CF6"
              maximumTrackTintColor="#374151"
              thumbTintColor="#8B5CF6"
            />
          </View>

          {/* Makeup Gain */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300">Makeup Gain</Text>
              <Text className="text-gray-300">{effects.compressor.makeupGain.toFixed(1)}dB</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={20}
              value={effects.compressor.makeupGain}
              step={0.1}
              onValueChange={(value) => updateCompressor({ makeupGain: value })}
              minimumTrackTintColor="#10B981"
              maximumTrackTintColor="#374151"
              thumbTintColor="#10B981"
            />
          </View>
        </>
      )}
    </View>
  );

  const renderReverbTab = () => (
    <View className="p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-white font-semibold">Reverb</Text>
        <Pressable
          onPress={() => updateReverb({ enabled: !effects.reverb.enabled })}
          className={`px-3 py-1 rounded-full ${
            effects.reverb.enabled ? "bg-green-600" : "bg-gray-600"
          }`}
        >
          <Text className="text-white text-sm">
            {effects.reverb.enabled ? "ON" : "OFF"}
          </Text>
        </Pressable>
      </View>

      {effects.reverb.enabled && (
        <>
          {/* Room Size */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300">Room Size</Text>
              <Text className="text-gray-300">{Math.round(effects.reverb.roomSize * 100)}%</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={1}
              value={effects.reverb.roomSize}
              step={0.01}
              onValueChange={(value) => updateReverb({ roomSize: value })}
              minimumTrackTintColor="#6366F1"
              maximumTrackTintColor="#374151"
              thumbTintColor="#6366F1"
            />
          </View>

          {/* Damping */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300">Damping</Text>
              <Text className="text-gray-300">{Math.round(effects.reverb.damping * 100)}%</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={1}
              value={effects.reverb.damping}
              step={0.01}
              onValueChange={(value) => updateReverb({ damping: value })}
              minimumTrackTintColor="#EC4899"
              maximumTrackTintColor="#374151"
              thumbTintColor="#EC4899"
            />
          </View>

          {/* Wet Level */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300">Wet Level</Text>
              <Text className="text-gray-300">{Math.round(effects.reverb.wetLevel * 100)}%</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={1}
              value={effects.reverb.wetLevel}
              step={0.01}
              onValueChange={(value) => updateReverb({ wetLevel: value })}
              minimumTrackTintColor="#06B6D4"
              maximumTrackTintColor="#374151"
              thumbTintColor="#06B6D4"
            />
          </View>

          {/* Dry Level */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300">Dry Level</Text>
              <Text className="text-gray-300">{Math.round(effects.reverb.dryLevel * 100)}%</Text>
            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={1}
              value={effects.reverb.dryLevel}
              step={0.01}
              onValueChange={(value) => updateReverb({ dryLevel: value })}
              minimumTrackTintColor="#84CC16"
              maximumTrackTintColor="#374151"
              thumbTintColor="#84CC16"
            />
          </View>
        </>
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 bg-black bg-opacity-75 justify-end">
        <View className="bg-gray-900 rounded-t-2xl max-h-[80%]">
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-gray-700">
            <Text className="text-white text-lg font-semibold">
              {track.name} - Effects
            </Text>
            <Pressable onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Tab Navigation */}
          <View className="flex-row border-b border-gray-700">
            {[
              { id: "track", label: "Track", icon: "settings" },
              { id: "eq", label: "EQ", icon: "equalizer" },
              { id: "compressor", label: "Comp", icon: "contract" },
              { id: "reverb", label: "Reverb", icon: "radio-button-on" },
            ].map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex-row items-center justify-center py-3 ${
                  activeTab === tab.id ? "bg-blue-600" : "bg-transparent"
                }`}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={16}
                  color={activeTab === tab.id ? "#FFFFFF" : "#9CA3AF"}
                />
                <Text
                  className={`ml-2 text-sm ${
                    activeTab === tab.id ? "text-white" : "text-gray-400"
                  }`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Tab Content */}
          <ScrollView className="flex-1">
            {activeTab === "track" && (
              <View className="p-4">
                <Text className="text-white font-semibold mb-4">Track Management</Text>
                
                {/* Track Reordering */}
                {onReorder && (
                  <View className="mb-6">
                    <Text className="text-gray-300 mb-3">Track Position</Text>
                    <View className="flex-row gap-3">
                      <Pressable
                        onPress={() => onReorder("up")}
                        className="flex-1 bg-blue-600 rounded-lg py-3"
                      >
                        <View className="flex-row items-center justify-center">
                          <Ionicons name="chevron-up" size={16} color="white" />
                          <Text className="text-white ml-2">Move Up</Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => onReorder("down")}
                        className="flex-1 bg-blue-600 rounded-lg py-3"
                      >
                        <View className="flex-row items-center justify-center">
                          <Ionicons name="chevron-down" size={16} color="white" />
                          <Text className="text-white ml-2">Move Down</Text>
                        </View>
                      </Pressable>
                    </View>
                  </View>
                )}
                
                {/* Track Removal */}
                {onRemove && track.type !== "master" && (
                  <View className="mb-6">
                    <Text className="text-gray-300 mb-3">Danger Zone</Text>
                    <Pressable
                      onPress={onRemove}
                      className="bg-red-600 rounded-lg py-3"
                    >
                      <View className="flex-row items-center justify-center">
                        <Ionicons name="trash" size={16} color="white" />
                        <Text className="text-white ml-2">Remove Track</Text>
                      </View>
                    </Pressable>
                  </View>
                )}
                
                {/* Track Info */}
                <View className="bg-gray-800 rounded-lg p-4">
                  <Text className="text-gray-300 text-sm">Track Type: {track.type.toUpperCase()}</Text>
                  <Text className="text-gray-300 text-sm mt-1">Index: {track.index}</Text>
                  <Text className="text-gray-300 text-sm mt-1">Height: {track.height}px</Text>
                </View>
              </View>
            )}
            {activeTab === "eq" && renderEQTab()}
            {activeTab === "compressor" && renderCompressorTab()}
            {activeTab === "reverb" && renderReverbTab()}
          </ScrollView>

          {/* Footer */}
          <View className="flex-row p-4 border-t border-gray-700">
            <Pressable
              onPress={() => {
                // Reset all effects
                onUpdate({
                  eq: { enabled: false, lowGain: 0, midGain: 0, highGain: 0, lowFreq: 100, midFreq: 1000, highFreq: 10000 },
                  compressor: { enabled: false, threshold: -12, ratio: 4, attack: 10, release: 100, makeupGain: 0 },
                  reverb: { enabled: false, roomSize: 0.5, damping: 0.5, wetLevel: 0.3, dryLevel: 0.7 },
                });
              }}
              className="flex-1 bg-gray-700 rounded-lg py-3 mr-2"
            >
              <Text className="text-white text-center font-medium">Reset All</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              className="flex-1 bg-blue-600 rounded-lg py-3 ml-2"
            >
              <Text className="text-white text-center font-medium">Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}