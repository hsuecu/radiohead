import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, RefreshControl, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "react-native";
import { useNewsStore } from "../state/newsStore";
import { timeAgo } from "../api/news";
import NewsHero from "../components/NewsHero";
import StoryCard from "../components/StoryCard";
import HorizontalCarousel from "../components/HorizontalCarousel";
import NewsRow from "../components/NewsRow";

const SECTIONS = ["Top", "Videos", "More", "Analysis", "MostRead"] as const;
type SectionKey = typeof SECTIONS[number];

export default function NewsScreen() {
  const fetchAll = useNewsStore((s) => s.fetchAll);
  const hero = useNewsStore((s) => s.hero);
  const topStories = useNewsStore((s) => s.topStories);
  const videos = useNewsStore((s) => s.videos);
  const moreUS = useNewsStore((s) => s.moreUS);
  const analysis = useNewsStore((s) => s.analysis);
  const mostRead = useNewsStore((s) => s.mostRead);
  const mostReadLocal = useNewsStore((s) => s.mostReadLocal);
  const lastFetched = useNewsStore((s) => s.lastFetched);

  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { fetchAll(); }, []);
  async function onRefresh() { setRefreshing(true); await fetchAll(true); setRefreshing(false); }

  const grid = useMemo(() => {
    const pairs: [any, any?][] = [];
    for (let i = 0; i < topStories.length; i += 2) pairs.push([topStories[i], topStories[i + 1]]);
    return pairs;
  }, [topStories]);

  // Sticky chips + anchors
  const scrollRef = useRef<ScrollView | null>(null);
  const [headerH, setHeaderH] = useState(0);
  const [chipsH, setChipsH] = useState(0);
  const [offsets, setOffsets] = useState<Record<SectionKey, number>>({ Top: 0, Videos: 0, More: 0, Analysis: 0, MostRead: 0 });
  const [active, setActive] = useState<SectionKey>("Top");
  function onSectionLayout(key: SectionKey, y: number) { setOffsets((o) => ({ ...o, [key]: y })); }
  function scrollToSection(key: SectionKey) {
    const y = offsets[key] - headerH - chipsH;
    if (y >= 0) scrollRef.current?.scrollTo({ y, animated: true });
  }
  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y + headerH + chipsH + 40;
    // determine active
    let cur: SectionKey = "Top";
    for (const k of SECTIONS) { if (y >= (offsets[k] || 0)) cur = k; }
    if (cur !== active) setActive(cur);
  }

  const updatedAgo = useMemo(() => lastFetched ? timeAgo(new Date(lastFetched).toISOString()) : "", [lastFetched]);

  // Helpers for subtitles
  const subtitle = (it: any) => [it?.domain, it?.pubDate ? timeAgo(it.pubDate) : ""].filter(Boolean).join(" • ");

  const most = (mostReadLocal && mostReadLocal.length > 0) ? mostReadLocal : mostRead.items;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        onScroll={onScroll}
        scrollEventThrottle={16}
        stickyHeaderIndices={[1]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)} className="px-6 py-4 border-b border-gray-200 bg-white">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-gray-900">US News</Text>
            <Pressable onPress={() => fetchAll(true)} className="px-3 py-1.5 rounded-full bg-gray-100"><Text className="text-gray-700 text-xs">Refresh</Text></Pressable>
          </View>
          <View className="flex-row items-center mt-2">
            <Pressable onPress={() => { try { require("react-native").Linking.openURL("https://news.sky.com/watch-live"); } catch {} }} className="px-3 py-1.5 rounded-full bg-red-500">
              <Text className="text-white text-xs font-semibold">Watch Live</Text>
            </Pressable>
            {!!updatedAgo && <Text className="text-gray-500 text-xs ml-3">Updated {updatedAgo}</Text>}
          </View>
        </View>

        {/* Sticky chips */}
        <View onLayout={(e) => setChipsH(e.nativeEvent.layout.height)} className="bg-white border-b border-gray-200">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
            <View className="flex-row py-2">
              {SECTIONS.map((k) => (
                <Pressable key={k} onPress={() => scrollToSection(k)} className={`px-3 py-1.5 rounded-full mr-2 ${active === k ? "bg-blue-600" : "bg-gray-100"}`}>
                  <Text className={active === k ? "text-white text-xs font-medium" : "text-gray-700 text-xs font-medium"}>{k === "MostRead" ? "Most Read" : k}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Content sections */}
        <View className="px-6 py-4 space-y-6">
          {/* Hero */}
          <View onLayout={(e) => onSectionLayout("Top", e.nativeEvent.layout.y)}>
            {hero ? (
              <NewsHero item={hero} />
            ) : (
              <View className="overflow-hidden rounded-xl bg-gray-200" style={{ aspectRatio: 16/9 }} />
            )}
          </View>

          {/* Top Stories grid */}
          <View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xl font-bold text-gray-900">Top Stories</Text>
            </View>
            {topStories.length > 0 ? (
              <View className="flex-row flex-wrap -mx-1">
                {grid.map((row, idx) => (
                  <View key={idx} className="w-full flex-row">
                    <View className="w-1/2 px-1 pb-2">
                      {row[0] ? <StoryCard item={row[0]} /> : <View className="rounded-xl bg-gray-200" style={{ aspectRatio: 16/9 }} />}
                    </View>
                    <View className="w-1/2 px-1 pb-2">
                      {row[1] ? <StoryCard item={row[1]} /> : <View className="rounded-xl bg-gray-200" style={{ aspectRatio: 16/9 }} />}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="flex-row -mx-1">
                <View className="w-1/2 px-1"><View className="rounded-xl bg-gray-200" style={{ aspectRatio: 16/9 }} /></View>
                <View className="w-1/2 px-1"><View className="rounded-xl bg-gray-200" style={{ aspectRatio: 16/9 }} /></View>
              </View>
            )}
          </View>

          {/* Videos */}
          <View onLayout={(e) => onSectionLayout("Videos", e.nativeEvent.layout.y)}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xl font-bold text-gray-900">Videos</Text>
              <Pressable onPress={() => fetchAll(true)} className="px-2 py-1 rounded-full bg-gray-100"><Text className="text-gray-700 text-xs">Refresh</Text></Pressable>
            </View>
            {videos.loading ? (
              <Text className="text-gray-400">Loading…</Text>
            ) : videos.error ? (
              <Pressable onPress={() => fetchAll(true)}><Text className="text-red-600">{videos.error} Tap to retry</Text></Pressable>
            ) : videos.items.length > 0 ? (
              <HorizontalCarousel items={videos.items} />
            ) : (
              <Text className="text-gray-400">No videos</Text>
            )}
          </View>

          {/* More US */}
          <View onLayout={(e) => onSectionLayout("More", e.nativeEvent.layout.y)}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xl font-bold text-gray-900">More US</Text>
              <Pressable onPress={() => fetchAll(true)} className="px-2 py-1 rounded-full bg-gray-100"><Text className="text-gray-700 text-xs">Refresh</Text></Pressable>
            </View>
            {moreUS.loading ? (
              <View>
                {[...Array(4)].map((_, i) => (
                  <View key={i} className="py-2 border-b border-gray-100">
                    <View className="flex-row items-center">
                      <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: "#E5E7EB" }} />
                      <View className="ml-3" style={{ flex: 1 }}>
                        <View style={{ height: 12, backgroundColor: "#E5E7EB", borderRadius: 4, width: "80%" }} />
                        <View className="mt-2" style={{ height: 10, backgroundColor: "#F3F4F6", borderRadius: 4, width: "40%" }} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : moreUS.error ? (
              <Pressable onPress={() => fetchAll(true)}><Text className="text-red-600">{moreUS.error} Tap to retry</Text></Pressable>
            ) : moreUS.items.length > 0 ? (
              <View>
                {moreUS.items.map((it, i) => (
                  <NewsRow key={i} title={it.title} link={it.link} imageUri={it.image} subtitle={subtitle(it)} domain={it.domain} pubDate={it.pubDate} />
                ))}
              </View>
            ) : (
              <Text className="text-gray-400">No stories</Text>
            )}
          </View>

          {/* Analysis */}
          <View onLayout={(e) => onSectionLayout("Analysis", e.nativeEvent.layout.y)}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xl font-bold text-gray-900">Analysis</Text>
              <Pressable onPress={() => fetchAll(true)} className="px-2 py-1 rounded-full bg-gray-100"><Text className="text-gray-700 text-xs">Refresh</Text></Pressable>
            </View>
            {analysis.loading ? (
              <Text className="text-gray-400">Loading…</Text>
            ) : analysis.error ? (
              <Pressable onPress={() => fetchAll(true)}><Text className="text-red-600">{analysis.error} Tap to retry</Text></Pressable>
            ) : analysis.items.length > 0 ? (
              <View>
                {analysis.items.map((it, i) => (
                  <NewsRow key={i} title={it.title} link={it.link} imageUri={it.image} subtitle={subtitle(it)} domain={it.domain} pubDate={it.pubDate} />
                ))}
              </View>
            ) : (
              <Text className="text-gray-400">No analysis</Text>
            )}
          </View>

          {/* Most Read */}
          <View className="mb-8" onLayout={(e) => onSectionLayout("MostRead", e.nativeEvent.layout.y)}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xl font-bold text-gray-900">Most Read</Text>
              <Pressable onPress={() => fetchAll(true)} className="px-2 py-1 rounded-full bg-gray-100"><Text className="text-gray-700 text-xs">Refresh</Text></Pressable>
            </View>
            {most.length > 0 ? (
              <View>
                {most.map((it, i) => (
                  <NewsRow key={i} title={it.title} link={it.link} imageUri={it.image} rank={i + 1} chevron subtitle={subtitle(it)} />
                ))}
              </View>
            ) : (
              <Text className="text-gray-400">No items</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
