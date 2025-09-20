import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { validateOAuthReadiness, checkConfigurationHealth } from "../utils/dropboxValidator";
import { getEffectiveClientId } from "../utils/configurationManager";
import { getRedirectUriInfo } from "../utils/redirectUriHelper";
import { getAuth } from "../api/storage/oauth";

type DebugInfo = {
  effectiveClientId: string | null;
  configurationHealth: any;
  oauthReadiness: any;
  redirectUriInfo: any;
  currentAuth: any;
  environmentVars: {
    realMode: string | undefined;
    clientId: string | undefined;
    redirectUri: string | undefined;
  };
};

interface DropboxDebugPanelProps {
  visible: boolean;
  onClose: () => void;
}

export default function DropboxDebugPanel({ visible, onClose }: DropboxDebugPanelProps) {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadDebugInfo();
    }
  }, [visible]);

  const loadDebugInfo = async () => {
    setLoading(true);
    try {
      const [
        effectiveClientId,
        configurationHealth,
        oauthReadiness,
        redirectUriInfo,
        currentAuth
      ] = await Promise.all([
        getEffectiveClientId(),
        checkConfigurationHealth(),
        validateOAuthReadiness(),
        getRedirectUriInfo(),
        getAuth("dropbox")
      ]);

      setDebugInfo({
        effectiveClientId,
        configurationHealth,
        oauthReadiness,
        redirectUriInfo,
        currentAuth,
        environmentVars: {
          realMode: process.env.EXPO_PUBLIC_STORAGE_DROPBOX_REAL,
          clientId: process.env.EXPO_PUBLIC_DROPBOX_CLIENT_ID,
          redirectUri: process.env.EXPO_PUBLIC_DROPBOX_REDIRECT_URI
        }
      });
    } catch (error) {
      console.error("Failed to load debug info:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    // In a real app, you'd use Clipboard API
    console.log("Debug info copied:", text);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy": return "#10B981";
      case "warning": return "#F59E0B";
      case "error": return "#EF4444";
      case "unconfigured": return "#6B7280";
      default: return "#6B7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy": return "checkmark-circle";
      case "warning": return "warning";
      case "error": return "alert-circle";
      case "unconfigured": return "help-circle";
      default: return "help-circle";
    }
  };

  if (!visible) return null;

  return (
    <View className="absolute inset-0 bg-black bg-opacity-50 z-50">
      <View className="flex-1 justify-center px-4">
        <View className="bg-white rounded-2xl max-h-5/6">
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-900">Dropbox Debug Panel</Text>
            <Pressable onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView className="flex-1 p-4">
            {loading ? (
              <View className="items-center py-8">
                <Text className="text-gray-600">Loading debug information...</Text>
              </View>
            ) : debugInfo ? (
              <View className="space-y-4">
                {/* Configuration Health */}
                <View className="bg-gray-50 rounded-lg p-4">
                  <View className="flex-row items-center mb-2">
                    <Ionicons 
                      name={getStatusIcon(debugInfo.configurationHealth.overall)} 
                      size={20} 
                      color={getStatusColor(debugInfo.configurationHealth.overall)} 
                    />
                    <Text className="text-gray-900 font-semibold ml-2">Configuration Health</Text>
                  </View>
                  <Text className="text-gray-700 text-sm mb-1">
                    Status: {debugInfo.configurationHealth.overall}
                  </Text>
                  <Text className="text-gray-700 text-sm mb-1">
                    Can Connect: {debugInfo.configurationHealth.canConnect ? "Yes" : "No"}
                  </Text>
                  {debugInfo.configurationHealth.nextSteps.length > 0 && (
                    <View className="mt-2">
                      <Text className="text-gray-700 font-medium text-sm">Next Steps:</Text>
                      {debugInfo.configurationHealth.nextSteps.map((step: string, index: number) => (
                        <Text key={index} className="text-gray-600 text-sm">• {step}</Text>
                      ))}
                    </View>
                  )}
                </View>

                {/* OAuth Readiness */}
                <View className="bg-gray-50 rounded-lg p-4">
                  <Text className="text-gray-900 font-semibold mb-2">OAuth Readiness</Text>
                  <Text className="text-gray-700 text-sm mb-1">
                    Ready: {debugInfo.oauthReadiness.ready ? "Yes" : "No"}
                  </Text>
                  <Text className="text-gray-700 text-sm mb-1">
                    Needs Setup: {debugInfo.oauthReadiness.needsSetup ? "Yes" : "No"}
                  </Text>
                  {debugInfo.oauthReadiness.issues.length > 0 && (
                    <View className="mt-2">
                      <Text className="text-red-700 font-medium text-sm">Issues:</Text>
                      {debugInfo.oauthReadiness.issues.map((issue: string, index: number) => (
                        <Text key={index} className="text-red-600 text-sm">• {issue}</Text>
                      ))}
                    </View>
                  )}
                </View>

                {/* App Key Information */}
                <View className="bg-gray-50 rounded-lg p-4">
                  <Text className="text-gray-900 font-semibold mb-2">App Key Information</Text>
                  <Text className="text-gray-700 text-sm mb-1">
                    Effective Client ID: {debugInfo.effectiveClientId ? 
                      `${debugInfo.effectiveClientId.substring(0, 8)}...` : "Not configured"}
                  </Text>
                  <Text className="text-gray-700 text-sm mb-1">
                    Environment Client ID: {debugInfo.environmentVars.clientId ? 
                      `${debugInfo.environmentVars.clientId.substring(0, 8)}...` : "Not set"}
                  </Text>
                  <Text className="text-gray-700 text-sm">
                    Source: {debugInfo.effectiveClientId === debugInfo.environmentVars.clientId ? 
                      "Environment" : "Secure Storage"}
                  </Text>
                </View>

                {/* Redirect URI Information */}
                <View className="bg-gray-50 rounded-lg p-4">
                  <Text className="text-gray-900 font-semibold mb-2">Redirect URI Information</Text>
                  <Text className="text-gray-700 text-sm mb-1">
                    Current URI: {debugInfo.redirectUriInfo.uri}
                  </Text>
                  <Text className="text-gray-700 text-sm mb-1">
                    Source: {debugInfo.redirectUriInfo.source}
                  </Text>
                  <Text className="text-gray-700 text-sm mb-1">
                    Valid: {debugInfo.redirectUriInfo.isValid ? "Yes" : "No"}
                  </Text>
                  {debugInfo.redirectUriInfo.developmentUris.length > 0 && (
                    <View className="mt-2">
                      <Text className="text-gray-700 font-medium text-sm">Development URIs:</Text>
                      {debugInfo.redirectUriInfo.developmentUris.slice(0, 3).map((uri: string, index: number) => (
                        <Text key={index} className="text-gray-600 text-xs font-mono">{uri}</Text>
                      ))}
                    </View>
                  )}
                </View>

                {/* Current Authentication */}
                <View className="bg-gray-50 rounded-lg p-4">
                  <Text className="text-gray-900 font-semibold mb-2">Current Authentication</Text>
                  {debugInfo.currentAuth ? (
                    <>
                      <Text className="text-gray-700 text-sm mb-1">
                        Status: Connected
                      </Text>
                      <Text className="text-gray-700 text-sm mb-1">
                        Account: {debugInfo.currentAuth.accountEmail || "Unknown"}
                      </Text>
                      <Text className="text-gray-700 text-sm mb-1">
                        Expires: {debugInfo.currentAuth.expiresAt ? 
                          new Date(debugInfo.currentAuth.expiresAt).toLocaleString() : "Never"}
                      </Text>
                    </>
                  ) : (
                    <Text className="text-gray-700 text-sm">Not authenticated</Text>
                  )}
                </View>

                {/* Environment Variables */}
                <View className="bg-gray-50 rounded-lg p-4">
                  <Text className="text-gray-900 font-semibold mb-2">Environment Variables</Text>
                  <Text className="text-gray-700 text-sm mb-1">
                    EXPO_PUBLIC_STORAGE_DROPBOX_REAL: {debugInfo.environmentVars.realMode || "Not set"}
                  </Text>
                  <Text className="text-gray-700 text-sm mb-1">
                    EXPO_PUBLIC_DROPBOX_CLIENT_ID: {debugInfo.environmentVars.clientId ? 
                      `${debugInfo.environmentVars.clientId.substring(0, 8)}...` : "Not set"}
                  </Text>
                  <Text className="text-gray-700 text-sm">
                    EXPO_PUBLIC_DROPBOX_REDIRECT_URI: {debugInfo.environmentVars.redirectUri || "Not set"}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="items-center py-8">
                <Text className="text-gray-600">Failed to load debug information</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View className="p-4 border-t border-gray-200">
            <View className="flex-row gap-3">
              <Pressable 
                onPress={loadDebugInfo}
                className="flex-1 p-3 bg-blue-600 rounded-lg"
              >
                <Text className="text-white text-center font-medium">Refresh</Text>
              </Pressable>
              <Pressable 
                onPress={() => copyToClipboard(JSON.stringify(debugInfo, null, 2))}
                className="flex-1 p-3 bg-gray-600 rounded-lg"
              >
                <Text className="text-white text-center font-medium">Copy Debug Info</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}