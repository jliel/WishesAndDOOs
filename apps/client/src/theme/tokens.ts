export type ThemeStyle = "classical" | "pastel" | "joyful";
export type ColorMode = "light" | "dark";

export interface SemanticTokenSet {
  label: string;
  subtitle: string;
  background: string;
  backgroundSecondary: string;
  card: string;
  muted: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  primary: string;
  primaryForeground: string;
  finance: string;
  financeSoft: string;
  wish: string;
  wishSoft: string;
  doo: string;
  dooSoft: string;
  warning: string;
  destructive: string;
  radiusCard: number;
  radiusControl: number;
  shadowColor: string;
  fontSans: string;
  fontDisplay: string;
  fontMono: string;
}

export const THEME_TOKENS: Record<ThemeStyle, Record<ColorMode, SemanticTokenSet>> = {
  classical: {
    light: {
      label: "Classical",
      subtitle: "Modern Minimalist",
      background: "#F8FAFC",
      backgroundSecondary: "#EEF2FF",
      card: "#FFFFFF",
      muted: "#F1F5F9",
      foreground: "#0F172A",
      mutedForeground: "#64748B",
      border: "#E2E8F0",
      primary: "#0F172A",
      primaryForeground: "#FFFFFF",
      finance: "#059669",
      financeSoft: "#ECFDF5",
      wish: "#7C3AED",
      wishSoft: "#F5F3FF",
      doo: "#2563EB",
      dooSoft: "#EFF6FF",
      warning: "#D97706",
      destructive: "#DC2626",
      radiusCard: 18,
      radiusControl: 12,
      shadowColor: "#0F172A",
      fontSans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontDisplay: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontMono: "'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace",
    },
    dark: {
      label: "Classical",
      subtitle: "Modern Minimalist",
      background: "#090D16",
      backgroundSecondary: "#111827",
      card: "#131B2E",
      muted: "#1E293B",
      foreground: "#F8FAFC",
      mutedForeground: "#94A3B8",
      border: "#26334D",
      primary: "#F8FAFC",
      primaryForeground: "#090D16",
      finance: "#34D399",
      financeSoft: "#062E22",
      wish: "#A78BFA",
      wishSoft: "#23183E",
      doo: "#60A5FA",
      dooSoft: "#13233F",
      warning: "#FBBF24",
      destructive: "#F87171",
      radiusCard: 18,
      radiusControl: 12,
      shadowColor: "#000000",
      fontSans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontDisplay: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontMono: "'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace",
    },
  },
  pastel: {
    light: {
      label: "Pastel",
      subtitle: "Soft Nordic Calm",
      background: "#FAF8FF",
      backgroundSecondary: "#F0FDF9",
      card: "#FFFFFF",
      muted: "#F3EFFB",
      foreground: "#1E1B4B",
      mutedForeground: "#6E6A7C",
      border: "#E9E3F5",
      primary: "#5B5BD6",
      primaryForeground: "#FFFFFF",
      finance: "#2E9075",
      financeSoft: "#EAF6F2",
      wish: "#9353D3",
      wishSoft: "#F6EFFC",
      doo: "#3B82F6",
      dooSoft: "#EDF4FF",
      warning: "#D97706",
      destructive: "#E11D48",
      radiusCard: 20,
      radiusControl: 14,
      shadowColor: "#312E81",
      fontSans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontDisplay: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontMono: "'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace",
    },
    dark: {
      label: "Pastel",
      subtitle: "Soft Nordic Calm",
      background: "#13141C",
      backgroundSecondary: "#1A1B26",
      card: "#1B1D28",
      muted: "#252836",
      foreground: "#F4F4F6",
      mutedForeground: "#A3A0B8",
      border: "#2E3244",
      primary: "#A5B4FC",
      primaryForeground: "#13141C",
      finance: "#6EE7B7",
      financeSoft: "#132F28",
      wish: "#C084FC",
      wishSoft: "#2B1F3F",
      doo: "#93C5FD",
      dooSoft: "#192942",
      warning: "#FBBF24",
      destructive: "#FB7185",
      radiusCard: 20,
      radiusControl: 14,
      shadowColor: "#000000",
      fontSans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontDisplay: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontMono: "'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace",
    },
  },
  joyful: {
    light: {
      label: "Joyful",
      subtitle: "Warm Vibrant Modern",
      background: "#FFFDF9",
      backgroundSecondary: "#FFF1F2",
      card: "#FFFFFF",
      muted: "#FFF5EB",
      foreground: "#1C1917",
      mutedForeground: "#78716C",
      border: "#F5E6D3",
      primary: "#F97316",
      primaryForeground: "#FFFFFF",
      finance: "#10B981",
      financeSoft: "#ECFDF5",
      wish: "#EC4899",
      wishSoft: "#FDF2F8",
      doo: "#0284C7",
      dooSoft: "#F0F9FF",
      warning: "#F59E0B",
      destructive: "#EF4444",
      radiusCard: 24,
      radiusControl: 999,
      shadowColor: "#7C2D12",
      fontSans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontDisplay: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontMono: "'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace",
    },
    dark: {
      label: "Joyful",
      subtitle: "Warm Vibrant Modern",
      background: "#0F111A",
      backgroundSecondary: "#171926",
      card: "#181B26",
      muted: "#232736",
      foreground: "#FAFAF9",
      mutedForeground: "#A8A29E",
      border: "#2D3246",
      primary: "#FB923C",
      primaryForeground: "#0F111A",
      finance: "#34D399",
      financeSoft: "#092E24",
      wish: "#F472B6",
      wishSoft: "#361829",
      doo: "#38BDF8",
      dooSoft: "#102A3E",
      warning: "#FBBF24",
      destructive: "#F87171",
      radiusCard: 24,
      radiusControl: 999,
      shadowColor: "#000000",
      fontSans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontDisplay: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontMono: "'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace",
    },
  },
};
