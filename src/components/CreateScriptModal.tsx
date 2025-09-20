import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, TextInput, Pressable, Keyboard, TouchableWithoutFeedback } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface CreateScriptModalProps {
  visible: boolean;
  onCancel: () => void;
  onCreate: (name: string) => void;
}

export default function CreateScriptModal({ visible, onCancel, onCreate }: CreateScriptModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      const stamp = new Date();
      const suggested = `Script ${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}-${String(stamp.getDate()).padStart(2, "0")} ${String(stamp.getHours()).padStart(2, "0")}:${String(stamp.getMinutes()).padStart(2, "0")}`;
      setName(suggested);
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setName("");
      setError(null);
    }
  }, [visible]);

  const handleCreate = () => {
    if (!name.trim()) {
      setError("Please enter a script name");
      return;
    }
    onCreate(name.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-white">
          <View className="px-4 py-3 border-b border-gray-200 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-gray-900">Create Script</Text>
            <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={10}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </Pressable>
          </View>

          <View className="p-4">
            <Text className="text-gray-700 mb-2 font-medium">Script name</Text>
            <TextInput
              ref={inputRef}
              value={name}
              onChangeText={(t) => { setName(t); if (error) setError(null); }}
              placeholder="Morning Show Script"
              className={`border rounded-lg px-3 py-3 bg-white text-gray-800 ${error ? "border-red-300" : "border-gray-300"}`}
              placeholderTextColor="#9CA3AF"
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            {!!error && <Text className="text-red-600 text-sm mt-2">{error}</Text>}

            <View className="flex-row mt-6 space-x-2">
              <Pressable onPress={onCancel} className="flex-1 px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 items-center">
                <Text className="text-gray-700 font-medium">Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreate} className="flex-1 px-4 py-3 rounded-lg bg-blue-600 items-center">
                <Text className="text-white font-semibold">Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
