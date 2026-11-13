import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import DooDetailScreen from "../../app/(app)/doos/[id]";
import { ThemeProvider } from "../theme/ThemeProvider";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "doo-1" }),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock("../api/doos", () => ({
  fetchDooDetail: jest.fn().mockResolvedValue({
    id: "doo-1",
    workspace_id: "ws-1",
    title: "Test Doo Detailed Task",
    priority: "high",
    status: "todo",
    due_date: "2026-11-20",
    recurrence_rule: "weekly",
    notes: "Detailed task note here",
    subtasks: [
      { id: "sub-1", title: "Subtask Step 1", is_completed: false, sort_order: 0 },
      { id: "sub-2", title: "Subtask Step 2", is_completed: true, sort_order: 1 },
    ],
    total_subtasks: 2,
    done_subtasks: 1,
    progress_percent: 50,
    wish: {
      id: "wish-1",
      title: "Parent Wish Target",
      estimated_price: 250,
      status: "active",
    },
  }),
  addSubtask: jest.fn(),
  deleteSubtask: jest.fn(),
  toggleSubtask: jest.fn(),
  toggleDooStatus: jest.fn(),
  updateDoo: jest.fn(),
  deleteDoo: jest.fn(),
}));

jest.mock("../api/wishes", () => ({
  fetchWishes: jest.fn().mockResolvedValue({
    workspace: { id: "ws-1", name: "Personal", currency: "USD" },
    summary: { total_wishes: 1, active_wishes: 1, granted_wishes: 0, total_estimated_cost: 250 },
    wishes: [
      { id: "wish-1", title: "Parent Wish Target", estimated_price: 250, status: "active" },
    ],
  }),
}));

describe("DooDetailScreen (Screen 9)", () => {
  it("renders DOO details, subtasks checklist, and linked parent Wish card", async () => {
    const { getByText } = render(
      <ThemeProvider>
        <DooDetailScreen />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByText("Test Doo Detailed Task")).toBeTruthy();
      expect(getByText("Checklist Sub-tasks")).toBeTruthy();
      expect(getByText("Subtask Step 1")).toBeTruthy();
      expect(getByText("Subtask Step 2")).toBeTruthy();
      expect(getByText("Linked Parent Wish")).toBeTruthy();
      expect(getByText("Parent Wish Target")).toBeTruthy();
    });
  });
});
