import { create } from "zustand";
import { Platform } from "react-native";
import {
  AuthSessionPayload,
  UserProfile,
  WorkspaceSummary,
} from "@/api/auth";

const STORAGE_KEY = "wad_auth_session_v1";

interface AuthState {
  user: UserProfile | null;
  workspaces: WorkspaceSummary[];
  currentWorkspace: WorkspaceSummary | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setSession: (payload: AuthSessionPayload) => void;
  clearSession: () => void;
}

function loadInitialSession(): Pick<
  AuthState,
  "user" | "workspaces" | "currentWorkspace" | "accessToken" | "refreshToken" | "isAuthenticated"
> {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.localStorage
  ) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthSessionPayload;
        if (parsed?.access_token && parsed?.user) {
          return {
            user: parsed.user,
            workspaces: parsed.workspaces || [],
            currentWorkspace: parsed.workspaces?.[0] || null,
            accessToken: parsed.access_token,
            refreshToken: null, // Refresh token is held in HttpOnly cookie
            isAuthenticated: true,
          };
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  return {
    user: null,
    workspaces: [],
    currentWorkspace: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadInitialSession(),

  setSession: (payload: AuthSessionPayload) => {
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.localStorage
    ) {
      try {
        // Security Hardening: Never store refresh token in Web localStorage.
        // It is protected in an HttpOnly, Secure, SameSite cookie.
        const safePayload = {
          access_token: payload.access_token,
          user: payload.user,
          workspaces: payload.workspaces,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safePayload));
      } catch {
        // Ignore storage write errors
      }
    }

    set({
      user: payload.user,
      workspaces: payload.workspaces || [],
      currentWorkspace: payload.workspaces?.[0] || null,
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      isAuthenticated: true,
    });
  },

  clearSession: () => {
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.localStorage
    ) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }

    set({
      user: null,
      workspaces: [],
      currentWorkspace: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },
}));
