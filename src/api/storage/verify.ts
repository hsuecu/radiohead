import { getAuth, refreshAuth } from "./oauth";
import { getAdapter } from "./adapter";
import type { StorageProvider } from "../../types/storage";
import { DropboxErrorHandler } from "../../utils/dropboxErrors";
import { validateDropboxConfig } from "../../utils/dropboxConfig";

export type VerifyResult = {
  provider: StorageProvider;
  connected: boolean;
  verified: boolean;
  message?: string | null;
  lastVerified?: number;
  accountInfo?: {
    email?: string | null;
    name?: string | null;
    accountType?: string | null;
    spaceUsed?: number | null;
    spaceTotal?: number | null;
  };
  permissions?: {
    canRead: boolean;
    canWrite: boolean;
    canShare: boolean;
  };
};

export async function verifyStorageProvider(provider: StorageProvider, folderTemplate?: string | null): Promise<VerifyResult> {
  if (provider === "dropbox") {
    return verifyDropboxProvider(folderTemplate);
  } else if (provider === "gdrive") {
    return verifyGoogleDriveProvider(folderTemplate);
  } else if (provider === "onedrive") {
    return verifyOneDriveProvider(folderTemplate);
  } else {
    return { 
      provider, 
      connected: false, 
      verified: false, 
      message: `Verification not implemented for provider: ${provider}` 
    };
  }
}

async function verifyGoogleDriveProvider(folderTemplate?: string | null): Promise<VerifyResult> {
  const provider: StorageProvider = "gdrive";
  
  try {
    // Step 1: Check if we have auth token
    let auth = await getAuth(provider);
    
    if (!auth?.accessToken) {
      return { 
        provider, 
        connected: false, 
        verified: false, 
        message: "Not connected to Google Drive. Please connect your account first." 
      };
    }

    // Step 2: Check if token is expired and refresh if needed
    if (auth.expiresAt && auth.expiresAt < Date.now() + 60000) {
      try {
        const refreshedAuth = await refreshAuth(provider);
        if (refreshedAuth) {
          auth = refreshedAuth;
        }
      } catch (refreshError) {
        return { 
          provider, 
          connected: true, 
          verified: false, 
          message: "Token expired and refresh failed. Please reconnect your account." 
        };
      }
    }

    // Step 3: Validate token by fetching user info
    let accountInfo: any = {};
    let permissions = { canRead: false, canWrite: false, canShare: false };
    
    try {
      const userResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { 
          Authorization: `Bearer ${auth.accessToken}` 
        },
      });

      if (!userResp.ok) {
        return { 
          provider, 
          connected: true, 
          verified: false, 
          message: `Google Drive authentication failed: ${userResp.statusText}` 
        };
      }

      const userData = await userResp.json();
      accountInfo = {
        email: userData.email,
        name: userData.name,
        accountType: "personal", // Google doesn't distinguish in userinfo
      };

      permissions.canRead = true;

    } catch (error) {
      return { 
        provider, 
        connected: true, 
        verified: false, 
        message: `Failed to validate Google Drive token: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }

    // Step 4: Test write permissions by checking Drive API access
    try {
      const driveResp = await fetch("https://www.googleapis.com/drive/v3/about?fields=user,storageQuota", {
        headers: { 
          Authorization: `Bearer ${auth.accessToken}` 
        },
      });

      if (driveResp.ok) {
        const driveData = await driveResp.json();
        permissions.canWrite = true;
        permissions.canShare = true; // Assume sharing is available if we can access Drive
        
        // Update account info with Drive data
        if (driveData.storageQuota) {
          accountInfo.spaceUsed = parseInt(driveData.storageQuota.usage || "0");
          accountInfo.spaceTotal = parseInt(driveData.storageQuota.limit || "0");
        }
      }
    } catch (error) {
      // Drive access failed, but basic auth might still work
      permissions.canWrite = false;
      permissions.canShare = false;
    }

    // Step 5: Test folder template if provided
    if (folderTemplate) {
      try {
        const ad = await getAdapter(provider);
        await ad.ensureRoot(folderTemplate);
      } catch (error) {
        return { 
          provider, 
          connected: true, 
          verified: false, 
          message: `Folder template test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          accountInfo,
          permissions 
        };
      }
    }

    // All tests passed
    const message = permissions.canWrite 
      ? "Connected and verified with full access" 
      : "Connected with read-only access";

    return { 
      provider, 
      connected: true, 
      verified: true, 
      message,
      lastVerified: Date.now(),
      accountInfo,
      permissions 
    };

  } catch (error) {
    return { 
      provider, 
      connected: false, 
      verified: false, 
      message: `Google Drive verification failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

async function verifyOneDriveProvider(folderTemplate?: string | null): Promise<VerifyResult> {
  const provider: StorageProvider = "onedrive";
  
  try {
    // Step 1: Check if we have auth token
    let auth = await getAuth(provider);
    
    if (!auth?.accessToken) {
      return { 
        provider, 
        connected: false, 
        verified: false, 
        message: "Not connected to OneDrive. Please connect your account first." 
      };
    }

    // Step 2: Check if token is expired and refresh if needed
    if (auth.expiresAt && auth.expiresAt < Date.now() + 60000) {
      try {
        const refreshedAuth = await refreshAuth(provider);
        if (refreshedAuth) {
          auth = refreshedAuth;
        }
      } catch (refreshError) {
        return { 
          provider, 
          connected: true, 
          verified: false, 
          message: "Token expired and refresh failed. Please reconnect your account." 
        };
      }
    }

    // Step 3: Validate token by fetching user info
    let accountInfo: any = {};
    let permissions = { canRead: false, canWrite: false, canShare: false };
    
    try {
      const userResp = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { 
          Authorization: `Bearer ${auth.accessToken}` 
        },
      });

      if (!userResp.ok) {
        return { 
          provider, 
          connected: true, 
          verified: false, 
          message: `OneDrive authentication failed: ${userResp.statusText}` 
        };
      }

      const userData = await userResp.json();
      accountInfo = {
        email: userData.mail || userData.userPrincipalName,
        name: userData.displayName,
        accountType: "personal", // Could be enhanced to detect business accounts
      };

      permissions.canRead = true;

    } catch (error) {
      return { 
        provider, 
        connected: true, 
        verified: false, 
        message: `Failed to validate OneDrive token: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }

    // Step 4: Test write permissions by checking Drive quota
    try {
      const driveResp = await fetch("https://graph.microsoft.com/v1.0/me/drive", {
        headers: { 
          Authorization: `Bearer ${auth.accessToken}` 
        },
      });

      if (driveResp.ok) {
        const driveData = await driveResp.json();
        permissions.canWrite = true;
        permissions.canShare = true;
        
        // Update account info with Drive data
        if (driveData.quota) {
          accountInfo.spaceUsed = driveData.quota.used || 0;
          accountInfo.spaceTotal = driveData.quota.total || 0;
        }
      }
    } catch (error) {
      // Drive access failed, but basic auth might still work
      permissions.canWrite = false;
      permissions.canShare = false;
    }

    // Step 5: Test folder template if provided
    if (folderTemplate) {
      try {
        const ad = await getAdapter(provider);
        await ad.ensureRoot(folderTemplate);
      } catch (error) {
        return { 
          provider, 
          connected: true, 
          verified: false, 
          message: `Folder template test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          accountInfo,
          permissions 
        };
      }
    }

    // All tests passed
    const message = permissions.canWrite 
      ? "Connected and verified with full access" 
      : "Connected with read-only access";

    return { 
      provider, 
      connected: true, 
      verified: true, 
      message,
      lastVerified: Date.now(),
      accountInfo,
      permissions 
    };

  } catch (error) {
    return { 
      provider, 
      connected: false, 
      verified: false, 
      message: `OneDrive verification failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

async function verifyDropboxProvider(folderTemplate?: string | null): Promise<VerifyResult> {
  const provider: StorageProvider = "dropbox";

  // Check if we're in demo mode (explicitly set, not auto-demo)
  const config = validateDropboxConfig();
  if (config.isDemoMode && !config.isRealMode) {
    // Return demo verification result only for explicit demo mode
    return {
      provider,
      connected: true,
      verified: true,
      message: "Demo mode - simulated connection successful",
      lastVerified: Date.now(),
      accountInfo: {
        email: "demo@example.com",
        name: "Demo User",
        accountType: "basic",
        spaceUsed: 1024 * 1024 * 1024 * 2.5, // 2.5 GB
        spaceTotal: 1024 * 1024 * 1024 * 15, // 15 GB
      },
      permissions: {
        canRead: true,
        canWrite: true,
        canShare: true,
      }
    };
  }
  
  // For real mode, require proper setup unless we already have a saved token
  // This allows manual token flows to work even if App Key/OAuth is not configured
  try {
    // Step 1: Check if we have auth token
    let auth = await getAuth(provider);

    // If no auth is present and OAuth is not ready, block with setup guidance
    if (!auth?.accessToken && config.isRealMode && !config.canProceedWithOAuth) {
      return {
        provider,
        connected: false,
        verified: false,
        message: "Dropbox setup required. Please configure your App Key in the .env file or use manual token entry."
      };
    }
    if (!auth?.accessToken) {
      return { 
        provider, 
        connected: false, 
        verified: false, 
        message: "Not connected to Dropbox. Please connect your account first." 
      };
    }

    // Step 2: Check if token is expired and refresh if needed
    if (auth.expiresAt && auth.expiresAt < Date.now() + 60000) { // Refresh if expires within 1 minute
      try {
        const refreshedAuth = await refreshAuth(provider);
        if (refreshedAuth) {
          auth = refreshedAuth;
        }
      } catch (refreshError) {
        return { 
          provider, 
          connected: true, 
          verified: false, 
          message: "Token expired and refresh failed. Please reconnect your account." 
        };
      }
    }

    // Step 3: Validate token by fetching account info
    let accountInfo: any = {};
    let permissions = { canRead: false, canWrite: false, canShare: false };
    
    try {
      const accountResp = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${auth.accessToken}`, 
          "Content-Type": "application/json" 
        },
      });

      if (!accountResp.ok) {
        const errorData = await accountResp.json().catch(() => ({}));
        const dropboxError = DropboxErrorHandler.categorizeError({ 
          status: accountResp.status, 
          data: errorData 
        });
        return { 
          provider, 
          connected: true, 
          verified: false, 
          message: dropboxError.userMessage 
        };
      }

      const accountData = await accountResp.json();
      accountInfo = {
        email: accountData.email,
        name: accountData.name?.display_name,
        accountType: accountData.account_type?.['.tag'],
      };

      // Basic permissions check - if we can get account info, we have read access
      permissions.canRead = true;

    } catch (error) {
      const dropboxError = DropboxErrorHandler.categorizeError(error);
      return { 
        provider, 
        connected: true, 
        verified: false, 
        message: dropboxError.userMessage 
      };
    }

    // Step 4: Test write permissions by creating and deleting a test folder
    try {
      const testFolderName = `/test_write_${Date.now()}`;
      
      // Try to create test folder
      const createResp = await fetch("https://api.dropboxapi.com/2/files/create_folder_v2", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${auth.accessToken}`, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          path: testFolderName,
          autorename: false,
        }),
      });

      if (createResp.ok) {
        permissions.canWrite = true;
        
        // Clean up test folder
        try {
          await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
            method: "POST",
            headers: { 
              Authorization: `Bearer ${auth.accessToken}`, 
              "Content-Type": "application/json" 
            },
            body: JSON.stringify({ path: testFolderName }),
          });
        } catch {
          // Ignore cleanup errors
        }
      } else {
        const errorData = await createResp.json().catch(() => ({}));
        if (createResp.status === 403) {
          permissions.canWrite = false;
        } else {
          // Other errors might indicate connection issues
          const dropboxError = DropboxErrorHandler.categorizeError({ 
            status: createResp.status, 
            data: errorData 
          });
          return { 
            provider, 
            connected: true, 
            verified: false, 
            message: `Write test failed: ${dropboxError.userMessage}` 
          };
        }
      }
    } catch (error) {
      // Write test failed, but connection might still be valid for read-only
      permissions.canWrite = false;
    }

    // Step 5: Test sharing permissions
    try {
      // We can't easily test sharing without creating a file, so we'll check scopes
      const scopes = auth.scopes || [];
      permissions.canShare = scopes.includes('sharing.read') && scopes.includes('sharing.write');
    } catch {
      permissions.canShare = false;
    }

    // Step 6: Get space usage info
    try {
      const spaceResp = await fetch("https://api.dropboxapi.com/2/users/get_space_usage", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${auth.accessToken}`, 
          "Content-Type": "application/json" 
        },
      });

      if (spaceResp.ok) {
        const spaceData = await spaceResp.json();
        accountInfo.spaceUsed = spaceData.used;
        accountInfo.spaceTotal = spaceData.allocation?.allocated;
      }
    } catch {
      // Space info is optional
    }

    // Step 7: Test folder template if provided
    if (folderTemplate) {
      try {
        const ad = await getAdapter(provider);
        await ad.ensureRoot(folderTemplate);
      } catch (error) {
        const dropboxError = DropboxErrorHandler.categorizeError(error);
        return { 
          provider, 
          connected: true, 
          verified: false, 
          message: `Folder template test failed: ${dropboxError.userMessage}`,
          accountInfo,
          permissions 
        };
      }
    }

    // All tests passed
    const message = permissions.canWrite 
      ? "Connected and verified with full access" 
      : "Connected with read-only access (write permissions limited)";

    return { 
      provider, 
      connected: true, 
      verified: true, 
      message,
      lastVerified: Date.now(),
      accountInfo,
      permissions 
    };

  } catch (error) {
    const dropboxError = DropboxErrorHandler.categorizeError(error);
    return { 
      provider, 
      connected: false, 
      verified: false, 
      message: dropboxError.userMessage 
    };
  }
}
