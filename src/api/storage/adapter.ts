import type { StorageAuth, StorageObjectMeta, StorageProvider } from "../../types/storage";

export interface StorageAdapter {
  init(auth: StorageAuth): Promise<void>;
  ensureRoot(template?: string | null): Promise<{ rootPath: string }>;
  putChunked(localUri: string, remotePath: string, onProgress?: (p: number) => void, auth?: StorageAuth): Promise<{ objectId: string; meta?: StorageObjectMeta }>; 
  verify(remotePath: string, checksumSha256?: string | null, auth?: StorageAuth): Promise<boolean>;
  createShareLink(id: string, expiresAt?: number | null, auth?: StorageAuth): Promise<{ url: string }>;
  openUrl(id: string): Promise<{ url: string }>;
  listChanges(cursor?: string | null, auth?: StorageAuth): Promise<{ cursor: string; items: Array<{ type: "created"|"updated"|"deleted"; meta?: StorageObjectMeta; id: string }> }>;
  rename(id: string, newName: string, auth?: StorageAuth): Promise<void>;
  move(id: string, newPath: string, auth?: StorageAuth): Promise<void>;
  delete(id: string, auth?: StorageAuth): Promise<void>;
  refreshAuth?(auth: StorageAuth): Promise<StorageAuth>;
}

export async function getAdapter(provider: StorageProvider): Promise<StorageAdapter> {
  if (provider === "gdrive") return (await import("./providers/googleDrive")).driveAdapter;
  if (provider === "onedrive") return (await import("./providers/oneDrive")).oneDriveAdapter;
  if (provider === "dropbox") return (await import("./providers/dropbox")).dropboxAdapter;
  throw new Error("Unsupported provider");
}
