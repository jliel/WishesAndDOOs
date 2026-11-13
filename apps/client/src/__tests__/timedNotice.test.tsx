import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { TimedNotice } from "../components/ui/TimedNotice";

describe("TimedNotice Component", () => {
  it("renders the notification message and dismisses on close button press", () => {
    const onDismiss = jest.fn();
    const { getByText, getByLabelText } = render(
      <ThemeProvider>
        <TimedNotice
          message="Transaction confirmed successfully!"
          onDismiss={onDismiss}
          durationMs={5000}
        />
      </ThemeProvider>
    );

    expect(getByText("Transaction confirmed successfully!")).toBeTruthy();

    const closeBtn = getByLabelText("Dismiss notification");
    fireEvent.press(closeBtn);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not render when message is null", () => {
    const onDismiss = jest.fn();
    const { queryByTestId } = render(
      <ThemeProvider>
        <TimedNotice
          message={null}
          onDismiss={onDismiss}
          testID="custom-notice"
        />
      </ThemeProvider>
    );

    expect(queryByTestId("custom-notice")).toBeNull();
  });
});
