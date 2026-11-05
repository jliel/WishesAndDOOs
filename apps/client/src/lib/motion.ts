import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";

/**
 * Apple HIG & Emil Kowalski Fluid UI Motion Tokens
 * - Fast initial velocity with long, smooth deceleration (cubic-bezier(0.16, 1, 0.3, 1))
 * - Critically damped springs for tactile hover, press/release, and state morphing
 * - Transform & opacity only (compositor-friendly, zero layout shift)
 * - Automatic prefers-reduced-motion compliance
 */

export const FLUID_EASINGS = {
  /** Emil Kowalski's signature out-expo curve for entrances & reveals */
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  /** Crisp out-quint curve for micro-interactions & alerts */
  outQuint: Easing.bezier(0.22, 1, 0.36, 1),
  /** Fast exit acceleration (exit faster than enter) */
  inQuad: Easing.bezier(0.55, 0.085, 0.68, 0.53),
};

const CAN_USE_NATIVE_DRIVER = Platform.OS !== "web";

export const FLUID_SPRINGS = {
  /** Tactile hover & press/release (Buttons, Links, Interactive Chips) */
  snappy: {
    tension: 340,
    friction: 24,
    useNativeDriver: CAN_USE_NATIVE_DRIVER,
  },
  /** Card morphing, Alert banner appearance, Input highlight */
  fluid: {
    tension: 220,
    friction: 22,
    useNativeDriver: CAN_USE_NATIVE_DRIVER,
  },
  /** Gentle spatial entrance */
  gentle: {
    tension: 170,
    friction: 21,
    useNativeDriver: CAN_USE_NATIVE_DRIVER,
  },
};

function isTestEnv(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "test";
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (isTestEnv()) return true;
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function"
    ) {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (isTestEnv()) return;

    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function"
    ) {
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }

    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduced(Boolean(enabled));
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        if (mounted) setReduced(Boolean(enabled));
      }
    );

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}

/**
 * Staggered entrance animation (subtle 12px Y translation + 0.985 scale + opacity fade).
 * Follows Emil Kowalski's rule: keep y-offset small (8-14px) so it reads as a fluid settle, not a harsh slide.
 */
export function useStaggerEntrance(index = 0, staggerMs = 55) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : 12)).current;
  const scale = useRef(new Animated.Value(reducedMotion ? 1 : 0.985)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      scale.setValue(1);
      return;
    }

    const delay = Math.min(index * staggerMs, 280);
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay,
        easing: FLUID_EASINGS.outExpo,
        useNativeDriver: CAN_USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        delay,
        easing: FLUID_EASINGS.outExpo,
        useNativeDriver: CAN_USE_NATIVE_DRIVER,
      }),
      Animated.spring(scale, {
        toValue: 1,
        delay,
        ...FLUID_SPRINGS.gentle,
      }),
    ]);

    anim.start();
    return () => anim.stop();
  }, [index, staggerMs, reducedMotion, opacity, translateY, scale]);

  return {
    opacity,
    transform: [{ translateY }, { scale }],
  };
}

export interface InteractiveMotionOptions {
  hoverScale?: number;
  pressScale?: number;
  hoverLift?: number;
  iconSlide?: number;
  disabled?: boolean;
}

/**
 * Unified Hover + Press fluid spring micro-interaction hook for Buttons, Links, and Interactive Chips.
 * - Hover: subtle lift (translateY: -1.5px), slight scale (1.015), and directional icon slide (+2.5px)
 * - Press: snappy tactile scale-down (0.97) and return to hover/rest state on release
 */
export function useInteractiveMotion({
  hoverScale = 1.016,
  pressScale = 0.97,
  hoverLift = -1.5,
  iconSlide = 2.5,
  disabled = false,
}: InteractiveMotionOptions = {}) {
  const reducedMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rightIconX = useRef(new Animated.Value(0)).current;
  const leftIconX = useRef(new Animated.Value(0)).current;

  const animateTo = useCallback(
    (nextScale: number, nextY: number, nextRightX: number, nextLeftX: number) => {
      if (reducedMotion) return;
      Animated.parallel([
        Animated.spring(scale, {
          toValue: nextScale,
          ...FLUID_SPRINGS.snappy,
        }),
        Animated.spring(translateY, {
          toValue: nextY,
          ...FLUID_SPRINGS.snappy,
        }),
        Animated.spring(rightIconX, {
          toValue: nextRightX,
          ...FLUID_SPRINGS.snappy,
        }),
        Animated.spring(leftIconX, {
          toValue: nextLeftX,
          ...FLUID_SPRINGS.snappy,
        }),
      ]).start();
    },
    [reducedMotion, scale, translateY, rightIconX, leftIconX]
  );

  const onHoverIn = useCallback(() => {
    if (disabled) return;
    setIsHovered(true);
    animateTo(hoverScale, hoverLift, iconSlide, -iconSlide * 0.7);
  }, [disabled, hoverScale, hoverLift, iconSlide, animateTo]);

  const onHoverOut = useCallback(() => {
    setIsHovered(false);
    setIsPressed(false);
    animateTo(1, 0, 0, 0);
  }, [animateTo]);

  const onPressIn = useCallback(() => {
    if (disabled) return;
    setIsPressed(true);
    animateTo(pressScale, 0.5, iconSlide * 0.5, 0);
  }, [disabled, pressScale, iconSlide, animateTo]);

  const onPressOut = useCallback(() => {
    if (disabled) return;
    setIsPressed(false);
    if (isHovered) {
      animateTo(hoverScale, hoverLift, iconSlide, -iconSlide * 0.7);
    } else {
      animateTo(1, 0, 0, 0);
    }
  }, [disabled, isHovered, hoverScale, hoverLift, iconSlide, animateTo]);

  return {
    isHovered,
    isPressed,
    scale,
    translateY,
    rightIconX,
    leftIconX,
    animatedStyle: {
      transform: [{ translateY }, { scale }],
    },
    rightIconStyle: {
      transform: [{ translateX: rightIconX }],
    },
    leftIconStyle: {
      transform: [{ translateX: leftIconX }],
    },
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
  };
}

/**
 * Apple macOS / iOS style horizontal error shake for invalid form submission or auth failure.
 */
export function useErrorShake() {
  const reducedMotion = useReducedMotion();
  const translateX = useRef(new Animated.Value(0)).current;

  const triggerShake = useCallback(() => {
    if (reducedMotion) return;
    translateX.setValue(0);
    Animated.sequence([
      Animated.timing(translateX, {
        toValue: -8,
        duration: 55,
        easing: FLUID_EASINGS.outQuint,
        useNativeDriver: CAN_USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateX, {
        toValue: 7,
        duration: 65,
        easing: FLUID_EASINGS.outQuint,
        useNativeDriver: CAN_USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateX, {
        toValue: -4,
        duration: 60,
        easing: FLUID_EASINGS.outQuint,
        useNativeDriver: CAN_USE_NATIVE_DRIVER,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        ...FLUID_SPRINGS.snappy,
      }),
    ]).start();
  }, [reducedMotion, translateX]);

  return { translateX, triggerShake };
}

/**
 * Tactile spring pulse when values auto-populate or update (e.g., Fill Demo or Save transfer).
 */
export function usePulseScale(peakScale = 1.018) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const triggerPulse = useCallback(() => {
    if (reducedMotion) return;
    Animated.sequence([
      Animated.timing(scale, {
        toValue: peakScale,
        duration: 110,
        easing: FLUID_EASINGS.outQuint,
        useNativeDriver: CAN_USE_NATIVE_DRIVER,
      }),
      Animated.spring(scale, {
        toValue: 1,
        ...FLUID_SPRINGS.fluid,
      }),
    ]).start();
  }, [peakScale, reducedMotion, scale]);

  return { scale, triggerPulse };
}

export type GradientPerimeterVariant =
  | "bottom-to-top"
  | "corner-top-right"
  | "right-to-left"
  | "corner-bottom-right"
  | "top-to-bottom"
  | "corner-top-left"
  | "left-to-right"
  | "corner-bottom-left";

export interface GradientStagePose {
  variant: GradientPerimeterVariant;
  /**
   * Translation offset (% of the oversized 240% radial canvas) that positions
   * the 0% focal origin of the primary radial gradient along the viewport perimeter.
   */
  originX: number;
  originY: number;
  /**
   * Complementary counter-glow origin on the opposite side of the viewport
   * so the far edge is never flat or stark white.
   */
  counterX: number;
  counterY: number;
}

export const GRADIENT_PERIMETER_POSES: Record<
  GradientPerimeterVariant,
  GradientStagePose
> = {
  "bottom-to-top": {
    variant: "bottom-to-top",
    originX: 0,
    originY: 18,
    counterX: -10,
    counterY: -16,
  },
  "corner-top-right": {
    variant: "corner-top-right",
    originX: 16,
    originY: -16,
    counterX: -14,
    counterY: 14,
  },
  "right-to-left": {
    variant: "right-to-left",
    originX: 18,
    originY: 0,
    counterX: -16,
    counterY: -10,
  },
  "corner-bottom-right": {
    variant: "corner-bottom-right",
    originX: 16,
    originY: 16,
    counterX: -14,
    counterY: -14,
  },
  "top-to-bottom": {
    variant: "top-to-bottom",
    originX: 0,
    originY: -18,
    counterX: 10,
    counterY: 16,
  },
  "corner-top-left": {
    variant: "corner-top-left",
    originX: -16,
    originY: -16,
    counterX: 14,
    counterY: 14,
  },
  "left-to-right": {
    variant: "left-to-right",
    originX: -18,
    originY: 0,
    counterX: 16,
    counterY: 10,
  },
  "corner-bottom-left": {
    variant: "corner-bottom-left",
    originX: -16,
    originY: 16,
    counterX: 14,
    counterY: -14,
  },
};

/**
 * Shared module-level memory of the last screen's gradient pose so navigating
 * between /welcome (bottom-to-top) -> /login (corner) -> /register (right-to-left)
 * smoothly transitions the radial gradient's start position across the viewport.
 */
let _lastGradientPose: GradientStagePose =
  GRADIENT_PERIMETER_POSES["bottom-to-top"];

export function useRotatingScreenGradient(
  targetVariant: GradientPerimeterVariant = "bottom-to-top"
) {
  const reducedMotion = useReducedMotion();
  const targetPose = GRADIENT_PERIMETER_POSES[targetVariant];

  const [pose, setPose] = useState<GradientStagePose>(() =>
    reducedMotion ? targetPose : _lastGradientPose
  );

  useEffect(() => {
    if (reducedMotion) {
      _lastGradientPose = targetPose;
      setPose(targetPose);
      return;
    }

    _lastGradientPose = targetPose;

    if (typeof requestAnimationFrame === "function") {
      const id = requestAnimationFrame(() => {
        setPose(targetPose);
      });
      return () => cancelAnimationFrame(id);
    } else {
      setPose(targetPose);
    }
  }, [targetPose, reducedMotion]);

  return {
    pose,
    reducedMotion,
  };
}
