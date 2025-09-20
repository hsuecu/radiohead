import React from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { RssItem, timeAgo } from "../api/news";
import { useNewsStore } from "../state/newsStore";

export default function HorizontalCarousel({ items }: { items: RssItem[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 2 }}>
      <View className="flex-row">
        {items.map((it, idx) => (
          <Pressable key={idx} accessibilityRole="button" accessibilityLabel={it.title} onPress={async () => { try { await useNewsStore.getState().recordTap(it.link); } catch {} try { require("react-native").Linking.openURL(it.link); } catch {} }} className="mr-3" style={{ width: 220 }}>
            <View className="rounded-xl overflow-hidden bg-gray-100">
              <View style={{ aspectRatio: 16/9, backgroundColor: "#E5E7EB" }}>
                {it.image && <Image source={{ uri: it.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
                <View style={{ position: "absolute", right: 8, top: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <View className="flex-row items-center">
                    <Ionicons name="play" size={12} color="white" />
                    <Text className="text-white text-xs ml-1">Video</Text>
                  </View>
                </View>
              </View>
              <View className="p-2">
                <Text className="text-gray-800 font-medium" numberOfLines={2}>{it.title}</Text>
                <View className="flex-row items-center mt-1">
                  {!!it.domain && (<View className="px-2 py-0.5 rounded-full bg-gray-100 mr-2"><Text className="text-gray-600 text-xs">{it.domain}</Text></View>)}
                  {!!it.pubDate && <Text className="text-gray-400 text-xs">{timeAgo(it.pubDate)}</Text>}
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
