import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import DoosScreen from "../../app/(app)/doos";
import { ThemeProvider } from "../theme/ThemeProvider";

// Mock router
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock api/doos
jest.mock("../api/doos", () => ({
  fetchDoos: jest.fn().mockResolvedValue({
    workspace: { id: "ws-1", name: "Personal", currency: "USD" },
    summary: {
      total_doos: 2,
      pending_doos: 1,
      today_doos: 1,
      upcoming_doos: 0,
      completed_doos: 1,
    },
    items: [
      {
        id: "doo-1",
        workspace_id: "ws-1",
        title: "Test Doo Task",
        priority: "high",
        status: "todo",
        due_date: "2026-11-20",
        recurrence_rule: "weekly",
        notes: "Detailed task note",
        subtasks: [
          { id: "sub-1", title: "Step 1", is_completed: false, sort_order: 0 },
        ],
        total_subtasks: 1,
        done_subtasks: 0,
        progress_percent: 0,
      },
    ],
  }),
  fetchDooDetail: jest.fn(),
  createDoo: jest.fn(),
  updateDoo: jest.fn(),
  toggleDooStatus: jest.fn(),
  deleteDoo: jest.fn(),
  toggleSubtask: jest.fn(),
}));

// Mock api/wishes
jest.mock("../api/wishes", () => ({
  fetchWishes: jest.fn().mockResolvedValue({
    workspace: { id: "ws-1", name: "Personal", currency: "USD" },
    summary: { total_wishes: 0, active_wishes: 0, granted_wishes: 0, total_estimated_cost: 0 },
    wishes: [],
  }),
}));

describe("DoosScreen (Screen 8)", () => {
  it("renders DOOs screen hero, filter chips, and loaded task", async () => {
    const { getByText, getAllByText } = render(
      <ThemeProvider>
        <DoosScreen />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByText("DOOs & Action Items")).toBeTruthy();
      expect(getByText("Test Doo Task")).toBeTruthy();
      expect(getByText("Step 1")).toBeTruthy();
      expect(getByText("All DOOs")).toBeTruthy();
      expect(getAllByText("Due Today").length).toBeGreaterThan(0);
      expect(getAllByText("Upcoming").length).toBeGreaterThan(0);
    });
  });
});
