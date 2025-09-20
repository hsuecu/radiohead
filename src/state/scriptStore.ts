import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface ScriptItem {
  id: string;
  title: string;
  content: string;
  source?: string; // "news", "manual", "rss"
  sourceUrl?: string;
  duration?: number; // estimated read time in seconds
  createdAt: string;
  updatedAt: string;
  order: number;
}

export type ScriptStatus = "draft" | "ready" | "broadcasted" | "archived";

export interface ScriptMeta { 
  id: string; 
  name: string; 
  createdAt: string; 
  updatedAt: string; 
  count: number;
  status: ScriptStatus;
  description?: string;
  lastBroadcastAt?: string;
  broadcastCount: number;
}

export interface ScriptState {
  // Active script working set
  items: ScriptItem[];
  currentScript: string | null; // current script being used
  isPlaying: boolean;
  currentPosition: number; // current scroll position
  playbackSpeed: number; // words per minute
  fontSize: number;
  
  // Multi-script registry
  scriptsIndex: ScriptMeta[];
  scriptsMap: Record<string, ScriptItem[]>;
  // Session (non-persisted)
  activeScriptSessionId: string | null;
  setActiveScriptSession: (id: string | null) => void;
  
  // Actions
  addItem: (item: Omit<ScriptItem, "id" | "createdAt" | "updatedAt" | "order">) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<ScriptItem>) => void;
  reorderItems: (items: ScriptItem[]) => void;
  clearScript: () => void;
  
  // Playback controls
  startPlayback: () => void;
  pausePlayback: () => void;
  setPosition: (position: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setFontSize: (size: number) => void;
  
  // Script management
  createNewScript: (name: string) => void; // legacy, keeps compatibility
  createScript: (name?: string) => string; // returns script id
  ensureCurrentScript: (nameHint?: string) => string; // returns current or created id
  hasCurrentScript: () => boolean;
  loadScript: (scriptId: string) => void; // legacy alias of setCurrentScript
  saveCurrentScript: () => void;
  setCurrentScript: (scriptId: string) => void;
  listScripts: () => ScriptMeta[];
  renameScript: (scriptId: string, name: string) => void;
  deleteScript: (scriptId: string) => void;
  closeCurrentScript: () => void;
  getCurrentScriptName: () => string | null;
  updateScriptStatus: (scriptId: string, status: ScriptStatus) => void;
  updateScriptDescription: (scriptId: string, description: string) => void;
  markAsBroadcasted: (scriptId: string) => void;
  migrateLegacy: () => void;
  
  // Import from news
  addNewsItemToScript: (newsItem: any, scriptId?: string, opts?: { position?: "top" | "bottom" | { index: number } }) => void;
  addManualItem: (title: string, content: string, opts?: { position?: "top" | "bottom" | { index: number } }) => void;
  
  // Reorder helpers (active script)
  moveItem: (id: string, direction: "up" | "down") => void;
}

const DEFAULT_PLAYBACK_SPEED = 180; // words per minute
const DEFAULT_FONT_SIZE = 18;

export const useScriptStore = create<ScriptState>()(
  persist(
    (set, get) => ({
      // Active
      items: [],
      currentScript: null,
      isPlaying: false,
      currentPosition: 0,
      playbackSpeed: DEFAULT_PLAYBACK_SPEED,
      fontSize: DEFAULT_FONT_SIZE,

      // Registry
      scriptsIndex: [],
      scriptsMap: {},
      // Session (non-persisted)
      activeScriptSessionId: null,
      setActiveScriptSession: (id) => set({ activeScriptSessionId: id }),

      addItem: (item) => {
        const now = new Date().toISOString();
        const currentItems = get().items;
        const newItem: ScriptItem = {
          ...item,
          id: `script_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          createdAt: now,
          updatedAt: now,
          order: currentItems.length,
        };
        const nextItems = [...currentItems, newItem];
        set({ items: nextItems });
        // update registry meta for current script
        const cs = get().currentScript;
        if (cs) {
          const idx = get().scriptsIndex.slice();
          const i = idx.findIndex(s => s.id === cs);
          const meta = i >= 0 ? { ...idx[i] } : { id: cs, name: cs, createdAt: now, updatedAt: now, count: 0, status: "draft" as ScriptStatus, broadcastCount: 0 };
          meta.count = nextItems.length;
          meta.updatedAt = now;
          if (i >= 0) idx[i] = meta; else idx.unshift(meta);
          const map = { ...get().scriptsMap, [cs]: nextItems };
          set({ scriptsIndex: idx, scriptsMap: map });
        }
      },

      removeItem: (id) => {
        const items = get().items.filter(item => item.id !== id);
        const reorderedItems = items.map((item, index) => ({ ...item, order: index }));
        const cur = get().currentScript;
        const now = new Date().toISOString();
        if (cur) {
          const map = { ...get().scriptsMap, [cur]: reorderedItems };
          const idx = get().scriptsIndex.slice();
          const i = idx.findIndex(s => s.id === cur);
          if (i >= 0) idx[i] = { ...idx[i], count: reorderedItems.length, updatedAt: now };
          set({ items: reorderedItems, scriptsMap: map, scriptsIndex: idx });
        } else {
          set({ items: reorderedItems });
        }
      },

      updateItem: (id, updates) => {
        const items = get().items.map(item => 
          item.id === id 
            ? { ...item, ...updates, updatedAt: new Date().toISOString() }
            : item
        );
        set({ items });
      },

      reorderItems: (newItems) => {
        const reorderedItems = newItems.map((item, index) => ({ ...item, order: index }));
        const cur = get().currentScript;
        const now = new Date().toISOString();
        if (cur) {
          const map = { ...get().scriptsMap, [cur]: reorderedItems };
          const idx = get().scriptsIndex.slice();
          const i = idx.findIndex(s => s.id === cur);
          if (i >= 0) idx[i] = { ...idx[i], count: reorderedItems.length, updatedAt: now };
          set({ items: reorderedItems, scriptsMap: map, scriptsIndex: idx });
        } else {
          set({ items: reorderedItems });
        }
      },

      clearScript: () => {
        const cur = get().currentScript;
        const now = new Date().toISOString();
        if (cur) {
          const map = { ...get().scriptsMap, [cur]: [] };
          const idx = get().scriptsIndex.slice();
          const i = idx.findIndex(s => s.id === cur);
          if (i >= 0) idx[i] = { ...idx[i], count: 0, updatedAt: now };
          set({ items: [], currentPosition: 0, isPlaying: false, scriptsMap: map, scriptsIndex: idx });
        } else {
          set({ items: [], currentPosition: 0, isPlaying: false });
        }
      },

      startPlayback: () => {
        set({ isPlaying: true });
      },

      pausePlayback: () => {
        set({ isPlaying: false });
      },

      setPosition: (position) => {
        set({ currentPosition: position });
      },

      setPlaybackSpeed: (speed) => {
        set({ playbackSpeed: Math.max(60, Math.min(300, speed)) }); // Clamp between 60-300 WPM
      },

      setFontSize: (size) => {
        set({ fontSize: Math.max(12, Math.min(32, size)) }); // Clamp between 12-32px
      },

      moveItem: (id, direction) => {
        const arr = get().items.slice();
        const idx = arr.findIndex(it => it.id === id);
        if (idx < 0) return;
        const to = direction === "up" ? idx - 1 : idx + 1;
        if (to < 0 || to >= arr.length) return;
        const tmp = arr[idx];
        arr[idx] = arr[to];
        arr[to] = tmp;
        const reassigned = arr.map((it, i) => ({ ...it, order: i }));
        const cs = get().currentScript;
        const now = new Date().toISOString();
        if (cs) {
          const m = { ...get().scriptsMap, [cs]: reassigned };
          const si = get().scriptsIndex.slice();
          const i = si.findIndex(s => s.id === cs);
          if (i >= 0) si[i] = { ...si[i], updatedAt: now };
          set({ items: reassigned, scriptsMap: m, scriptsIndex: si });
        } else {
          set({ items: reassigned });
        }
      },

      createNewScript: (name) => {
        const id = get().createScript(name);
        // legacy kept behavior: new script becomes current with empty items
        set({ currentScript: id, items: [], currentPosition: 0, isPlaying: false });
      },

      createScript: (name) => {
        const stamp = new Date();
        const defaultName = `Script ${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}-${String(stamp.getDate()).padStart(2, "0")} ${String(stamp.getHours()).padStart(2, "0")}:${String(stamp.getMinutes()).padStart(2, "0")}`;
        const finalName = name && name.trim().length > 0 ? name.trim() : defaultName;
        const id = `${finalName.replace(/\s+/g, "_")}_${Date.now()}`;
        const now = new Date().toISOString();
        const idx = get().scriptsIndex.slice();
        idx.unshift({ id, name: finalName, createdAt: now, updatedAt: now, count: 0, status: "draft" as ScriptStatus, broadcastCount: 0 });
        const map = { ...get().scriptsMap, [id]: [] };
        set({ scriptsIndex: idx, scriptsMap: map, currentScript: id, items: [], currentPosition: 0, isPlaying: false });
        return id;
      },

      ensureCurrentScript: (nameHint) => {
        const current = get().currentScript;
        if (current) return current;
        return get().createScript(nameHint);
      },

      hasCurrentScript: () => {
        return !!get().currentScript || get().scriptsIndex.length > 0;
      },

      setCurrentScript: (scriptId) => {
        const now = new Date().toISOString();
        const cur = get().currentScript;
        const idx = get().scriptsIndex.slice();
        const map = { ...get().scriptsMap };
        // commit current items into map/meta
        if (cur) {
          map[cur] = get().items.slice();
          const i = idx.findIndex(s => s.id === cur);
          if (i >= 0) {
            idx[i] = { ...idx[i], count: map[cur].length, updatedAt: now };
          }
        }
        // switch
        const nextItems = map[scriptId] ? map[scriptId].slice() : [];
        if (!map[scriptId]) map[scriptId] = [];
        set({ scriptsIndex: idx, scriptsMap: map, currentScript: scriptId, items: nextItems, currentPosition: 0, isPlaying: false });
      },

      listScripts: () => {
        const idx = get().scriptsIndex.slice();
        idx.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return idx;
      },

      renameScript: (scriptId, name) => {
        const idx = get().scriptsIndex.slice();
        const i = idx.findIndex(s => s.id === scriptId);
        if (i >= 0) {
          const now = new Date().toISOString();
          idx[i] = { ...idx[i], name, updatedAt: now };
          set({ scriptsIndex: idx });
        }
      },

      deleteScript: (scriptId) => {
        const cur = get().currentScript;
        const idx = get().scriptsIndex.filter(s => s.id !== scriptId);
        const map = { ...get().scriptsMap }; delete map[scriptId];
        if (cur === scriptId) {
          set({ scriptsIndex: idx, scriptsMap: map, currentScript: null, items: [], isPlaying: false, currentPosition: 0, activeScriptSessionId: null });
        } else {
          set({ scriptsIndex: idx, scriptsMap: map });
        }
      },

      closeCurrentScript: () => {
        set({ currentScript: null, items: [], isPlaying: false, currentPosition: 0, activeScriptSessionId: null });
      },

      getCurrentScriptName: () => {
        const cur = get().currentScript; if (!cur) return null;
        return get().scriptsIndex.find(s => s.id === cur)?.name || null;
      },

      updateScriptStatus: (scriptId, status) => {
        const idx = get().scriptsIndex.slice();
        const i = idx.findIndex(s => s.id === scriptId);
        if (i >= 0) {
          const now = new Date().toISOString();
          idx[i] = { ...idx[i], status, updatedAt: now };
          set({ scriptsIndex: idx });
        }
      },

      updateScriptDescription: (scriptId, description) => {
        const idx = get().scriptsIndex.slice();
        const i = idx.findIndex(s => s.id === scriptId);
        if (i >= 0) {
          const now = new Date().toISOString();
          idx[i] = { ...idx[i], description, updatedAt: now };
          set({ scriptsIndex: idx });
        }
      },

      markAsBroadcasted: (scriptId) => {
        const idx = get().scriptsIndex.slice();
        const i = idx.findIndex(s => s.id === scriptId);
        if (i >= 0) {
          const now = new Date().toISOString();
          idx[i] = { 
            ...idx[i], 
            status: "broadcasted" as ScriptStatus, 
            lastBroadcastAt: now, 
            broadcastCount: idx[i].broadcastCount + 1,
            updatedAt: now 
          };
          set({ scriptsIndex: idx });
        }
      },

      migrateLegacy: () => {
        if ((get().scriptsIndex?.length || 0) === 0 && (get().items?.length || 0) > 0) {
          const now = new Date();
          const name = `Imported Script ${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          const id = `${name.replace(/\s+/g, "_")}_${Date.now()}`;
          const iso = now.toISOString();
          set({ scriptsIndex: [{ id, name, createdAt: iso, updatedAt: iso, count: get().items.length, status: "draft" as ScriptStatus, broadcastCount: 0 }], scriptsMap: { [id]: get().items.slice() }, currentScript: id });
        }
      },

      loadScript: (scriptId) => {
        get().setCurrentScript(scriptId);
      },

      saveCurrentScript: () => {
        const now = new Date().toISOString();
        const cur = get().currentScript; if (!cur) return;
        const idx = get().scriptsIndex.slice();
        const i = idx.findIndex(s => s.id === cur);
        const map = { ...get().scriptsMap, [cur]: get().items.slice() };
        if (i >= 0) idx[i] = { ...idx[i], count: get().items.length, updatedAt: now };
        set({ scriptsIndex: idx, scriptsMap: map });
      },

      addNewsItemToScript: (newsItem, scriptId, opts) => {
        const estimatedDuration = estimateReadingTime(newsItem.title + " " + (newsItem.description || ""));
        const now = new Date().toISOString();
        const makeItem = (): ScriptItem => ({
          title: newsItem.title,
          content: formatNewsItemForScript(newsItem),
          source: "news",
          sourceUrl: newsItem.link,
          duration: estimatedDuration,
          id: `script_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          createdAt: now,
          updatedAt: now,
          order: 0,
        });

        const getIndex = (len: number): number => {
          const pos = opts?.position;
          if (!pos || pos === "bottom") return len;
          if (pos === "top") return 0;
          if (typeof (pos as any).index === "number") {
            const idx = Math.max(0, Math.min(len, (pos as any).index));
            return idx;
          }
          return len;
        };

        const target = scriptId || get().currentScript;
        const insertInto = (list: ScriptItem[]): ScriptItem[] => {
          const item = makeItem();
          const insertAt = getIndex(list.length);
          const copy = list.slice();
          copy.splice(insertAt, 0, item);
          return copy.map((it, i) => ({ ...it, order: i }));
        };

        if (target && target !== get().currentScript) {
          const map = { ...get().scriptsMap };
          const reassigned = insertInto(map[target] || []);
          map[target] = reassigned;
          const idx = get().scriptsIndex.slice();
          const i = idx.findIndex(s => s.id === target);
          if (i >= 0) idx[i] = { ...idx[i], count: reassigned.length, updatedAt: now };
          set({ scriptsMap: map, scriptsIndex: idx });
          return;
        }

        const cs = get().currentScript;
        const reassigned = insertInto(get().items);
        if (cs) {
          const idx = get().scriptsIndex.slice();
          const i = idx.findIndex(s => s.id === cs);
          if (i >= 0) idx[i] = { ...idx[i], count: reassigned.length, updatedAt: now };
          const map = { ...get().scriptsMap, [cs]: reassigned };
          set({ items: reassigned, scriptsIndex: idx, scriptsMap: map });
        } else {
          set({ items: reassigned });
        }
      },

      addManualItem: (title, content, opts) => {
        const now = new Date().toISOString();
        const makeItem = (): ScriptItem => ({
          title,
          content,
          source: "manual",
          duration: estimateReadingTime(title + " " + content),
          id: `script_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          createdAt: now,
          updatedAt: now,
          order: 0,
        });
        const getIndex = (len: number): number => {
          const pos = opts?.position;
          if (!pos || pos === "bottom") return len;
          if (pos === "top") return 0;
          if (typeof (pos as any).index === "number") return Math.max(0, Math.min(len, (pos as any).index));
          return len;
        };
        const cs = get().currentScript;
        const currentItems = get().items;
        const item = makeItem();
        const insertAt = getIndex(currentItems.length);
        const copy = currentItems.slice();
        copy.splice(insertAt, 0, item);
        const reassigned = copy.map((it, i) => ({ ...it, order: i }));
        if (cs) {
          const idx = get().scriptsIndex.slice();
          const i = idx.findIndex(s => s.id === cs);
          if (i >= 0) idx[i] = { ...idx[i], count: reassigned.length, updatedAt: now };
          const map = { ...get().scriptsMap, [cs]: reassigned };
          set({ items: reassigned, scriptsIndex: idx, scriptsMap: map });
        } else {
          set({ items: reassigned });
        }
      },
    }),
    {
      name: "script-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // persist multi-script state
        scriptsIndex: state.scriptsIndex,
        scriptsMap: state.scriptsMap,
        // active view state
        items: state.items,
        currentScript: state.currentScript,
        playbackSpeed: state.playbackSpeed,
        fontSize: state.fontSize,
      }),
    }
  )
);

// Helper functions
function estimateReadingTime(text: string): number {
  const wordsPerMinute = 180; // Average reading speed
  const words = text.split(/\s+/).length;
  return Math.ceil((words / wordsPerMinute) * 60); // Return seconds
}

function formatNewsItemForScript(newsItem: any): string {
  const title = newsItem.title || "";
  const description = newsItem.description || "";
  const source = newsItem.domain || newsItem.source || "";
  
  let formatted = title;
  if (description && description !== title) {
    formatted += "\n\n" + description;
  }
  if (source) {
    formatted += "\n\n— " + source;
  }
  
  return formatted;
}