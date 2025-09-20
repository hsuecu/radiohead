import React, { useState } from "react";
import { View, Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useScriptStore } from "../state/scriptStore";
import { useSocialMediaStore } from "../state/socialMediaStore";
import CreateScriptModal from "./CreateScriptModal";
import ChooseScriptModal, { ChooseResult } from "./ChooseScriptModal";
import { navigate } from "../navigation/navigationRef";

interface NewsItemActionsProps {
  newsItem: any;
  compact?: boolean;
}

export default function NewsItemActions({ newsItem, compact = false }: NewsItemActionsProps) {
  const { addNewsItemToScript, ensureCurrentScript, setCurrentScript } = useScriptStore();
  const { createPostFromNews } = useSocialMediaStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showChoose, setShowChoose] = useState(false);
  const [addedTo, setAddedTo] = useState<{ label: string; targetId?: string } | null>(null);

  const handleAddToScript = () => {
    const scripts = useScriptStore.getState().scriptsIndex;
    if (!scripts || scripts.length === 0) { setShowCreate(true); return; }
    setShowChoose(true);
  };

  const handleChoice = (res: ChooseResult) => {
    if (res.mode === "existing" && res.scriptId) {
      addNewsItemToScript(newsItem, res.scriptId, { position: res.position });
      const idx = useScriptStore.getState().scriptsIndex;
      const name = idx.find(s => s.id === res.scriptId)?.name || "Selected Script";
      setAddedTo({ label: name, targetId: res.scriptId });
    } else if (res.mode === "new" && res.name) {
      const id = ensureCurrentScript(res.name);
      addNewsItemToScript(newsItem, id, { position: res.position });
      setAddedTo({ label: res.name, targetId: id });
    }
    setShowChoose(false);
  };

  const handleAddToSocial = () => {
    createPostFromNews(newsItem);
  };

  const SuccessBanner = () => (
    !!addedTo ? (
      <View className="mt-2 p-2 rounded-lg bg-green-50 border border-green-200 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="checkmark-circle" size={18} color="#059669" />
          <Text className="ml-2 text-green-800 text-sm">Added to {addedTo.label}</Text>
        </View>
        <Pressable onPress={() => { if (addedTo?.targetId) setCurrentScript(addedTo.targetId); navigate("Autocue"); }} className="px-3 py-1 rounded-full bg-green-600">
          <Text className="text-white text-sm font-semibold">Open Autocue</Text>
        </Pressable>
      </View>
    ) : null
  );

  const Actions = () => (
    <View className={`flex-row items-center ${compact ? "" : "mt-2"} space-x-2`}>
      <Pressable
        onPress={handleAddToScript}
        className={`${compact ? "p-1" : "px-3 py-1"} bg-blue-100 rounded-full flex-row items-center`}
      >
        <Ionicons name="reader-outline" size={compact ? 14 : 16} color="#3B82F6" />
        {!compact && <Text className="text-blue-700 text-sm font-medium ml-1">Add to Script</Text>}
      </Pressable>
      <Pressable
        onPress={handleAddToSocial}
        className={`${compact ? "p-1" : "px-3 py-1"} bg-green-100 rounded-full flex-row items-center`}
      >
        <Ionicons name="share-social-outline" size={compact ? 14 : 16} color="#10B981" />
        {!compact && <Text className="text-green-700 text-sm font-medium ml-1">Add to Social</Text>}
      </Pressable>
    </View>
  );

  return (
    <View>
      <Actions />
      <SuccessBanner />
      <CreateScriptModal
        visible={showCreate}
        onCancel={() => setShowCreate(false)}
        onCreate={(name) => {
          const id = ensureCurrentScript(name);
          addNewsItemToScript(newsItem, id);
          setAddedTo({ label: name, targetId: id });
          setShowCreate(false);
        }}
      />
      <ChooseScriptModal
        visible={showChoose}
        onClose={() => setShowChoose(false)}
        onConfirm={handleChoice}
      />
    </View>
  );
}
