import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react-native";
import SettingsScreen from "../../app/(app)/settings";
import { ThemeProvider } from "../theme/ThemeProvider";
import { LanguageProvider } from "../i18n/LanguageProvider";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock("../api/settings", () => ({
  fetchProfile: jest.fn().mockResolvedValue({
    id: "user-1",
    email: "alex@wishesanddoos.local",
    display_name: "Alex Rivera",
    theme_style: "classical",
    color_mode: "light",
  }),
  updateProfile: jest.fn().mockResolvedValue({
    id: "user-1",
    email: "alex@wishesanddoos.local",
    display_name: "Alex Rivera Updated",
    theme_style: "pastel",
    color_mode: "dark",
  }),
  changePassword: jest.fn().mockResolvedValue(undefined),
  updateWorkspaceSettings: jest.fn().mockResolvedValue({
    id: "ws-1",
    name: "Alex Studio",
    currency: "EUR",
    type: "personal",
  }),
  fetchUserSessions: jest.fn().mockResolvedValue([
    {
      id: "sess-1",
      ip_address: "127.0.0.1",
      user_agent: "Mozilla/5.0 Chrome",
      created_at: "2026-11-08T00:00:00Z",
      expires_at: "2026-11-22T00:00:00Z",
      is_current: true,
    },
  ]),
  revokeUserSession: jest.fn().mockResolvedValue(undefined),
}));

describe("SettingsScreen (Screen 10)", () => {
  it("renders profile, language, appearance, workspace currency, security, and sessions cards", async () => {
    const { getByText } = render(
      <ThemeProvider>
        <LanguageProvider>
          <SettingsScreen />
        </LanguageProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByText("Profile & Settings")).toBeTruthy();
      expect(getByText("Profile Information")).toBeTruthy();
      expect(getByText("Language / Idioma")).toBeTruthy();
      expect(getByText("English")).toBeTruthy();
      expect(getByText("Español")).toBeTruthy();
      expect(getByText("Appearance & Theme")).toBeTruthy();
      expect(getByText("Workspace Settings")).toBeTruthy();
      expect(getByText("Security & Password")).toBeTruthy();
      expect(getByText("Active Device Sessions")).toBeTruthy();
      expect(getByText("Sign Out")).toBeTruthy();
    });
  });

  it("switches language between English and Spanish seamlessly", async () => {
    const { getByText, queryByText } = render(
      <ThemeProvider>
        <LanguageProvider>
          <SettingsScreen />
        </LanguageProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByText("Profile & Settings")).toBeTruthy();
    });

    // Switch to Spanish
    const esButton = getByText("Español");
    fireEvent.press(esButton);

    await waitFor(() => {
      expect(getByText("Perfil y Ajustes")).toBeTruthy();
      expect(getByText("Información del Perfil")).toBeTruthy();
    });

    // Switch back to English
    const enButton = getByText("English");
    fireEvent.press(enButton);

    await waitFor(() => {
      expect(getByText("Profile & Settings")).toBeTruthy();
      expect(getByText("Profile Information")).toBeTruthy();
    });
  });
});
