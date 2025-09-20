import * as FileSystem from "expo-file-system";
import type { StorageAdapter } from "../adapter";
import type { StorageAuth, StorageObjectMeta } from "../../../types/storage";

export const oneDriveAdapter: StorageAdapter = {
  async init(auth: StorageAuth) {
    if (!auth?.accessToken) throw new Error("Not connected to OneDrive");
  },
  
  async ensureRoot(template?: string | null) {
    // For OneDrive, we don't need to create a root folder - files are uploaded to the user's OneDrive
    // The template can be used as a folder name if needed
    return { rootPath: template || "/" };
  },
  
  async putChunked(localUri: string, remotePath: string, onProgress?: (p: number) => void, auth?: StorageAuth) {
    if (!auth?.accessToken) throw new Error("No authentication token provided");
    
    const fileName = remotePath.split("/").pop() || "file";
    const info = await FileSystem.getInfoAsync(localUri);
    const size = (info as any)?.size || 0;
    
    try {
      // Read file content
      const fileContent = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      
      onProgress && onProgress(0.1);
      
      // For small files, use simple upload. For larger files, we'd need resumable upload
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${auth.accessToken}`,
          "Content-Type": "application/octet-stream"
        },
        body: Uint8Array.from(atob(fileContent), c => c.charCodeAt(0))
      });
      
      onProgress && onProgress(0.8);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OneDrive upload failed: ${errorData.error?.message || response.statusText}`);
      }
      
      const result = await response.json();
      onProgress && onProgress(1.0);
      
      const meta: StorageObjectMeta = {
        id: result.id,
        name: result.name || fileName,
        path: remotePath,
        size: result.size || size,
        provider: "onedrive"
      };
      
      return { objectId: result.id, meta };
      
    } catch (error) {
      throw new Error(`OneDrive upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  
  async verify(_remotePath: string, _checksumSha256?: string | null, auth?: StorageAuth) {
    if (!auth?.accessToken) return false;
    
    try {
      // For OneDrive, we'll verify by checking if we can access the user's profile
      const response = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          "Authorization": `Bearer ${auth.accessToken}`
        }
      });
      
      return response.ok;
    } catch {
      return false;
    }
  },
  
  async createShareLink(id: string, _expiresAt?: number | null, auth?: StorageAuth) {
    if (!auth?.accessToken) throw new Error("No authentication token provided");
    
    try {
      // Create a sharing link
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${id}/createLink`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "view",
          scope: "anonymous"
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create share link: ${response.statusText}`);
      }
      
      const result = await response.json();
      return { url: result.link.webUrl };
    } catch (error) {
      throw new Error(`Failed to create share link: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  
  async openUrl(id: string) {
    return { url: `https://1drv.ms/u/s!${id}` };
  },
  
  async listChanges(cursor?: string | null, auth?: StorageAuth) {
    if (!auth?.accessToken) throw new Error("No authentication token provided");
    
    try {
      const url = cursor 
        ? `https://graph.microsoft.com/v1.0/me/drive/root/delta?token=${cursor}`
        : "https://graph.microsoft.com/v1.0/me/drive/root/delta";
      
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${auth.accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to list changes: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      const items = (data.value || []).map((item: any) => ({
        type: item.deleted ? "deleted" : (cursor ? "updated" : "created"),
        id: item.id,
        meta: item.deleted ? undefined : {
          id: item.id,
          name: item.name,
          path: item.parentReference?.path + "/" + item.name,
          size: item.size,
          provider: "onedrive" as const
        }
      }));
      
      return {
        cursor: data["@odata.deltaLink"] || data["@odata.nextLink"] || cursor || "",
        items
      };
    } catch (error) {
      throw new Error(`Failed to list changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  
  async rename(id: string, newName: string, auth?: StorageAuth) {
    if (!auth?.accessToken) throw new Error("No authentication token provided");
    
    try {
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: newName })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to rename file: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Failed to rename file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  
  async move(id: string, newParentId: string, auth?: StorageAuth) {
    if (!auth?.accessToken) throw new Error("No authentication token provided");
    
    try {
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          parentReference: {
            id: newParentId
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to move file: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  
  async delete(id: string, auth?: StorageAuth) {
    if (!auth?.accessToken) throw new Error("No authentication token provided");
    
    try {
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${auth.accessToken}`
        }
      });
      
      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to delete file: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  
  async refreshAuth(auth) {
    // This will be handled by the oauth.ts refreshAuth function
    return auth;
  },
};
