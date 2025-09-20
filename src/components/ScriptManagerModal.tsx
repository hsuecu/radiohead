import React, { useMemo, useState } from "react";
import { Modal, View, Text, Pressable, TextInput, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useScriptStore } from "../state/scriptStore";
import { timeAgo } from "../api/news";
import CreateScriptModal from "./CreateScriptModal";

interface ScriptManagerModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ScriptManagerModal({ visible, onClose }: ScriptManagerModalProps) {
  const scriptsIndex = useScriptStore((s) => s.scriptsIndex);
  const currentId = useScriptStore((s) => s.currentScript);
  const setCurrentScript = useScriptStore((s) => s.setCurrentScript);
  const renameScript = useScriptStore((s) => s.renameScript);
  const deleteScript = useScriptStore((s) => s.deleteScript);
  const saveCurrentScript = useScriptStore((s) => s.saveCurrentScript);
  const createScript = useScriptStore((s) => s.createScript);
  const items = useScriptStore((s) => s.items);
  const scriptsMap = useScriptStore((s) => s.scriptsMap);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const scripts = useMemo(() => {
    const idx = [...(scriptsIndex || [])];
    idx.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return idx;
  }, [scriptsIndex]);

  const isDirty = useMemo(() => {
    if (!currentId) return false;
    const base = (scriptsMap[currentId] || []);
    if ((items || []).length !== base.length) return true;
    const simplify = (arr: any[]) => arr.map(i => ({ t: i.title, c: i.content, o: i.order }));
    return JSON.stringify(simplify(items)) !== JSON.stringify(simplify(base));
  }, [items, scriptsMap, currentId]);

  const onSave = () => { saveCurrentScript(); setBanner("Saved changes"); setTimeout(() => setBanner(null), 1500); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="px-4 py-3 border-b border-gray-200 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-gray-900">Scripts</Text>
          <View className="flex-row items-center">
            <Pressable onPress={() => setShowCreate(true)} className="px-3 py-1.5 rounded-full bg-blue-600 mr-2"><Text className="text-white text-sm font-semibold">New</Text></Pressable>
            <Pressable onPress={onClose} className="px-3 py-1.5 rounded-full bg-gray-100"><Text className="text-gray-800 text-sm font-semibold">Close</Text></Pressable>
          </View>
        </View>

        <View className="px-4 pt-2">
          <Text className="text-gray-500 text-xs">Manage, rename, and save scripts.</Text>
        </View>

        {banner && (
          <View className="mx-4 mt-3 p-2 rounded-lg bg-green-50 border border-green-200">
            <Text className="text-green-800 text-sm">{banner}</Text>
          </View>
        )}

        <ScrollView className="flex-1 px-4 py-3">
          {scripts.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-gray-500 mb-3">No scripts yet</Text>
              <Pressable onPress={() => setShowCreate(true)} className="px-4 py-2 rounded-full bg-blue-600">
                <Text className="text-white text-sm font-semibold">Create Script</Text>
              </Pressable>
            </View>
          ) : scripts.map((s) => (
            <View key={s.id} className="p-3 border border-gray-200 rounded-lg mb-3">
              {renamingId === s.id ? (
                <View className="flex-row items-center">
                  <TextInput value={renameVal} onChangeText={setRenameVal} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800" placeholder="Script name" placeholderTextColor="#9CA3AF" />
                  <Pressable onPress={() => { if (renameVal.trim()) { renameScript(s.id, renameVal.trim()); setRenamingId(null); setRenameVal(""); } }} className="ml-2 px-3 py-2 rounded-lg bg-blue-600"><Text className="text-white">Save</Text></Pressable>
                  <Pressable onPress={() => { setRenamingId(null); setRenameVal(""); }} className="ml-2 px-3 py-2 rounded-lg bg-gray-100"><Text className="text-gray-800">Cancel</Text></Pressable>
                </View>
              ) : (
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center">
                      <Text className="text-gray-900 font-medium" numberOfLines={1}>{s.name}</Text>
                      {s.id === currentId && (
                        <View className="ml-2 px-2 py-0.5 rounded-full bg-blue-100">
                          <Text className="text-blue-700 text-xs">Current</Text>
                        </View>
                      )}
                      {s.id === currentId && isDirty && (
                        <View className="ml-2 px-2 py-0.5 rounded-full bg-yellow-100">
                          <Text className="text-yellow-700 text-xs">Unsaved changes</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center mt-1">
                      <View className="px-2 py-0.5 rounded-full bg-gray-100 mr-2"><Text className="text-gray-600 text-xs">{s.count} items</Text></View>
                      <Text className="text-gray-400 text-xs">Updated {timeAgo(s.updatedAt)}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center">
                     <Pressable onPress={() => setCurrentScript(s.id)} className="px-3 py-1.5 rounded-full bg-gray-100 mr-2"><Text className="text-gray-800 text-xs font-semibold">Open</Text></Pressable>
                    <Pressable onPress={() => { setRenamingId(s.id); setRenameVal(s.name); }} className="px-3 py-1.5 rounded-full bg-gray-100 mr-2"><Text className="text-gray-800 text-xs font-semibold">Rename</Text></Pressable>
                      {s.id === currentId ? (
                        <Pressable onPress={onSave} disabled={!isDirty} className={`${isDirty ? "bg-green-600" : "bg-gray-200"} px-3 py-1.5 rounded-full mr-2`}>
                          <Text className={`${isDirty ? "text-white" : "text-gray-400"} text-xs font-semibold`}>Save</Text>
                        </Pressable>
                      ) : null}
                    <Pressable onPress={() => { deleteScript(s.id); }} className="px-3 py-1.5 rounded-full bg-red-600"><Text className="text-white text-xs font-semibold">Delete</Text></Pressable>
                  </View>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <CreateScriptModal visible={showCreate} onCancel={() => setShowCreate(false)} onCreate={(name) => { const id = createScript(name); setShowCreate(false); setCurrentScript(id); setBanner("Created script"); setTimeout(()=>setBanner(null), 1200); }} />
      </View>
    </Modal>
  );
}
