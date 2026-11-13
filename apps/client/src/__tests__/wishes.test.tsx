import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import WishesScreen from "../../app/(app)/wishes";
import { ThemeProvider } from "@/theme/ThemeProvider";

// Mock the API calls
jest.mock("@/api/wishes", () => ({
  fetchWishes: jest.fn().mockResolvedValue({
    workspace: {
      id: "ws-1",
      name: "Personal Workspace",
      currency: "USD",
    },
    summary: {
      total_wishes: 2,
      active_wishes: 1,
      granted_wishes: 1,
      total_estimated_value: 3200,
    },
    wishes: [
      {
        id: "w-1",
        workspace_id: "ws-1",
        category_id: null,
        category_name: "Travel",
        category_icon: "flight",
        category_color: "#7C3AED",
        savings_goal_id: "g-1",
        savings_goal: {
          id: "g-1",
          name: "Kyoto Trip",
          target_amount: 3200,
          current_amount: 2090,
          progress_percent: 65.3,
          color: "#10B981",
          icon: "flight",
        },
        title: "Kyoto Autumn Trip",
        notes: "Book ryokan 3 months in advance",
        url: "https://example.com/kyoto",
        image_storage_key: null,
        image_url: null,
        estimated_price: 3200,
        priority: "high",
        status: "active",
        granted_at: null,
        fulfilled_transaction_id: null,
        linked_doos_count: 3,
        linked_doos_done: 2,
        doo_progress_percent: 66.7,
        created_at: "2026-11-01T12:00:00Z",
      },
      {
        id: "w-2",
        workspace_id: "ws-1",
        category_id: null,
        category_name: "Tech",
        category_icon: "devices",
        category_color: "#7C3AED",
        savings_goal_id: null,
        savings_goal: null,
        title: "Studio Display 5K",
        notes: null,
        url: null,
        image_storage_key: null,
        image_url: null,
        estimated_price: 1599,
        priority: "medium",
        status: "granted",
        granted_at: "2026-11-05T12:00:00Z",
        fulfilled_transaction_id: null,
        linked_doos_count: 0,
        linked_doos_done: 0,
        doo_progress_percent: 0,
        created_at: "2026-10-15T12:00:00Z",
      },
    ],
  }),
  createWish: jest.fn().mockImplementation((_token, payload) =>
    Promise.resolve({
      id: "w-new",
      workspace_id: "ws-1",
      category_id: null,
      category_name: null,
      category_icon: "auto-awesome",
      category_color: "#7C3AED",
      savings_goal_id: null,
      savings_goal: null,
      title: payload.title,
      notes: payload.notes || null,
      url: payload.url || null,
      image_storage_key: null,
      image_url: null,
      estimated_price: payload.estimated_price || null,
      priority: payload.priority || "medium",
      status: "active",
      granted_at: null,
      fulfilled_transaction_id: null,
      linked_doos_count: 0,
      linked_doos_done: 0,
      doo_progress_percent: 0,
      created_at: new Date().toISOString(),
    })
  ),
  updateWish: jest.fn().mockResolvedValue({}),
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
        name: "Main Checking",
        type: "checking",
        balance: 5400,
        currency: "USD",
        icon: "account-balance",
        color: "#10B981",
      },
    ],
    savings_goals: [
      {
        id: "g-1",
        name: "Kyoto Trip",
        target_amount: 3200,
        current_amount: 2090,
      },
    ],
    categories: [],
  }),
}));

jest.mock("@/api/doos", () => ({
  fetchDoos: jest.fn().mockResolvedValue({
    doos: [
      {
        id: "doo-1",
        title: "Book flight",
        status: "pending",
        priority: "high",
      },
    ],
  }),
}));

jest.mock("@/api/auth", () => ({
  loginWithEmail: jest.fn().mockResolvedValue({
    access_token: "test-token",
    refresh_token: "test-refresh-token",
    user: { id: "u-1", email: "demo@wishesanddoos.app", display_name: "Alex Rivera" },
    workspaces: [{ id: "ws-1", name: "Personal Workspace", currency: "USD" }],
  }),
  logoutAuthSession: jest.fn().mockResolvedValue({}),
}));

describe("Screen 6: Wishes List Screen", () => {
  it("renders wishes list with hero stats and filter pills", async () => {
    const { getByText, findByText, getAllByText, getByLabelText } = render(
      <ThemeProvider>
        <WishesScreen />
      </ThemeProvider>
    );

    // Verify hero and content load
    expect(await findByText("Wishlist & Aspirations")).toBeTruthy();
    expect(getByText("Kyoto Autumn Trip")).toBeTruthy();
    expect(getByText("Studio Display 5K")).toBeTruthy();
    expect(getByText("All Wishes")).toBeTruthy();
    expect(getByLabelText("Filter: Active")).toBeTruthy();
    expect(getByLabelText("Filter: Granted")).toBeTruthy();
    expect(getAllByText("Granted").length).toBeGreaterThan(0);
  });

  it("opens the quick add wish modal sheet with explicit save and confirm action", async () => {
    const { getByText, findByText, getByPlaceholderText } = render(
      <ThemeProvider>
        <WishesScreen />
      </ThemeProvider>
    );

    expect(await findByText("Wishlist & Aspirations")).toBeTruthy();

    const addBtn = getByText("Add Wish");
    fireEvent.press(addBtn);

    expect(await findByText("New Wish")).toBeTruthy();
    expect(getByPlaceholderText("e.g. Sony WH-1000XM5 Headphones")).toBeTruthy();
    expect(getByText("Save & Confirm")).toBeTruthy();
  });

  it("filters wishes when tapping the status pills", async () => {
    const { findByText, getByText, getByLabelText, queryByText } = render(
      <ThemeProvider>
        <WishesScreen />
      </ThemeProvider>
    );

    expect(await findByText("Kyoto Autumn Trip")).toBeTruthy();

    // Tap Granted filter pill using its accessibilityLabel
    const grantedPill = getByLabelText("Filter: Granted");
    fireEvent.press(grantedPill);

    // Kyoto Autumn Trip is active, so under Granted filter it should not be visible
    await waitFor(() => {
      expect(queryByText("Kyoto Autumn Trip")).toBeNull();
      expect(getByText("Studio Display 5K")).toBeTruthy();
    });
  });
});
