import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking, Platform, RefreshControl, NativeScrollEvent, NativeSyntheticEvent, Modal, TextInput, Keyboard, TouchableWithoutFeedback } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StationPill } from "../components/StationSwitcher";
import { useUserStore } from "../state/userStore";

import { useStationStore } from "../state/stationStore";
import * as Location from "expo-location";
import Card from "../components/Card";
import NewsRow from "../components/NewsRow";

import { timeAgo } from "../api/news";


import { useRadioStore, useRadioPlaybackState } from "../state/radioStore";
import { useRadioAudioManager } from "../utils/radioAudioManager";
import { StreamHealthIndicator } from "../components/StreamHealthIndicator";
import { useRadioUiStore } from "../state/radioUiStore";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

// Import standardized components
import StandardHeader from "../components/StandardHeader";

function domainFrom(link: string): string | undefined {
  try { const u = new URL(link); return u.hostname.replace(/^www\./, ""); } catch { return undefined; }
}

function RadioStreamStatus() {
  const playbackState = useRadioPlaybackState();
  const currentStationId = useRadioStore((s) => s.currentStationId);
  const streamsByStation = useRadioStore((s) => s.streamsByStation);
  const { playStream, stopStream } = useRadioAudioManager();
  
  // Get current station info
  const stations = useStationStore((s) => s.stations);
  const user = useUserStore((s) => s.user);
  const activeStationId = currentStationId || user.currentStationId || stations[0]?.id;
  const streamConfig = activeStationId ? streamsByStation[activeStationId] : null;

  const handleToggleStream = async () => {
    if (playbackState === "playing" || playbackState === "paused") {
      await stopStream();
    } else if (activeStationId && streamConfig) {
      await playStream(activeStationId);
    }
  };

  const getStatusText = () => {
    switch (playbackState) {
      case "playing": return "Live • On Air";
      case "paused": return "Paused";
      case "loading": return "Connecting...";
      case "buffering": return "Buffering...";
      case "error": return "Connection Error";
      default: return streamConfig ? "Ready to Stream" : "No Stream Configured";
    }
  };

  const getStatusColor = () => {
    switch (playbackState) {
      case "playing": return "text-green-600";
      case "loading":
      case "buffering": return "text-yellow-600";
      case "error": return "text-red-600";
      default: return streamConfig ? "text-blue-600" : "text-gray-500";
    }
  };

  if (!streamConfig) {
    return (
      <View className="flex-row items-center justify-between">
        <Text className="text-gray-500 text-sm">No stream configured</Text>
        <Text className="text-xs text-gray-400">Configure in Profile</Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1">
        <Text className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </Text>
        <Text className="text-xs text-gray-400" numberOfLines={1}>
          {streamConfig.name || streamConfig.url}
        </Text>
      </View>
      
      <Pressable
        onPress={handleToggleStream}
        disabled={playbackState === "loading" || playbackState === "buffering"}
        className={`px-3 py-1.5 rounded-full ${
          playbackState === "playing" ? "bg-red-100" : 
          playbackState === "loading" || playbackState === "buffering" ? "bg-gray-100" :
          "bg-green-100"
        }`}
      >
        <Text className={`text-xs font-medium ${
          playbackState === "playing" ? "text-red-700" : 
          playbackState === "loading" || playbackState === "buffering" ? "text-gray-500" :
          "text-green-700"
        }`}>
          {playbackState === "playing" ? "Stop" : 
           playbackState === "loading" ? "..." :
           playbackState === "buffering" ? "..." :
           "Play"}
        </Text>
      </Pressable>
    </View>
  );
}

function QueryNewsList({ query }: { query: string }) {
  const [items, setItems] = useState<{ title: string; link: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    async function load() {
      try {
        setLoading(true); setError(null);
        const q = encodeURIComponent(query);
        const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
        const res = await fetch(url);
        const xml = await res.text();
        const out: { title: string; link: string }[] = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let m: RegExpExecArray | null;
        while ((m = itemRegex.exec(xml))) {
          const block = m[1];
          const t = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/.exec(block);
          const l = /<link>(.*?)<\/link>/.exec(block);
          const title = (t?.[1] || t?.[2] || "").trim();
          const link = (l?.[1] || "").trim();
          if (title && link) out.push({ title, link });
          if (out.length >= 5) break;
        }
        setItems(out);
      } catch { setError("Failed to load"); } finally { setLoading(false); }
    }
    load();
  }, [query]);
  if (loading) return <Text className="text-gray-400">Loading…</Text> as any;
  if (error) return <Text className="text-red-600">{error}</Text> as any;
  if (items.length === 0) return <Text className="text-gray-400">No results</Text> as any;
  return (
    <View className="mt-1">
      {items.map((it, idx) => (
        <NewsRow key={idx} title={it.title} link={it.link} subtitle={domainFrom(it.link)} domain={domainFrom(it.link) || undefined} chevron />
      ))}
    </View>
  );
}

function GenericRssList({ feedUrl }: { feedUrl: string }) {
  const [items, setItems] = useState<{ title: string; link: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    async function load() {
      try {
        setLoading(true); setError(null);
        const res = await fetch(feedUrl);
        const xml = await res.text();
        const out: { title: string; link: string }[] = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let m: RegExpExecArray | null;
        while ((m = itemRegex.exec(xml))) {
          const block = m[1];
          const t = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/.exec(block);
          const l = /<link>(.*?)<\/link>/.exec(block);
          const title = (t?.[1] || t?.[2] || "").trim();
          const link = (l?.[1] || "").trim();
          if (title && link) out.push({ title, link });
          if (out.length >= 5) break;
        }
        setItems(out);
      } catch { setError("Failed to load"); } finally { setLoading(false); }
    }
    load();
  }, [feedUrl]);
  if (loading) return <Text className="text-gray-400">Loading…</Text> as any;
  if (error) return <Text className="text-red-600">{error}</Text> as any;
  if (items.length === 0) return <Text className="text-gray-400">No results</Text> as any;
  return (
    <View className="mt-1">
      {items.map((it, idx) => (
        <NewsRow key={idx} title={it.title} link={it.link} subtitle={domainFrom(it.link)} domain={domainFrom(it.link) || undefined} chevron />
      ))}
    </View>
  );
}

function TrafficList({ city }: { city: string | null }) {
  const [items, setItems] = useState<{ title: string; link: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function fetchTraffic() {
    try {
      setLoading(true); setError(null);
      const q = encodeURIComponent(`${city || "local"} (traffic OR road OR accident) -sports -finance`);
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url);
      const xml = await res.text();
      const out: { title: string; link: string }[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let m: RegExpExecArray | null;
      while ((m = itemRegex.exec(xml))) {
        const block = m[1];
        const t = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/.exec(block);
        const l = /<link>(.*?)<\/link>/.exec(block);
        const title = (t?.[1] || t?.[2] || "").trim();
        const link = (l?.[1] || "").trim();
        if (title && link) out.push({ title, link });
        if (out.length >= 3) break;
      }
      setItems(out);
    } catch { setError("Failed to load traffic"); } finally { setLoading(false); }
  }
  useEffect(() => { fetchTraffic(); }, [city]);
  if (loading) return <Text className="text-gray-400">Loading traffic…</Text> as any;
  if (error) return <Text className="text-red-600">{error}</Text> as any;
  if (items.length === 0) return <Text className="text-gray-400">No nearby traffic headlines</Text> as any;
  return (
    <View className="mt-1">
      {items.map((it, idx) => (
        <NewsRow key={idx} title={it.title} link={it.link} subtitle={domainFrom(it.link)} domain={domainFrom(it.link) || undefined} chevron />
      ))}
    </View>
  );
}

export default function DashboardScreen() {
  const isPlayerOpen = useRadioUiStore((s) => s.isOpen);
  const openPlayer = useRadioUiStore((s) => s.openPlayer);
  const closePlayer = useRadioUiStore((s) => s.closePlayer);
  const playbackState = useRadioPlaybackState();
  
  // Enhanced time display with better mobile formatting
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  
  const timeStr = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short", 
      day: "numeric",
      hour: "2-digit", 
      minute: "2-digit"
    };
    return now.toLocaleString(undefined, options);
  }, [now]);
  


  const [city, setCity] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showChange, setShowChange] = useState(false);
  const [cityInput, setCityInput] = useState("");

  async function getLocation() {
    try {
      setLocError(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocError("Location permission denied"); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude; const lon = pos.coords.longitude;
      setCoords({ lat, lon });
      const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      const place = rev?.[0];
      setCity(place?.city || place?.subregion || place?.region || null);
      setLastUpdated(Date.now());
    } catch { setLocError("Unable to get location"); }
  }
  useEffect(() => { getLocation(); }, []);

  const [weather, setWeather] = useState<any | null>(null);
  const [wLoading, setWLoading] = useState(false);
  const [wError, setWError] = useState<string | null>(null);
  function weatherIcon(code?: number): string {
    if (code == null) return "☁️";
    if ([0].includes(code)) return "☀️";
    if ([1,2,3].includes(code)) return "⛅";
    if ([45,48].includes(code)) return "🌫️";
    if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return "🌧️";
    if ([71,73,75,77,85,86].includes(code)) return "❄️";
    if ([95,96,99].includes(code)) return "⛈️";
    return "☁️";
  }
  async function fetchWeather() {
    try {
      if (!coords) return; setWLoading(true); setWError(null);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true&hourly=precipitation_probability&daily=sunrise,sunset&timezone=auto`;
      const res = await fetch(url);
      const json = await res.json();
      setWeather({ current: json?.current_weather, hourly: json?.hourly, daily: json?.daily });
      setLastUpdated(Date.now());
    } catch { setWError("Failed to load weather"); } finally { setWLoading(false); }
  }
  useEffect(() => { if (coords) fetchWeather(); }, [coords?.lat, coords?.lon]);

  type NewsItem = { title: string; link: string; when?: string };
  const [news, setNews] = useState<NewsItem[]>([]);
  const [nLoading, setNLoading] = useState(false);
  const [nError, setNError] = useState<string | null>(null);
  async function fetchNews() {
    try {
      const q = encodeURIComponent(`${city || "local"} local news`);
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
      setNLoading(true); setNError(null);
      const res = await fetch(url);
      const xml = await res.text();
      const items: NewsItem[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let m: RegExpExecArray | null;
      while ((m = itemRegex.exec(xml))) {
        const block = m[1];
        const t = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/.exec(block);
        const l = /<link>(.*?)<\/link>/.exec(block);
        const d = /<pubDate>(.*?)<\/pubDate>/.exec(block);
        const title = (t?.[1] || t?.[2] || "").trim();
        const link = (l?.[1] || "").trim();
        if (title && link) items.push({ title, link, when: d?.[1] });
        if (items.length >= 5) break;
      }
      setNews(items); setLastUpdated(Date.now());
    } catch { setNError("Failed to load news"); } finally { setNLoading(false); }
  }
  useEffect(() => { if (city) fetchNews(); }, [city]);

  const [nat, setNat] = useState<NewsItem[]>([]);
  const [natLoading, setNatLoading] = useState(false);
  const [natError, setNatError] = useState<string | null>(null);
  async function fetchNational() {
    try {
      setNatLoading(true); setNatError(null);
      const url = `https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url);
      const xml = await res.text();
      const items: NewsItem[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let m: RegExpExecArray | null;
      while ((m = itemRegex.exec(xml))) {
        const block = m[1];
        const t = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/.exec(block);
        const l = /<link>(.*?)<\/link>/.exec(block);
        const title = (t?.[1] || t?.[2] || "").trim();
        const link = (l?.[1] || "").trim();
        if (title && link) items.push({ title, link });
        if (items.length >= 5) break;
      }
      setNat(items); setLastUpdated(Date.now());
    } catch { setNatError("Failed to load national news"); } finally { setNatLoading(false); }
  }
  useEffect(() => { fetchNational(); }, []);




  const updatedAgo = useMemo(() => lastUpdated ? timeAgo(new Date(lastUpdated).toISOString()) : "", [lastUpdated]);

  // Sticky chips + anchors
  const SECTIONS = ["Station","Location","Weather","Local","Traffic","National"] as const;
  type SectionKey = typeof SECTIONS[number];
  const scrollRef = useRef<ScrollView | null>(null);
  const [headerH, setHeaderH] = useState(0);
  const [chipsH, setChipsH] = useState(0);
  const [offsets, setOffsets] = useState<Record<SectionKey, number>>({ Station:0, Location:0, Weather:0, Local:0, Traffic:0, National:0 });
  const [active, setActive] = useState<SectionKey>("Station");
  function onSectionLayout(key: SectionKey, y: number) { setOffsets((o) => ({ ...o, [key]: y })); }
  function scrollToSection(key: SectionKey) { const y = (offsets[key] || 0) - headerH - chipsH; if (y >= 0) scrollRef.current?.scrollTo({ y, animated: true }); }
  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y + headerH + chipsH + 40;
    let cur: SectionKey = "Station";
    for (const k of SECTIONS) { if (y >= (offsets[k] || 0)) cur = k; }
    if (cur !== active) setActive(cur);
  }

  async function onRefreshAll() {
    setRefreshing(true);
    await Promise.all([fetchWeather(), fetchNews(), fetchNational()]);
    setRefreshing(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        onScroll={onScroll}
        scrollEventThrottle={16}
        stickyHeaderIndices={[1]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />}
      >
        {/* Standardized Header */}
        <View onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>
          <StandardHeader
            title="Dashboard"
            subtitle={timeStr}
            icon="home"
            iconBackgroundColor="#3B82F6"
            rightAction={{
              label: updatedAgo ? `Updated ${updatedAgo}` : "",
              onPress: onRefreshAll,
              variant: "ghost"
            }}
          />
        </View>

        {/* Sticky chips */}
        <View onLayout={(e) => setChipsH(e.nativeEvent.layout.height)} className="bg-white border-b border-gray-200">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
            <View className="flex-row py-2">
              {SECTIONS.map((k) => (
                <Pressable key={k} onPress={() => scrollToSection(k)} className={`px-3 py-1.5 rounded-full mr-2 ${active === k ? "bg-blue-600" : "bg-gray-100"}`}>
                  <Text className={active === k ? "text-white text-xs font-medium" : "text-gray-700 text-xs font-medium"}>{k}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Content */}
        <View className="px-6 mt-2 space-y-3">
          <View onLayout={(e) => onSectionLayout("Station", e.nativeEvent.layout.y)}>
            <Card title="Station">
              <StationPill />
              
              {/* Radio Stream Status */}
              <View className="mt-3 pt-3 border-t border-gray-100">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-medium text-gray-700">Live Stream</Text>
                  {playbackState === "playing" && (
                    <View className="flex-row items-center">
                      <View className="w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse" />
                      <Text className="text-xs text-red-600 font-medium">LIVE</Text>
                    </View>
                  )}
                </View>
                <RadioStreamStatus />

                {/* Open/Hide Radio Player */}
                <View className="mt-2">
                  <Pressable
                    onPress={async () => {
                      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                      if (isPlayerOpen) closePlayer(); else openPlayer();
                    }}
                    className={`px-3 py-2 rounded-full ${isPlayerOpen ? 'bg-gray-200' : 'bg-blue-600'}`}
                    accessibilityLabel={isPlayerOpen ? "Hide radio player" : "Open radio player"}
                  >
                    <Text className={`${isPlayerOpen ? 'text-gray-800' : 'text-white'} text-xs font-medium`}>
                      {isPlayerOpen ? 'Hide Radio Player' : 'Open Radio Player'}
                    </Text>
                  </Pressable>
                </View>
                
                {/* Stream Health Indicator */}
                {(playbackState !== "stopped" && playbackState !== "paused") && (
                  <View className="mt-3">
                    <StreamHealthIndicator compact={false} showDetails={true} />
                  </View>
                )}
              </View>
            </Card>
          </View>

          <View onLayout={(e) => onSectionLayout("Location", e.nativeEvent.layout.y)}>
            <Card title="Location" right={
              <View className="flex-row">
                <Pressable onPress={() => setShowChange(true)} className="px-2 py-1 rounded-full bg-gray-200 mr-2"><Text className="text-gray-700 text-xs">Change</Text></Pressable>
                <Pressable onPress={getLocation} className="px-2 py-1 rounded-full bg-gray-200"><Text className="text-gray-700 text-xs">Use Current</Text></Pressable>
              </View>
            }>
              <Text className="text-gray-700">{city ? `Using ${city}` : "Location not set"}</Text>
              {locError && (<Text className="text-red-600 text-xs mt-1">{locError}</Text>)}
            </Card>
          </View>

          <View onLayout={(e) => onSectionLayout("Weather", e.nativeEvent.layout.y)}>
            <Card title={`Local Weather${city ? ` • ${city}` : ""}`} right={<Pressable onPress={fetchWeather} className="px-2 py-1 rounded-full bg-gray-200"><Text className="text-gray-700 text-xs">Refresh</Text></Pressable>}>
              {locError && (<Text className="text-gray-500 mb-1">{locError}</Text>)}
              {wLoading ? (
                <Text className="text-gray-400">Loading weather…</Text>
              ) : wError ? (
                <Text className="text-red-600">{wError}</Text>
              ) : weather?.current ? (
                <View className="flex-row items-center mt-1">
                  <Text className="text-4xl mr-4">{weatherIcon(weather.current.weathercode)}</Text>
                  <View>
                    <Text className="text-3xl font-bold text-gray-800">{Math.round(weather.current.temperature)}°</Text>
                    <Text className="text-gray-500">Wind {Math.round(weather.current.windspeed)} km/h</Text>
                    {(() => {
                      const idx = weather?.hourly?.time?.findIndex?.((t: string) => t.startsWith(new Date().toISOString().slice(0,13)));
                      const p = idx >= 0 ? weather?.hourly?.precipitation_probability?.[idx] : undefined;
                      const sunrise = weather?.daily?.sunrise?.[0];
                      const sunset = weather?.daily?.sunset?.[0];
                      return (
                        <Text className="text-gray-400 text-xs mt-0.5">{p!=null ? `Precip ${p}% • ` : ""}Sunrise {sunrise?.slice(11,16)} • Sunset {sunset?.slice(11,16)}</Text>
                      );
                    })()}
                  </View>
                </View>
              ) : (
                <Text className="text-gray-400">Enable location to show local weather</Text>
              )}
            </Card>
          </View>



          {/* Local News */}
          <View onLayout={(e) => onSectionLayout("Local", e.nativeEvent.layout.y)}>
            <Card title={`Local News${city ? ` • ${city}` : ""}`} right={<Pressable onPress={fetchNews} className="px-2 py-1 rounded-full bg-gray-200"><Text className="text-gray-700 text-xs">Refresh</Text></Pressable>}>
              {nLoading ? (
                <Text className="text-gray-400">Loading news…</Text>
              ) : nError ? (
                <Text className="text-red-600">{nError}</Text>
              ) : news.length > 0 ? (
                <View className="mt-1">
                  {news.map((n, i) => (
                    <NewsRow key={i} title={n.title} link={n.link} subtitle={domainFrom(n.link)} domain={domainFrom(n.link) || undefined} pubDate={n.when} chevron />
                  ))}
                </View>
              ) : (
                <Text className="text-gray-400">No local headlines yet</Text>
              )}
            </Card>
          </View>

          {/* Traffic */}
          <View onLayout={(e) => onSectionLayout("Traffic", e.nativeEvent.layout.y)}>
            <Card title={`Traffic Nearby${city ? ` • ${city}` : ""}`} right={<Pressable onPress={async () => { const q = encodeURIComponent(`traffic ${city||''}`.trim()); const url = Platform.select({ ios: `http://maps.apple.com/?q=${q}`, android: `geo:0,0?q=${q}`, default: `https://maps.google.com/?q=${q}` }); Linking.openURL(url||'https://maps.google.com'); }} className="px-2 py-1 rounded-full bg-gray-200"><Text className="text-gray-700 text-xs">Open Maps</Text></Pressable>}>
              <TrafficList city={city} />
            </Card>
          </View>

          {/* National */}
          <View onLayout={(e) => onSectionLayout("National", e.nativeEvent.layout.y)}>
            <Card title="National News" right={<Pressable onPress={fetchNational} className="px-2 py-1 rounded-full bg-gray-200"><Text className="text-gray-700 text-xs">Refresh</Text></Pressable>}>
              {natLoading ? (
                <Text className="text-gray-400">Loading…</Text>
              ) : natError ? (
                <Text className="text-red-600">{natError}</Text>
              ) : nat.length > 0 ? (
                <View className="mt-1">
                  {nat.map((n, i) => (
                    <NewsRow key={i} title={n.title} link={n.link} subtitle={domainFrom(n.link)} domain={domainFrom(n.link) || undefined} pubDate={n.when} chevron />
                  ))}
                </View>
              ) : (
                <Text className="text-gray-400">No headlines</Text>
              )}
            </Card>
          </View>

          {/* Additional Cards */}
          {(() => {
            const st = useStationStore.getState().stations[0];
            const extras = (st?.dashboardSections || []).filter(s => s.enabled && !["local-news","traffic","national-news","weather"].includes(s.id));
            return extras.map((sec, idx) => (
              <View key={sec.id} onLayout={(e) => onSectionLayout(sec.name as any, e.nativeEvent.layout.y)}>
                <Card title={sec.name}>
                  {sec.config?.rssUrl ? (
                    <GenericRssList feedUrl={sec.config.rssUrl} />
                  ) : (
                    <QueryNewsList query={`${city || 'local'} ${sec.name}`} />
                  )}
                </Card>
              </View>
            ));
          })()}
        </View>
       </ScrollView>

      {/* Change Location Modal */}
      <Modal visible={showChange} animationType="fade" transparent onRequestClose={() => setShowChange(false)}>
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setShowChange(false); }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-2xl p-4 w-full">
                <Text className="text-lg font-semibold text-gray-800">Change City</Text>
                <TextInput
                  value={cityInput}
                  onChangeText={setCityInput}
                  placeholder="Enter city"
                  className="mt-3 px-3 py-2 rounded-lg bg-gray-100 text-gray-800"
                />
                <View className="flex-row justify-end mt-3">
                  <Pressable onPress={() => setShowChange(false)} className="px-3 py-2 rounded-full bg-gray-200 mr-2"><Text className="text-gray-700">Cancel</Text></Pressable>
                  <Pressable onPress={() => { setCity(cityInput || null); setShowChange(false); if (cityInput) { setCoords(null as any); fetchNews(); } }} className="px-3 py-2 rounded-full bg-blue-600"><Text className="text-white">Save</Text></Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}
