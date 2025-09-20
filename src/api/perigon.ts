import { useSecretsStore } from "../state/secretsStore";
import type { RssItem } from "./news";

export type PerigonParams = {
  q?: string;
  country?: string; // ISO2 e.g. US
  category?: string; // e.g. general, business
  pageSize?: number;
};

export async function fetchPerigonTop(params: PerigonParams = {}): Promise<RssItem[]> {
  // Prefer user-supplied key, fallback to env if present
  const store = useSecretsStore.getState();
  const key = (store.getCached("perigon") || process.env.EXPO_PUBLIC_PERIGON_API_KEY) as string | undefined;
  if (!key) return [];
  const pageSize = params.pageSize ?? 25;
  const country = params.country ?? "US";
  const q = params.q ?? "top";
  try {
    // Basic query; Perigon format may differ. We handle failures gracefully.
    const url = `https://api.goperigon.com/v1/all?apiKey=${encodeURIComponent(key)}&country=${encodeURIComponent(country)}&q=${encodeURIComponent(q)}&size=${pageSize}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const articles: any[] = Array.isArray(json?.articles) ? json.articles : Array.isArray(json?.data) ? json.data : [];
    return articles.slice(0, pageSize).map((a: any) => ({
      title: (a.title || a.headline || "").toString(),
      link: (a.url || a.link || "").toString(),
      pubDate: a.published_at || a.pubDate || a.date,
      source: a.source || a.publisher || undefined,
      image: a.image_url || a.image || null,
      domain: (() => { try { const u = new URL(a.url || a.link || ""); return u.hostname.replace(/^www\./, ""); } catch { return null; } })(),
      tags: Array.isArray(a.topics) ? a.topics : [],
    })) as RssItem[];
  } catch {
    return [];
  }
}
