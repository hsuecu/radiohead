import { CanonicalAsset } from "../../types/playout";

export function buildMyriadXml(filename: string, a: CanonicalAsset): string {
  return [
    "<MyriadImport>",
    `  <File>${filename}</File>`,
    `  <Title>${escapeXml(a.title)}</Title>`,
    `  <Artist>${escapeXml(a.artist)}</Artist>`,
    `  <Category>${escapeXml(a.category)}</Category>`,
    a.intro_sec != null ? `  <Intro seconds="${a.intro_sec}"/>` : "",
    a.eom_sec != null ? `  <EOM seconds="${a.eom_sec}"/>` : "",
    `  <Explicit>${a.explicit ? "true" : "false"}</Explicit>`,
    `  <ISRC>${a.isrc || ""}</ISRC>`,
    `  <ExternalID>${a.external_id}</ExternalID>`,
    `  <Embargo>${a.embargo_start || ""}</Embargo>`,
    `  <Expires>${a.expires_at || ""}</Expires>`,
    `  <Notes>${escapeXml(a.notes || "")}</Notes>`,
    "</MyriadImport>",
  ].filter(Boolean).join("\n");
}

function escapeXml(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
