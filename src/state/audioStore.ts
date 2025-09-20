import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type PreferredInput = "device" | "bluetooth" | "earpiece";

export type RecordingHistory = { version: number; trimStartMs: number; trimEndMs: number; createdAt: number };

export type FxSettings = {
  normalizeTargetLufs: number | null;
  normalizeGainDb?: number | null;
  fadeInMs?: number | null;
  fadeOutMs?: number | null;
  padHeadMs?: number | null;
  padTailMs?: number | null;
};
// Enhanced multitrack data structures
export type TrackType = "master" | "audio" | "aux";

export type AudioSegment = {
  id: string;
  uri: string;
  name?: string;
  startMs: number;
  endMs: number;
  trackId: string;
  // Audio properties
  gain: number; // 0..2 (linear)
  pan: number; // -1..1 (left to right)
  muted: boolean;
  // Fade curves
  fadeInMs: number;
  fadeOutMs: number;
  fadeInCurve: "linear" | "exponential" | "logarithmic";
  fadeOutCurve: "linear" | "exponential" | "logarithmic";
  // Visual properties
  color: string;
  // Source audio properties
  sourceStartMs: number; // offset into source file
  sourceDurationMs: number; // total duration of source file
  waveform?: number[]; // cached waveform data
  processedWaveform?: number[]; // waveform with effects applied
  waveformVersion?: number; // version for cache invalidation
};

export type AutomationPoint = {
  timeMs: number;
  value: number; // 0..1 for volume, -1..1 for pan
};

export type AutomationCurve = {
  points: AutomationPoint[];
  type: "linear" | "exponential" | "logarithmic";
};

export type TrackAutomation = {
  volume?: AutomationCurve;
  pan?: AutomationCurve;
  enabled: boolean;
};

export type Track = {
  id: string;
  name: string;
  type: TrackType;
  index: number; // display order
  height: number; // UI height in pixels
  // Audio properties
  gain: number; // 0..2 (linear)
  pan: number; // -1..1 (left to right)
  muted: boolean;
  soloed: boolean;
  recordArmed: boolean;
  // Visual properties
  color: string;
  collapsed: boolean;
  // Effects and routing
  effects: EffectChain;
  sendLevels: Record<string, number>; // aux send levels
  // Automation
  automation?: TrackAutomation;
};

export type EffectChain = {
  eq: EQSettings;
  compressor: CompressorSettings;
  reverb: ReverbSettings;
  // Add more effects as needed
};

export type EQSettings = {
  enabled: boolean;
  lowGain: number; // -12..12 dB
  midGain: number;
  highGain: number;
  lowFreq: number; // Hz
  midFreq: number;
  highFreq: number;
};

export type CompressorSettings = {
  enabled: boolean;
  threshold: number; // dB
  ratio: number; // 1..20
  attack: number; // ms
  release: number; // ms
  makeupGain: number; // dB
};

export type ReverbSettings = {
  enabled: boolean;
  roomSize: number; // 0..1
  damping: number; // 0..1
  wetLevel: number; // 0..1
  dryLevel: number; // 0..1
};

export type DuckingCfg = { 
  enabled: boolean; 
  sourceTrackId?: string; // track that triggers ducking (optional for backward compatibility)
  targetTrackIds?: string[]; // tracks that get ducked (optional for backward compatibility)
  threshold?: number; // dB
  amountDb: number; 
  attackMs: number; 
  releaseMs: number;
  holdMs?: number; // hold time before release
};

// Legacy type for backward compatibility
export type ClipSegment = { id: string; uri: string; startMs: number; endMs: number; track: "bed" | "sfx" };

export type TimelineViewport = {
  startMs?: number; // left edge of viewport
  endMs?: number; // right edge of viewport
  pixelsPerMs?: number; // zoom level
  snapToGrid?: boolean;
  gridSizeMs?: number; // snap grid size
  followPlayhead?: boolean;
};

export type ProjectSettings = {
  sampleRate?: number; // 44100, 48000, etc.
  bitDepth?: number; // 16, 24, 32
  tempo?: number; // BPM
  timeSignature?: { numerator: number; denominator: number };
  masterGain?: number;
  masterPan?: number;
};

export type WorkflowStatus = "created" | "ready_edit" | "in_edit" | "ready_broadcast" | "delivered";

export type RecordingItem = {
  id: string;
  uri: string;
  createdAt: number;
  name?: string;
  category: string;
  categoryCode?: string;
  subcategory?: string;
  tags?: string[];
  notes?: string;
  version: number;
  cloudPath?: string;
  filename?: string;
  syncStatus?: "pending" | "uploading" | "failed" | "synced";
  progress?: number;
  uploadedAt?: number;
  lufs?: number;
  durationMs?: number;
  trimStartMs?: number;
  trimEndMs?: number;
  waveform?: number[];
  processedWaveform?: number[];
  waveformVersion?: number;
  history?: RecordingHistory[];
  stationId?: string;
  effects?: FxSettings;
  // New multitrack properties
  tracks?: Track[];
  segments?: AudioSegment[];
  ducking?: DuckingCfg;
  viewport?: TimelineViewport;
  projectSettings?: ProjectSettings;
  // Workflow properties
  workflowChoice?: "crop" | "save";
  workflowStatus?: WorkflowStatus;
  // Legacy properties for backward compatibility
  trackGains?: { clip: number; bed: number; sfx: number };
  introMs?: number | null;
  eomMs?: number | null;
  loopRegion?: { startMs: number; endMs: number } | null;
  flattenedUri?: string | null;
  flattenedAt?: number | null;
};

interface AudioState {
  micGain: number; // 0.5 - 2.0
  preferredInput: PreferredInput;
  setMicGain: (v: number) => void;
  setPreferredInput: (v: PreferredInput) => void;
  recordingsByStation: Record<string, RecordingItem[]>;
  addRecording: (r: RecordingItem, stationId: string) => void;
  removeRecording: (id: string, stationId: string) => void;
  clearRecordings: (stationId: string) => void;
  hiddenRecentIdsByStation: Record<string, string[]>;
  hideRecent: (ids: string[], stationId: string) => void;
  unhideAllRecent: (stationId: string) => void;
  currentEditId: string | null;
  setCurrentEditId: (id: string | null) => void;
  updateRecording: (id: string, patch: Partial<RecordingItem>, stationId: string) => void;
  setEffects: (id: string, fx: Partial<FxSettings>, stationId: string) => void;
  updateWaveform: (id: string, waveform: number[], processedWaveform?: number[], stationId?: string) => void;
  clearProcessedWaveform: (id: string, stationId: string) => void;
  
  // Legacy segment methods (for backward compatibility)
  addSegment: (id: string, seg: ClipSegment | AudioSegment, stationId: string) => void;
  nudgeSegment: (id: string, segId: string, deltaMs: number, stationId: string) => void;
  setTrackGain: (id: string, track: "clip" | "bed" | "sfx", gain: number, stationId: string) => void;
  setDucking: (id: string, duck: Partial<DuckingCfg>, stationId: string) => void;
  removeSegment: (id: string, segId: string, stationId: string) => void;
  
  // New multitrack methods
  addTrack: (recordingId: string, track: Omit<Track, "id">, stationId: string) => void;
  removeTrack: (recordingId: string, trackId: string, stationId: string) => void;
  updateTrack: (recordingId: string, trackId: string, patch: Partial<Track>, stationId: string) => void;
  reorderTracks: (recordingId: string, trackIds: string[], stationId: string) => void;
  
  addAudioSegment: (recordingId: string, segment: Omit<AudioSegment, "id">, stationId: string) => void;
  updateAudioSegment: (recordingId: string, segmentId: string, patch: Partial<AudioSegment>, stationId: string) => void;
  removeAudioSegment: (recordingId: string, segmentId: string, stationId: string) => void;
  moveAudioSegment: (recordingId: string, segmentId: string, newTrackId: string, newStartMs: number, stationId: string) => void;
  
  setViewport: (recordingId: string, viewport: Partial<TimelineViewport>, stationId: string) => void;
  setProjectSettings: (recordingId: string, settings: Partial<ProjectSettings>, stationId: string) => void;
  
  setCues: (id: string, cues: { introMs?: number | null; eomMs?: number | null }, stationId: string) => void;
  setLoopRegion: (id: string, region: { startMs: number; endMs: number } | null, stationId: string) => void;
  setStatus: (id: string, status: WorkflowStatus, stationId: string) => void;
  setFlattened: (id: string, flattenedUri: string | null, stationId: string) => void;
  purgeStation: (stationId: string) => void;
  pendingInsert: { targetRecId: string; lane: "bed" | "sfx"; positionMs?: number; stationId: string } | null;
  setPendingInsert: (p: { targetRecId: string; lane: "bed" | "sfx"; positionMs?: number; stationId: string } | null) => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      micGain: 1.0,
      preferredInput: "device",
      setMicGain: (v) => set({ micGain: Math.max(0.5, Math.min(2.0, v)) }),
      setPreferredInput: (v) => set({ preferredInput: v }),
      recordingsByStation: {},
      pendingInsert: null,
      setPendingInsert: (p) => set({ pendingInsert: p }),
      addRecording: (r, stationId) => {
        set((s) => ({
          recordingsByStation: { ...s.recordingsByStation, [stationId]: [{ ...r, stationId, version: r.version ?? 1, workflowStatus: r.workflowStatus || "ready_edit" }, ...(s.recordingsByStation[stationId] || [])] },
        }));
        // If editor requested to insert this new recording into a lane, do it now
        set((s) => {
          const p = s.pendingInsert;
          if (!p || !p.targetRecId) return {} as any;
          const list = s.recordingsByStation[p.stationId] || [];
          const target = list.find((rec) => rec.id === p.targetRecId);
          if (!target) return { pendingInsert: null } as any;
          const clipStart = target.trimStartMs ?? 0;
          const clipEnd = target.trimEndMs ?? (target.durationMs ?? 0);
          const lane = p.lane;
          const segId = lane === "bed" ? `bed-${Date.now()}` : `ovl-${Date.now()}`;
          const start = lane === "bed" ? clipStart : Math.max(p.positionMs ?? clipStart, clipStart);
          const remaining = Math.max(0, (target.durationMs ?? 60000) - start);
          const len = lane === "bed" ? Math.max(100, clipEnd - clipStart) : Math.max(500, Math.min(3000, remaining));
          const end = lane === "bed" ? clipEnd : start + len;
          const newSeg: ClipSegment = { id: segId, uri: r.uri, startMs: Math.max(0, Math.floor(start)), endMs: Math.max(Math.floor(start) + 100, Math.floor(end)), track: lane } as any;
          const newSegments = lane === "bed"
            ? [newSeg, ...((target.segments || []).filter((x) => (x as any).track !== "bed" && (x as any).trackId !== "bed"))]
            : [newSeg, ...((target.segments || []))];
          const updated = { ...target, segments: newSegments } as RecordingItem;
          return {
            recordingsByStation: { ...s.recordingsByStation, [p.stationId]: list.map((rec) => rec.id === p.targetRecId ? updated : rec) },
            pendingInsert: null,
          } as any;
        });
      },
      removeRecording: (id, stationId) => set((s) => ({
        recordingsByStation: { ...s.recordingsByStation, [stationId]: (s.recordingsByStation[stationId] || []).filter((x) => x.id !== id) },
      })),
      clearRecordings: (stationId) => set((s) => ({ recordingsByStation: { ...s.recordingsByStation, [stationId]: [] } })),
      hiddenRecentIdsByStation: {},
      hideRecent: (ids, stationId) => set((s) => ({
        hiddenRecentIdsByStation: { ...s.hiddenRecentIdsByStation, [stationId]: Array.from(new Set([...(s.hiddenRecentIdsByStation[stationId] || []), ...ids])) },
      })),
      unhideAllRecent: (stationId) => set((s) => ({ hiddenRecentIdsByStation: { ...s.hiddenRecentIdsByStation, [stationId]: [] } })),
      currentEditId: null,
      setCurrentEditId: (id) => set({ currentEditId: id }),
      updateRecording: (id, patch, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
        },
      })),
      setEffects: (id, fx, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => (r.id === id ? { ...r, effects: { ...(r.effects || { normalizeTargetLufs: null }), ...fx } } : r)),
        },
      })),
      addSegment: (id: string, seg: ClipSegment | AudioSegment, stationId: string) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => {
            if (r.id !== id) return r;
            
            // Handle legacy ClipSegment
            if ("track" in seg) {
              const legacySeg = seg as ClipSegment;
              return { ...r, segments: [{ ...(legacySeg as any), id: legacySeg.id }, ...((r.segments || []))] };
            }
            
            // Handle new AudioSegment
            const audioSeg = seg as AudioSegment;
            return { ...r, segments: [{ ...audioSeg, id: audioSeg.id }, ...((r.segments || []))] };
          }),
        },
      })),
      nudgeSegment: (id, segId, deltaMs, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => {
            if (r.id !== id) return r as any;
            const dur = r.durationMs ?? Number.MAX_SAFE_INTEGER;
            const segs = (r.segments || []).map((x) => {
              if (x.id !== segId) return x;
              const len = Math.max(100, (x.endMs || 0) - (x.startMs || 0));
              let newStart = (x.startMs || 0) + deltaMs;
              newStart = Math.max(0, Math.min(dur - 1, newStart));
              let newEnd = newStart + len;
              if (newEnd > dur) {
                newEnd = dur;
                newStart = Math.max(0, newEnd - len);
              }
              return { ...x, startMs: Math.floor(newStart), endMs: Math.floor(Math.max(newStart + 100, newEnd)) };
            });
            return { ...r, segments: segs } as any;
          }),
        },
      })),
      setTrackGain: (id, track, gain, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => (r.id === id ? { ...r, trackGains: { clip: r.trackGains?.clip ?? 1, bed: r.trackGains?.bed ?? 1, sfx: r.trackGains?.sfx ?? 1, [track]: Math.max(0, Math.min(2, gain)) } } : r)),
        },
      })),
      setDucking: (id, duck, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => (r.id === id ? { ...r, ducking: { enabled: r.ducking?.enabled ?? false, amountDb: r.ducking?.amountDb ?? 6, attackMs: r.ducking?.attackMs ?? 50, releaseMs: r.ducking?.releaseMs ?? 200, ...(duck || {}) } } : r)),
        },
      })),
      removeSegment: (id, segId, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => (r.id === id ? { ...r, segments: (r.segments || []).filter((x) => x.id !== segId) } : r)),
        },
      })),
      setCues: (id, cues, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => (r.id === id ? { ...r, introMs: cues.introMs ?? r.introMs ?? null, eomMs: cues.eomMs ?? r.eomMs ?? null } : r)),
        },
      })),
      setLoopRegion: (id, region, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => (r.id === id ? { ...r, loopRegion: region } : r)),
        },
      })),
      setStatus: (id, status, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => (r.id === id ? { ...r, workflowStatus: status } : r)),
        },
      })),
      setFlattened: (id, flattenedUri, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => (r.id === id ? { ...r, flattenedUri, flattenedAt: flattenedUri ? Date.now() : null } : r)),
        },
      })),
      purgeStation: (stationId) => set((s) => ({
        recordingsByStation: Object.fromEntries(Object.entries(s.recordingsByStation).filter(([k]) => k !== stationId)),
        hiddenRecentIdsByStation: Object.fromEntries(Object.entries(s.hiddenRecentIdsByStation).filter(([k]) => k !== stationId)),
      })),

      // New multitrack methods
      addTrack: (recordingId, track, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => {
            if (r.id !== recordingId) return r;
            const newTrack: Track = { ...track, id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
            return { ...r, tracks: [...(r.tracks || []), newTrack] };
          }),
        },
      })),

      removeTrack: (recordingId, trackId, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => {
            if (r.id !== recordingId) return r;
            return { 
              ...r, 
              tracks: (r.tracks || []).filter(t => t.id !== trackId),
              segments: (r.segments || []).filter(seg => seg.trackId !== trackId)
            };
          }),
        },
      })),

      updateTrack: (recordingId, trackId, patch, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => {
            if (r.id !== recordingId) return r;
            return {
              ...r,
              tracks: (r.tracks || []).map(t => t.id === trackId ? { ...t, ...patch } : t)
            };
          }),
        },
      })),

      reorderTracks: (recordingId, trackIds, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => {
            if (r.id !== recordingId) return r;
            const trackMap = new Map((r.tracks || []).map(t => [t.id, t]));
            const reorderedTracks = trackIds.map((id, index) => ({ 
              ...trackMap.get(id)!, 
              index 
            })).filter(Boolean);
            return { ...r, tracks: reorderedTracks };
          }),
        },
      })),

      addAudioSegment: (recordingId, segment, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => {
            if (r.id !== recordingId) return r;
            const newSegment: AudioSegment = { ...segment, id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
            return { ...r, segments: [...(r.segments || []), newSegment] };
          }),
        },
      })),

      updateAudioSegment: (recordingId, segmentId, patch, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => {
            if (r.id !== recordingId) return r;
            return {
              ...r,
              segments: (r.segments || []).map(seg => seg.id === segmentId ? { ...seg, ...patch } : seg)
            };
          }),
        },
      })),

      removeAudioSegment: (recordingId, segmentId, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => {
            if (r.id !== recordingId) return r;
            return { ...r, segments: (r.segments || []).filter(seg => seg.id !== segmentId) };
          }),
        },
      })),

      moveAudioSegment: (recordingId, segmentId, newTrackId, newStartMs, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => {
            if (r.id !== recordingId) return r;
            return {
              ...r,
              segments: (r.segments || []).map(seg => {
                if (seg.id !== segmentId) return seg;
                const duration = seg.endMs - seg.startMs;
                return { ...seg, trackId: newTrackId, startMs: newStartMs, endMs: newStartMs + duration };
              })
            };
          }),
        },
      })),

      setViewport: (recordingId, viewport, stationId) => set((s) => ({
        recordingsByStation: {
          ...s.recordingsByStation,
          [stationId]: (s.recordingsByStation[stationId] || []).map((r) => {
            if (r.id !== recordingId) return r;
            return { ...r, viewport: { ...(r.viewport || {}), ...viewport } };
          }),
        },
      })),

       setProjectSettings: (recordingId, settings, stationId) => set((s) => ({
         recordingsByStation: {
           ...s.recordingsByStation,
           [stationId]: (s.recordingsByStation[stationId] || []).map((r) => {
             if (r.id !== recordingId) return r;
             return { ...r, projectSettings: { ...(r.projectSettings || {}), ...settings } };
           }),
         },
       })),

       updateWaveform: (id, waveform, processedWaveform, stationId) => set((s) => {
         const version = Date.now();
         if (stationId) {
           return {
             recordingsByStation: {
               ...s.recordingsByStation,
               [stationId]: (s.recordingsByStation[stationId] || []).map((r) => 
                 r.id === id ? { ...r, waveform, processedWaveform, waveformVersion: version } : r
               ),
             },
           };
         } else {
           // Update across all stations if no stationId provided
           const updated: Record<string, RecordingItem[]> = {};
           for (const [sid, recordings] of Object.entries(s.recordingsByStation)) {
             updated[sid] = recordings.map((r) => 
               r.id === id ? { ...r, waveform, processedWaveform, waveformVersion: version } : r
             );
           }
           return { recordingsByStation: updated };
         }
       }),

       clearProcessedWaveform: (id, stationId) => set((s) => ({
         recordingsByStation: {
           ...s.recordingsByStation,
           [stationId]: (s.recordingsByStation[stationId] || []).map((r) => 
             r.id === id ? { ...r, processedWaveform: undefined, waveformVersion: Date.now() } : r
           ),
         },
       })),
    }),
    {
      name: "audio-settings",
       version: 6,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (state: any, version) => {
        if (!state) return state;
        if (version < 2) {
          const rb: Record<string, any[]> = {};
          const hb: Record<string, string[]> = {};
          if (Array.isArray(state.recordings)) {
            rb["station-a"] = state.recordings;
            delete state.recordings;
          }
          if (Array.isArray(state.hiddenRecentIds)) {
            hb["station-a"] = state.hiddenRecentIds;
            delete state.hiddenRecentIds;
          }
          state = { ...state, recordingsByStation: rb, hiddenRecentIdsByStation: hb };
        }
        if (version < 3) {
          const rb: Record<string, RecordingItem[]> = state.recordingsByStation || {};
          for (const k of Object.keys(rb)) {
            rb[k] = (rb[k] || []).map((r: any) => ({
              ...r,
              version: r.version ?? 1,
              history: Array.isArray(r.history) ? r.history : [],
            }));
          }
          state = { ...state, recordingsByStation: rb };
        }
        if (version < 4) {
          const rb: Record<string, RecordingItem[]> = state.recordingsByStation || {};
          for (const k of Object.keys(rb)) {
            rb[k] = (rb[k] || []).map((r: any) => ({
              ...r,
              effects: r.effects || { normalizeTargetLufs: null },
              segments: Array.isArray(r.segments) ? r.segments : [],
              introMs: r.introMs ?? null,
              eomMs: r.eomMs ?? null,
              loopRegion: r.loopRegion ?? null,
            }));
          }
          state = { ...state, recordingsByStation: rb };
        }
        if (version < 5) {
          const rb: Record<string, RecordingItem[]> = state.recordingsByStation || {};
          for (const k of Object.keys(rb)) {
            rb[k] = (rb[k] || []).map((r: any) => ({
              ...r,
              workflowStatus: r.workflowStatus || "ready_edit",
              flattenedUri: r.flattenedUri ?? null,
              flattenedAt: r.flattenedAt ?? null,
            }));
          }
          state = { ...state, recordingsByStation: rb };
        }
         if (version < 6) {
          const rb: Record<string, RecordingItem[]> = state.recordingsByStation || {};
          for (const k of Object.keys(rb)) {
            rb[k] = (rb[k] || []).map((r: any) => ({
              ...r,
              trackGains: r.trackGains || { clip: 1, bed: 1, sfx: 1 },
              ducking: r.ducking || { enabled: false, amountDb: 6, attackMs: 50, releaseMs: 200 },
              segments: Array.isArray(r.segments) ? r.segments.map((s: any) => ({ ...s, track: s.track || (undefined) })) : [],
            }));
          }
          state = { ...state, recordingsByStation: rb };
        }
        return state;
      },
      partialize: (s) => ({
        micGain: s.micGain,
        preferredInput: s.preferredInput,
        recordingsByStation: s.recordingsByStation,
        hiddenRecentIdsByStation: s.hiddenRecentIdsByStation,
        currentEditId: s.currentEditId,
      }),
    }
  )
);

const EMPTY_ARR: any[] = [];
export function useRecordingsForStation(stationId: string | null) {
  return useAudioStore((s) => (stationId ? s.recordingsByStation[stationId] || EMPTY_ARR : EMPTY_ARR));
}
export function useHiddenRecentForStation(stationId: string | null) {
  return useAudioStore((s) => (stationId ? s.hiddenRecentIdsByStation[stationId] || EMPTY_ARR : EMPTY_ARR));
}
