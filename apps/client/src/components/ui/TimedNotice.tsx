import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { useInteractiveMotion, useReducedMotion } from "@/lib/motion";

export type NoticeVariant =
  | "success"
  | "warning"
  | "delete"
  | "destructive"
  | "finance"
  | "info"
  | "auto";

export interface TimedNoticeProps {
  message: string | null;
  onDismiss: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  durationMs?: number;
  variant?: NoticeVariant;
  icon?: React.ComponentProps<typeof MaterialIcons>["name"];
  testID?: string;
}

/**
 * Automatically infers variant ("delete" | "warning" | "success") from message text if not explicitly specified.
 */
function inferNoticeVariant(message: string | null, explicitVariant?: NoticeVariant): "delete" | "warning" | "success" {
  if (explicitVariant && explicitVariant !== "auto" && explicitVariant !== "finance" && explicitVariant !== "info") {
    if (explicitVariant === "destructive" || explicitVariant === "delete") return "delete";
    if (explicitVariant === "warning") return "warning";
    if (explicitVariant === "success") return "success";
  }

  if (!message) return "success";
  const lower = message.toLowerCase();

  // Deletes / Removals / Revocations
  if (
    lower.includes("deleted") ||
    lower.includes("removed") ||
    lower.includes("revoked") ||
    lower.includes("cleared") ||
    lower.includes("undone") ||
    lower.includes("cancelled") ||
    lower.includes("failed") ||
    lower.includes("error")
  ) {
    return "delete";
  }

  // Edits / Warnings / Updates / Reversions
  if (
    lower.includes("updated") ||
    lower.includes("edited") ||
    lower.includes("modified") ||
    lower.includes("reverted") ||
    lower.includes("changed") ||
    lower.includes("warning") ||
    lower.includes("caution") ||
    lower.includes("limit")
  ) {
    return "warning";
  }

  // Everything else: Creation, confirmation, grants, allocations, savings
  return "success";
}

/**
 * High-polish floating action notification badge / toast:
 * - On PC / Tablet (width ≥ 768px): Displayed floating in the TOP-RIGHT corner (`top: 24px, right: 24px`),
 *   with fluid slide-in from the right and subtle glassmorphic elevation.
 * - On Mobile (width < 768px): Displayed as a floating toast anchored at the bottom (`bottom: 84px`),
 *   safely above the mobile bottom tab navigation bar.
 * - Dynamic Action Color Coding synced with active Theme Tokens:
 *   • Red (`tokens.destructive`): for Deletions, cancellations, removals, errors.
 *   • Orange (`tokens.warning`): for Edits, modifications, warnings, updates.
 *   • Green (`tokens.finance`): for Success, confirmations, creations, grants.
 */
export function TimedNotice({
  message,
  onDismiss,
  onCancel,
  cancelLabel = "Cancel",
  durationMs = 4800,
  variant = "auto",
  icon,
  testID = "timed-notice",
}: TimedNoticeProps) {
  const { tokens, colorMode } = useAppTheme();
  const isDark = colorMode === "dark";
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const resolvedType = inferNoticeVariant(message, variant);

  // Dynamic Semantic Color Resolution based on action type & active theme
  const accentColor =
    resolvedType === "delete"
      ? tokens.destructive
      : resolvedType === "warning"
      ? tokens.warning
      : tokens.finance;

  const softBg =
    resolvedType === "delete"
      ? `${tokens.destructive}18`
      : resolvedType === "warning"
      ? `${tokens.warning}18`
      : `${tokens.finance}18`;

  const defaultIcon: React.ComponentProps<typeof MaterialIcons>["name"] =
    resolvedType === "delete"
      ? "delete-outline"
      : resolvedType === "warning"
      ? "edit"
      : "check-circle";

  const progress = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // Slide from +24 on mobile (bottom) or +28 on desktop (right)
  const slideAnim = useRef(new Animated.Value(isMobile ? 24 : 28)).current;
  const countdownAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const closeMotion = useInteractiveMotion({
    hoverScale: 1.15,
    pressScale: 0.9,
  });

  const cancelMotion = useInteractiveMotion({
    hoverScale: 1.05,
    hoverLift: -1,
    pressScale: 0.95,
  });

  useEffect(() => {
    if (!message) {
      fadeAnim.setValue(0);
      slideAnim.setValue(isMobile ? 24 : 28);
      progress.setValue(1);
      return;
    }

    // Entrance animation: fade in and slide
    slideAnim.setValue(isMobile ? 24 : 28);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: reducedMotion ? 0 : 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: reducedMotion ? 0 : 260,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();

    // Start countdown progress animation
    progress.setValue(1);
    const countdown = Animated.timing(progress, {
      toValue: 0,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    countdownAnimRef.current = countdown;

    countdown.start(({ finished }) => {
      if (finished) {
        // Exit animation
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: reducedMotion ? 0 : 180,
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(slideAnim, {
            toValue: isMobile ? 24 : 28,
            duration: reducedMotion ? 0 : 180,
            useNativeDriver: Platform.OS !== "web",
          }),
        ]).start(() => {
          onDismiss();
        });
      }
    });

    return () => {
      countdown.stop();
    };
  }, [message, durationMs, onDismiss, progress, fadeAnim, slideAnim, isMobile, reducedMotion]);

  if (!message) return null;

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const handlePressCancel = () => {
    if (countdownAnimRef.current) {
      countdownAnimRef.current.stop();
    }
    if (onCancel) {
      onCancel();
    }
  };

  // Glassmorphic translucent surface that adapts to dark/light modes
  const glassBackground = isDark ? "rgba(19, 27, 46, 0.94)" : "rgba(255, 255, 255, 0.96)";

  return (
    <Animated.View
      testID={testID}
      pointerEvents="box-none"
      style={[
        styles.fixedWrapper,
        isMobile ? styles.mobileWrapper : styles.desktopRightWrapper,
      ]}
    >
      <Animated.View
        style={[
          styles.badgeContainer,
          isMobile ? styles.mobileBadge : styles.desktopBadge,
          {
            opacity: fadeAnim,
            transform: [
              isMobile
                ? { translateY: slideAnim }
                : { translateX: slideAnim },
            ],
            backgroundColor: glassBackground,
            borderColor: accentColor,
            borderRadius: tokens.radiusControl,
          },
          Platform.OS === "web"
            ? ({
                backdropFilter: "blur(18px) saturate(160%)",
                WebkitBackdropFilter: "blur(18px) saturate(160%)",
                boxShadow: isDark
                  ? `0 16px 36px -6px rgba(0, 0, 0, 0.7), 0 0 16px -2px ${accentColor}33`
                  : `0 16px 36px -6px rgba(15, 23, 42, 0.16), 0 0 14px -2px ${accentColor}25`,
              } as any)
            : {
                shadowColor: tokens.shadowColor,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 18,
                elevation: 10,
              },
        ]}
      >
        <View style={styles.contentRow}>
          <View style={styles.leftGroup}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                backgroundColor: softBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons
                name={icon || defaultIcon}
                size={14}
                color={accentColor}
              />
            </View>
            <Text
              numberOfLines={2}
              style={[
                styles.messageText,
                {
                  color: tokens.foreground,
                  fontFamily: "Plus Jakarta Sans",
                },
              ]}
            >
              {message}
            </Text>
          </View>

          <View style={styles.actionsGroup}>
            {onCancel ? (
              <Animated.View style={cancelMotion.animatedStyle}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${cancelLabel} action`}
                  onPress={handlePressCancel}
                  onHoverIn={cancelMotion.onHoverIn}
                  onHoverOut={cancelMotion.onHoverOut}
                  onPressIn={cancelMotion.onPressIn}
                  onPressOut={cancelMotion.onPressOut}
                  style={[
                    styles.cancelButton,
                    {
                      backgroundColor: softBg,
                      borderColor: accentColor,
                    },
                    Platform.OS === "web"
                      ? ({
                          cursor: "pointer",
                          transition: "transform 150ms ease, background-color 150ms ease",
                        } as any)
                      : null,
                  ]}
                >
                  <MaterialIcons name="undo" size={12} color={accentColor} />
                  <Text
                    style={{
                      color: accentColor,
                      fontSize: 11,
                      fontWeight: "800",
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  >
                    {cancelLabel}
                  </Text>
                </Pressable>
              </Animated.View>
            ) : null}

            <Animated.View style={closeMotion.animatedStyle}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss notification"
                onPress={onDismiss}
                onHoverIn={closeMotion.onHoverIn}
                onHoverOut={closeMotion.onHoverOut}
                onPressIn={closeMotion.onPressIn}
                onPressOut={closeMotion.onPressOut}
                style={[
                  styles.closeButton,
                  { backgroundColor: tokens.muted },
                  Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                ]}
              >
                <MaterialIcons name="close" size={13} color={tokens.mutedForeground} />
              </Pressable>
            </Animated.View>
          </View>
        </View>

        {/* Animated Countdown Progress Bar at Bottom of Badge */}
        <View
          style={[
            styles.track,
            {
              backgroundColor: `${accentColor}25`,
              borderBottomLeftRadius: tokens.radiusControl,
              borderBottomRightRadius: tokens.radiusControl,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.filledBar,
              {
                width: progressWidth,
                backgroundColor: accentColor,
              },
            ]}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fixedWrapper: {
    position: "absolute",
    zIndex: 9999,
  },
  desktopRightWrapper: {
    top: 24, // Displayed in the TOP RIGHT corner on PC and Tablets
    right: 24,
    maxWidth: 380,
    minWidth: 280,
  },
  mobileWrapper: {
    bottom: 84, // Anchored cleanly as a toast above mobile bottom tab navigation bar
    left: 14,
    right: 14,
    maxWidth: 480,
    alignSelf: "center",
  },
  badgeContainer: {
    borderWidth: 1,
    overflow: "hidden",
  },
  desktopBadge: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  mobileBadge: {
    width: "100%",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  actionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  messageText: {
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
    letterSpacing: -0.1,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  closeButton: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    height: 2.5,
    width: "100%",
    overflow: "hidden",
  },
  filledBar: {
    height: "100%",
    borderRadius: 999,
  },
});
