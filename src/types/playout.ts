export type PlayoutSystem = "myriad" | "mairlist" | "enco" | "generic";
export type DeliveryMethod = "dropbox" | "sftp" | "smb" | "s3" | "azure" | "gcp" | "api" | "local";

import type { StorageProvider, StorageProfile } from "./storage";

export type StationProfile = {
  id: string;
  name: string;
  playout: PlayoutSystem; // single playout selection per profile
  storage?: StorageProfile;
  delivery: {
    method: DeliveryMethod;
    host: string | null;
    port?: number | null;
    username?: string | null;
    password?: string | null;
    privateKey?: string | null;
    shareOrBucket?: string | null;
    remotePath: string; // folder prefix
    apiBase?: string | null;
    apiKey?: string | null;
  };
  defaults: {
    fileFormat: "wav" | "mp3";
    sampleRateHz: number;
    bitDepth: 16 | 24;
    loudnessLUFS: number; // target
    truePeakDBTP: number; // target
    category: string;
    eomSec: number;
  };
  sidecar: {
    type: "none" | "csv" | "xml" | "mmd";
    fields: string[];
  };
  mappings: {
    categories: Record<string, string[]>; // canonical -> vendor aliases
  };
};

export type CanonicalAsset = {
  external_id: string;
  title: string;
  artist: string;
  category: string;
  loudness_lufs?: number | null;
  true_peak_db?: number | null;
  intro_sec?: number | null;
  eom_sec?: number | null;
  hook_in?: number | null;
  hook_out?: number | null;
  explicit?: boolean;
  isrc?: string;
  embargo_start?: string | null; // ISO
  expires_at?: string | null; // ISO
  notes?: string;
};
