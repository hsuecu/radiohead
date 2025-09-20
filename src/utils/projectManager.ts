import AsyncStorage from "@react-native-async-storage/async-storage";

export type ProjectSnapshot = {
  id: string; // recordingId
  stationId: string;
  createdAt: number;
  note?: string;
  data: any; // { tracks, segments, viewport, projectSettings }
};

const keyFor = (recordingId: string, stationId: string) => `proj:${stationId}:${recordingId}`;

export async function saveSnapshot(recordingId: string, stationId: string, data: any, note?: string) {
  const key = keyFor(recordingId, stationId);
  const exists = await AsyncStorage.getItem(key);
  const list: ProjectSnapshot[] = exists ? JSON.parse(exists) : [];
  const snap: ProjectSnapshot = { id: recordingId, stationId, createdAt: Date.now(), note, data };
  const next = [snap, ...list].slice(0, 10);
  await AsyncStorage.setItem(key, JSON.stringify(next));
}

export async function listSnapshots(recordingId: string, stationId: string): Promise<ProjectSnapshot[]> {
  const key = keyFor(recordingId, stationId);
  const exists = await AsyncStorage.getItem(key);
  return exists ? JSON.parse(exists) : [];
}

export async function loadLatest(recordingId: string, stationId: string): Promise<ProjectSnapshot | null> {
  const list = await listSnapshots(recordingId, stationId);
  return list[0] || null;
}
