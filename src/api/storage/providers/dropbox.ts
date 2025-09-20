import * as FileSystem from "expo-file-system";
import type { StorageAdapter } from "../adapter";
import type { StorageAuth, StorageObjectMeta } from "../../../types/storage";
import { refreshAuth as refreshOauth, getAuth } from "../oauth";
import { DropboxErrorHandler } from "../../../utils/dropboxErrors";
import { validateDropboxConfig } from "../../../utils/dropboxConfig";

const MAX_SINGLE_UPLOAD_SIZE = 150 * 1024 * 1024; // 150MB

async function apiCall(path: string, method: string, token: string, body?: any, headers?: Record<string, string>) {
  const resp = await fetch(`https://api.dropboxapi.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(headers||{}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return resp;
}

async function performSingleUpload(localUri: string, destPath: string, token: string, onProgress?: (p: number) => void) {
  onProgress && onProgress(0.1);
  
  const uploadUrl = "https://content.dropboxapi.com/2/files/upload";
  const headers: any = {
    Authorization: `Bearer ${token}`,
    "Dropbox-API-Arg": JSON.stringify({ 
      path: destPath, 
      mode: "add", 
      autorename: true, 
      mute: false, 
      strict_conflict: false 
    }),
    "Content-Type": "application/octet-stream",
  };
  
  let result = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers,
  });
  
  // Handle token refresh on 401
  if (result.status === 401) {
    const updated = await refreshOauth("dropbox");
    if (!updated?.accessToken) {
      throw new Error("Authentication failed - please reconnect your Dropbox account");
    }
    
    const refreshedHeaders = { 
      ...headers, 
      Authorization: `Bearer ${updated.accessToken}` 
    };
    
    result = await FileSystem.uploadAsync(uploadUrl, localUri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: refreshedHeaders,
    });
  }
  
  if (result.status < 200 || result.status >= 300) {
    let errorMessage = `Upload failed with status ${result.status}`;
    try {
      const errorData = JSON.parse(result.body || "{}");
      if (errorData.error_summary) {
        errorMessage = errorData.error_summary;
      }
    } catch {}
    throw new Error(errorMessage);
  }
  
  onProgress && onProgress(0.95);
  
  const metaJson: any = JSON.parse(result.body || "{}");
  const sizeInfo = await FileSystem.getInfoAsync(localUri);
  
  const meta: StorageObjectMeta = {
    id: metaJson.id || destPath,
    name: metaJson.name || destPath.split("/").pop() || "file",
    path: metaJson.path_lower || destPath,
    size: (sizeInfo as any)?.size || 0,
    provider: "dropbox",
    webUrl: null,
    shareUrl: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  onProgress && onProgress(1.0);
  return { objectId: meta.id, meta };
}

function normalizePath(p: string) {
  if (!p.startsWith("/")) return "/" + p;
  return p;
}

export const dropboxAdapter: StorageAdapter = {
  async init(auth: StorageAuth) {
    if (!auth?.accessToken) throw new Error("Not connected to Dropbox");
    // Validate token by fetching account
    let token = auth.accessToken;
    let resp = await apiCall("/2/users/get_current_account", "POST", token);
    if (resp.status === 401) {
      const updated = await refreshOauth("dropbox");
      token = updated?.accessToken || token;
      resp = await apiCall("/2/users/get_current_account", "POST", token);
    }
    if (!resp.ok) throw new Error("Dropbox auth failed");
  },
  async ensureRoot(template?: string | null) {
    const auth = await getAuth("dropbox");
    if (!auth?.accessToken) throw new Error("Not connected");
    const rootPath = normalizePath(template || "/");
    // Create folder if provided and not root
    if (rootPath !== "/") {
      let resp = await apiCall("/2/files/create_folder_v2", "POST", auth.accessToken, { path: rootPath, autorename: false });
      if (resp.status === 401) {
        const updated = await refreshOauth("dropbox");
        resp = await apiCall("/2/files/create_folder_v2", "POST", updated?.accessToken || auth.accessToken, { path: rootPath, autorename: false });
      }
      // Ignore 409 conflicts (already exists)
    }
    return { rootPath };
  },
  async putChunked(localUri: string, remotePath: string, onProgress?: (p: number) => void, authParam?: StorageAuth) {
    // Check if we're in demo mode
    const config = validateDropboxConfig();
    if (config.isDemoMode) {
      // Simulate upload progress in demo mode
      const steps = [0.1, 0.3, 0.5, 0.7, 0.9, 1.0];
      for (const progress of steps) {
        onProgress && onProgress(progress);
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate upload time
      }
      
      // Return mock upload result in the expected format
      const mockMeta: StorageObjectMeta = {
        id: `demo_file_${Date.now()}`,
        name: remotePath.split('/').pop() || 'demo_file',
        path: remotePath,
        size: 1024 * 1024, // 1MB mock size
        checksumSha256: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        webUrl: `https://dropbox.com/demo/${remotePath}`,
        shareUrl: null,
        provider: "dropbox"
      };
      
      return { objectId: mockMeta.id, meta: mockMeta };
    }

    const auth = authParam || await getAuth("dropbox");
    if (!auth?.accessToken) throw new Error("Not connected to Dropbox");
    
    const destPath = normalizePath(remotePath);
    
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      throw new Error("Local file not found");
    }
    
    const fileSize = (fileInfo as any).size || 0;
    onProgress && onProgress(0.05);
    
    try {
      // Use single upload for files under 150MB
      if (fileSize <= MAX_SINGLE_UPLOAD_SIZE) {
        return await performSingleUpload(localUri, destPath, auth.accessToken, onProgress);
      } else {
        throw new Error("Large file uploads (>150MB) not yet supported. Please use smaller files.");
      }
    } catch (error) {
      const dropboxError = DropboxErrorHandler.categorizeError(error);
      throw new Error(dropboxError.userMessage);
    }
  },


  async verify(idOrPath: string, _checksumSha256?: string | null, authParam?: StorageAuth) {
    const auth = authParam || await getAuth("dropbox");
    if (!auth?.accessToken) return false;
    const path = idOrPath.startsWith("id:") ? { file: idOrPath } : { path: normalizePath(idOrPath) };
    let resp = await apiCall("/2/files/get_metadata", "POST", auth.accessToken, path);
    if (resp.status === 401) {
      const updated = await refreshOauth("dropbox");
      resp = await apiCall("/2/files/get_metadata", "POST", updated?.accessToken || auth.accessToken, path);
    }
    return resp.ok;
  },
  async createShareLink(id: string, _expiresAt?: number | null, authParam?: StorageAuth) {
    const auth = authParam || await getAuth("dropbox");
    if (!auth?.accessToken) throw new Error("Not connected");
    const body = id.startsWith("id:") ? { file: id } : { path: normalizePath(id) };
    let resp = await apiCall("/2/sharing/create_shared_link_with_settings", "POST", auth.accessToken, body);
    if (resp.status === 401) {
      const updated = await refreshOauth("dropbox");
      resp = await apiCall("/2/sharing/create_shared_link_with_settings", "POST", updated?.accessToken || auth.accessToken, body);
    }
    if (!resp.ok) throw new Error("Share link failed");
    const j: any = await resp.json();
    return { url: j.url };
  },
  async openUrl(id: string) {
    try { const s = await this.createShareLink(id); return { url: s.url }; } catch { return { url: "https://www.dropbox.com/home" }; }
  },
  async listChanges(cursor?: string | null, authParam?: StorageAuth) {
    const auth = authParam || await getAuth("dropbox");
    if (!auth?.accessToken) return { cursor: String(Date.now()), items: [] };
    const path = "";
    let resp = await apiCall("/2/files/list_folder", "POST", auth.accessToken, { path, recursive: false, include_deleted: false });
    if (!resp.ok && cursor) resp = await apiCall("/2/files/list_folder/continue", "POST", auth.accessToken, { cursor });
    return { cursor: String(Date.now()), items: [] };
  },
  async rename(id: string, newName: string, authParam?: StorageAuth) {
    const auth = authParam || await getAuth("dropbox");
    if (!auth?.accessToken) throw new Error("Not connected");
    await apiCall("/2/files/move_v2", "POST", auth.accessToken, { from_path: id, to_path: newName });
  },
  async move(id: string, newPath: string, authParam?: StorageAuth) {
    const auth = authParam || await getAuth("dropbox");
    if (!auth?.accessToken) throw new Error("Not connected");
    await apiCall("/2/files/move_v2", "POST", auth.accessToken, { from_path: id, to_path: normalizePath(newPath) });
  },
  async delete(id: string, authParam?: StorageAuth) {
    const auth = authParam || await getAuth("dropbox");
    if (!auth?.accessToken) return;
    await apiCall("/2/files/delete_v2", "POST", auth.accessToken, { path: id });
  },
  async refreshAuth(auth) { return (await refreshOauth("dropbox")) || auth; },
};
