import { CanonicalAsset } from "../../types/playout";

export function buildMairlistMmd(filename: string, a: CanonicalAsset): string {
  const fadeOut = a.eom_sec != null ? -Math.abs(a.eom_sec) : -0.5;
  const ramp = a.intro_sec != null ? a.intro_sec : 0.0;
  return [
    `<mAirListElement version="1.0">`,
    `  <Attributes>`,
    `    <Attribute Name="title" Value="${xml(a.title)}" />`,
    `    <Attribute Name="artist" Value="${xml(a.artist)}" />`,
    `    <Attribute Name="extid" Value="${xml(a.external_id)}" />`,
    `    <Attribute Name="category" Value="${xml(a.category)}" />`,
    `    <Attribute Name="isrc" Value="${xml(a.isrc || "")}" />`,
    `    <Attribute Name="explicit" Value="${a.explicit ? "true" : "false"}" />`,
    `    <Attribute Name="embargo_start" Value="${a.embargo_start || ""}" />`,
    `    <Attribute Name="expires_at" Value="${a.expires_at || ""}" />`,
    `  </Attributes>`,
    `  <CueData>`,
    `    <CuePoint Type="FadeIn" Position="0.000" />`,
    `    <CuePoint Type="Ramp" Position="${ramp.toFixed(3)}" />`,
    `    <CuePoint Type="FadeOut" Position="${fadeOut.toFixed(3)}" />`,
    `    <CuePoint Type="CueIn" Position="0.000" />`,
    `    <CuePoint Type="CueOut" Position="${fadeOut.toFixed(3)}" />`,
    `  </CueData>`,
    `</mAirListElement>`,
  ].join("\n");
}

function xml(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
