import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import WishDetailScreen from "../../app/(app)/wishes/[id]";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useAuthStore } from "@/store/authStore";

// Mock router local search params
jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  useLocalSearchParams: () => ({ id: "w-1" }),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

const mockWishDetail = {
  id: "w-1",
  workspace_id: "ws-1",
  category_id: "cat-1",
  category_name: "Travel",
  category_icon: "flight",
  category_color: "#7C3AED",
  savings_goal_id: "g-1",
  savings_goal: {
    id: "g-1",
    name: "Kyoto Trip Reserve",
    target_amount: 3200,
    current_amount: 2400,
    progress_percent: 75,
    color: "#10B981",
    icon: "flight",
  },
  title: "Kyoto Autumn Trip",
  notes: "Book traditional ryokan in Gion",
  url: "https://travel.example.com/kyoto",
  image_storage_key: "wishes/kyoto.webp",
  image_url: "/api/v1/wishes/images/kyoto.webp",
  estimated_price: 3200,
  priority: "high" as const,
  status: "active" as const,
  granted_at: null,
  fulfilled_transaction_id: null,
  linked_doos_count: 2,
  linked_doos_done: 1,
  doo_progress_percent: 50,
  created_at: "2026-11-01T12:00:00Z",
  workspace: {
    id: "ws-1",
    name: "Personal Workspace",
    currency: "USD",
  },
  linked_doos: [
    {
      id: "d-1",
      title: "Renew Passport & Book Flights",
      notes: null,
      priority: "high" as const,
      status: "in_progress" as const,
      due_date: "2026-12-01T00:00:00Z",
      recurrence_rule: null,
      subtasks_count: 2,
      subtasks_completed: 1,
      subtasks: [
        { id: "st-1", title: "Submit expedited renewal form", is_completed: true, sort_order: 1 },
        { id: "st-2", title: "Compare flight options on Google Flights", is_completed: false, sort_order: 2 },
      ],
    },
  ],
  fulfilled_transaction: null,
};

jest.mock("@/api/wishes", () => ({
  fetchWishDetail: jest.fn().mockImplementation(() => Promise.resolve(mockWishDetail)),
  fulfillWish: jest.fn().mockImplementation((_token, _id, payload) =>
    Promise.resolve({
      status: "fulfilled",
      wish: {
        ...mockWishDetail,
        status: "granted",
        granted_at: new Date().toISOString(),
        fulfilled_transaction_id: payload.record_expense ? "tx-123" : null,
        fulfilled_transaction: payload.record_expense
          ? {
              id: "tx-123",
              account_id: payload.account_id || "acc-1",
              account_name: "Primary Checking",
              amount: payload.expense_amount || 3200,
              description: payload.description || "Fulfilled Wish: Kyoto Autumn Trip",
              transaction_date: "2026-11-07",
            }
          : null,
      },
    })
  ),
  updateWish: jest.fn().mockImplementation((_token, _id, payload) =>
    Promise.resolve({
      ...mockWishDetail,
      ...payload,
    })
  ),
  deleteWish: jest.fn().mockResolvedValue({}),
  uploadWishImage: jest.fn().mockResolvedValue({
    status: "uploaded",
    storage_key: "wishes/test.webp",
    filename: "test.webp",
    image_url: "/api/v1/wishes/images/test.webp",
  }),
}));

jest.mock("@/api/finances", () => ({
  fetchFinancesOverview: jest.fn().mockResolvedValue({
    accounts: [
      {
        id: "acc-1",
        workspace_id: "ws-1",
        name: "Primary Checking",
        type: "checking",
        balance: 5400,
        icon: "account-balance",
        color: "#10B981",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    savings_goals: [
      {
        id: "g-1",
        workspace_id: "ws-1",
        account_id: "acc-1",
        account_name: "Primary Checking",
        name: "Kyoto Trip Reserve",
        target_amount: 3200,
        current_amount: 2400,
        progress_percent: 75,
        target_date: null,
        icon: "flight",
        color: "#10B981",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    categories: [
      {
        id: "cat-1",
        workspace_id: "ws-1",
        name: "Travel",
        type: "expense",
        icon: "flight",
        color: "#7C3AED",
        is_system: false,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
  }),
}));

describe("Screen 7: Wish Detail Screen", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: "test-token",
      refreshToken: "test-refresh-token",
      user: {
        id: "u-1",
        email: "demo@wishesanddoos.app",
        display_name: "Alex Rivera",
        avatar_url: null,
        theme_style: "classical",
        color_mode: "light",
        is_email_verified: true,
        is_2fa_enabled: false,
      },
      currentWorkspace: {
        id: "ws-1",
        name: "Personal Workspace",
        type: "personal",
        currency: "USD",
        role: "owner",
      },
    });
  });

  it("renders hero details, target price, linked savings goal, and DOOs checklist", async () => {
    const { getByText, getAllByText } = render(
      <ThemeProvider>
        <WishDetailScreen />
      </ThemeProvider>
    );

    // Wait for wish to load
    await waitFor(() => {
      expect(getByText("Kyoto Autumn Trip")).toBeTruthy();
    });

    // Check Hero Info
    expect(getByText("Back to Wishes")).toBeTruthy();
    expect(getByText(/high priority/i)).toBeTruthy();
    expect(getByText("Travel")).toBeTruthy();
    expect(getAllByText("$3,200.00").length).toBeGreaterThanOrEqual(1);
    expect(getByText("Book traditional ryokan in Gion")).toBeTruthy();

    // Check Linked Savings Goal
    expect(getByText("Kyoto Trip Reserve")).toBeTruthy();
    expect(getByText("75% Saved")).toBeTruthy();

    // Check Linked DOOs Checklist
    expect(getByText("Renew Passport & Book Flights")).toBeTruthy();
    expect(getByText("Submit expedited renewal form")).toBeTruthy();
    expect(getByText("Compare flight options on Google Flights")).toBeTruthy();

    // Check CTA buttons
    expect(getAllByText("Fulfill & Grant Wish").length).toBeGreaterThan(0);
    expect(getByText("Edit")).toBeTruthy();
    expect(getByText("Delete")).toBeTruthy();
  });

  it("opens Confirm & Fulfill Wish modal and fulfills wish atomically", async () => {
    const { getByText, getByLabelText, queryByText } = render(
      <ThemeProvider>
        <WishDetailScreen />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByText("Kyoto Autumn Trip")).toBeTruthy();
    });

    // Click Fulfill CTA
    const fulfillBtn = getByText("Confirm & Fulfill Wish");
    fireEvent.press(fulfillBtn);

    // Verify modal appeared
    expect(getByText("Log as an expense in Finances")).toBeTruthy();
    expect(getByText("Primary Checking")).toBeTruthy();

    // Click Save & Confirm Fulfillment
    const confirmBtn = getByText("Save & Confirm Fulfillment");
    fireEvent.press(confirmBtn);

    // Verify fulfillment feedback notice
    await waitFor(() => {
      expect(getByText(/fulfilled & granted successfully/i)).toBeTruthy();
    });
  });

  it("opens Edit Wish modal and allows editing title", async () => {
    const { getByText, getByLabelText } = render(
      <ThemeProvider>
        <WishDetailScreen />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByText("Kyoto Autumn Trip")).toBeTruthy();
    });

    // Open Edit Modal
    fireEvent.press(getByText("Edit"));

    // Check input is pre-filled
    const titleInput = getByLabelText("Wish Title");
    expect(titleInput.props.value).toBe("Kyoto Autumn Trip");

    // Modify Title
    fireEvent.changeText(titleInput, "Kyoto Autumn Trip (Updated)");

    // Save Changes
    fireEvent.press(getByText("Save Changes"));

    await waitFor(() => {
      expect(getByText(/updated successfully/i)).toBeTruthy();
    });
  });
});
