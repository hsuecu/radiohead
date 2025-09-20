/**
 * Real-time Dropbox configuration validation utilities
 */

import { validateDropboxAppKey } from "./dropboxSetupHelper";
import { getEffectiveClientId } from "./configurationManager";

export type ValidationResult = {
  isValid: boolean;
  level: "success" | "warning" | "error" | "info";
  message: string;
  details?: string[];
  canProceed: boolean;
};

export type ConfigurationHealth = {
  overall: "healthy" | "warning" | "error" | "unconfigured";
  appKey: ValidationResult;
  mode: ValidationResult;
  redirectUris: ValidationResult;
  permissions: ValidationResult;
  canConnect: boolean;
  nextSteps: string[];
};

/**
 * Validates Dropbox App Key in real-time
 */
export function validateAppKeyRealTime(appKey: string): ValidationResult {
  if (!appKey || appKey.trim().length === 0) {
    return {
      isValid: false,
      level: "error",
      message: "App Key is required",
      details: ["Enter your Dropbox App Key to enable real integration"],
      canProceed: false
    };
  }
  
  const validation = validateDropboxAppKey(appKey);
  
  if (!validation.isValid) {
    return {
      isValid: false,
      level: "error",
      message: validation.issues[0] || "Invalid App Key",
      details: validation.suggestions,
      canProceed: false
    };
  }
  
  return {
    isValid: true,
    level: "success",
    message: "App Key format is valid",
    details: ["Ready for OAuth authentication"],
    canProceed: true
  };
}

/**
 * Validates effective App Key (from env or secure storage)
 */
export async function validateEffectiveAppKey(): Promise<ValidationResult> {
  try {
    const effectiveId = await getEffectiveClientId();
    
    if (!effectiveId) {
      return {
        isValid: false,
        level: "error",
        message: "No App Key configured",
        details: [
          "App Key not found in environment variables or secure storage",
          "Use the setup wizard to configure your Dropbox App Key"
        ],
        canProceed: false
      };
    }
    
    return validateAppKeyRealTime(effectiveId);
  } catch (error) {
    return {
      isValid: false,
      level: "error",
      message: "Failed to validate App Key",
      details: [
        error instanceof Error ? error.message : "Unknown error",
        "Try clearing app data and reconfiguring"
      ],
      canProceed: false
    };
  }
}

/**
 * Validates Dropbox integration mode
 */
export function validateModeConfiguration(): ValidationResult {
  const isRealMode = process.env.EXPO_PUBLIC_STORAGE_DROPBOX_REAL === "1";
  const isDemoMode = process.env.EXPO_PUBLIC_STORAGE_DROPBOX_REAL === "0";
  
  if (!isRealMode && !isDemoMode) {
    return {
      isValid: false,
      level: "error",
      message: "Integration mode not configured",
      details: ["Set EXPO_PUBLIC_STORAGE_DROPBOX_REAL to '1' for real mode or '0' for demo mode"],
      canProceed: false
    };
  }
  
  if (isDemoMode) {
    return {
      isValid: true,
      level: "info",
      message: "Demo mode active",
      details: ["No real files will be uploaded", "Switch to real mode when ready"],
      canProceed: true
    };
  }
  
  return {
    isValid: true,
    level: "success",
    message: "Real mode configured",
    details: ["Ready for live Dropbox integration"],
    canProceed: true
  };
}

/**
 * Validates redirect URI configuration
 */
export function validateRedirectUris(): ValidationResult {
  const customRedirectUri = process.env.EXPO_PUBLIC_DROPBOX_REDIRECT_URI;
  
  if (customRedirectUri) {
    if (!customRedirectUri.startsWith("exp://") && !customRedirectUri.startsWith("https://")) {
      return {
        isValid: false,
        level: "warning",
        message: "Custom redirect URI may be invalid",
        details: ["Redirect URIs should start with 'exp://' for development or 'https://' for production"],
        canProceed: true
      };
    }
    
    return {
      isValid: true,
      level: "success",
      message: "Custom redirect URI configured",
      details: [`Using: ${customRedirectUri}`],
      canProceed: true
    };
  }
  
  return {
    isValid: true,
    level: "info",
    message: "Using default redirect URIs",
    details: ["Expo will generate appropriate redirect URIs automatically"],
    canProceed: true
  };
}

/**
 * Validates expected Dropbox app permissions
 */
export function validateExpectedPermissions(): ValidationResult {
  const requiredScopes = [
    "files.content.read",
    "files.content.write", 
    "files.metadata.read",
    "sharing.read",
    "sharing.write"
  ];
  
  return {
    isValid: true,
    level: "info",
    message: "Required permissions",
    details: [
      "Ensure your Dropbox app has these scopes enabled:",
      ...requiredScopes.map(scope => `• ${scope}`)
    ],
    canProceed: true
  };
}

/**
 * Performs comprehensive configuration health check
 */
export async function checkConfigurationHealth(): Promise<ConfigurationHealth> {
  const appKey = process.env.EXPO_PUBLIC_DROPBOX_CLIENT_ID || "";
  const isRealMode = process.env.EXPO_PUBLIC_STORAGE_DROPBOX_REAL === "1";
  
  // Use effective app key validation for real mode
  const appKeyValidation = isRealMode ? 
    await validateEffectiveAppKey() : 
    validateAppKeyRealTime(appKey);
    
  const modeValidation = validateModeConfiguration();
  const redirectValidation = validateRedirectUris();
  const permissionsValidation = validateExpectedPermissions();
  
  // Determine overall health
  let overall: ConfigurationHealth["overall"] = "healthy";
  const nextSteps: string[] = [];
  
  if (!modeValidation.isValid) {
    overall = "error";
    nextSteps.push("Configure integration mode");
  } else if (isRealMode && !appKeyValidation.isValid) {
    overall = "error";
    nextSteps.push("Set up Dropbox App Key");
  } else if (isRealMode && appKeyValidation.level === "warning") {
    overall = "warning";
    nextSteps.push("Verify App Key configuration");
  } else if (!isRealMode) {
    overall = "unconfigured";
    nextSteps.push("Switch to real mode when ready");
  }
  
  const canConnect = modeValidation.canProceed && 
    (isRealMode ? appKeyValidation.canProceed : true);
  
  if (canConnect && isRealMode) {
    nextSteps.push("Test connection with Dropbox");
  }
  
  return {
    overall,
    appKey: appKeyValidation,
    mode: modeValidation,
    redirectUris: redirectValidation,
    permissions: permissionsValidation,
    canConnect,
    nextSteps
  };
}

/**
 * Synchronous version for immediate UI feedback
 */
export function checkConfigurationHealthSync(): ConfigurationHealth {
  const appKey = process.env.EXPO_PUBLIC_DROPBOX_CLIENT_ID || "";
  const isRealMode = process.env.EXPO_PUBLIC_STORAGE_DROPBOX_REAL === "1";
  
  const appKeyValidation = validateAppKeyRealTime(appKey);
  const modeValidation = validateModeConfiguration();
  const redirectValidation = validateRedirectUris();
  const permissionsValidation = validateExpectedPermissions();
  
  // Determine overall health
  let overall: ConfigurationHealth["overall"] = "healthy";
  const nextSteps: string[] = [];
  
  if (!modeValidation.isValid) {
    overall = "error";
    nextSteps.push("Configure integration mode");
  } else if (isRealMode && !appKeyValidation.isValid) {
    overall = "error";
    nextSteps.push("Set up Dropbox App Key");
  } else if (isRealMode && appKeyValidation.level === "warning") {
    overall = "warning";
    nextSteps.push("Verify App Key configuration");
  } else if (!isRealMode) {
    overall = "unconfigured";
    nextSteps.push("Switch to real mode when ready");
  }
  
  const canConnect = modeValidation.canProceed && 
    (isRealMode ? appKeyValidation.canProceed : true);
  
  if (canConnect && isRealMode) {
    nextSteps.push("Test connection with Dropbox");
  }
  
  return {
    overall,
    appKey: appKeyValidation,
    mode: modeValidation,
    redirectUris: redirectValidation,
    permissions: permissionsValidation,
    canConnect,
    nextSteps
  };
}

/**
 * Gets validation status color for UI
 */
export function getValidationColor(level: ValidationResult["level"]): string {
  switch (level) {
    case "success": return "#10B981"; // green
    case "warning": return "#F59E0B"; // yellow
    case "error": return "#EF4444"; // red
    case "info": return "#3B82F6"; // blue
    default: return "#6B7280"; // gray
  }
}

/**
 * Gets validation status icon for UI
 */
export function getValidationIcon(level: ValidationResult["level"]): string {
  switch (level) {
    case "success": return "checkmark-circle";
    case "warning": return "warning";
    case "error": return "alert-circle";
    case "info": return "information-circle";
    default: return "help-circle";
  }
}

/**
 * Formats validation message for display
 */
export function formatValidationMessage(result: ValidationResult): string {
  let message = result.message;
  
  if (result.details && result.details.length > 0) {
    message += "\n" + result.details.join("\n");
  }
  
  return message;
}

/**
 * Checks if configuration allows OAuth flow (async version with secure storage check)
 */
export async function canStartOAuthFlow(): Promise<{ canStart: boolean; reason?: string; needsSetup?: boolean }> {
  try {
    const health = await checkConfigurationHealth();
    
    // Check if we have a valid effective client ID
    const effectiveId = await getEffectiveClientId();
    
    if (!effectiveId) {
      return {
        canStart: false,
        reason: "Dropbox App Key not configured",
        needsSetup: true
      };
    }
    
    // Check for placeholder values
    if (effectiveId === "your_dropbox_app_key_here" || effectiveId.includes("placeholder") || effectiveId.includes("your_")) {
      return {
        canStart: false,
        reason: "Dropbox App Key is set to placeholder value",
        needsSetup: true
      };
    }
    
    // Validate App Key format
    if (effectiveId.length < 10) {
      return {
        canStart: false,
        reason: "Invalid Dropbox App Key format",
        needsSetup: true
      };
    }
    
    if (!health.canConnect) {
      return {
        canStart: false,
        reason: health.nextSteps[0] || "Configuration incomplete",
        needsSetup: true
      };
    }
    
    if (health.overall === "error") {
      return {
        canStart: false,
        reason: "Configuration errors must be resolved first",
        needsSetup: true
      };
    }
    
    return { canStart: true };
  } catch (error) {
    return {
      canStart: false,
      reason: "Failed to validate configuration",
      needsSetup: true
    };
  }
}

/**
 * Synchronous version for immediate UI feedback (limited validation)
 */
export function canStartOAuthFlowSync(): { canStart: boolean; reason?: string; needsSetup?: boolean } {
  try {
    const health = checkConfigurationHealthSync();
    
    // Basic environment variable check
    const envClientId = process.env.EXPO_PUBLIC_DROPBOX_CLIENT_ID;
    
    if (!envClientId || envClientId === "your_dropbox_app_key_here") {
      return {
        canStart: false,
        reason: "Dropbox App Key not configured in environment",
        needsSetup: true
      };
    }
    
    if (!health.canConnect) {
      return {
        canStart: false,
        reason: health.nextSteps[0] || "Configuration incomplete",
        needsSetup: true
      };
    }
    
    if (health.overall === "error") {
      return {
        canStart: false,
        reason: "Configuration errors must be resolved first",
        needsSetup: true
      };
    }
    
    // Note: This sync version can't check secure storage, so it may give false positives
    // The async version should be used for definitive validation
    return { canStart: true };
  } catch (error) {
    return {
      canStart: false,
      reason: "Failed to validate configuration",
      needsSetup: true
    };
  }
}

/**
 * Comprehensive pre-flight check for OAuth readiness
 */
export async function validateOAuthReadiness(): Promise<{
  ready: boolean;
  issues: string[];
  recommendations: string[];
  clientId?: string;
  needsSetup: boolean;
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let needsSetup = false;
  
  try {
    // Check effective client ID
    const clientId = await getEffectiveClientId();
    
    if (!clientId) {
      issues.push("No Dropbox App Key found");
      recommendations.push("Complete the setup wizard to configure your Dropbox App Key");
      needsSetup = true;
    } else if (clientId === "your_dropbox_app_key_here" || clientId.includes("placeholder")) {
      issues.push("Dropbox App Key is set to placeholder value");
      recommendations.push("Replace the placeholder with your real Dropbox App Key");
      needsSetup = true;
    } else if (clientId.length < 10) {
      issues.push("Dropbox App Key format appears invalid (too short)");
      recommendations.push("Verify your App Key from the Dropbox App Console");
      needsSetup = true;
    } else if (clientId.includes(" ") || clientId.includes("\n")) {
      issues.push("Dropbox App Key contains invalid characters");
      recommendations.push("Remove spaces and line breaks from your App Key");
      needsSetup = true;
    }
    
    // Check configuration health
    const health = await checkConfigurationHealth();
    
    if (health.overall === "error") {
      issues.push(...health.appKey.details || []);
      recommendations.push(...health.nextSteps);
      needsSetup = true;
    }
    
    return {
      ready: issues.length === 0,
      issues,
      recommendations,
      clientId: clientId || undefined,
      needsSetup
    };
  } catch (error) {
    return {
      ready: false,
      issues: ["Failed to validate OAuth readiness"],
      recommendations: ["Check your configuration and try again"],
      needsSetup: true
    };
  }
}