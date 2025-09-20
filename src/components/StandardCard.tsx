import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type CardVariant = "default" | "compact" | "info" | "warning" | "error" | "success";

export interface StandardCardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  rightAction?: React.ReactNode;
  style?: any;
}

export function StandardCard({
  children,
  variant = "default",
  onPress,
  title,
  subtitle,
  icon,
  iconColor,
  rightAction,
  style,
}: StandardCardProps) {
  const getCardStyles = () => {
    const baseStyles = "rounded-xl shadow-sm";
    
    const variantStyles = {
      default: "bg-white p-6",
      compact: "bg-white p-4",
      info: "bg-blue-50 border border-blue-200 p-4",
      warning: "bg-amber-50 border border-amber-200 p-4",
      error: "bg-red-50 border border-red-200 p-4",
      success: "bg-green-50 border border-green-200 p-4"
    };
    
    return `${baseStyles} ${variantStyles[variant]}`;
  };
  
  const getTitleColor = () => {
    switch (variant) {
      case "info": return "text-blue-800";
      case "warning": return "text-amber-800";
      case "error": return "text-red-800";
      case "success": return "text-green-800";
      default: return "text-gray-800";
    }
  };
  
  const getSubtitleColor = () => {
    switch (variant) {
      case "info": return "text-blue-700";
      case "warning": return "text-amber-700";
      case "error": return "text-red-700";
      case "success": return "text-green-700";
      default: return "text-gray-600";
    }
  };
  
  const getDefaultIconColor = () => {
    switch (variant) {
      case "info": return "#3B82F6";
      case "warning": return "#F59E0B";
      case "error": return "#EF4444";
      case "success": return "#10B981";
      default: return "#6B7280";
    }
  };
  
  const CardContent = () => (
    <View className={getCardStyles()} style={style}>
      {/* Header with title, subtitle, icon, and right action */}
      {(title || subtitle || icon || rightAction) && (
        <View className="flex-row items-start justify-between mb-4">
          <View className="flex-1 flex-row items-center">
            {icon && (
              <View className="mr-3">
                <Ionicons 
                  name={icon} 
                  size={20} 
                  color={iconColor || getDefaultIconColor()} 
                />
              </View>
            )}
            <View className="flex-1">
              {title && (
                <Text className={`font-semibold ${getTitleColor()} ${variant === "compact" ? "text-base" : "text-lg"}`}>
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text className={`${getSubtitleColor()} ${variant === "compact" ? "text-sm" : "text-base"} ${title ? "mt-1" : ""}`}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
          {rightAction && (
            <View className="ml-3">
              {rightAction}
            </View>
          )}
        </View>
      )}
      
      {/* Card Content */}
      {children}
    </View>
  );
  
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }: { pressed: boolean }) => ({
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }]
        })}
      >
        <CardContent />
      </Pressable>
    );
  }
  
  return <CardContent />;
}

export interface ListCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBackgroundColor?: string;
  rightContent?: React.ReactNode;
  onPress?: () => void;
  badge?: {
    text: string;
    variant?: "default" | "success" | "warning" | "error";
  };
  style?: any;
}

export function ListCard({
  title,
  subtitle,
  description,
  icon,
  iconColor = "white",
  iconBackgroundColor = "#6B7280",
  rightContent,
  onPress,
  badge,
  style,
}: ListCardProps) {
  const getBadgeStyles = () => {
    const baseStyles = "px-2 py-1 rounded-full";
    
    switch (badge?.variant) {
      case "success": return `${baseStyles} bg-green-100 border border-green-200`;
      case "warning": return `${baseStyles} bg-amber-100 border border-amber-200`;
      case "error": return `${baseStyles} bg-red-100 border border-red-200`;
      default: return `${baseStyles} bg-gray-100 border border-gray-200`;
    }
  };
  
  const getBadgeTextColor = () => {
    switch (badge?.variant) {
      case "success": return "text-green-700";
      case "warning": return "text-amber-700";
      case "error": return "text-red-700";
      default: return "text-gray-700";
    }
  };
  
  const CardContent = () => (
    <View className="bg-white rounded-lg p-4 shadow-sm flex-row items-center" style={style}>
      {/* Icon */}
      {icon && (
        <View 
          className="w-12 h-12 rounded-full items-center justify-center mr-4"
          style={{ backgroundColor: iconBackgroundColor }}
        >
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
      )}
      
      {/* Content */}
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-gray-800 text-base flex-1">{title}</Text>
          {badge && (
            <View className={getBadgeStyles()}>
              <Text className={`${getBadgeTextColor()} text-xs font-medium`}>
                {badge.text}
              </Text>
            </View>
          )}
        </View>
        
        {subtitle && (
          <Text className="text-gray-500 text-sm mt-1">{subtitle}</Text>
        )}
        
        {description && (
          <Text className="text-gray-600 text-sm mt-2">{description}</Text>
        )}
      </View>
      
      {/* Right Content */}
      {rightContent && (
        <View className="ml-3">
          {rightContent}
        </View>
      )}
      
      {/* Chevron for pressable cards */}
      {onPress && !rightContent && (
        <View className="ml-3">
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </View>
      )}
    </View>
  );
  
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }: { pressed: boolean }) => ({
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }]
        })}
      >
        <CardContent />
      </Pressable>
    );
  }
  
  return <CardContent />;
}