import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { getAdapter } from "../api/storage/adapter";
import { useStoragePolicy } from "../state/storagePolicy";
import { startAuth, getAuth, clearAuth, setAuth } from "../api/storage/oauth";
import type { StorageProvider } from "../types/storage";
import { useStorageQueue } from "../state/storageQueue";
import { useUserStore } from "../state/userStore";
import { useProfilesStore, buildDefaultProfile } from "../state/profileStore";
import { verifyStorageProvider, VerifyResult } from "../api/storage/verify";

import { notificationManager } from "../utils/notifications";
import { validateDropboxConfig, getSetupInstructions, type DropboxConfigStatus } from "../utils/dropboxConfig";
import { generateConfigurationReport, getRestoreFromDemoGuidance, type ConfigurationReport } from "../utils/configurationChecker";
import { canStartOAuthFlow, validateOAuthReadiness } from "../utils/dropboxValidator";
import { provideTactileFeedback } from "../utils/mobileUX";
import DropboxSetupWizard from "../components/DropboxSetupWizard";
import { DropboxConnectionStatus } from "../components/DropboxConnectionStatus";
import DropboxDebugPanel from "../components/DropboxDebugPanel";
import DropboxSimpleLogin from "../components/DropboxSimpleLogin";


const PROVIDERS: { id: StorageProvider; name: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "gdrive", name: "Google Drive", color: "bg-red-500", icon: "logo-google" },
  { id: "onedrive", name: "OneDrive", color: "bg-blue-600", icon: "cloud" },
  { id: "dropbox", name: "Dropbox", color: "bg-indigo-600", icon: "logo-dropbox" },
];

export default function StorageSettingsScreen() {
  const policy = useStoragePolicy();
  const stationId = useUserStore((s)=> s.user.currentStationId) ?? "station-a";
  const profile = useProfilesStore((s)=> s.byStation[stationId]) ?? buildDefaultProfile(stationId);
  const setProfile = useProfilesStore((s)=> s.setProfile);
  const [authed, setAuthed] = useState<Record<string, boolean>>({});
  const [authDetails, setAuthDetails] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<string | null>(null);
  const jobs = useStorageQueue((s)=> s.jobs);
  const pump = useStorageQueue((s)=> s.pump);
  const clearCompleted = useStorageQueue((s)=> s.clearCompleted);
  const pauseJob = useStorageQueue((s)=> s.pause);
  const resumeJob = useStorageQueue((s)=> s.resume);
  const removeJob = useStorageQueue((s)=> s.remove);

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [refreshValue, setRefreshValue] = useState("");
  const [showConnectionWizard, setShowConnectionWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerifyResult | null>(null);
  const [dropboxConfig, setDropboxConfig] = useState<DropboxConfigStatus | null>(null);
  const [configReport, setConfigReport] = useState<ConfigurationReport | null>(null);
  const [showRestoreGuidance, setShowRestoreGuidance] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showSimpleLogin, setShowSimpleLogin] = useState(false);
  const [tokenValidating, setTokenValidating] = useState(false);
  const [tokenInline, setTokenInline] = useState<{ kind: "info" | "error" | "success"; message: string } | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<StorageProvider | null>(null);


  const loadAuthStates = React.useCallback(async () => {
    const out: Record<string, boolean> = {};
    const details: Record<string, any> = {};
    for (const p of PROVIDERS) { 
      const auth = await getAuth(p.id);
      out[p.id] = !!auth;
      if (auth) {
        details[p.id] = {
          email: auth.accountEmail || 'Unknown',
          name: auth.accountName || 'Unknown',
          expiresAt: auth.expiresAt,
          connected: Date.now()
        };
      }
    }
    setAuthed(out);
    setAuthDetails(details);
  }, []);

  const handleSetupWizardComplete = async (_appKey: string) => {
    try {
      setStatus("Configuration saved successfully! Attempting to connect...");
      setShowSetupWizard(false);
      
      // Refresh configuration after setup
      loadDropboxConfig();
      await loadConfigurationReport();
      await loadAuthStates();
      
      // Wait a moment for configuration to settle
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Automatically attempt OAuth connection after successful setup
      setStatus("Validating configuration and starting connection...");
      
      const readiness = await validateOAuthReadiness();
      
      if (readiness.ready) {
        setStatus("Configuration valid! Starting OAuth flow...");
        // Start the connection wizard automatically
        setShowConnectionWizard(true);
        setWizardStep(0);
      } else {
        setStatus(`❌ Configuration issue: ${readiness.issues[0] || 'Unknown issue'}`);
        if (readiness.needsSetup) {
          setStatus(prev => prev + " Please check your setup and try again.");
        }
      }
      
    } catch (error) {
      setStatus(`❌ Setup completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSimpleLoginSuccess = async (_auth: any) => {
    try {
      setStatus("✅ Simple login successful! Verifying connection...");
      
      // Update profile with connection info
      const result = await verifyStorageProvider('dropbox', profile.storage?.folderTemplate ?? null);
      
      if (result.verified) {
        const tpl = policy.requireFolderTemplate ?? profile.storage?.folderTemplate ?? null;
        setProfile(stationId, { 
          ...profile, 
          storage: { 
            provider: 'dropbox', 
            folderTemplate: tpl,
            lastVerified: result.lastVerified,
            accountInfo: result.accountInfo
          } 
        });
        
        setStatus("✅ Dropbox connected successfully via Simple Login!");
        notificationManager.success('Connected!', 'Dropbox connected successfully');
        
        // Refresh states
        await loadAuthStates();
        await loadConfigurationReport();
      } else {
        setStatus(`❌ Connection verification failed: ${result.message}`);
      }
    } catch (error) {
      setStatus(`❌ Simple login verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const loadDropboxConfig = React.useCallback(() => {
    const config = validateDropboxConfig();
    setDropboxConfig(config);
  }, []);

  const loadConfigurationReport = React.useCallback(async () => {
    try {
      const report = await generateConfigurationReport();
      setConfigReport(report);
      
      // Show restore guidance if we just switched from demo to real mode
      if (report.mode === "real" && report.status === "needs_credentials") {
        setShowRestoreGuidance(true);
      }
    } catch (error) {
      console.warn("Failed to generate configuration report:", error);
    }
  }, []);

  React.useEffect(() => { 
    loadAuthStates(); 
    loadDropboxConfig();
    loadConfigurationReport();
  }, []);

  const toggleProvider = async (p: StorageProvider) => {
    setStatus(null);
    if (!policy.allowedProviders.includes(p)) { 
      setStatus("Provider not allowed by policy"); 
      return; 
    }
    
    const has = await getAuth(p);
    if (has) {
      // Disconnect
      await clearAuth(p);
      setProfile(stationId, { ...profile, storage: { provider: null, folderTemplate: profile.storage?.folderTemplate ?? null } });
      setStatus(`${p} disconnected`);
      await loadAuthStates();
    } else {
      // Connect - check configuration first for Dropbox
      if (p === 'dropbox') {
        setStatus("Checking Dropbox configuration...");
        
        try {
          // Use async validation for comprehensive check
          const oauthCheck = await canStartOAuthFlow();
          
          if (!oauthCheck.canStart) {
            if (oauthCheck.needsSetup) {
              setStatus(`Configuration needed: ${oauthCheck.reason}`);
              // Show setup wizard if configuration is incomplete
              setShowSetupWizard(true);
              return;
            } else {
              setStatus(`❌ Connection blocked: ${oauthCheck.reason}`);
              return;
            }
          }
          
          // Configuration is ready, start OAuth flow
          setStatus("Configuration valid! Starting connection...");
          setShowConnectionWizard(true);
          setWizardStep(0);
        } catch (error) {
          setStatus(`❌ Configuration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Fallback to setup wizard on error
          setShowSetupWizard(true);
          return;
        }
      } else {
        // For Google Drive and OneDrive, use OAuth flow
        const providerName = p === 'gdrive' ? 'Google Drive' : 'OneDrive';
        
        try {
          setConnectingProvider(p);
          setStatus(`🔄 Starting ${providerName} authentication...`);
          
          console.log(`=== ${providerName} Connection Attempt ===`);
          console.log("Provider:", p);
          console.log("Environment variables loaded:", {
            googleDrive: !!process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID,
            oneDrive: !!process.env.EXPO_PUBLIC_ONEDRIVE_CLIENT_ID
          });
          
          const auth = await startAuth(p);
          
          if (auth) {
            setStatus(`✅ ${providerName} authenticated! Verifying connection...`);
            
            // Verify the connection
            const result = await verifyStorageProvider(p, profile.storage?.folderTemplate ?? null);
            
            if (result.verified) {
              const tpl = policy.requireFolderTemplate ?? profile.storage?.folderTemplate ?? null;
              setProfile(stationId, { 
                ...profile, 
                storage: { 
                  provider: p, 
                  folderTemplate: tpl,
                  lastVerified: result.lastVerified,
                  accountInfo: result.accountInfo
                } 
              });
              setStatus(`✅ ${providerName} connected successfully!`);
              notificationManager.success('Connected!', `${providerName} connected successfully`);
              provideTactileFeedback("success");
            } else {
              setStatus(`❌ ${providerName} verification failed: ${result.message}`);
              provideTactileFeedback("error");
            }
            
            await loadAuthStates();
          } else {
            setStatus(`❌ ${providerName} authentication returned no result`);
            provideTactileFeedback("error");
          }
        } catch (error) {
          console.error(`${providerName} connection error:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          if (errorMessage.includes("Client ID not found") || errorMessage.includes("not configured")) {
            setStatus(`❌ ${providerName} setup required: Please configure your Client ID in the .env file`);
          } else if (errorMessage.includes("placeholder")) {
            setStatus(`❌ ${providerName} setup incomplete: Please replace the placeholder Client ID with your actual ${providerName} Client ID`);
          } else if (errorMessage.includes("cancelled")) {
            setStatus(`${providerName} authentication was cancelled by user`);
          } else if (errorMessage.includes("blocked")) {
            setStatus(`❌ Browser popup blocked. Please allow popups and try again`);
          } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
            setStatus(`❌ Network error during ${providerName} authentication. Check your connection and try again`);
          } else {
            setStatus(`❌ ${providerName} connection failed: ${errorMessage}`);
          }
          
          provideTactileFeedback("error");
        } finally {
          setConnectingProvider(null);
        }
      }
    }
  };

  const startConnectionWizard = async () => {
    setConnecting(true);
    setWizardStep(1);
    
    try {
      // Pre-flight validation before attempting OAuth
      const readiness = await validateOAuthReadiness();
      
      if (!readiness.ready) {
        setWizardStep(4); // Error step
        setStatus(`❌ Configuration issue: ${readiness.issues.join(', ')}`);
        
        if (readiness.needsSetup) {
          // Provide guidance to setup wizard
          setTimeout(() => {
            setShowConnectionWizard(false);
            setShowSetupWizard(true);
          }, 2000);
        }
        return;
      }
      
      const auth = await startAuth('dropbox');
      if (auth) {
        setWizardStep(2);
        // Verify the connection
        const result = await verifyStorageProvider('dropbox', profile.storage?.folderTemplate ?? null);
        setVerificationResult(result);
        
        if (result.verified) {
          // Update profile with connection info
          const tpl = policy.requireFolderTemplate ?? profile.storage?.folderTemplate ?? null;
          setProfile(stationId, { 
            ...profile, 
            storage: { 
              provider: 'dropbox', 
              folderTemplate: tpl,
              lastVerified: result.lastVerified,
              accountInfo: result.accountInfo
            } 
          });
          setWizardStep(3);
          notificationManager.success('Connected!', 'Dropbox connected successfully');
        } else {
          setWizardStep(4); // Error step
        }
      } else {
        setWizardStep(4); // Error step
      }
    } catch (error) {
      console.error('Connection error:', error);
      setWizardStep(4); // Error step
      
      // Enhanced error handling with specific guidance
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes("App Key not configured") || errorMessage.includes("placeholder")) {
        setStatus(`❌ Setup Required: ${errorMessage}`);
        // Auto-redirect to setup wizard after showing error
        setTimeout(() => {
          setShowConnectionWizard(false);
          setShowSetupWizard(true);
        }, 3000);
      } else if (errorMessage.includes("invalid") || errorMessage.includes("format")) {
        setStatus(`❌ Configuration Error: ${errorMessage}`);
        // Suggest setup wizard for configuration issues
        setTimeout(() => {
          setShowConnectionWizard(false);
          setShowSetupWizard(true);
        }, 3000);
      } else {
        setStatus(`❌ Connection failed: ${errorMessage}`);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleRestoreConnection = async () => {
    try {
      setStatus("Checking existing authentication...");
      
      // First, try to refresh existing auth
      const existingAuth = await getAuth('dropbox');
      if (existingAuth?.accessToken) {
        // Test if existing auth still works
        const result = await verifyStorageProvider('dropbox', profile.storage?.folderTemplate ?? null);
        if (result.verified) {
          setStatus("✅ Existing connection restored successfully!");
          await loadAuthStates();
          await loadConfigurationReport();
          return;
        }
      }
      
      // If existing auth doesn't work, start fresh connection
      setStatus("Starting fresh connection...");
      setShowConnectionWizard(true);
      setWizardStep(0);
      
    } catch (error) {
      setStatus(`❌ Restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };



  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
        <View className="bg-white px-6 py-4 border-b border-gray-200">
          <Text className="text-2xl font-bold text-gray-800">Cloud Storage</Text>
          <Text className="text-gray-600">Connect your provider (mock OAuth). Uploads will use your account.</Text>
        </View>

        {status && (
          <View className="mx-6 mt-3 p-3 rounded border border-blue-200 bg-blue-50"><Text className="text-blue-800 text-sm">{status}</Text></View>
        )}

        <View className="px-6 mt-2">
          <View className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text className="text-green-800 font-semibold ml-2">Local Audio Processing</Text>
            </View>
            <Text className="text-green-700 text-sm">
              Audio cropping is processed locally on your device for instant results. No internet connection required.
            </Text>
          </View>

          {/* Restoration Guidance */}
          {showRestoreGuidance && configReport && (
            <View className="mb-4">
              <View className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <Ionicons name="information-circle" size={20} color="#3B82F6" />
                    <Text className="text-blue-800 font-semibold ml-2">Configuration Restored</Text>
                  </View>
                  <Pressable 
                    onPress={() => setShowRestoreGuidance(false)}
                    className="p-1"
                  >
                    <Ionicons name="close" size={16} color="#3B82F6" />
                  </Pressable>
                </View>
                
                <Text className="text-blue-700 text-sm mb-3">
                  Your Dropbox integration has been restored to real mode. Here's what you need to do:
                </Text>
                
                <View className="space-y-1">
                  {getRestoreFromDemoGuidance().map((guidance, index) => (
                    <Text key={index} className="text-blue-600 text-sm">{guidance}</Text>
                  ))}
                </View>
                
                <View className="flex-row gap-2 mt-3">
                  <Pressable 
                    onPress={() => {
                      setShowRestoreGuidance(false);
                      loadConfigurationReport();
                    }}
                    className="flex-1 px-3 py-2 bg-blue-600 rounded-lg"
                  >
                    <Text className="text-white text-center font-medium text-sm">Check Status</Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => setShowRestoreGuidance(false)}
                    className="flex-1 px-3 py-2 bg-blue-200 rounded-lg"
                  >
                    <Text className="text-blue-800 text-center font-medium text-sm">Got It</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Configuration Report */}
          {configReport && configReport.mode === "real" && (
            <View className="mb-4">
              <Text className="text-gray-800 font-semibold mb-2">Configuration Status</Text>
              <View className={`p-4 rounded-lg border-2 ${
                configReport.status === "ready" 
                  ? 'border-green-500 bg-green-50' 
                  : configReport.status === "needs_credentials"
                    ? 'border-red-500 bg-red-50'
                    : 'border-yellow-500 bg-yellow-50'
              }`}>
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <Ionicons 
                      name={
                        configReport.status === "ready" ? "checkmark-circle" :
                        configReport.status === "needs_credentials" ? "alert-circle" : "warning"
                      } 
                      size={20} 
                      color={
                        configReport.status === "ready" ? '#10B981' :
                        configReport.status === "needs_credentials" ? '#EF4444' : '#F59E0B'
                      } 
                    />
                    <Text className={`ml-3 text-lg font-medium ${
                      configReport.status === "ready" ? 'text-green-700' :
                      configReport.status === "needs_credentials" ? 'text-red-700' : 'text-yellow-700'
                    }`}>
                      {configReport.status === "ready" ? "Ready for Use" :
                       configReport.status === "needs_credentials" ? "Needs Setup" :
                       configReport.status === "needs_testing" ? "Needs Testing" : "Setup Required"}
                    </Text>
                  </View>
                  <Text className={`text-sm font-medium ${
                    configReport.status === "ready" ? 'text-green-600' :
                    configReport.status === "needs_credentials" ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    Real Mode
                  </Text>
                </View>

                {/* Authentication Status */}
                {configReport.hasValidAuth && configReport.authDetails && (
                  <View className="mt-2 pt-2 border-t border-gray-200">
                    <Text className="text-gray-700 font-medium text-sm mb-1">Connected Account:</Text>
                    <Text className="text-gray-600 text-sm">
                      {configReport.authDetails.email || "Unknown email"}
                    </Text>
                    {configReport.authDetails.name && (
                      <Text className="text-gray-600 text-sm">
                        {configReport.authDetails.name}
                      </Text>
                    )}
                  </View>
                )}

                {/* Issues */}
                {configReport.issues.length > 0 && (
                  <View className="mt-2 pt-2 border-t border-red-200">
                    <Text className="text-red-700 font-medium text-sm mb-1">Issues:</Text>
                    {configReport.issues.map((issue, index) => (
                      <Text key={index} className="text-red-600 text-sm">• {issue}</Text>
                    ))}
                  </View>
                )}

                {/* Next Steps */}
                {configReport.nextSteps.length > 0 && (
                  <View className="mt-2 pt-2 border-t border-gray-200">
                    <Text className="text-gray-700 font-medium text-sm mb-1">Next Steps:</Text>
                    {configReport.nextSteps.map((step, index) => (
                      <Text key={index} className="text-gray-600 text-sm">{step}</Text>
                    ))}
                  </View>
                )}

                {/* Action Buttons */}
                <View className="flex-row gap-2 mt-3">
                  <Pressable 
                    onPress={loadConfigurationReport}
                    className="flex-1 px-3 py-2 bg-gray-200 rounded-lg"
                  >
                    <Text className="text-gray-800 text-center font-medium text-sm">Refresh Status</Text>
                  </Pressable>
                  
                  {configReport.status === "ready" && (
                    <Pressable 
                      onPress={async () => {
                        try {
                          setStatus("Testing configuration...");
                          const result = await verifyStorageProvider('dropbox', profile.storage?.folderTemplate ?? null);
                          setStatus(result.verified ? "✅ Configuration test successful!" : `❌ Test failed: ${result.message}`);
                        } catch (error) {
                          setStatus(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-green-600 rounded-lg"
                    >
                      <Text className="text-white text-center font-medium text-sm">Test Config</Text>
                    </Pressable>
                  )}
                  
                  {(configReport.status === "needs_testing" || configReport.status === "needs_credentials") && (
                    <Pressable 
                      onPress={handleRestoreConnection}
                      className="flex-1 px-3 py-2 bg-blue-600 rounded-lg"
                    >
                      <Text className="text-white text-center font-medium text-sm">
                        {configReport.status === "needs_testing" ? "Restore Connection" : "Setup Connection"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Connection Status */}
          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-2">Connection Status</Text>
            <DropboxConnectionStatus 
              showDetails={true}
              onPress={() => {
                // Refresh status when pressed
                loadAuthStates();
                loadConfigurationReport();
              }}
            />
            
            {/* Debug Panel Button (Development Only) */}
            {__DEV__ && (
              <Pressable 
                onPress={() => setShowDebugPanel(true)}
                className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded-lg"
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons name="bug" size={16} color="#D97706" />
                  <Text className="text-yellow-800 text-sm font-medium ml-2">Debug Panel</Text>
                </View>
              </Pressable>
            )}
          </View>

          {/* Dropbox Configuration Status */}
          {dropboxConfig && (
            <View className="mb-4">
              <Text className="text-gray-800 font-semibold mb-2">Dropbox Configuration</Text>
              <View className={`p-4 rounded-lg border-2 ${
                dropboxConfig.isConfigured 
                  ? 'border-green-500 bg-green-50' 
                  : dropboxConfig.isDemoMode 
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-red-500 bg-red-50'
              }`}>
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <Ionicons 
                      name={dropboxConfig.isConfigured ? "checkmark-circle" : dropboxConfig.isDemoMode ? "warning" : "alert-circle"} 
                      size={20} 
                      color={dropboxConfig.isConfigured ? '#10B981' : dropboxConfig.isDemoMode ? '#F59E0B' : '#EF4444'} 
                    />
                    <Text className={`ml-3 text-lg font-medium ${
                      dropboxConfig.isConfigured 
                        ? 'text-green-700' 
                        : dropboxConfig.isDemoMode 
                          ? 'text-yellow-700'
                          : 'text-red-700'
                    }`}>
                      {dropboxConfig.isConfigured 
                        ? 'Ready' 
                        : dropboxConfig.isDemoMode 
                          ? 'Demo Mode'
                          : 'Setup Required'
                      }
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <View className={`w-3 h-3 rounded-full mr-2 ${
                      dropboxConfig.isConfigured 
                        ? 'bg-green-500' 
                        : dropboxConfig.isDemoMode 
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`} />
                    <Text className={`text-sm ${
                      dropboxConfig.isConfigured 
                        ? 'text-green-600' 
                        : dropboxConfig.isDemoMode 
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}>
                      {dropboxConfig.isRealMode ? 'Real Mode' : dropboxConfig.isDemoMode ? 'Demo Mode' : 'Not Configured'}
                    </Text>
                  </View>
                </View>

                {/* Configuration Details */}
                <View className="mt-2 pt-2 border-t border-gray-200">
                  {dropboxConfig.clientId && dropboxConfig.clientId !== "your_dropbox_app_key_here" && (
                    <Text className="text-gray-600 text-sm">Client ID: {dropboxConfig.clientId.substring(0, 8)}...</Text>
                  )}
                  {dropboxConfig.redirectUri && (
                    <Text className="text-gray-600 text-sm">Redirect URI: {dropboxConfig.redirectUri}</Text>
                  )}
                </View>

                {/* Issues */}
                {dropboxConfig.issues.length > 0 && (
                  <View className="mt-2 pt-2 border-t border-red-200">
                    <Text className="text-red-700 font-medium text-sm mb-1">Issues:</Text>
                    {dropboxConfig.issues.map((issue, index) => (
                      <Text key={index} className="text-red-600 text-sm">• {issue}</Text>
                    ))}
                  </View>
                )}

                {/* Setup Instructions */}
                {getSetupInstructions(dropboxConfig).length > 0 && (
                  <View className="mt-2 pt-2 border-t border-gray-200">
                    <Text className="text-gray-700 font-medium text-sm mb-1">Next Steps:</Text>
                    {getSetupInstructions(dropboxConfig).map((instruction, index) => (
                      <Text key={index} className="text-gray-600 text-sm">{instruction}</Text>
                    ))}
                  </View>
                )}

                {/* Action Buttons */}
                <View className="flex-row gap-2 mt-3">
                  <Pressable 
                    onPress={loadDropboxConfig}
                    className="flex-1 px-3 py-2 bg-gray-200 rounded-lg"
                  >
                    <Text className="text-gray-800 text-center font-medium text-sm">Refresh Config</Text>
                  </Pressable>
                  
                  {dropboxConfig.isConfigured && (
                    <Pressable 
                      onPress={async () => {
                        try {
                          setStatus("Testing configuration...");
                          const result = await verifyStorageProvider('dropbox', profile.storage?.folderTemplate ?? null);
                          setStatus(result.verified ? "✅ Configuration test successful!" : `❌ Test failed: ${result.message}`);
                        } catch (error) {
                          setStatus(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-blue-600 rounded-lg"
                    >
                      <Text className="text-white text-center font-medium text-sm">Test Config</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          )}

          <Text className="text-gray-800 font-semibold mb-2">Cloud Storage Providers</Text>
          <View className="space-y-3 mb-4">
            {PROVIDERS.map((p)=> (
              <View key={p.id} className={`p-4 rounded-lg border-2 ${authed[p.id] ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'}`}>
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <Ionicons name={p.icon} size={20} color={authed[p.id] ? '#10B981' : '#6B7280'} />
                    <Text className={`ml-3 text-lg font-medium ${authed[p.id] ? 'text-green-700' : 'text-gray-700'}`}>{p.name}</Text>
                  </View>
                  <View className="flex-row items-center">
                    <View className={`w-3 h-3 rounded-full mr-2 ${authed[p.id] ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <Text className={`text-sm ${authed[p.id] ? 'text-green-600' : 'text-gray-500'}`}>
                      {authed[p.id] ? 'Connected' : 'Not connected'}
                    </Text>
                  </View>
                </View>
                
                {authed[p.id] && authDetails[p.id] && (
                  <View className="mt-2 pt-2 border-t border-green-200">
                    <Text className="text-green-600 text-sm">Account: {authDetails[p.id].email}</Text>
                    {authDetails[p.id].name !== 'Unknown' && (
                      <Text className="text-green-600 text-sm">Name: {authDetails[p.id].name}</Text>
                    )}
                  </View>
                )}
                
                <View className="space-y-2 mt-3">
                  {/* Primary Action Row */}
                   <View className="flex-row gap-2">
                     <Pressable 
                       className={`flex-1 px-4 py-2 rounded-lg ${
                         connectingProvider === p.id 
                           ? 'bg-gray-400' 
                           : authed[p.id] 
                             ? 'bg-red-500' 
                             : 'bg-blue-600'
                       }`}
                       onPress={() => toggleProvider(p.id)}
                       disabled={connectingProvider === p.id}
                     >
                       <View className="flex-row items-center justify-center">
                         {connectingProvider === p.id && (
                           <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                         )}
                         <Text className="text-white text-center font-medium">
                           {connectingProvider === p.id 
                             ? 'Connecting...' 
                             : authed[p.id] 
                               ? 'Disconnect' 
                               : 'Connect'
                           }
                         </Text>
                       </View>
                     </Pressable>
                    
                    {/* Quick Simple Login for Dropbox */}
                    {p.id === 'dropbox' && !authed[p.id] && (
                      <Pressable 
                        className="px-4 py-2 rounded-lg bg-green-600"
                        onPress={() => setShowSimpleLogin(true)}
                      >
                        <Text className="text-white text-center font-medium">Simple Login</Text>
                      </Pressable>
                    )}
                  </View>
                  
                  {/* Secondary Actions Row (when connected) */}
                  {authed[p.id] && (
                    <View className="flex-row gap-2">
                      <Pressable 
                        onPress={async () => {
                          const r = await verifyStorageProvider(p.id, profile.storage?.folderTemplate ?? null);
                          setStatus(r.verified ? `${p.name} verified` : `Verification failed: ${r.message || 'Unknown error'}`);
                        }} 
                        className="flex-1 px-4 py-2 rounded-lg bg-green-600"
                      >
                        <Text className="text-white text-center font-medium">Verify</Text>
                      </Pressable>
                      
                      {p.id === 'dropbox' && (
                        <Pressable 
                          onPress={async () => {
                            try {
                              const tmpPath = `${FileSystem.cacheDirectory}vibecode_test_${Date.now()}.txt`;
                              await FileSystem.writeAsStringAsync(tmpPath, `Vibecode Dropbox test ${new Date().toISOString()}`);
                              const ad = await getAdapter('dropbox');
                              const remote = `/vibecode_test_${Date.now()}.txt`;
                              setStatus('Uploading test file...');
                              await ad.putChunked(tmpPath, remote, (p) => setStatus(`Uploading test file... ${Math.round(p*100)}%`));
                              setStatus(`✅ Test upload complete: ${remote}`);
                            } catch (e) {
                              setStatus(`❌ Test upload failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
                            }
                          }} 
                          className="flex-1 px-4 py-2 rounded-lg bg-purple-600"
                        >
                          <Text className="text-white text-center font-medium">Test Upload</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                  
                  {/* Advanced Options Row (for Dropbox) */}
                  {p.id === 'dropbox' && !authed[p.id] && (
                    <View className="flex-row gap-2">
                      <Pressable 
                        onPress={() => setShowTokenModal(true)} 
                        className="flex-1 px-4 py-2 rounded-lg bg-gray-200"
                      >
                        <Text className="text-gray-800 text-center font-medium">Advanced Token Entry</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
          {profile.storage?.provider && (
            <View className="mb-2"><Text className="text-gray-600 text-xs">Bound to this profile: {String(profile.storage?.provider)}</Text></View>
          )}

          {/* Advanced Manual token modal for Dropbox */}
          <Modal visible={showTokenModal} transparent animationType="slide" onRequestClose={() => setShowTokenModal(false)}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <KeyboardAvoidingView 
                className="flex-1" 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
              >
                <View className="flex-1 justify-center bg-black bg-opacity-40 px-4">
                  <View className="bg-white rounded-2xl p-6 max-h-5/6">
                    <ScrollView 
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={{ flexGrow: 1 }}
                    >
                      <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-xl font-bold text-gray-900">Advanced Token Entry</Text>
                        <Pressable onPress={() => setShowTokenModal(false)} className="px-3 py-2 bg-gray-200 rounded-full">
                          <Text className="text-gray-700">Close</Text>
                        </Pressable>
                      </View>
                      
                      <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                        <View className="flex-row items-start">
                          <Ionicons name="warning" size={16} color="#F59E0B" />
                          <Text className="text-yellow-800 text-sm ml-2">
                            For experienced users only. If you're new to Dropbox tokens, use "Simple Login" instead.
                          </Text>
                        </View>
                      </View>
                      
                      <Text className="text-gray-700 font-medium mb-2">Access Token *</Text>
                      <View className="flex-row gap-2 mb-3">
                        <TextInput 
                          value={tokenValue} 
                          onChangeText={setTokenValue} 
                          placeholder="Paste your Dropbox access token here" 
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-3 bg-white" 
                          autoCapitalize="none"
                          autoCorrect={false}
                          multiline
                          numberOfLines={2}
                          returnKeyType="done"
                        />
                         <Pressable 
                           onPress={async () => {
                             try {
                               provideTactileFeedback("light");
                               const text = await Clipboard.getStringAsync();
                               if (text && text.trim().length > 0) {
                                 setTokenValue(text.trim());
                                 setTokenInline({ kind: "success", message: "Pasted from clipboard" });
                               } else {
                                 setTokenInline({ kind: "info", message: "Clipboard is empty" });
                               }
                             } catch (error) {
                               setTokenInline({ kind: "error", message: "Paste failed" });
                             }
                           }}
                           className="px-3 py-2 bg-blue-100 rounded-lg justify-center"
                         >
                           <Ionicons name="clipboard" size={20} color="#3B82F6" />
                         </Pressable>
                      </View>
                      
                      <Text className="text-gray-700 font-medium mb-2">Refresh Token (Optional)</Text>
                      <TextInput 
                        value={refreshValue} 
                        onChangeText={setRefreshValue} 
                        placeholder="Refresh token (if available)" 
                        className="border border-gray-300 rounded-lg px-3 py-3 bg-white mb-4" 
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="done"
                      />
                      
                       {tokenValue.length > 0 && (
                         <View className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                           <Text className="text-blue-800 text-sm">
                             Token length: {tokenValue.length} characters
                             {tokenValue.length < 20 && " (seems too short)"}
                             {tokenValue.length > 200 && " (seems too long)"}
                           </Text>
                         </View>
                       )}

                       {tokenInline && (
                         <View className={`rounded-lg p-3 mb-3 border ${
                           tokenInline.kind === "success" ? 'bg-green-50 border-green-200' :
                           tokenInline.kind === "error" ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
                         }`}>
                           <View className="flex-row items-start">
                             <Ionicons 
                               name={tokenInline.kind === "success" ? "checkmark-circle" : tokenInline.kind === "error" ? "alert-circle" : "information-circle"}
                               size={18}
                               color={tokenInline.kind === "success" ? '#10B981' : tokenInline.kind === "error" ? '#EF4444' : '#3B82F6'}
                             />
                             <Text className={`${
                               tokenInline.kind === "success" ? 'text-green-800' : tokenInline.kind === "error" ? 'text-red-800' : 'text-blue-800'
                             } text-sm ml-2`}>{tokenInline.message}</Text>
                           </View>
                         </View>
                       )}
                       
                       <View className="flex-row gap-3 mt-4">
                        <Pressable 
                          onPress={() => {
                            setShowTokenModal(false);
                            setShowSimpleLogin(true);
                          }}
                          className="flex-1 p-3 bg-green-600 rounded-lg"
                        >
                          <Text className="text-white text-center font-medium">Use Simple Login</Text>
                        </Pressable>
                        
                         <Pressable disabled={tokenValidating || !tokenValue.trim()} onPress={async () => {
                           if (!tokenValue.trim()) { 
                             setTokenInline({ kind: "error", message: "Please enter an access token" }); 
                             return; 
                           }
                           
                           try {
                             setTokenInline({ kind: "info", message: "Validating token..." });
                             setTokenValidating(true);
                             await setAuth({ 
                               provider: 'dropbox', 
                               accessToken: tokenValue.trim(), 
                               refreshToken: refreshValue.trim() || null, 
                               expiresAt: Date.now() + 3600_000, 
                               scopes: [], 
                               accountEmail: null, 
                               accountName: null 
                             });
                             
                             // Verify the token works
                             const result = await verifyStorageProvider('dropbox', profile.storage?.folderTemplate ?? null);
                             
                             if (result.verified) {
                               provideTactileFeedback("success");
                               setTokenInline({ kind: "success", message: "Token validated successfully" });
                               setShowTokenModal(false);
                               setTokenValue(''); 
                               setRefreshValue('');
                               await loadAuthStates();
                               setStatus('✅ Dropbox token validated and saved successfully!');
                               
                               // Update profile
                               const tpl = policy.requireFolderTemplate ?? profile.storage?.folderTemplate ?? null;
                               setProfile(stationId, { 
                                 ...profile, 
                                 storage: { 
                                   provider: 'dropbox', 
                                   folderTemplate: tpl,
                                   lastVerified: result.lastVerified,
                                   accountInfo: result.accountInfo
                                 } 
                               });
                               
                               notificationManager.success('Connected!', 'Dropbox connected successfully');
                             } else {
                               provideTactileFeedback("error");
                               setTokenInline({ kind: "error", message: `Token validation failed: ${result.message || 'Unknown error'}` });
                             }
                           } catch (error) {
                             setTokenInline({ kind: "error", message: `Token save failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
                           } finally {
                             setTokenValidating(false);
                           }
                         }} className={`flex-1 p-3 rounded-lg ${tokenValidating || !tokenValue.trim() ? 'bg-gray-300' : 'bg-blue-600'}`}>
                           <Text className={`text-center font-medium ${tokenValidating || !tokenValue.trim() ? 'text-gray-500' : 'text-white'}`}>{tokenValidating ? "Validating..." : "Save & Validate"}</Text>
                         </Pressable>
                      </View>
                    </ScrollView>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </Modal>

          {/* Connection Wizard Modal */}
          <Modal visible={showConnectionWizard} transparent animationType="slide" onRequestClose={() => setShowConnectionWizard(false)}>
            <View className="flex-1 justify-center bg-black bg-opacity-50 px-6">
              <View className="bg-white rounded-2xl p-6 max-h-4/5">
                {wizardStep === 0 && (
                  <View>
                    <View className="items-center mb-6">
                      <Ionicons name="logo-dropbox" size={48} color="#0061FF" />
                      <Text className="text-2xl font-bold text-gray-900 mt-3">Connect to Dropbox</Text>
                      <Text className="text-gray-600 text-center mt-2">Choose how you'd like to connect your Dropbox account</Text>
                    </View>
                    
                    <View className="space-y-4">
                      <Pressable 
                        onPress={startConnectionWizard}
                        className="p-4 border-2 border-blue-500 bg-blue-50 rounded-lg"
                      >
                        <View className="flex-row items-center">
                          <Ionicons name="shield-checkmark" size={24} color="#3B82F6" />
                          <View className="ml-3 flex-1">
                            <Text className="text-blue-900 font-semibold">OAuth Authentication</Text>
                            <Text className="text-blue-700 text-sm">Secure browser-based login (Recommended)</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
                        </View>
                      </Pressable>
                      
                      <Pressable 
                        onPress={() => {
                          setShowConnectionWizard(false);
                          setShowSimpleLogin(true);
                        }}
                        className="p-4 border-2 border-green-500 bg-green-50 rounded-lg"
                      >
                        <View className="flex-row items-center">
                          <Ionicons name="person-circle" size={24} color="#10B981" />
                          <View className="ml-3 flex-1">
                            <Text className="text-green-900 font-semibold">Simple Login</Text>
                            <Text className="text-green-700 text-sm">Guided token setup with step-by-step help</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color="#10B981" />
                        </View>
                      </Pressable>
                      
                      <Pressable 
                        onPress={() => {
                          setShowConnectionWizard(false);
                          setShowTokenModal(true);
                        }}
                        className="p-4 border-2 border-gray-300 bg-gray-50 rounded-lg"
                      >
                        <View className="flex-row items-center">
                          <Ionicons name="key" size={24} color="#6B7280" />
                          <View className="ml-3 flex-1">
                            <Text className="text-gray-900 font-semibold">Advanced Token Entry</Text>
                            <Text className="text-gray-600 text-sm">For experienced users with existing tokens</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                        </View>
                      </Pressable>
                    </View>
                    
                    <Pressable 
                      onPress={() => setShowConnectionWizard(false)}
                      className="mt-6 p-3 bg-gray-200 rounded-lg"
                    >
                      <Text className="text-gray-800 text-center font-medium">Cancel</Text>
                    </Pressable>
                  </View>
                )}
                
                {wizardStep === 1 && (
                  <View>
                    <View className="items-center mb-6">
                      <ActivityIndicator size="large" color="#0061FF" />
                      <Text className="text-xl font-bold text-gray-900 mt-4">Connecting to Dropbox</Text>
                      <Text className="text-gray-600 text-center mt-2">
                        {connecting ? "Validating configuration and opening browser..." : "Processing authentication..."}
                      </Text>
                    </View>
                    
                    {/* Progress Steps */}
                    <View className="mb-6">
                      <View className="flex-row items-center mb-2">
                        <View className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <Ionicons name="checkmark" size={16} color="white" />
                        </View>
                        <Text className="text-gray-700 ml-3 flex-1">Configuration validated</Text>
                      </View>
                      <View className="flex-row items-center mb-2">
                        <View className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <ActivityIndicator size={12} color="white" />
                        </View>
                        <Text className="text-gray-700 ml-3 flex-1">Opening browser for authentication</Text>
                      </View>
                      <View className="flex-row items-center">
                        <View className="w-6 h-6 bg-gray-300 rounded-full"></View>
                        <Text className="text-gray-500 ml-3 flex-1">Verifying connection</Text>
                      </View>
                    </View>
                    
                    <View className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <View className="flex-row items-start">
                        <Ionicons name="information-circle" size={20} color="#3B82F6" />
                        <Text className="text-blue-800 text-sm ml-2">
                          A browser window will open for you to log in to Dropbox. After granting permission, you'll be redirected back to the app.
                        </Text>
                      </View>
                    </View>
                    
                    <Pressable 
                      onPress={() => {
                        setShowConnectionWizard(false);
                        setConnecting(false);
                      }}
                      className="mt-6 p-3 bg-gray-200 rounded-lg"
                    >
                      <Text className="text-gray-800 text-center font-medium">Cancel</Text>
                    </Pressable>
                  </View>
                )}
                
                {wizardStep === 2 && (
                  <View>
                    <View className="items-center mb-6">
                      <ActivityIndicator size="large" color="#10B981" />
                      <Text className="text-xl font-bold text-gray-900 mt-4">Verifying Connection</Text>
                      <Text className="text-gray-600 text-center mt-2">Testing your Dropbox access...</Text>
                    </View>
                    
                    <View className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <View className="flex-row items-start">
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                        <Text className="text-green-800 text-sm ml-2">
                          Authentication successful! We're now verifying that we can access your Dropbox account.
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                
                {wizardStep === 3 && verificationResult?.verified && (
                  <View>
                    <View className="items-center mb-6">
                      <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                      <Text className="text-2xl font-bold text-green-900 mt-3">Connected Successfully!</Text>
                      <Text className="text-gray-600 text-center mt-2">Your Dropbox account is now connected</Text>
                    </View>
                    
                    {verificationResult.accountInfo && (
                      <View className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <Text className="text-green-800 font-semibold mb-2">Account Details:</Text>
                        {verificationResult.accountInfo.email && (
                          <Text className="text-green-700 text-sm">Email: {verificationResult.accountInfo.email}</Text>
                        )}
                        {verificationResult.accountInfo.name && (
                          <Text className="text-green-700 text-sm">Name: {verificationResult.accountInfo.name}</Text>
                        )}
                        {verificationResult.accountInfo.spaceUsed && (
                          <Text className="text-green-700 text-sm">
                            Storage: {Math.round(verificationResult.accountInfo.spaceUsed / 1024 / 1024 / 1024 * 100) / 100} GB used
                            {verificationResult.accountInfo.spaceTotal && 
                              ` of ${Math.round(verificationResult.accountInfo.spaceTotal / 1024 / 1024 / 1024 * 100) / 100} GB`
                            }
                          </Text>
                        )}
                      </View>
                    )}
                    
                    <Pressable 
                      onPress={() => {
                        setShowConnectionWizard(false);
                        setWizardStep(0);
                        setVerificationResult(null);
                      }}
                      className="p-3 bg-green-600 rounded-lg"
                    >
                      <Text className="text-white text-center font-medium">Done</Text>
                    </Pressable>
                  </View>
                )}
                
                {wizardStep === 4 && (
                  <View>
                    <View className="items-center mb-6">
                      <Ionicons name="alert-circle" size={48} color="#EF4444" />
                      <Text className="text-2xl font-bold text-red-900 mt-3">Connection Failed</Text>
                      <Text className="text-gray-600 text-center mt-2">We couldn't connect to your Dropbox account</Text>
                    </View>
                    
                    <View className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <Text className="text-red-800 font-semibold mb-2">Error Details:</Text>
                      <Text className="text-red-700 text-sm">
                        {verificationResult?.message || status || "Unknown error occurred during connection"}
                      </Text>
                    </View>
                    
                    {/* Smart troubleshooting based on error type */}
                    <View className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <Text className="text-blue-800 font-semibold mb-2">Recommended Actions:</Text>
                      {(status?.includes("App Key") || status?.includes("placeholder") || status?.includes("configuration")) ? (
                        <>
                          <Text className="text-blue-700 text-sm mb-1">• Complete the setup wizard to configure your App Key</Text>
                          <Text className="text-blue-700 text-sm mb-1">• Ensure you're using your real Dropbox App Key</Text>
                          <Text className="text-blue-700 text-sm">• Verify your App Key format is correct</Text>
                        </>
                      ) : (
                        <>
                          <Text className="text-blue-700 text-sm mb-1">• Check your internet connection</Text>
                          <Text className="text-blue-700 text-sm mb-1">• Make sure you granted all permissions</Text>
                          <Text className="text-blue-700 text-sm mb-1">• Verify your Dropbox app has correct redirect URIs</Text>
                          <Text className="text-blue-700 text-sm">• Try using manual token entry instead</Text>
                        </>
                      )}
                    </View>
                    
                    <View className="space-y-3">
                      {/* Setup Wizard Button (if configuration issue) */}
                      {(status?.includes("App Key") || status?.includes("placeholder") || status?.includes("configuration")) && (
                        <Pressable 
                          onPress={() => {
                            setShowConnectionWizard(false);
                            setShowSetupWizard(true);
                            setWizardStep(0);
                            setVerificationResult(null);
                          }}
                          className="p-3 bg-green-600 rounded-lg"
                        >
                          <Text className="text-white text-center font-medium">Open Setup Wizard</Text>
                        </Pressable>
                      )}
                      
                      {/* Action buttons */}
                      <View className="flex-row gap-3">
                        <Pressable 
                          onPress={() => {
                            setWizardStep(0);
                            setVerificationResult(null);
                          }}
                          className="flex-1 p-3 bg-blue-600 rounded-lg"
                        >
                          <Text className="text-white text-center font-medium">Try Again</Text>
                        </Pressable>
                        <Pressable 
                          onPress={() => {
                            setShowConnectionWizard(false);
                            setShowTokenModal(true);
                            setWizardStep(0);
                            setVerificationResult(null);
                          }}
                          className="flex-1 p-3 bg-orange-600 rounded-lg"
                        >
                          <Text className="text-white text-center font-medium">Manual Token</Text>
                        </Pressable>
                      </View>
                      
                      <Pressable 
                        onPress={() => {
                          setShowConnectionWizard(false);
                          setWizardStep(0);
                          setVerificationResult(null);
                        }}
                        className="p-3 bg-gray-200 rounded-lg"
                      >
                        <Text className="text-gray-800 text-center font-medium">Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </Modal>

          <Pressable onPress={() => {
            const stations = require("../state/stationStore").useStationStore.getState().stations as any[];
            const others = stations.filter(s => s.id !== stationId);
            const srcId = (others[0]?.id) as string | undefined;
            if (!srcId) { setStatus('No other station to copy from'); return; }
            const src = useProfilesStore.getState().byStation[srcId];
            if (!src?.storage) { setStatus('Source has no storage bound'); return; }
            setProfile(stationId, { ...profile, storage: src.storage }); setStatus('Copied storage from ' + (others[0]?.name || srcId));
          }} className="px-3 py-2 rounded-full bg-gray-200 mb-2"><Text className="text-gray-800 text-sm">Copy storage from another station…</Text></Pressable>

          <Text className="text-gray-800 font-semibold mt-4 mb-2">Policy</Text>
          <View className="flex-row gap-2 items-center">
            <Text className="text-gray-700">Max file size</Text>
            <Text className="px-2 py-1 bg-gray-100 rounded border border-gray-200">{policy.maxFileSizeMB} MB</Text>
          </View>
          {policy.requireFolderTemplate && (<Text className="text-gray-500 text-xs mt-1">Folder template: {policy.requireFolderTemplate}</Text>)}

          {/* Reset All Auth */}
          <Pressable onPress={async () => {
            for (const p of PROVIDERS) { await clearAuth(p.id); }
            setProfile(stationId, { ...profile, storage: { provider: null, folderTemplate: profile.storage?.folderTemplate ?? null } });
            await loadAuthStates();
            setStatus('All storage auth reset');
          }} className="mt-3 px-3 py-2 rounded-full bg-gray-200"><Text className="text-gray-800 text-sm text-center">Reset all storage auth</Text></Pressable>
        </View>
 
        <View className="px-6 mt-4 mb-6">
          <Text className="text-gray-800 font-semibold mb-2">Upload Queue ({jobs.length})</Text>
          {jobs.length === 0 ? (
            <View className="p-6 bg-gray-50 rounded-lg border border-gray-200">
              <View className="items-center">
                <Ionicons name="cloud-upload-outline" size={48} color="#9CA3AF" />
                <Text className="text-gray-500 mt-2">No uploads queued</Text>
                <Text className="text-gray-400 text-sm text-center mt-1">Files will appear here when you queue them for upload</Text>
              </View>
            </View>
          ) : (
            <View className="space-y-3">
              {jobs.map((j, index)=> (
                <View key={`${j.id}-${index}`} className="p-4 rounded-lg border border-gray-200 bg-white">
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-gray-800 font-medium text-sm" numberOfLines={1}>
                        {j.remotePath.split('/').pop() || j.remotePath}
                      </Text>
                      <Text className="text-gray-500 text-xs mt-1">
                        {j.provider.toUpperCase()} • {j.status.toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-row gap-2">
                      {j.status === 'pending' && (
                        <Pressable onPress={() => pauseJob(j.id)} className="px-2 py-1 bg-yellow-500 rounded">
                          <Text className="text-white text-xs">Pause</Text>
                        </Pressable>
                      )}
                      {j.status === 'paused' && (
                        <Pressable onPress={() => resumeJob(j.id)} className="px-2 py-1 bg-green-500 rounded">
                          <Text className="text-white text-xs">Resume</Text>
                        </Pressable>
                      )}
                      {j.status === 'failed' && (
                        <Pressable onPress={() => resumeJob(j.id)} className="px-2 py-1 bg-blue-500 rounded">
                          <Text className="text-white text-xs">Retry</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => removeJob(j.id)} className="px-2 py-1 bg-red-500 rounded">
                        <Text className="text-white text-xs">Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                  
                  {j.error && (
                    <View className="mb-2 p-2 bg-red-50 rounded border border-red-200">
                      <Text className="text-red-700 text-xs">{j.error}</Text>
                    </View>
                  )}
                  
                  <View className="h-2 bg-gray-200 rounded">
                    <View 
                      style={{ width: `${Math.round((j.progress||0)*100)}%` }} 
                      className={`h-2 rounded ${
                        j.status === 'complete' ? 'bg-green-500' : 
                        j.status === 'failed' ? 'bg-red-500' : 
                        j.status === 'paused' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} 
                    />
                  </View>
                  <Text className="text-gray-400 text-xs mt-1">
                    {Math.round((j.progress||0)*100)}% • {j.retries > 0 ? `${j.retries} retries` : 'No retries'}
                  </Text>
                </View>
              ))}
              <View className="flex-row gap-2">
                <Pressable onPress={() => clearCompleted()} className="flex-1 px-3 py-3 bg-gray-200 rounded">
                  <Text className="text-center text-gray-800">Clear Completed</Text>
                </Pressable>
                <Pressable onPress={async () => { await pump(); }} className="flex-1 px-3 py-3 bg-blue-600 rounded">
                  <Text className="text-center text-white">Upload All Now</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Dropbox Setup Wizard */}
      <DropboxSetupWizard
        visible={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
        onComplete={handleSetupWizardComplete}
      />
      
      {/* Simple Login Modal */}
      <DropboxSimpleLogin
        visible={showSimpleLogin}
        onClose={() => setShowSimpleLogin(false)}
        onSuccess={handleSimpleLoginSuccess}
      />
      
      {/* Debug Panel (Development Only) */}
      {__DEV__ && (
        <DropboxDebugPanel
          visible={showDebugPanel}
          onClose={() => setShowDebugPanel(false)}
        />
      )}
    </SafeAreaView>
  );
}
