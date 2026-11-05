import { API_BASE_URL } from "./client";
import { ColorMode, ThemeStyle } from "@/theme/tokens";

export interface WorkspaceSummary {
  id: string;
  name: string;
  type: "personal" | "couple" | "family" | "group" | string;
  currency: string;
  role: "owner" | "editor" | "viewer" | string;
  categories_count?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  theme_style: ThemeStyle;
  color_mode: ColorMode | "system";
  is_email_verified: boolean;
  is_2fa_enabled: boolean;
}

export interface AuthSessionPayload {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserProfile;
  workspaces: WorkspaceSummary[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  display_name: string;
  email: string;
  password: string;
  currency?: string;
}

export class ApiAuthError extends Error {
  status: number;
  code: string;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    code = "auth_error",
    fieldErrors?: Record<string, string>,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function parseJsonSafe(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function registerWithEmail(
  payload: RegisterCredentials
): Promise<AuthSessionPayload> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Unable to create your account. Please check your details.",
      response.status,
      data.error || "register_failed",
      data.field_errors,
      data.retry_after_seconds
    );
  }

  return data as AuthSessionPayload;
}

export async function loginWithEmail(
  credentials: LoginCredentials
): Promise<AuthSessionPayload> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
    body: JSON.stringify(credentials),
  });

  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Unable to sign in. Please check your credentials.",
      response.status,
      data.error || "login_failed",
      data.field_errors,
      data.retry_after_seconds
    );
  }

  return data as AuthSessionPayload;
}

export async function refreshAuthSession(
  refreshToken?: string | null
): Promise<AuthSessionPayload> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
    body: JSON.stringify(
      refreshToken ? { refresh_token: refreshToken } : {}
    ),
  });

  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Session expired. Please sign in again.",
      response.status,
      data.error || "refresh_failed"
    );
  }

  return data as AuthSessionPayload;
}

export async function logoutAuthSession(
  refreshToken?: string | null
): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
    body: JSON.stringify(
      refreshToken ? { refresh_token: refreshToken } : {}
    ),
  });
}

export async function fetchCurrentUser(accessToken: string): Promise<{
  user: UserProfile;
  workspaces: WorkspaceSummary[];
}> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  });

  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to fetch user profile.",
      response.status,
      data.error || "unauthorized"
    );
  }

  return data;
}
