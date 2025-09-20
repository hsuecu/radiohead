import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUserStore } from "../state/userStore";
import { useAuthStore } from "../state/authStore";
import { useNavigation } from "@react-navigation/native";
import { useSecretsStore } from "../state/secretsStore";
import { cn } from "../utils/cn";

import { useNewsStore } from "../state/newsStore";
import { useRadioStore, StreamQuality } from "../state/radioStore";
import { useStationStore } from "../state/stationStore";
import { testOpenAI, testAnthropic, testGrok, testElevenLabs, testPerigon, testAll } from "../api/connectivity";

export default function ProfileScreen() {
  const navigation = useNavigation();
  const user = useUserStore((s) => s.user);

  const changePassword = useAuthStore((s) => s.changePassword);
  const logout = useAuthStore((s) => s.logout);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  // API integrations
  const secrets = useSecretsStore();
  const [openaiKey, setOpenaiKey] = useState(secrets.getCached("openai") || "");
  const [anthropicKey, setAnthropicKey] = useState(secrets.getCached("anthropic") || "");
  const [grokKey, setGrokKey] = useState(secrets.getCached("grok") || "");
  const [elevenKey, setElevenKey] = useState(secrets.getCached("elevenlabs") || "");
  const [perigonKey, setPerigonKey] = useState(secrets.getCached("perigon") || "");
  const newsProvider = useNewsStore((s) => s.provider);
  const setNewsProvider = useNewsStore((s) => s.setProvider);
  const fetchNews = useNewsStore((s) => s.fetchAll);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [resultText, setResultText] = useState<Record<string, string>>({});
  const [apiMsg, setApiMsg] = useState<string | null>(null);

  // Radio stream settings
  const stations = useStationStore((s) => s.stations);
  const currentStationId = stations[0]?.id || "station-a"; // Default to first station
  const radioStore = useRadioStore();
  const currentStreamConfig = radioStore.streamsByStation[currentStationId];
  const [streamUrl, setStreamUrl] = useState(currentStreamConfig?.url || "");
  const [streamName, setStreamName] = useState(currentStreamConfig?.name || "");
  const [streamQuality, setStreamQuality] = useState<StreamQuality>(currentStreamConfig?.quality || "high");
  const [backgroundPlay, setBackgroundPlay] = useState(radioStore.backgroundPlayEnabled);
  const [autoReconnect, setAutoReconnect] = useState(radioStore.autoReconnect);
  const [testingStream, setTestingStream] = useState(false);
  const [streamTestResult, setStreamTestResult] = useState<string | null>(null);

  const saveProfile = () => {
    useUserStore.setState({ user: { ...user, name, email } });
    setStatus("Profile saved");
  };

  const onChangePw = async () => {
    const ok = await changePassword(current, next);
    setStatus(ok ? "Password changed" : null);
  };

  const saveStreamSettings = () => {
    radioStore.setStreamConfig(currentStationId, {
      url: streamUrl,
      name: streamName || undefined,
      quality: streamQuality
    });
    radioStore.setBackgroundPlayEnabled(backgroundPlay);
    radioStore.setAutoReconnect(autoReconnect);
    setStatus("Radio stream settings saved");
  };

  const testStreamConnection = async () => {
    if (!streamUrl.trim()) {
      setStreamTestResult("Please enter a stream URL");
      return;
    }

    setTestingStream(true);
    setStreamTestResult(null);

    try {
      // Simple URL validation
      const url = new URL(streamUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Only HTTP and HTTPS URLs are supported");
      }

      // Test connection with a simple fetch
      const response = await fetch(streamUrl, { 
        method: "HEAD"
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("audio") || contentType?.includes("application/ogg")) {
          setStreamTestResult("✓ Stream URL is valid and accessible");
        } else {
          setStreamTestResult("⚠ URL accessible but may not be an audio stream");
        }
      } else {
        setStreamTestResult(`✗ Stream not accessible (${response.status})`);
      }
    } catch (error: any) {
      setStreamTestResult(`✗ Connection failed: ${error.message}`);
    } finally {
      setTestingStream(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 py-4 border-b border-gray-200"><Text className="text-2xl font-bold text-gray-800">Profile</Text></View>
      <ScrollView className="px-6 py-4" keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 48 }}>
        {status && <View className="bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-3"><Text className="text-green-700 text-sm">{status}</Text></View>}
        <Text className="text-gray-700 mb-2">Name</Text>
        <TextInput value={name} onChangeText={setName} className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-3" />
        <Text className="text-gray-700 mb-2">Email</Text>
        <TextInput value={email} onChangeText={setEmail} className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-6" autoCapitalize="none" />
        <Pressable onPress={saveProfile} className="bg-blue-500 rounded-lg p-3 mb-3"><Text className="text-center text-white font-medium">Save</Text></Pressable>
         <Pressable onPress={() => // @ts-ignore
           navigation.navigate('DashboardConfig') } className="bg-blue-600 rounded-lg p-3 mb-3"><Text className="text-center text-white font-medium">Cards</Text></Pressable>
         <Pressable onPress={() => // @ts-ignore
           navigation.navigate('PlayoutSettings') } className="bg-indigo-500 rounded-lg p-3 mb-3"><Text className="text-center text-white font-medium">Playout settings</Text></Pressable>
         <Pressable onPress={() => // @ts-ignore
           navigation.navigate('StorageSettings') } className="bg-blue-600 rounded-lg p-3 mb-3"><Text className="text-center text-white font-medium">Cloud storage</Text></Pressable>
         <Pressable onPress={() => // @ts-ignore
           navigation.navigate('VTLog') } className="bg-pink-600 rounded-lg p-3 mb-8"><Text className="text-center text-white font-medium">Voice Tracking</Text></Pressable>
        <View className="bg-white rounded-xl p-4 mb-6">
          <Text className="text-lg font-semibold text-gray-800 mb-2">API Integrations</Text>
          {apiMsg && (
            <View className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 mb-3"><Text className="text-blue-700 text-sm">{apiMsg}</Text></View>
          )}
          <Pressable onPress={async () => {
            setApiMsg("Testing providers...");
            setTesting({ openai: true, anthropic: true, grok: true, elevenlabs: true, perigon: true });
            const r = await testAll();
            setTesting({ openai: false, anthropic: false, grok: false, elevenlabs: false, perigon: false });
            setResultText({
              openai: `${r.openai.ok ? "Connected" : "Failed"} • ${r.openai.message} • ${r.openai.latencyMs}ms`,
              anthropic: `${r.anthropic.ok ? "Connected" : "Failed"} • ${r.anthropic.message} • ${r.anthropic.latencyMs}ms`,
              grok: `${r.grok.ok ? "Connected" : "Failed"} • ${r.grok.message} • ${r.grok.latencyMs}ms`,
              elevenlabs: `${r.elevenlabs.ok ? "Connected" : "Failed"} • ${r.elevenlabs.message} • ${r.elevenlabs.latencyMs}ms`,
              perigon: `${r.perigon.ok ? "Connected" : "Failed"} • ${r.perigon.message} • ${r.perigon.latencyMs}ms`,
            });
            setApiMsg("Connectivity test complete");
          }} className="bg-blue-500 rounded-lg p-2 mb-4"><Text className="text-center text-white">Test All</Text></Pressable>
          <Text className="text-gray-700 mb-1">OpenAI API key</Text>
          <TextInput value={openaiKey} onChangeText={setOpenaiKey} placeholder="sk-..." autoCapitalize="none" secureTextEntry className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-2" />
          <Pressable onPress={async () => { await secrets.setKey("openai", openaiKey); setApiMsg("OpenAI key saved"); }} className="bg-gray-800 rounded-lg p-2 mb-2"><Text className="text-center text-white">Save OpenAI</Text></Pressable>
          <View className="flex-row items-center gap-3 mb-3">
            <Pressable onPress={async () => { setTesting(p => ({ ...p, openai: true })); const r = await testOpenAI(); setTesting(p => ({ ...p, openai: false })); setResultText(p => ({ ...p, openai: `${r.ok ? "Connected" : "Failed"} • ${r.message} • ${r.latencyMs}ms` })); setApiMsg(r.ok ? "OpenAI connected" : `OpenAI: ${r.message}`); }} className={`px-3 py-2 rounded-lg ${testing.openai ? "bg-blue-300" : "bg-blue-500"}`}><Text className="text-white">{testing.openai ? "Testing..." : "Test"}</Text></Pressable>
            <Text className="text-xs text-gray-600 flex-1">{resultText.openai || ""}</Text>
          </View>

          <Text className="text-gray-700 mb-1">Anthropic API key</Text>
          <TextInput value={anthropicKey} onChangeText={setAnthropicKey} placeholder="sk-ant-..." autoCapitalize="none" secureTextEntry className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-2" />
          <Pressable onPress={async () => { await secrets.setKey("anthropic", anthropicKey); setApiMsg("Anthropic key saved"); }} className="bg-gray-800 rounded-lg p-2 mb-2"><Text className="text-center text-white">Save Anthropic</Text></Pressable>
          <View className="flex-row items-center gap-3 mb-3">
            <Pressable onPress={async () => { setTesting(p => ({ ...p, anthropic: true })); const r = await testAnthropic(); setTesting(p => ({ ...p, anthropic: false })); setResultText(p => ({ ...p, anthropic: `${r.ok ? "Connected" : "Failed"} • ${r.message} • ${r.latencyMs}ms` })); setApiMsg(r.ok ? "Anthropic connected" : `Anthropic: ${r.message}`); }} className={`px-3 py-2 rounded-lg ${testing.anthropic ? "bg-blue-300" : "bg-blue-500"}`}><Text className="text-white">{testing.anthropic ? "Testing..." : "Test"}</Text></Pressable>
            <Text className="text-xs text-gray-600 flex-1">{resultText.anthropic || ""}</Text>
          </View>

          <Text className="text-gray-700 mb-1">Grok API key</Text>
          <TextInput value={grokKey} onChangeText={setGrokKey} placeholder="xai-..." autoCapitalize="none" secureTextEntry className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-2" />
          <Pressable onPress={async () => { await secrets.setKey("grok", grokKey); setApiMsg("Grok key saved"); }} className="bg-gray-800 rounded-lg p-2 mb-2"><Text className="text-center text-white">Save Grok</Text></Pressable>
          <View className="flex-row items-center gap-3 mb-3">
            <Pressable onPress={async () => { setTesting(p => ({ ...p, grok: true })); const r = await testGrok(); setTesting(p => ({ ...p, grok: false })); setResultText(p => ({ ...p, grok: `${r.ok ? "Connected" : "Failed"} • ${r.message} • ${r.latencyMs}ms` })); setApiMsg(r.ok ? "Grok connected" : `Grok: ${r.message}`); }} className={`px-3 py-2 rounded-lg ${testing.grok ? "bg-blue-300" : "bg-blue-500"}`}><Text className="text-white">{testing.grok ? "Testing..." : "Test"}</Text></Pressable>
            <Text className="text-xs text-gray-600 flex-1">{resultText.grok || ""}</Text>
          </View>

          <Text className="text-gray-700 mb-1">ElevenLabs API key</Text>
          <TextInput value={elevenKey} onChangeText={setElevenKey} placeholder="eleven-..." autoCapitalize="none" secureTextEntry className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-2" />
          <View className="flex-row gap-3 mb-3">
            <Pressable onPress={async () => { await secrets.setKey("elevenlabs", elevenKey); setApiMsg("ElevenLabs key saved"); }} className="flex-1 bg-gray-800 rounded-lg p-2"><Text className="text-center text-white">Save ElevenLabs</Text></Pressable>
            <Pressable onPress={async () => { setTesting(p => ({ ...p, elevenlabs: true })); const r = await testElevenLabs(); setTesting(p => ({ ...p, elevenlabs: false })); setResultText(p => ({ ...p, elevenlabs: `${r.ok ? "Connected" : "Failed"} • ${r.message} • ${r.latencyMs}ms` })); setApiMsg(r.ok ? "ElevenLabs connected" : `ElevenLabs: ${r.message}`); }} className={`flex-1 rounded-lg p-2 ${testing.elevenlabs ? "bg-blue-300" : "bg-blue-500"}`}><Text className="text-center text-white">{testing.elevenlabs ? "Testing..." : "Test"}</Text></Pressable>
          </View>

          <Text className="text-gray-700 mb-1">Perigon API key</Text>
          <TextInput value={perigonKey} onChangeText={setPerigonKey} placeholder="perigon-..." autoCapitalize="none" secureTextEntry className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-2" />
          <Pressable onPress={async () => { await secrets.setKey("perigon", perigonKey); setApiMsg("Perigon key saved"); }} className="bg-gray-800 rounded-lg p-2 mb-2"><Text className="text-center text-white">Save Perigon</Text></Pressable>
          <View className="flex-row items-center gap-3 mb-4">
            <Pressable onPress={async () => { setTesting(p => ({ ...p, perigon: true })); const r = await testPerigon(); setTesting(p => ({ ...p, perigon: false })); setResultText(p => ({ ...p, perigon: `${r.ok ? "Connected" : "Failed"} • ${r.message} • ${r.latencyMs}ms` })); setApiMsg(r.ok ? "Perigon connected" : `Perigon: ${r.message}`); }} className={`px-3 py-2 rounded-lg ${testing.perigon ? "bg-blue-300" : "bg-blue-500"}`}><Text className="text-white">{testing.perigon ? "Testing..." : "Test"}</Text></Pressable>
            <Text className="text-xs text-gray-600 flex-1">{resultText.perigon || ""}</Text>
          </View>

          <Text className="text-gray-800 font-semibold mb-2">News provider</Text>
          <View className="flex-row gap-2">
            <Pressable onPress={async () => { await setNewsProvider("rss"); await fetchNews(true); setApiMsg("News provider set to RSS"); }} className={`px-3 py-2 rounded-full border ${newsProvider === "rss" ? "bg-blue-50 border-blue-400" : "bg-white border-gray-300"}`}>
              <Text className={newsProvider === "rss" ? "text-blue-700" : "text-gray-700"}>RSS (default)</Text>
            </Pressable>
            <Pressable onPress={async () => { await setNewsProvider("perigon"); await fetchNews(true); setApiMsg("News provider set to Perigon"); }} className={`px-3 py-2 rounded-full border ${newsProvider === "perigon" ? "bg-blue-50 border-blue-400" : "bg-white border-gray-300"}`}>
              <Text className={newsProvider === "perigon" ? "text-blue-700" : "text-gray-700"}>Perigon</Text>
            </Pressable>
          </View>
        </View>

        {/* Radio Stream Settings */}
        <View className="bg-white rounded-xl p-4 mb-6">
          <Text className="text-lg font-semibold text-gray-800 mb-2">Radio Stream Settings</Text>
          <Text className="text-sm text-gray-600 mb-4">
            Configure live radio stream for {stations.find(s => s.id === currentStationId)?.name || "current station"}
          </Text>
          
          {streamTestResult && (
            <View className={cn(
              "border rounded-md px-3 py-2 mb-3",
              streamTestResult.startsWith("✓") ? "bg-green-50 border-green-200" :
              streamTestResult.startsWith("⚠") ? "bg-yellow-50 border-yellow-200" :
              "bg-red-50 border-red-200"
            )}>
              <Text className={cn(
                "text-sm",
                streamTestResult.startsWith("✓") ? "text-green-700" :
                streamTestResult.startsWith("⚠") ? "text-yellow-700" :
                "text-red-700"
              )}>{streamTestResult}</Text>
            </View>
          )}

          <Text className="text-gray-700 mb-1">Stream URL</Text>
          <TextInput 
            value={streamUrl} 
            onChangeText={setStreamUrl}
            placeholder="https://example.com/stream.mp3"
            autoCapitalize="none"
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-2" 
          />
          
          <Text className="text-gray-700 mb-1">Stream Name (Optional)</Text>
          <TextInput 
            value={streamName} 
            onChangeText={setStreamName}
            placeholder="My Radio Station"
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-3" 
          />

          <Text className="text-gray-700 mb-2">Stream Quality</Text>
          <View className="flex-row gap-2 mb-3">
            {(["high", "medium", "low"] as StreamQuality[]).map((quality) => (
              <Pressable
                key={quality}
                onPress={() => setStreamQuality(quality)}
                className={cn(
                  "px-3 py-2 rounded-full border",
                  streamQuality === quality 
                    ? "bg-blue-50 border-blue-400" 
                    : "bg-white border-gray-300"
                )}
              >
                <Text className={cn(
                  "capitalize",
                  streamQuality === quality ? "text-blue-700" : "text-gray-700"
                )}>
                  {quality}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-700">Background Playback</Text>
            <Pressable
              onPress={() => setBackgroundPlay(!backgroundPlay)}
              className={cn(
                "w-12 h-6 rounded-full p-1",
                backgroundPlay ? "bg-blue-500" : "bg-gray-300"
              )}
            >
              <View className={cn(
                "w-4 h-4 rounded-full bg-white transition-transform",
                backgroundPlay && "translate-x-6"
              )} />
            </Pressable>
          </View>

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-gray-700">Auto Reconnect</Text>
            <Pressable
              onPress={() => setAutoReconnect(!autoReconnect)}
              className={cn(
                "w-12 h-6 rounded-full p-1",
                autoReconnect ? "bg-blue-500" : "bg-gray-300"
              )}
            >
              <View className={cn(
                "w-4 h-4 rounded-full bg-white transition-transform",
                autoReconnect && "translate-x-6"
              )} />
            </Pressable>
          </View>

          <View className="flex-row gap-3">
            <Pressable 
              onPress={testStreamConnection}
              disabled={testingStream}
              className={cn(
                "flex-1 rounded-lg p-2",
                testingStream ? "bg-gray-300" : "bg-blue-500"
              )}
            >
              <Text className="text-center text-white">
                {testingStream ? "Testing..." : "Test Stream"}
              </Text>
            </Pressable>
            
            <Pressable 
              onPress={saveStreamSettings}
              className="flex-1 bg-green-600 rounded-lg p-2"
            >
              <Text className="text-center text-white">Save Settings</Text>
            </Pressable>
          </View>
        </View>

        <Text className="text-gray-800 font-semibold mb-2">Change password</Text>
        <TextInput value={current} onChangeText={setCurrent} placeholder="Current password" secureTextEntry className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-3" />
        <TextInput value={next} onChangeText={setNext} placeholder="New password" secureTextEntry className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-6" />
        <Pressable onPress={onChangePw} className="bg-gray-800 rounded-lg p-3 mb-8"><Text className="text-center text-white font-medium">Update Password</Text></Pressable>
        <Pressable onPress={logout} className="bg-red-500 rounded-lg p-3"><Text className="text-center text-white font-medium">Sign out</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
