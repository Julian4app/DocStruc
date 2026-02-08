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
    if (variant === 'outline' || variant === 'ghost') return colors.primary;
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
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: 'row',
    gap: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  buttonLarge: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  buttonSmall: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonOutline: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  }
});
