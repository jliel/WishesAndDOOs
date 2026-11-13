import React, { useEffect, useRef, useState } from "react";
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
import Head from "expo-router/head";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AmbientMeshBackground } from "@/components/ui/AmbientMeshBackground";
import {
  ApiAuthError,
  loginWithEmail,
  logoutAuthSession,
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

export const DEMO_EMAIL = "demo@wishesanddoos.app";
export const DEMO_PASSWORD = "DemoPassword123!";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function LoginScreen() {
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [bannerError, setBannerError] = useState<{
    title: string;
    message: string;
    isLockoutOrRateLimit: boolean;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Apple HIG & Emil Kowalski Fluid Motion hooks
  const headerEntrance = useStaggerEntrance(0);
  const leftColumnEntrance = useStaggerEntrance(1);
  const rightColumnEntrance = useStaggerEntrance(2);
  const { translateX: shakeX, triggerShake } = useErrorShake();
  const { scale: inputsPulseScale, triggerPulse: triggerInputsPulse } =
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
  const registerLinkMotion = useInteractiveMotion({
    hoverScale: 1.02,
    pressScale: 0.97,
    hoverLift: -1,
    iconSlide: 3,
  });

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

  // Fluid state transition between Sign-In Form and Session Authenticated card
  const sessionCardOpacity = useRef(new Animated.Value(1)).current;
  const sessionCardScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) {
      sessionCardOpacity.setValue(1);
      sessionCardScale.setValue(1);
      return;
    }

    sessionCardOpacity.setValue(0);
    sessionCardScale.setValue(0.975);

    Animated.parallel([
      Animated.timing(sessionCardOpacity, {
        toValue: 1,
        duration: 280,
        easing: FLUID_EASINGS.outExpo,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.spring(sessionCardScale, {
        toValue: 1,
        ...FLUID_SPRINGS.fluid,
      }),
    ]).start();
  }, [isAuthenticated, reducedMotion, sessionCardOpacity, sessionCardScale]);

  const monoFont =
    Platform.OS === "web" ? "JetBrains Mono, monospace" : undefined;

  const handleFillDemoCredentials = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setEmailError(undefined);
    setPasswordError(undefined);
    setBannerError(null);
    triggerInputsPulse();
  };

  const validateFields = (): boolean => {
    let valid = true;
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setEmailError("Email address is required.");
      valid = false;
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    } else {
      setEmailError(undefined);
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else {
      setPasswordError(undefined);
    }

    return valid;
  };

  const handleSignIn = async () => {
    setBannerError(null);
    if (!validateFields()) {
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    try {
      const sessionPayload = await loginWithEmail({
        email: email.trim(),
        password,
      });
      setSession(sessionPayload);
      setPassword("");
      router.push("/dashboard");
    } catch (err) {
      triggerShake();
      if (err instanceof ApiAuthError) {
        if (err.fieldErrors?.email) {
          setEmailError(err.fieldErrors.email);
        }
        if (err.fieldErrors?.password) {
          setPasswordError(err.fieldErrors.password);
        }

        const isLockoutOrRateLimit =
          err.status === 429 ||
          err.code === "account_locked" ||
          err.code === "rate_limited";

        setBannerError({
          title: isLockoutOrRateLimit
            ? "Security Protection Active"
            : "Sign-In Failed",
          message: err.message,
          isLockoutOrRateLimit,
        });
      } else {
        setBannerError({
          title: "Connection Error",
          message:
            "Could not reach the authentication server. Please verify the API is running and try again.",
          isLockoutOrRateLimit: false,
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

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.background }}
      edges={["top", "bottom"]}
    >
      <Head>
        <title>Sign In — Wishes &amp; DOOs</title>
        <meta
          name="description"
          content="Sign in to your Wishes &amp; DOOs workspace to review your safe-to-spend balance, fund active wishes, and manage your tasks."
        />
        <link rel="canonical" href="https://wishesanddoos.app/login" />
        <meta property="og:title" content="Sign In — Wishes &amp; DOOs" />
        <meta
          property="og:description"
          content="Sign in to review your safe-to-spend balance, fund active wishes, and check off today's DOOs."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://wishesanddoos.app/login" />
        <meta name="twitter:card" content="summary" />
      </Head>
      <AmbientMeshBackground variant="corner-top-right" />
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
              maxWidth: 1120,
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
                    label="Create Account"
                    variant="outline"
                    size="md"
                    onPress={() => router.push("/register")}
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
                gap: isDesktop ? 56 : 24,
                paddingVertical: isDesktop ? 28 : 12,
              }}
            >
              {/* Left Column: Editorial Context & Demo Account Quick-Fill (Stagger 1) */}
              <Animated.View
                style={[
                  {
                    flex: isDesktop ? 1 : undefined,
                    gap: isDesktop ? 24 : 16,
                    maxWidth: isDesktop ? 480 : 540,
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
                      backgroundColor: tokens.financeSoft,
                    }}
                  >
                    <MaterialIcons
                      name="verified-user"
                      size={15}
                      color={tokens.finance}
                    />
                    <Text
                      style={{
                        color: tokens.finance,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      Protected Personal Workspace
                    </Text>
                  </View>

                  <Text
                    accessibilityRole="header"
                    aria-level={1}
                    style={{
                      color: tokens.foreground,
                      fontSize: isDesktop ? 42 : isTablet ? 34 : 28,
                      lineHeight: isDesktop ? 48 : isTablet ? 40 : 34,
                      fontWeight: "800",
                      letterSpacing: -1.1,
                    }}
                  >
                    Welcome back to your{" "}
                    <Text style={{ color: tokens.finance }}>calm space.</Text>
                  </Text>

                  <Text
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 15,
                      lineHeight: 23,
                    }}
                  >
                    Sign in to review your safe-to-spend balance, fund active
                    wishes, and check off today&apos;s DOOs.
                  </Text>
                </View>

                {/* Seeded Demo Account Helper Card */}
                <Card
                  variant="glass"
                  elevation="sm"
                  padding="md"
                  style={{ gap: 12 }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          backgroundColor: tokens.dooSoft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialIcons
                          name="vpn-key"
                          size={16}
                          color={tokens.doo}
                        />
                      </View>
                      <View>
                        <Text
                          accessibilityRole="header"
                          aria-level={2}
                          style={{
                            color: tokens.foreground,
                            fontSize: 14,
                            fontWeight: "700",
                          }}
                        >
                          Seeded Demo Account
                        </Text>
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 12,
                            fontFamily: monoFont,
                          }}
                        >
                          {DEMO_EMAIL}
                        </Text>
                      </View>
                    </View>

                    <Button
                      label="Fill Demo"
                      variant="secondary"
                      size="sm"
                      onPress={handleFillDemoCredentials}
                    />
                  </View>
                </Card>
              </Animated.View>

              {/* Right Column: Elevated Sign-In Form Card or Authenticated Session Card (Stagger 2 + Shake + Morph) */}
              <Animated.View
                style={[
                  {
                    flex: isDesktop ? 1 : undefined,
                    maxWidth: 480,
                    width: "100%",
                    alignSelf: "center",
                  },
                  rightColumnEntrance,
                ]}
              >
                <Animated.View
                  style={{
                    opacity: sessionCardOpacity,
                    transform: [
                      { translateX: shakeX },
                      { scale: sessionCardScale },
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
                            SESSION AUTHENTICATED
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
                            Signed-In Email
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
                              Active Workspace
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
                            Session Protection
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
                              }}
                            >
                              Argon2id + Rotating JWT
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
                      style={{ gap: 20 }}
                    >
                      <View style={{ gap: 6 }}>
                        <Text
                          accessibilityRole="header"
                          aria-level={2}
                          style={{
                            color: tokens.foreground,
                            fontSize: 24,
                            fontWeight: "800",
                            letterSpacing: -0.5,
                          }}
                        >
                          Sign In
                        </Text>
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 14,
                            lineHeight: 20,
                          }}
                        >
                          Enter your email and password to access your
                          workspace.
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
                            backgroundColor: bannerError.isLockoutOrRateLimit
                              ? `${tokens.warning}1A`
                              : `${tokens.destructive}15`,
                            borderWidth: 1,
                            borderColor: bannerError.isLockoutOrRateLimit
                              ? tokens.warning
                              : tokens.destructive,
                          }}
                        >
                          {bannerError.isLockoutOrRateLimit ? (
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
                                color: bannerError.isLockoutOrRateLimit
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

                      {/* Form Inputs with Fill Demo Pulse */}
                      <Animated.View
                        style={{
                          gap: 16,
                          transform: [{ scale: inputsPulseScale }],
                        }}
                      >
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

                        <Input
                          label="Password"
                          placeholder="Enter your password"
                          value={password}
                          onChangeText={(val) => {
                            setPassword(val);
                            if (passwordError) setPasswordError(undefined);
                          }}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoComplete="current-password"
                          autoCorrect={false}
                          returnKeyType="done"
                          onSubmitEditing={handleSignIn}
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
                      </Animated.View>

                      {/* Explicit Confirm Sign-In Action */}
                      <Button
                        label="Sign In"
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
                        onPress={handleSignIn}
                      />

                      {/* Navigation to Register with Hover Pill + Icon Nudge */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          paddingTop: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 14,
                          }}
                        >
                          New to Wishes & DOOs?
                        </Text>
                        <Animated.View style={registerLinkMotion.animatedStyle}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Create an account"
                            onHoverIn={registerLinkMotion.onHoverIn}
                            onHoverOut={registerLinkMotion.onHoverOut}
                            onPressIn={registerLinkMotion.onPressIn}
                            onPressOut={registerLinkMotion.onPressOut}
                            onPress={() => router.push("/register")}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              paddingVertical: 8,
                              paddingHorizontal: 10,
                              minHeight: 40,
                              borderRadius: 999,
                              backgroundColor: registerLinkMotion.isHovered
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
                              Create an account
                            </Text>
                            <Animated.View
                              style={registerLinkMotion.rightIconStyle}
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
