/**
 * Configuration status checker for Dropbox integration
 */

import { validateDropboxConfig } from "./dropboxConfig";
import { getAuth } from "../api/storage/oauth";

export type ConfigurationReport = {
  mode: "real" | "demo" | "unconfigured";
  status: "ready" | "needs_setup" | "needs_credentials" | "needs_testing";
  issues: string[];
  nextSteps: string[];
  hasValidAuth: boolean;
  authDetails?: {
    email?: string;
    name?: string;
    expiresAt?: number;
  };
  lastVerified?: number;
};

/**
 * Generates a comprehensive configuration report
 */
export async function generateConfigurationReport(): Promise<ConfigurationReport> {
  const config = validateDropboxConfig();
  const report: ConfigurationReport = {
    mode: config.isRealMode ? "real" : config.isDemoMode ? "demo" : "unconfigured",
    status: "needs_setup",
    issues: [...config.issues],
    nextSteps: [],
    hasValidAuth: false,
  };

  // Check authentication status
  try {
    const auth = await getAuth("dropbox");
    if (auth?.accessToken) {
      report.hasValidAuth = true;
      report.authDetails = {
        email: auth.accountEmail || undefined,
        name: auth.accountName || undefined,
        expiresAt: auth.expiresAt || undefined,
      };

      // Check if token is expired
      if (auth.expiresAt && auth.expiresAt < Date.now()) {
        report.issues.push("Authentication token has expired");
        report.nextSteps.push("Reconnect your Dropbox account");
      }
    }
  } catch (error) {
    report.issues.push("Failed to check authentication status");
  }

  // Determine status and next steps based on mode and configuration
  if (config.isDemoMode) {
    report.status = "ready";
    report.nextSteps.push("🧪 Demo mode is active - you can test the UI without real Dropbox");
    report.nextSteps.push("🔄 To use real Dropbox: Set EXPO_PUBLIC_STORAGE_DROPBOX_REAL=1 and configure your App Key");
  } else if (config.isRealMode) {
    if (!config.isConfigured) {
      report.status = "needs_credentials";
      report.nextSteps.push("📋 Follow the setup guide in DROPBOX_SETUP.md");
      report.nextSteps.push("🔑 Get your Dropbox App Key from https://www.dropbox.com/developers/apps");
      report.nextSteps.push("⚙️ Set EXPO_PUBLIC_DROPBOX_CLIENT_ID in your .env file");
    } else if (!report.hasValidAuth) {
      report.status = "needs_testing";
      report.nextSteps.push("🔗 Connect your Dropbox account using the Connection Wizard");
      report.nextSteps.push("✅ Use 'Test Configuration' to verify your setup");
    } else {
      report.status = "ready";
      report.nextSteps.push("✅ Configuration looks good!");
      report.nextSteps.push("🧪 Use 'Test Configuration' to verify everything is working");
    }
  } else {
    report.status = "needs_setup";
    report.nextSteps.push("⚙️ Set EXPO_PUBLIC_STORAGE_DROPBOX_REAL=1 for real mode or =0 for demo mode");
  }

  return report;
}

/**
 * Provides specific guidance for restoring from demo mode
 */
export function getRestoreFromDemoGuidance(): string[] {
  return [
    "🔄 Your integration was temporarily set to demo mode for testing",
    "✅ Real mode has been restored (EXPO_PUBLIC_STORAGE_DROPBOX_REAL=1)",
    "🔑 Verify your EXPO_PUBLIC_DROPBOX_CLIENT_ID is set to your actual Dropbox App Key",
    "🔗 If you had a working connection before, try the 'Test Configuration' button",
    "🆘 If you need to reconnect, use the Connection Wizard in Storage Settings",
    "📋 For full setup instructions, see DROPBOX_SETUP.md"
  ];
}

/**
 * Quick validation to check if user needs to take immediate action
 */
export async function quickConfigCheck(): Promise<{
  needsAction: boolean;
  primaryIssue?: string;
  quickFix?: string;
}> {
  const config = validateDropboxConfig();
  
  if (!config.isRealMode && !config.isDemoMode) {
    return {
      needsAction: true,
      primaryIssue: "Dropbox mode not configured",
      quickFix: "Set EXPO_PUBLIC_STORAGE_DROPBOX_REAL=1 for real mode"
    };
  }
  
  if (config.isRealMode && !config.isConfigured) {
    return {
      needsAction: true,
      primaryIssue: "Dropbox App Key not configured",
      quickFix: "Set EXPO_PUBLIC_DROPBOX_CLIENT_ID to your actual Dropbox App Key"
    };
  }
  
  if (config.isRealMode && config.isConfigured) {
    try {
      const auth = await getAuth("dropbox");
      if (!auth?.accessToken) {
        return {
          needsAction: true,
          primaryIssue: "Not connected to Dropbox",
          quickFix: "Use the Connection Wizard to connect your account"
        };
      }
      
      if (auth.expiresAt && auth.expiresAt < Date.now()) {
        return {
          needsAction: true,
          primaryIssue: "Authentication token expired",
          quickFix: "Reconnect your Dropbox account"
        };
      }
    } catch (error) {
      return {
        needsAction: true,
        primaryIssue: "Authentication check failed",
        quickFix: "Try reconnecting your Dropbox account"
      };
    }
  }
  
  return { needsAction: false };
}