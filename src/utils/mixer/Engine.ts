import { Audio, AVPlaybackStatusSuccess, InterruptionModeIOS } from "expo-av";
import type { Trigger } from "../../state/mixStore";
import { radioAudioManager } from "../radioAudioManager";
import { useRadioStore } from "../../state/radioStore";

export type DeckNumber = 1 | 2 | 3 | 4;

export type EngineConfig = {
  micUri: string;
  micGain?: number; // 0..2
  deckGains: Record<DeckNumber, number>; // 0..2
  deckMutes?: Partial<Record<DeckNumber, boolean>>;
  deckSolos?: Partial<Record<DeckNumber, boolean>>;
  triggers: Trigger[]; // atMs, durationMs, deck, uri
  ducking?: { enabled: boolean; amountDb: number; attackMs: number; releaseMs: number };
};

type Listener<T> = (v: T) => void;

export class MixerEngine {
  private mic?: Audio.Sound;
  private micDurationMs: number = 0;
  private cfg?: EngineConfig;
  private isLoaded = false;
  private isPlaying = false;
  private startEpoch = 0;
  private seekOffsetMs = 0;
  private tickTimer: any = null;
  private progressTimer: any = null;
  private startedTriggerIds = new Set<string>();
  private activeDecks = new Map<string, Audio.Sound>();
  private onProgressCb: Listener<number> | null = null;
  private onEndedCb: Listener<void> | null = null;

  async load(cfg: EngineConfig) {
    // Check if radio is playing and handle audio session accordingly
    const radioState = useRadioStore.getState();
    const radioPlaying = radioState.playbackState === "playing";
    
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      interruptionModeIOS: radioPlaying ? InterruptionModeIOS.DuckOthers : InterruptionModeIOS.DoNotMix,
      staysActiveInBackground: false,
      shouldDuckAndroid: !radioPlaying, // Don't duck if radio is playing
      playThroughEarpieceAndroid: false,
    });
    this.dispose();
    this.cfg = cfg;
    this.isLoaded = false;
    this.startedTriggerIds.clear();
    this.activeDecks.forEach((s) => s.unloadAsync().catch(() => {}));
    this.activeDecks.clear();

    const { sound } = await Audio.Sound.createAsync({ uri: cfg.micUri }, { shouldPlay: false, positionMillis: 0, volume: this.clampVol(cfg.micGain ?? 1) });
    this.mic = sound;
    try {
      const st = (await sound.getStatusAsync()) as AVPlaybackStatusSuccess;
      this.micDurationMs = st.isLoaded ? st.durationMillis ?? 0 : 0;
    } catch { this.micDurationMs = 0; }
    this.isLoaded = true;
  }

  getDurationMs() { return this.micDurationMs; }
  getPositionMs(): number {
    if (!this.isPlaying) return this.seekOffsetMs;
    return Math.max(0, Date.now() - this.startEpoch + this.seekOffsetMs);
  }

  onProgress(cb: Listener<number> | null) { this.onProgressCb = cb; }
  onEnded(cb: Listener<void> | null) { this.onEndedCb = cb; }

  async play() {
    if (!this.isLoaded || !this.mic || this.isPlaying) return;
    
    // Duck radio stream if it's playing
    const radioState = useRadioStore.getState();
    if (radioState.playbackState === "playing") {
      await radioAudioManager.setVolume(radioState.volume * 0.3); // Duck to 30%
    }
    
    const pos = Math.max(0, Math.min(this.seekOffsetMs, Math.max(this.micDurationMs - 1, 0)));
    await this.mic.playFromPositionAsync(pos);
    this.applyMicVolume();
    this.isPlaying = true;
    this.startEpoch = Date.now();
    this.startTick();
    this.startProgress();
  }

  async pause() {
    if (!this.mic || !this.isPlaying) return;
    const st = (await this.mic.getStatusAsync()) as AVPlaybackStatusSuccess;
    this.seekOffsetMs = st.positionMillis ?? this.getPositionMs();
    await this.mic.pauseAsync();
    this.isPlaying = false;
    this.stopTick();
    this.stopProgress();
    
    // Restore radio stream volume if it was ducked
    const radioState = useRadioStore.getState();
    if (radioState.playbackState === "playing") {
      await radioAudioManager.setVolume(radioState.volume);
    }
  }

  async stop() {
    if (!this.mic) return;
    await this.mic.stopAsync().catch(() => {});
    await this.mic.setPositionAsync(0).catch(() => {});
    this.seekOffsetMs = 0;
    this.isPlaying = false;
    this.stopTick();
    this.stopProgress();
    this.clearDecks();
    
    // Restore radio stream volume if it was ducked
    const radioState = useRadioStore.getState();
    if (radioState.playbackState === "playing") {
      await radioAudioManager.setVolume(radioState.volume);
    }
  }

  async seek(ms: number) {
    if (!this.mic) return;
    const clamped = Math.max(0, Math.min(this.micDurationMs || Number.MAX_SAFE_INTEGER, Math.floor(ms)));
    await this.mic.setPositionAsync(clamped).catch(() => {});
    this.seekOffsetMs = clamped;
    this.startedTriggerIds.clear();
    this.clearDecks();
    if (this.isPlaying) {
      this.startEpoch = Date.now();
    }
  }

  setTrackGain(id: "mic" | DeckNumber | "clip" | "bed" | "sfx", gain: number) {
    const mapStrToDeck = (k: "bed" | "sfx"): DeckNumber => (k === "bed" ? 1 : 2);
    if (id === "mic" || id === "clip") {
      if (!this.cfg) return;
      this.cfg.micGain = gain;
      this.applyMicVolume();
    } else {
      if (!this.cfg) return;
      const deck: DeckNumber = typeof id === "number" ? id : mapStrToDeck(id as any);
      this.cfg.deckGains[deck] = gain;
      this.activeDecks.forEach((s, key) => {
        if (key.startsWith(`${deck}:`)) s.setVolumeAsync(this.clampVol(gain)).catch(() => {});
      });
    }
  }

  setMute(id: "mic" | DeckNumber, mute: boolean) {
    if (!this.cfg) return;
    if (id === "mic") {
      (this.cfg as any).micMute = mute;
      this.applyMicVolume();
    } else {
      this.cfg.deckMutes = { ...(this.cfg.deckMutes || {}), [id]: mute };
      this.activeDecks.forEach((s, key) => {
        if (key.startsWith(`${id}:`)) s.setVolumeAsync(this.clampVol(mute ? 0 : this.cfg!.deckGains[id])).catch(() => {});
      });
    }
  }

  setSolo(id: "mic" | DeckNumber, solo: boolean) {
    if (!this.cfg) return;
    if (id === "mic") (this.cfg as any).micSolo = solo; else this.cfg.deckSolos = { ...(this.cfg.deckSolos || {}), [id]: solo };
    // volumes will be recalculated on tick via applyMicVolume and when decks start
  }

  setDucking(params: EngineConfig["ducking"]) {
    if (!this.cfg) return;
    this.cfg.ducking = params || { enabled: false, amountDb: 6, attackMs: 50, releaseMs: 200 } as any;
    this.applyMicVolume();
  }

  dispose() {
    this.stopTick();
    this.stopProgress();
    this.mic?.unloadAsync().catch(() => {});
    this.mic = undefined;
    this.clearDecks();
    this.isLoaded = false;
    this.isPlaying = false;
    this.seekOffsetMs = 0;
  }

  private startTick() {
    this.stopTick();
    this.tickTimer = setInterval(() => this.tick(), 50);
  }
  private stopTick() { if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; } }
  private startProgress() {
    this.stopProgress();
    this.progressTimer = setInterval(() => { this.onProgressCb && this.onProgressCb(this.getPositionMs()); }, 120);
  }
  private stopProgress() { if (this.progressTimer) { clearInterval(this.progressTimer); this.progressTimer = null; } }

  private clearDecks() {
    this.activeDecks.forEach((s) => s.stopAsync().catch(() => {}));
    this.activeDecks.forEach((s) => s.unloadAsync().catch(() => {}));
    this.activeDecks.clear();
  }

  private anySoloActive(): boolean {
    const ds = this.cfg?.deckSolos || {};
    return Object.values(ds).some(Boolean) || (this.cfg as any)?.micSolo === true;
  }

  private deckAllowed(deck: DeckNumber): boolean {
    if (!this.cfg) return false;
    if (this.anySoloActive()) {
      const soloMic = (this.cfg as any)?.micSolo === true;
      if (soloMic) return false; // only mic solo cuts decks
      return !!this.cfg.deckSolos?.[deck];
    }
    return !this.cfg.deckMutes?.[deck];
  }

  async loadFromEditor(params: { baseUri: string; segments: Array<{ id: string; uri: string; startMs: number; endMs: number; track?: "bed" | "sfx" }>; trackGains: { clip: number; bed: number; sfx: number }; ducking?: { enabled: boolean; amountDb: number; attackMs: number; releaseMs: number } }) {
    const triggers = params.segments.map((s) => ({ id: s.id, uri: s.uri, deck: (s.track === "bed" ? 1 : 2) as DeckNumber, atMs: s.startMs, durationMs: Math.max(0, s.endMs - s.startMs), gain: 1 }));
    await this.load({ micUri: params.baseUri, micGain: params.trackGains.clip, deckGains: { 1: params.trackGains.bed, 2: params.trackGains.sfx, 3: 1, 4: 1 }, triggers, ducking: params.ducking });
  }

  private async tick() {
    if (!this.cfg || !this.isPlaying) return;
    const now = this.getPositionMs();
    // schedule any triggers that should start now
    for (const t of this.cfg.triggers) {
      if (this.startedTriggerIds.has(t.id)) continue;
      if (t.atMs <= now + 30 && t.atMs + t.durationMs >= now) {
        this.startedTriggerIds.add(t.id);
        if (!this.deckAllowed(t.deck)) continue;
        try {
          const { sound } = await Audio.Sound.createAsync({ uri: t.uri }, { shouldPlay: true, positionMillis: 0, volume: this.clampVol(this.cfg.deckGains[t.deck]) });
          const key = `${t.deck}:${t.id}`;
          this.activeDecks.set(key, sound);
          setTimeout(() => {
            const s = this.activeDecks.get(key);
            if (s) { s.stopAsync().catch(() => {}); s.unloadAsync().catch(() => {}); this.activeDecks.delete(key); }
            this.applyMicVolume();
          }, Math.max(0, t.durationMs - Math.max(0, now - t.atMs)));
          this.applyMicVolume();
        } catch { /* ignore */ }
      }
    }
    // auto-end when mic ends
    if (this.micDurationMs > 0 && now >= this.micDurationMs - 50) {
      this.onEndedCb && this.onEndedCb();
      this.pause().catch(() => {});
      await this.seek(this.micDurationMs);
    }
  }

  private async applyMicVolume() {
    if (!this.mic || !this.cfg) return;
    const base = this.clampVol((this.cfg as any).micMute ? 0 : (this.cfg.micGain ?? 1));
    const anyDeckActive = this.activeDecks.size > 0;
    let vol = base;
    if (this.anySoloActive()) {
      // if any deck solo is on, mute mic unless mic solo is on
      const soloMic = (this.cfg as any)?.micSolo === true;
      vol = soloMic ? base : 0;
    } else if (this.cfg.ducking?.enabled && anyDeckActive) {
      const duck = this.dbToScale(-(this.cfg.ducking.amountDb || 6));
      vol = this.clampVol(base * duck);
    }
    try { await this.mic.setVolumeAsync(vol); } catch {}
  }

  private clampVol(v: number) { return Math.max(0, Math.min(1, v)); }
  private dbToScale(db: number) { return Math.pow(10, db / 20); }
}
