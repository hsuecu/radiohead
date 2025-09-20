import React from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { timeAgo, RssItem } from "../api/news";
import { useNewsStore } from "../state/newsStore";

export default function NewsHero({ item }: { item: RssItem }) {
  const onOpen = async () => {
    try { await useNewsStore.getState().recordTap(item.link); } catch {}
    try { require("react-native").Linking.openURL(item.link); } catch {}
  };
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={item.title} className="overflow-hidden rounded-xl bg-gray-100">
      <View style={{ aspectRatio: 16/9, backgroundColor: "#E5E7EB" }}>
        {item.image && (
          <Image source={{ uri: item.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        )}
        <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.6)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" }} />
        <View style={{ position: "absolute", left: 16, right: 16, bottom: 16 }}>
          <Text className="text-white text-xl font-bold" numberOfLines={2}>{item.title}</Text>
          <View className="flex-row items-center mt-1">
            {!!item.domain && (
              <View className="px-2 py-0.5 rounded-full bg-white/20 mr-2"><Text className="text-white text-xs">{item.domain}</Text></View>
            )}
            {!!item.pubDate && <Text className="text-gray-200 text-xs">{timeAgo(item.pubDate)}</Text>}
            {item.tags?.map((t, i) => (
              <View key={i} className="ml-2 px-2 py-0.5 rounded-full bg-red-500/80"><Text className="text-white text-xs">{t}</Text></View>
            ))}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
