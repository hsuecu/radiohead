import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type Cart = { id: string; label: string; color?: string; uri: string };

type Props = {
  items: Cart[];
  onPlay: (id: string) => void;
  onStop?: (id: string) => void;
  isPlayingId?: string | null;
  onRemove?: (id: string) => void;
};

export default function CartWall({ items, onPlay, onStop, isPlayingId, onRemove }: Props) {
  return (
    <View>
      <Text className="text-base font-semibold text-gray-800 mb-2">Cart Wall</Text>
      <View className="flex-row flex-wrap -mx-1">
        {items.map((c) => (
          <View key={c.id} className="w-1/3 px-1 mb-2">
            <Pressable onPress={() => onPlay(c.id)} className="rounded-xl p-3 items-center justify-center" style={{ backgroundColor: c.color || "#F1F5F9", minHeight: 64 }}>
              <Ionicons name="musical-notes" size={16} color="#111827" />
              <Text numberOfLines={1} className="mt-1 text-gray-800 text-xs font-medium">{c.label}</Text>
              {isPlayingId === c.id && (
                <Text className="text-[10px] text-blue-600 mt-1">Playing…</Text>
              )}
            </Pressable>
            {!!onRemove && (
              <Pressable onPress={() => onRemove(c.id)} className="mt-1 self-center px-2 py-1 rounded-full bg-gray-200">
                <Text className="text-[10px] text-gray-700">Remove</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
