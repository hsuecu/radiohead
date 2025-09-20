import * as FileSystem from "expo-file-system";
import { useSecretsStore } from "../state/secretsStore";

export type ElevenVoice = { voice_id: string; name: string; preview_url?: string | null };

function base64FromBytes(bytes: Uint8Array) {
  const lookup = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const c = i + 2 < len ? bytes[i + 2] : 0;
    const triplet = (a << 16) | (b << 8) | c;
    out += lookup[(triplet >> 18) & 63] + lookup[(triplet >> 12) & 63] + (i + 1 < len ? lookup[(triplet >> 6) & 63] : "=") + (i + 2 < len ? lookup[triplet & 63] : "=");
  }
  return out;
}

export async function listVoices(): Promise<ElevenVoice[]> {
  const key = (useSecretsStore.getState().getCached("elevenlabs") || process.env.EXPO_PUBLIC_VIBECODE_ELEVENLABS_API_KEY) as string | undefined;
  if (!key) {
    console.log("🎤 No ElevenLabs API key found");
    return [];
  }
  
  try {
    console.log("🎤 Fetching voices from ElevenLabs API...");
    const res = await fetch("https://api.elevenlabs.io/v2/voices", {
      method: "GET",
      headers: { "xi-api-key": key },
    });
    
    if (!res.ok) {
      console.error("🎤 ElevenLabs API error:", res.status, res.statusText);
      const errorText = await res.text().catch(() => "");
      console.error("🎤 Error response:", errorText);
      return [];
    }
    
    const json = await res.json();
    console.log("🎤 Raw API response:", json);
    
    const arr = Array.isArray(json?.voices) ? json.voices : [];
    console.log("🎤 Found", arr.length, "voices in response");
    
    const mappedVoices = arr.map((v: any) => ({ 
      voice_id: v.voice_id, 
      name: v.name, 
      preview_url: v.preview_url || null 
    }));
    
    console.log("🎤 Mapped voices:", mappedVoices.length);
    return mappedVoices;
  } catch (error) {
    console.error("🎤 Exception fetching voices:", error);
    return [];
  }
}

export async function convertVoice(params: { inputUri: string; voiceId: string; modelId?: string; outputFormat?: string; removeBackgroundNoise?: boolean }): Promise<{ uri: string }> {
  const key = (useSecretsStore.getState().getCached("elevenlabs") || process.env.EXPO_PUBLIC_VIBECODE_ELEVENLABS_API_KEY) as string | undefined;
  if (!key) throw new Error("Missing ElevenLabs API key");
  const { inputUri, voiceId } = params;
  const modelId = params.modelId || "eleven_multilingual_sts_v2";
  const outputFormat = params.outputFormat || "mp3_44100_128";
  const removeBackgroundNoise = !!params.removeBackgroundNoise;

  const form = new FormData();
  form.append("model_id", modelId);
  form.append("output_format", outputFormat);
  form.append("remove_background_noise", String(removeBackgroundNoise));
  form.append("audio", { uri: inputUri, name: "input.m4a", type: "audio/m4a" } as any);

  const res = await fetch(`https://api.elevenlabs.io/v1/speech-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form as any,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Conversion failed");
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const b64 = base64FromBytes(buf);
  const ext = outputFormat.startsWith("mp3") ? "mp3" : outputFormat.startsWith("wav") ? "wav" : "mp3";
  const outDir = FileSystem.cacheDirectory + "elevenlabs/";
  try { await FileSystem.makeDirectoryAsync(outDir, { intermediates: true }); } catch {}
  const outPath = outDir + `voice-${Date.now()}.${ext}`;
  await FileSystem.writeAsStringAsync(outPath, b64, { encoding: FileSystem.EncodingType.Base64 as any });
  return { uri: outPath };
}
