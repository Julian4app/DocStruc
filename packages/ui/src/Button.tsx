import * as React from "react";
import { TouchableOpacity, Text, StyleSheet, GestureResponderEvent, ViewStyle, StyleProp } from "react-native";
import { colors } from "@docstruc/theme";

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: (event: GestureResponderEvent) => void;
  variant?: 'primary' | 'secondary' | 'outline';
  style?: StyleProp<ViewStyle>;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export function Button({ children, onClick, variant = 'primary', style, size = 'medium', disabled }: ButtonProps) {
  const getBackgroundColor = () => {
    if (disabled && variant !== 'outline') return '#e2e8f0'; // gray-200
    switch (variant) {
      case 'secondary': return colors.secondary;
      case 'outline': return 'transparent';
      default: return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return '#64748b'; // gray-500
    if (variant === 'outline') return colors.primary;
    return 'white';
  };

  return (
    <TouchableOpacity
      onPress={onClick}
      disabled={disabled}
      style={[
        styles.button,
        size === 'large' && styles.buttonLarge,
        size === 'small' && styles.buttonSmall,
        { backgroundColor: getBackgroundColor() },
        variant === 'outline' && styles.buttonOutline,
        style
      ]}
    >
      <Text style={[styles.text, { color: getTextColor() }]}>{children}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLarge: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  }
});
