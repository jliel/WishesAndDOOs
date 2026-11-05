import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { THEME_TOKENS } from "@/theme/tokens";
import WelcomeScreen from "../../app/welcome";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    SafeAreaView: ({ children, style }: any) => (
      <View style={style}>{children}</View>
    ),
  };
});

describe("Screen 1: Modern Minimal Welcome Screen", () => {
  it("defines all 3 minimalist theme presets across Light and Dark modes", () => {
    expect(Object.keys(THEME_TOKENS)).toEqual(["classical", "pastel", "joyful"]);
    expect(THEME_TOKENS.classical.light.background).toBe("#F8FAFC");
    expect(THEME_TOKENS.classical.dark.background).toBe("#090D16");
    expect(THEME_TOKENS.pastel.light.radiusCard).toBe(20);
    expect(THEME_TOKENS.joyful.light.radiusControl).toBe(999);
  });

  it("renders the concise hero and 3 floating showcase cards (Finances, Wishes, DOOs)", () => {
    const { getByText, getByLabelText, queryByText } = render(
      <ThemeProvider initialStyle="classical" initialMode="light">
        <WelcomeScreen />
      </ThemeProvider>
    );

    // Brand & 3 Key Showcase Cards
    expect(getByText("Wishes & DOOs")).toBeTruthy();
    expect(getByText("Finances")).toBeTruthy();
    expect(getByText("Wishes")).toBeTruthy();
    expect(getByText("DOOs")).toBeTruthy();

    // No version badges or inline theme switcher bar
    expect(queryByText(/v1\.0/i)).toBeNull();
    expect(queryByText(/Theme Preview/i)).toBeNull();

    // Interactive save transfer updates Wish progress & available balance
    expect(getByText("75% Funded")).toBeTruthy();
    fireEvent.press(getByLabelText("Simulate +$200 transfer to wish fund"));
    expect(getByText("81% Funded")).toBeTruthy();
  });
});
