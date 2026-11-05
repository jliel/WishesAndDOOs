import { API_BASE_URL } from "./client";
import { ApiAuthError } from "./auth";

export interface DashboardAccountItem {
  id: string;
  name: string;
  type: "checking" | "savings" | "cash" | "credit" | string;
  balance: number;
  icon: string;
  color: string;
}

export interface DashboardTransactionItem {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer" | string;
  category_name: string;
  category_icon: string;
  transaction_date: string;
}

export interface DashboardBudgetCategoryItem {
  id: string;
  category_id: string;
  category_name: string;
  category_icon: string;
  monthly_limit: number;
  spent: number;
  remaining: number;
  utilization_pct: number;
  status: "healthy" | "warning" | "over";
}

export interface DashboardSavingsGoalItem {
  id: string;
  name: string;
  current_amount: number;
  target_amount: number;
  progress_pct: number;
  target_date: string | null;
  icon: string;
  color: string;
}

export interface DashboardWishItem {
  id: string;
  title: string;
  notes: string | null;
  estimated_price: number;
  priority: "low" | "medium" | "high" | string;
  status: "active" | "granted" | "archived" | string;
  category_name: string;
  category_icon: string;
  savings_goal_name: string | null;
  funded_amount: number;
  funded_pct: number;
  linked_doos_total: number;
  linked_doos_completed: number;
}

export interface DashboardDooItem {
  id: string;
  title: string;
  priority: "low" | "medium" | "high" | string;
  status: "todo" | "in_progress" | "done" | string;
  due_date: string;
  recurrence_rule: string;
  category_name: string;
  category_icon: string;
  wish_title: string | null;
  subtasks_total: number;
  subtasks_done: number;
}

export interface DashboardOverviewResponse {
  workspace: {
    id: string;
    name: string;
    type: string;
    currency: string;
    role: string;
  };
  finance_summary: {
    total_net_balance: number;
    monthly_income: number;
    monthly_expense: number;
    monthly_net_cashflow: number;
    savings_rate_pct: number;
    period_label: string;
    accounts: DashboardAccountItem[];
    recent_transactions: DashboardTransactionItem[];
  };
  budget_health: {
    period_month: string;
    total_budgeted: number;
    total_spent: number;
    utilization_pct: number;
    categories: DashboardBudgetCategoryItem[];
  };
  savings_goals: {
    total_saved: number;
    total_target: number;
    items: DashboardSavingsGoalItem[];
  };
  top_wishes: {
    active_count: number;
    granted_count: number;
    items: DashboardWishItem[];
  };
  todays_doos: {
    pending_count: number;
    completed_count: number;
    items: DashboardDooItem[];
  };
}

export async function fetchDashboardOverview(
  accessToken: string,
  workspaceId?: string
): Promise<DashboardOverviewResponse> {
  const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : "";
  const response = await fetch(`${API_BASE_URL}/dashboard/overview${query}`, {
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
      data.message || "Unable to load dashboard overview.",
      response.status,
      data.error || "dashboard_error"
    );
  }

  return data as DashboardOverviewResponse;
}

export async function confirmDooStatusUpdate(
  accessToken: string,
  dooId: string,
  status: "todo" | "done"
): Promise<{ status: string; doo: { id: string; title: string; status: string } }> {
  const response = await fetch(
    `${API_BASE_URL}/dashboard/doos/${encodeURIComponent(dooId)}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
      body: JSON.stringify({ status }),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Unable to update task status.",
      response.status,
      data.error || "update_error"
    );
  }

  return data;
}

export async function seedSampleWorkspaceData(
  accessToken: string,
  workspaceId?: string
): Promise<DashboardOverviewResponse> {
  const response = await fetch(`${API_BASE_URL}/dashboard/seed-sample`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
    body: JSON.stringify({ workspace_id: workspaceId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Unable to populate sample workspace data.",
      response.status,
      data.error || "seed_error"
    );
  }

  return data as DashboardOverviewResponse;
}
