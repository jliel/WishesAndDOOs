import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAppTheme } from "@/theme/ThemeProvider";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAuthStore } from "@/store/authStore";
import { useInteractiveMotion, useStaggerEntrance } from "@/lib/motion";
import { AdaptiveShell } from "@/components/layout/AdaptiveShell";
import { AmbientMeshBackground } from "@/components/ui/AmbientMeshBackground";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { TimedNotice } from "@/components/ui/TimedNotice";
import { logoutAuthSession } from "@/api/auth";
import {
  changePassword,
  fetchProfile,
  fetchUserSessions,
  revokeUserSession,
  updateProfile,
  updateWorkspaceSettings,
  UserProfile,
  UserSessionItem,
} from "@/api/settings";

export default function SettingsScreen() {
  const router = useRouter();
  const { tokens, colorMode, themeStyle, setThemeStyle, setColorMode } = useAppTheme();
  const { language, setLanguage, t } = useLanguage();
  const isDark = colorMode === "dark";
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  // Profile Form State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Workspace Form State
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceCurrency, setWorkspaceCurrency] = useState("USD");
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Active Sessions State
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Notification State
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [noticeVariant, setNoticeVariant] = useState<"finance" | "warning" | "destructive">("finance");
  const [pendingUndo, setPendingUndo] = useState<{ label: string; onUndo: () => Promise<void> } | null>(null);

  // Staggered Entrances
  const profileEntrance = useStaggerEntrance(0);
  const languageEntrance = useStaggerEntrance(1);
  const appearanceEntrance = useStaggerEntrance(2);
  const workspaceEntrance = useStaggerEntrance(3);
  const securityEntrance = useStaggerEntrance(4);
  const sessionsEntrance = useStaggerEntrance(5);

  // Load Data
  const loadData = useCallback(async () => {
    const token = accessToken || "demo-token";
    try {
      const [profData, sessData] = await Promise.all([
        fetchProfile(token).catch(() => null),
        fetchUserSessions(token).catch(() => []),
      ]);

      if (profData) {
        setProfile(profData);
        setDisplayName(profData.display_name);
      } else if (authUser) {
        setDisplayName(authUser.display_name);
      }

      setSessions(sessData);
      if (currentWorkspace) {
        setWorkspaceName(currentWorkspace.name);
        setWorkspaceCurrency(currentWorkspace.currency);
      }
    } finally {
      setIsLoadingSessions(false);
    }
  }, [accessToken, authUser, currentWorkspace]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Save Profile
  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      setNoticeVariant("destructive");
      setNoticeMessage("Display name cannot be empty.");
      return;
    }
    const token = accessToken || "demo-token";
    try {
      setIsSavingProfile(true);
      const updated = await updateProfile(token, {
        display_name: displayName.trim(),
        theme_style: themeStyle,
        color_mode: colorMode,
      });
      setProfile(updated);
      setNoticeVariant("finance");
      setNoticeMessage("Profile updated successfully!");
    } catch (err: any) {
      setNoticeVariant("destructive");
      setNoticeMessage(err.message || "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Save Workspace Settings
  const handleSaveWorkspace = async () => {
    if (!currentWorkspace?.id) return;
    const token = accessToken || "demo-token";
    try {
      setIsSavingWorkspace(true);
      const updated = await updateWorkspaceSettings(token, currentWorkspace.id, {
        name: workspaceName.trim(),
        currency: workspaceCurrency,
      });
      setNoticeVariant("finance");
      setNoticeMessage(`Workspace updated! Currency set to ${updated.currency}.`);
    } catch (err: any) {
      setNoticeVariant("destructive");
      setNoticeMessage(err.message || "Failed to update workspace.");
    } finally {
      setIsSavingWorkspace(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    const token = accessToken || "demo-token";
    try {
      setIsChangingPassword(true);
      await changePassword(token, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNoticeVariant("finance");
      setNoticeMessage("Password changed successfully!");
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle Revoke Session
  const handleRevokeSession = async (session: UserSessionItem) => {
    const token = accessToken || "demo-token";
    try {
      await revokeUserSession(token, session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      setNoticeVariant("warning");
      setNoticeMessage("Session revoked.");
    } catch (err: any) {
      setNoticeVariant("destructive");
      setNoticeMessage(err.message || "Failed to revoke session.");
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      await logoutAuthSession(refreshToken);
    } catch {
      // proceed regardless
    } finally {
      clearSession();
      router.replace("/welcome");
    }
  };

  const currencies = [
    { code: "USD", symbol: "$", label: "US Dollar" },
    { code: "EUR", symbol: "€", label: "Euro" },
    { code: "GBP", symbol: "£", label: "British Pound" },
    { code: "MXN", symbol: "MX$", label: "Mexican Peso" },
    { code: "CAD", symbol: "CA$", label: "Canadian Dollar" },
    { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      {/* Screen 10 Perimeter Radial Gradient Origin: "corner-top-left" */}
      <AmbientMeshBackground variant="corner-top-left" />

      {/* Action Feedback Notice */}
      {noticeMessage ? (
        <TimedNotice
          message={noticeMessage}
          variant={noticeVariant}
          onDismiss={() => setNoticeMessage(null)}
        />
      ) : null}

      <AdaptiveShell
        activeTab="settings"
        userDisplayName={displayName || authUser?.display_name || "Alex Rivera"}
        userEmail={authUser?.email}
        workspaceName={workspaceName || currentWorkspace?.name || "Personal Workspace"}
        workspaceCurrency={workspaceCurrency || currentWorkspace?.currency || "USD"}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 32 : 16,
            paddingTop: 24,
            paddingBottom: 100,
            maxWidth: 880,
            width: "100%",
            alignSelf: "center",
            gap: 20,
          }}
        >
          {/* Header Title */}
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: tokens.wishSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="settings" size={20} color={tokens.primary} />
              </View>
              <Text
                style={{
                  color: tokens.foreground,
                  fontSize: 24,
                  fontWeight: "800",
                  fontFamily: "Plus Jakarta Sans",
                  letterSpacing: -0.4,
                }}
              >
                {t.profileAndSettingsTitle}
              </Text>
            </View>
            <Text
              style={{
                color: tokens.mutedForeground,
                fontSize: 13,
                lineHeight: 18,
                fontFamily: "Plus Jakarta Sans",
              }}
            >
              {t.profileAndSettingsSubtitle}
            </Text>
          </View>

          {/* CARD 1: Profile Information */}
          <Animated.View style={profileEntrance}>
            <Card
              style={{
                padding: isDesktop ? 24 : 18,
                borderRadius: tokens.radiusCard,
                borderColor: tokens.border,
                borderWidth: 1,
                backgroundColor: tokens.card,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <MaterialIcons name="person" size={20} color={tokens.primary} />
                <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "800", fontFamily: "Plus Jakarta Sans" }}>
                  {t.profileInfo}
                </Text>
              </View>

              <View style={{ gap: 14 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                    {t.emailAddress}
                  </Text>
                  <TextInput
                    value={profile?.email || authUser?.email || "alex@wishesanddoos.local"}
                    editable={false}
                    style={{
                      height: 42,
                      paddingHorizontal: 12,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: tokens.muted,
                      color: tokens.mutedForeground,
                      borderColor: tokens.border,
                      borderWidth: 1,
                      fontSize: 14,
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  />
                  <Text style={{ color: tokens.mutedForeground, fontSize: 11 }}>
                    {t.emailNote}
                  </Text>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                    {t.displayName}
                  </Text>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Your Name"
                    placeholderTextColor={tokens.mutedForeground}
                    style={{
                      height: 42,
                      paddingHorizontal: 12,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: tokens.background,
                      color: tokens.foreground,
                      borderColor: tokens.border,
                      borderWidth: 1,
                      fontSize: 14,
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  />
                </View>

                {/* Save Profile Button */}
                <View style={{ padding: 4, marginHorizontal: -4, backgroundColor: "transparent" }}>
                  <Button
                    label={isSavingProfile ? t.saving : t.saveProfile}
                    variant="primary"
                    size="md"
                    loading={isSavingProfile}
                    disabled={isSavingProfile}
                    icon={<MaterialIcons name="check" size={16} color={tokens.primaryForeground} />}
                    onPress={handleSaveProfile}
                  />
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* CARD: Language / Idioma Settings */}
          <Animated.View style={languageEntrance}>
            <Card
              style={{
                padding: isDesktop ? 24 : 18,
                borderRadius: tokens.radiusCard,
                borderColor: tokens.border,
                borderWidth: 1,
                backgroundColor: tokens.card,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <MaterialIcons name="translate" size={20} color={tokens.primary} />
                <View>
                  <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "800", fontFamily: "Plus Jakarta Sans" }}>
                    {t.languageTitle}
                  </Text>
                  <Text style={{ color: tokens.mutedForeground, fontSize: 12, fontFamily: "Plus Jakarta Sans" }}>
                    {t.languageSubtitle}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                {[
                  {
                    code: "en" as const,
                    label: t.english,
                    desc: t.englishDesc,
                    flag: "US",
                  },
                  {
                    code: "es" as const,
                    label: t.spanish,
                    desc: t.spanishDesc,
                    flag: "ES",
                  },
                ].map((lang) => {
                  const isSelected = language === lang.code;
                  return (
                    <Pressable
                      key={lang.code}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Select ${lang.label} language`}
                      onPress={() => setLanguage(lang.code)}
                      style={({ hovered }: any) => [
                        {
                          flex: 1,
                          minHeight: 58,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: tokens.radiusControl,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isSelected
                            ? tokens.primary
                            : hovered
                            ? tokens.wishSoft
                            : tokens.muted,
                          borderWidth: 1,
                          borderColor: isSelected ? tokens.primary : tokens.border,
                          gap: 3,
                        },
                        Platform.OS === "web"
                          ? ({ cursor: "pointer", transition: "all 160ms ease" } as any)
                          : null,
                      ]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <MaterialIcons
                          name="language"
                          size={16}
                          color={isSelected ? tokens.primaryForeground : tokens.primary}
                        />
                        <Text
                          style={{
                            color: isSelected ? tokens.primaryForeground : tokens.foreground,
                            fontSize: 14,
                            fontWeight: "800",
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          {lang.label}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: isSelected
                            ? "rgba(255, 255, 255, 0.85)"
                            : tokens.mutedForeground,
                          fontSize: 11,
                          textAlign: "center",
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      >
                        {lang.desc}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </Animated.View>

          {/* CARD 2: Appearance & Theme Engine */}
          <Animated.View style={appearanceEntrance}>
            <Card
              style={{
                padding: isDesktop ? 24 : 18,
                borderRadius: tokens.radiusCard,
                borderColor: tokens.border,
                borderWidth: 1,
                backgroundColor: tokens.card,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <MaterialIcons name="palette" size={20} color={tokens.wish} />
                <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "800", fontFamily: "Plus Jakarta Sans" }}>
                  Appearance & Theme
                </Text>
              </View>

              {/* Theme Style Selector */}
              <View style={{ gap: 8 }}>
                <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                  Theme Style (3 Minimalist Variants)
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[
                    { key: "classical" as const, label: "Classical", desc: "Monochrome & Slate" },
                    { key: "pastel" as const, label: "Pastel", desc: "Soft Sage & Lilac" },
                    { key: "joyful" as const, label: "Joyful", desc: "Warm Amber & Sunset" },
                  ].map((style) => (
                    <Pressable
                      key={style.key}
                      onPress={() => setThemeStyle(style.key)}
                      style={({ hovered }: any) => [
                        {
                          flex: 1,
                          paddingVertical: 10,
                          paddingHorizontal: 8,
                          borderRadius: tokens.radiusControl,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: themeStyle === style.key ? tokens.primary : hovered ? tokens.wishSoft : tokens.muted,
                          borderWidth: 1,
                          borderColor: themeStyle === style.key ? tokens.primary : tokens.border,
                          gap: 2,
                        },
                        Platform.OS === "web" ? ({ cursor: "pointer", transition: "all 160ms ease" } as any) : null,
                      ]}
                    >
                      <Text
                        style={{
                          color: themeStyle === style.key ? tokens.primaryForeground : tokens.foreground,
                          fontSize: 13,
                          fontWeight: "800",
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      >
                        {style.label}
                      </Text>
                      <Text
                        style={{
                          color: themeStyle === style.key ? "rgba(255, 255, 255, 0.85)" : tokens.mutedForeground,
                          fontSize: 10,
                          textAlign: "center",
                        }}
                      >
                        {style.desc}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Color Mode Selector */}
              <View style={{ gap: 8 }}>
                <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                  Color Mode
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[
                    { key: "light" as const, label: "Light", icon: "light-mode" },
                    { key: "dark" as const, label: "Dark", icon: "dark-mode" },
                  ].map((mode) => (
                    <Pressable
                      key={mode.key}
                      onPress={() => setColorMode(mode.key)}
                      style={({ hovered }: any) => [
                        {
                          flex: 1,
                          height: 40,
                          borderRadius: tokens.radiusControl,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colorMode === mode.key ? tokens.primary : hovered ? tokens.wishSoft : tokens.muted,
                          borderWidth: 1,
                          borderColor: colorMode === mode.key ? tokens.primary : tokens.border,
                          flexDirection: "row",
                          gap: 6,
                        },
                        Platform.OS === "web" ? ({ cursor: "pointer", transition: "all 160ms ease" } as any) : null,
                      ]}
                    >
                      <MaterialIcons
                        name={mode.icon as any}
                        size={16}
                        color={colorMode === mode.key ? tokens.primaryForeground : tokens.mutedForeground}
                      />
                      <Text
                        style={{
                          color: colorMode === mode.key ? tokens.primaryForeground : tokens.foreground,
                          fontSize: 12,
                          fontWeight: "700",
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      >
                        {mode.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* CARD 3: Workspace & Currency Settings */}
          <Animated.View style={workspaceEntrance}>
            <Card
              style={{
                padding: isDesktop ? 24 : 18,
                borderRadius: tokens.radiusCard,
                borderColor: tokens.border,
                borderWidth: 1,
                backgroundColor: tokens.card,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <MaterialIcons name="work-outline" size={20} color={tokens.finance} />
                <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "800", fontFamily: "Plus Jakarta Sans" }}>
                  Workspace Settings
                </Text>
              </View>

              <View style={{ gap: 14 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                    Workspace Name
                  </Text>
                  <TextInput
                    value={workspaceName}
                    onChangeText={setWorkspaceName}
                    placeholder="Workspace Name"
                    placeholderTextColor={tokens.mutedForeground}
                    style={{
                      height: 42,
                      paddingHorizontal: 12,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: tokens.background,
                      color: tokens.foreground,
                      borderColor: tokens.border,
                      borderWidth: 1,
                      fontSize: 14,
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  />
                </View>

                {/* Currency Selector */}
                <View style={{ gap: 8 }}>
                  <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                    Workspace Currency
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {currencies.map((curr) => (
                      <Pressable
                        key={curr.code}
                        onPress={() => setWorkspaceCurrency(curr.code)}
                        style={({ hovered }: any) => [
                          {
                            minWidth: 90,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: tokens.radiusControl,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: workspaceCurrency === curr.code ? tokens.finance : hovered ? tokens.financeSoft : tokens.muted,
                            borderWidth: 1,
                            borderColor: workspaceCurrency === curr.code ? tokens.finance : tokens.border,
                            gap: 2,
                          },
                          Platform.OS === "web" ? ({ cursor: "pointer", transition: "all 160ms ease" } as any) : null,
                        ]}
                      >
                        <Text
                          style={{
                            color: workspaceCurrency === curr.code ? tokens.primaryForeground : tokens.foreground,
                            fontSize: 14,
                            fontWeight: "800",
                            fontFamily: "JetBrains Mono",
                          }}
                        >
                          {curr.symbol} {curr.code}
                        </Text>
                        <Text
                          style={{
                            color: workspaceCurrency === curr.code ? "rgba(255, 255, 255, 0.85)" : tokens.mutedForeground,
                            fontSize: 10,
                          }}
                        >
                          {curr.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Save Workspace Settings Button */}
                <View style={{ padding: 4, marginHorizontal: -4, backgroundColor: "transparent" }}>
                  <Button
                    label="Save Workspace Settings"
                    variant="primary"
                    size="md"
                    loading={isSavingWorkspace}
                    disabled={isSavingWorkspace}
                    icon={<MaterialIcons name="check" size={16} color={tokens.primaryForeground} />}
                    onPress={handleSaveWorkspace}
                    style={{ backgroundColor: tokens.finance, borderColor: tokens.finance }}
                  />
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* CARD 4: Security & Change Password */}
          <Animated.View style={securityEntrance}>
            <Card
              style={{
                padding: isDesktop ? 24 : 18,
                borderRadius: tokens.radiusCard,
                borderColor: tokens.border,
                borderWidth: 1,
                backgroundColor: tokens.card,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <MaterialIcons name="security" size={20} color={tokens.destructive} />
                <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "800", fontFamily: "Plus Jakarta Sans" }}>
                  Security & Password
                </Text>
              </View>

              {passwordError ? (
                <View
                  style={{
                    padding: 10,
                    borderRadius: tokens.radiusControl,
                    backgroundColor: `${tokens.destructive}18`,
                    borderWidth: 1,
                    borderColor: tokens.destructive,
                  }}
                >
                  <Text style={{ color: tokens.destructive, fontSize: 12, fontWeight: "600" }}>
                    {passwordError}
                  </Text>
                </View>
              ) : null}

              <View style={{ gap: 14 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                    Current Password
                  </Text>
                  <TextInput
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor={tokens.mutedForeground}
                    secureTextEntry
                    style={{
                      height: 42,
                      paddingHorizontal: 12,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: tokens.background,
                      color: tokens.foreground,
                      borderColor: tokens.border,
                      borderWidth: 1,
                      fontSize: 14,
                    }}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                    New Password
                  </Text>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="At least 8 characters"
                    placeholderTextColor={tokens.mutedForeground}
                    secureTextEntry
                    style={{
                      height: 42,
                      paddingHorizontal: 12,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: tokens.background,
                      color: tokens.foreground,
                      borderColor: tokens.border,
                      borderWidth: 1,
                      fontSize: 14,
                    }}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                    Confirm New Password
                  </Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Repeat new password"
                    placeholderTextColor={tokens.mutedForeground}
                    secureTextEntry
                    style={{
                      height: 42,
                      paddingHorizontal: 12,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: tokens.background,
                      color: tokens.foreground,
                      borderColor: tokens.border,
                      borderWidth: 1,
                      fontSize: 14,
                    }}
                  />
                </View>

                {/* Change Password Button */}
                <View style={{ padding: 4, marginHorizontal: -4, backgroundColor: "transparent" }}>
                  <Button
                    label="Update Password"
                    variant="outline"
                    size="md"
                    loading={isChangingPassword}
                    disabled={isChangingPassword}
                    icon={<MaterialIcons name="lock-reset" size={16} color={tokens.foreground} />}
                    onPress={handleChangePassword}
                  />
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* CARD 5: Active Sessions & Sign Out */}
          <Animated.View style={sessionsEntrance}>
            <Card
              style={{
                padding: isDesktop ? 24 : 18,
                borderRadius: tokens.radiusCard,
                borderColor: tokens.border,
                borderWidth: 1,
                backgroundColor: tokens.card,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <MaterialIcons name="devices" size={20} color={tokens.doo} />
                  <View>
                    <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "800", fontFamily: "Plus Jakarta Sans" }}>
                      Active Device Sessions
                    </Text>
                    <Text style={{ color: tokens.mutedForeground, fontSize: 11 }}>
                      Authorized refresh sessions with access to your workspace
                    </Text>
                  </View>
                </View>

                <Button
                  label="Sign Out"
                  variant="destructive"
                  size="sm"
                  icon={<MaterialIcons name="logout" size={14} color={tokens.primaryForeground} />}
                  onPress={handleSignOut}
                />
              </View>

              {isLoadingSessions ? (
                <View style={{ paddingVertical: 20, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={tokens.primary} />
                </View>
              ) : sessions.length === 0 ? (
                <Text style={{ color: tokens.mutedForeground, fontSize: 13, fontStyle: "italic" }}>
                  No active sessions found.
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {sessions.map((sess) => (
                    <View
                      key={sess.id}
                      style={{
                        padding: 12,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: tokens.background,
                        borderWidth: 1,
                        borderColor: tokens.border,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <View style={{ gap: 2, flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                            {sess.user_agent ? sess.user_agent.slice(0, 50) : "Web Browser"}
                          </Text>
                          {sess.is_current ? (
                            <View
                              style={{
                                paddingHorizontal: 6,
                                paddingVertical: 1,
                                borderRadius: 999,
                                backgroundColor: tokens.financeSoft,
                              }}
                            >
                              <Text style={{ color: tokens.finance, fontSize: 10, fontWeight: "700" }}>
                                Current
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontFamily: "JetBrains Mono" }}>
                          IP: {sess.ip_address} · {sess.created_at ? new Date(sess.created_at).toLocaleDateString() : ""}
                        </Text>
                      </View>

                      {!sess.is_current ? (
                        <IconButton
                          icon="close"
                          size="sm"
                          variant="destructive"
                          accessibilityLabel="Revoke session"
                          onPress={() => handleRevokeSession(sess)}
                        />
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </Animated.View>
        </ScrollView>
      </AdaptiveShell>
    </View>
  );
}
