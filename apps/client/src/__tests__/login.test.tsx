import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import LoginScreen, { DEMO_EMAIL, DEMO_PASSWORD } from "../../app/login";
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

describe("Screen 2: Login Screen", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    jest.restoreAllMocks();
  });

  it("renders Email and Password inputs, show/hide toggle, and validates empty fields", () => {
    const { getAllByText, getByText, getByLabelText, queryByText } = render(
      <ThemeProvider initialStyle="classical" initialMode="light">
        <LoginScreen />
      </ThemeProvider>
    );

    expect(getAllByText("Sign In").length).toBeGreaterThanOrEqual(2);
    expect(getByLabelText("Email Address")).toBeTruthy();
    expect(getByLabelText("Password")).toBeTruthy();

    // No version badges or inline theme bars
    expect(queryByText(/v1\.0/i)).toBeNull();

    // Submit empty form -> shows inline errors
    fireEvent.press(getByLabelText("Sign In"));
    expect(getByText("Email address is required.")).toBeTruthy();
    expect(getByText("Password is required.")).toBeTruthy();

    // Toggle show/hide password
    const showBtn = getByLabelText("Show password");
    fireEvent.press(showBtn);
    expect(getByLabelText("Hide password")).toBeTruthy();
  });

  it("fills demo account credentials and signs in successfully", async () => {
    jest.spyOn(authApi, "loginWithEmail").mockResolvedValueOnce({
      access_token: "test-jwt-access-token",
      refresh_token: "test-refresh-token",
      token_type: "Bearer",
      expires_in: 900,
      user: {
        id: "user-1",
        email: DEMO_EMAIL,
        display_name: "Alex Rivera",
        avatar_url: null,
        theme_style: "classical",
        color_mode: "light",
        is_email_verified: true,
        is_2fa_enabled: false,
      },
      workspaces: [
        {
          id: "ws-1",
          name: "Personal Workspace",
          type: "personal",
          currency: "USD",
          role: "owner",
        },
      ],
    });

    const { getByLabelText, getByText } = render(
      <ThemeProvider initialStyle="classical" initialMode="light">
        <LoginScreen />
      </ThemeProvider>
    );

    fireEvent.press(getByLabelText("Fill Demo"));
    expect(getByLabelText("Email Address").props.value).toBe(DEMO_EMAIL);
    expect(getByLabelText("Password").props.value).toBe(DEMO_PASSWORD);

    fireEvent.press(getByLabelText("Sign In"));

    await waitFor(() => {
      expect(getByText("Welcome, Alex Rivera")).toBeTruthy();
      expect(getByText("Personal Workspace (USD)")).toBeTruthy();
    });
  });

  it("displays an error alert banner on invalid credentials or rate limiting", async () => {
    jest
      .spyOn(authApi, "loginWithEmail")
      .mockRejectedValueOnce(
        new authApi.ApiAuthError(
          "Too many failed sign-in attempts. Your account has been locked for 15 minutes.",
          429,
          "account_locked"
        )
      );

    const { getByLabelText, getByText } = render(
      <ThemeProvider initialStyle="classical" initialMode="light">
        <LoginScreen />
      </ThemeProvider>
    );

    fireEvent.press(getByLabelText("Fill Demo"));
    fireEvent.press(getByLabelText("Sign In"));

    await waitFor(() => {
      expect(getByText("Security Protection Active")).toBeTruthy();
      expect(
        getByText(
          "Too many failed sign-in attempts. Your account has been locked for 15 minutes."
        )
      ).toBeTruthy();
    });
  });
});
