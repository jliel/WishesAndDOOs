import React, { useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/theme/ThemeProvider";
import { ColorMode, THEME_TOKENS, ThemeStyle } from "@/theme/tokens";
import { useInteractiveMotion } from "@/lib/motion";

export type AppTabKey = "dashboard" | "finances" | "wishes" | "doos";

export interface NavTabItem {
  key: AppTabKey;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  accentKey: "primary" | "finance" | "wish" | "doo";
  screenStepLabel: string;
}

export const APP_NAV_TABS: NavTabItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "dashboard",
    accentKey: "finance",
    screenStepLabel: "Screen 4 · Active",
  },
  {
    key: "finances",
    label: "Finances",
    icon: "account-balance-wallet",
    accentKey: "finance",
    screenStepLabel: "Screen 5 · Next in Plan",
  },
  {
    key: "wishes",
    label: "Wishes",
    icon: "auto-awesome",
    accentKey: "wish",
    screenStepLabel: "Screen 6 · Upcoming",
  },
  {
    key: "doos",
    label: "DOOs",
    icon: "checklist",
    accentKey: "doo",
    screenStepLabel: "Screen 8 · Upcoming",
  },
];

const THEME_STYLE_OPTIONS: ThemeStyle[] = ["classical", "pastel", "joyful"];
const COLOR_MODE_OPTIONS: {
  mode: ColorMode;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
}[] = [
  { mode: "light", label: "Light", icon: "light-mode" },
  { mode: "dark", label: "Dark", icon: "dark-mode" },
];

interface ThemeSwitcherPanelProps {
  compact?: boolean;
}

function ThemeSwitcherControls({ compact = false }: ThemeSwitcherPanelProps) {
  const {
    themeStyle,
    colorMode,
    tokens,
    setThemeStyle,
    setColorMode,
  } = useAppTheme();

  return (
    <View style={{ gap: compact ? 10 : 12 }}>
      {/* Theme Style Selector (Classical | Pastel | Joyful) */}
      <View style={{ gap: 6 }}>
        <Text
          style={{
            color: tokens.mutedForeground,
            fontSize: 10,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Theme Style
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {THEME_STYLE_OPTIONS.map((styleKey) => {
            const isSelected = themeStyle === styleKey;
            const preset = THEME_TOKENS[styleKey][colorMode];
            return (
              <Pressable
                key={styleKey}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Select ${preset.label} theme`}
                onPress={() => setThemeStyle(styleKey)}
                style={[
                  {
                    flex: 1,
                    minHeight: 44,
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    borderRadius: tokens.radiusControl,
                    backgroundColor: isSelected ? tokens.primary : tokens.muted,
                    borderWidth: 1,
                    borderColor: isSelected ? tokens.primary : tokens.border,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                  },
                  Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: isSelected
                        ? tokens.primaryForeground
                        : preset.finance,
                    }}
                  />
                  <Text
                    style={{
                      color: isSelected
                        ? tokens.primaryForeground
                        : tokens.foreground,
                      fontSize: 12,
                      fontWeight: isSelected ? "800" : "700",
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  >
                    {preset.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Color Mode Selector (Light | Dark) */}
      <View style={{ gap: 6 }}>
        <Text
          style={{
            color: tokens.mutedForeground,
            fontSize: 10,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Color Mode
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {COLOR_MODE_OPTIONS.map((opt) => {
            const isSelected = colorMode === opt.mode;
            return (
              <Pressable
                key={opt.mode}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Switch to ${opt.label} mode`}
                onPress={() => setColorMode(opt.mode)}
                style={[
                  {
                    flex: 1,
                    minHeight: 44,
                    paddingHorizontal: 10,
                    borderRadius: tokens.radiusControl,
                    backgroundColor: isSelected ? tokens.primary : tokens.muted,
                    borderWidth: 1,
                    borderColor: isSelected ? tokens.primary : tokens.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  },
                  Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                ]}
              >
                <MaterialIcons
                  name={opt.icon}
                  size={15}
                  color={
                    isSelected ? tokens.primaryForeground : tokens.foreground
                  }
                />
                <Text
                  style={{
                    color: isSelected
                      ? tokens.primaryForeground
                      : tokens.foreground,
                    fontSize: 12,
                    fontWeight: isSelected ? "800" : "700",
                    fontFamily: "Plus Jakarta Sans",
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

interface NavTabButtonProps {
  item: NavTabItem;
  isActive: boolean;
  variant: "sidebar" | "bottom" | "drawer";
  onSelect: (tab: NavTabItem) => void;
}

function NavTabButton({ item, isActive, variant, onSelect }: NavTabButtonProps) {
  const { tokens } = useAppTheme();
  const motion = useInteractiveMotion({
    hoverScale: 1.015,
    hoverLift: -1.5,
    pressScale: 0.96,
  });

  const accentColor =
    item.accentKey === "finance"
      ? tokens.finance
      : item.accentKey === "wish"
      ? tokens.wish
      : item.accentKey === "doo"
      ? tokens.doo
      : tokens.primary;

  const accentSoft =
    item.accentKey === "finance"
      ? tokens.financeSoft
      : item.accentKey === "wish"
      ? tokens.wishSoft
      : item.accentKey === "doo"
      ? tokens.dooSoft
      : tokens.muted;

  if (variant === "sidebar" || variant === "drawer") {
    return (
      <Animated.View style={motion.animatedStyle}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: isActive }}
          accessibilityLabel={
            variant === "drawer"
              ? `Drawer Navigate to ${item.label}`
              : `Navigate to ${item.label}`
          }
          onPress={() => onSelect(item)}
          onHoverIn={motion.onHoverIn}
          onHoverOut={motion.onHoverOut}
          onPressIn={motion.onPressIn}
          onPressOut={motion.onPressOut}
          style={[
            {
              minHeight: 46,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: tokens.radiusControl,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: isActive
                ? accentSoft
                : motion.isHovered
                ? tokens.muted
                : "transparent",
              borderWidth: 1,
              borderColor: isActive ? accentColor : "transparent",
            },
            Platform.OS === "web"
              ? ({
                  cursor: "pointer",
                  transition: "background-color 160ms ease, border-color 160ms ease",
                } as any)
              : null,
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
            <MaterialIcons
              name={item.icon}
              size={20}
              color={isActive ? accentColor : tokens.mutedForeground}
            />
            <View>
              <Text
                style={{
                  color: isActive ? tokens.foreground : tokens.mutedForeground,
                  fontSize: 14,
                  fontWeight: isActive ? "700" : "600",
                  fontFamily: "Plus Jakarta Sans",
                }}
              >
                {item.label}
              </Text>
              {variant === "drawer" ? (
                <Text
                  style={{
                    color: tokens.mutedForeground,
                    fontSize: 10,
                    fontWeight: "600",
                  }}
                >
                  {item.screenStepLabel}
                </Text>
              ) : null}
            </View>
          </View>
          {isActive ? (
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: accentColor,
              }}
            />
          ) : (
            <MaterialIcons
              name="chevron-right"
              size={16}
              color={tokens.mutedForeground}
            />
          )}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[{ flex: 1 }, motion.animatedStyle]}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={`Navigate to ${item.label}`}
        onPress={() => onSelect(item)}
        onHoverIn={motion.onHoverIn}
        onHoverOut={motion.onHoverOut}
        onPressIn={motion.onPressIn}
        onPressOut={motion.onPressOut}
        style={[
          {
            minHeight: 52,
            borderRadius: tokens.radiusControl,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 6,
            gap: 3,
            backgroundColor: isActive
              ? accentSoft
              : motion.isHovered
              ? tokens.muted
              : "transparent",
          },
          Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
        ]}
      >
        <MaterialIcons
          name={item.icon}
          size={21}
          color={isActive ? accentColor : tokens.mutedForeground}
        />
        <Text
          style={{
            color: isActive ? accentColor : tokens.mutedForeground,
            fontSize: 11,
            fontWeight: isActive ? "700" : "600",
            fontFamily: "Plus Jakarta Sans",
          }}
        >
          {item.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export interface AdaptiveShellProps {
  activeTab?: AppTabKey;
  userDisplayName: string;
  userEmail?: string;
  workspaceName: string;
  workspaceCurrency: string;
  onSignOut?: () => void;
  children: React.ReactNode;
}

export function AdaptiveShell({
  activeTab = "dashboard",
  userDisplayName,
  userEmail,
  workspaceName,
  workspaceCurrency,
  onSignOut,
  children,
}: AdaptiveShellProps) {
  const { tokens, colorMode } = useAppTheme();
  const isDark = colorMode === "dark";
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  const avatarMotion = useInteractiveMotion({
    hoverScale: 1.04,
    hoverLift: -1,
    pressScale: 0.95,
  });

  const menuButtonMotion = useInteractiveMotion({
    hoverScale: 1.04,
    hoverLift: -1,
    pressScale: 0.95,
  });

  const signOutMotion = useInteractiveMotion({
    hoverScale: 1.02,
    hoverLift: -1,
    pressScale: 0.96,
  });

  const initials =
    userDisplayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "WD";

  const handleSelectTab = (tab: NavTabItem) => {
    setShowMobileDrawer(false);
    if (tab.key === activeTab) {
      setPreviewNotice(null);
      return;
    }
    setPreviewNotice(
      `${tab.label} (${tab.screenStepLabel}) will be constructed in its dedicated screen slice once you approve Screen 4.`
    );
  };

  const handleToggleAvatar = () => {
    if (!isDesktop) {
      setShowMobileDrawer((prev) => !prev);
      setShowProfileSheet(false);
      return;
    }
    setShowProfileSheet((prev) => !prev);
  };

  // Translucent glassmorphic surface so navigation bars blend seamlessly with the AmbientMeshBackground
  const navGlassSurface = `${tokens.card}${isDark ? "CC" : "BF"}`;
  const navBorderSubtle = `${tokens.border}${isDark ? "AA" : "CC"}`;
  const webBackdropBlur =
    Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px) saturate(150%)",
          WebkitBackdropFilter: "blur(20px) saturate(150%)",
        } as any)
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
      <View
        style={{
          flex: 1,
          flexDirection: isDesktop ? "row" : "column",
        }}
      >
        {/* Desktop Left Sidebar Navigation (Glassmorphic, Harmonized with Ambient Canvas) */}
        {isDesktop ? (
          <View
            style={[
              {
                width: 248,
                borderRightWidth: 1,
                borderRightColor: navBorderSubtle,
                backgroundColor: navGlassSurface,
                paddingHorizontal: 16,
                paddingVertical: 18,
                justifyContent: "space-between",
              },
              webBackdropBlur,
            ]}
          >
            <View style={{ gap: 20 }}>
              {/* Brand Header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      backgroundColor: tokens.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialIcons
                      name="auto-awesome"
                      size={16}
                      color={tokens.primaryForeground}
                    />
                  </View>
                  <Text
                    style={{
                      color: tokens.foreground,
                      fontSize: 15,
                      fontWeight: "800",
                      letterSpacing: -0.3,
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  >
                    Wishes & DOOs
                  </Text>
                </View>
              </View>

              {/* Workspace Pill Card */}
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: tokens.radiusControl,
                  backgroundColor: `${tokens.muted}${isDark ? "AA" : "CC"}`,
                  borderWidth: 1,
                  borderColor: navBorderSubtle,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <MaterialIcons name="workspaces-outline" size={16} color={tokens.finance} />
                  <Text
                    numberOfLines={1}
                    style={{
                      color: tokens.foreground,
                      fontSize: 12,
                      fontWeight: "700",
                      flex: 1,
                    }}
                  >
                    {workspaceName}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor: tokens.financeSoft,
                  }}
                >
                  <Text
                    style={{
                      color: tokens.finance,
                      fontSize: 11,
                      fontWeight: "700",
                      fontFamily: "JetBrains Mono",
                    }}
                  >
                    {workspaceCurrency}
                  </Text>
                </View>
              </View>

              {/* Primary Navigation Tabs */}
              <View style={{ gap: 5 }}>
                <Text
                  style={{
                    color: tokens.mutedForeground,
                    fontSize: 10,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.7,
                    paddingHorizontal: 6,
                    marginBottom: 4,
                  }}
                >
                  Workspace Modules
                </Text>
                {APP_NAV_TABS.map((tab) => (
                  <NavTabButton
                    key={tab.key}
                    item={tab}
                    isActive={tab.key === activeTab}
                    variant="sidebar"
                    onSelect={handleSelectTab}
                  />
                ))}
              </View>
            </View>

            {/* Desktop Footer User Card */}
            <View
              style={{
                padding: 12,
                borderRadius: tokens.radiusCard,
                backgroundColor: `${tokens.muted}${isDark ? "AA" : "CC"}`,
                borderWidth: 1,
                borderColor: navBorderSubtle,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    backgroundColor: tokens.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: tokens.primaryForeground,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    {initials}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: tokens.foreground,
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    {userDisplayName}
                  </Text>
                  {userEmail ? (
                    <Text
                      numberOfLines={1}
                      style={{
                        color: tokens.mutedForeground,
                        fontSize: 11,
                      }}
                    >
                      {userEmail}
                    </Text>
                  ) : null}
                </View>
              </View>

              {onSignOut ? (
                <Animated.View style={signOutMotion.animatedStyle}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sign Out"
                    onPress={onSignOut}
                    onHoverIn={signOutMotion.onHoverIn}
                    onHoverOut={signOutMotion.onHoverOut}
                    onPressIn={signOutMotion.onPressIn}
                    onPressOut={signOutMotion.onPressOut}
                    style={[
                      {
                        minHeight: 38,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: signOutMotion.isHovered
                          ? tokens.card
                          : "transparent",
                        borderWidth: 1,
                        borderColor: tokens.border,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      },
                      Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                    ]}
                  >
                    <MaterialIcons
                      name="logout"
                      size={15}
                      color={tokens.mutedForeground}
                    />
                    <Text
                      style={{
                        color: tokens.foreground,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      Sign Out
                    </Text>
                  </Pressable>
                </Animated.View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Main Content Column */}
        <View style={{ flex: 1, position: "relative" }}>
          {/* Top Header Bar: Compact Half-Height (~38px) on Desktop PC, Touch-Friendly on Mobile */}
          <View
            style={[
              {
                minHeight: isDesktop ? 38 : 54,
                paddingHorizontal: isDesktop ? 28 : isTablet ? 20 : 14,
                paddingVertical: isDesktop ? 5 : 8,
                borderBottomWidth: 1,
                borderBottomColor: navBorderSubtle,
                backgroundColor: navGlassSurface,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                zIndex: 40,
              },
              webBackdropBlur,
            ]}
          >
            {/* Left Side: Mobile Hamburger Menu + Brand/Workspace Breadcrumb */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {!isDesktop ? (
                <Animated.View style={menuButtonMotion.animatedStyle}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open navigation menu"
                    onPress={() => setShowMobileDrawer(true)}
                    onHoverIn={menuButtonMotion.onHoverIn}
                    onHoverOut={menuButtonMotion.onHoverOut}
                    onPressIn={menuButtonMotion.onPressIn}
                    onPressOut={menuButtonMotion.onPressOut}
                    style={[
                      {
                        minWidth: 44,
                        minHeight: 44,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: showMobileDrawer
                          ? tokens.primary
                          : `${tokens.muted}${isDark ? "AA" : "CC"}`,
                        borderWidth: 1,
                        borderColor: showMobileDrawer
                          ? tokens.primary
                          : navBorderSubtle,
                        alignItems: "center",
                        justifyContent: "center",
                      },
                      Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                    ]}
                  >
                    <MaterialIcons
                      name="menu"
                      size={20}
                      color={
                        showMobileDrawer
                          ? tokens.primaryForeground
                          : tokens.foreground
                      }
                    />
                  </Pressable>
                </Animated.View>
              ) : null}

              {isDesktop ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text
                    style={{
                      color: tokens.foreground,
                      fontSize: 13,
                      fontWeight: "800",
                      letterSpacing: -0.2,
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  >
                    Overview · {workspaceName}
                  </Text>
                  <Text style={{ color: tokens.border, fontSize: 12 }}>•</Text>
                  <Text
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    Welcome back, {userDisplayName}
                  </Text>
                </View>
              ) : (
                <View>
                  <Text
                    style={{
                      color: tokens.foreground,
                      fontSize: 15,
                      fontWeight: "800",
                      letterSpacing: -0.3,
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  >
                    {workspaceName}
                  </Text>
                  <Text
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 11,
                    }}
                  >
                    Welcome back, {userDisplayName}
                  </Text>
                </View>
              )}
            </View>

            {/* Right Header Actions: Currency Badge + Anchored Settings Trigger */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  paddingHorizontal: isDesktop ? 8 : 10,
                  paddingVertical: isDesktop ? 3 : 5,
                  borderRadius: 999,
                  backgroundColor: tokens.financeSoft,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <MaterialIcons
                  name="account-balance-wallet"
                  size={isDesktop ? 12 : 14}
                  color={tokens.finance}
                />
                <Text
                  style={{
                    color: tokens.finance,
                    fontSize: isDesktop ? 11 : 12,
                    fontWeight: "700",
                    fontFamily: "JetBrains Mono",
                  }}
                >
                  {workspaceCurrency}
                </Text>
              </View>

              <Animated.View style={avatarMotion.animatedStyle}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open Profile and Settings"
                  onPress={handleToggleAvatar}
                  onHoverIn={avatarMotion.onHoverIn}
                  onHoverOut={avatarMotion.onHoverOut}
                  onPressIn={avatarMotion.onPressIn}
                  onPressOut={avatarMotion.onPressOut}
                  style={[
                    {
                      minWidth: isDesktop ? 36 : 44,
                      minHeight: isDesktop ? 30 : 44,
                      paddingHorizontal: isDesktop ? 9 : 10,
                      borderRadius: 999,
                      backgroundColor:
                        showProfileSheet || showMobileDrawer
                          ? tokens.primary
                          : `${tokens.muted}${isDark ? "AA" : "CC"}`,
                      borderWidth: 1,
                      borderColor:
                        showProfileSheet || showMobileDrawer
                          ? tokens.primary
                          : navBorderSubtle,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                    },
                    Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                  ]}
                >
                  <Text
                    style={{
                      color:
                        showProfileSheet || showMobileDrawer
                          ? tokens.primaryForeground
                          : tokens.foreground,
                      fontSize: isDesktop ? 11 : 12,
                      fontWeight: "800",
                    }}
                  >
                    {initials}
                  </Text>
                  <MaterialIcons
                    name="settings"
                    size={isDesktop ? 14 : 15}
                    color={
                      showProfileSheet || showMobileDrawer
                        ? tokens.primaryForeground
                        : tokens.mutedForeground
                    }
                  />
                </Pressable>
              </Animated.View>
            </View>
          </View>

          {/* Desktop Floating Settings Mini-Panel Popover (Anchored right beneath Settings button, zero layout shift) */}
          {isDesktop && showProfileSheet ? (
            <>
              <Pressable
                accessibilityLabel="Close Settings Popover Backdrop"
                onPress={() => setShowProfileSheet(false)}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[
                  {
                    position: "absolute",
                    top: 44,
                    right: 28,
                    width: 336,
                    zIndex: 60,
                    padding: 16,
                    borderRadius: tokens.radiusCard,
                    backgroundColor: tokens.card,
                    borderWidth: 1,
                    borderColor: tokens.border,
                    gap: 14,
                  },
                  Platform.OS === "web"
                    ? ({
                        boxShadow: isDark
                          ? "0 24px 48px -8px rgba(0, 0, 0, 0.65)"
                          : "0 24px 48px -10px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.06)",
                      } as any)
                    : {
                        shadowColor: tokens.shadowColor,
                        shadowOffset: { width: 0, height: 12 },
                        shadowOpacity: 0.2,
                        shadowRadius: 24,
                        elevation: 10,
                      },
                ]}
              >
                {/* Popover Header */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        backgroundColor: tokens.primary,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: tokens.primaryForeground,
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        {initials}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: tokens.foreground,
                          fontSize: 13,
                          fontWeight: "800",
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      >
                        {userDisplayName}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: tokens.mutedForeground,
                          fontSize: 11,
                        }}
                      >
                        {workspaceName} ({workspaceCurrency})
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close Profile Preview"
                    onPress={() => setShowProfileSheet(false)}
                    style={[
                      {
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        backgroundColor: tokens.muted,
                        alignItems: "center",
                        justifyContent: "center",
                      },
                      Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                    ]}
                  >
                    <MaterialIcons name="close" size={15} color={tokens.mutedForeground} />
                  </Pressable>
                </View>

                {/* Live 2-Axis Theme Switcher Inside Desktop Floating Mini-Panel */}
                <View
                  style={{
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: tokens.border,
                  }}
                >
                  <ThemeSwitcherControls compact />
                </View>

                {/* Popover Footer Actions */}
                <View
                  style={{
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: tokens.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 11,
                      flex: 1,
                    }}
                  >
                    Full security & sessions in Screen 10 (/settings)
                  </Text>
                  {onSignOut ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Sign Out from Header"
                      onPress={onSignOut}
                      style={[
                        {
                          minHeight: 34,
                          paddingHorizontal: 10,
                          borderRadius: tokens.radiusControl,
                          backgroundColor: tokens.muted,
                          borderWidth: 1,
                          borderColor: tokens.border,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                        },
                        Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                      ]}
                    >
                      <MaterialIcons name="logout" size={13} color={tokens.destructive} />
                      <Text
                        style={{
                          color: tokens.destructive,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        Sign Out
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </>
          ) : null}

          {/* Tab Navigation Notice Banner (when tapping upcoming tabs 5, 6, 8) */}
          {previewNotice ? (
            <View
              style={{
                marginHorizontal: isDesktop ? 32 : isTablet ? 24 : 16,
                marginTop: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: tokens.radiusControl,
                backgroundColor: tokens.financeSoft,
                borderWidth: 1,
                borderColor: tokens.finance,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <MaterialIcons name="info-outline" size={17} color={tokens.finance} />
                <Text
                  style={{
                    color: tokens.foreground,
                    fontSize: 12,
                    fontWeight: "600",
                    flex: 1,
                  }}
                >
                  {previewNotice}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss navigation notice"
                onPress={() => setPreviewNotice(null)}
                style={{ padding: 4 }}
              >
                <MaterialIcons name="close" size={16} color={tokens.mutedForeground} />
              </Pressable>
            </View>
          ) : null}

          {/* Scrollable Main Screen Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: isDesktop ? 32 : isTablet ? 24 : 16,
              paddingTop: 20,
              paddingBottom: isDesktop ? 40 : 104,
              maxWidth: 1240,
              width: "100%",
              alignSelf: "center",
            }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {/* Mobile & Tablet Always-Visible 4-Tab Bottom Navigation Bar */}
          {!isDesktop ? (
            <View
              style={[
                {
                  borderTopWidth: 1,
                  borderTopColor: navBorderSubtle,
                  backgroundColor: navGlassSurface,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 6,
                },
                webBackdropBlur,
              ]}
            >
              {APP_NAV_TABS.map((tab) => (
                <NavTabButton
                  key={tab.key}
                  item={tab}
                  isActive={tab.key === activeTab}
                  variant="bottom"
                  onSelect={handleSelectTab}
                />
              ))}
            </View>
          ) : null}

          {/* Mobile & Tablet Overlapping Hamburger Drawer / Panel */}
          {!isDesktop && showMobileDrawer ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  zIndex: 80,
                  flexDirection: "row",
                },
              ]}
            >
              {/* Overlapping Slide-Over Drawer Sheet */}
              <View
                style={[
                  {
                    width: Math.min(320, width * 0.84),
                    height: "100%",
                    backgroundColor: tokens.card,
                    borderRightWidth: 1,
                    borderRightColor: tokens.border,
                    paddingHorizontal: 18,
                    paddingVertical: 18,
                    justifyContent: "space-between",
                  },
                  Platform.OS === "web"
                    ? ({
                        boxShadow: isDark
                          ? "16px 0 44px rgba(0, 0, 0, 0.7)"
                          : "16px 0 44px rgba(15, 23, 42, 0.22)",
                      } as any)
                    : {
                        shadowColor: tokens.shadowColor,
                        shadowOffset: { width: 8, height: 0 },
                        shadowOpacity: 0.25,
                        shadowRadius: 24,
                        elevation: 16,
                      },
                ]}
              >
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ gap: 20, paddingBottom: 16 }}
                >
                  {/* Drawer Header */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: tokens.primary,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialIcons
                          name="auto-awesome"
                          size={17}
                          color={tokens.primaryForeground}
                        />
                      </View>
                      <View>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 15,
                            fontWeight: "800",
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          Wishes & DOOs
                        </Text>
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 11,
                          }}
                        >
                          {workspaceName} · {workspaceCurrency}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Close navigation menu"
                      onPress={() => setShowMobileDrawer(false)}
                      style={[
                        {
                          width: 40,
                          height: 40,
                          borderRadius: tokens.radiusControl,
                          backgroundColor: tokens.muted,
                          alignItems: "center",
                          justifyContent: "center",
                        },
                        Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                      ]}
                    >
                      <MaterialIcons name="close" size={18} color={tokens.foreground} />
                    </Pressable>
                  </View>

                  {/* Module Links inside Hamburger Drawer */}
                  <View style={{ gap: 6 }}>
                    <Text
                      style={{
                        color: tokens.mutedForeground,
                        fontSize: 10,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: 0.7,
                        paddingHorizontal: 4,
                      }}
                    >
                      Switch Module
                    </Text>
                    {APP_NAV_TABS.map((tab) => (
                      <NavTabButton
                        key={tab.key}
                        item={tab}
                        isActive={tab.key === activeTab}
                        variant="drawer"
                        onSelect={handleSelectTab}
                      />
                    ))}
                  </View>

                  {/* 2-Axis Theme Switcher Inside Mobile Hamburger Drawer */}
                  <View
                    style={{
                      paddingTop: 14,
                      borderTopWidth: 1,
                      borderTopColor: tokens.border,
                      gap: 10,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <MaterialIcons name="palette" size={15} color={tokens.primary} />
                      <Text
                        style={{
                          color: tokens.foreground,
                          fontSize: 13,
                          fontWeight: "800",
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      >
                        Appearance & Theme
                      </Text>
                    </View>
                    <ThemeSwitcherControls />
                  </View>
                </ScrollView>

                {/* Mobile Drawer Footer User & Sign Out */}
                <View
                  style={{
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: tokens.border,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        backgroundColor: tokens.primary,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: tokens.primaryForeground,
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        {initials}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: tokens.foreground,
                          fontSize: 13,
                          fontWeight: "700",
                        }}
                      >
                        {userDisplayName}
                      </Text>
                      {userEmail ? (
                        <Text
                          numberOfLines={1}
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 11,
                          }}
                        >
                          {userEmail}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {onSignOut ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Sign Out from Drawer"
                      onPress={onSignOut}
                      style={[
                        {
                          minHeight: 44,
                          borderRadius: tokens.radiusControl,
                          backgroundColor: tokens.muted,
                          borderWidth: 1,
                          borderColor: tokens.border,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        },
                        Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                      ]}
                    >
                      <MaterialIcons name="logout" size={16} color={tokens.destructive} />
                      <Text
                        style={{
                          color: tokens.destructive,
                          fontSize: 13,
                          fontWeight: "700",
                        }}
                      >
                        Sign Out
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* Dimmed Scrim Backdrop (Tap outside to dismiss) */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss navigation drawer backdrop"
                onPress={() => setShowMobileDrawer(false)}
                style={{
                  flex: 1,
                  backgroundColor: "rgba(9, 13, 22, 0.48)",
                }}
              />
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
