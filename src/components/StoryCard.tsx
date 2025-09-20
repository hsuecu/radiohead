import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { RssItem, timeAgo } from "../api/news";
import { useNewsStore } from "../state/newsStore";
import NewsItemActions from "./NewsItemActions";
import { Ionicons } from "@expo/vector-icons";

export default function StoryCard({ item }: { item: RssItem }) {
  const [expanded, setExpanded] = useState(false);
  const onOpen = async () => {
    try { await useNewsStore.getState().recordTap(item.link); } catch {}
    try { require("react-native").Linking.openURL(item.link); } catch {}
  };
  return (
    <View className="rounded-xl overflow-hidden bg-white border border-gray-200">
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={item.title}>
        <View style={{ aspectRatio: 16/9, backgroundColor: "#F3F4F6" }}>
          {item.image && (
            <Image source={{ uri: item.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          )}
        </View>
        <View className="p-3">
          <Text className="text-gray-800 font-semibold" numberOfLines={3}>{item.title}</Text>
          <View className="flex-row items-center mt-1 justify-between">
            <View className="flex-row items-center">
              {!!item.domain && (<View className="px-2 py-0.5 rounded-full bg-gray-100 mr-2"><Text className="text-gray-600 text-xs">{item.domain}</Text></View>)}
              {!!item.pubDate && <Text className="text-gray-400 text-xs">{timeAgo(item.pubDate)}</Text>}
            </View>
            <Pressable onPress={() => setExpanded((e) => !e)} accessibilityRole="button" accessibilityLabel={expanded ? "Collapse" : "Expand"} hitSlop={10}>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color="#9CA3AF" />
            </Pressable>
          </View>
          {item.tags && item.tags.length > 0 && (
            <View className="flex-row mt-1">
              {item.tags.map((t, i) => (
                <View key={i} className="mr-2 px-2 py-0.5 rounded-full bg-red-500/10"><Text className="text-red-600 text-xs">{t}</Text></View>
              ))}
            </View>
          )}
          {!expanded && <NewsItemActions newsItem={item} compact />}
        </View>
      </Pressable>
      {expanded && (
        <View className="px-3 pb-3">
          {/* Description may be unavailable for some feeds */}
          {/* Keep layout simple and consistent */}
          <NewsItemActions newsItem={item} />
        </View>
      )}
    </View>
  );
}
