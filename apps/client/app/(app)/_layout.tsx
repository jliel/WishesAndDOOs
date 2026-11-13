import React from "react";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { useAppTheme } from "@/theme/ThemeProvider";

export default function AuthenticatedAppLayout() {
  const { tokens } = useAppTheme();

  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.background },
          animation: "fade",
        }}
      >
        <Stack.Screen name="dashboard" />
      </Stack>
    </>
  );
}
