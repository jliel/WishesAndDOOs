/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        card: "var(--color-card)",
        muted: "var(--color-muted)",
        foreground: "var(--color-foreground)",
        "muted-foreground": "var(--color-muted-foreground)",
        border: "var(--color-border)",
        primary: "var(--color-primary)",
        "primary-foreground": "var(--color-primary-foreground)",
        finance: "var(--color-finance)",
        "finance-soft": "var(--color-finance-soft)",
        wish: "var(--color-wish)",
        "wish-soft": "var(--color-wish-soft)",
        doo: "var(--color-doo)",
        "doo-soft": "var(--color-doo-soft)",
        warning: "var(--color-warning)",
        destructive: "var(--color-destructive)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
      },
    },
  },
  plugins: [],
};
