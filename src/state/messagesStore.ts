import { create } from "zustand";

export type Message = { id: string; title: string; body: string; createdAtISO: string };

type MessagesState = {
  messages: Message[];
  refresh: () => Promise<void>;
  add: (m: Omit<Message, "id" | "createdAtISO">) => void;
  remove: (id: string) => void;
};

function seed(): Message[] {
  const now = new Date();
  return [
    { id: "m1", title: "Studio maintenance tonight", body: "Studio B will be offline from 11 PM for 2 hours.", createdAtISO: new Date(now.getTime() - 60*60*1000).toISOString() },
    { id: "m2", title: "Show rundown updated", body: "Morning Drive rundown v3 posted in the shared folder.", createdAtISO: new Date(now.getTime() - 2*60*60*1000).toISOString() },
    { id: "m3", title: "Guest confirmed", body: "Mayor will join the 8:15 segment for 10 minutes.", createdAtISO: new Date(now.getTime() - 10*60*1000).toISOString() },
  ];
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: seed(),
  refresh: async () => {
    // mock: no-op
    set({ messages: seed() });
  },
  add: (m) => {
    const msg: Message = { id: Math.random().toString(36).slice(2), createdAtISO: new Date().toISOString(), ...m } as any;
    set({ messages: [msg, ...get().messages] });
  },
  remove: (id: string) => set({ messages: get().messages.filter(x => x.id !== id) }),
}));
