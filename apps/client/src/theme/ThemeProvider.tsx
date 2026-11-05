import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { vars } from "nativewind";
import {
  ColorMode,
  SemanticTokenSet,
  THEME_TOKENS,
  ThemeStyle,
} from "./tokens";

interface ThemeContextValue {
  themeStyle: ThemeStyle;
  colorMode: ColorMode;
  tokens: SemanticTokenSet;
  setThemeStyle: (style: ThemeStyle) => void;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
  children,
  initialStyle = "classical",
  initialMode = "light",
}: {
  children: React.ReactNode;
  initialStyle?: ThemeStyle;
  initialMode?: ColorMode;
}) {
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>(initialStyle);
  const [colorMode, setColorMode] = useState<ColorMode>(initialMode);

  const tokens = useMemo(
    () => THEME_TOKENS[themeStyle][colorMode],
    [themeStyle, colorMode]
  );

  // Sync HTML attributes on Web so CSS variables in global.css update immediately
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const root = document.documentElement;
      root.setAttribute("data-theme", themeStyle);
      if (colorMode === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      document.body.style.backgroundColor = tokens.background;
      document.body.style.color = tokens.foreground;
    }
  }, [themeStyle, colorMode, tokens]);

  // Also inject NativeWind dynamic vars for native iOS/Android parity
  const nativeWindVars = useMemo(
    () =>
      vars({
        "--color-background": tokens.background,
        "--color-card": tokens.card,
        "--color-muted": tokens.muted,
        "--color-foreground": tokens.foreground,
        "--color-muted-foreground": tokens.mutedForeground,
        "--color-border": tokens.border,
        "--color-primary": tokens.primary,
        "--color-primary-foreground": tokens.primaryForeground,
        "--color-finance": tokens.finance,
        "--color-finance-soft": tokens.financeSoft,
        "--color-wish": tokens.wish,
        "--color-wish-soft": tokens.wishSoft,
        "--color-doo": tokens.doo,
        "--color-doo-soft": tokens.dooSoft,
        "--color-warning": tokens.warning,
        "--color-destructive": tokens.destructive,
        "--radius-card": `${tokens.radiusCard}px`,
        "--radius-control": `${tokens.radiusControl}px`,
      }),
    [tokens]
  );

  const toggleColorMode = () => {
    setColorMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const value = useMemo(
    () => ({
      themeStyle,
      colorMode,
      tokens,
      setThemeStyle,
      setColorMode,
      toggleColorMode,
    }),
    [themeStyle, colorMode, tokens]
  );

  return (
    <ThemeContext.Provider value={value}>
      <View
        style={[nativeWindVars, { flex: 1, backgroundColor: tokens.background }]}
        className={colorMode === "dark" ? "dark flex-1 bg-background" : "flex-1 bg-background"}
      >
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used inside a ThemeProvider");
  }
  return ctx;
}
