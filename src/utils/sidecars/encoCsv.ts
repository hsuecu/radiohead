import { CanonicalAsset } from "../../types/playout";

function esc(v: any): string { const s = String(v ?? ""); return `"${s.replace(/"/g, "\"\"")}"`; }

export function buildEncoCsv(filename: string, a: CanonicalAsset): string {
  const h = ["filename","title","artist","category","intro_sec","eom_sec","explicit","external_id","embargo_start","expires_at"].join(",");
  const row = [
    filename,
    a.title,
    a.artist,
    a.category,
    a.intro_sec ?? "",
    a.eom_sec ?? "",
    a.explicit ? "true" : "false",
    a.external_id,
    a.embargo_start || "",
    a.expires_at || "",
  ].map(esc).join(",");
  return `${h}\n${row}`;
}
