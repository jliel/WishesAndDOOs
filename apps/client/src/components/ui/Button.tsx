import React from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  PressableProps,
  Text,
} from "react-native";
import { useAppTheme } from "@/theme/ThemeProvider";
import { useInteractiveMotion } from "@/lib/motion";

export type ButtonVariant =
  | "primary"
  | "finance"
  | "secondary"
  | "outline"
  | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<PressableProps, "children"> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
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
    hoverScale: size === "sm" ? 1.025 : 1.016,
    pressScale: 0.97,
    hoverLift: -1.5,
    iconSlide: 3,
    disabled: isDisabled,
  });

  const heightMap: Record<ButtonSize, number> = {
    sm: 38,
    md: 44,
    lg: 52,
  };

  const bgMap: Record<ButtonVariant, string> = {
    primary: tokens.primary,
    finance: tokens.finance,
    secondary: isHovered ? tokens.dooSoft : tokens.muted,
    outline: isHovered ? tokens.muted : tokens.card,
    ghost: isHovered ? tokens.muted : "transparent",
  };

  const textMap: Record<ButtonVariant, string> = {
    primary: tokens.primaryForeground,
    finance: tokens.primaryForeground,
    secondary: isHovered ? tokens.doo : tokens.foreground,
    outline: tokens.foreground,
    ghost: tokens.foreground,
  };

  const borderColor =
    variant === "outline"
      ? isHovered
        ? tokens.mutedForeground
        : tokens.border
      : variant === "secondary"
        ? isHovered
          ? tokens.doo
          : tokens.border
        : "transparent";

  const webShadow =
    variant === "primary"
      ? isHovered
        ? isDark
          ? "0 14px 28px -4px rgba(0, 0, 0, 0.65), 0 4px 12px rgba(255, 255, 255, 0.08)"
          : "0 16px 32px -6px rgba(15, 23, 42, 0.32), 0 4px 10px rgba(15, 23, 42, 0.12)"
        : isDark
          ? "0 8px 20px -4px rgba(0, 0, 0, 0.5)"
          : "0 10px 24px -6px rgba(15, 23, 42, 0.22), 0 2px 6px rgba(15, 23, 42, 0.08)"
      : variant === "outline" || variant === "secondary"
        ? isHovered
          ? isDark
            ? "0 8px 20px -4px rgba(0, 0, 0, 0.45)"
            : "0 8px 20px -4px rgba(15, 23, 42, 0.10)"
          : "0 2px 6px rgba(15, 23, 42, 0.04)"
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
            paddingHorizontal: size === "sm" ? 16 : 24,
            backgroundColor: bgMap[variant],
            borderColor,
            borderWidth:
              variant === "outline" || variant === "secondary" ? 1 : 0,
            borderRadius: tokens.radiusControl,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: fullWidth ? "100%" : undefined,
            opacity: isDisabled
              ? 0.5
              : state.pressed
                ? 0.92
                : variant === "primary" && isHovered
                  ? 0.96
                  : 1,
            ...(Platform.OS === "web"
              ? ({
                  boxShadow: webShadow,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  transition:
                    "background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms cubic-bezier(0.22, 1, 0.36, 1)",
                } as any)
              : {}),
          },
          typeof style === "function" ? style(state) : style,
        ]}
        {...props}
      >
        {loading ? (
          <ActivityIndicator size="small" color={textMap[variant]} />
        ) : (
          <>
            {icon ? (
              <Animated.View style={leftIconStyle}>{icon}</Animated.View>
            ) : null}
            <Text
              style={{
                color: textMap[variant],
                fontSize: size === "sm" ? 13 : 15,
                fontWeight: "700",
                letterSpacing: -0.2,
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
