import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import DashboardScreen, { formatCurrency } from "../../app/(app)/dashboard";
import * as dashboardApi from "@/api/dashboard";
import { useAuthStore } from "@/store/authStore";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
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

const MOCK_OVERVIEW_DATA: dashboardApi.DashboardOverviewResponse = {
  workspace: {
    id: "ws-demo-1",
    name: "Personal Workspace",
    type: "personal",
    currency: "USD",
    role: "owner",
  },
  finance_summary: {
    total_net_balance: 24580.0,
    monthly_income: 6850.0,
    monthly_expense: 2340.0,
    monthly_net_cashflow: 4510.0,
    savings_rate_pct: 65.8,
    period_label: "November 2026",
    accounts: [
      {
        id: "acc-1",
        name: "Primary Checking",
        type: "checking",
        balance: 8430.0,
        icon: "account-balance",
        color: "finance",
      },
      {
        id: "acc-2",
        name: "High-Yield Vault",
        type: "savings",
        balance: 15200.0,
        icon: "savings",
        color: "finance",
      },
      {
        id: "acc-3",
        name: "Everyday Cash",
        type: "cash",
        balance: 950.0,
        icon: "payments",
        color: "finance",
      },
    ],
    recent_transactions: [
      {
        id: "tx-1",
        description: "Monthly Product Design Salary",
        amount: 5850.0,
        type: "income",
        category_name: "Income & Salary",
        category_icon: "account-balance-wallet",
        transaction_date: "2026-11-01",
      },
      {
        id: "tx-2",
        description: "Apartment Rent & Fiber Internet",
        amount: 1450.0,
        type: "expense",
        category_name: "Housing & Bills",
        category_icon: "home",
        transaction_date: "2026-11-01",
      },
    ],
  },
  budget_health: {
    period_month: "2026-11",
    total_budgeted: 3050.0,
    total_spent: 2340.0,
    utilization_pct: 76.7,
    categories: [
      {
        id: "b-1",
        category_id: "cat-1",
        category_name: "Housing & Bills",
        category_icon: "home",
        monthly_limit: 1600.0,
        spent: 1450.0,
        remaining: 150.0,
        utilization_pct: 90.6,
        status: "warning",
      },
      {
        id: "b-2",
        category_id: "cat-2",
        category_name: "Groceries & Dining",
        category_icon: "restaurant",
        monthly_limit: 650.0,
        spent: 420.0,
        remaining: 230.0,
        utilization_pct: 64.6,
        status: "healthy",
      },
    ],
  },
  savings_goals: {
    total_saved: 12760.0,
    total_target: 14800.0,
    items: [
      {
        id: "goal-1",
        name: "Kyoto Autumn Trip",
        current_amount: 2560.0,
        target_amount: 3200.0,
        progress_pct: 80.0,
        target_date: "2027-01-15",
        icon: "flight",
        color: "wish",
      },
      {
        id: "goal-2",
        name: "Studio Display Setup",
        current_amount: 1200.0,
        target_amount: 1600.0,
        progress_pct: 75.0,
        target_date: "2026-12-15",
        icon: "devices",
        color: "finance",
      },
    ],
  },
  top_wishes: {
    active_count: 3,
    granted_count: 0,
    items: [
      {
        id: "wish-1",
        title: "Kyoto Autumn Trip",
        notes: "10-day itinerary",
        estimated_price: 3200.0,
        priority: "high",
        status: "active",
        category_name: "Experiences & Travel",
        category_icon: "explore",
        savings_goal_name: "Kyoto Autumn Trip",
        funded_amount: 2560.0,
        funded_pct: 80.0,
        linked_doos_total: 2,
        linked_doos_completed: 1,
      },
      {
        id: "wish-2",
        title: "Apple Studio Display 5K",
        notes: "27-inch 5K monitor",
        estimated_price: 1599.0,
        priority: "medium",
        status: "active",
        category_name: "Tech & Gear",
        category_icon: "devices",
        savings_goal_name: "Studio Display Setup",
        funded_amount: 1200.0,
        funded_pct: 75.0,
        linked_doos_total: 1,
        linked_doos_completed: 1,
      },
    ],
  },
  todays_doos: {
    pending_count: 2,
    completed_count: 2,
    items: [
      {
        id: "doo-1",
        title: "Book Ryokan in Arashiyama",
        priority: "high",
        status: "todo",
        due_date: "2026-11-01",
        recurrence_rule: "none",
        category_name: "Experiences & Travel",
        category_icon: "explore",
        wish_title: "Kyoto Autumn Trip",
        subtasks_total: 3,
        subtasks_done: 2,
      },
      {
        id: "doo-2",
        title: "Transfer $400 to High-Yield Vault",
        priority: "high",
        status: "todo",
        due_date: "2026-11-01",
        recurrence_rule: "monthly",
        category_name: "Finance & Admin",
        category_icon: "work-outline",
        wish_title: null,
        subtasks_total: 0,
        subtasks_done: 0,
      },
    ],
  },
};

describe("Screen 4: Dashboard / Overview Screen & App Shell", () => {
  beforeEach(() => {
    useAuthStore.getState().setSession({
      access_token: "test-dashboard-jwt",
      refresh_token: "test-dashboard-refresh",
      token_type: "Bearer",
      expires_in: 900,
      user: {
        id: "user-1",
        email: "demo@wishesanddoos.app",
        display_name: "Alex Rivera",
        avatar_url: null,
        theme_style: "classical",
        color_mode: "light",
        is_email_verified: true,
        is_2fa_enabled: false,
      },
      workspaces: [
        {
          id: "ws-demo-1",
          name: "Personal Workspace",
          type: "personal",
          currency: "USD",
          role: "owner",
        },
      ],
    });
    jest.restoreAllMocks();
  });

  it("formats currency values accurately in tabular format", () => {
    expect(formatCurrency(24580, "USD")).toBe("$24,580.00");
    expect(formatCurrency(1599.5, "MXN")).toBe("MX$1,599.50");
  });

  it("renders the 4-Tab App Shell, Header Avatar, and all 6 Dashboard Bento sections", async () => {
    jest
      .spyOn(dashboardApi, "fetchDashboardOverview")
      .mockResolvedValueOnce(MOCK_OVERVIEW_DATA);

    const { getByText, getByLabelText, getAllByText } = render(
      <ThemeProvider initialStyle="classical" initialMode="light">
        <DashboardScreen />
      </ThemeProvider>
    );

    // 4 Navigation Tabs + Hamburger Menu on Mobile
    expect(getByLabelText("Navigate to Dashboard")).toBeTruthy();
    expect(getByLabelText("Navigate to Finances")).toBeTruthy();
    expect(getByLabelText("Navigate to Wishes")).toBeTruthy();
    expect(getByLabelText("Navigate to DOOs")).toBeTruthy();
    expect(getByLabelText("Open navigation menu")).toBeTruthy();

    await waitFor(() => {
      // Total Net Balance & Cashflow
      expect(getByText("$24,580.00")).toBeTruthy();
      expect(getByText("+$6,850.00")).toBeTruthy();
      expect(getByText("-$2,340.00")).toBeTruthy();
      expect(getByText("+$4,510.00")).toBeTruthy();
      expect(getByText("Primary Checking")).toBeTruthy();
      expect(getByText("High-Yield Vault")).toBeTruthy();

      // Savings Goals & Wishes
      expect(getAllByText("Kyoto Autumn Trip").length).toBeGreaterThanOrEqual(2);
      expect(getByText("Apple Studio Display 5K")).toBeTruthy();

      // Budget Health
      expect(getByText("Budget Health")).toBeTruthy();
      expect(getByText("Housing & Bills")).toBeTruthy();

      // Today's DOOs & Recent Activity
      expect(getByText("Book Ryokan in Arashiyama")).toBeTruthy();
      expect(getByText("Monthly Product Design Salary")).toBeTruthy();
    });
  });

  it("requires Explicit Save & Confirm before updating a DOO status on the Dashboard", async () => {
    jest
      .spyOn(dashboardApi, "fetchDashboardOverview")
      .mockResolvedValue(MOCK_OVERVIEW_DATA);

    const confirmSpy = jest
      .spyOn(dashboardApi, "confirmDooStatusUpdate")
      .mockResolvedValueOnce({
        status: "confirmed",
        doo: {
          id: "doo-1",
          title: "Book Ryokan in Arashiyama",
          status: "done",
        },
      });

    const { getByLabelText, getByText, queryByText } = render(
      <ThemeProvider initialStyle="classical" initialMode="light">
        <DashboardScreen />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByText("Book Ryokan in Arashiyama")).toBeTruthy();
    });

    // Tapping the DOO stages it and reveals the Explicit Save & Confirm bar without mutating yet
    fireEvent.press(getByLabelText("Toggle task Book Ryokan in Arashiyama"));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(
      getByText('Mark "Book Ryokan in Arashiyama" as Completed?')
    ).toBeTruthy();

    // Pressing "Save & Confirm Status" triggers the API mutation
    fireEvent.press(getByLabelText("Save & Confirm Status"));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        "test-dashboard-jwt",
        "doo-1",
        "done"
      );
      expect(
        queryByText(
          'Saved: "Book Ryokan in Arashiyama" marked as Completed.'
        )
      ).toBeTruthy();
    });
  });
});
