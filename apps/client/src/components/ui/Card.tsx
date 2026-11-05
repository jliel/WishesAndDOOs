import React from "react";
import { Platform, View, ViewProps } from "react-native";
import { useAppTheme } from "@/theme/ThemeProvider";

export type CardElevation = "none" | "sm" | "md" | "lg" | "floating";

export interface CardProps extends ViewProps {
  variant?: "default" | "muted" | "glass";
  padding?: "none" | "sm" | "md" | "lg";
  elevation?: CardElevation;
  accentBorderColor?: string;
}

export function Card({
  children,
  variant = "default",
  padding = "md",
  elevation = "md",
  accentBorderColor,
  style,
  ...props
}: CardProps) {
  const { tokens, colorMode } = useAppTheme();

  const paddingMap = {
    none: 0,
    sm: 14,
    md: 20,
    lg: 26,
  };

  const isDark = colorMode === "dark";

  const webShadowMap: Record<CardElevation, string> = {
    none: "none",
    sm: isDark
      ? "0 4px 12px rgba(0, 0, 0, 0.25)"
      : "0 2px 8px -2px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.04)",
    md: isDark
      ? "0 12px 28px -6px rgba(0, 0, 0, 0.4)"
      : "0 12px 28px -8px rgba(15, 23, 42, 0.07), 0 4px 10px -3px rgba(15, 23, 42, 0.04)",
    lg: isDark
      ? "0 20px 44px -10px rgba(0, 0, 0, 0.55)"
      : "0 20px 44px -12px rgba(15, 23, 42, 0.10), 0 6px 16px -4px rgba(15, 23, 42, 0.05)",
    floating: isDark
      ? "0 28px 60px -12px rgba(0, 0, 0, 0.65)"
      : "0 28px 60px -15px rgba(15, 23, 42, 0.13), 0 8px 20px -6px rgba(15, 23, 42, 0.06)",
  };

  const nativeShadow =
    elevation === "none"
      ? {}
      : {
          shadowColor: tokens.shadowColor,
          shadowOffset: {
            width: 0,
            height: elevation === "floating" ? 16 : elevation === "lg" ? 10 : 6,
          },
          shadowOpacity: isDark
            ? 0.35
            : elevation === "floating"
              ? 0.11
              : elevation === "lg"
                ? 0.08
                : 0.06,
          shadowRadius:
            elevation === "floating" ? 28 : elevation === "lg" ? 20 : 14,
          elevation:
            elevation === "floating" ? 10 : elevation === "lg" ? 6 : 3,
        };

  return (
    <View
      style={[
        {
          backgroundColor:
            variant === "muted"
              ? tokens.muted
              : variant === "glass"
                ? isDark
                  ? "rgba(19, 27, 46, 0.85)"
                  : "rgba(255, 255, 255, 0.92)"
                : tokens.card,
          borderColor: accentBorderColor || tokens.border,
          borderWidth: 1,
          borderRadius: tokens.radiusCard,
          padding: paddingMap[padding],
          ...(Platform.OS === "web"
            ? ({ boxShadow: webShadowMap[elevation] } as any)
            : nativeShadow),
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
