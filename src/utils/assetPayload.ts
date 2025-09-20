import { RecordingItem } from "../state/audioStore";
import { CanonicalAsset, StationProfile } from "../types/playout";

export function buildAssetPayload(rec: RecordingItem, profile: StationProfile, input: Partial<CanonicalAsset>): CanonicalAsset {
  const external_id = rec.id;
  return {
    external_id,
    title: input.title || rec.name || "Untitled",
    artist: input.artist || "Presenter",
    category: input.category || rec.category || profile.defaults.category,
    loudness_lufs: input.loudness_lufs ?? rec.lufs ?? null,
    true_peak_db: input.true_peak_db ?? null,
    intro_sec: input.intro_sec ?? (rec.trimStartMs ? rec.trimStartMs / 1000 : null),
    eom_sec: input.eom_sec ?? profile.defaults.eomSec,
    hook_in: input.hook_in ?? null,
    hook_out: input.hook_out ?? null,
    explicit: input.explicit ?? false,
    isrc: input.isrc || "",
    embargo_start: input.embargo_start ?? null,
    expires_at: input.expires_at ?? null,
    notes: input.notes || "Uploaded from App",
  };
}
