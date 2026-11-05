import React from "react";
import { Stack } from "expo-router";
import { useAppTheme } from "@/theme/ThemeProvider";

export default function AuthenticatedAppLayout() {
  const { tokens } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.background },
        animation: "fade",
      }}
    >
      <Stack.Screen name="dashboard" />
    </Stack>
  );
}
