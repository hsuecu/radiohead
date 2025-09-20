import React, { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { validateAppKeyRealTime, getValidationColor, getValidationIcon } from "../utils/dropboxValidator";
import { openDropboxAppConsole, generateRedirectUris, copyToClipboard } from "../utils/dropboxSetupHelper";
import { updateDropboxAppKey, showConfigurationInstructions } from "../utils/configurationManager";
import { getRedirectUriInstructions, getCurrentRedirectUri } from "../utils/redirectUriHelper";


type SetupStep = "welcome" | "create-app" | "configure-app" | "get-key" | "test-key" | "troubleshoot" | "complete";

interface DropboxSetupWizardProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (appKey: string) => void;
}

export default function DropboxSetupWizard({ visible, onClose, onComplete }: DropboxSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>("welcome");
  const [appKey, setAppKey] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const steps: { id: SetupStep; title: string; description: string }[] = [
    { id: "welcome", title: "Welcome", description: "Let's set up your Dropbox integration" },
    { id: "create-app", title: "Create App", description: "Create a new Dropbox app" },
    { id: "configure-app", title: "Configure", description: "Set up permissions and settings" },
    { id: "get-key", title: "Get App Key", description: "Copy your App Key" },
    { id: "test-key", title: "Test", description: "Validate your configuration" },
    { id: "troubleshoot", title: "Troubleshoot", description: "Fix common issues" },
    { id: "complete", title: "Complete", description: "Setup finished!" }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  const handleOpenDropboxConsole = async () => {
    await openDropboxAppConsole();
  };

  const getAppKeyValidation = (key: string) => {
    return validateAppKeyRealTime(key);
  };

  const handleTestKey = async () => {
    setIsValidating(true);
    try {
      const validation = getAppKeyValidation(appKey);
      if (validation.isValid) {
        setCurrentStep("complete");
      } else {
        Alert.alert(
          "Invalid App Key", 
          validation.message + (validation.details ? "\n\n" + validation.details.join("\n") : ""),
          [
            { text: "Try Again", style: "default" },
            { text: "Troubleshoot", onPress: () => setCurrentStep("troubleshoot") }
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        "Error", 
        "Failed to validate App Key",
        [
          { text: "Try Again", style: "default" },
          { text: "Troubleshoot", onPress: () => setCurrentStep("troubleshoot") }
        ]
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleComplete = async () => {
    try {
      const result = await updateDropboxAppKey(appKey);
      
      if (result.success) {
        if (result.requiresRestart) {
          showConfigurationInstructions(appKey);
        }
        onComplete(appKey);
      } else {
        Alert.alert("Configuration Error", result.message);
        return;
      }
    } catch (error) {
      Alert.alert("Error", "Failed to save configuration. Please try again.");
      return;
    }
    
    onClose();
    setCurrentStep("welcome");
    setAppKey("");
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <View>
            <View className="items-center mb-6">
              <Ionicons name="logo-dropbox" size={64} color="#0061FF" />
              <Text className="text-2xl font-bold text-gray-900 mt-4">Dropbox Setup Wizard</Text>
              <Text className="text-gray-600 text-center mt-2">
                We'll guide you through setting up your Dropbox integration step by step.
              </Text>
            </View>
            
            <View className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <Text className="text-blue-800 font-semibold mb-2">What you'll need:</Text>
              <Text className="text-blue-700 text-sm">• A Dropbox account (free or paid)</Text>
              <Text className="text-blue-700 text-sm">• 5-10 minutes to complete setup</Text>
              <Text className="text-blue-700 text-sm">• Access to the Dropbox Developer Console</Text>
            </View>

            <View className="flex-row gap-3">
              <Pressable 
                onPress={onClose}
                className="flex-1 px-4 py-3 bg-gray-200 rounded-lg"
              >
                <Text className="text-gray-800 text-center font-medium">Cancel</Text>
              </Pressable>
              <Pressable 
                onPress={() => setCurrentStep("create-app")}
                className="flex-1 px-4 py-3 bg-blue-600 rounded-lg"
              >
                <Text className="text-white text-center font-medium">Get Started</Text>
              </Pressable>
            </View>
          </View>
        );

      case "create-app":
        return (
          <View>
            <Text className="text-xl font-bold text-gray-900 mb-4">Step 1: Create Dropbox App</Text>
            
            <View className="space-y-4 mb-6">
              <View className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <Text className="text-gray-800 font-medium mb-2">1. Open Dropbox App Console</Text>
                <Text className="text-gray-600 text-sm mb-3">
                  Click the button below to open the Dropbox Developer Console in your browser.
                </Text>
                <Pressable 
                  onPress={handleOpenDropboxConsole}
                  className="bg-blue-600 px-4 py-2 rounded-lg"
                >
                  <Text className="text-white text-center font-medium">Open Dropbox Console</Text>
                </Pressable>
              </View>

              <View className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <Text className="text-gray-800 font-medium mb-2">2. Create New App</Text>
                <Text className="text-gray-600 text-sm">• Click "Create app"</Text>
                <Text className="text-gray-600 text-sm">• Choose "Scoped access"</Text>
                <Text className="text-gray-600 text-sm">• Choose "Full Dropbox"</Text>
                <Text className="text-gray-600 text-sm">• Enter a name for your app</Text>
                <Text className="text-gray-600 text-sm">• Click "Create app"</Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <Pressable 
                onPress={() => setCurrentStep("welcome")}
                className="flex-1 px-4 py-3 bg-gray-200 rounded-lg"
              >
                <Text className="text-gray-800 text-center font-medium">Back</Text>
              </Pressable>
              <Pressable 
                onPress={() => setCurrentStep("configure-app")}
                className="flex-1 px-4 py-3 bg-blue-600 rounded-lg"
              >
                <Text className="text-white text-center font-medium">Next</Text>
              </Pressable>
            </View>
          </View>
        );

      case "configure-app":
        return (
          <View>
            <Text className="text-xl font-bold text-gray-900 mb-4">Step 2: Configure Permissions</Text>
            
            <View className="space-y-4 mb-6">
              <View className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <Text className="text-gray-800 font-medium mb-2">1. Set Permissions</Text>
                <Text className="text-gray-600 text-sm mb-2">Go to the "Permissions" tab and enable:</Text>
                <Text className="text-gray-600 text-sm">✓ files.content.read</Text>
                <Text className="text-gray-600 text-sm">✓ files.content.write</Text>
                <Text className="text-gray-600 text-sm">✓ files.metadata.read</Text>
                <Text className="text-gray-600 text-sm">✓ sharing.read</Text>
                <Text className="text-gray-600 text-sm">✓ sharing.write</Text>
                <Text className="text-gray-600 text-sm mt-2 font-medium">Click "Submit" to save</Text>
              </View>

              <View className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <Text className="text-gray-800 font-medium mb-2">2. Add Redirect URIs</Text>
                <Text className="text-gray-600 text-sm mb-2">Go to "Settings" tab, find "OAuth 2" section, and add:</Text>
                {generateRedirectUris().slice(0, 2).map((uri, index) => (
                  <Pressable 
                    key={index}
                    onPress={() => copyToClipboard(uri, "Redirect URI")}
                    className="bg-white border border-gray-300 rounded p-2 mb-2 flex-row items-center justify-between"
                  >
                    <Text className="text-xs font-mono text-gray-800 flex-1">{uri}</Text>
                    <Ionicons name="copy" size={16} color="#6B7280" />
                  </Pressable>
                ))}
                <Text className="text-gray-600 text-sm">Tap to copy • Add one URI per line, then save.</Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <Pressable 
                onPress={() => setCurrentStep("create-app")}
                className="flex-1 px-4 py-3 bg-gray-200 rounded-lg"
              >
                <Text className="text-gray-800 text-center font-medium">Back</Text>
              </Pressable>
              <Pressable 
                onPress={() => setCurrentStep("get-key")}
                className="flex-1 px-4 py-3 bg-blue-600 rounded-lg"
              >
                <Text className="text-white text-center font-medium">Next</Text>
              </Pressable>
            </View>
          </View>
        );

      case "get-key":
        return (
          <View>
            <Text className="text-xl font-bold text-gray-900 mb-4">Step 3: Get Your App Key</Text>
            
            <View className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <Text className="text-gray-800 font-medium mb-2">Copy Your App Key</Text>
              <Text className="text-gray-600 text-sm mb-3">
                In your Dropbox app settings, find the "App key" field and copy the value.
              </Text>
              <Text className="text-gray-600 text-sm mb-3">
                It should be a long string of letters and numbers (usually 15+ characters).
              </Text>
              
              <Text className="text-gray-700 font-medium mb-2">Paste your App Key here:</Text>
              <TextInput
                value={appKey}
                onChangeText={setAppKey}
                placeholder="Enter your Dropbox App Key"
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-3"
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              {appKey && (
                (() => {
                  const validation = getAppKeyValidation(appKey);
                  const color = getValidationColor(validation.level);
                  const icon = getValidationIcon(validation.level);
                  
                  return (
                    <View className={`border rounded p-2 ${
                      validation.level === "success" ? "bg-green-50 border-green-200" :
                      validation.level === "warning" ? "bg-yellow-50 border-yellow-200" :
                      validation.level === "error" ? "bg-red-50 border-red-200" :
                      "bg-blue-50 border-blue-200"
                    }`}>
                      <View className="flex-row items-center">
                        <Ionicons name={icon as any} size={16} color={color} />
                        <Text className="text-sm font-medium ml-2" style={{ color }}>
                          {validation.message}
                        </Text>
                      </View>
                      {validation.details && validation.details.length > 0 && (
                        <View className="mt-1">
                          {validation.details.map((detail, index) => (
                            <Text key={index} className="text-xs" style={{ color }}>
                              {detail}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })()
              )}
            </View>

            <View className="flex-row gap-3">
              <Pressable 
                onPress={() => setCurrentStep("configure-app")}
                className="flex-1 px-4 py-3 bg-gray-200 rounded-lg"
              >
                <Text className="text-gray-800 text-center font-medium">Back</Text>
              </Pressable>
              <Pressable 
                onPress={() => setCurrentStep("test-key")}
                disabled={!appKey || appKey === "your_dropbox_app_key_here"}
                className={`flex-1 px-4 py-3 rounded-lg ${
                  appKey && appKey !== "your_dropbox_app_key_here" 
                    ? 'bg-blue-600' 
                    : 'bg-gray-300'
                }`}
              >
                <Text className={`text-center font-medium ${
                  appKey && appKey !== "your_dropbox_app_key_here" 
                    ? 'text-white' 
                    : 'text-gray-500'
                }`}>
                  Next
                </Text>
              </Pressable>
            </View>
          </View>
        );

      case "test-key":
        return (
          <View>
            <Text className="text-xl font-bold text-gray-900 mb-4">Step 4: Test Configuration</Text>
            
            <View className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <Text className="text-gray-800 font-medium mb-2">Validate Your App Key</Text>
              <Text className="text-gray-600 text-sm mb-4">
                We'll validate that your App Key has the correct format before saving it.
              </Text>
              
              <View className="bg-white border border-gray-300 rounded p-3 mb-4">
                <Text className="text-gray-700 font-medium text-sm">App Key:</Text>
                <Text className="text-gray-900 font-mono text-sm">{appKey}</Text>
              </View>
              
              <Pressable 
                onPress={handleTestKey}
                disabled={isValidating}
                className={`px-4 py-3 rounded-lg ${isValidating ? 'bg-gray-300' : 'bg-green-600'}`}
              >
                <Text className={`text-center font-medium ${isValidating ? 'text-gray-500' : 'text-white'}`}>
                  {isValidating ? "Validating..." : "Validate App Key"}
                </Text>
              </Pressable>
            </View>

            <View className="flex-row gap-3">
              <Pressable 
                onPress={() => setCurrentStep("get-key")}
                className="flex-1 px-4 py-3 bg-gray-200 rounded-lg"
              >
                <Text className="text-gray-800 text-center font-medium">Back</Text>
              </Pressable>
              <Pressable 
                onPress={() => setCurrentStep("troubleshoot")}
                className="flex-1 px-4 py-3 bg-yellow-600 rounded-lg"
              >
                <Text className="text-white text-center font-medium">Need Help?</Text>
              </Pressable>
            </View>
          </View>
        );

      case "troubleshoot":
        const redirectUriInstructions = getRedirectUriInstructions();
        const currentRedirectUri = getCurrentRedirectUri();
        
        return (
          <View>
            <Text className="text-xl font-bold text-gray-900 mb-4">Troubleshooting</Text>
            
            <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <View className="flex-row items-center mb-2">
                <Ionicons name="warning" size={20} color="#F59E0B" />
                <Text className="text-yellow-800 font-semibold ml-2">Common Issues</Text>
              </View>
              <Text className="text-yellow-700 text-sm">
                If OAuth authentication is failing, here are the most common causes and solutions:
              </Text>
            </View>

            <ScrollView className="max-h-96 mb-6">
              {/* App Key Issues */}
              <View className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                <Text className="text-gray-800 font-semibold mb-2">1. App Key Issues</Text>
                <Text className="text-gray-600 text-sm mb-2">• Ensure you copied the complete App Key</Text>
                <Text className="text-gray-600 text-sm mb-2">• App Key should be 15+ characters long</Text>
                <Text className="text-gray-600 text-sm mb-2">• Don't include spaces or extra characters</Text>
                <Text className="text-gray-600 text-sm">• Use the "App key" not "App secret"</Text>
              </View>

              {/* Redirect URI Issues */}
              <View className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                <Text className="text-gray-800 font-semibold mb-2">2. Redirect URI Configuration</Text>
                <Text className="text-gray-600 text-sm mb-3">
                  Your app is using this redirect URI:
                </Text>
                <View className="bg-gray-100 p-2 rounded mb-3">
                  <Text className="text-gray-800 font-mono text-xs">{currentRedirectUri}</Text>
                </View>
                <Text className="text-gray-600 text-sm mb-2">
                  Make sure this URI is added to your Dropbox app settings:
                </Text>
                {redirectUriInstructions.steps.slice(0, 6).map((step, index) => (
                  <Text key={index} className="text-gray-600 text-sm mb-1">{step}</Text>
                ))}
              </View>

              {/* App Permissions */}
              <View className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                <Text className="text-gray-800 font-semibold mb-2">3. App Permissions</Text>
                <Text className="text-gray-600 text-sm mb-2">Ensure your Dropbox app has these scopes:</Text>
                <Text className="text-gray-600 text-sm mb-1">• files.content.read</Text>
                <Text className="text-gray-600 text-sm mb-1">• files.content.write</Text>
                <Text className="text-gray-600 text-sm mb-1">• files.metadata.read</Text>
                <Text className="text-gray-600 text-sm mb-1">• sharing.read</Text>
                <Text className="text-gray-600 text-sm">• sharing.write</Text>
              </View>

              {/* App Type */}
              <View className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                <Text className="text-gray-800 font-semibold mb-2">4. App Type</Text>
                <Text className="text-gray-600 text-sm mb-2">Your Dropbox app should be configured as:</Text>
                <Text className="text-gray-600 text-sm mb-1">• API: Scoped access</Text>
                <Text className="text-gray-600 text-sm">• Access: Full Dropbox</Text>
              </View>
            </ScrollView>

            <View className="flex-row gap-3">
              <Pressable 
                onPress={() => setCurrentStep("test-key")}
                className="flex-1 px-4 py-3 bg-gray-200 rounded-lg"
              >
                <Text className="text-gray-800 text-center font-medium">Back</Text>
              </Pressable>
              <Pressable 
                onPress={handleOpenDropboxConsole}
                className="flex-1 px-4 py-3 bg-blue-600 rounded-lg"
              >
                <Text className="text-white text-center font-medium">Open Dropbox Console</Text>
              </Pressable>
            </View>
          </View>
        );

      case "complete":
        return (
          <View>
            <View className="items-center mb-6">
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
              <Text className="text-2xl font-bold text-green-900 mt-4">Setup Complete!</Text>
              <Text className="text-gray-600 text-center mt-2">
                Your Dropbox integration is now configured and ready to use.
              </Text>
            </View>
            
            <View className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <Text className="text-green-800 font-semibold mb-2">What's Next:</Text>
              <Text className="text-green-700 text-sm">✓ Your App Key has been saved</Text>
              <Text className="text-green-700 text-sm">✓ Real Dropbox integration is now enabled</Text>
              <Text className="text-green-700 text-sm">✓ You can now connect your Dropbox account</Text>
              <Text className="text-green-700 text-sm">✓ Test the connection in Storage Settings</Text>
            </View>

            <Pressable 
              onPress={handleComplete}
              className="px-4 py-3 bg-green-600 rounded-lg"
            >
              <Text className="text-white text-center font-medium">Finish Setup</Text>
            </Pressable>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-center bg-black bg-opacity-50 px-4">
        <View className="bg-white rounded-2xl max-h-4/5">
          {/* Progress Header */}
          <View className="px-6 py-4 border-b border-gray-200">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-lg font-semibold text-gray-900">
                {steps[currentStepIndex]?.title}
              </Text>
              <Pressable onPress={onClose} className="p-1">
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>
            
            {/* Progress Bar */}
            <View className="flex-row items-center">
              <View className="flex-1 bg-gray-200 rounded-full h-2">
                <View 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
                />
              </View>
              <Text className="text-sm text-gray-500 ml-3">
                {currentStepIndex + 1} of {steps.length}
              </Text>
            </View>
          </View>

          {/* Content */}
          <ScrollView className="px-6 py-4" showsVerticalScrollIndicator={false}>
            {renderStepContent()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}