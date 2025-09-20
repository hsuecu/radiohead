import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import NewsItemActions from "./NewsItemActions";
import { timeAgo } from "../api/news";

export type NewsRowProps = { title: string; link: string; imageUri?: string | null; subtitle?: string; description?: string; domain?: string | null; pubDate?: string; rank?: number; chevron?: boolean; showActions?: boolean };

export default function NewsRow({ title, link, imageUri, subtitle, description, domain, pubDate, rank, chevron, showActions }: NewsRowProps) {
  const [expanded, setExpanded] = useState(false);

  const openLink = async () => {
    try { await require("../state/newsStore").useNewsStore.getState().recordTap(link); } catch {}
    try { require("react-native").Linking.openURL(link); } catch {}
  };

  return (
    <View className="py-2 border-b border-gray-100">
      <View className="flex-row items-center justify-between">
        <Pressable onPress={openLink} accessibilityRole="button" accessibilityLabel={title} className="flex-1">
          <View className="flex-row items-center">
            {rank != null && (
              <View className="w-6 items-center mr-2">
                <Text className="text-gray-400 text-sm">{rank}</Text>
              </View>
            )}
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: "#F3F4F6" }} />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: "#F3F4F6" }} />
            )}
            <View className="flex-1 ml-3">
              <Text className="text-gray-800 font-semibold" numberOfLines={1}>{title}</Text>
              {!!subtitle && <Text className="text-gray-500 text-xs" numberOfLines={1}>{subtitle}</Text>}
              {showActions && !expanded && (
                <View className="mt-1">
                  <NewsItemActions newsItem={{ title, link, image: imageUri, domain, pubDate, description }} compact />
                </View>
              )}
            </View>
          </View>
        </Pressable>
        {chevron && (
          <Pressable onPress={() => setExpanded((e) => !e)} accessibilityRole="button" accessibilityLabel={expanded ? "Collapse" : "Expand"} hitSlop={10} className="ml-2">
            <Ionicons name={expanded ? "chevron-down" : "chevron-forward"} size={16} color="#9CA3AF" />
          </Pressable>
        )}
      </View>

      {expanded && (
        <View className="mt-3 ml-14 pr-2">
          {!!description && <Text className="text-gray-700 text-sm leading-5">{description}</Text>}
          <View className="flex-row items-center mt-2">
            {!!domain && (<View className="px-2 py-0.5 rounded-full bg-gray-100 mr-2"><Text className="text-gray-600 text-xs">{domain}</Text></View>)}
            {!!pubDate && <Text className="text-gray-400 text-xs">{timeAgo(pubDate)}</Text>}
          </View>
          <NewsItemActions newsItem={{ title, link, image: imageUri, domain, pubDate, description }} />
        </View>
      )}
    </View>
  );
}
