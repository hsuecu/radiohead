import * as FileSystem from "expo-file-system";
import type { StorageAdapter } from "../adapter";
import type { StorageAuth, StorageObjectMeta } from "../../../types/storage";

export const driveAdapter: StorageAdapter = {
  async init(auth: StorageAuth) {
    if (!auth?.accessToken) throw new Error("Not connected to Google Drive");
  },
  
  async ensureRoot(template?: string | null) {
    // For Google Drive, we don't need to create a root folder - files are uploaded to the user's Drive
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
      
      // Create metadata for the file
      const metadata = {
        name: fileName,
        parents: [] // Upload to root, could be modified to support folders
      };
      
      // Use multipart upload for simplicity
      const boundary = "-------314159265358979323846";
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";
      
      const multipartRequestBody = 
        delimiter +
        "Content-Type: application/json\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        "Content-Type: application/octet-stream\r\n" +
        "Content-Transfer-Encoding: base64\r\n\r\n" +
        fileContent +
        close_delim;
      
      onProgress && onProgress(0.1);
      
      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${auth.accessToken}`,
          "Content-Type": `multipart/related; boundary="${boundary}"`
        },
        body: multipartRequestBody
      });
      
      onProgress && onProgress(0.8);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Google Drive upload failed: ${errorData.error?.message || response.statusText}`);
      }
      
      const result = await response.json();
      onProgress && onProgress(1.0);
      
      const meta: StorageObjectMeta = {
        id: result.id,
        name: result.name || fileName,
        path: remotePath,
        size: size,
        provider: "gdrive"
      };
      
      return { objectId: result.id, meta };
      
    } catch (error) {
      throw new Error(`Google Drive upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  
  async verify(_remotePath: string, _checksumSha256?: string | null, auth?: StorageAuth) {
    if (!auth?.accessToken) return false;
    
    try {
      // For Google Drive, we'll verify by checking if we can access the user's Drive
      const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
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
      // Make the file publicly readable
      await fetch(`https://www.googleapis.com/drive/v3/files/${id}/permissions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone"
        })
      });
      
      return { url: `https://drive.google.com/file/d/${id}/view` };
    } catch (error) {
      throw new Error(`Failed to create share link: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  
  async openUrl(id: string) {
    return { url: `https://drive.google.com/file/d/${id}/view` };
  },
  
  async listChanges(cursor?: string, auth?: StorageAuth) {
    if (!auth?.accessToken) throw new Error("No authentication token provided");
    
    try {
      const url = cursor 
        ? `https://www.googleapis.com/drive/v3/changes?pageToken=${cursor}`
        : "https://www.googleapis.com/drive/v3/changes/startPageToken";
      
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${auth.accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to list changes: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!cursor) {
        // This was a request for start page token
        return { cursor: data.startPageToken, items: [] };
      }
      
      return {
        cursor: data.nextPageToken || data.newStartPageToken,
        items: data.changes || []
      };
    } catch (error) {
      throw new Error(`Failed to list changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  
  async rename(id: string, newName: string, auth?: StorageAuth) {
    if (!auth?.accessToken) throw new Error("No authentication token provided");
    
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
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
      // Get current parents
      const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=parents`, {
        headers: {
          "Authorization": `Bearer ${auth.accessToken}`
        }
      });
      
      if (!fileResponse.ok) {
        throw new Error("Failed to get current file parents");
      }
      
      const fileData = await fileResponse.json();
      const previousParents = fileData.parents ? fileData.parents.join(",") : "";
      
      // Move file
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?addParents=${newParentId}&removeParents=${previousParents}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${auth.accessToken}`
        }
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
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
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
