import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AmbientMeshBackground } from "@/components/ui/AmbientMeshBackground";
import {
  ApiAuthError,
  logoutAuthSession,
  registerWithEmail,
} from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import {
  FLUID_EASINGS,
  FLUID_SPRINGS,
  useErrorShake,
  useInteractiveMotion,
  usePulseScale,
  useReducedMotion,
  useStaggerEntrance,
} from "@/lib/motion";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const CURRENCY_OPTIONS = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "MXN", symbol: "$", label: "Mexican Peso" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
] as const;

export interface PasswordStrengthState {
  hasMinLength: boolean;
  hasMixedCase: boolean;
  hasNumberOrSymbol: boolean;
  passwordsMatch: boolean;
  score: number; // 0..4
  label: "Enter password" | "Weak" | "Fair" | "Good" | "Strong";
}

export function evaluatePasswordStrength(
  password: string,
  confirmPassword: string
): PasswordStrengthState {
  const hasMinLength = password.length >= 10;
  const hasMixedCase = /[A-Z]/.test(password) && /[a-z]/.test(password);
  const hasNumberOrSymbol = /[\d\W_]/.test(password);
  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  let score = 0;
  if (hasMinLength) score += 1;
  if (hasMixedCase) score += 1;
  if (hasNumberOrSymbol) score += 1;
  if (passwordsMatch) score += 1;

  let label: PasswordStrengthState["label"] = "Enter password";
  if (password.length > 0) {
    if (score <= 1) label = "Weak";
    else if (score === 2) label = "Fair";
    else if (score === 3) label = "Good";
    else label = "Strong";
  }

  return {
    hasMinLength,
    hasMixedCase,
    hasNumberOrSymbol,
    passwordsMatch,
    score,
    label,
  };
}

export default function RegisterScreen() {
  const router = useRouter();
  const { tokens } = useAppTheme();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  const {
    user,
    currentWorkspace,
    refreshToken,
    isAuthenticated,
    setSession,
    clearSession,
  } = useAuthStore();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currency, setCurrency] = useState<string>("USD");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [displayNameError, setDisplayNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | undefined
  >();
  const [bannerError, setBannerError] = useState<{
    title: string;
    message: string;
    isRateLimit: boolean;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Apple HIG & Emil Kowalski Fluid UI Motion hooks
  const headerEntrance = useStaggerEntrance(0);
  const leftColumnEntrance = useStaggerEntrance(1);
  const rightColumnEntrance = useStaggerEntrance(2);
  const { translateX: shakeX, triggerShake } = useErrorShake();
  const { scale: workspacePreviewPulse, triggerPulse: triggerWorkspacePulse } =
    usePulseScale(1.018);

  // Interactive hover + press hooks for links and icon toggles
  const brandLinkMotion = useInteractiveMotion({
    hoverScale: 1.02,
    pressScale: 0.97,
    hoverLift: -1,
  });
  const passwordToggleMotion = useInteractiveMotion({
    hoverScale: 1.08,
    pressScale: 0.92,
    hoverLift: 0,
  });
  const confirmToggleMotion = useInteractiveMotion({
    hoverScale: 1.08,
    pressScale: 0.92,
    hoverLift: 0,
  });
  const loginLinkMotion = useInteractiveMotion({
    hoverScale: 1.02,
    pressScale: 0.97,
    hoverLift: -1,
    iconSlide: 3,
  });

  const strength = useMemo(
    () => evaluatePasswordStrength(password, confirmPassword),
    [password, confirmPassword]
  );

  const strengthColor = useMemo(() => {
    if (password.length === 0) return tokens.mutedForeground;
    if (strength.score <= 1) return tokens.destructive;
    if (strength.score === 2) return tokens.warning;
    if (strength.score === 3) return tokens.doo;
    return tokens.finance;
  }, [password.length, strength.score, tokens]);

  // Fluid alert banner entrance
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTranslateY = useRef(new Animated.Value(-6)).current;
  const bannerScale = useRef(new Animated.Value(0.97)).current;

  useEffect(() => {
    if (!bannerError) {
      bannerOpacity.setValue(0);
      bannerTranslateY.setValue(-6);
      bannerScale.setValue(0.97);
      return;
    }

    if (reducedMotion) {
      bannerOpacity.setValue(1);
      bannerTranslateY.setValue(0);
      bannerScale.setValue(1);
      return;
    }

    bannerOpacity.setValue(0);
    bannerTranslateY.setValue(-6);
    bannerScale.setValue(0.97);

    Animated.parallel([
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 240,
        easing: FLUID_EASINGS.outExpo,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(bannerTranslateY, {
        toValue: 0,
        duration: 260,
        easing: FLUID_EASINGS.outExpo,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.spring(bannerScale, {
        toValue: 1,
        ...FLUID_SPRINGS.fluid,
      }),
    ]).start();
  }, [bannerError, reducedMotion, bannerOpacity, bannerTranslateY, bannerScale]);

  // Fluid state transition between Register Form and Workspace Created Card
  const cardMorphOpacity = useRef(new Animated.Value(1)).current;
  const cardMorphScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) {
      cardMorphOpacity.setValue(1);
      cardMorphScale.setValue(1);
      return;
    }

    cardMorphOpacity.setValue(0);
    cardMorphScale.setValue(0.975);

    Animated.parallel([
      Animated.timing(cardMorphOpacity, {
        toValue: 1,
        duration: 280,
        easing: FLUID_EASINGS.outExpo,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.spring(cardMorphScale, {
        toValue: 1,
        ...FLUID_SPRINGS.fluid,
      }),
    ]).start();
  }, [isAuthenticated, reducedMotion, cardMorphOpacity, cardMorphScale]);

  const monoFont =
    Platform.OS === "web" ? "JetBrains Mono, monospace" : undefined;

  const handleSelectCurrency = (code: string) => {
    setCurrency(code);
    triggerWorkspacePulse();
  };

  const validateFields = (): boolean => {
    let valid = true;
    const cleanedName = displayName.trim();
    const cleanedEmail = email.trim();

    if (!cleanedName) {
      setDisplayNameError("Display name is required.");
      valid = false;
    } else if (cleanedName.length < 2) {
      setDisplayNameError("Display name must be at least 2 characters.");
      valid = false;
    } else {
      setDisplayNameError(undefined);
    }

    if (!cleanedEmail) {
      setEmailError("Email address is required.");
      valid = false;
    } else if (!EMAIL_PATTERN.test(cleanedEmail)) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    } else {
      setEmailError(undefined);
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else if (!strength.hasMinLength) {
      setPasswordError("Password must be at least 10 characters long.");
      valid = false;
    } else if (!strength.hasMixedCase) {
      setPasswordError(
        "Password must include both uppercase and lowercase letters."
      );
      valid = false;
    } else if (!strength.hasNumberOrSymbol) {
      setPasswordError("Password must include at least one number or symbol.");
      valid = false;
    } else {
      setPasswordError(undefined);
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password.");
      valid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      valid = false;
    } else {
      setConfirmPasswordError(undefined);
    }

    return valid;
  };

  const handleCreateAccount = async () => {
    setBannerError(null);
    if (!validateFields()) {
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    try {
      const sessionPayload = await registerWithEmail({
        display_name: displayName.trim(),
        email: email.trim(),
        password,
        currency,
      });
      setSession(sessionPayload);
      setPassword("");
      setConfirmPassword("");
      router.push("/dashboard");
    } catch (err) {
      triggerShake();
      if (err instanceof ApiAuthError) {
        if (err.fieldErrors?.display_name) {
          setDisplayNameError(err.fieldErrors.display_name);
        }
        if (err.fieldErrors?.email) {
          setEmailError(err.fieldErrors.email);
        }
        if (err.fieldErrors?.password) {
          setPasswordError(err.fieldErrors.password);
        }

        const isRateLimit =
          err.status === 429 || err.code === "rate_limited";

        setBannerError({
          title: isRateLimit
            ? "Rate Limit Reached"
            : err.status === 409
              ? "Email Already Registered"
              : "Registration Failed",
          message: err.message,
          isRateLimit,
        });
      } else {
        setBannerError({
          title: "Connection Error",
          message:
            "Could not reach the server. Please verify the API is running and try again.",
          isRateLimit: false,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await logoutAuthSession(refreshToken);
    } catch {
      // Clear local session regardless of network state
    } finally {
      clearSession();
      setIsSigningOut(false);
    }
  };

  const strengthRules = [
    { key: "len", label: "10+ characters", met: strength.hasMinLength },
    { key: "case", label: "Upper & lowercase", met: strength.hasMixedCase },
    { key: "num", label: "Number or symbol", met: strength.hasNumberOrSymbol },
    { key: "match", label: "Passwords match", met: strength.passwordsMatch },
  ];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.background }}
      edges={["top", "bottom"]}
    >
      <AmbientMeshBackground variant="right-to-left" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "space-between",
            paddingBottom: 36,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 1140,
              alignSelf: "center",
              paddingHorizontal: isDesktop ? 40 : isTablet ? 28 : 20,
              flex: 1,
            }}
          >
            {/* Minimal Top Header (Stagger 0) */}
            <Animated.View
              style={[
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: isDesktop ? 28 : 18,
                },
                headerEntrance,
              ]}
            >
              <Animated.View style={brandLinkMotion.animatedStyle}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to Welcome"
                  onHoverIn={brandLinkMotion.onHoverIn}
                  onHoverOut={brandLinkMotion.onHoverOut}
                  onPressIn={brandLinkMotion.onPressIn}
                  onPressOut={brandLinkMotion.onPressOut}
                  onPress={() => router.push("/welcome")}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    minHeight: 44,
                    paddingHorizontal: 8,
                    marginLeft: -8,
                    borderRadius: 12,
                    backgroundColor: brandLinkMotion.isHovered
                      ? tokens.muted
                      : "transparent",
                    ...(Platform.OS === "web"
                      ? ({
                          cursor: "pointer",
                          transition:
                            "background-color 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                        } as any)
                      : {}),
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      backgroundColor: tokens.primary,
                      alignItems: "center",
                      justifyContent: "center",
                      ...(Platform.OS === "web"
                        ? ({
                            boxShadow: brandLinkMotion.isHovered
                              ? "0 10px 22px -4px rgba(15, 23, 42, 0.32)"
                              : "0 6px 14px -4px rgba(15, 23, 42, 0.2)",
                            transition:
                              "box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)",
                          } as any)
                        : {}),
                    }}
                  >
                    <MaterialIcons
                      name="auto-awesome"
                      size={18}
                      color={tokens.primaryForeground}
                    />
                  </View>
                  <Text
                    style={{
                      color: tokens.foreground,
                      fontSize: 18,
                      fontWeight: "800",
                      letterSpacing: -0.4,
                    }}
                  >
                    Wishes & DOOs
                  </Text>
                </Pressable>
              </Animated.View>

              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Button
                  label="Welcome"
                  variant="ghost"
                  size="md"
                  icon={
                    <MaterialIcons
                      name="arrow-back"
                      size={16}
                      color={tokens.foreground}
                    />
                  }
                  onPress={() => router.push("/welcome")}
                />
                {isTablet ? (
                  <Button
                    label="Sign In"
                    variant="outline"
                    size="md"
                    onPress={() => router.push("/login")}
                  />
                ) : null}
              </View>
            </Animated.View>

            {/* Main Content Split (Asymmetric 2-Column on Desktop, Stacked on Mobile) */}
            <View
              style={{
                flex: 1,
                flexDirection: isDesktop ? "row" : "column",
                alignItems: isDesktop ? "center" : "stretch",
                justifyContent: "center",
                gap: isDesktop ? 52 : 24,
                paddingVertical: isDesktop ? 20 : 10,
              }}
            >
              {/* Left Column: Editorial Headline & Live Personal Workspace Blueprint (Stagger 1) */}
              <Animated.View
                style={[
                  {
                    flex: isDesktop ? 0.95 : undefined,
                    gap: isDesktop ? 24 : 16,
                    maxWidth: isDesktop ? 460 : 540,
                    alignSelf: isDesktop ? "auto" : "center",
                    width: "100%",
                  },
                  leftColumnEntrance,
                ]}
              >
                <View style={{ gap: 10 }}>
                  <View
                    style={{
                      alignSelf: "flex-start",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: tokens.wishSoft,
                    }}
                  >
                    <MaterialIcons
                      name="auto-awesome"
                      size={15}
                      color={tokens.wish}
                    />
                    <Text
                      style={{
                        color: tokens.wish,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      Instant Personal Workspace
                    </Text>
                  </View>

                  <Text
                    style={{
                      color: tokens.foreground,
                      fontSize: isDesktop ? 40 : isTablet ? 34 : 28,
                      lineHeight: isDesktop ? 46 : isTablet ? 40 : 34,
                      fontWeight: "800",
                      letterSpacing: -1.1,
                    }}
                  >
                    Start your{" "}
                    <Text style={{ color: tokens.finance }}>
                      unified space.
                    </Text>
                  </Text>

                  <Text
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 15,
                      lineHeight: 23,
                    }}
                  >
                    Creating an account automatically sets up your private
                    Personal Workspace with starter categories across Finances,
                    Wishes, and DOOs.
                  </Text>
                </View>

                {/* Live Workspace Blueprint Preview Card */}
                <Animated.View
                  style={{ transform: [{ scale: workspacePreviewPulse }] }}
                >
                  <Card
                    variant="glass"
                    elevation="md"
                    padding="md"
                    style={{ gap: 14 }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            backgroundColor: tokens.financeSoft,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <MaterialIcons
                            name="layers"
                            size={17}
                            color={tokens.finance}
                          />
                        </View>
                        <View>
                          <Text
                            style={{
                              color: tokens.foreground,
                              fontSize: 14,
                              fontWeight: "800",
                            }}
                          >
                            {displayName.trim()
                              ? `${displayName.trim()}'s Workspace`
                              : "Personal Workspace"}
                          </Text>
                          <Text
                            style={{
                              color: tokens.mutedForeground,
                              fontSize: 12,
                            }}
                          >
                            Provisioned atomically on signup
                          </Text>
                        </View>
                      </View>

                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: tokens.financeSoft,
                        }}
                      >
                        <Text
                          style={{
                            color: tokens.finance,
                            fontSize: 12,
                            fontWeight: "800",
                            fontFamily: monoFont,
                          }}
                        >
                          {currency}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: 12,
                          backgroundColor: tokens.financeSoft,
                          gap: 4,
                        }}
                      >
                        <MaterialIcons
                          name="account-balance-wallet"
                          size={15}
                          color={tokens.finance}
                        />
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          4 Finance
                        </Text>
                      </View>

                      <View
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: 12,
                          backgroundColor: tokens.wishSoft,
                          gap: 4,
                        }}
                      >
                        <MaterialIcons
                          name="auto-awesome"
                          size={15}
                          color={tokens.wish}
                        />
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          3 Wish
                        </Text>
                      </View>

                      <View
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: 12,
                          backgroundColor: tokens.dooSoft,
                          gap: 4,
                        }}
                      >
                        <MaterialIcons
                          name="checklist"
                          size={15}
                          color={tokens.doo}
                        />
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          3 DOO
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Animated.View>
              </Animated.View>

              {/* Right Column: Registration Form Card or Authenticated Workspace Card (Stagger 2 + Shake + Morph) */}
              <Animated.View
                style={[
                  {
                    flex: isDesktop ? 1.05 : undefined,
                    maxWidth: 520,
                    width: "100%",
                    alignSelf: "center",
                  },
                  rightColumnEntrance,
                ]}
              >
                <Animated.View
                  style={{
                    opacity: cardMorphOpacity,
                    transform: [
                      { translateX: shakeX },
                      { scale: cardMorphScale },
                    ],
                  }}
                >
                  {isAuthenticated && user ? (
                    <Card
                      variant="glass"
                      elevation="floating"
                      padding="lg"
                      style={{ gap: 22 }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 14,
                            backgroundColor: tokens.financeSoft,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <MaterialIcons
                            name="how-to-reg"
                            size={22}
                            color={tokens.finance}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: tokens.finance,
                              fontSize: 12,
                              fontWeight: "700",
                              letterSpacing: 0.3,
                            }}
                          >
                            WORKSPACE READY
                          </Text>
                          <Text
                            style={{
                              color: tokens.foreground,
                              fontSize: 22,
                              fontWeight: "800",
                              letterSpacing: -0.5,
                            }}
                          >
                            Welcome, {user.display_name}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={{
                          padding: 16,
                          borderRadius: tokens.radiusControl,
                          backgroundColor: tokens.muted,
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: tokens.mutedForeground,
                              fontSize: 13,
                              fontWeight: "600",
                            }}
                          >
                            Account Email
                          </Text>
                          <Text
                            style={{
                              color: tokens.foreground,
                              fontSize: 13,
                              fontWeight: "700",
                              fontFamily: monoFont,
                            }}
                          >
                            {user.email}
                          </Text>
                        </View>

                        {currentWorkspace ? (
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: tokens.mutedForeground,
                                fontSize: 13,
                                fontWeight: "600",
                              }}
                            >
                              Default Workspace
                            </Text>
                            <Text
                              style={{
                                color: tokens.finance,
                                fontSize: 13,
                                fontWeight: "700",
                                fontFamily: monoFont,
                              }}
                            >
                              {currentWorkspace.name} (
                              {currentWorkspace.currency})
                            </Text>
                          </View>
                        ) : null}

                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: tokens.mutedForeground,
                              fontSize: 13,
                              fontWeight: "600",
                            }}
                          >
                            Starter Categories
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <MaterialIcons
                              name="check-circle"
                              size={15}
                              color={tokens.finance}
                            />
                            <Text
                              style={{
                                color: tokens.foreground,
                                fontSize: 12,
                                fontWeight: "700",
                                fontFamily: monoFont,
                              }}
                            >
                              {currentWorkspace?.categories_count ?? 10} Seeded
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={{ gap: 10 }}>
                        <Button
                          label="Open Dashboard"
                          variant="finance"
                          size="lg"
                          fullWidth
                          rightIcon={
                            <MaterialIcons
                              name="arrow-forward"
                              size={17}
                              color={tokens.primaryForeground}
                            />
                          }
                          onPress={() => router.push("/dashboard")}
                        />
                        <Button
                          label="Sign Out of Session"
                          variant="outline"
                          size="lg"
                          fullWidth
                          loading={isSigningOut}
                          icon={
                            <MaterialIcons
                              name="logout"
                              size={17}
                              color={tokens.foreground}
                            />
                          }
                          onPress={handleSignOut}
                        />
                      </View>
                    </Card>
                  ) : (
                    <Card
                      variant="glass"
                      elevation="floating"
                      padding="lg"
                      style={{ gap: 18 }}
                    >
                      <View style={{ gap: 4 }}>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 24,
                            fontWeight: "800",
                            letterSpacing: -0.5,
                          }}
                        >
                          Create Account
                        </Text>
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 14,
                            lineHeight: 20,
                          }}
                        >
                          Set up your profile and personal workspace currency.
                        </Text>
                      </View>

                      {/* Fluid Spring Alert Banner */}
                      {bannerError ? (
                        <Animated.View
                          accessibilityRole="alert"
                          accessibilityLiveRegion="assertive"
                          style={{
                            opacity: bannerOpacity,
                            transform: [
                              { translateY: bannerTranslateY },
                              { scale: bannerScale },
                            ],
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: 10,
                            padding: 14,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: bannerError.isRateLimit
                              ? `${tokens.warning}1A`
                              : `${tokens.destructive}15`,
                            borderWidth: 1,
                            borderColor: bannerError.isRateLimit
                              ? tokens.warning
                              : tokens.destructive,
                          }}
                        >
                          {bannerError.isRateLimit ? (
                            <MaterialIcons
                              name="gpp-maybe"
                              size={19}
                              color={tokens.warning}
                            />
                          ) : (
                            <MaterialIcons
                              name="error-outline"
                              size={19}
                              color={tokens.destructive}
                            />
                          )}
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={{
                                color: bannerError.isRateLimit
                                  ? tokens.warning
                                  : tokens.destructive,
                                fontSize: 13,
                                fontWeight: "800",
                              }}
                            >
                              {bannerError.title}
                            </Text>
                            <Text
                              style={{
                                color: tokens.foreground,
                                fontSize: 13,
                                lineHeight: 19,
                              }}
                            >
                              {bannerError.message}
                            </Text>
                          </View>
                        </Animated.View>
                      ) : null}

                      {/* Form Inputs */}
                      <View style={{ gap: 14 }}>
                        <Input
                          label="Display Name"
                          placeholder="e.g. Elena Gomez"
                          value={displayName}
                          onChangeText={(val) => {
                            setDisplayName(val);
                            if (displayNameError)
                              setDisplayNameError(undefined);
                          }}
                          autoCapitalize="words"
                          autoComplete="name"
                          returnKeyType="next"
                          error={displayNameError}
                          leftIcon={
                            <MaterialIcons
                              name="person-outline"
                              size={18}
                              color={tokens.mutedForeground}
                            />
                          }
                        />

                        <Input
                          label="Email Address"
                          placeholder="you@example.com"
                          value={email}
                          onChangeText={(val) => {
                            setEmail(val);
                            if (emailError) setEmailError(undefined);
                          }}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoComplete="email"
                          autoCorrect={false}
                          returnKeyType="next"
                          error={emailError}
                          leftIcon={
                            <MaterialIcons
                              name="mail-outline"
                              size={18}
                              color={tokens.mutedForeground}
                            />
                          }
                        />

                        {/* Workspace Currency Selector Pills */}
                        <View style={{ gap: 6 }}>
                          <Text
                            style={{
                              color: tokens.foreground,
                              fontSize: 13,
                              fontWeight: "700",
                              letterSpacing: -0.1,
                            }}
                          >
                            Workspace Currency
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 8,
                            }}
                          >
                            {CURRENCY_OPTIONS.map((opt) => {
                              const selected = currency === opt.code;
                              return (
                                <Pressable
                                  key={opt.code}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected }}
                                  accessibilityLabel={`Currency ${opt.code}`}
                                  onPress={() => handleSelectCurrency(opt.code)}
                                  style={(state: any) => ({
                                    flex: 1,
                                    minHeight: 44,
                                    borderRadius: tokens.radiusControl,
                                    borderWidth: selected ? 1.5 : 1,
                                    borderColor: selected
                                      ? tokens.finance
                                      : state.hovered
                                        ? tokens.mutedForeground
                                        : tokens.border,
                                    backgroundColor: selected
                                      ? tokens.financeSoft
                                      : state.hovered
                                        ? tokens.muted
                                        : tokens.card,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    ...(Platform.OS === "web"
                                      ? ({
                                          cursor: "pointer",
                                          transform: state.pressed
                                            ? "scale(0.96)"
                                            : state.hovered
                                              ? "translateY(-1.5px)"
                                              : "translateY(0px)",
                                          transition:
                                            "transform 160ms cubic-bezier(0.22, 1, 0.36, 1), background-color 160ms ease, border-color 160ms ease",
                                        } as any)
                                      : {}),
                                  })}
                                >
                                  <Text
                                    style={{
                                      color: selected
                                        ? tokens.finance
                                        : tokens.foreground,
                                      fontSize: 13,
                                      fontWeight: "800",
                                      fontFamily: monoFont,
                                    }}
                                  >
                                    {opt.symbol} {opt.code}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>

                        <Input
                          label="Password"
                          placeholder="Create a strong password (10+ chars)"
                          value={password}
                          onChangeText={(val) => {
                            setPassword(val);
                            if (passwordError) setPasswordError(undefined);
                          }}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoComplete="new-password"
                          autoCorrect={false}
                          returnKeyType="next"
                          error={passwordError}
                          leftIcon={
                            <MaterialIcons
                              name="lock-outline"
                              size={18}
                              color={tokens.mutedForeground}
                            />
                          }
                          rightElement={
                            <Animated.View
                              style={passwordToggleMotion.animatedStyle}
                            >
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={
                                  showPassword
                                    ? "Hide password"
                                    : "Show password"
                                }
                                onHoverIn={passwordToggleMotion.onHoverIn}
                                onHoverOut={passwordToggleMotion.onHoverOut}
                                onPressIn={passwordToggleMotion.onPressIn}
                                onPressOut={passwordToggleMotion.onPressOut}
                                onPress={() =>
                                  setShowPassword((prev) => !prev)
                                }
                                style={{
                                  minWidth: 40,
                                  minHeight: 40,
                                  borderRadius: 10,
                                  backgroundColor:
                                    passwordToggleMotion.isHovered
                                      ? tokens.muted
                                      : "transparent",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  ...(Platform.OS === "web"
                                    ? ({
                                        cursor: "pointer",
                                        transition:
                                          "background-color 160ms cubic-bezier(0.22, 1, 0.36, 1)",
                                      } as any)
                                    : {}),
                                }}
                              >
                                <MaterialIcons
                                  name={
                                    showPassword
                                      ? "visibility-off"
                                      : "visibility"
                                  }
                                  size={19}
                                  color={
                                    passwordToggleMotion.isHovered
                                      ? tokens.foreground
                                      : tokens.mutedForeground
                                  }
                                />
                              </Pressable>
                            </Animated.View>
                          }
                        />

                        <Input
                          label="Confirm Password"
                          placeholder="Re-enter your password"
                          value={confirmPassword}
                          onChangeText={(val) => {
                            setConfirmPassword(val);
                            if (confirmPasswordError)
                              setConfirmPasswordError(undefined);
                          }}
                          secureTextEntry={!showConfirmPassword}
                          autoCapitalize="none"
                          autoComplete="new-password"
                          autoCorrect={false}
                          returnKeyType="done"
                          onSubmitEditing={handleCreateAccount}
                          error={confirmPasswordError}
                          leftIcon={
                            <MaterialIcons
                              name="verified-user"
                              size={18}
                              color={tokens.mutedForeground}
                            />
                          }
                          rightElement={
                            <Animated.View
                              style={confirmToggleMotion.animatedStyle}
                            >
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={
                                  showConfirmPassword
                                    ? "Hide confirm password"
                                    : "Show confirm password"
                                }
                                onHoverIn={confirmToggleMotion.onHoverIn}
                                onHoverOut={confirmToggleMotion.onHoverOut}
                                onPressIn={confirmToggleMotion.onPressIn}
                                onPressOut={confirmToggleMotion.onPressOut}
                                onPress={() =>
                                  setShowConfirmPassword((prev) => !prev)
                                }
                                style={{
                                  minWidth: 40,
                                  minHeight: 40,
                                  borderRadius: 10,
                                  backgroundColor:
                                    confirmToggleMotion.isHovered
                                      ? tokens.muted
                                      : "transparent",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  ...(Platform.OS === "web"
                                    ? ({
                                        cursor: "pointer",
                                        transition:
                                          "background-color 160ms cubic-bezier(0.22, 1, 0.36, 1)",
                                      } as any)
                                    : {}),
                                }}
                              >
                                <MaterialIcons
                                  name={
                                    showConfirmPassword
                                      ? "visibility-off"
                                      : "visibility"
                                  }
                                  size={19}
                                  color={
                                    confirmToggleMotion.isHovered
                                      ? tokens.foreground
                                      : tokens.mutedForeground
                                  }
                                />
                              </Pressable>
                            </Animated.View>
                          }
                        />

                        {/* Live Password Strength Meter & Rules */}
                        <View
                          style={{
                            padding: 12,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: tokens.muted,
                            gap: 10,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: tokens.mutedForeground,
                                fontSize: 12,
                                fontWeight: "700",
                              }}
                            >
                              Password Strength
                            </Text>
                            <Text
                              accessibilityLiveRegion="polite"
                              style={{
                                color: strengthColor,
                                fontSize: 12,
                                fontWeight: "800",
                                fontFamily: monoFont,
                              }}
                            >
                              {strength.label}
                            </Text>
                          </View>

                          {/* 4-Segment Fluid Bar */}
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 6,
                            }}
                          >
                            {[1, 2, 3, 4].map((segment) => {
                              const active = strength.score >= segment;
                              return (
                                <View
                                  key={segment}
                                  style={{
                                    flex: 1,
                                    height: 6,
                                    borderRadius: 999,
                                    backgroundColor: active
                                      ? strengthColor
                                      : tokens.border,
                                    ...(Platform.OS === "web"
                                      ? ({
                                          transition:
                                            "background-color 220ms cubic-bezier(0.16, 1, 0.3, 1)",
                                        } as any)
                                      : {}),
                                  }}
                                />
                              );
                            })}
                          </View>

                          {/* Rule Checklist */}
                          <View
                            style={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            {strengthRules.map((rule) => (
                              <View
                                key={rule.key}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 5,
                                  width: "47%",
                                }}
                              >
                                <View
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 999,
                                    backgroundColor: rule.met
                                      ? tokens.finance
                                      : tokens.border,
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {rule.met ? (
                                    <MaterialIcons
                                      name="check"
                                      size={11}
                                      color="#FFFFFF"
                                    />
                                  ) : null}
                                </View>
                                <Text
                                  style={{
                                    color: rule.met
                                      ? tokens.foreground
                                      : tokens.mutedForeground,
                                    fontSize: 12,
                                    fontWeight: rule.met ? "700" : "500",
                                  }}
                                >
                                  {rule.label}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>

                      {/* Explicit Confirm Create Account Button */}
                      <Button
                        label="Create Account"
                        variant="primary"
                        size="lg"
                        fullWidth
                        loading={isSubmitting}
                        rightIcon={
                          <MaterialIcons
                            name="arrow-forward"
                            size={18}
                            color={tokens.primaryForeground}
                          />
                        }
                        onPress={handleCreateAccount}
                      />

                      {/* Navigation to Login with Hover Pill + Icon Nudge */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          paddingTop: 2,
                        }}
                      >
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 14,
                          }}
                        >
                          Already have an account?
                        </Text>
                        <Animated.View style={loginLinkMotion.animatedStyle}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Sign in instead"
                            onHoverIn={loginLinkMotion.onHoverIn}
                            onHoverOut={loginLinkMotion.onHoverOut}
                            onPressIn={loginLinkMotion.onPressIn}
                            onPressOut={loginLinkMotion.onPressOut}
                            onPress={() => router.push("/login")}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              paddingVertical: 8,
                              paddingHorizontal: 10,
                              minHeight: 40,
                              borderRadius: 999,
                              backgroundColor: loginLinkMotion.isHovered
                                ? tokens.dooSoft
                                : "transparent",
                              justifyContent: "center",
                              ...(Platform.OS === "web"
                                ? ({
                                    cursor: "pointer",
                                    transition:
                                      "background-color 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                                  } as any)
                                : {}),
                            }}
                          >
                            <Text
                              style={{
                                color: tokens.doo,
                                fontSize: 14,
                                fontWeight: "700",
                              }}
                            >
                              Sign in instead
                            </Text>
                            <Animated.View
                              style={loginLinkMotion.rightIconStyle}
                            >
                              <MaterialIcons
                                name="arrow-forward"
                                size={15}
                                color={tokens.doo}
                              />
                            </Animated.View>
                          </Pressable>
                        </Animated.View>
                      </View>
                    </Card>
                  )}
                </Animated.View>
              </Animated.View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
