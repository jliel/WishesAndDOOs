import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import RegisterScreen, { evaluatePasswordStrength } from "../../app/register";
import * as authApi from "@/api/auth";
import { useAuthStore } from "@/store/authStore";

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

describe("Screen 3: Register Screen", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    jest.restoreAllMocks();
  });

  it("evaluates password strength rules accurately", () => {
    expect(evaluatePasswordStrength("short", "").score).toBe(0);
    expect(evaluatePasswordStrength("alllowercase10", "").score).toBe(2);
    const strong = evaluatePasswordStrength(
      "StrongPass2026!",
      "StrongPass2026!"
    );
    expect(strong.score).toBe(4);
    expect(strong.label).toBe("Strong");
  });

  it("renders all registration fields, live password strength meter, and validates empty submit", () => {
    const { getAllByText, getByText, getByLabelText, queryByText } = render(
      <ThemeProvider initialStyle="classical" initialMode="light">
        <RegisterScreen />
      </ThemeProvider>
    );

    expect(getAllByText("Create Account").length).toBeGreaterThanOrEqual(2);
    expect(getByLabelText("Display Name")).toBeTruthy();
    expect(getByLabelText("Email Address")).toBeTruthy();
    expect(getByLabelText("Password")).toBeTruthy();
    expect(getByLabelText("Confirm Password")).toBeTruthy();

    // No version badges or inline theme bars
    expect(queryByText(/v1\.0/i)).toBeNull();

    // Submit empty form -> shows inline errors
    fireEvent.press(getByLabelText("Create Account"));
    expect(getByText("Display name is required.")).toBeTruthy();
    expect(getByText("Email address is required.")).toBeTruthy();
    expect(getByText("Password is required.")).toBeTruthy();
    expect(getByText("Please confirm your password.")).toBeTruthy();
  });

  it("creates a brand-new user account and Personal Workspace end-to-end", async () => {
    const registerSpy = jest
      .spyOn(authApi, "registerWithEmail")
      .mockResolvedValueOnce({
        access_token: "new-user-jwt-token",
        refresh_token: "new-user-refresh-token",
        token_type: "Bearer",
        expires_in: 900,
        user: {
          id: "user-elena",
          email: "elena@wishesanddoos.app",
          display_name: "Elena Gomez",
          avatar_url: null,
          theme_style: "classical",
          color_mode: "light",
          is_email_verified: true,
          is_2fa_enabled: false,
        },
        workspaces: [
          {
            id: "ws-elena",
            name: "Personal Workspace",
            type: "personal",
            currency: "MXN",
            role: "owner",
            categories_count: 10,
          },
        ],
      });

    const { getByLabelText, getByText } = render(
      <ThemeProvider initialStyle="classical" initialMode="light">
        <RegisterScreen />
      </ThemeProvider>
    );

    fireEvent.changeText(getByLabelText("Display Name"), "Elena Gomez");
    fireEvent.changeText(
      getByLabelText("Email Address"),
      "elena@wishesanddoos.app"
    );
    fireEvent.press(getByLabelText("Currency MXN"));
    fireEvent.changeText(getByLabelText("Password"), "StrongPass2026!");
    fireEvent.changeText(getByLabelText("Confirm Password"), "StrongPass2026!");

    expect(getByText("Strong")).toBeTruthy();

    fireEvent.press(getByLabelText("Create Account"));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith({
        display_name: "Elena Gomez",
        email: "elena@wishesanddoos.app",
        password: "StrongPass2026!",
        currency: "MXN",
      });
      expect(getByText("Welcome, Elena Gomez")).toBeTruthy();
      expect(getByText("Personal Workspace (MXN)")).toBeTruthy();
      expect(getByText("10 Seeded")).toBeTruthy();
    });
  });

  it("displays an error alert banner when email is already registered (409)", async () => {
    jest
      .spyOn(authApi, "registerWithEmail")
      .mockRejectedValueOnce(
        new authApi.ApiAuthError(
          "An account with this email address already exists. Please sign in instead.",
          409,
          "email_already_registered",
          { email: "An account with this email address already exists." }
        )
      );

    const { getByLabelText, getByText } = render(
      <ThemeProvider initialStyle="classical" initialMode="light">
        <RegisterScreen />
      </ThemeProvider>
    );

    fireEvent.changeText(getByLabelText("Display Name"), "Alex Rivera");
    fireEvent.changeText(
      getByLabelText("Email Address"),
      "demo@wishesanddoos.app"
    );
    fireEvent.changeText(getByLabelText("Password"), "StrongPass2026!");
    fireEvent.changeText(getByLabelText("Confirm Password"), "StrongPass2026!");

    fireEvent.press(getByLabelText("Create Account"));

    await waitFor(() => {
      expect(getByText("Email Already Registered")).toBeTruthy();
      expect(
        getByText("An account with this email address already exists.")
      ).toBeTruthy();
    });
  });
});
