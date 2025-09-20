/**
 * Dropbox configuration validation and utilities
 */

export type DropboxConfigStatus = {
  isConfigured: boolean;
  isRealMode: boolean;
  isDemoMode: boolean;
  clientId: string | null;
  redirectUri: string | null;
  issues: string[];
  recommendations: string[];
  setupRequired: boolean;
  canProceedWithOAuth: boolean;
};

/**
 * Validates the current Dropbox configuration
 */
export function validateDropboxConfig(): DropboxConfigStatus {
  const isRealMode = process.env.EXPO_PUBLIC_STORAGE_DROPBOX_REAL === "1";
  const isDemoMode = process.env.EXPO_PUBLIC_STORAGE_DROPBOX_REAL === "0";
  const clientId = process.env.EXPO_PUBLIC_DROPBOX_CLIENT_ID || null;
  const redirectUri = process.env.EXPO_PUBLIC_DROPBOX_REDIRECT_URI || null;
  
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Check if real mode is enabled but not properly configured
  if (isRealMode) {
    if (!clientId || clientId === "your_dropbox_app_key_here") {
      issues.push("Dropbox Client ID is not configured");
      recommendations.push("Set EXPO_PUBLIC_DROPBOX_CLIENT_ID to your actual Dropbox App Key");
    } else if (clientId.length < 10) {
      issues.push("Dropbox Client ID appears to be invalid (too short)");
      recommendations.push("Verify your Client ID from the Dropbox App Console");
    } else if (clientId.includes(" ") || clientId.includes("\n")) {
      issues.push("Dropbox Client ID contains invalid characters");
      recommendations.push("Remove any spaces or line breaks from your Client ID");
    }
  }
  
  // Check if neither real nor demo mode is explicitly set
  if (!isRealMode && !isDemoMode) {
    issues.push("Dropbox mode is not configured");
    recommendations.push("Set EXPO_PUBLIC_STORAGE_DROPBOX_REAL to either '1' (real) or '0' (demo)");
  }
  
  // Recommendations for better setup
  if (isRealMode && issues.length === 0) {
    if (!redirectUri) {
      recommendations.push("Consider setting a custom redirect URI for production use");
    }
    recommendations.push("Test your configuration using the 'Test Configuration' button");
  }
  
  if (isDemoMode) {
    recommendations.push("Switch to real mode when ready: set EXPO_PUBLIC_STORAGE_DROPBOX_REAL=1");
  }
  
  // Check if we have placeholder credentials
  const hasPlaceholderCredentials = !clientId || clientId === "your_dropbox_app_key_here";
  const setupRequired = isRealMode && hasPlaceholderCredentials;
  const canProceedWithOAuth = isRealMode && !hasPlaceholderCredentials && issues.length === 0;
  
  // Real mode requires valid credentials, demo mode works as-is
  const isConfigured = isDemoMode || (isRealMode && !hasPlaceholderCredentials && issues.length === 0);
  
  // Add setup guidance for real mode with placeholder credentials
  if (isRealMode && hasPlaceholderCredentials) {
    issues.push("Dropbox App Key is required for real integration");
    recommendations.push("🔧 Set up your Dropbox app to enable real integration");
    recommendations.push("📋 Follow the setup wizard or see DROPBOX_SETUP.md");
  }
  
  return {
    isConfigured,
    isRealMode,
    isDemoMode,
    clientId,
    redirectUri,
    issues,
    recommendations,
    setupRequired,
    canProceedWithOAuth
  };
}

/**
 * Gets user-friendly error messages for common Dropbox API errors
 */
export function getDropboxErrorMessage(error: string): { title: string; message: string; action?: string } {
  const lowerError = error.toLowerCase();
  
  // OAuth Authorization Errors
  if (lowerError.includes("access_denied")) {
    return {
      title: "Access Denied",
      message: "You denied permission to access your Dropbox account. The app needs access to upload files.",
      action: "Try connecting again and click 'Allow' when prompted by Dropbox"
    };
  }
  
  if (lowerError.includes("redirect_uri_mismatch")) {
    return {
      title: "Redirect URI Mismatch", 
      message: "The redirect URI doesn't match what's configured in your Dropbox app.",
      action: "Add your redirect URI to your Dropbox app settings"
    };
  }
  
  if (lowerError.includes("insufficient_scope") || lowerError.includes("insufficient permissions")) {
    return {
      title: "Insufficient Permissions",
      message: "Your Dropbox app doesn't have the required permissions.",
      action: "Enable required scopes in your Dropbox app's Permissions tab"
    };
  }
  
  if (lowerError.includes("invalid_grant") || lowerError.includes("authorization code")) {
    return {
      title: "Authorization Code Error",
      message: "The authorization code is invalid or has expired.",
      action: "Try connecting again - authorization codes expire quickly"
    };
  }
  
  if (lowerError.includes("token validation failed") || lowerError.includes("invalid token")) {
    return {
      title: "Token Validation Failed",
      message: "The access token is invalid or has expired.",
      action: "Try disconnecting and reconnecting your Dropbox account"
    };
  }
  
  if (lowerError.includes("authentication was cancelled") || lowerError.includes("user cancelled")) {
    return {
      title: "Authentication Cancelled",
      message: "The authentication process was cancelled.",
      action: "Try connecting again and complete the authorization process"
    };
  }
  
  if (lowerError.includes("failed to start") || lowerError.includes("browser")) {
    return {
      title: "Browser Error",
      message: "Unable to open the authentication browser.",
      action: "Ensure you have a web browser available and try again"
    };
  }
  
  if (lowerError.includes("network") || lowerError.includes("connection")) {
    return {
      title: "Network Error",
      message: "Unable to connect to Dropbox. Please check your internet connection.",
      action: "Check your network connection and try again"
    };
  }
  
  return {
    title: "Connection Error",
    message: error,
    action: "Check the setup guide for troubleshooting steps"
  };
}

/**
 * Diagnoses OAuth connection failures and provides specific guidance
 */
export function diagnoseOAuthFailure(error: string): {
  diagnosis: string;
  likelyCauses: string[];
  solutions: string[];
  priority: "high" | "medium" | "low";
} {
  const lowerError = error.toLowerCase();
  
  // High priority issues that block OAuth entirely
  if (lowerError.includes("invalid client_id") || lowerError.includes("invalid_client")) {
    return {
      diagnosis: "App Key Configuration Issue",
      likelyCauses: [
        "App Key is incorrect or malformed",
        "Using App Secret instead of App Key",
        "App Key contains extra spaces or characters",
        "App Key is from a different Dropbox app"
      ],
      solutions: [
        "Double-check your App Key in the Dropbox App Console",
        "Ensure you're copying the 'App key' field, not 'App secret'",
        "Remove any spaces or line breaks from the App Key",
        "Verify the App Key belongs to the correct Dropbox app"
      ],
      priority: "high"
    };
  }
  
  if (lowerError.includes("redirect_uri_mismatch")) {
    return {
      diagnosis: "Redirect URI Configuration Issue",
      likelyCauses: [
        "Redirect URI not added to Dropbox app settings",
        "Redirect URI format doesn't match exactly",
        "Using localhost but app expects specific IP",
        "Development vs production URI mismatch"
      ],
      solutions: [
        "Add the exact redirect URI to your Dropbox app's OAuth settings",
        "Include both localhost and 127.0.0.1 variants for development",
        "Add your local network IP for testing on other devices",
        "Ensure URI format matches exactly (including port numbers)"
      ],
      priority: "high"
    };
  }
  
  if (lowerError.includes("access_denied")) {
    return {
      diagnosis: "User Permission Issue",
      likelyCauses: [
        "User clicked 'Deny' during authorization",
        "User closed the browser before completing auth",
        "Dropbox account has restrictions",
        "App permissions are too broad"
      ],
      solutions: [
        "Try connecting again and click 'Allow' when prompted",
        "Complete the entire authorization process in the browser",
        "Check if your Dropbox account has any restrictions",
        "Review the permissions your app is requesting"
      ],
      priority: "medium"
    };
  }
  
  if (lowerError.includes("network") || lowerError.includes("connection")) {
    return {
      diagnosis: "Network Connectivity Issue",
      likelyCauses: [
        "No internet connection",
        "Firewall blocking requests",
        "Dropbox API temporarily unavailable",
        "DNS resolution issues"
      ],
      solutions: [
        "Check your internet connection",
        "Try connecting from a different network",
        "Wait a few minutes and try again",
        "Check Dropbox's status page for service issues"
      ],
      priority: "medium"
    };
  }
  
  // Medium priority issues
  if (lowerError.includes("insufficient_scope") || lowerError.includes("permissions")) {
    return {
      diagnosis: "App Permissions Issue",
      likelyCauses: [
        "Required scopes not enabled in Dropbox app",
        "App created with wrong permission level",
        "Scopes changed after app creation",
        "App type doesn't support required permissions"
      ],
      solutions: [
        "Enable all required scopes in your Dropbox app's Permissions tab",
        "Ensure your app has 'Full Dropbox' access",
        "Recreate the app if permission level can't be changed",
        "Verify app type supports file operations"
      ],
      priority: "high"
    };
  }
  
  // Low priority or generic issues
  return {
    diagnosis: "General OAuth Issue",
    likelyCauses: [
      "Temporary service issue",
      "Configuration mismatch",
      "Browser compatibility issue",
      "Timing or race condition"
    ],
    solutions: [
      "Try connecting again after a few minutes",
      "Clear app data and reconfigure",
      "Try using a different browser or device",
      "Check the troubleshooting guide for more solutions"
    ],
    priority: "low"
  };
}



/**
 * Generates helpful setup instructions based on current configuration
 */
export function getSetupInstructions(config: DropboxConfigStatus): string[] {
  const instructions: string[] = [];
  
  if (!config.isConfigured) {
    instructions.push("📋 Follow the setup guide in DROPBOX_SETUP.md");
    instructions.push("🌐 Create a Dropbox app at https://www.dropbox.com/developers/apps");
    instructions.push("🔑 Copy your App Key to the .env file");
    instructions.push("⚙️ Configure the required permissions and redirect URIs");
  }
  
  if (config.isDemoMode) {
    instructions.push("🧪 Demo mode is active - no real files will be uploaded");
    instructions.push("🔄 Set EXPO_PUBLIC_STORAGE_DROPBOX_REAL=1 to enable real integration");
  }
  
  if (config.isRealMode && config.isConfigured) {
    instructions.push("✅ Configuration looks good!");
    instructions.push("🧪 Use 'Test Configuration' to verify your setup");
  }
  
  return instructions;
}