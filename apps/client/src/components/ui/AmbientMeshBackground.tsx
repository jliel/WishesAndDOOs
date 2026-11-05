import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useAppTheme } from "@/theme/ThemeProvider";
import {
  GradientPerimeterVariant,
  useRotatingScreenGradient,
} from "@/lib/motion";

export interface AmbientMeshBackgroundProps {
  /**
   * Radial gradient start position around the perimeter:
   * - "bottom-to-top": Radial origin at bottom-center (50%, 92%) (/welcome)
   * - "corner-top-right": Radial origin at top-right corner (88%, 12%) (/login)
   * - "right-to-left": Radial origin at right-center (92%, 50%) (/register)
   * - "corner-bottom-right": Radial origin at bottom-right corner (88%, 88%) (/dashboard)
   * - "top-to-bottom": Radial origin at top-center (50%, 8%) (/finances)
   * - "corner-top-left": Radial origin at top-left corner (12%, 12%) (/wishes)
   * - "left-to-right": Radial origin at left-center (8%, 50%) (/doos)
   * - "corner-bottom-left": Radial origin at bottom-left corner (12%, 88%) (/settings)
   */
  variant?: GradientPerimeterVariant;
}

/**
 * Full-Canvas Multi-Stop Radial Gradient Background that rotates the position of the
 * start (0% focal origin) of the radial gradient around the perimeter from screen to screen.
 */
export function AmbientMeshBackground({
  variant = "bottom-to-top",
}: AmbientMeshBackgroundProps) {
  const { tokens, colorMode } = useAppTheme();
  const isDark = colorMode === "dark";
  const { pose, reducedMotion } = useRotatingScreenGradient(variant);

  if (Platform.OS !== "web") {
    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tokens.background },
        ]}
      />
    );
  }

  // Full-canvas multi-stop radial gradient:
  // 0% (Focal Start) -> 24% (Emerald/Finance) -> 48% (Wish/Violet) -> 72% (DOO/Cobalt) -> 100% (Tinted base, never stark white)
  const primaryRadialGradient = isDark
    ? `radial-gradient(circle at 50% 50%, ${tokens.finance}48 0%, ${tokens.doo}32 25%, ${tokens.wish}24 48%, ${tokens.backgroundSecondary} 75%, ${tokens.background} 100%)`
    : `radial-gradient(circle at 50% 50%, ${tokens.finance}38 0%, ${tokens.doo}28 24%, ${tokens.wish}1E 48%, ${tokens.backgroundSecondary} 76%, ${tokens.background} 100%)`;

  // Soft complementary radial glow at the opposite pole so the far side of the screen
  // always has warm atmospheric depth and is never flat or pure white
  const counterRadialGradient = isDark
    ? `radial-gradient(circle at 50% 50%, ${tokens.wish}32 0%, ${tokens.doo}20 34%, transparent 68%)`
    : `radial-gradient(circle at 50% 50%, ${tokens.wish}24 0%, ${tokens.doo}18 36%, transparent 68%)`;

  const transitionCss = reducedMotion
    ? "none"
    : "transform 950ms cubic-bezier(0.16, 1, 0.3, 1)";

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: tokens.backgroundSecondary,
          overflow: "hidden",
        },
      ]}
    >
      {/* Primary Multi-Stop Radial Gradient (Translating the 240% canvas moves the 0% focal origin around the perimeter) */}
      <View
        style={
          {
            position: "absolute",
            top: "-70%",
            left: "-70%",
            width: "240%",
            height: "240%",
            backgroundImage: primaryRadialGradient,
            transform: `translate3d(${pose.originX}%, ${pose.originY}%, 0)`,
            transition: transitionCss,
            willChange: "transform",
          } as any
        }
      />

      {/* Opposite-Pole Ambient Radial Counter-Glow (Prevents any edge/top from looking stark white) */}
      <View
        style={
          {
            position: "absolute",
            top: "-60%",
            left: "-60%",
            width: "220%",
            height: "220%",
            backgroundImage: counterRadialGradient,
            transform: `translate3d(${pose.counterX}%, ${pose.counterY}%, 0)`,
            transition: transitionCss,
            willChange: "transform",
          } as any
        }
      />
    </View>
  );
}
