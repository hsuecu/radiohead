import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchRss, RssItem } from "../api/news";
import { fetchPerigonTop } from "../api/perigon";

type Section = {
  items: RssItem[];
  loading: boolean;
  error: string | null;
};

type NewsState = {
  provider: "rss" | "perigon";
  hero: RssItem | null;
  topStories: RssItem[];
  videos: Section;
  moreUS: Section;
  analysis: Section;
  mostRead: Section;
  mostReadLocal: RssItem[];
  lastFetched: number | null;
  setProvider: (p: "rss" | "perigon") => Promise<void>;
  fetchAll: (force?: boolean) => Promise<void>;
  recordTap: (link: string) => Promise<void>;
};

const TTL = 10 * 60 * 1000; // 10 minutes

const US_URL = "https://news.google.com/rss/headlines/section/geo/United%20States?hl=en-US&gl=US&ceid=US:en";
const VIDEOS_URL = "https://news.google.com/rss/search?q=US%20video&hl=en-US&gl=US&ceid=US:en";
const ANALYSIS_URL = "https://news.google.com/rss/search?q=US%20Analysis&hl=en-US&gl=US&ceid=US:en";

type Tap = { count: number; last: number };
const KEY = "news_taps_v1";
const PROVIDER_KEY = "news_provider_v1";

function sampleUS(): RssItem[] {
  return [
    { title: "Melania threatens $1bn lawsuit over comments", link: "https://news.sky.com/us", pubDate: new Date().toISOString(), image: null, source: "Sky", domain: "news.sky.com", tags: ["Analysis"] },
    { title: "National Guard arrives on streets of DC", link: "https://news.sky.com/us", pubDate: new Date().toISOString(), image: null, source: "Sky", domain: "news.sky.com", tags: [] },
    { title: "Summit preview: What to expect", link: "https://news.sky.com/us", pubDate: new Date().toISOString(), image: null, source: "Sky", domain: "news.sky.com", tags: ["Explainer"] },
    { title: "Rescue of man from burning building", link: "https://news.sky.com/us", pubDate: new Date().toISOString(), image: null, source: "Sky", domain: "news.sky.com", tags: ["Video"] },
    { title: "Remote base to host pivotal talks", link: "https://news.sky.com/us", pubDate: new Date().toISOString(), image: null, source: "Sky", domain: "news.sky.com", tags: [] },
    { title: "US accuses UK of limiting free speech", link: "https://news.sky.com/us", pubDate: new Date().toISOString(), image: null, source: "Sky", domain: "news.sky.com", tags: [] },
    { title: "Zombie rabbits? Here is what is up", link: "https://news.sky.com/us", pubDate: new Date().toISOString(), image: null, source: "Sky", domain: "news.sky.com", tags: ["Explainer"] },
    { title: "Ceasefire prospects uncertain ahead of talks", link: "https://news.sky.com/us", pubDate: new Date().toISOString(), image: null, source: "Sky", domain: "news.sky.com", tags: ["Analysis"] },
    { title: "Top stories across the US today", link: "https://news.sky.com/us", pubDate: new Date().toISOString(), image: null, source: "Sky", domain: "news.sky.com", tags: [] },
    { title: "Most read: live updates all day", link: "https://news.sky.com/us", pubDate: new Date().toISOString(), image: null, source: "Sky", domain: "news.sky.com", tags: [] },
  ];
}

export const useNewsStore = create<NewsState>((set, get) => {
  let taps: Record<string, Tap> = {};
  let hydrated = false;

  async function hydrate() {
    if (hydrated) return; hydrated = true;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      taps = raw ? JSON.parse(raw) : {};
      prune();
      try {
        const pv = await AsyncStorage.getItem(PROVIDER_KEY);
        if (pv === "perigon" || pv === "rss") set({ provider: pv as any });
      } catch {}
    } catch {}
  }
  async function persist() {
    try { await AsyncStorage.setItem(KEY, JSON.stringify(taps)); } catch {}
  }
  function prune() {
    const now = Date.now();
    const seven = 7 * 24 * 3600 * 1000;
    for (const k of Object.keys(taps)) {
      if (now - taps[k].last > seven) delete taps[k];
    }
  }
  function mostReadLocalFrom(items: RssItem[]): RssItem[] {
    const byLink = new Map(items.map(i => [i.link, i] as const));
    const sorted = Object.entries(taps)
      .sort((a,b) => b[1].count - a[1].count)
      .map(([link]) => byLink.get(link))
      .filter(Boolean) as RssItem[];
    return sorted.slice(0, 10);
  }

  return {
    provider: "rss",
    hero: null,
    topStories: [],
    videos: { items: [], loading: false, error: null },
    moreUS: { items: [], loading: false, error: null },
    analysis: { items: [], loading: false, error: null },
    mostRead: { items: [], loading: false, error: null },
    mostReadLocal: [],
    lastFetched: null,
    setProvider: async (p: "rss" | "perigon") => { await AsyncStorage.setItem(PROVIDER_KEY, p); set({ provider: p }); },
    fetchAll: async (force?: boolean) => {
      await hydrate();
      const now = Date.now();
      const last = get().lastFetched;
      if (!force && last && now - last < TTL && get().hero) {
        return; // still fresh
      }
      try {
        set({ lastFetched: now });
        const provider = get().provider;
        if (provider === "perigon") {
          const us = await fetchPerigonTop({ country: "US", pageSize: 30 });
          const hero = us[0] || null;
          const topStories = us.slice(1, 7);
          set({ hero, topStories });
          set((s) => ({ moreUS: { ...s.moreUS, loading: true, error: null } }));
          set((s) => ({ mostRead: { ...s.mostRead, loading: true, error: null } }));
          const more = us.slice(7, 20);
          set({ moreUS: { items: more, loading: false, error: null } });
          set({ mostRead: { items: us.slice(1, 11), loading: false, error: null } });
          const pool = [hero, ...topStories, ...more].filter(Boolean) as RssItem[];
          set({ mostReadLocal: mostReadLocalFrom(pool) });
        } else {
          // RSS provider (default)
          const us = await fetchRss(US_URL);
          const hero = us[0] || null;
          const topStories = us.slice(1, 7);
          set({ hero, topStories });
          set((s) => ({ moreUS: { ...s.moreUS, loading: true, error: null } }));
          set((s) => ({ mostRead: { ...s.mostRead, loading: true, error: null } }));
          const more = us.slice(7, 20);
          set({ moreUS: { items: more, loading: false, error: null } });
          set({ mostRead: { items: us.slice(1, 11), loading: false, error: null } });
          const pool = [hero, ...topStories, ...more].filter(Boolean) as RssItem[];
          set({ mostReadLocal: mostReadLocalFrom(pool) });
        }

      } catch (e) {
        const sample = sampleUS();
        const hero = sample[0] || null;
        const topStories = sample.slice(1, 7);
        const more = sample.slice(7, 20);
        set({ hero, topStories });
        set({ moreUS: { items: more, loading: false, error: "Failed to load US feed • Showing sample" } });
        set({ mostRead: { items: sample.slice(1, 11), loading: false, error: "Failed to load US feed • Showing sample" } });
      }
      // Videos
      try {
        set((s) => ({ videos: { ...s.videos, loading: true, error: null } }));
        const vids = await fetchRss(VIDEOS_URL);
        set({ videos: { items: vids.slice(0, 10), loading: false, error: null } });
      } catch (e) {
        set((s) => ({ videos: { ...s.videos, loading: false, error: "Failed to load videos" } }));
      }
      // Analysis
      try {
        set((s) => ({ analysis: { ...s.analysis, loading: true, error: null } }));
        const ana = await fetchRss(ANALYSIS_URL);
        set({ analysis: { items: ana.slice(0, 10), loading: false, error: null } });
      } catch (e) {
        set((s) => ({ analysis: { ...s.analysis, loading: false, error: "Failed to load analysis" } }));
      }
    },
    recordTap: async (link: string) => {
      await hydrate();
      const now = Date.now();
      const cur = taps[link] || { count: 0, last: now };
      taps[link] = { count: cur.count + 1, last: now };
      prune();
      await persist();
      // recompute local most read using current pool
      const s = get();
      const pool = [s.hero, ...s.topStories, ...s.moreUS.items].filter(Boolean) as RssItem[];
      set({ mostReadLocal: mostReadLocalFrom(pool) });
    }
  };
});
