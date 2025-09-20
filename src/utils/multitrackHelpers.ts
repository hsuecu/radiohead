import { Track, AudioSegment, TimelineViewport, ProjectSettings } from "../state/audioStore";

// Track limits for mobile optimization
export const TRACK_LIMITS = {
  MAX_TRACKS: 3,
  MIN_TRACKS: 1,
  MAX_AUDIO_TRACKS: 2, // Excluding master track
} as const;

export function createDefaultTracks(): Track[] {
  return [
    {
      id: "master-track",
      name: "Master",
      type: "master",
      index: 0,
      height: 80,
      gain: 1,
      pan: 0,
      muted: false,
      soloed: false,
      recordArmed: false,
      color: "#3B82F6",
      collapsed: false,
      effects: {
        eq: {
          enabled: false,
          lowGain: 0,
          midGain: 0,
          highGain: 0,
          lowFreq: 100,
          midFreq: 1000,
          highFreq: 10000,
        },
        compressor: {
          enabled: false,
          threshold: -12,
          ratio: 4,
          attack: 10,
          release: 100,
          makeupGain: 0,
        },
        reverb: {
          enabled: false,
          roomSize: 0.5,
          damping: 0.5,
          wetLevel: 0.3,
          dryLevel: 0.7,
        },
      },
      sendLevels: {},
    },
    {
      id: "audio-track-1",
      name: "Audio 1",
      type: "audio",
      index: 1,
      height: 80,
      gain: 1,
      pan: 0,
      muted: false,
      soloed: false,
      recordArmed: false,
      color: "#10B981",
      collapsed: false,
      effects: {
        eq: {
          enabled: false,
          lowGain: 0,
          midGain: 0,
          highGain: 0,
          lowFreq: 100,
          midFreq: 1000,
          highFreq: 10000,
        },
        compressor: {
          enabled: false,
          threshold: -12,
          ratio: 4,
          attack: 10,
          release: 100,
          makeupGain: 0,
        },
        reverb: {
          enabled: false,
          roomSize: 0.5,
          damping: 0.5,
          wetLevel: 0.3,
          dryLevel: 0.7,
        },
      },
      sendLevels: {},
    },
    {
      id: "audio-track-2",
      name: "Audio 2",
      type: "audio",
      index: 2,
      height: 80,
      gain: 1,
      pan: 0,
      muted: false,
      soloed: false,
      recordArmed: false,
      color: "#F59E0B",
      collapsed: false,
      effects: {
        eq: {
          enabled: false,
          lowGain: 0,
          midGain: 0,
          highGain: 0,
          lowFreq: 100,
          midFreq: 1000,
          highFreq: 10000,
        },
        compressor: {
          enabled: false,
          threshold: -12,
          ratio: 4,
          attack: 10,
          release: 100,
          makeupGain: 0,
        },
        reverb: {
          enabled: false,
          roomSize: 0.5,
          damping: 0.5,
          wetLevel: 0.3,
          dryLevel: 0.7,
        },
      },
      sendLevels: {},
    },
  ];
}

export function createDefaultViewport(durationMs: number): TimelineViewport {
  return {
    startMs: 0,
    endMs: Math.max(60000, durationMs), // At least 1 minute or recording duration
    pixelsPerMs: 0.1,
    snapToGrid: true,
    gridSizeMs: 1000, // 1 second grid
    followPlayhead: false,
  };
}

export function createDefaultProjectSettings(): ProjectSettings {
  return {
    sampleRate: 44100,
    bitDepth: 16,
    tempo: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    masterGain: 1,
    masterPan: 0,
  };
}

export function convertLegacySegmentsToAudioSegments(
  legacySegments: any[]
): AudioSegment[] {
  const audioSegments: AudioSegment[] = [];
  
  legacySegments.forEach((seg) => {
    // Map legacy track names to new track IDs
    let trackId = "audio-track-1"; // default
    if (seg.track === "bed" || seg.trackId === "bed") {
      trackId = "audio-track-1";
    } else if (seg.track === "sfx" || seg.trackId === "sfx") {
      trackId = "audio-track-2";
    } else if (seg.trackId) {
      trackId = seg.trackId;
    }
    
    const audioSegment: AudioSegment = {
      id: seg.id,
      uri: seg.uri,
      name: seg.name || "Audio Clip",
      startMs: seg.startMs,
      endMs: seg.endMs,
      trackId,
      gain: seg.gain || 1,
      pan: seg.pan || 0,
      muted: seg.muted || false,
      fadeInMs: seg.fadeInMs || 0,
      fadeOutMs: seg.fadeOutMs || 0,
      fadeInCurve: seg.fadeInCurve || "linear",
      fadeOutCurve: seg.fadeOutCurve || "linear",
      color: seg.color || "#10B981",
      sourceStartMs: seg.sourceStartMs || 0,
      sourceDurationMs: seg.sourceDurationMs || (seg.endMs - seg.startMs),
      waveform: seg.waveform,
    };
    
    audioSegments.push(audioSegment);
  });
  
  return audioSegments;
}

export function ensureRecordingHasMultitrackData(recording: any): {
  tracks: Track[];
  segments: AudioSegment[];
  viewport: TimelineViewport;
  projectSettings: ProjectSettings;
} {
  // Initialize tracks if not present
  let tracks = recording.tracks;
  if (!tracks || tracks.length === 0) {
    tracks = createDefaultTracks();
    
    // Master track segment will be handled separately in the UI
  }
  
  // Convert legacy segments to new format
  let segments: AudioSegment[] = [];
  if (recording.segments) {
    segments = convertLegacySegmentsToAudioSegments(recording.segments);
  }
  
  // Initialize viewport if not present
  const viewport = recording.viewport || createDefaultViewport(recording.durationMs || 60000);
  
  // Initialize project settings if not present
  const projectSettings = recording.projectSettings || createDefaultProjectSettings();
  
  return { tracks, segments, viewport, projectSettings };
}

export function canAddTrack(currentTracks: Track[]): boolean {
  const audioTracks = currentTracks.filter(t => t.type === "audio");
  return audioTracks.length < TRACK_LIMITS.MAX_AUDIO_TRACKS;
}

export function canRemoveTrack(track: Track, currentTracks: Track[]): boolean {
  // Can't remove master track
  if (track.type === "master") return false;
  
  // Can't remove if it would go below minimum
  const audioTracks = currentTracks.filter(t => t.type === "audio");
  return audioTracks.length > 1;
}

export function getNextTrackColor(existingTracks: Track[]): string {
  const colors = ["#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4"];
  const usedColors = existingTracks.map(t => t.color);
  return colors.find(color => !usedColors.includes(color)) || colors[0];
}

export function createTrackTemplate(
  name: string, 
  index: number, 
  type: "audio" | "aux" = "audio"
): Omit<Track, "id"> {
  return {
    name,
    type,
    index,
    height: 80,
    gain: 1,
    pan: 0,
    muted: false,
    soloed: false,
    recordArmed: false,
    color: getNextTrackColor([]),
    collapsed: false,
    effects: {
      eq: {
        enabled: false,
        lowGain: 0,
        midGain: 0,
        highGain: 0,
        lowFreq: 100,
        midFreq: 1000,
        highFreq: 10000,
      },
      compressor: {
        enabled: false,
        threshold: -12,
        ratio: 4,
        attack: 10,
        release: 100,
        makeupGain: 0,
      },
      reverb: {
        enabled: false,
        roomSize: 0.5,
        damping: 0.5,
        wetLevel: 0.3,
        dryLevel: 0.7,
      },
    },
    sendLevels: {},
  };
}

export function optimizeTracksForMobile(tracks: Track[]): Track[] {
  // Ensure we don't exceed track limits
  const masterTracks = tracks.filter(t => t.type === "master");
  const audioTracks = tracks.filter(t => t.type === "audio").slice(0, TRACK_LIMITS.MAX_AUDIO_TRACKS);
  const auxTracks = tracks.filter(t => t.type === "aux").slice(0, 1); // Max 1 aux track for mobile
  
  return [...masterTracks, ...audioTracks, ...auxTracks]
    .map((track, index) => ({ ...track, index }));
}