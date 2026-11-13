import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { AmbientMeshBackground } from "@/components/ui/AmbientMeshBackground";

export default function NotFoundScreen() {
  const router = useRouter();
  const { tokens } = useAppTheme();

  return (
    <>
      <Head>
        <title>404 — Page Not Found | Wishes &amp; DOOs</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <View style={[styles.container, { backgroundColor: tokens.background }]}>
        <AmbientMeshBackground variant="corner-top-left" />
        <View
          style={[
            styles.card,
            {
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              borderRadius: tokens.radiusCard,
            },
          ]}
        >
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: `${tokens.destructive}18`,
                borderColor: `${tokens.destructive}35`,
              },
            ]}
          >
            <MaterialIcons
              name="error-outline"
              size={36}
              color={tokens.destructive}
              aria-hidden={true}
            />
          </View>

          <Text
            accessibilityRole="header"
            aria-level={1}
            style={[
              styles.code,
              { color: tokens.foreground, fontFamily: tokens.fontMono },
            ]}
          >
            404
          </Text>

          <Text
            accessibilityRole="header"
            aria-level={2}
            style={[styles.title, { color: tokens.foreground }]}
          >
            Page Not Found
          </Text>

          <Text style={[styles.description, { color: tokens.muted }]}>
            The screen or resource you are looking for does not exist or has been moved.
          </Text>

          <View style={styles.actionRow}>
            <Button
              label="Return to Welcome"
              icon="home"
              variant="primary"
              onPress={() => router.replace("/welcome")}
            />
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    padding: 32,
    borderWidth: 1,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 4,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  code: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  actionRow: {
    width: "100%",
    maxWidth: 240,
  },
});
