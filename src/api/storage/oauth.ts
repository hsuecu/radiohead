// AuthSession import removed - using redirect URI helper instead
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import type { StorageProvider, StorageAuth } from "../../types/storage";
import { validateDropboxConfig, getDropboxErrorMessage } from "../../utils/dropboxConfig";
import { getEffectiveClientId } from "../../utils/configurationManager";
import { getRedirectUriInfo, checkRedirectUriCompatibility } from "../../utils/redirectUriHelper";

const KEY_PREFIX = "stor-auth-";

export async function getAuth(provider: StorageProvider): Promise<StorageAuth | null> {
  const raw = await SecureStore.getItemAsync(KEY_PREFIX + provider);
  if (!raw) return null;
  try { return JSON.parse(raw) as StorageAuth; } catch { return null; }
}

export async function setAuth(auth: StorageAuth): Promise<void> {
  await SecureStore.setItemAsync(KEY_PREFIX + auth.provider, JSON.stringify(auth));
}

export async function clearAuth(provider: StorageProvider): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PREFIX + provider);
}

async function pkcePair() {
  const verifier = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
  const challenge = digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return { verifier, challenge };
}

export async function refreshAuth(provider: StorageProvider): Promise<StorageAuth | null> {
  const auth = await getAuth(provider);
  if (!auth?.refreshToken) return auth ?? null;

  if (provider === "dropbox") {
    return refreshDropboxAuth(auth);
  } else if (provider === "gdrive") {
    return refreshGoogleDriveAuth(auth);
  } else if (provider === "onedrive") {
    return refreshOneDriveAuth(auth);
  } else {
    return auth ?? null;
  }
}

async function refreshDropboxAuth(auth: StorageAuth): Promise<StorageAuth | null> {
  const clientId = await getEffectiveClientId();
  if (!clientId) return auth ?? null;
  try {
    const params = new URLSearchParams();
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", auth.refreshToken!);
    params.set("client_id", clientId);
    const resp = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!resp.ok) return auth;
    const data: any = await resp.json();
    const updated: StorageAuth = {
      ...auth,
      accessToken: data.access_token || auth.accessToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : auth.expiresAt ?? null,
      scopes: auth.scopes,
    };
    await setAuth(updated);
    return updated;
  } catch {
    return auth ?? null;
  }
}

async function refreshGoogleDriveAuth(auth: StorageAuth): Promise<StorageAuth | null> {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
  if (!clientId) return auth ?? null;
  
  try {
    const params = new URLSearchParams();
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", auth.refreshToken!);
    params.set("client_id", clientId);
    
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    
    if (!resp.ok) return auth;
    const data: any = await resp.json();
    
    const updated: StorageAuth = {
      ...auth,
      accessToken: data.access_token || auth.accessToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : auth.expiresAt ?? null,
      scopes: auth.scopes,
    };
    
    await setAuth(updated);
    return updated;
  } catch {
    return auth ?? null;
  }
}

async function refreshOneDriveAuth(auth: StorageAuth): Promise<StorageAuth | null> {
  const clientId = process.env.EXPO_PUBLIC_ONEDRIVE_CLIENT_ID;
  if (!clientId) return auth ?? null;
  
  try {
    const params = new URLSearchParams();
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", auth.refreshToken!);
    params.set("client_id", clientId);
    
    const resp = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    
    if (!resp.ok) return auth;
    const data: any = await resp.json();
    
    const updated: StorageAuth = {
      ...auth,
      accessToken: data.access_token || auth.accessToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : auth.expiresAt ?? null,
      scopes: auth.scopes,
    };
    
    await setAuth(updated);
    return updated;
  } catch {
    return auth ?? null;
  }
}

async function createDemoAuth(): Promise<StorageAuth> {
  // Create a demo auth token for testing UI without real Dropbox
  const demoAuth: StorageAuth = {
    provider: "dropbox",
    accessToken: "demo_access_token_" + Date.now(),
    refreshToken: "demo_refresh_token_" + Date.now(),
    expiresAt: Date.now() + 3600_000, // 1 hour from now
    scopes: ["files.content.read", "files.content.write", "files.metadata.read", "sharing.read", "sharing.write"],
    accountEmail: "demo@example.com",
    accountName: "Demo User",
  };
  
  await setAuth(demoAuth);
  return demoAuth;
}

export async function startAuth(provider: StorageProvider): Promise<StorageAuth | null> {
  if (provider === "dropbox") {
    return startDropboxAuth();
  } else if (provider === "gdrive") {
    return startGoogleDriveAuth();
  } else if (provider === "onedrive") {
    return startOneDriveAuth();
  } else {
    throw new Error(`Authentication not implemented for provider: ${provider}`);
  }
}

async function startGoogleDriveAuth(): Promise<StorageAuth | null> {
  console.log("=== Starting Google Drive Authentication ===");
  
  // Enhanced environment variable validation
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
  console.log("Environment check - Client ID present:", !!clientId);
  console.log("Environment check - Client ID value:", clientId ? `${clientId.substring(0, 12)}...` : "MISSING");
  
  if (!clientId) {
    const errorMsg = "Google Drive Client ID not found in environment variables. Please set EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID in your .env file.";
    console.error("❌ Configuration Error:", errorMsg);
    throw new Error(errorMsg);
  }
  
  if (clientId === "your_google_client_id_here") {
    const errorMsg = "Google Drive Client ID is still set to placeholder value. Please replace 'your_google_client_id_here' with your actual Google Client ID in the .env file.";
    console.error("❌ Configuration Error:", errorMsg);
    throw new Error(errorMsg);
  }

  if (clientId.length < 20) {
    const errorMsg = "Google Drive Client ID appears to be invalid (too short). Please check your Client ID in the .env file.";
    console.error("❌ Configuration Error:", errorMsg);
    throw new Error(errorMsg);
  }

  try {
    console.log("✅ Configuration validated, starting OAuth flow...");
    console.log("Development mode:", __DEV__);
    console.log("Platform:", require("react-native").Platform.OS);
    
    const { verifier, challenge } = await pkcePair();
    const scope = "https://www.googleapis.com/auth/drive.file";
    
    // Generate dynamic redirect URI for better Expo compatibility
    let redirectUri = "exp://localhost:8081/--/auth/google";
    try {
      // Try to use Linking.createURL for better compatibility
      const dynamicUri = Linking.createURL("auth/google");
      if (dynamicUri && dynamicUri !== "exp://") {
        redirectUri = dynamicUri;
        console.log("Using dynamic redirect URI:", redirectUri);
      }
    } catch (err) {
      console.log("Using fallback redirect URI:", redirectUri);
    }
    
    // Generate state for security
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&code_challenge=${challenge}&code_challenge_method=S256&state=${encodeURIComponent(state)}&access_type=offline&prompt=consent`;

    console.log("=== Google Drive OAuth Debug Info ===");
    console.log("Client ID:", clientId ? `${clientId.substring(0, 12)}...` : "MISSING");
    console.log("Redirect URI:", redirectUri);
    console.log("Scope:", scope);
    console.log("Auth URL:", authUrl.substring(0, 100) + "...");
    
    // Open browser for auth
    const WebBrowser = await import("expo-web-browser");
    console.log("🌐 Opening browser for Google OAuth...");
    console.log("📱 WebBrowser module loaded successfully");
    
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    
    console.log("📋 Browser result type:", result?.type || "null");
    console.log("📋 Browser result details:", JSON.stringify(result, null, 2));
    
    if (!result || result.type === "cancel" || result.type === "dismiss") {
      throw new Error("Authentication was cancelled by user.");
    }
    
    if (result.type !== "success") {
      throw new Error(`Authentication failed with result type: ${result.type}`);
    }

    // Type guard to ensure we have a redirect result with URL
    if (!("url" in result) || !result.url) {
      throw new Error("No redirect URL received from authentication");
    }

    const urlObj = new URL(result.url);
    const code = urlObj.searchParams.get("code");
    const error = urlObj.searchParams.get("error");
    const returnedState = urlObj.searchParams.get("state");
    
    if (returnedState !== state) {
      throw new Error("OAuth state mismatch - possible security issue.");
    }
    
    if (error) {
      const errorDescription = urlObj.searchParams.get("error_description") || error;
      throw new Error(`Google authentication error: ${errorDescription}`);
    }
    
    if (!code) {
      throw new Error("No authorization code received from Google");
    }
    
    console.log("Google OAuth: Authorization code received, exchanging for tokens");

    // Exchange code for tokens
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("client_id", clientId);
    body.set("redirect_uri", redirectUri);
    body.set("code_verifier", verifier);

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!tokenResp.ok) {
      const errorData = await tokenResp.json().catch(() => ({}));
      const errorMsg = errorData.error_description || errorData.error || `HTTP ${tokenResp.status}`;
      throw new Error(`Google token exchange failed: ${errorMsg}`);
    }

    const tokenJson: any = await tokenResp.json();

    if (!tokenJson.access_token) {
      throw new Error("No access token received from Google");
    }

    console.log("Google OAuth: Validating token and fetching user info");
    
    // Fetch user info to validate token
    let accountEmail: string | null = null;
    let accountName: string | null = null;
    
    try {
      const userResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { 
          Authorization: `Bearer ${tokenJson.access_token}` 
        },
      });
      
      if (userResp.ok) {
        const userJson: any = await userResp.json();
        accountEmail = userJson?.email || null;
        accountName = userJson?.name || null;
        console.log("Google OAuth: User info validated successfully");
      } else {
        console.warn("Failed to fetch Google user info, but token is valid");
      }
    } catch (err) {
      console.warn("Failed to fetch Google user info:", err);
    }

    const auth: StorageAuth = {
      provider: "gdrive",
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token || null,
      expiresAt: tokenJson.expires_in ? Date.now() + tokenJson.expires_in * 1000 : null,
      scopes: [scope],
      accountEmail,
      accountName,
    };
    
    await setAuth(auth);
    return auth;
    
  } catch (error) {
    console.error("❌ Google Drive authentication failed:", error);
    if (error instanceof Error) {
      // Enhance error messages with troubleshooting tips
      if (error.message.includes("cancelled")) {
        throw new Error("Google Drive authentication was cancelled. Please try again and complete the authorization in the browser window.");
      } else if (error.message.includes("blocked")) {
        throw new Error("Browser popup was blocked. Please allow popups for this app and try again.");
      } else if (error.message.includes("network") || error.message.includes("fetch")) {
        throw new Error("Network error during Google Drive authentication. Please check your internet connection and try again.");
      } else {
        throw new Error(`Google Drive authentication failed: ${error.message}`);
      }
    }
    throw new Error("An unexpected error occurred during Google Drive authentication");
  }
}

async function startOneDriveAuth(): Promise<StorageAuth | null> {
  console.log("=== Starting OneDrive Authentication ===");
  
  // Enhanced environment variable validation
  const clientId = process.env.EXPO_PUBLIC_ONEDRIVE_CLIENT_ID;
  console.log("Environment check - Client ID present:", !!clientId);
  console.log("Environment check - Client ID value:", clientId ? `${clientId.substring(0, 12)}...` : "MISSING");
  
  if (!clientId) {
    const errorMsg = "OneDrive Client ID not found in environment variables. Please set EXPO_PUBLIC_ONEDRIVE_CLIENT_ID in your .env file.";
    console.error("❌ Configuration Error:", errorMsg);
    throw new Error(errorMsg);
  }
  
  if (clientId === "your_onedrive_client_id_here") {
    const errorMsg = "OneDrive Client ID is still set to placeholder value. Please replace 'your_onedrive_client_id_here' with your actual OneDrive Client ID in the .env file.";
    console.error("❌ Configuration Error:", errorMsg);
    throw new Error(errorMsg);
  }

  if (clientId.length < 20) {
    const errorMsg = "OneDrive Client ID appears to be invalid (too short). Please check your Client ID in the .env file.";
    console.error("❌ Configuration Error:", errorMsg);
    throw new Error(errorMsg);
  }

  try {
    console.log("✅ Configuration validated, starting OAuth flow...");
    console.log("Development mode:", __DEV__);
    console.log("Platform:", require("react-native").Platform.OS);
    
    const { verifier, challenge } = await pkcePair();
    const scope = "files.readwrite offline_access";
    
    // Generate dynamic redirect URI for better Expo compatibility
    let redirectUri = "exp://localhost:8081/--/auth/onedrive";
    try {
      // Try to use Linking.createURL for better compatibility
      const dynamicUri = Linking.createURL("auth/onedrive");
      if (dynamicUri && dynamicUri !== "exp://") {
        redirectUri = dynamicUri;
        console.log("Using dynamic redirect URI:", redirectUri);
      }
    } catch (err) {
      console.log("Using fallback redirect URI:", redirectUri);
    }
    
    // Generate state for security
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&code_challenge=${challenge}&code_challenge_method=S256&state=${encodeURIComponent(state)}`;

    console.log("=== OneDrive OAuth Debug Info ===");
    console.log("Client ID:", clientId ? `${clientId.substring(0, 12)}...` : "MISSING");
    console.log("Redirect URI:", redirectUri);
    console.log("Scope:", scope);
    console.log("Auth URL:", authUrl.substring(0, 100) + "...");
    
    // Open browser for auth
    const WebBrowser = await import("expo-web-browser");
    console.log("🌐 Opening browser for OneDrive OAuth...");
    console.log("📱 WebBrowser module loaded successfully");
    
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    
    console.log("📋 Browser result type:", result?.type || "null");
    console.log("📋 Browser result details:", JSON.stringify(result, null, 2));
    
    if (!result || result.type === "cancel" || result.type === "dismiss") {
      throw new Error("Authentication was cancelled by user.");
    }
    
    if (result.type !== "success") {
      throw new Error(`Authentication failed with result type: ${result.type}`);
    }

    // Type guard to ensure we have a redirect result with URL
    if (!("url" in result) || !result.url) {
      throw new Error("No redirect URL received from authentication");
    }

    const urlObj = new URL(result.url);
    const code = urlObj.searchParams.get("code");
    const error = urlObj.searchParams.get("error");
    const returnedState = urlObj.searchParams.get("state");
    
    if (returnedState !== state) {
      throw new Error("OAuth state mismatch - possible security issue.");
    }
    
    if (error) {
      const errorDescription = urlObj.searchParams.get("error_description") || error;
      throw new Error(`OneDrive authentication error: ${errorDescription}`);
    }
    
    if (!code) {
      throw new Error("No authorization code received from OneDrive");
    }
    
    console.log("OneDrive OAuth: Authorization code received, exchanging for tokens");

    // Exchange code for tokens
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("client_id", clientId);
    body.set("redirect_uri", redirectUri);
    body.set("code_verifier", verifier);

    const tokenResp = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!tokenResp.ok) {
      const errorData = await tokenResp.json().catch(() => ({}));
      const errorMsg = errorData.error_description || errorData.error || `HTTP ${tokenResp.status}`;
      throw new Error(`OneDrive token exchange failed: ${errorMsg}`);
    }

    const tokenJson: any = await tokenResp.json();

    if (!tokenJson.access_token) {
      throw new Error("No access token received from OneDrive");
    }

    console.log("OneDrive OAuth: Validating token and fetching user info");
    
    // Fetch user info to validate token
    let accountEmail: string | null = null;
    let accountName: string | null = null;
    
    try {
      const userResp = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { 
          Authorization: `Bearer ${tokenJson.access_token}` 
        },
      });
      
      if (userResp.ok) {
        const userJson: any = await userResp.json();
        accountEmail = userJson?.mail || userJson?.userPrincipalName || null;
        accountName = userJson?.displayName || null;
        console.log("OneDrive OAuth: User info validated successfully");
      } else {
        console.warn("Failed to fetch OneDrive user info, but token is valid");
      }
    } catch (err) {
      console.warn("Failed to fetch OneDrive user info:", err);
    }

    const auth: StorageAuth = {
      provider: "onedrive",
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token || null,
      expiresAt: tokenJson.expires_in ? Date.now() + tokenJson.expires_in * 1000 : null,
      scopes: scope.split(" "),
      accountEmail,
      accountName,
    };
    
    await setAuth(auth);
    return auth;
    
  } catch (error) {
    console.error("❌ OneDrive authentication failed:", error);
    if (error instanceof Error) {
      // Enhance error messages with troubleshooting tips
      if (error.message.includes("cancelled")) {
        throw new Error("OneDrive authentication was cancelled. Please try again and complete the authorization in the browser window.");
      } else if (error.message.includes("blocked")) {
        throw new Error("Browser popup was blocked. Please allow popups for this app and try again.");
      } else if (error.message.includes("network") || error.message.includes("fetch")) {
        throw new Error("Network error during OneDrive authentication. Please check your internet connection and try again.");
      } else {
        throw new Error(`OneDrive authentication failed: ${error.message}`);
      }
    }
    throw new Error("An unexpected error occurred during OneDrive authentication");
  }
}

async function startDropboxAuth(): Promise<StorageAuth | null> {

  // Validate configuration before attempting OAuth
  const config = validateDropboxConfig();
  
  if (!config.isRealMode) {
    if (config.isDemoMode) {
      // Return demo auth for testing UI
      return await createDemoAuth();
    }
    throw new Error("Dropbox integration is not configured. Set EXPO_PUBLIC_STORAGE_DROPBOX_REAL=1 to enable real mode or EXPO_PUBLIC_STORAGE_DROPBOX_REAL=0 for demo mode.");
  }
  
  if (!config.canProceedWithOAuth) {
    const issuesList = config.issues.join('\n• ');
    // Continue to allow OAuth if a valid clientId is present in secure config
    const effectiveId = await getEffectiveClientId();
    if (!effectiveId) {
      throw new Error(`Dropbox setup required:\n• ${issuesList}\n\nTo set up Dropbox integration:\n1. Go to https://www.dropbox.com/developers/apps\n2. Create a new app with 'Scoped access' and 'Full Dropbox'\n3. Copy your App Key and set it via the in-app wizard`);
    }
  }

  const clientId = await getEffectiveClientId();

  // Critical validation: Ensure we have a valid App Key before proceeding
  if (!clientId) {
    throw new Error("Dropbox App Key not configured. Please complete the setup wizard first to configure your Dropbox integration.");
  }

  // Check for placeholder values that indicate incomplete setup
  if (clientId === "your_dropbox_app_key_here" || clientId.includes("placeholder") || clientId.includes("your_")) {
    throw new Error("Dropbox App Key is still set to placeholder value. Please complete the setup wizard to configure your real Dropbox App Key.");
  }

  // Validate App Key format
  if (clientId.length < 10) {
    throw new Error("Invalid Dropbox App Key format. App Keys should be at least 10 characters long. Please check your configuration in the setup wizard.");
  }

  // Check for common App Key format issues
  if (clientId.includes(" ") || clientId.includes("\n") || clientId.includes("\t")) {
    throw new Error("Dropbox App Key contains invalid characters (spaces or line breaks). Please check your App Key in the setup wizard.");
  }

  try {
    // Get and validate redirect URI
    const redirectUriInfo = getRedirectUriInfo();
    const redirectUri = redirectUriInfo.uri;
    const redirectCompatibility = checkRedirectUriCompatibility();
    
    const { verifier, challenge } = await pkcePair();
    const scope = "files.content.read files.content.write files.metadata.read sharing.read sharing.write";
    
    // Add state parameter for security and flow tracking
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const authUrl = `https://www.dropbox.com/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&token_access_type=offline&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;

    console.log("=== Dropbox OAuth Debug Info ===");
    console.log("Client ID:", clientId ? `${clientId.substring(0, 8)}...` : "MISSING");
    console.log("Redirect URI:", redirectUri, `(${redirectUriInfo.source})`);
    console.log("Redirect URI valid:", redirectUriInfo.isValid);
    console.log("Redirect compatibility:", redirectCompatibility.compatible);
    console.log("Auth URL:", authUrl.substring(0, 100) + "...");
    console.log("Config validation passed:", config.canProceedWithOAuth);
    console.log("Real mode enabled:", config.isRealMode);
    console.log("App Key validation: PASSED");
    
    // Warn about redirect URI issues but don't block
    if (!redirectCompatibility.compatible) {
      console.warn("Redirect URI compatibility issues:", redirectCompatibility.issues);
      console.warn("Recommendations:", redirectCompatibility.recommendations);
    }
    
    // Warn about redirect URI issues but don't block
    if (!redirectCompatibility.compatible) {
      console.warn("Redirect URI compatibility issues:", redirectCompatibility.issues);
      console.warn("Recommendations:", redirectCompatibility.recommendations);
    }
    
    // Open browser for auth and capture redirect
    const WebBrowser = await import("expo-web-browser");
    console.log("🌐 Opening browser for Dropbox OAuth...");
    console.log("📱 WebBrowser module loaded successfully");
    
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    
    console.log("📋 Browser result type:", result?.type || "null");
    console.log("📋 Browser result details:", JSON.stringify(result, null, 2));
    
    if (!result) {
      throw new Error("Authentication was cancelled or failed to start. Please ensure you have a web browser available.");
    }
    
    if (result.type === "cancel") {
      throw new Error("Authentication was cancelled by user. Please try again and complete the authorization process.");
    }
    
    if (result.type === "dismiss") {
      throw new Error("Authentication window was dismissed. Please try again and complete the authorization process.");
    }
    
    if (result.type !== "success") {
      console.log("Unexpected result type:", result.type);
      throw new Error(`Authentication failed with result type: ${result.type}. Please try again.`);
    }

    // Type guard to ensure we have a redirect result with URL
    if (!("url" in result) || !result.url) {
      throw new Error("No redirect URL received from authentication");
    }

    const urlObj = new URL(result.url);
    const code = urlObj.searchParams.get("code");
    const error = urlObj.searchParams.get("error");
    const returnedState = urlObj.searchParams.get("state");
    
    // Validate state parameter for security
    if (returnedState !== state) {
      throw new Error("OAuth state mismatch - possible security issue. Please try again.");
    }
    
    if (error) {
      const errorDescription = urlObj.searchParams.get("error_description") || error;
      // Provide more specific error messages
      if (error === "access_denied") {
        throw new Error("Access denied: You need to grant permission to connect your Dropbox account.");
      } else if (error === "invalid_client") {
        throw new Error("Invalid App Key: Please check your EXPO_PUBLIC_DROPBOX_CLIENT_ID configuration.");
      } else if (error === "redirect_uri_mismatch") {
        throw new Error("Redirect URI mismatch: Please add your redirect URI to your Dropbox app settings.");
      } else {
        throw new Error(`Dropbox authentication error: ${errorDescription}`);
      }
    }
    
    if (!code) {
      throw new Error("No authorization code received from Dropbox");
    }
    
    console.log("Dropbox OAuth: Authorization code received, exchanging for tokens");

    // Exchange code for tokens
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("client_id", clientId);
    body.set("redirect_uri", redirectUri);
    body.set("code_verifier", verifier);

    const tokenResp = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!tokenResp.ok) {
      const errorData = await tokenResp.json().catch(() => ({}));
      const errorMsg = errorData.error_description || errorData.error || `HTTP ${tokenResp.status}`;
      
      // Provide specific guidance for common token exchange errors
      if (tokenResp.status === 400 && errorData.error === "invalid_client") {
        throw new Error("Invalid App Key: Please verify your EXPO_PUBLIC_DROPBOX_CLIENT_ID is correct.");
      } else if (tokenResp.status === 400 && errorData.error === "invalid_grant") {
        throw new Error("Authorization code expired or invalid. Please try connecting again.");
      } else if (tokenResp.status === 400 && errorData.error === "redirect_uri_mismatch") {
        throw new Error("Redirect URI mismatch: Ensure your Dropbox app has the correct redirect URIs configured.");
      } else {
        throw new Error(`Token exchange failed: ${errorMsg}`);
      }
    }

    const tokenJson: any = await tokenResp.json();

    if (!tokenJson.access_token) {
      throw new Error("No access token received from Dropbox");
    }

    console.log("Dropbox OAuth: Validating token and fetching account info");
    
    // Fetch account info to validate token and get user details
    let accountEmail: string | null = null;
    let accountName: string | null = null;
    
    try {
      const acc = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${tokenJson.access_token}`, 
          "Content-Type": "application/json" 
        },
      });
      
      if (acc.ok) {
        const accJson: any = await acc.json();
        accountEmail = accJson?.email || null;
        accountName = accJson?.name?.display_name || null;
        console.log("Dropbox OAuth: Account validated successfully");
      } else {
        // Token might be invalid
        const errorData = await acc.json().catch(() => ({}));
        if (acc.status === 401) {
          throw new Error("Token validation failed: The access token is invalid or expired.");
        } else if (acc.status === 403) {
          throw new Error("Insufficient permissions: Your Dropbox app may not have the required scopes.");
        } else {
          throw new Error(`Account validation failed: ${errorData.error_summary || `HTTP ${acc.status}`}`);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("Token validation failed")) {
        throw err; // Re-throw specific validation errors
      }
      throw new Error(`Failed to fetch account information: ${err instanceof Error ? err.message : 'Network error'}`);
    }

    const auth: StorageAuth = {
      provider: "dropbox",
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token || null,
      expiresAt: tokenJson.expires_in ? Date.now() + tokenJson.expires_in * 1000 : null,
      scopes: scope.split(" "),
      accountEmail,
      accountName,
    };
    
    await setAuth(auth);
    return auth;
    
  } catch (error) {
    // Re-throw with more context for common issues
    if (error instanceof Error) {
      const errorInfo = getDropboxErrorMessage(error.message);
      const enhancedMessage = `${errorInfo.title}: ${errorInfo.message}${errorInfo.action ? `\n\nAction needed: ${errorInfo.action}` : ''}`;
      throw new Error(enhancedMessage);
    }
    throw new Error("An unexpected error occurred during authentication");
  }
}
