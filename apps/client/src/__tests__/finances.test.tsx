import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import FinancesScreen from "../../app/(app)/finances";
import * as financesApi from "@/api/finances";
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

const MOCK_FINANCES_DATA: financesApi.FinancesOverviewResponse = {
  workspace: {
    id: "ws-test-1",
    name: "Personal Workspace",
    currency: "USD",
  },
  period_month: "2026-11",
  summary: {
    net_balance: 24580.0,
    monthly_income: 6850.0,
    monthly_expenses: 2340.0,
    net_savings: 4510.0,
    savings_rate: 65.8,
    total_goals_target: 14800.0,
    total_goals_saved: 12760.0,
    accounts_count: 3,
    active_goals_count: 2,
  },
  accounts: [
    {
      id: "acc-1",
      workspace_id: "ws-test-1",
      name: "Primary Checking",
      type: "checking",
      balance: 8430.0,
      icon: "account-balance",
      color: "finance",
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "acc-2",
      workspace_id: "ws-test-1",
      name: "High-Yield Vault",
      type: "savings",
      balance: 15200.0,
      icon: "savings",
      color: "finance",
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "acc-3",
      workspace_id: "ws-test-1",
      name: "Everyday Cash",
      type: "cash",
      balance: 950.0,
      icon: "payments",
      color: "finance",
      created_at: "2026-11-01T00:00:00Z",
    },
  ],
  transactions: [
    {
      id: "tx-1",
      workspace_id: "ws-test-1",
      account_id: "acc-1",
      account_name: "Primary Checking",
      category_id: "cat-1",
      category_name: "Housing & Bills",
      category_icon: "home",
      savings_goal_id: null,
      type: "expense",
      amount: 1450.0,
      description: "Apartment Rent & Utilities",
      transaction_date: "2026-11-01",
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "tx-2",
      workspace_id: "ws-test-1",
      account_id: "acc-1",
      account_name: "Primary Checking",
      category_id: "cat-4",
      category_name: "Income & Salary",
      category_icon: "account-balance-wallet",
      savings_goal_id: null,
      type: "income",
      amount: 5850.0,
      description: "Monthly Product Design Salary",
      transaction_date: "2026-11-01",
      created_at: "2026-11-01T00:00:00Z",
    },
  ],
  budgets: [
    {
      id: "b-1",
      category_id: "cat-1",
      category_name: "Housing & Bills",
      category_icon: "home",
      category_color: "finance",
      monthly_limit: 1600.0,
      spent_amount: 1450.0,
      remaining_amount: 150.0,
      percentage_used: 90.6,
      is_over_budget: false,
      period_month: "2026-11",
    },
    {
      id: "b-2",
      category_id: "cat-2",
      category_name: "Groceries & Dining",
      category_icon: "restaurant",
      category_color: "finance",
      monthly_limit: 650.0,
      spent_amount: 420.0,
      remaining_amount: 230.0,
      percentage_used: 64.6,
      is_over_budget: false,
      period_month: "2026-11",
    },
  ],
  savings_goals: [
    {
      id: "goal-1",
      workspace_id: "ws-test-1",
      account_id: "acc-2",
      account_name: "High-Yield Vault",
      name: "Kyoto Autumn Trip",
      target_amount: 3200.0,
      current_amount: 2560.0,
      progress_percent: 80.0,
      target_date: "2027-01-15",
      icon: "flight",
      color: "wish",
      created_at: "2026-11-01T00:00:00Z",
    },
  ],
  categories: [
    {
      id: "cat-1",
      name: "Housing & Bills",
      icon: "home",
      color: "finance",
      module: "finance",
    },
    {
      id: "cat-2",
      name: "Groceries & Dining",
      icon: "restaurant",
      color: "finance",
      module: "finance",
    },
    {
      id: "cat-4",
      name: "Income & Salary",
      icon: "account-balance-wallet",
      color: "finance",
      module: "finance",
    },
  ],
};

describe("Screen 5: Finances Screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      accessToken: "mock-test-access-token",
      refreshToken: "mock-test-refresh-token",
      user: {
        id: "u-1",
        email: "alex@wishesanddoos.app",
        display_name: "Alex Rivera",
        avatar_url: null,
        theme_style: "classical",
        color_mode: "light",
        is_email_verified: true,
        is_2fa_enabled: false,
      },
      workspaces: [
        {
          id: "ws-test-1",
          name: "Personal Workspace",
          type: "personal",
          currency: "USD",
          role: "owner",
        },
      ],
      currentWorkspace: {
        id: "ws-test-1",
        name: "Personal Workspace",
        type: "personal",
        currency: "USD",
        role: "owner",
      },
      isAuthenticated: true,
    });

    jest
      .spyOn(financesApi, "fetchFinancesOverview")
      .mockResolvedValue(MOCK_FINANCES_DATA);
  });

  it("renders the Net Balance Hero and Cashflow Overview", async () => {
    const { getByText } = render(
      <ThemeProvider>
        <FinancesScreen />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByText("Total Net Balance")).toBeTruthy();
      expect(getByText("$24,580.00")).toBeTruthy();
      expect(getByText("Cashflow (This Month)")).toBeTruthy();
      expect(getByText("+$6,850.00")).toBeTruthy();
      expect(getByText("-$2,340.00")).toBeTruthy();
    });
  });

  it("renders all 4 finance pill-tabs and switches active tab views", async () => {
    const { getByText, getByLabelText } = render(
      <ThemeProvider>
        <FinancesScreen />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByText("Transactions")).toBeTruthy();
      expect(getByText("Budgets")).toBeTruthy();
      expect(getByText("Savings Goals")).toBeTruthy();
      expect(getByText("Accounts")).toBeTruthy();
    });

    // Verify initial Transactions tab shows items
    expect(getByText("Apartment Rent & Utilities")).toBeTruthy();
    expect(getByText("Monthly Product Design Salary")).toBeTruthy();

    // Switch to Budgets tab
    fireEvent.press(getByLabelText("Switch to Budgets tab"));
    await waitFor(() => {
      expect(getByText("Monthly Category Limits")).toBeTruthy();
      expect(getByText("Housing & Bills")).toBeTruthy();
      expect(getByText("90.6%")).toBeTruthy();
    });

    // Switch to Savings Goals tab
    fireEvent.press(getByLabelText("Switch to Savings Goals tab"));
    await waitFor(() => {
      expect(getByText("Active Savings Goals")).toBeTruthy();
      expect(getByText("Kyoto Autumn Trip")).toBeTruthy();
    });

    // Switch to Accounts tab
    fireEvent.press(getByLabelText("Switch to Accounts tab"));
    await waitFor(() => {
      expect(getByText("Connected Wallets & Accounts")).toBeTruthy();
      expect(getByText("Primary Checking")).toBeTruthy();
      expect(getByText("High-Yield Vault")).toBeTruthy();
      expect(getByText("Everyday Cash")).toBeTruthy();
    });
  });

  it("opens the Log Transaction modal when + Log Transaction button is pressed", async () => {
    const { getByText, getAllByText } = render(
      <ThemeProvider>
        <FinancesScreen />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByText("Total Net Balance")).toBeTruthy();
    });

    // Press Log Transaction button in hero
    const logBtn = getByText("+ Log Transaction");
    fireEvent.press(logBtn);

    await waitFor(() => {
      expect(getByText("Log Transaction")).toBeTruthy();
      expect(getByText("Save & Confirm Transaction")).toBeTruthy();
      expect(getByText("AMOUNT (USD)")).toBeTruthy();
    });
  });
});
