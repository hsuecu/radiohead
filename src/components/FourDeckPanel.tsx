import React, { useMemo, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import { useGlobalLibrary } from "../state/globalLibraryStore";
import { useMixStore, DeckNumber } from "../state/mixStore";

export type FourDeckPanelProps = {
  mode: "vt" | "clip";
  isRecording: boolean;
  getAtMs: () => number; // ms since record start
};

export default function FourDeckPanel({ mode, isRecording, getAtMs }: FourDeckPanelProps) {
  const assets = useGlobalLibrary((s) => s.assets);
  const assignments = useMixStore((s) => s.assignments);
  const gains = useMixStore((s) => s.gains);
  const assignDeck = useMixStore((s) => s.assignDeck);
  const setDeckGain = useMixStore((s) => s.setDeckGain);
  const addTrigger = useMixStore((s) => s.addTrigger);

  const soundRefs = useRef<Record<DeckNumber, Audio.Sound | null>>({ 1: null, 2: null, 3: null, 4: null });
  const [playing, setPlaying] = useState<Partial<Record<DeckNumber, boolean>>>({});

  const onLoadFromLibrary = (n: DeckNumber) => {
    const item = assets[0];
    if (!item) return;
    assignDeck(n, { id: item.id, label: item.name, uri: item.uri });
  };
  const onLoadFromFiles = async (n: DeckNumber) => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: "audio/*" });
    if (res.canceled || !res.assets?.[0]) return;
    const f = res.assets[0];
    assignDeck(n, { id: f.name || String(Date.now()), label: f.name || "Audio", uri: f.uri });
  };

  const onFire = async (n: DeckNumber) => {
    const a = assignments[n];
    if (!a) return;
    try {
      // Stop existing
      const existing = soundRefs.current[n];
      if (existing) { try { await existing.stopAsync(); await existing.unloadAsync(); } catch {} soundRefs.current[n] = null; setPlaying((p) => ({ ...p, [n]: false })); }
      const { sound, status } = await Audio.Sound.createAsync({ uri: a.uri });
      soundRefs.current[n] = sound;
      setPlaying((p) => ({ ...p, [n]: true }));
      let startAt = getAtMs();
      let durationMs = (status as any)?.durationMillis || 0;
      sound.setOnPlaybackStatusUpdate((st: any) => {
        if (st?.didJustFinish) {
          setPlaying((p) => ({ ...p, [n]: false }));
        }
      });
      await sound.playAsync();
      if (isRecording) {
        const gainSnap = gains[n] || 1;
        addTrigger(mode, { id: `${Date.now()}-${n}`, deck: n, uri: a.uri, atMs: startAt, durationMs: durationMs || 0, gain: gainSnap });
      }
    } catch {}
  };

  const onStop = async (n: DeckNumber) => {
    const s = soundRefs.current[n];
    if (!s) return;
    try { await s.stopAsync(); await s.unloadAsync(); } catch {}
    soundRefs.current[n] = null;
    setPlaying((p) => ({ ...p, [n]: false }));
  };

  const deckTile = (n: DeckNumber) => {
    const a = assignments[n];
    const g = gains[n] || 1;
    return (
      <View key={n} className="flex-1 mx-1 mb-3 p-3 rounded-xl border border-gray-200 bg-white">
        <View className="flex-row items-center justify-between">
          <Text className="text-gray-800 font-medium">Deck {n}</Text>
          <Text className="text-gray-500 text-xs">{(g*100).toFixed(0)}%</Text>
        </View>
        <Text className="text-gray-500 text-xs mt-1" numberOfLines={1}>{a ? a.label : "Unassigned"}</Text>
        <View className="flex-row mt-2">
          <Pressable onPress={() => onLoadFromLibrary(n)} className="px-2 py-1 rounded-lg bg-gray-200 mr-2"><Text className="text-gray-700 text-xs">Load Lib</Text></Pressable>
          <Pressable onPress={() => onLoadFromFiles(n)} className="px-2 py-1 rounded-lg bg-gray-200"><Text className="text-gray-700 text-xs">Load File</Text></Pressable>
        </View>
        <View className="flex-row items-center mt-3">
          <Pressable onPress={() => onFire(n)} disabled={!a} className={`px-3 py-2 rounded-lg ${a ? 'bg-blue-600' : 'bg-blue-300'}`}>
            <Text className="text-white text-sm">{playing[n] ? "Replay" : "Fire"}</Text>
          </Pressable>
          <Pressable onPress={() => onStop(n)} className="ml-2 px-3 py-2 rounded-lg bg-gray-200"><Text className="text-gray-700 text-sm">Stop</Text></Pressable>
        </View>
        <View className="mt-3">
          <Slider style={{ width: "100%", height: 32 }} minimumValue={0.5} maximumValue={2.0} step={0.01} value={g} onValueChange={(v)=> setDeckGain(n, v)} minimumTrackTintColor="#3B82F6" maximumTrackTintColor="#E5E7EB" thumbTintColor="#3B82F6" />
        </View>
      </View>
    );
  };

  return (
    <View>
      <Text className="text-base font-semibold text-gray-800 mb-2">Players</Text>
      <View className="flex-row -mx-1">
        {deckTile(1)}
        {deckTile(2)}
      </View>
      <View className="flex-row -mx-1">
        {deckTile(3)}
        {deckTile(4)}
      </View>
    </View>
  );
}
