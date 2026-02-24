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

/**
 * Render button children correctly:
 * - Plain strings/numbers → wrapped in styled <Text>
 * - Icons and other elements → rendered as-is (flex row layout from TouchableOpacity)
 * This fixes icon+text misalignment caused by wrapping SVGs inside <Text>.
 */
/**
 * Clone an icon element and inject the button's text color if the icon
 * doesn't already have an explicit color prop set.
 */
function colorizeIcon(node: React.ReactElement, textColor: string): React.ReactElement {
  const props = node.props as any;
  if (props.color) return node; // caller already set a color — respect it
  return React.cloneElement(node, { color: textColor } as any);
}

function renderChildren(
  children: React.ReactNode,
  textColor: string,
  textStyle?: StyleProp<TextStyle>,
  size?: 'small' | 'medium' | 'large'
) {
  const fontSize = size === 'large' ? 15 : size === 'small' ? 13 : 14;
  const textSty = [styles.text, { color: textColor, fontSize }, textStyle];

  if (typeof children === 'string' || typeof children === 'number') {
    return <Text style={textSty}>{children}</Text>;
  }

  // Flatten fragments so <><Icon /> "text</> works correctly
  const flattenNodes = (nodes: React.ReactNode[]): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    for (const node of nodes) {
      if (React.isValidElement(node) && (node.type === React.Fragment)) {
        result.push(...flattenNodes(React.Children.toArray((node.props as any).children)));
      } else {
        result.push(node);
      }
    }
    return result;
  };

  const nodes = flattenNodes(React.Children.toArray(children));

  if (nodes.length === 1) {
    const node = nodes[0];
    if (typeof node === 'string' || typeof node === 'number') {
      return <Text style={textSty}>{node}</Text>;
    }
    if (React.isValidElement(node)) {
      return <>{colorizeIcon(node, textColor)}</>;
    }
    return <>{node}</>;
  }

  return (
    <>
      {nodes.map((child, i) => {
        if (typeof child === 'string' || typeof child === 'number') {
          return <Text key={i} style={textSty}>{child}</Text>;
        }
        if (React.isValidElement(child)) {
          return <React.Fragment key={i}>{colorizeIcon(child, textColor)}</React.Fragment>;
        }
        return <React.Fragment key={i}>{child}</React.Fragment>;
      })}
    </>
  );
}

export function Button({ children, onClick, variant = 'primary', style, textStyle, size = 'medium', disabled }: ButtonProps) {
  const getBackgroundColor = () => {
    if (disabled && variant !== 'outline' && variant !== 'ghost') return '#e2e8f0';
    switch (variant) {
      case 'secondary': return colors.secondary;
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      default: return colors.primary;
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
        style,
      ]}
    >
      {renderChildren(children, getTextColor(), textStyle, size)}
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
    lineHeight: 20,
  }
});
