import React, { useEffect, useMemo, useState } from "react";
import { Modal, View, Text, Pressable, TextInput, Keyboard, TouchableWithoutFeedback, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useScriptStore } from "../state/scriptStore";
import { timeAgo } from "../api/news";

export type ChooseResult = { mode: "existing" | "new"; scriptId?: string; name?: string; position?: "top" | "bottom" };

interface ChooseScriptModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (res: ChooseResult) => void;
}

export default function ChooseScriptModal({ visible, onClose, onConfirm }: ChooseScriptModalProps) {
  const scriptsIndex = useScriptStore((s) => s.scriptsIndex);
  const currentId = useScriptStore((s) => s.currentScript);
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [position, setPosition] = useState<"top" | "bottom">("bottom");

  useEffect(() => {
    if (visible) {
      try { useScriptStore.getState().migrateLegacy(); } catch {}
      setTab("existing");
      setSelectedId(null);
      const stamp = new Date();
      const suggested = `Script ${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}-${String(stamp.getDate()).padStart(2, "0")} ${String(stamp.getHours()).padStart(2, "0")}:${String(stamp.getMinutes()).padStart(2, "0")}`;
      setName(suggested);
    }
  }, [visible]);

  const scripts = useMemo(() => {
    const idx = [...(scriptsIndex || [])];
    idx.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return idx;
  }, [scriptsIndex]);

  const canConfirm = useMemo(() => tab === "existing" ? !!selectedId : name.trim().length > 0, [tab, selectedId, name]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-white">
          <View className="px-4 py-3 border-b border-gray-200">
            <Text className="text-lg font-semibold text-gray-900">Add to Script</Text>
          </View>

          {/* Tabs */}
          <View className="px-4 pt-3">
            <View className="flex-row bg-gray-100 rounded-xl p-1">
              <Pressable onPress={() => setTab("existing")} className={`flex-1 px-3 py-2 rounded-lg ${tab === "existing" ? "bg-white" : ""}`}><Text className={`text-center font-medium ${tab === "existing" ? "text-gray-900" : "text-gray-600"}`}>Existing</Text></Pressable>
              <Pressable onPress={() => setTab("new")} className={`flex-1 px-3 py-2 rounded-lg ${tab === "new" ? "bg-white" : ""}`}><Text className={`text-center font-medium ${tab === "new" ? "text-gray-900" : "text-gray-600"}`}>New</Text></Pressable>
            </View>
          </View>

          {tab === "existing" ? (
            <ScrollView className="flex-1 px-4 py-3">
              {scripts.length === 0 ? (
                <Text className="text-gray-500">No scripts yet</Text>
              ) : (
                scripts.map((s) => (
                  <Pressable key={s.id} onPress={() => setSelectedId(s.id)} className="flex-row items-center justify-between px-3 py-3 border-b border-gray-100">
                    <View className="flex-1 pr-3">
                      <View className="flex-row items-center">
                        <Text numberOfLines={1} className="text-gray-900 font-medium flex-1">{s.name}</Text>
                        {s.id === currentId && (
                          <View className="ml-2 px-2 py-0.5 rounded-full bg-blue-100"><Text className="text-blue-700 text-xs">Current</Text></View>
                        )}
                      </View>
                      <View className="flex-row items-center mt-1">
                        <View className="px-2 py-0.5 rounded-full bg-gray-100 mr-2"><Text className="text-gray-600 text-xs">{s.count} items</Text></View>
                        <Text className="text-gray-400 text-xs">Updated {timeAgo(s.updatedAt)}</Text>
                      </View>
                    </View>
                    <Ionicons name={selectedId === s.id ? "radio-button-on" : "radio-button-off"} size={20} color={selectedId === s.id ? "#2563EB" : "#9CA3AF"} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          ) : (
            <View className="px-4 py-3">
              <Text className="text-gray-700 mb-2 font-medium">Script name</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Morning Show" className="border rounded-lg px-3 py-3 bg-white text-gray-800 border-gray-300" placeholderTextColor="#9CA3AF" />
            </View>
          )}

          {/* Position selector */}
          <View className="px-4 mt-1">
            <Text className="text-gray-700 mb-2 font-medium">Add position</Text>
            <View className="flex-row bg-gray-100 rounded-xl p-1">
              <Pressable onPress={() => setPosition("top")} className={`flex-1 px-3 py-2 rounded-lg ${position === "top" ? "bg-white" : ""}`}><Text className={`text-center font-medium ${position === "top" ? "text-gray-900" : "text-gray-600"}`}>Top</Text></Pressable>
              <Pressable onPress={() => setPosition("bottom")} className={`flex-1 px-3 py-2 rounded-lg ${position === "bottom" ? "bg-white" : ""}`}><Text className={`text-center font-medium ${position === "bottom" ? "text-gray-900" : "text-gray-600"}`}>Bottom</Text></Pressable>
            </View>
          </View>

          <View className="px-4 pb-6 mt-4">
            <View className="flex-row space-x-2">
              <Pressable onPress={onClose} className="flex-1 px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 items-center"><Text className="text-gray-700 font-medium">Cancel</Text></Pressable>
              <Pressable disabled={!canConfirm} onPress={() => { if (tab === "existing" && selectedId) onConfirm({ mode: "existing", scriptId: selectedId, position }); else if (tab === "new") onConfirm({ mode: "new", name: name.trim(), position }); }} className={`flex-1 px-4 py-3 rounded-lg items-center ${canConfirm ? "bg-blue-600" : "bg-blue-300"}`}>
                <Text className="text-white font-semibold">Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
