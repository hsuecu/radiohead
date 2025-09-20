import React from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    this.props.onError?.(error, errorInfo);
    
    // Provide haptic feedback for errors
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Ignore haptic errors
    }
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore haptic errors
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.retry} />;
      }

      return (
        <SafeAreaView className="flex-1 bg-gray-50">
          <View className="flex-1 items-center justify-center px-6">
            <View className="items-center mb-6">
              <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="warning" size={32} color="#EF4444" />
              </View>
              <Text className="text-xl font-bold text-gray-800 mb-2 text-center">
                Something went wrong
              </Text>
              <Text className="text-gray-600 text-center leading-relaxed">
                The app encountered an unexpected error. This has been logged and we'll work to fix it.
              </Text>
            </View>

            {__DEV__ && this.state.error && (
              <View className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 w-full">
                <Text className="text-red-800 font-medium mb-2">Error Details (Dev Mode)</Text>
                <Text className="text-red-700 text-sm font-mono">
                  {this.state.error.name}: {this.state.error.message}
                </Text>
                {this.state.error.stack && (
                  <Text className="text-red-600 text-xs font-mono mt-2" numberOfLines={5}>
                    {this.state.error.stack}
                  </Text>
                )}
              </View>
            )}

            <View className="flex-row gap-3 w-full">
              <Pressable 
                onPress={this.retry} 
                className="flex-1 bg-blue-500 rounded-lg py-4"
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons name="refresh" size={20} color="white" />
                  <Text className="text-white font-medium ml-2">Try Again</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
  );
}

    return this.props.children;
  }
}

// Hook for functional components to handle async errors
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error) => {
    setError(error);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Ignore haptic errors
    }
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  // Throw error to be caught by ErrorBoundary
  if (error) {
    throw error;
  }

  return { handleError, clearError };
}

// Loading state component
export function LoadingState({ 
  message = "Loading...", 
  size = "large" 
}: { 
  message?: string; 
  size?: "small" | "large" 
}) {
  return (
    <View className={`items-center justify-center ${size === "large" ? "py-12" : "py-6"}`}>
      <View className={`${size === "large" ? "w-8 h-8" : "w-6 h-6"} mb-3`}>
        <View className="w-full h-full border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </View>
      <Text className={`text-gray-600 ${size === "large" ? "text-base" : "text-sm"}`}>
        {message}
      </Text>
    </View>
  );
}

// Error state component
export function ErrorState({ 
  message = "Something went wrong", 
  onRetry, 
  size = "large" 
}: { 
  message?: string; 
  onRetry?: () => void; 
  size?: "small" | "large" 
}) {
  return (
    <View className={`items-center justify-center ${size === "large" ? "py-12" : "py-6"}`}>
      <View className={`${size === "large" ? "w-12 h-12" : "w-8 h-8"} bg-red-100 rounded-full items-center justify-center mb-3`}>
        <Ionicons name="alert-circle" size={size === "large" ? 24 : 16} color="#EF4444" />
      </View>
      <Text className={`text-gray-800 font-medium mb-2 text-center ${size === "large" ? "text-base" : "text-sm"}`}>
        {message}
      </Text>
      {onRetry && (
        <Pressable 
          onPress={onRetry} 
          className={`bg-blue-500 rounded-lg ${size === "large" ? "px-4 py-2" : "px-3 py-1"}`}
        >
          <Text className={`text-white font-medium ${size === "large" ? "text-sm" : "text-xs"}`}>
            Try Again
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// Empty state component
export function EmptyState({ 
  icon = "folder-outline", 
  title = "No items", 
  message = "Nothing to show here yet", 
  action,
  size = "large" 
}: { 
  icon?: keyof typeof Ionicons.glyphMap; 
  title?: string; 
  message?: string; 
  action?: { label: string; onPress: () => void }; 
  size?: "small" | "large" 
}) {
  return (
    <View className={`items-center justify-center ${size === "large" ? "py-12" : "py-6"}`}>
      <Ionicons 
        name={icon} 
        size={size === "large" ? 48 : 32} 
        color="#9CA3AF" 
        style={{ marginBottom: 12 }} 
      />
      <Text className={`text-gray-800 font-medium mb-2 text-center ${size === "large" ? "text-lg" : "text-base"}`}>
        {title}
      </Text>
      <Text className={`text-gray-600 text-center mb-4 ${size === "large" ? "text-base" : "text-sm"}`}>
        {message}
      </Text>
      {action && (
        <Pressable 
          onPress={action.onPress} 
          className={`bg-blue-500 rounded-lg ${size === "large" ? "px-6 py-3" : "px-4 py-2"}`}
        >
          <Text className={`text-white font-medium ${size === "large" ? "text-base" : "text-sm"}`}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}