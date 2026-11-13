import { API_BASE_URL } from "./client";

export interface DooSubtask {
  id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
}

export interface LinkedWishSummary {
  id: string;
  title: string;
  status: string;
  estimated_price?: number | null;
}

export interface DooItem {
  id: string;
  workspace_id: string;
  wish_id?: string | null;
  wish?: LinkedWishSummary | null;
  category_id?: string | null;
  category_name?: string | null;
  assigned_to?: string | null;
  title: string;
  notes?: string | null;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "done";
  due_date?: string | null;
  recurrence_rule: "none" | "daily" | "weekly" | "monthly" | "custom";
  completed_at?: string | null;
  created_at?: string | null;
  subtasks: DooSubtask[];
  total_subtasks: number;
  done_subtasks: number;
  progress_percent: number;
}

export interface DoosSummary {
  total_doos: number;
  pending_doos: number;
  today_doos: number;
  upcoming_doos: number;
  completed_doos: number;
}

export interface DoosListResponse {
  workspace: {
    id: string;
    name: string;
    currency: string;
  };
  summary: DoosSummary;
  items: DooItem[];
}

export interface CreateDooPayload {
  title: string;
  workspace_id?: string;
  wish_id?: string | null;
  category_id?: string | null;
  notes?: string;
  priority?: "low" | "medium" | "high";
  status?: "todo" | "in_progress" | "done";
  due_date?: string | null;
  recurrence_rule?: "none" | "daily" | "weekly" | "monthly" | "custom";
  subtasks?: { title: string; is_completed?: boolean; sort_order?: number }[];
}

export interface UpdateDooPayload {
  title?: string;
  wish_id?: string | null;
  category_id?: string | null;
  notes?: string | null;
  priority?: "low" | "medium" | "high";
  status?: "todo" | "in_progress" | "done";
  due_date?: string | null;
  recurrence_rule?: "none" | "daily" | "weekly" | "monthly" | "custom";
  subtasks?: { title: string; is_completed?: boolean; sort_order?: number }[];
}

export async function fetchDoos(
  token: string,
  params?: {
    workspace_id?: string;
    view?: "all" | "today" | "upcoming" | "completed" | "calendar";
    priority?: string;
    status?: string;
    category_id?: string;
    wish_id?: string;
    search?: string;
  }
): Promise<DoosListResponse> {
  const query = new URLSearchParams();
  if (params?.workspace_id) query.append("workspace_id", params.workspace_id);
  if (params?.view) query.append("view", params.view);
  if (params?.priority && params.priority !== "all") query.append("priority", params.priority);
  if (params?.status && params.status !== "all") query.append("status", params.status);
  if (params?.category_id && params.category_id !== "all") query.append("category_id", params.category_id);
  if (params?.wish_id) query.append("wish_id", params.wish_id);
  if (params?.search) query.append("search", params.search);

  const res = await fetch(`${API_BASE_URL}/doos?${query.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to load tasks.");
  }
  return body as DoosListResponse;
}

export async function fetchDooDetail(token: string, dooId: string): Promise<DooItem> {
  const res = await fetch(`${API_BASE_URL}/doos/${dooId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to load task detail.");
  }
  return body.doo as DooItem;
}

export async function createDoo(token: string, payload: CreateDooPayload): Promise<DooItem> {
  const res = await fetch(`${API_BASE_URL}/doos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to create task.");
  }
  return body.doo as DooItem;
}

export async function updateDoo(
  token: string,
  dooId: string,
  payload: UpdateDooPayload
): Promise<DooItem> {
  const res = await fetch(`${API_BASE_URL}/doos/${dooId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to update task.");
  }
  return body.doo as DooItem;
}

export async function toggleDooStatus(
  token: string,
  dooId: string,
  targetStatus?: "todo" | "in_progress" | "done"
): Promise<DooItem> {
  const res = await fetch(`${API_BASE_URL}/doos/${dooId}/toggle`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(targetStatus ? { status: targetStatus } : {}),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to update task status.");
  }
  return body.doo as DooItem;
}

export async function deleteDoo(token: string, dooId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/doos/${dooId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to delete task.");
  }
}

export async function toggleSubtask(
  token: string,
  dooId: string,
  subtaskId: string,
  isCompleted?: boolean
): Promise<DooItem> {
  const res = await fetch(`${API_BASE_URL}/doos/${dooId}/subtasks/${subtaskId}/toggle`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(isCompleted !== undefined ? { is_completed: isCompleted } : {}),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to update subtask.");
  }
  return body.doo as DooItem;
}

export async function addSubtask(
  token: string,
  dooId: string,
  title: string,
  sortOrder: number = 0
): Promise<DooItem> {
  const res = await fetch(`${API_BASE_URL}/doos/${dooId}/subtasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, sort_order: sortOrder }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to add subtask.");
  }
  return body.doo as DooItem;
}

export async function deleteSubtask(
  token: string,
  dooId: string,
  subtaskId: string
): Promise<DooItem> {
  const res = await fetch(`${API_BASE_URL}/doos/${dooId}/subtasks/${subtaskId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || "Failed to delete subtask.");
  }
  return body.doo as DooItem;
}
