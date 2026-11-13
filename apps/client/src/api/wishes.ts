import { API_BASE_URL } from "./client";
import { ApiAuthError } from "./auth";

export interface WishSavingsGoalRef {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  progress_percent: number;
  color: string;
  icon: string;
}

export interface WishAccountRef {
  id: string;
  name: string;
  type: string;
  balance: number;
  icon: string;
  color: string;
}

export interface WishItem {
  id: string;
  workspace_id: string;
  category_id: string | null;
  category_name: string | null;
  category_icon: string;
  category_color: string;
  savings_goal_id: string | null;
  savings_goal: WishSavingsGoalRef | null;
  account_id: string | null;
  account: WishAccountRef | null;
  title: string;
  notes: string | null;
  url: string | null;
  image_storage_key: string | null;
  image_url: string | null;
  estimated_price: number | null;
  priority: "low" | "medium" | "high";
  status: "active" | "granted" | "archived";
  granted_at: string | null;
  fulfilled_transaction_id: string | null;
  linked_doos_count: number;
  linked_doos_done: number;
  doo_progress_percent: number;
  created_at: string | null;
}

export interface LinkedDooSubtask {
  id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
}

export interface LinkedDooItem {
  id: string;
  title: string;
  notes: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  due_date: string | null;
  recurrence_rule: string | null;
  subtasks_count: number;
  subtasks_completed: number;
  subtasks: LinkedDooSubtask[];
}

export interface FulfilledTransactionRef {
  id: string;
  account_id: string;
  account_name: string;
  amount: number;
  description: string;
  transaction_date: string | null;
}

export interface WishDetailResponse extends WishItem {
  workspace: {
    id: string;
    name: string;
    currency: string;
  };
  linked_doos: LinkedDooItem[];
  fulfilled_transaction: FulfilledTransactionRef | null;
}

export interface FulfillWishPayload {
  record_expense?: boolean;
  account_id?: string | null;
  expense_amount?: number | null;
  category_id?: string | null;
  description?: string | null;
}

export interface WishesSummary {
  total_wishes: number;
  active_wishes: number;
  granted_wishes: number;
  total_estimated_value: number;
}

export interface WishesListResponse {
  workspace: {
    id: string;
    name: string;
    currency: string;
  };
  summary: WishesSummary;
  wishes: WishItem[];
}

export interface CreateWishPayload {
  workspace_id?: string;
  category_id?: string | null;
  savings_goal_id?: string | null;
  account_id?: string | null;
  linked_doo_ids?: string[];
  title: string;
  notes?: string | null;
  url?: string | null;
  image_storage_key?: string | null;
  estimated_price?: number | null;
  priority?: "low" | "medium" | "high";
}

export interface UpdateWishPayload {
  category_id?: string | null;
  savings_goal_id?: string | null;
  account_id?: string | null;
  linked_doo_ids?: string[];
  title?: string;
  notes?: string | null;
  url?: string | null;
  image_storage_key?: string | null;
  estimated_price?: number | null;
  priority?: "low" | "medium" | "high";
  status?: "active" | "granted" | "archived";
}

export interface UploadImageResponse {
  status: string;
  storage_key: string;
  filename: string;
  image_url: string;
}

export async function fetchWishes(
  accessToken: string,
  params?: {
    workspace_id?: string;
    status?: string;
    priority?: string;
    category_id?: string;
  }
): Promise<WishesListResponse> {
  const queryParts: string[] = [];
  if (params?.workspace_id) queryParts.push(`workspace_id=${encodeURIComponent(params.workspace_id)}`);
  if (params?.status && params.status !== "all") queryParts.push(`status=${encodeURIComponent(params.status)}`);
  if (params?.priority && params.priority !== "all") queryParts.push(`priority=${encodeURIComponent(params.priority)}`);
  if (params?.category_id && params.category_id !== "all") queryParts.push(`category_id=${encodeURIComponent(params.category_id)}`);

  const qs = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
  const response = await fetch(`${API_BASE_URL}/wishes${qs}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to load wishes.",
      response.status,
      data.error || "wishes_fetch_error"
    );
  }
  return data as WishesListResponse;
}

export async function createWish(
  accessToken: string,
  payload: CreateWishPayload
): Promise<WishItem> {
  const response = await fetch(`${API_BASE_URL}/wishes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to create wish.",
      response.status,
      data.error || "wish_create_error"
    );
  }
  return data.wish as WishItem;
}

export async function updateWish(
  accessToken: string,
  wishId: string,
  payload: UpdateWishPayload
): Promise<WishItem> {
  const response = await fetch(`${API_BASE_URL}/wishes/${encodeURIComponent(wishId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to update wish.",
      response.status,
      data.error || "wish_update_error"
    );
  }
  return data.wish as WishItem;
}

export async function deleteWish(
  accessToken: string,
  wishId: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/wishes/${encodeURIComponent(wishId)}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to delete wish.",
      response.status,
      data.error || "wish_delete_error"
    );
  }
}

export async function fetchWishDetail(
  accessToken: string,
  wishId: string
): Promise<WishDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/wishes/${encodeURIComponent(wishId)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to load wish details.",
      response.status,
      data.error || "wish_detail_error"
    );
  }
  return data as WishDetailResponse;
}

export async function fulfillWish(
  accessToken: string,
  wishId: string,
  payload: FulfillWishPayload
): Promise<{ status: string; wish: WishDetailResponse }> {
  const response = await fetch(`${API_BASE_URL}/wishes/${encodeURIComponent(wishId)}/fulfill`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to fulfill wish.",
      response.status,
      data.error || "wish_fulfill_error"
    );
  }
  return data as { status: string; wish: WishDetailResponse };
}

export async function uploadWishImage(
  accessToken: string,
  fileBlob: Blob,
  fileName: string,
  workspaceId?: string
): Promise<UploadImageResponse> {
  const formData = new FormData();
  formData.append("file", fileBlob, fileName);
  if (workspaceId) {
    formData.append("workspace_id", workspaceId);
  }

  const response = await fetch(`${API_BASE_URL}/wishes/upload-image`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to upload image.",
      response.status,
      data.error || "image_upload_error"
    );
  }
  return data as UploadImageResponse;
}
