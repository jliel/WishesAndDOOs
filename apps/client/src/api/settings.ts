import { API_BASE_URL } from "./client";

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  theme_style: "classical" | "pastel" | "joyful";
  color_mode: "system" | "light" | "dark";
  created_at?: string | null;
}

export interface WorkspaceSettings {
  id: string;
  name: string;
  currency: string;
  type: string;
}

export interface UserSessionItem {
  id: string;
  ip_address: string;
  user_agent: string;
  created_at?: string | null;
  expires_at?: string | null;
  is_current: boolean;
}

export async function fetchProfile(token: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/settings/profile`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to load profile.");
  }
  return body.user as UserProfile;
}

export async function updateProfile(
  token: string,
  payload: {
    display_name?: string;
    theme_style?: string;
    color_mode?: string;
    avatar_url?: string | null;
  }
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/settings/profile`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to update profile.");
  }
  return body.user as UserProfile;
}

export async function changePassword(
  token: string,
  payload: {
    current_password: string;
    new_password: string;
  }
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/settings/change-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to change password.");
  }
}

export async function updateWorkspaceSettings(
  token: string,
  workspaceId: string,
  payload: {
    name?: string;
    currency?: string;
  }
): Promise<WorkspaceSettings> {
  const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to update workspace settings.");
  }
  return body.workspace as WorkspaceSettings;
}

export async function fetchUserSessions(token: string): Promise<UserSessionItem[]> {
  const res = await fetch(`${API_BASE_URL}/settings/sessions`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to fetch active sessions.");
  }
  return body.sessions as UserSessionItem[];
}

export async function revokeUserSession(token: string, sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/settings/sessions/${sessionId}/revoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to revoke session.");
  }
}
