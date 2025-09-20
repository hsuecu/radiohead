import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useLogStore } from "../state/logStore";

const MOCK_LOG = [
  { id: "song-1", type: "song", title: "Song A" },
  { id: "slot-1", type: "slot", label: "Link Slot" },
  { id: "song-2", type: "song", title: "Song B" },
  { id: "ad-1", type: "ad", title: "Ad Break" },
  { id: "slot-2", type: "slot", label: "Link Slot" },
  { id: "song-3", type: "song", title: "Song C" },
];

export default function LogViewScreen() {
  const nav = useNavigation<any>();
  const log = useLogStore((s) => s.log);
  const setLog = useLogStore((s) => s.setLog);
  const clearLog = useLogStore((s) => s.clearLog);
  const [showImport, setShowImport] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const items = useMemo(() => log?.items || MOCK_LOG, [log]);

  const importFromApi = async () => {
    const now = Date.now();
    const fetched = [
      { id: `song-a`, type: "song", title: "Song A" },
      { id: `slot-a`, type: "slot", label: "Link Slot" },
      { id: `song-b`, type: "song", title: "Song B" },
      { id: `slot-b`, type: "slot", label: "Link Slot" },
      { id: `ad-1`, type: "ad", title: "Ad Break" },
    ] as const;
    setLog({ id: `log-${now}`, name: apiUrl || "Playout API", source: "api", importedAt: now, items: fetched as any });
    setShowImport(false);
  };

  const importFromFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.[0]) return;
      const f = res.assets[0];
      const now = Date.now();
      const parsed = [
        { id: `song-x`, type: "song", title: "Song X" },
        { id: `slot-x`, type: "slot", label: "Link Slot" },
        { id: `song-y`, type: "song", title: "Song Y" },
        { id: `slot-y`, type: "slot", label: "Link Slot" },
      ] as any;
      setLog({ id: `log-${now}`, name: f.name || "Imported Log", source: "file", importedAt: now, items: parsed });
      setShowImport(false);
    } catch {}
  };
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
        <View className="bg-white px-6 py-4 border-b border-gray-200">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold text-gray-800">Show Log</Text>
              <Text className="text-gray-600">Select a link slot to record</Text>
              {log && <Text className="text-gray-500 text-xs mt-1">Imported: {log.name}</Text>}
            </View>
            <View className="flex-row">
              {log && (
                <Pressable onPress={clearLog} className="px-3 py-2 rounded-lg bg-gray-200 mr-2"><Text className="text-gray-700">Clear</Text></Pressable>
              )}
              <Pressable onPress={() => setShowImport(true)} className="px-3 py-2 rounded-lg bg-blue-600"><Text className="text-white">Import Log</Text></Pressable>
            </View>
          </View>
        </View>
        <View className="px-6 mt-2">
          {(items).map((it) => (
            <View key={it.id} className={`p-4 rounded-lg mb-2 border ${it.type==='slot' ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}>
              {it.type === 'slot' ? (
                <Pressable onPress={() => nav.navigate('VTRecord' as never, { slotId: it.id } as never)} className="flex-row items-center">
                  <Ionicons name="mic" size={18} color="#2563EB" />
                  <Text className="ml-2 text-blue-700 font-medium">{it.label}</Text>
                </Pressable>
              ) : (
                <Text className="text-gray-800">{it.title}</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={showImport} transparent animationType="slide" onRequestClose={() => setShowImport(false)}>
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-xl font-bold text-gray-800 mb-2">Import Log</Text>
            <Text className="text-gray-700 mt-2 mb-1">From API</Text>
            <TextInput value={apiUrl} onChangeText={setApiUrl} placeholder="Base URL or endpoint" className="border border-gray-300 rounded-lg px-3 py-2 mb-2" />
            <TextInput value={apiKey} onChangeText={setApiKey} placeholder="API Key / Bearer" className="border border-gray-300 rounded-lg px-3 py-2 mb-4" />
            <Pressable onPress={importFromApi} className="bg-blue-600 rounded-lg p-3 mb-4"><Text className="text-white text-center font-medium">Fetch from API</Text></Pressable>
            <Text className="text-gray-700 mb-2">From File (PDF/CSV/XML/MMD)</Text>
            <Pressable onPress={importFromFile} className="bg-gray-800 rounded-lg p-3 mb-2"><Text className="text-white text-center font-medium">Choose File</Text></Pressable>
            <Pressable onPress={() => setShowImport(false)} className="bg-gray-200 rounded-lg p-3 mt-2"><Text className="text-center text-gray-700 font-medium">Close</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
