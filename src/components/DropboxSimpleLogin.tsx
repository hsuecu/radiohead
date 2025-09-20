import React, { useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { setAuth } from "../api/storage/oauth";
import { verifyStorageProvider } from "../api/storage/verify";
import { provideTactileFeedback } from "../utils/mobileUX";

type LoginStep = "credentials" | "generating" | "instructions" | "token-entry" | "validating" | "success" | "error";

interface DropboxSimpleLoginProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (auth: any) => void;
}

export default function DropboxSimpleLogin({ visible, onClose, onSuccess }: DropboxSimpleLoginProps) {
  const [currentStep, setCurrentStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setCurrentStep("credentials");
    setEmail("");
    setAccessToken("");
    setRefreshToken("");
    setError("");
    setIsValidating(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateToken = (token: string): { isValid: boolean; error?: string } => {
    if (!token || token.trim().length === 0) {
      return { isValid: false, error: "Access token is required" };
    }

    // Basic Dropbox token format validation
    const trimmedToken = token.trim();
    
    // Dropbox tokens typically start with specific prefixes
    if (!trimmedToken.match(/^[a-zA-Z0-9_-]+$/)) {
      return { isValid: false, error: "Invalid token format. Tokens should only contain letters, numbers, hyphens, and underscores." };
    }

    if (trimmedToken.length < 20) {
      return { isValid: false, error: "Token appears too short. Dropbox tokens are typically longer." };
    }

    if (trimmedToken.length > 200) {
      return { isValid: false, error: "Token appears too long. Please check you copied the correct token." };
    }

    return { isValid: true };
  };

  const handleTokenSubmit = async () => {
    const validation = validateToken(accessToken);
    if (!validation.isValid) {
      setError(validation.error || "Invalid token");
      return;
    }

    setIsValidating(true);
    setError("");

    try {
      // Create auth object
      const auth = {
        provider: "dropbox" as const,
        accessToken: accessToken.trim(),
        refreshToken: refreshToken.trim() || null,
        expiresAt: Date.now() + 3600_000, // 1 hour default
        scopes: [],
        accountEmail: email || null,
        accountName: null
      };

      // Save the auth
      await setAuth(auth);

      // Verify the token works
      const verification = await verifyStorageProvider("dropbox", null);
      
      if (verification.verified) {
        setCurrentStep("success");
        // Provide success haptic feedback
        provideTactileFeedback("success");
        setTimeout(() => {
          onSuccess(auth);
          handleClose();
        }, 2000);
      } else {
        setError(verification.message || "Token verification failed. Please check your token and try again.");
        setCurrentStep("error");
        // Provide error haptic feedback
        provideTactileFeedback("error");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setError(`Failed to save token: ${errorMessage}`);
      setCurrentStep("error");
    } finally {
      setIsValidating(false);
    }
  };

  const openDropboxTokenPage = async () => {
    // In a real implementation, this would open the browser
    // For now, we'll show instructions
    setCurrentStep("instructions");
  };

  const renderCredentialsStep = () => (
    <View>
      <View className="items-center mb-6">
        <Ionicons name="person-circle" size={48} color="#0061FF" />
        <Text className="text-2xl font-bold text-gray-900 mt-3">Simple Dropbox Login</Text>
        <Text className="text-gray-600 text-center mt-2">
          Enter your Dropbox email and we'll guide you through getting your access token
        </Text>
      </View>

      <View className="space-y-4">
        <View>
          <Text className="text-gray-700 font-medium mb-2">Dropbox Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="your.email@example.com"
            className="border border-gray-300 rounded-lg px-4 py-3 bg-white"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text className="text-gray-500 text-xs mt-1">
            This helps us personalize the setup process
          </Text>
        </View>

        <View className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={20} color="#3B82F6" />
            <View className="ml-3 flex-1">
              <Text className="text-blue-800 font-medium text-sm mb-1">Why not username/password?</Text>
              <Text className="text-blue-700 text-sm">
                For security, Dropbox doesn't allow apps to handle your password directly. 
                Instead, we'll help you generate a secure access token.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="flex-row gap-3 mt-6">
        <Pressable 
          onPress={handleClose}
          className="flex-1 p-3 bg-gray-200 rounded-lg"
        >
          <Text className="text-gray-800 text-center font-medium">Cancel</Text>
        </Pressable>
        <Pressable 
          onPress={openDropboxTokenPage}
          className="flex-1 p-3 bg-blue-600 rounded-lg"
        >
          <Text className="text-white text-center font-medium">Continue</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderInstructionsStep = () => (
    <ScrollView className="max-h-96">
      <View className="items-center mb-6">
        <Ionicons name="key" size={48} color="#10B981" />
        <Text className="text-2xl font-bold text-gray-900 mt-3">Get Your Access Token</Text>
        <Text className="text-gray-600 text-center mt-2">
          Follow these steps to generate your Dropbox access token
        </Text>
      </View>

      <View className="space-y-4">
        <View className="bg-white border border-gray-200 rounded-lg p-4">
          <View className="flex-row items-center mb-3">
            <View className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Text className="text-white font-bold text-sm">1</Text>
            </View>
            <Text className="text-gray-900 font-semibold ml-3">Create a Dropbox App</Text>
          </View>
          <Text className="text-gray-700 text-sm mb-2">
            • Go to https://www.dropbox.com/developers/apps
          </Text>
          <Text className="text-gray-700 text-sm mb-2">
            • Click "Create app"
          </Text>
          <Text className="text-gray-700 text-sm mb-2">
            • Choose "Scoped access" and "Full Dropbox"
          </Text>
          <Text className="text-gray-700 text-sm">
            • Give your app a name (e.g., "My Personal App")
          </Text>
        </View>

        <View className="bg-white border border-gray-200 rounded-lg p-4">
          <View className="flex-row items-center mb-3">
            <View className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Text className="text-white font-bold text-sm">2</Text>
            </View>
            <Text className="text-gray-900 font-semibold ml-3">Generate Access Token</Text>
          </View>
          <Text className="text-gray-700 text-sm mb-2">
            • In your app settings, scroll to "OAuth 2"
          </Text>
          <Text className="text-gray-700 text-sm mb-2">
            • Click "Generate" under "Generated access token"
          </Text>
          <Text className="text-gray-700 text-sm">
            • Copy the token that appears
          </Text>
        </View>

        <View className="bg-white border border-gray-200 rounded-lg p-4">
          <View className="flex-row items-center mb-3">
            <View className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Text className="text-white font-bold text-sm">3</Text>
            </View>
            <Text className="text-gray-900 font-semibold ml-3">Return Here</Text>
          </View>
          <Text className="text-gray-700 text-sm">
            Come back to this screen and paste your token below
          </Text>
        </View>
      </View>

      <View className="flex-row gap-3 mt-6">
        <Pressable 
          onPress={() => setCurrentStep("credentials")}
          className="flex-1 p-3 bg-gray-200 rounded-lg"
        >
          <Text className="text-gray-800 text-center font-medium">Back</Text>
        </Pressable>
        <Pressable 
          onPress={() => setCurrentStep("token-entry")}
          className="flex-1 p-3 bg-green-600 rounded-lg"
        >
          <Text className="text-white text-center font-medium">I Have My Token</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderTokenEntryStep = () => (
    <ScrollView 
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View className="items-center mb-6">
        <Ionicons name="shield-checkmark" size={48} color="#10B981" />
        <Text className="text-2xl font-bold text-gray-900 mt-3">Enter Your Token</Text>
        <Text className="text-gray-600 text-center mt-2">
          Paste the access token you generated from Dropbox
        </Text>
      </View>

      <View className="space-y-4">
        <View>
          <Text className="text-gray-700 font-medium mb-2">Access Token *</Text>
          <View className="flex-row gap-2">
            <TextInput
              value={accessToken}
              onChangeText={setAccessToken}
              placeholder="Long press here to paste your token"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3 bg-white"
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              secureTextEntry={false} // We want to show the token for verification
            />
            <Pressable 
              onPress={async () => {
                provideTactileFeedback("light");
                try {
                  const text = await Clipboard.getStringAsync();
                  if (text && text.trim().length > 0) {
                    setAccessToken(text.trim());
                    setError("✓ Pasted token from clipboard");
                  } else {
                    setError("Clipboard is empty");
                  }
                } catch (e) {
                  setError("Paste failed");
                }
              }}
              className="px-3 py-2 bg-green-100 rounded-lg justify-center"
            >
              <Ionicons name="clipboard" size={20} color="#10B981" />
            </Pressable>
          </View>
          {accessToken.length > 0 && (
            <Text className="text-green-600 text-xs mt-1">
              ✓ Token length: {accessToken.length} characters
            </Text>
          )}
        </View>

        <View>
          <Text className="text-gray-700 font-medium mb-2">Refresh Token (Optional)</Text>
          <TextInput
            value={refreshToken}
            onChangeText={setRefreshToken}
            placeholder="Refresh token (if you have one)"
            className="border border-gray-300 rounded-lg px-4 py-3 bg-white"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
          <Text className="text-gray-500 text-xs mt-1">
            Refresh tokens allow automatic token renewal
          </Text>
        </View>

        <Pressable 
          onPress={() => setRememberMe(!rememberMe)}
          className="flex-row items-center"
        >
          <View className={`w-5 h-5 border-2 rounded ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-gray-300'} mr-3 items-center justify-center`}>
            {rememberMe && <Ionicons name="checkmark" size={12} color="white" />}
          </View>
          <Text className="text-gray-700">Remember my login</Text>
        </Pressable>

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-lg p-3">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        )}
      </View>

      <View className="flex-row gap-3 mt-6">
        <Pressable 
          onPress={() => setCurrentStep("instructions")}
          className="flex-1 p-3 bg-gray-200 rounded-lg"
        >
          <Text className="text-gray-800 text-center font-medium">Back</Text>
        </Pressable>
        <Pressable 
          onPress={handleTokenSubmit}
          disabled={isValidating || !accessToken.trim()}
          className={`flex-1 p-3 rounded-lg ${isValidating || !accessToken.trim() ? 'bg-gray-300' : 'bg-blue-600'}`}
        >
          <Text className={`text-center font-medium ${isValidating || !accessToken.trim() ? 'text-gray-500' : 'text-white'}`}>
            {isValidating ? "Validating..." : "Connect"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderValidatingStep = () => (
    <View className="items-center py-8">
      <ActivityIndicator size="large" color="#0061FF" />
      <Text className="text-xl font-bold text-gray-900 mt-4">Validating Token</Text>
      <Text className="text-gray-600 text-center mt-2">
        Checking your access token and connecting to Dropbox...
      </Text>
    </View>
  );

  const renderSuccessStep = () => (
    <View className="items-center py-8">
      <Ionicons name="checkmark-circle" size={64} color="#10B981" />
      <Text className="text-2xl font-bold text-green-900 mt-4">Connected!</Text>
      <Text className="text-gray-600 text-center mt-2">
        Your Dropbox account has been connected successfully
      </Text>
    </View>
  );

  const renderErrorStep = () => (
    <View>
      <View className="items-center mb-6">
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-2xl font-bold text-red-900 mt-3">Connection Failed</Text>
        <Text className="text-gray-600 text-center mt-2">
          We couldn't connect with the provided token
        </Text>
      </View>

      {error && (
        <View className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <Text className="text-red-800 font-semibold mb-2">Error Details:</Text>
          <Text className="text-red-700 text-sm">{error}</Text>
        </View>
      )}

      <View className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <Text className="text-blue-800 font-semibold mb-2">Common Issues:</Text>
        <Text className="text-blue-700 text-sm mb-1">• Token was copied incorrectly</Text>
        <Text className="text-blue-700 text-sm mb-1">• Token has expired</Text>
        <Text className="text-blue-700 text-sm mb-1">• Dropbox app doesn't have required permissions</Text>
        <Text className="text-blue-700 text-sm">• Network connection issues</Text>
      </View>

      <View className="flex-row gap-3">
        <Pressable 
          onPress={() => setCurrentStep("token-entry")}
          className="flex-1 p-3 bg-blue-600 rounded-lg"
        >
          <Text className="text-white text-center font-medium">Try Again</Text>
        </Pressable>
        <Pressable 
          onPress={handleClose}
          className="flex-1 p-3 bg-gray-200 rounded-lg"
        >
          <Text className="text-gray-800 text-center font-medium">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "credentials": return renderCredentialsStep();
      case "instructions": return renderInstructionsStep();
      case "token-entry": return renderTokenEntryStep();
      case "validating": return renderValidatingStep();
      case "success": return renderSuccessStep();
      case "error": return renderErrorStep();
      default: return renderCredentialsStep();
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView 
          className="flex-1" 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View className="flex-1 justify-center bg-black bg-opacity-50 px-4">
            <View className="bg-white rounded-2xl p-6 max-h-5/6">
              {renderCurrentStep()}
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}