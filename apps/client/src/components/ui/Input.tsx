import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { useAppTheme } from "@/theme/ThemeProvider";
import { FLUID_EASINGS, useReducedMotion } from "@/lib/motion";

export interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightElement,
  onFocus,
  onBlur,
  style,
  ...props
}: InputProps) {
  const { tokens } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);
  const reducedMotion = useReducedMotion();

  const errorOpacity = useRef(new Animated.Value(error ? 1 : 0)).current;
  const errorTranslateY = useRef(new Animated.Value(error ? 0 : -4)).current;

  useEffect(() => {
    if (!error) {
      errorOpacity.setValue(0);
      errorTranslateY.setValue(-4);
      return;
    }

    if (reducedMotion) {
      errorOpacity.setValue(1);
      errorTranslateY.setValue(0);
      return;
    }

    errorOpacity.setValue(0);
    errorTranslateY.setValue(-4);
    Animated.parallel([
      Animated.timing(errorOpacity, {
        toValue: 1,
        duration: 200,
        easing: FLUID_EASINGS.outQuint,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(errorTranslateY, {
        toValue: 0,
        duration: 220,
        easing: FLUID_EASINGS.outQuint,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [error, reducedMotion, errorOpacity, errorTranslateY]);

  const borderColor = error
    ? tokens.destructive
    : isFocused
      ? tokens.doo
      : tokens.border;

  const webFocusShadow = error
    ? `0 0 0 3px ${tokens.destructive}22`
    : isFocused
      ? `0 0 0 3px ${tokens.doo}24`
      : "none";

  return (
    <View style={{ width: "100%", gap: 6 }}>
      <Text
        style={{
          color: tokens.foreground,
          fontSize: 13,
          fontWeight: "700",
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>

      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            minHeight: 50,
            paddingLeft: leftIcon ? 14 : 16,
            paddingRight: rightElement ? 6 : 16,
            backgroundColor: tokens.card,
            borderColor,
            borderWidth: isFocused || error ? 1.5 : 1,
            borderRadius: tokens.radiusControl,
            gap: 10,
            ...(Platform.OS === "web"
              ? ({
                  boxShadow: webFocusShadow,
                  transition:
                    "border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)",
                } as any)
              : {}),
          },
        ]}
      >
        {leftIcon ? <View>{leftIcon}</View> : null}

        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={tokens.mutedForeground}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              color: tokens.foreground,
              fontSize: 15,
              paddingVertical: 12,
              ...(Platform.OS === "web"
                ? ({ outlineStyle: "none" } as any)
                : {}),
            },
            style,
          ]}
          {...props}
        />

        {rightElement ? <View>{rightElement}</View> : null}
      </View>

      {error ? (
        <Animated.View
          style={{
            opacity: errorOpacity,
            transform: [{ translateY: errorTranslateY }],
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: tokens.destructive,
              fontSize: 12,
              fontWeight: "600",
              lineHeight: 17,
            }}
          >
            {error}
          </Text>
        </Animated.View>
      ) : helperText ? (
        <Text
          style={{
            color: tokens.mutedForeground,
            fontSize: 12,
            lineHeight: 17,
          }}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
