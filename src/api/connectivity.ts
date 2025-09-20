import { getOpenAIClient } from "./openai";
import { getAnthropicClient } from "./anthropic";
import { getGrokClient } from "./grok";
import { listVoices } from "./elevenlabs";
import { fetchPerigonTop } from "./perigon";

export type ConnectivityResult = { ok: boolean; message: string; latencyMs: number };

function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Timed out")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export async function testOpenAI(): Promise<ConnectivityResult> {
  const start = Date.now();
  try {
    const client = getOpenAIClient();
    // @ts-ignore models.list exists in openai v4 client
    const res: any = await withTimeout((client as any).models.list());
    const count = (((res as any)?.data?.length) ?? 0) as number;
    return { ok: count > 0, message: count > 0 ? `Models: ${count}` : "No models returned", latencyMs: Date.now() - start };
  } catch (e: any) {
    const msg = (e?.status === 401 || /unauthorized/i.test(String(e?.message))) ? "Invalid or missing key" : String(e?.message || "Failed");
    return { ok: false, message: msg, latencyMs: Date.now() - start };
  }
}

export async function testAnthropic(): Promise<ConnectivityResult> {
  const start = Date.now();
  try {
    const client = getAnthropicClient();
    // @ts-ignore models.list exists in anthropic sdk
    const res = await withTimeout((client as any).models.list());
    const count = (((res as any)?.data?.length) ?? 0) as number;
    return { ok: count > 0, message: count > 0 ? `Models: ${count}` : "No models returned", latencyMs: Date.now() - start };
  } catch (e: any) {
    const msg = (e?.status === 401 || /unauthorized/i.test(String(e?.message))) ? "Invalid or missing key" : String(e?.message || "Failed");
    return { ok: false, message: msg, latencyMs: Date.now() - start };
  }
}

export async function testGrok(): Promise<ConnectivityResult> {
  const start = Date.now();
  try {
    const client = getGrokClient();
    // @ts-ignore models.list exists in openai-compatible API
    const res: any = await withTimeout((client as any).models.list());
    const count = (((res as any)?.data?.length) ?? 0) as number;
    return { ok: count > 0, message: count > 0 ? `Models: ${count}` : "No models returned", latencyMs: Date.now() - start };
  } catch (e: any) {
    const msg = (e?.status === 401 || /unauthorized/i.test(String(e?.message))) ? "Invalid or missing key" : String(e?.message || "Failed");
    return { ok: false, message: msg, latencyMs: Date.now() - start };
  }
}

export async function testElevenLabs(): Promise<ConnectivityResult> {
  const start = Date.now();
  try {
    const voices = await withTimeout(listVoices());
    const n = voices.length;
    return { ok: n > 0, message: n > 0 ? `Voices: ${n}` : "No voices returned", latencyMs: Date.now() - start };
  } catch (e: any) {
    const msg = (e?.status === 401 || /unauthorized/i.test(String(e?.message))) ? "Invalid or missing key" : String(e?.message || "Failed");
    return { ok: false, message: msg, latencyMs: Date.now() - start };
  }
}

export async function testPerigon(): Promise<ConnectivityResult> {
  const start = Date.now();
  try {
    const items = await withTimeout(fetchPerigonTop({ country: "US", pageSize: 1 }));
    const n = items.length;
    return { ok: n > 0, message: n > 0 ? "OK" : "No items returned", latencyMs: Date.now() - start };
  } catch (e: any) {
    const msg = (e?.status === 401 || /unauthorized/i.test(String(e?.message))) ? "Invalid or missing key" : String(e?.message || "Failed");
    return { ok: false, message: msg, latencyMs: Date.now() - start };
  }
}

export async function testAll(): Promise<Record<string, ConnectivityResult>> {
  const out: Record<string, ConnectivityResult> = {};
  out.openai = await testOpenAI();
  out.anthropic = await testAnthropic();
  out.grok = await testGrok();
  out.elevenlabs = await testElevenLabs();
  out.perigon = await testPerigon();
  return out;
}
