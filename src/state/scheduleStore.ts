import { create } from "zustand";

export type ScheduledItem = { id: string; title: string; startISO: string; durationMins: number; status?: "upcoming" | "live" | "done" };

type ScheduleState = {
  items: ScheduledItem[];
  refresh: () => Promise<void>;
};

function seed(): ScheduledItem[] {
  const now = Date.now();
  function at(minsFromNow: number) {
    return new Date(now + minsFromNow * 60 * 1000).toISOString();
  }
  return [
    { id: "s1", title: "Morning Drive Hour 2", startISO: at(25), durationMins: 60, status: "upcoming" },
    { id: "s2", title: "Local Headlines", startISO: at(55), durationMins: 10, status: "upcoming" },
    { id: "s3", title: "Interview: Mayor", startISO: at(75), durationMins: 15, status: "upcoming" },
  ];
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  items: seed(),
  refresh: async () => set({ items: seed() }),
}));
