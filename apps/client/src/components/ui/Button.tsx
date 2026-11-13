import React from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  Text,
  ViewStyle,
} from "react-native";
import { useAppTheme } from "@/theme/ThemeProvider";
import { useInteractiveMotion } from "@/lib/motion";

export type ButtonVariant =
  | "primary"
  | "finance"
  | "wish"
  | "destructive"
  | "secondary"
  | "outline"
  | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
}

export function Button({
  label,
  variant = "primary",
  size = "lg",
  loading = false,
  disabled = false,
  icon,
  rightIcon,
  fullWidth = false,
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
  style,
  ...props
}: ButtonProps) {
  const { tokens, colorMode } = useAppTheme();
  const isDark = colorMode === "dark";
  const isDisabled = Boolean(disabled || loading);

  const {
    isHovered,
    animatedStyle,
    rightIconStyle,
    leftIconStyle,
    onHoverIn: handleHoverIn,
    onHoverOut: handleHoverOut,
    onPressIn: handlePressIn,
    onPressOut: handlePressOut,
  } = useInteractiveMotion({
    hoverScale: 1.02,
    pressScale: 0.97,
    hoverLift: -1.5,
    iconSlide: 2,
    disabled: isDisabled,
  });

  const heightMap: Record<ButtonSize, number> = {
    sm: 36,
    md: 42,
    lg: 48,
  };

  // Color logic for default & hover states
  const getButtonTheme = () => {
    switch (variant) {
      case "primary":
      case "wish":
        return {
          bg: isHovered ? (isDark ? "#8B5CF6" : "#6D28D9") : tokens.primary,
          border: isHovered ? (isDark ? "#A78BFA" : "#5B21B6") : tokens.primary,
          text: tokens.primaryForeground,
          borderWidth: 1,
        };
      case "finance":
        return {
          bg: isHovered ? (isDark ? "#10B981" : "#047857") : tokens.finance,
          border: isHovered ? (isDark ? "#34D399" : "#065F46") : tokens.finance,
          text: tokens.primaryForeground,
          borderWidth: 1,
        };
      case "destructive":
        return {
          bg: isHovered ? (isDark ? "#EF4444" : "#B91C1C") : tokens.destructive,
          border: isHovered ? (isDark ? "#F87171" : "#991B1B") : tokens.destructive,
          text: tokens.primaryForeground,
          borderWidth: 1,
        };
      case "secondary":
        return {
          bg: isHovered ? tokens.dooSoft : tokens.muted,
          border: isHovered ? tokens.doo : tokens.border,
          text: isHovered ? tokens.doo : tokens.foreground,
          borderWidth: 1,
        };
      case "outline":
        return {
          bg: isHovered
            ? (isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.05)")
            : tokens.card,
          border: isHovered ? tokens.foreground : tokens.border,
          text: tokens.foreground,
          borderWidth: 1,
        };
      case "ghost":
        return {
          bg: isHovered
            ? (isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.06)")
            : "transparent",
          border: "transparent",
          text: isHovered ? tokens.foreground : tokens.mutedForeground,
          borderWidth: 0,
        };
      default:
        return {
          bg: tokens.primary,
          border: tokens.primary,
          text: tokens.primaryForeground,
          borderWidth: 1,
        };
    }
  };

  const buttonColors = getButtonTheme();

  const webShadow = isHovered && !isDisabled
    ? isDark
      ? "0 10px 24px -4px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(124, 58, 237, 0.18)"
      : "0 12px 24px -6px rgba(15, 23, 42, 0.16), 0 3px 8px rgba(124, 58, 237, 0.12)"
    : "none";

  return (
    <Animated.View
      style={[
        {
          width: fullWidth ? "100%" : undefined,
        },
        animatedStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={isDisabled}
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
        style={(state) => [
          {
            minHeight: heightMap[size],
            paddingHorizontal: size === "sm" ? 14 : size === "md" ? 18 : 24,
            backgroundColor: buttonColors.bg,
            borderColor: buttonColors.border,
            borderWidth: buttonColors.borderWidth,
            borderRadius: tokens.radiusControl,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: fullWidth ? "100%" : undefined,
            opacity: isDisabled ? 0.45 : state.pressed ? 0.9 : 1,
            ...(Platform.OS === "web"
              ? ({
                  boxShadow: webShadow,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  transition:
                    "background-color 160ms cubic-bezier(0.16, 1, 0.3, 1), border-color 160ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 160ms cubic-bezier(0.16, 1, 0.3, 1)",
                } as any)
              : {}),
          },
          typeof style === "function" ? style(state) : style,
        ]}
        {...props}
      >
        {loading ? (
          <ActivityIndicator size="small" color={buttonColors.text} />
        ) : (
          <>
            {icon ? (
              <Animated.View style={leftIconStyle}>{icon}</Animated.View>
            ) : null}
            <Text
              style={{
                color: buttonColors.text,
                fontSize: size === "sm" ? 13 : 14,
                fontWeight: "700",
                letterSpacing: -0.2,
                fontFamily: "Plus Jakarta Sans",
              }}
            >
              {label}
            </Text>
            {rightIcon ? (
              <Animated.View style={rightIconStyle}>{rightIcon}</Animated.View>
            ) : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
