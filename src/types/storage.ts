export type StorageProvider = "gdrive" | "onedrive" | "dropbox";

export type StorageAuth = {
  provider: StorageProvider;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null; // ms epoch
  scopes?: string[];
  accountEmail?: string | null;
  accountName?: string | null;
};

export type StoragePolicy = {
  allowedProviders: StorageProvider[];
  maxFileSizeMB: number;
  requireFolderTemplate?: string | null; // e.g. "${station}/${yyyy}/${MM}/${dd}"
};

export type StorageObjectMeta = {
  id: string;
  name: string;
  path: string; // provider-relative path
  size: number;
  checksumSha256?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
  webUrl?: string | null;
  shareUrl?: string | null;
  provider: StorageProvider;
};

export type ContentCategory = 
  | "music" 
  | "news" 
  | "ads" 
  | "promos" 
  | "jingles" 
  | "voiceovers" 
  | "interviews" 
  | "other";

export type FolderMapping = {
  [K in ContentCategory]?: string; // Dropbox folder path for each category
};

export type StorageProfile = {
  provider: StorageProvider | null;
  folderTemplate?: string | null; // Base template like "${station}/${yyyy}/${MM}/${dd}"
  categoryFolders?: FolderMapping; // Per-category folder overrides
  autoCreateFolders?: boolean; // Whether to auto-create missing folders
  conflictResolution?: "rename" | "overwrite" | "skip"; // How to handle file conflicts
  lastVerified?: number | null; // Timestamp of last successful verification
  accountInfo?: {
    email?: string | null;
    name?: string | null;
    accountType?: string | null; // "basic", "plus", "professional", "business"
    spaceUsed?: number | null;
    spaceTotal?: number | null;
  };
};

export type DropboxFolder = {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  size?: number;
  modifiedTime?: string;
  canWrite?: boolean;
};
