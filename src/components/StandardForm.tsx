import React from "react";
import { View, Text, TextInput, Switch, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";

export interface StandardTextInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  style?: any;
}

export function StandardTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  numberOfLines = 1,
  error,
  disabled = false,
  required = false,
  style,
}: StandardTextInputProps) {
  return (
    <View style={style}>
      {label && (
        <Text className="text-gray-700 mb-2 font-medium">
          {label}
          {required && <Text className="text-red-500 ml-1">*</Text>}
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        numberOfLines={numberOfLines}
        editable={!disabled}
        className={`border rounded-lg px-3 py-3 bg-white text-gray-800 ${
          error ? "border-red-300" : disabled ? "border-gray-200 bg-gray-50" : "border-gray-300"
        }`}
        placeholderTextColor="#9CA3AF"
      />
      {error && (
        <Text className="text-red-600 text-sm mt-1">{error}</Text>
      )}
    </View>
  );
}

export interface StandardSwitchProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  description?: string;
  disabled?: boolean;
  style?: any;
}

export function StandardSwitch({
  label,
  value,
  onValueChange,
  description,
  disabled = false,
  style,
}: StandardSwitchProps) {
  return (
    <View className="flex-row items-center justify-between" style={style}>
      <View className="flex-1 mr-4">
        <Text className={`font-medium ${disabled ? "text-gray-400" : "text-gray-700"}`}>
          {label}
        </Text>
        {description && (
          <Text className={`text-sm mt-1 ${disabled ? "text-gray-300" : "text-gray-500"}`}>
            {description}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
        thumbColor={value ? "#FFFFFF" : "#9CA3AF"}
      />
    </View>
  );
}

export interface StandardSliderProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  unit?: string;
  showValue?: boolean;
  disabled?: boolean;
  style?: any;
}

export function StandardSlider({
  label,
  value,
  onValueChange,
  minimumValue,
  maximumValue,
  step = 0.01,
  unit = "",
  showValue = true,
  disabled = false,
  style,
}: StandardSliderProps) {
  const formatValue = (val: number) => {
    if (unit === "%") return `${Math.round(val * 100)}%`;
    if (unit === "dB") return `${val.toFixed(1)}dB`;
    if (unit === "ms") return `${Math.round(val)}ms`;
    if (unit === "s") return `${Math.round(val)}s`;
    return `${val.toFixed(2)}${unit}`;
  };
  
  return (
    <View style={style}>
      <View className="flex-row items-center justify-between mb-2">
        <Text className={`font-medium ${disabled ? "text-gray-400" : "text-gray-700"}`}>
          {label}
        </Text>
        {showValue && (
          <Text className={`${disabled ? "text-gray-400" : "text-gray-500"}`}>
            {formatValue(value)}
          </Text>
        )}
      </View>
      <View className="flex-row items-center">
        <Ionicons 
          name="remove" 
          size={18} 
          color={disabled ? "#D1D5DB" : "#6B7280"} 
        />
        <Slider
          style={{ flex: 1, marginHorizontal: 12 }}
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          step={step}
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          minimumTrackTintColor={disabled ? "#D1D5DB" : "#3B82F6"}
          maximumTrackTintColor="#E5E7EB"
          thumbTintColor={disabled ? "#D1D5DB" : "#3B82F6"}
        />
        <Ionicons 
          name="add" 
          size={18} 
          color={disabled ? "#D1D5DB" : "#6B7280"} 
        />
      </View>
    </View>
  );
}

export interface OptionButtonProps {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: (id: string) => void;
  disabled?: boolean;
  variant?: "default" | "compact";
}

export function OptionButton({
  id,
  label,
  icon,
  selected,
  onPress,
  disabled = false,
  variant = "default",
}: OptionButtonProps) {
  const getButtonStyles = () => {
    const baseStyles = "rounded-full border-2 flex-row items-center";
    const sizeStyles = variant === "compact" ? "px-3 py-2" : "px-4 py-3";
    
    if (disabled) {
      return `${baseStyles} ${sizeStyles} border-gray-200 bg-gray-50`;
    }
    
    if (selected) {
      return `${baseStyles} ${sizeStyles} border-blue-500 bg-blue-50`;
    }
    
    return `${baseStyles} ${sizeStyles} border-gray-200 bg-gray-50`;
  };
  
  const getTextStyles = () => {
    const baseStyles = variant === "compact" ? "text-sm" : "text-base";
    
    if (disabled) return `${baseStyles} text-gray-400`;
    if (selected) return `${baseStyles} text-blue-700 font-medium`;
    return `${baseStyles} text-gray-700`;
  };
  
  const getIconColor = () => {
    if (disabled) return "#D1D5DB";
    if (selected) return "#3B82F6";
    return "#6B7280";
  };
  
  return (
    <Pressable
      onPress={() => onPress(id)}
      disabled={disabled}
      className={getButtonStyles()}
      style={({ pressed }: { pressed: boolean }) => ({
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }]
      })}
    >
      {icon && (
        <Ionicons 
          name={icon} 
          size={variant === "compact" ? 16 : 20} 
          color={getIconColor()}
          style={{ marginRight: 8 }}
        />
      )}
      <Text className={getTextStyles()}>{label}</Text>
    </Pressable>
  );
}

export interface OptionGroupProps {
  options: Array<{
    id: string;
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
  }>;
  selectedId: string;
  onSelectionChange: (id: string) => void;
  disabled?: boolean;
  variant?: "default" | "compact";
  layout?: "horizontal" | "vertical";
  style?: any;
}

export function OptionGroup({
  options,
  selectedId,
  onSelectionChange,
  disabled = false,
  variant = "default",
  layout = "horizontal",
  style,
}: OptionGroupProps) {
  const containerClass = layout === "horizontal" ? "flex-row flex-wrap gap-2" : "space-y-2";
  
  return (
    <View className={containerClass} style={style}>
      {options.map((option) => (
        <OptionButton
          key={option.id}
          id={option.id}
          label={option.label}
          icon={option.icon}
          selected={selectedId === option.id}
          onPress={onSelectionChange}
          disabled={disabled}
          variant={variant}
        />
      ))}
    </View>
  );
}