import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Crypto from "expo-crypto";
import { useUserStore } from "../state/userStore";
import { useStationStore } from "../state/stationStore";
import { useGlobalLibrary, ShareMode } from "../state/globalLibraryStore";
import { StationPill } from "../components/StationSwitcher";
import { canShareGlobal } from "../utils/rbac";

export default function GlobalLibraryScreen() {
  const user = useUserStore((s) => s.user);
  const stations = useStationStore((s) => s.stations);
  const { assets, shares, rollouts, audit, addAsset, addShare } = useGlobalLibrary();
  const [showShareFor, setShowShareFor] = useState<string | null>(null);
  const [shareMode, setShareMode] = useState<ShareMode>("Mirror");
  const [targets, setTargets] = useState<string[]>([]);
  const [targetAll, setTargetAll] = useState<boolean>(false);
  const [emailBody, setEmailBody] = useState("");

  const canShare = useMemo(() => canShareGlobal(user.memberships.find(m => m.stationId === user.currentStationId)?.role || "Viewer"), [user]);

  const onUpload = async () => {
    if (!canShare) return;
    const res = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const asset = { id: Crypto.randomUUID(), name: a.name || "Asset", uri: a.uri, version: 1, createdAt: Date.now(), createdBy: user.id };
    addAsset(asset);
  };

  const shareAsset = (assetId: string) => {
    setShowShareFor(assetId);
    setShareMode("Mirror");
    setTargets([]);
    setTargetAll(false);
  };

  const saveShare = () => {
    if (!showShareFor) return;
    const stationsTarget = targetAll ? user.memberships.map(m => m.stationId) : targets;
    const s = { id: Crypto.randomUUID(), assetId: showShareFor, mode: shareMode, target: targetAll ? { all: true } : { stationIds: targets }, createdAt: Date.now(), createdBy: user.id } as const;
    addShare(s as any, stationsTarget);
    setShowShareFor(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
        <View className="bg-white px-6 py-4 border-b border-gray-200">
          <Text className="text-2xl font-bold text-gray-800">Global Library</Text>
          <Text className="text-gray-600">Upload once, share everywhere</Text>
        </View>
        <View className="px-6 mt-2">
          <StationPill />
        </View>

        {/* Upload */}
        <View className="bg-white mt-2 px-6 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-gray-800">Assets ({assets.length})</Text>
            <Pressable disabled={!canShare} onPress={onUpload} className={`px-3 py-2 rounded-lg ${canShare ? "bg-blue-500" : "bg-blue-300"}`}>
              <Text className="text-white font-medium">Upload</Text>
            </Pressable>
          </View>
          <View className="mt-3 space-y-3">
            {assets.map((a) => (
              <View key={a.id} className="p-4 rounded-lg border-2 border-gray-200 bg-gray-50">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="font-medium text-gray-800">{a.name}</Text>
                    <Text className="text-gray-500 text-xs">v{a.version} • {new Date(a.createdAt).toLocaleString()}</Text>
                  </View>
                  <Pressable onPress={() => shareAsset(a.id)} className="bg-purple-500 rounded-lg px-3 py-2">
                    <Text className="text-white">Share</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {assets.length === 0 && (
              <Text className="text-gray-500">No assets yet</Text>
            )}
          </View>
        </View>

        {/* Rollout Dashboard */}
        <View className="bg-white mt-2 px-6 py-4">
          <Text className="text-lg font-semibold text-gray-800 mb-2">Rollout Dashboard</Text>
          <View className="space-y-2">
            {rollouts.map((r) => (
              <View key={r.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                <Text className="text-gray-800">Asset {r.assetId} ➝ {stations.find(s => s.id === r.stationId)?.name || r.stationId}</Text>
                <Text className={`text-xs mt-1 ${r.status === 'delivered' ? 'text-green-700' : r.status === 'failed' ? 'text-red-700' : 'text-gray-700'}`}>Status: {r.status}</Text>
              </View>
            ))}
            {rollouts.length === 0 && <Text className="text-gray-500">No rollout activity</Text>}
          </View>
        </View>

        {/* Audit Log */}
        <View className="bg-white mt-2 px-6 py-4 mb-6">
          <Text className="text-lg font-semibold text-gray-800 mb-2">Audit Log</Text>
          <View className="space-y-2">
            {audit.map((e) => (
              <View key={e.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                <Text className="text-gray-800">{e.type.toUpperCase()} • {new Date(e.at).toLocaleString()}</Text>
                {e.assetId && <Text className="text-gray-500 text-xs">Asset {e.assetId}</Text>}
              </View>
            ))}
            {audit.length === 0 && <Text className="text-gray-500">No audit entries</Text>}
          </View>
        </View>
      </ScrollView>

      {/* Share Modal */}
      <Modal visible={!!showShareFor} transparent animationType="slide" onRequestClose={() => setShowShareFor(null)}>
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-xl font-bold text-gray-800 mb-2">Share Asset</Text>
            <Text className="text-gray-600 mb-3">Choose mode and targets</Text>

            {/* Modes */}
            <View className="flex-row mb-3">
              {(["Mirror","Sync","Copy"] as ShareMode[]).map((m) => (
                <Pressable key={m} onPress={() => setShareMode(m)} className={`px-3 py-2 rounded-full border-2 mr-2 ${shareMode === m ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}>
                  <Text className={`${shareMode === m ? 'text-blue-700' : 'text-gray-700'}`}>{m}</Text>
                </Pressable>
              ))}
            </View>

            {/* Targets */}
            <View className="mb-3">
              <Pressable onPress={() => setTargetAll(!targetAll)} className={`px-3 py-2 rounded-full border-2 mb-2 ${targetAll ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}>
                <Text className={`${targetAll ? 'text-blue-700' : 'text-gray-700'}`}>All stations</Text>
              </Pressable>
              {!targetAll && (
                <View className="flex-row flex-wrap gap-2">
                  {user.memberships.map((m) => (
                    <Pressable key={m.stationId} onPress={() => setTargets(t => t.includes(m.stationId) ? t.filter(x => x !== m.stationId) : [...t, m.stationId])} className={`px-3 py-2 rounded-full border-2 ${targets.includes(m.stationId) ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}>
                      <Text className={`${targets.includes(m.stationId) ? 'text-blue-700' : 'text-gray-700'}`}>{stations.find(s => s.id === m.stationId)?.name || m.stationId}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View className="flex-row mt-4">
              <Pressable onPress={() => setShowShareFor(null)} className="flex-1 bg-gray-200 rounded-lg p-3 mr-2">
                <Text className="text-center text-gray-700 font-medium">Cancel</Text>
              </Pressable>
              <Pressable onPress={saveShare} className="flex-1 bg-purple-500 rounded-lg p-3 ml-2">
                <Text className="text-center text-white font-medium">Share</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
