import React from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";
export type ButtonSize = "small" | "medium" | "large";

export interface StandardButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: any;
}

export function StandardButton({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  icon,
  iconPosition = "left",
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: StandardButtonProps) {
  const getButtonStyles = () => {
    const baseStyles = "rounded-lg flex-row items-center justify-center";
    
    // Size styles
    const sizeStyles = {
      small: "px-3 py-2",
      medium: "px-4 py-3", 
      large: "px-6 py-4"
    };
    
    // Variant styles
    const variantStyles = {
      primary: disabled ? "bg-blue-300" : "bg-blue-500",
      secondary: disabled ? "bg-gray-100" : "bg-gray-200",
      destructive: disabled ? "bg-red-300" : "bg-red-500",
      ghost: "bg-transparent"
    };
    
    const widthStyle = fullWidth ? "w-full" : "";
    
    return `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyle}`;
  };
  
  const getTextStyles = () => {
    const baseStyles = "font-medium";
    
    const sizeStyles = {
      small: "text-sm",
      medium: "text-base",
      large: "text-lg"
    };
    
    const variantStyles = {
      primary: disabled ? "text-blue-100" : "text-white",
      secondary: disabled ? "text-gray-400" : "text-gray-700",
      destructive: disabled ? "text-red-100" : "text-white",
      ghost: disabled ? "text-gray-400" : "text-gray-600"
    };
    
    return `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]}`;
  };
  
  const getIconColor = () => {
    if (disabled) {
      return variant === "primary" ? "#BFDBFE" :
             variant === "secondary" ? "#9CA3AF" :
             variant === "destructive" ? "#FECACA" :
             "#9CA3AF";
    }
    
    return variant === "primary" ? "white" :
           variant === "secondary" ? "#374151" :
           variant === "destructive" ? "white" :
           "#6B7280";
  };
  
  const getIconSize = () => {
    return size === "small" ? 16 : size === "large" ? 24 : 20;
  };
  
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={getButtonStyles()}
      style={[
        { opacity: disabled ? 0.6 : 1 },
        ({ pressed }: { pressed: boolean }) => ({
          opacity: pressed ? 0.8 : disabled ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }]
        }),
        style
      ]}
    >
      {icon && iconPosition === "left" && (
        <Ionicons 
          name={loading ? "hourglass" : icon} 
          size={getIconSize()} 
          color={getIconColor()}
          style={{ marginRight: 8 }}
        />
      )}
      
      <Text className={getTextStyles()}>
        {loading ? "Loading..." : title}
      </Text>
      
      {icon && iconPosition === "right" && (
        <Ionicons 
          name={loading ? "hourglass" : icon} 
          size={getIconSize()} 
          color={getIconColor()}
          style={{ marginLeft: 8 }}
        />
      )}
    </Pressable>
  );
}

export interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: any;
}

export function IconButton({
  icon,
  onPress,
  variant = "secondary",
  size = "medium",
  disabled = false,
  loading = false,
  style,
}: IconButtonProps) {
  const getButtonStyles = () => {
    const baseStyles = "rounded-full items-center justify-center";
    
    // Size styles (square dimensions)
    const sizeStyles = {
      small: "w-8 h-8",
      medium: "w-12 h-12",
      large: "w-16 h-16"
    };
    
    // Variant styles
    const variantStyles = {
      primary: disabled ? "bg-blue-300" : "bg-blue-500",
      secondary: disabled ? "bg-gray-100" : "bg-gray-200",
      destructive: disabled ? "bg-red-300" : "bg-red-500",
      ghost: "bg-transparent"
    };
    
    return `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]}`;
  };
  
  const getIconColor = () => {
    if (disabled) {
      return variant === "primary" ? "#BFDBFE" :
             variant === "secondary" ? "#9CA3AF" :
             variant === "destructive" ? "#FECACA" :
             "#9CA3AF";
    }
    
    return variant === "primary" ? "white" :
           variant === "secondary" ? "#374151" :
           variant === "destructive" ? "white" :
           "#6B7280";
  };
  
  const getIconSize = () => {
    return size === "small" ? 14 : size === "large" ? 28 : 20;
  };
  
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={getButtonStyles()}
      style={[
        { opacity: disabled ? 0.6 : 1 },
        ({ pressed }: { pressed: boolean }) => ({
          opacity: pressed ? 0.8 : disabled ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }]
        }),
        style
      ]}
    >
      <Ionicons 
        name={loading ? "hourglass" : icon} 
        size={getIconSize()} 
        color={getIconColor()}
      />
    </Pressable>
  );
}