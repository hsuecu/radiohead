import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ScriptMeta, ScriptItem } from "./scriptStore";

export interface SharedScript {
  id: string;
  originalId: string;
  name: string;
  description?: string;
  items: ScriptItem[];
  sharedBy: string; // email of sender
  sharedAt: string;
  message?: string;
  status: "pending" | "accepted" | "declined";
}

export interface SharedScriptData {
  script: {
    name: string;
    description?: string;
    items: ScriptItem[];
    metadata: Omit<ScriptMeta, 'id'>;
  };
  sharedBy: string;
  message?: string;
  sharedAt: string;
}

interface SharedScriptsState {
  sharedScripts: SharedScript[];
  mySharedScripts: string[]; // IDs of scripts I've shared
  
  // Actions
  addSharedScript: (sharedScript: SharedScript) => void;
  acceptSharedScript: (sharedScriptId: string) => void;
  declineSharedScript: (sharedScriptId: string) => void;
  markAsShared: (scriptId: string) => void;
  importSharedScriptData: (data: SharedScriptData) => string; // returns new shared script ID
  exportScriptData: (scriptMeta: ScriptMeta, items: ScriptItem[], message?: string) => SharedScriptData;
}

export const useSharedScriptsStore = create<SharedScriptsState>()(
  persist(
    (set, get) => ({
      sharedScripts: [],
      mySharedScripts: [],

      addSharedScript: (sharedScript) => {
        set((state) => ({
          sharedScripts: [sharedScript, ...state.sharedScripts]
        }));
      },

      acceptSharedScript: (sharedScriptId) => {
        set((state) => ({
          sharedScripts: state.sharedScripts.map(script =>
            script.id === sharedScriptId
              ? { ...script, status: "accepted" as const }
              : script
          )
        }));
      },

      declineSharedScript: (sharedScriptId) => {
        set((state) => ({
          sharedScripts: state.sharedScripts.map(script =>
            script.id === sharedScriptId
              ? { ...script, status: "declined" as const }
              : script
          )
        }));
      },

      markAsShared: (scriptId) => {
        set((state) => ({
          mySharedScripts: [...state.mySharedScripts, scriptId]
        }));
      },

      importSharedScriptData: (data) => {
        const sharedScript: SharedScript = {
          id: `shared_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          originalId: `imported_${Date.now()}`,
          name: data.script.name,
          description: data.script.description,
          items: data.script.items,
          sharedBy: data.sharedBy,
          sharedAt: data.sharedAt,
          message: data.message,
          status: "pending"
        };
        
        get().addSharedScript(sharedScript);
        return sharedScript.id;
      },

      exportScriptData: (scriptMeta, items, message) => {
        const data: SharedScriptData = {
          script: {
            name: scriptMeta.name,
            description: scriptMeta.description,
            items: items,
            metadata: {
              name: scriptMeta.name,
              createdAt: scriptMeta.createdAt,
              updatedAt: scriptMeta.updatedAt,
              count: scriptMeta.count,
              status: scriptMeta.status,
              broadcastCount: scriptMeta.broadcastCount,
              lastBroadcastAt: scriptMeta.lastBroadcastAt
            }
          },
          sharedBy: "current-user@example.com", // TODO: Get from user store
          message: message,
          sharedAt: new Date().toISOString()
        };
        
        return data;
      }
    }),
    {
      name: "shared-scripts-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sharedScripts: state.sharedScripts,
        mySharedScripts: state.mySharedScripts
      })
    }
  )
);