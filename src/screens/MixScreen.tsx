import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useVTStore } from "../state/vtStore";
import { useMixStore } from "../state/mixStore";
import { useUserStore } from "../state/userStore";
import { startRender, getRenderStatus, RenderPlan } from "../api/render";
import EnhancedLiveWaveform from "../components/EnhancedLiveWaveform";
import { MixerEngine } from "../utils/mixer/Engine";

function gainToDb(g: number) {
  const clamped = Math.max(0.01, Math.min(4.0, g));
  const db = 20 * Math.log10(clamped);
  return Math.max(-12, Math.min(6, db));
}
function msToStamp(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function MixScreen() {
  const nav = useNavigation<any>();
  const session = useVTStore((s) => s.session);
  const setOutput = useVTStore((s) => s.setOutput);
  const { vtTriggers, gains, assignments, setDeckGain } = useMixStore((s) => ({ vtTriggers: s.vtTriggers, gains: s.gains, assignments: s.assignments, setDeckGain: s.setDeckGain }));
  const stationId = useUserStore((s) => s.user.currentStationId) ?? "station-a";

  const [status, setStatus] = useState<{ type: "idle" | "working" | "success" | "error"; message?: string; uri?: string | null }>({ type: "idle" });

  // Preview engine state
  const engineRef = useRef<MixerEngine | null>(null);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [micGain, setMicGain] = useState(1);
  const [mute, setMute] = useState<{ mic: boolean; d1: boolean; d2: boolean; d3: boolean; d4: boolean }>({ mic: false, d1: false, d2: false, d3: false, d4: false });
  const [solo, setSolo] = useState<{ mic: boolean; d1: boolean; d2: boolean; d3: boolean; d4: boolean }>({ mic: false, d1: false, d2: false, d3: false, d4: false });
  const [duck, setDuck] = useState<{ enabled: boolean; amountDb: number; attackMs: number; releaseMs: number }>({ enabled: true, amountDb: 6, attackMs: 50, releaseMs: 200 });

  const canRender = !!session?.outputUri && vtTriggers.length > 0;

  useEffect(() => {
    if (!session?.outputUri) return;
    const eng = new MixerEngine();
    engineRef.current = eng;
    (async () => {
      await eng.load({ micUri: session.outputUri!, micGain, deckGains: { 1: gains[1] ?? 1, 2: gains[2] ?? 1, 3: gains[3] ?? 1, 4: gains[4] ?? 1 }, triggers: vtTriggers, ducking: duck });
      setDurationMs(eng.getDurationMs() || 60000);
      eng.onProgress((ms) => setPositionMs(ms));
      eng.onEnded(() => setPlaying(false));
    })();
    return () => { eng.dispose(); engineRef.current = null; };
  }, [session?.outputUri]);

  // Track summary
  const deckSummary = useMemo(() => {
    const by: Record<number, { count: number; first?: number; last?: number }> = { 1: { count: 0 }, 2: { count: 0 }, 3: { count: 0 }, 4: { count: 0 } };
    vtTriggers.forEach((t) => {
      const d = by[t.deck] || (by as any)[t.deck] || { count: 0 };
      d.count += 1;
      d.first = typeof d.first === "number" ? Math.min(d.first, t.atMs) : t.atMs;
      d.last = typeof d.last === "number" ? Math.max(d.last, t.atMs + t.durationMs) : t.atMs + t.durationMs;
      (by as any)[t.deck] = d;
    });
    return by;
  }, [vtTriggers]);

  const togglePlay = async () => {
    const eng = engineRef.current;
    if (!eng) return;
    if (playing) { await eng.pause(); setPlaying(false); }
    else { await eng.play(); setPlaying(true); }
  };
  const stop = async () => { const eng = engineRef.current; if (!eng) return; await eng.stop(); setPlaying(false); setPositionMs(0); };
  const onSeek = async (ms: number) => { const eng = engineRef.current; if (!eng) return; await eng.seek(ms); setPositionMs(ms); };
  const updateMicGain = (v: number) => { setMicGain(v); engineRef.current?.setTrackGain("mic", v); };
  const updateDeckGain = (n: 1|2|3|4, v: number) => { setDeckGain(n, v); engineRef.current?.setTrackGain(n, v); };
  const toggleMute = (id: "mic" | 1|2|3|4) => {
    if (id === "mic") { const nv = !mute.mic; setMute({ ...mute, mic: nv }); engineRef.current?.setMute("mic", nv); }
    else { const key = `d${id}` as const; const nv = !(mute as any)[key]; setMute({ ...mute, [key]: nv } as any); engineRef.current?.setMute(id, nv); }
  };
  const toggleSolo = (id: "mic" | 1|2|3|4) => {
    if (id === "mic") { const nv = !solo.mic; setSolo({ ...solo, mic: nv }); engineRef.current?.setSolo("mic", nv); }
    else { const key = `d${id}` as const; const nv = !(solo as any)[key]; setSolo({ ...solo, [key]: nv } as any); engineRef.current?.setSolo(id, nv); }
  };
  const applyDuck = (next: typeof duck) => { setDuck(next); engineRef.current?.setDucking(next); };

  const onRender = async () => {
    if (!session?.outputUri || vtTriggers.length === 0) return;
    setStatus({ type: "working", message: "Preparing mix..." });
    const baseUri = session.outputUri;
    const segments: RenderPlan["segments"] = vtTriggers.map((t) => ({
      uri: t.uri,
      startMs: t.atMs,
      endMs: t.atMs + t.durationMs,
      gainDb: gainToDb(gains[t.deck as 1 | 2 | 3 | 4] ?? 1),
    }));
    const plan: RenderPlan = { baseUri, segments, fx: { normalizeGainDb: null, fadeInMs: null, fadeOutMs: null, padHeadMs: null, padTailMs: null }, outExt: "m4a" };
    try {
      const { jobId } = await startRender(plan, stationId);
      setStatus({ type: "working", message: "Mixing..." });
      let uri: string | null | undefined = null;
      for (let i = 0; i < 20; i++) {
        const r = await getRenderStatus(jobId, stationId);
        if (r.uri) { uri = r.uri; break; }
        await new Promise((rslv) => setTimeout(rslv, 500));
      }
      if (!uri) { setStatus({ type: "error", message: "Mix timed out. Please try again." }); return; }
      setOutput(uri);
      setStatus({ type: "success", message: "Mix complete.", uri });
    } catch (e) {
      setStatus({ type: "error", message: "Mix failed. Please retry." });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 py-4 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-800">Mix</Text>
        <Text className="text-gray-600">Preview mic + carts, then render</Text>
      </View>

      <ScrollView className="flex-1 p-6" automaticallyAdjustContentInsets>
        {!session ? (
          <View className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Text className="text-yellow-800">No active VT session. Start a recording first.</Text>
            <Pressable onPress={() => nav.navigate("VTRecord")} className="mt-3 px-3 py-2 rounded-full bg-blue-500 self-start"><Text className="text-white">Go to VT Recorder</Text></Pressable>
          </View>
        ) : !session.outputUri ? (
          <View className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Text className="text-yellow-800">Record your link first on the VT Recorder, then return to mix.</Text>
            <Pressable onPress={() => nav.navigate("VTRecord")} className="mt-3 px-3 py-2 rounded-full bg-blue-500 self-start"><Text className="text-white">Open VT Recorder</Text></Pressable>
          </View>
        ) : (
          <>
            {/* Transport */}
            <View className="bg-white rounded-lg p-4 border border-gray-200 mb-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Pressable onPress={togglePlay} className={`w-12 h-12 rounded-full items-center justify-center ${playing ? 'bg-gray-800' : 'bg-blue-600'} mr-2`}>
                    <Ionicons name={playing ? "pause" : "play"} size={20} color="#fff" />
                  </Pressable>
                  <Pressable onPress={stop} className="w-12 h-12 rounded-full items-center justify-center bg-red-500">
                    <Ionicons name="stop" size={20} color="#fff" />
                  </Pressable>
                </View>
                <Text className="text-gray-700">{msToStamp(positionMs)} / {msToStamp(durationMs || 0)}</Text>
              </View>
              <View className="mt-3">
                <EnhancedLiveWaveform 
                  values={[]} 
                  durationMs={durationMs || 60000} 
                  positionMs={positionMs} 
                  onSeek={onSeek}
                  height={64}
                  color="#3B82F6"
                  showPeaks={true}
                  showPlaybackControls={true}
                  showTimeLabels={true}
                />
              </View>
            </View>

            {/* Tracks */}
            <View className="bg-white rounded-lg p-4 border border-gray-200">
              <Text className="text-lg font-semibold text-gray-800">Tracks</Text>
              {/* Mic row */}
              <View className="mt-3 py-2 border-t border-gray-100">
                <View className="flex-row items-center justify-between">
                  <Text className="text-gray-700">Mic</Text>
                  <View className="flex-row items-center">
                    <Pressable onPress={() => toggleMute("mic")} className={`px-3 py-1 rounded-full mr-2 ${mute.mic ? 'bg-gray-800' : 'bg-gray-300'}`}><Text className="text-white text-xs">{mute.mic ? "Muted" : "Mute"}</Text></Pressable>
                    <Pressable onPress={() => toggleSolo("mic")} className={`px-3 py-1 rounded-full ${solo.mic ? 'bg-blue-600' : 'bg-gray-300'}`}><Text className="text-white text-xs">Solo</Text></Pressable>
                  </View>
                </View>
                <Slider minimumValue={0} maximumValue={2} value={micGain} step={0.01} onValueChange={updateMicGain} minimumTrackTintColor="#3B82F6" maximumTrackTintColor="#E5E7EB" />
              </View>

              {[1,2,3,4].map((d) => (
                <View key={d} className="py-2 border-t border-gray-100">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-gray-700">Deck {d} {assignments[d as 1|2|3|4]?.label ? `• ${assignments[d as 1|2|3|4]?.label}` : ""}</Text>
                      <Text className="text-gray-500 text-xs">Triggers: {deckSummary[d].count}{deckSummary[d].first != null ? `  (${msToStamp(deckSummary[d].first!)}–${msToStamp(deckSummary[d].last!)})` : ""}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <Pressable onPress={() => toggleMute(d as 1|2|3|4)} className={`px-3 py-1 rounded-full mr-2 ${(mute as any)[`d${d}`] ? 'bg-gray-800' : 'bg-gray-300'}`}><Text className="text-white text-xs">Mute</Text></Pressable>
                      <Pressable onPress={() => toggleSolo(d as 1|2|3|4)} className={`px-3 py-1 rounded-full ${(solo as any)[`d${d}`] ? 'bg-blue-600' : 'bg-gray-300'}`}><Text className="text-white text-xs">Solo</Text></Pressable>
                    </View>
                  </View>
                  <Slider minimumValue={0.5} maximumValue={2} value={(gains as any)[d] ?? 1} step={0.01} onValueChange={(v) => updateDeckGain(d as 1|2|3|4, v)} minimumTrackTintColor="#3B82F6" maximumTrackTintColor="#E5E7EB" />
                </View>
              ))}
            </View>

            {/* Ducking */}
            <View className="bg-white rounded-lg p-4 border border-gray-200 mt-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-gray-800">Ducking</Text>
                <Pressable onPress={() => applyDuck({ ...duck, enabled: !duck.enabled })} className={`px-3 py-1 rounded-full ${duck.enabled ? 'bg-green-600' : 'bg-gray-300'}`}><Text className="text-white text-sm">{duck.enabled ? "On" : "Off"}</Text></Pressable>
              </View>
              <Text className="text-gray-600 mt-2 text-sm">Reduce mic when carts play</Text>
              <View className="mt-2">
                <Text className="text-gray-700 text-xs">Amount: {duck.amountDb} dB</Text>
                <Slider minimumValue={0} maximumValue={24} value={duck.amountDb} step={1} onValueChange={(v)=> applyDuck({ ...duck, amountDb: Math.round(v) })} minimumTrackTintColor="#3B82F6" maximumTrackTintColor="#E5E7EB" />
              </View>
            </View>

            {status.type !== "idle" && (
              <View className={`mt-4 p-3 rounded-lg border ${status.type === "error" ? "bg-red-50 border-red-200" : status.type === "success" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
                <Text className={`${status.type === "error" ? "text-red-700" : status.type === "success" ? "text-green-700" : "text-blue-700"}`}>{status.message}</Text>
                {status.type === "success" && (
                  <View className="flex-row mt-3">
                    <Pressable onPress={() => nav.navigate("Main", { screen: "Edit" })} className="flex-1 bg-blue-500 rounded-lg p-3 mr-2"><Text className="text-white text-center font-medium">Open in Edit</Text></Pressable>
                    <Pressable onPress={() => setStatus({ type: "idle" })} className="flex-1 bg-gray-200 rounded-lg p-3 ml-2"><Text className="text-gray-800 text-center font-medium">Stay Here</Text></Pressable>
                  </View>
                )}
              </View>
            )}

            {/* Render */}
            <View className="mt-4">
              <Pressable disabled={!canRender || status.type === "working"} onPress={onRender} className={`rounded-lg p-3 ${canRender && status.type !== "working" ? "bg-green-600" : "bg-green-300"}`}>
                <Text className="text-white text-center font-medium">{status.type === "working" ? "Mixing..." : "Render Mix"}</Text>
              </Pressable>
              <Text className="text-gray-400 text-xs mt-2">Preview reflects your mix. Flattening is simulated in v1.</Text>
              {!canRender && (
                <Text className="text-gray-500 text-xs mt-1">{!session.outputUri ? "Record your link first." : vtTriggers.length === 0 ? "No deck triggers captured." : ""}</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
