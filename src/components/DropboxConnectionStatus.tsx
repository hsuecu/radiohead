import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { checkConfigurationHealth, type ConfigurationHealth } from "../utils/dropboxValidator";
import { getAuth } from "../api/storage/oauth";

type ConnectionStatusProps = {
  onPress?: () => void;
  showDetails?: boolean;
  className?: string;
};

export function DropboxConnectionStatus({ onPress, showDetails = false, className = "" }: ConnectionStatusProps) {
  const [health, setHealth] = useState<ConfigurationHealth | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const [healthResult, auth] = await Promise.all([
        checkConfigurationHealth(),
        getAuth("dropbox")
      ]);
      
      setHealth(healthResult);
      setIsConnected(!!auth?.accessToken);
    } catch (error) {
      console.error("Failed to check Dropbox status:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = () => {
    if (loading) {
      return {
        icon: "sync" as const,
        color: "#6B7280",
        text: "Checking...",
        subtext: "Validating configuration"
      };
    }

    if (isConnected) {
      return {
        icon: "cloud-done" as const,
        color: "#10B981",
        text: "Connected",
        subtext: "Dropbox integration active"
      };
    }

    if (!health) {
      return {
        icon: "alert-circle" as const,
        color: "#EF4444",
        text: "Error",
        subtext: "Failed to check status"
      };
    }

    switch (health.overall) {
      case "healthy":
        return {
          icon: "checkmark-circle" as const,
          color: "#10B981",
          text: "Ready",
          subtext: "Ready to connect"
        };
      case "warning":
        return {
          icon: "warning" as const,
          color: "#F59E0B",
          text: "Warning",
          subtext: health.nextSteps[0] || "Configuration needs attention"
        };
      case "error":
        return {
          icon: "alert-circle" as const,
          color: "#EF4444",
          text: "Error",
          subtext: health.nextSteps[0] || "Configuration required"
        };
      case "unconfigured":
        return {
          icon: "cloud-offline" as const,
          color: "#6B7280",
          text: "Demo Mode",
          subtext: "Switch to real mode when ready"
        };
      default:
        return {
          icon: "help-circle" as const,
          color: "#6B7280",
          text: "Unknown",
          subtext: "Status unclear"
        };
    }
  };

  const status = getStatusInfo();

  const StatusContent = () => (
    <View className={`flex-row items-center ${className}`}>
      <View className="mr-3">
        <Ionicons 
          name={status.icon} 
          size={20} 
          color={status.color}
        />
      </View>
      <View className="flex-1">
        <Text className="text-gray-900 font-medium text-sm">
          {status.text}
        </Text>
        {showDetails && (
          <Text className="text-gray-500 text-xs mt-0.5">
            {status.subtext}
          </Text>
        )}
      </View>
      {onPress && (
        <View className="ml-2">
          <Ionicons 
            name="chevron-forward" 
            size={16} 
            color="#9CA3AF"
          />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable 
        onPress={onPress}
        className="bg-white rounded-lg p-4 border border-gray-200"
      >
        <StatusContent />
      </Pressable>
    );
  }

  return (
    <View className="bg-white rounded-lg p-4 border border-gray-200">
      <StatusContent />
    </View>
  );
}

export function DropboxConnectionBadge({ className = "" }: { className?: string }) {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const auth = await getAuth("dropbox");
      setIsConnected(!!auth?.accessToken);
    } catch (error) {
      console.error("Failed to check connection:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className={`flex-row items-center px-2 py-1 rounded-full bg-gray-100 ${className}`}>
        <Ionicons name="sync" size={12} color="#6B7280" />
        <Text className="text-gray-600 text-xs ml-1">Checking</Text>
      </View>
    );
  }

  return (
    <View className={`flex-row items-center px-2 py-1 rounded-full ${isConnected ? "bg-green-100" : "bg-gray-100"} ${className}`}>
      <Ionicons 
        name={isConnected ? "cloud-done" : "cloud-offline"} 
        size={12} 
        color={isConnected ? "#10B981" : "#6B7280"} 
      />
      <Text className={`text-xs ml-1 ${isConnected ? "text-green-700" : "text-gray-600"}`}>
        {isConnected ? "Connected" : "Offline"}
      </Text>
    </View>
  );
}