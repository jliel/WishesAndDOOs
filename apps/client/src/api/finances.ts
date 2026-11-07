import { API_BASE_URL } from "./client";
import { ApiAuthError } from "./auth";

export interface FinanceAccount {
  id: string;
  workspace_id: string;
  name: string;
  type: "checking" | "savings" | "cash" | "credit" | string;
  balance: number;
  icon: string;
  color: string;
  created_at: string | null;
}

export interface FinanceTransaction {
  id: string;
  workspace_id: string;
  account_id: string;
  account_name: string;
  category_id: string | null;
  category_name: string;
  category_icon: string;
  savings_goal_id: string | null;
  type: "income" | "expense" | "transfer";
  amount: number;
  description: string;
  transaction_date: string;
  created_at: string | null;
}

export interface FinanceBudget {
  id: string | null;
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  monthly_limit: number;
  spent_amount: number;
  remaining_amount: number;
  percentage_used: number;
  is_over_budget: boolean;
  period_month: string;
}

export interface FinanceSavingsGoal {
  id: string;
  workspace_id: string;
  account_id: string | null;
  account_name: string | null;
  name: string;
  target_amount: number;
  current_amount: number;
  progress_percent: number;
  target_date: string | null;
  icon: string;
  color: string;
  created_at: string | null;
}

export interface FinanceCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  module: string;
}

export interface FinancesSummary {
  net_balance: number;
  monthly_income: number;
  monthly_expenses: number;
  net_savings: number;
  savings_rate: number;
  total_goals_target: number;
  total_goals_saved: number;
  accounts_count: number;
  active_goals_count: number;
}

export interface FinancesOverviewResponse {
  workspace: {
    id: string;
    name: string;
    currency: string;
  };
  period_month: string;
  summary: FinancesSummary;
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  savings_goals: FinanceSavingsGoal[];
  categories: FinanceCategory[];
}

export interface CreateAccountPayload {
  workspace_id?: string;
  name: string;
  type: "checking" | "savings" | "cash" | "credit";
  balance: number;
  icon?: string;
  color?: string;
}

export interface UpdateAccountPayload {
  name?: string;
  type?: "checking" | "savings" | "cash" | "credit";
  icon?: string;
  color?: string;
}

export interface CreateTransactionPayload {
  workspace_id?: string;
  account_id: string;
  category_id?: string | null;
  savings_goal_id?: string | null;
  type: "income" | "expense" | "transfer";
  amount: number;
  description: string;
  transaction_date?: string;
}

export interface SetBudgetPayload {
  workspace_id?: string;
  category_id: string;
  monthly_limit: number;
  period_month?: string;
}

export interface CreateSavingsGoalPayload {
  workspace_id?: string;
  name: string;
  target_amount: number;
  current_amount?: number;
  target_date?: string | null;
  account_id?: string | null;
  icon?: string;
  color?: string;
}

export interface UpdateSavingsGoalPayload {
  name?: string;
  target_amount?: number;
  target_date?: string | null;
  account_id?: string | null;
  icon?: string;
  color?: string;
}

export interface FundSavingsGoalPayload {
  amount: number;
  account_id: string;
  description?: string;
}

export async function fetchFinancesOverview(
  accessToken: string,
  workspaceId?: string,
  periodMonth?: string
): Promise<FinancesOverviewResponse> {
  const params = new URLSearchParams();
  if (workspaceId) params.append("workspace_id", workspaceId);
  if (periodMonth) params.append("period_month", periodMonth);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const response = await fetch(`${API_BASE_URL}/finances/overview${qs}`, {
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
      data.message || "Unable to load finances overview.",
      response.status,
      data.error || "finances_error"
    );
  }

  return data as FinancesOverviewResponse;
}

export async function createFinanceAccount(
  accessToken: string,
  payload: CreateAccountPayload
): Promise<FinanceAccount> {
  const response = await fetch(`${API_BASE_URL}/finances/accounts`, {
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
      data.message || "Failed to create financial account.",
      response.status,
      data.error || "account_create_error"
    );
  }

  return data.account as FinanceAccount;
}

export async function updateFinanceAccount(
  accessToken: string,
  accountId: string,
  payload: UpdateAccountPayload
): Promise<FinanceAccount> {
  const response = await fetch(
    `${API_BASE_URL}/finances/accounts/${encodeURIComponent(accountId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to update financial account.",
      response.status,
      data.error || "account_update_error"
    );
  }

  return data.account as FinanceAccount;
}

export async function deleteFinanceAccount(
  accessToken: string,
  accountId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/finances/accounts/${encodeURIComponent(accountId)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to delete financial account.",
      response.status,
      data.error || "account_delete_error"
    );
  }
}

export async function createFinanceTransaction(
  accessToken: string,
  payload: CreateTransactionPayload
): Promise<FinanceTransaction> {
  const response = await fetch(`${API_BASE_URL}/finances/transactions`, {
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
      data.message || "Failed to record transaction.",
      response.status,
      data.error || "transaction_create_error"
    );
  }

  return data.transaction as FinanceTransaction;
}

export async function deleteFinanceTransaction(
  accessToken: string,
  transactionId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/finances/transactions/${encodeURIComponent(transactionId)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to delete transaction.",
      response.status,
      data.error || "transaction_delete_error"
    );
  }
}

export async function setFinanceBudget(
  accessToken: string,
  payload: SetBudgetPayload
): Promise<FinanceBudget> {
  const response = await fetch(`${API_BASE_URL}/finances/budgets`, {
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
      data.message || "Failed to save category budget.",
      response.status,
      data.error || "budget_set_error"
    );
  }

  return data.budget as FinanceBudget;
}

export async function createFinanceSavingsGoal(
  accessToken: string,
  payload: CreateSavingsGoalPayload
): Promise<FinanceSavingsGoal> {
  const response = await fetch(`${API_BASE_URL}/finances/savings-goals`, {
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
      data.message || "Failed to create savings goal.",
      response.status,
      data.error || "goal_create_error"
    );
  }

  return data.savings_goal as FinanceSavingsGoal;
}

export async function updateFinanceSavingsGoal(
  accessToken: string,
  goalId: string,
  payload: UpdateSavingsGoalPayload
): Promise<FinanceSavingsGoal> {
  const response = await fetch(
    `${API_BASE_URL}/finances/savings-goals/${encodeURIComponent(goalId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to update savings goal.",
      response.status,
      data.error || "goal_update_error"
    );
  }

  return data.savings_goal as FinanceSavingsGoal;
}

export async function fundFinanceSavingsGoal(
  accessToken: string,
  goalId: string,
  payload: FundSavingsGoalPayload
): Promise<{
  goal: FinanceSavingsGoal;
  account: FinanceAccount;
  transaction: FinanceTransaction;
}> {
  const response = await fetch(
    `${API_BASE_URL}/finances/savings-goals/${encodeURIComponent(goalId)}/fund`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to transfer funds to savings goal.",
      response.status,
      data.error || "fund_goal_error"
    );
  }

  return {
    goal: data.goal as FinanceSavingsGoal,
    account: data.account as FinanceAccount,
    transaction: data.transaction as FinanceTransaction,
  };
}

export async function deleteFinanceSavingsGoal(
  accessToken: string,
  goalId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/finances/savings-goals/${encodeURIComponent(goalId)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiAuthError(
      data.message || "Failed to delete savings goal.",
      response.status,
      data.error || "goal_delete_error"
    );
  }
}
