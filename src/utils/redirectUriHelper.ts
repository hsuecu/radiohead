/**
 * Redirect URI configuration helper for Dropbox OAuth
 */

import * as AuthSession from "expo-auth-session";

export type RedirectUriInfo = {
  uri: string;
  source: "custom" | "generated";
  isValid: boolean;
  suggestions: string[];
  developmentUris: string[];
};

/**
 * Gets the effective redirect URI and provides configuration guidance
 */
export function getRedirectUriInfo(): RedirectUriInfo {
  const customUri = process.env.EXPO_PUBLIC_DROPBOX_REDIRECT_URI;
  
  if (customUri) {
    return {
      uri: customUri,
      source: "custom",
      isValid: validateRedirectUri(customUri),
      suggestions: getRedirectUriSuggestions(customUri),
      developmentUris: generateDevelopmentUris()
    };
  }

  const generatedUri = AuthSession.makeRedirectUri();
  
  return {
    uri: generatedUri,
    source: "generated",
    isValid: true,
    suggestions: [],
    developmentUris: generateDevelopmentUris()
  };
}

/**
 * Validates a redirect URI format
 */
function validateRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    
    // Valid schemes for Expo apps
    const validSchemes = ["exp", "https", "http"];
    
    if (!validSchemes.includes(url.protocol.replace(":", ""))) {
      return false;
    }
    
    // Additional validation for exp:// scheme
    if (url.protocol === "exp:") {
      // Should have a host (IP or localhost)
      if (!url.hostname) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Provides suggestions for fixing invalid redirect URIs
 */
function getRedirectUriSuggestions(uri: string): string[] {
  const suggestions: string[] = [];
  
  try {
    const url = new URL(uri);
    
    if (!["exp", "https", "http"].includes(url.protocol.replace(":", ""))) {
      suggestions.push("Use 'exp://', 'https://', or 'http://' scheme");
    }
    
    if (url.protocol === "exp:" && !url.hostname) {
      suggestions.push("Include hostname for exp:// URIs (e.g., exp://localhost:8081)");
    }
    
  } catch {
    suggestions.push("Ensure URI is properly formatted");
    suggestions.push("Example: exp://localhost:8081 or https://yourapp.com/auth");
  }
  
  if (suggestions.length === 0) {
    suggestions.push("URI format appears valid");
  }
  
  return suggestions;
}

/**
 * Generates common development redirect URIs
 */
function generateDevelopmentUris(): string[] {
  const uris: string[] = [];
  
  // Standard development URIs
  uris.push("exp://127.0.0.1:8081");
  uris.push("exp://localhost:8081");
  
  // Add common local network examples
  uris.push("exp://192.168.1.100:8081");
  uris.push("exp://10.0.0.100:8081");
  
  // Add HTTPS examples for production
  uris.push("https://yourapp.com/auth/dropbox");
  uris.push("https://yourapp.expo.dev/auth/dropbox");
  
  return uris;
}

/**
 * Gets redirect URI setup instructions
 */
export function getRedirectUriInstructions(): {
  title: string;
  steps: string[];
  examples: string[];
} {
  const info = getRedirectUriInfo();
  
  return {
    title: "Redirect URI Configuration",
    steps: [
      "1. Go to your Dropbox app settings at https://www.dropbox.com/developers/apps",
      "2. Click on your app name to open settings",
      "3. Scroll to the 'OAuth 2' section",
      "4. Add these redirect URIs (one per line):",
      "   • For development: exp://localhost:8081",
      "   • For development: exp://127.0.0.1:8081", 
      "   • For your local network: exp://[your-ip]:8081",
      "5. Click 'Add' for each URI",
      "6. Save your changes"
    ],
    examples: info.developmentUris
  };
}

/**
 * Checks if current redirect URI is likely to work
 */
export function checkRedirectUriCompatibility(): {
  compatible: boolean;
  issues: string[];
  recommendations: string[];
} {
  const info = getRedirectUriInfo();
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  if (!info.isValid) {
    issues.push("Current redirect URI format is invalid");
    recommendations.push("Fix redirect URI format");
  }
  
  if (info.source === "generated") {
    // Generated URIs are usually fine, but provide guidance
    recommendations.push("Consider setting a custom redirect URI for more control");
    recommendations.push("Add the generated URI to your Dropbox app settings");
  }
  
  if (info.source === "custom") {
    const uri = info.uri.toLowerCase();
    
    if (uri.includes("localhost") || uri.includes("127.0.0.1")) {
      recommendations.push("Localhost URIs work for development");
      recommendations.push("Add network IP URIs for testing on other devices");
    }
    
    if (uri.startsWith("https://")) {
      recommendations.push("HTTPS URIs are good for production");
      recommendations.push("Ensure the domain is accessible from your app");
    }
  }
  
  // Check for common development issues
  if (info.uri.startsWith("exp://")) {
    // Using exp:// scheme
    recommendations.push("Using exp:// scheme - ensure it's added to Dropbox app settings");
  }
  
  return {
    compatible: info.isValid && issues.length === 0,
    issues,
    recommendations
  };
}

/**
 * Gets the current redirect URI for display
 */
export function getCurrentRedirectUri(): string {
  return getRedirectUriInfo().uri;
}

/**
 * Formats redirect URI for Dropbox app settings
 */
export function formatForDropboxSettings(uri: string): string {
  // Dropbox expects exact URIs, so return as-is
  return uri;
}