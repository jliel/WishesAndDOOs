import React from "react";
import {
  Animated,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { useInteractiveMotion } from "@/lib/motion";

export type IconButtonVariant = "default" | "destructive" | "finance" | "wish" | "ghost";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps extends Omit<PressableProps, "children" | "style"> {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  accessibilityLabel,
  variant = "default",
  size = "md",
  disabled = false,
  style,
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
  ...props
}: IconButtonProps) {
  const { tokens, colorMode } = useAppTheme();
  const isDark = colorMode === "dark";

  const {
    isHovered,
    animatedStyle,
    onHoverIn: handleHoverIn,
    onHoverOut: handleHoverOut,
    onPressIn: handlePressIn,
    onPressOut: handlePressOut,
  } = useInteractiveMotion({
    hoverScale: 1.08,
    hoverLift: -1.5,
    pressScale: 0.92,
    disabled: Boolean(disabled),
  });

  const sizeMap: Record<IconButtonSize, { box: number; icon: number }> = {
    sm: { box: 28, icon: 14 },
    md: { box: 34, icon: 16 },
    lg: { box: 40, icon: 20 },
  };

  const dim = sizeMap[size];

  // Dynamic hover color mapping
  const getColors = () => {
    switch (variant) {
      case "destructive":
        return {
          bg: isHovered ? (isDark ? "rgba(239, 68, 68, 0.22)" : "#FEE2E2") : tokens.muted,
          border: isHovered ? tokens.destructive : "transparent",
          icon: isHovered ? tokens.destructive : tokens.mutedForeground,
        };
      case "finance":
        return {
          bg: isHovered ? (isDark ? "rgba(16, 185, 129, 0.22)" : "#D1FAE5") : tokens.muted,
          border: isHovered ? tokens.finance : "transparent",
          icon: isHovered ? tokens.finance : tokens.mutedForeground,
        };
      case "wish":
        return {
          bg: isHovered ? (isDark ? "rgba(124, 58, 237, 0.22)" : "#EDE9FE") : tokens.muted,
          border: isHovered ? tokens.wish : "transparent",
          icon: isHovered ? tokens.wish : tokens.foreground,
        };
      case "ghost":
        return {
          bg: isHovered ? (isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.06)") : "transparent",
          border: isHovered ? tokens.border : "transparent",
          icon: isHovered ? tokens.foreground : tokens.mutedForeground,
        };
      case "default":
      default:
        return {
          bg: isHovered ? (isDark ? "#334155" : "#E2E8F0") : tokens.muted,
          border: isHovered ? tokens.border : "transparent",
          icon: isHovered ? tokens.foreground : tokens.mutedForeground,
        };
    }
  };

  const colors = getColors();

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onHoverIn={(e) => {
          handleHoverIn();
          onHoverIn?.(e);
        }}
        onHoverOut={(e) => {
          handleHoverOut();
          onHoverOut?.(e);
        }}
        onPressIn={(e) => {
          handlePressIn();
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          handlePressOut();
          onPressOut?.(e);
        }}
        style={[
          {
            width: dim.box,
            height: dim.box,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.bg,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: disabled ? 0.4 : 1,
          },
          Platform.OS === "web"
            ? ({
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "background-color 180ms cubic-bezier(0.16, 1, 0.3, 1), border-color 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 180ms cubic-bezier(0.16, 1, 0.3, 1)",
              } as any)
            : null,
          style,
        ]}
        {...props}
      >
        <MaterialIcons name={icon} size={dim.icon} color={colors.icon} />
      </Pressable>
    </Animated.View>
  );
}
