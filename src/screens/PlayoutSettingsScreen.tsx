import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as FileSystem from "expo-file-system";
import * as Clipboard from "expo-clipboard";
import { useUserStore } from "../state/userStore";
import { useProfilesStore, buildDefaultProfile } from "../state/profileStore";
import { StationProfile, PlayoutSystem, DeliveryMethod } from "../types/playout";
import { getDelivery } from "../api/delivery";

const pill = "px-3 py-2 rounded-full border-2";

const systems: PlayoutSystem[] = ["myriad", "mairlist", "enco", "generic"];
const sidecars = ["csv", "xml", "mmd", "none"] as const;
const methods: DeliveryMethod[] = ["local", "sftp", "smb", "s3", "azure", "gcp", "api", "dropbox"];

export default function PlayoutSettingsScreen() {
  const stationId = useUserStore((s) => s.user.currentStationId) ?? "station-a";
  const station = require("../state/stationStore").useStationStore.getState().stations.find((st: any) => st.id === stationId);
  const fromStore = useProfilesStore((s) => s.byStation[stationId]);
  const setProfileStore = useProfilesStore((s) => s.setProfile);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const [profile, setProfile] = useState<StationProfile>(
    fromStore ?? buildDefaultProfile(stationId, station?.name)
  );

  const baseRoot = FileSystem.documentDirectory + `Exports/${stationId}/`;
  const targetFolder = useMemo(() => baseRoot + (profile.delivery.remotePath?.replace(/^\/+|\/+$/g, "") || ""), [baseRoot, profile.delivery.remotePath]);

  const save = () => {
    const rp = (profile.delivery.remotePath || "").trim();
    if (!rp) { setStatus({ type: "error", message: "Remote Path is required" }); return; }
    setProfileStore(stationId, { ...profile, delivery: { ...profile.delivery, remotePath: rp }, id: stationId, name: station?.name || profile.name });
    setStatus({ type: "success", message: "Playout settings saved" });
  };

  const testConnection = async () => {
    setStatus(null);
    try {
      const del = await getDelivery(profile.delivery.method || "local");
      const testPath = targetFolder.replace(/\/$/, "") + "/__test__.txt";
      const tmp = testPath + ".tmp";
      await FileSystem.writeAsStringAsync(tmp, "ok");
      await del.rename(tmp, testPath);
      const ok = await del.verify(testPath);
      if (!ok) throw new Error("Verify failed");
      setStatus({ type: "success", message: `Connection OK. Test file at ${testPath}` });
    } catch (e: any) {
      setStatus({ type: "error", message: "Test failed. Check method and path." });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 py-4 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-800">Playout Settings</Text>
        <Text className="text-gray-600">Configure station profile, sidecar and delivery</Text>
      </View>
      <ScrollView className="flex-1">
        {status && (
          <View className={`${status.type === "error" ? "bg-red-50 border-red-200" : status.type === "success" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"} border rounded-md mx-6 mt-3 px-3 py-2`}>
            <Text className={`${status.type === "error" ? "text-red-700" : status.type === "success" ? "text-green-700" : "text-blue-700"} text-sm`}>{status.message}</Text>
          </View>
        )}

        {/* Playout System */}
        <View className="bg-white mt-2 px-6 py-4">
          <Text className="text-lg font-semibold text-gray-800 mb-3">Playout System</Text>
          <View className="flex-row flex-wrap gap-2">
            {systems.map((s) => (
              <Pressable key={s} onPress={() => setProfile((p) => ({ ...p, playout: s }))} className={`${pill} ${profile.playout === s ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"}`}>
                <Text className={`${profile.playout === s ? "text-blue-700" : "text-gray-700"}`}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Sidecar */}
        <View className="bg-white mt-2 px-6 py-4">
          <Text className="text-lg font-semibold text-gray-800 mb-3">Sidecar</Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {sidecars.map((t) => (
              <Pressable key={t} onPress={() => setProfile((p) => ({ ...p, sidecar: { ...p.sidecar, type: t } }))} className={`${pill} ${profile.sidecar.type === t ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"}`}>
                <Text className={`${profile.sidecar.type === t ? "text-blue-700" : "text-gray-700"}`}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <Text className="text-gray-600 text-sm">Fields are fixed for now based on system.</Text>
        </View>

        {/* Delivery */}
        <View className="bg-white mt-2 px-6 py-4">
          <Text className="text-lg font-semibold text-gray-800 mb-3">Delivery</Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {methods.map((m) => (
              <Pressable key={m} onPress={() => setProfile((p) => ({ ...p, delivery: { ...p.delivery, method: m } }))} className={`${pill} ${profile.delivery.method === m ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"}`}>
                <Text className={`${profile.delivery.method === m ? "text-blue-700" : "text-gray-700"}`}>{m}</Text>
              </Pressable>
            ))}
          </View>
          <Text className="text-gray-700 mb-2">Remote Path (folder)</Text>
          <TextInput value={profile.delivery.remotePath} onChangeText={(v) => setProfile((p) => ({ ...p, delivery: { ...p.delivery, remotePath: v } }))} placeholder="DropIn" className="border border-gray-300 rounded-lg px-3 py-2 bg-white" />
          {profile.delivery.method !== "local" && (
            <View className="mt-3">
              <Text className="text-gray-600 text-sm">Non-local methods are routed to local staging for now.</Text>
              <View className="flex-row gap-2 mt-2">
                <TextInput value={profile.delivery.host ?? ""} onChangeText={(v) => setProfile((p) => ({ ...p, delivery: { ...p.delivery, host: v } }))} placeholder="Host" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white" />
                <TextInput value={profile.delivery.port ? String(profile.delivery.port) : ""} onChangeText={(v) => setProfile((p) => ({ ...p, delivery: { ...p.delivery, port: v ? parseInt(v, 10) : null } }))} placeholder="Port" keyboardType="numeric" className="w-24 border border-gray-300 rounded-lg px-3 py-2 bg-white" />
              </View>
              <View className="flex-row gap-2 mt-2">
                <TextInput value={profile.delivery.username ?? ""} onChangeText={(v) => setProfile((p) => ({ ...p, delivery: { ...p.delivery, username: v } }))} placeholder="Username" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white" />
                <TextInput value={profile.delivery.password ?? ""} onChangeText={(v) => setProfile((p) => ({ ...p, delivery: { ...p.delivery, password: v } }))} placeholder="Password" secureTextEntry className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white" />
              </View>
            </View>
          )}
          <View className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <Text className="text-gray-700 text-sm">Staging path preview</Text>
            <Text className="text-gray-800 text-xs mt-1">{targetFolder}</Text>
            <View className="flex-row gap-2 mt-2">
              <Pressable onPress={async () => { try { await Clipboard.setStringAsync(targetFolder); setStatus({ type: 'info', message: 'Staging path copied' }); } catch {} }} className="px-3 py-2 rounded-lg bg-gray-200"><Text className="text-gray-800 text-sm">Copy path</Text></Pressable>
            </View>
          </View>
          <View className="flex-row gap-3 mt-4">
            <Pressable onPress={testConnection} className="flex-1 bg-gray-800 rounded-lg p-3"><Text className="text-center text-white font-medium">Test Connection</Text></Pressable>
            <Pressable onPress={save} className="flex-1 bg-blue-600 rounded-lg p-3"><Text className="text-center text-white font-medium">Save</Text></Pressable>
          </View>
          <View className="mt-3">
            <Pressable onPress={() => {
              const stations = require("../state/stationStore").useStationStore.getState().stations as any[];
              const others = stations.filter(s => s.id !== stationId);
              const srcId = (others[0]?.id) as string | undefined;
              if (!srcId) { setStatus({ type: 'info', message: 'No other station profiles found' }); return; }
              const src = useProfilesStore.getState().byStation[srcId];
              if (!src) { setStatus({ type: 'info', message: 'Source profile not saved yet' }); return; }
              setProfileStore(stationId, { ...profile, playout: src.playout, sidecar: src.sidecar, mappings: src.mappings, defaults: { ...profile.defaults, fileFormat: src.defaults.fileFormat, bitDepth: src.defaults.bitDepth, loudnessLUFS: src.defaults.loudnessLUFS, truePeakDBTP: src.defaults.truePeakDBTP } });
              setStatus({ type: 'success', message: 'Copied playout settings from ' + (others[0]?.name || srcId) });
            }} className="px-3 py-2 rounded-full bg-gray-200"><Text className="text-gray-800 text-sm">Copy from another station…</Text></Pressable>
          </View>
        </View>

        {/* Defaults */}
        <View className="bg-white mt-2 px-6 py-4 mb-10">
          <Text className="text-lg font-semibold text-gray-800 mb-3">Defaults</Text>
          <View className="flex-row gap-2">
            <TextInput value={profile.defaults.fileFormat} onChangeText={(v) => setProfile((p) => ({ ...p, defaults: { ...p.defaults, fileFormat: (v === "mp3" ? "mp3" : "wav") } }))} placeholder="wav|mp3" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white" />
            <TextInput value={String(profile.defaults.bitDepth)} onChangeText={(v) => setProfile((p) => ({ ...p, defaults: { ...p.defaults, bitDepth: (v === "24" ? 24 : 16) } }))} placeholder="Bit depth" keyboardType="numeric" className="w-28 border border-gray-300 rounded-lg px-3 py-2 bg-white" />
          </View>
          <View className="flex-row gap-2 mt-2">
            <TextInput value={String(profile.defaults.sampleRateHz)} onChangeText={(v) => setProfile((p) => ({ ...p, defaults: { ...p.defaults, sampleRateHz: v ? parseInt(v, 10) : 44100 } }))} placeholder="Sample rate" keyboardType="numeric" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white" />
            <TextInput value={String(profile.defaults.eomSec)} onChangeText={(v) => setProfile((p) => ({ ...p, defaults: { ...p.defaults, eomSec: v ? parseFloat(v) : 0 } }))} placeholder="EOM sec" keyboardType="numeric" className="w-28 border border-gray-300 rounded-lg px-3 py-2 bg-white" />
          </View>
          <View className="flex-row gap-2 mt-2">
            <TextInput value={profile.defaults.category} onChangeText={(v) => setProfile((p) => ({ ...p, defaults: { ...p.defaults, category: v } }))} placeholder="Default category" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
