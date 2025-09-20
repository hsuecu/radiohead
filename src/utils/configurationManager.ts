/**
 * Configuration management system for Dropbox integration
 * Handles saving and loading configuration in a secure way
 */

import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";

const CONFIG_KEY_PREFIX = "dropbox-config-";

export type DropboxConfiguration = {
  clientId: string;
  redirectUri?: string;
  isRealMode: boolean;
  lastUpdated: number;
  version: string;
};

/**
 * Saves Dropbox configuration securely
 */
export async function saveDropboxConfiguration(config: Partial<DropboxConfiguration>): Promise<boolean> {
  try {
    const currentConfig = await loadDropboxConfiguration();
    
    const updatedConfig: DropboxConfiguration = {
      ...currentConfig,
      ...config,
      lastUpdated: Date.now(),
      version: "1.0"
    };
    
    await SecureStore.setItemAsync(
      CONFIG_KEY_PREFIX + "main",
      JSON.stringify(updatedConfig)
    );
    
    console.log("Dropbox configuration saved successfully");
    return true;
  } catch (error) {
    console.error("Failed to save Dropbox configuration:", error);
    return false;
  }
}

/**
 * Loads Dropbox configuration from secure storage
 */
export async function loadDropboxConfiguration(): Promise<DropboxConfiguration> {
  try {
    const configJson = await SecureStore.getItemAsync(CONFIG_KEY_PREFIX + "main");
    
    if (configJson) {
      const config = JSON.parse(configJson) as DropboxConfiguration;
      return config;
    }
    
    // Return default configuration
    return {
      clientId: process.env.EXPO_PUBLIC_DROPBOX_CLIENT_ID || "",
      redirectUri: process.env.EXPO_PUBLIC_DROPBOX_REDIRECT_URI,
      isRealMode: process.env.EXPO_PUBLIC_STORAGE_DROPBOX_REAL === "1",
      lastUpdated: Date.now(),
      version: "1.0"
    };
  } catch (error) {
    console.error("Failed to load Dropbox configuration:", error);
    
    // Return default configuration on error
    return {
      clientId: process.env.EXPO_PUBLIC_DROPBOX_CLIENT_ID || "",
      redirectUri: process.env.EXPO_PUBLIC_DROPBOX_REDIRECT_URI,
      isRealMode: process.env.EXPO_PUBLIC_STORAGE_DROPBOX_REAL === "1",
      lastUpdated: Date.now(),
      version: "1.0"
    };
  }
}

/**
 * Clears all Dropbox configuration
 */
export async function clearDropboxConfiguration(): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(CONFIG_KEY_PREFIX + "main");
    console.log("Dropbox configuration cleared");
    return true;
  } catch (error) {
    console.error("Failed to clear Dropbox configuration:", error);
    return false;
  }
}

/**
 * Updates the App Key and provides user guidance
 */
export async function updateDropboxAppKey(appKey: string): Promise<{
  success: boolean;
  message: string;
  requiresRestart: boolean;
}> {
  try {
    // Validate the App Key format
    if (!appKey || appKey.trim().length < 10) {
      return {
        success: false,
        message: "Invalid App Key format. Please check your App Key and try again.",
        requiresRestart: false
      };
    }
    
    const trimmedKey = appKey.trim();
    
    // Save to secure storage
    const saved = await saveDropboxConfiguration({
      clientId: trimmedKey,
      isRealMode: true
    });
    
    if (!saved) {
      return {
        success: false,
        message: "Failed to save configuration. Please try again.",
        requiresRestart: false
      };
    }
    
    // Check if environment variable needs updating
    const currentEnvKey = process.env.EXPO_PUBLIC_DROPBOX_CLIENT_ID;
    const needsEnvUpdate = !currentEnvKey || currentEnvKey === "your_dropbox_app_key_here" || currentEnvKey !== trimmedKey;
    
    if (needsEnvUpdate) {
      return {
        success: true,
        message: `Configuration saved! Please update your .env file:\n\nEXPO_PUBLIC_DROPBOX_CLIENT_ID=${trimmedKey}\n\nThen restart your development server to complete the setup.`,
        requiresRestart: true
      };
    }
    
    return {
      success: true,
      message: "Configuration updated successfully! You can now connect to Dropbox.",
      requiresRestart: false
    };
    
  } catch (error) {
    console.error("Failed to update Dropbox App Key:", error);
    return {
      success: false,
      message: "An error occurred while saving the configuration. Please try again.",
      requiresRestart: false
    };
  }
}

/**
 * Gets the effective client ID (from secure storage or environment)
 */
export async function getEffectiveClientId(): Promise<string | null> {
  try {
    const config = await loadDropboxConfiguration();
    
    // Prefer secure storage over environment variable
    if (config.clientId && config.clientId !== "your_dropbox_app_key_here") {
      return config.clientId;
    }
    
    // Fall back to environment variable
    const envClientId = process.env.EXPO_PUBLIC_DROPBOX_CLIENT_ID;
    if (envClientId && envClientId !== "your_dropbox_app_key_here") {
      return envClientId;
    }
    
    return null;
  } catch (error) {
    console.error("Failed to get effective client ID:", error);
    return null;
  }
}

/**
 * Checks if configuration is complete and valid
 */
export async function isConfigurationComplete(): Promise<{
  isComplete: boolean;
  issues: string[];
  clientId?: string;
}> {
  try {
    const clientId = await getEffectiveClientId();
    const issues: string[] = [];
    
    if (!clientId) {
      issues.push("Dropbox App Key is not configured");
    } else if (clientId.length < 10) {
      issues.push("Dropbox App Key appears to be too short");
    } else if (!/^[a-zA-Z0-9]+$/.test(clientId)) {
      issues.push("Dropbox App Key contains invalid characters");
    }
    
    const isRealMode = process.env.EXPO_PUBLIC_STORAGE_DROPBOX_REAL === "1";
    if (!isRealMode) {
      issues.push("Real mode is not enabled");
    }
    
    return {
      isComplete: issues.length === 0,
      issues,
      clientId: clientId || undefined
    };
  } catch (error) {
    console.error("Failed to check configuration completeness:", error);
    return {
      isComplete: false,
      issues: ["Failed to check configuration"]
    };
  }
}

/**
 * Shows configuration update instructions to the user
 */
export function showConfigurationInstructions(appKey: string): void {
  const instructions = `To complete the Dropbox setup:

1. Open your .env file
2. Find the line: EXPO_PUBLIC_DROPBOX_CLIENT_ID=your_dropbox_app_key_here
3. Replace it with: EXPO_PUBLIC_DROPBOX_CLIENT_ID=${appKey}
4. Save the file
5. Restart your development server

Your Dropbox integration will then be ready to use!`;

  Alert.alert(
    "Configuration Instructions",
    instructions,
    [
      {
        text: "Copy App Key",
        onPress: async () => {
          try {
            const Clipboard = await import("@react-native-clipboard/clipboard");
            Clipboard.default.setString(appKey);
            Alert.alert("Copied!", "App Key copied to clipboard");
          } catch (error) {
            console.error("Failed to copy to clipboard:", error);
          }
        }
      },
      { text: "OK" }
    ]
  );
}

/**
 * Exports configuration for backup or sharing
 */
export async function exportConfiguration(): Promise<string | null> {
  try {
    const config = await loadDropboxConfiguration();
    
    // Remove sensitive information for export
    const exportConfig = {
      version: config.version,
      isRealMode: config.isRealMode,
      redirectUri: config.redirectUri,
      lastUpdated: config.lastUpdated,
      // Don't export the actual client ID for security
      hasClientId: !!config.clientId && config.clientId !== "your_dropbox_app_key_here"
    };
    
    return JSON.stringify(exportConfig, null, 2);
  } catch (error) {
    console.error("Failed to export configuration:", error);
    return null;
  }
}