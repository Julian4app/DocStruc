import * as React from "react";
import { TouchableOpacity, Text, StyleSheet, GestureResponderEvent, ViewStyle, TextStyle, StyleProp } from "react-native";
import { colors } from "@docstruc/theme";

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: (event: GestureResponderEvent) => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export function Button({ children, onClick, variant = 'primary', style, textStyle, size = 'medium', disabled }: ButtonProps) {
  const getBackgroundColor = () => {
    if (disabled && variant !== 'outline' && variant !== 'ghost') return '#e2e8f0'; 
    switch (variant) {
      case 'secondary': return colors.secondary; // #2E3238
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      default: return colors.primary; // #0E2A47
    }
  };

  const getTextColor = () => {
    if (disabled) return '#94a3b8';
    if (variant === 'outline') return '#475569';
    if (variant === 'ghost') return colors.primary;
    return '#FFFFFF';
  };

  return (
    <TouchableOpacity
      onPress={onClick}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.button,
        size === 'large' && styles.buttonLarge,
        size === 'small' && styles.buttonSmall,
        { backgroundColor: getBackgroundColor() },
        variant === 'outline' && styles.buttonOutline,
        style
      ]}
    >
      <Text style={[styles.text, { color: getTextColor() }, textStyle]}>{children}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: 'row',
    gap: 8,
  },
  buttonLarge: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  buttonSmall: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  buttonOutline: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
  }
});
