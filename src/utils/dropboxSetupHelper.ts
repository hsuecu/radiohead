/**
 * Dropbox setup helper utilities for streamlined configuration
 */

import * as Linking from "expo-linking";
import Clipboard from "@react-native-clipboard/clipboard";
import { Alert } from "react-native";

export type SetupStep = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action?: () => Promise<void>;
};

export type DropboxAppConfig = {
  name: string;
  accessType: "scoped";
  permissions: "full_dropbox";
  scopes: string[];
  redirectUris: string[];
};

/**
 * Generates the recommended Dropbox app configuration
 */
export function generateDropboxAppConfig(): DropboxAppConfig {
  const redirectUris = generateRedirectUris();
  
  return {
    name: "Radio Station App", // User can customize this
    accessType: "scoped",
    permissions: "full_dropbox",
    scopes: [
      "files.content.read",
      "files.content.write", 
      "files.metadata.read",
      "sharing.read",
      "sharing.write"
    ],
    redirectUris
  };
}

/**
 * Generates appropriate redirect URIs for the current environment
 */
export function generateRedirectUris(): string[] {
  const baseUris = [
    "exp://127.0.0.1:8081",
    "exp://localhost:8081"
  ];
  
  // Try to detect network IP for additional redirect URI
  // This is a best-effort approach for development
  try {
    // Add common development IPs
    const commonIps = [
      "exp://192.168.1.100:8081",
      "exp://192.168.0.100:8081",
      "exp://10.0.0.100:8081"
    ];
    baseUris.push(...commonIps);
  } catch (error) {
    console.warn("Could not detect network IP for redirect URIs");
  }
  
  return baseUris;
}

/**
 * Opens the Dropbox App Console with helpful parameters
 */
export async function openDropboxAppConsole(): Promise<boolean> {
  const url = "https://www.dropbox.com/developers/apps";
  
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    } else {
      // Fallback: copy URL to clipboard
      Clipboard.setString(url);
      Alert.alert(
        "Cannot open browser",
        "The Dropbox App Console URL has been copied to your clipboard:\n\n" + url,
        [{ text: "OK" }]
      );
      return false;
    }
  } catch (error) {
    console.error("Failed to open Dropbox App Console:", error);
    return false;
  }
}

/**
 * Validates a Dropbox App Key format
 */
export function validateDropboxAppKey(appKey: string): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  if (!appKey || appKey.trim().length === 0) {
    issues.push("App Key is required");
    suggestions.push("Copy your App Key from the Dropbox App Console");
    return { isValid: false, issues, suggestions };
  }
  
  const trimmedKey = appKey.trim();
  
  if (trimmedKey === "your_dropbox_app_key_here") {
    issues.push("Using placeholder App Key");
    suggestions.push("Replace with your actual App Key from Dropbox");
    return { isValid: false, issues, suggestions };
  }
  
  if (trimmedKey.length < 10) {
    issues.push("App Key appears too short");
    suggestions.push("Dropbox App Keys are typically 15+ characters");
  }
  
  if (trimmedKey.length > 50) {
    issues.push("App Key appears too long");
    suggestions.push("Make sure you copied only the App Key, not other text");
  }
  
  if (!/^[a-zA-Z0-9]+$/.test(trimmedKey)) {
    issues.push("App Key contains invalid characters");
    suggestions.push("App Keys should only contain letters and numbers");
  }
  
  if (trimmedKey.includes(" ") || trimmedKey.includes("\n") || trimmedKey.includes("\t")) {
    issues.push("App Key contains whitespace");
    suggestions.push("Remove any spaces, tabs, or line breaks");
  }
  
  const isValid = issues.length === 0;
  
  if (isValid) {
    suggestions.push("App Key format looks correct!");
  }
  
  return { isValid, issues, suggestions };
}

/**
 * Copies text to clipboard with user feedback
 */
export async function copyToClipboard(text: string, description: string = "Text"): Promise<void> {
  try {
    Clipboard.setString(text);
    Alert.alert("Copied!", `${description} has been copied to your clipboard.`);
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    Alert.alert("Copy Failed", `Could not copy ${description.toLowerCase()} to clipboard.`);
  }
}

/**
 * Generates setup instructions based on current environment
 */
export function generateSetupInstructions(): SetupStep[] {
  
  return [
    {
      id: "open-console",
      title: "Open Dropbox App Console",
      description: "Navigate to the Dropbox Developer Console to create your app",
      completed: false,
      action: async () => {
        await openDropboxAppConsole();
      }
    },
    {
      id: "create-app",
      title: "Create New App",
      description: "Create a new Dropbox app with the correct settings",
      completed: false
    },
    {
      id: "configure-permissions",
      title: "Set Permissions",
      description: "Enable the required scopes for file access",
      completed: false
    },
    {
      id: "add-redirects",
      title: "Add Redirect URIs",
      description: "Configure OAuth redirect URIs for your development environment",
      completed: false
    },
    {
      id: "copy-app-key",
      title: "Copy App Key",
      description: "Get your App Key from the Dropbox app settings",
      completed: false
    },
    {
      id: "save-config",
      title: "Save Configuration",
      description: "Update your app configuration with the App Key",
      completed: false
    }
  ];
}

/**
 * Creates a formatted setup guide text
 */
export function createSetupGuideText(): string {
  const config = generateDropboxAppConfig();
  
  return `
# Dropbox App Setup Guide

## Step 1: Create Dropbox App
1. Go to: https://www.dropbox.com/developers/apps
2. Click "Create app"
3. Choose "Scoped access"
4. Choose "Full Dropbox"
5. Enter app name: "${config.name}" (or your preferred name)
6. Click "Create app"

## Step 2: Configure Permissions
Go to the "Permissions" tab and enable these scopes:
${config.scopes.map(scope => `• ${scope}`).join('\n')}

Click "Submit" to save permissions.

## Step 3: Add Redirect URIs
Go to the "Settings" tab, find "OAuth 2" section, and add these URIs:
${config.redirectUris.map(uri => `• ${uri}`).join('\n')}

## Step 4: Copy App Key
In the "Settings" tab, find your "App key" and copy it.

## Step 5: Update Configuration
Paste your App Key in the .env file:
EXPO_PUBLIC_DROPBOX_CLIENT_ID=your_copied_app_key_here

That's it! Your Dropbox integration will now work with real authentication.
`.trim();
}

/**
 * Saves App Key to environment configuration
 * Note: This is a placeholder - actual implementation would depend on how
 * environment variables are managed in the specific setup
 */
export async function saveAppKeyToConfig(appKey: string): Promise<boolean> {
  try {
    // In a real implementation, this might:
    // 1. Update a local config file
    // 2. Save to secure storage
    // 3. Update environment variables
    // 4. Trigger app restart/reload
    
    console.log("App Key would be saved:", appKey);
    
    // For now, just show instructions to user
    Alert.alert(
      "Save App Key",
      `Please update your .env file with:\n\nEXPO_PUBLIC_DROPBOX_CLIENT_ID=${appKey}\n\nThen restart your development server.`,
      [{ text: "OK" }]
    );
    
    return true;
  } catch (error) {
    console.error("Failed to save App Key:", error);
    return false;
  }
}

/**
 * Tests if an App Key works with the Dropbox API
 */
export async function testAppKey(appKey: string): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> {
  try {
    // Basic format validation first
    const validation = validateDropboxAppKey(appKey);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.issues.join(", ")
      };
    }
    
    // Note: We can't fully test the App Key without going through OAuth flow
    // But we can do basic format validation and provide guidance
    return {
      success: true,
      details: {
        message: "App Key format is valid. Complete OAuth flow to fully test.",
        nextStep: "Save the App Key and try connecting your Dropbox account"
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}