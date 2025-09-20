import { CanonicalAsset } from "../../types/playout";

function esc(v: any): string { const s = String(v ?? ""); return `"${s.replace(/"/g, "\"\"")}"`; }

export function buildMyriadCsv(filename: string, a: CanonicalAsset): string {
  const h = ["filename","title","artist","category","intro_sec","eom_sec","explicit","isrc","external_id","embargo_start","expires_at","notes"].join(",");
  const row = [
    filename,
    a.title,
    a.artist,
    a.category,
    a.intro_sec ?? "",
    a.eom_sec ?? "",
    a.explicit ? "true" : "false",
    a.isrc || "",
    a.external_id,
    a.embargo_start || "",
    a.expires_at || "",
    a.notes || "",
  ].map(esc).join(",");
  return `${h}\n${row}`;
}

