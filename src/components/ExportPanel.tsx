import React, { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as MailComposer from "expo-mail-composer";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { useRecordingsForStation } from "../state/audioStore";
import { useUserStore } from "../state/userStore";
import { buildExportFilename } from "../utils/fileNaming";
import { useNavigation } from "@react-navigation/native";

export type ExportPanelProps = {
  selectedIds: string[];
  onClear: () => void;
};

export default function ExportPanel({ selectedIds, onClear }: ExportPanelProps) {
  const stationId = useUserStore((s) => s.user.currentStationId) ?? "station-a";
  const recordings = useRecordingsForStation(stationId);
  const selected = useMemo(() => recordings.filter(r => selectedIds.includes(r.id)), [recordings, selectedIds]);
  const navigation = useNavigation<any>();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const shareSelected = async () => {
    setStatus(null);
    try {
      if (selected.length === 0) { setStatus("Select at least one file"); return; }
      if (!(await Sharing.isAvailableAsync())) { setStatus("Sharing not available on this device"); return; }
      // Share first item for simplicity
      await Sharing.shareAsync(selected[0].uri, { dialogTitle: "Share audio" });
    } catch (e: any) { setStatus(e?.message || "Share failed"); }
  };

  const emailSelected = async () => {
    setStatus(null);
    try {
      if (!email.trim()) { setStatus("Enter an email address"); return; }
      if (selected.length === 0) { setStatus("Select at least one file"); return; }
      const can = await MailComposer.isAvailableAsync();
      if (!can) { setStatus("Mail not available"); return; }
      const attachments: string[] = [];
      for (const rec of selected.slice(0, 5)) { // limit for reliability
        // Ensure file exists and use a friendly name
        const info = await FileSystem.getInfoAsync(rec.uri);
        if (info.exists) {
          const tmp = `${FileSystem.cacheDirectory}send-${rec.id}-${Date.now()}.m4a`;
          try { await FileSystem.copyAsync({ from: rec.uri, to: tmp }); } catch {}
          attachments.push(tmp);
        }
      }
      await MailComposer.composeAsync({ recipients: [email.trim()], subject: "Audio Files", body: "Please find attached.", attachments });
      setStatus("Email draft created");
    } catch (e: any) { setStatus(e?.message || "Email failed"); }
  };

  return (
    <View className="mt-3 p-3 rounded-2xl border border-gray-200 bg-white">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-base font-semibold text-gray-900">Export & Share</Text>
        <Pressable onPress={onClear} className="px-3 py-1 rounded-full bg-gray-100">
          <Text className="text-gray-700 text-sm">Clear</Text>
        </Pressable>
      </View>
      <Text className="text-gray-600 text-sm mb-3">Selected {selectedIds.length} item{selectedIds.length === 1 ? "" : "s"}</Text>

      <View className="flex-row gap-3">
        <Pressable onPress={shareSelected} className="flex-1 rounded-xl p-3 bg-purple-600">
          <View className="flex-row items-center justify-center">
            <Ionicons name="share" size={18} color="white" />
            <Text className="text-white font-medium ml-2">Share</Text>
          </View>
        </Pressable>
        <Pressable onPress={emailSelected} className="flex-1 rounded-xl p-3 bg-blue-600">
          <View className="flex-row items-center justify-center">
            <Ionicons name="mail" size={18} color="white" />
            <Text className="text-white font-medium ml-2">Email</Text>
          </View>
        </Pressable>
      </View>

      <View className="mt-3">
        <Text className="text-gray-700 mb-1">Send to</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="name@example.com" className="border border-gray-300 rounded-lg px-3 py-2 bg-white" keyboardType="email-address" autoCapitalize="none" />
      </View>

      {status && (
        <View className="mt-3 p-2 rounded-lg bg-gray-100">
          <Text className="text-gray-700 text-xs">{status}</Text>
        </View>
      )}

      <View className="mt-3">
        <Pressable onPress={() => { // @ts-ignore
          navigation.navigate("ExportOptions", { selectedIds }); }} className="w-full rounded-xl p-3 bg-gray-800">
          <View className="flex-row items-center justify-center">
            <Ionicons name="options" size={18} color="white" />
            <Text className="text-white font-medium ml-2">More options</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
