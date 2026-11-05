import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { AmbientMeshBackground } from "@/components/ui/AmbientMeshBackground";
import { AdaptiveShell } from "@/components/layout/AdaptiveShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  confirmDooStatusUpdate,
  DashboardDooItem,
  DashboardOverviewResponse,
  fetchDashboardOverview,
  seedSampleWorkspaceData,
} from "@/api/dashboard";
import { loginWithEmail, logoutAuthSession } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import {
  useInteractiveMotion,
  usePulseScale,
  useStaggerEntrance,
} from "@/lib/motion";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../login";

export function formatCurrency(amount: number, currency = "USD"): string {
  const symbolMap: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    MXN: "MX$",
    CAD: "CA$",
  };
  const prefix = symbolMap[currency] || `${currency} `;
  const absFormatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${prefix}${absFormatted}` : `${prefix}${absFormatted}`;
}

function resolveMaterialIconName(
  iconName?: string | null,
  fallback: React.ComponentProps<typeof MaterialIcons>["name"] = "label-outline"
): React.ComponentProps<typeof MaterialIcons>["name"] {
  const validMap: Record<
    string,
    React.ComponentProps<typeof MaterialIcons>["name"]
  > = {
    home: "home",
    restaurant: "restaurant",
    utensils: "restaurant",
    flight: "flight",
    plane: "flight",
    "account-balance-wallet": "account-balance-wallet",
    wallet: "account-balance-wallet",
    "account-balance": "account-balance",
    savings: "savings",
    payments: "payments",
    explore: "explore",
    compass: "explore",
    devices: "devices",
    laptop: "devices",
    "auto-awesome": "auto-awesome",
    sparkles: "auto-awesome",
    "favorite-border": "favorite-border",
    heart: "favorite-border",
    checklist: "checklist",
    "check-square": "checklist",
    "work-outline": "work-outline",
    briefcase: "work-outline",
    "verified-user": "verified-user",
    "receipt-long": "receipt-long",
    "pie-chart": "pie-chart",
  };
  if (iconName && validMap[iconName]) {
    return validMap[iconName];
  }
  return fallback;
}

interface DooTaskRowProps {
  item: DashboardDooItem;
  isStaged: boolean;
  stagedStatus: "todo" | "done" | null;
  onSelectForConfirm: (item: DashboardDooItem) => void;
}

function DooTaskRow({
  item,
  isStaged,
  stagedStatus,
  onSelectForConfirm,
}: DooTaskRowProps) {
  const { tokens } = useAppTheme();
  const rowMotion = useInteractiveMotion({
    hoverScale: 1.01,
    hoverLift: -1,
    pressScale: 0.985,
  });

  const effectiveDone = isStaged
    ? stagedStatus === "done"
    : item.status === "done";

  const priorityColor =
    item.priority === "high"
      ? tokens.destructive
      : item.priority === "medium"
      ? tokens.doo
      : tokens.mutedForeground;

  return (
    <Animated.View style={rowMotion.animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Toggle task ${item.title}`}
        onPress={() => onSelectForConfirm(item)}
        onHoverIn={rowMotion.onHoverIn}
        onHoverOut={rowMotion.onHoverOut}
        onPressIn={rowMotion.onPressIn}
        onPressOut={rowMotion.onPressOut}
        style={[
          {
            minHeight: 54,
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderRadius: tokens.radiusControl,
            backgroundColor: isStaged
              ? tokens.dooSoft
              : rowMotion.isHovered
              ? tokens.muted
              : tokens.background,
            borderWidth: 1,
            borderColor: isStaged ? tokens.doo : tokens.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          },
          Platform.OS === "web"
            ? ({
                cursor: "pointer",
                transition: "background-color 150ms ease, border-color 150ms ease",
              } as any)
            : null,
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11, flex: 1 }}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              borderWidth: 1.8,
              borderColor: effectiveDone ? tokens.doo : tokens.border,
              backgroundColor: effectiveDone ? tokens.doo : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {effectiveDone ? (
              <MaterialIcons
                name="check"
                size={14}
                color={tokens.primaryForeground}
              />
            ) : null}
          </View>

          <View style={{ flex: 1, gap: 3 }}>
            <Text
              numberOfLines={1}
              style={{
                color: effectiveDone
                  ? tokens.mutedForeground
                  : tokens.foreground,
                fontSize: 13,
                fontWeight: "700",
                textDecorationLine: effectiveDone ? "line-through" : "none",
              }}
            >
              {item.title}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <Text
                style={{
                  color: tokens.mutedForeground,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {item.category_name}
              </Text>
              {item.wish_title ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 999,
                    backgroundColor: tokens.wishSoft,
                  }}
                >
                  <MaterialIcons
                    name="auto-awesome"
                    size={10}
                    color={tokens.wish}
                  />
                  <Text
                    style={{
                      color: tokens.wish,
                      fontSize: 10,
                      fontWeight: "700",
                    }}
                  >
                    {item.wish_title}
                  </Text>
                </View>
              ) : null}
              {item.subtasks_total > 0 ? (
                <Text
                  style={{
                    color: tokens.doo,
                    fontSize: 11,
                    fontWeight: "700",
                    fontFamily: "JetBrains Mono",
                  }}
                >
                  {item.subtasks_done}/{item.subtasks_total} steps
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: tokens.card,
            borderWidth: 1,
            borderColor: tokens.border,
          }}
        >
          <Text
            style={{
              color: priorityColor,
              fontSize: 10,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            {isStaged ? "Pending Confirm" : item.priority}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { tokens } = useAppTheme();
  const { width } = useWindowDimensions();
  const isTwoColumn = width >= 900;

  const {
    user,
    currentWorkspace,
    accessToken,
    refreshToken,
    isAuthenticated,
    setSession,
    clearSession,
  } = useAuthStore();

  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Explicit Save & Confirm state for DOO status updates
  const [stagedDoo, setStagedDoo] = useState<{
    id: string;
    title: string;
    nextStatus: "todo" | "done";
  } | null>(null);
  const [isConfirmingDoo, setIsConfirmingDoo] = useState(false);
  const [confirmToast, setConfirmToast] = useState<string | null>(null);

  // Explicit Save & Confirm state for empty-workspace sample seeding
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [isSeedingSample, setIsSeedingSample] = useState(false);

  const heroEntrance = useStaggerEntrance(0);
  const goalsEntrance = useStaggerEntrance(1);
  const budgetEntrance = useStaggerEntrance(2);
  const wishesEntrance = useStaggerEntrance(3);
  const doosEntrance = useStaggerEntrance(4);
  const txEntrance = useStaggerEntrance(5);
  const { scale: confirmPulse, triggerPulse } = usePulseScale();

  const loadOverview = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchDashboardOverview(
        accessToken,
        currentWorkspace?.id
      );
      setOverview(data);
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Unable to load your workspace dashboard overview."
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, currentWorkspace?.id]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      loadOverview();
    }
  }, [isAuthenticated, accessToken, loadOverview]);

  const handleQuickDemoSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const session = await loginWithEmail({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      setSession(session);
    } catch (err: any) {
      setErrorMessage(err?.message || "Unable to sign in with demo account.");
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutAuthSession(refreshToken);
    } catch {
      // Ignore network errors on sign out
    }
    clearSession();
    setOverview(null);
    router.replace("/login");
  };

  const handleStageDooToggle = (item: DashboardDooItem) => {
    const nextStatus: "todo" | "done" =
      item.status === "done" ? "todo" : "done";
    setStagedDoo({
      id: item.id,
      title: item.title,
      nextStatus,
    });
    setConfirmToast(null);
  };

  const handleConfirmDooStatus = async () => {
    if (!stagedDoo || !accessToken) return;
    setIsConfirmingDoo(true);
    try {
      await confirmDooStatusUpdate(
        accessToken,
        stagedDoo.id,
        stagedDoo.nextStatus
      );
      triggerPulse();
      setConfirmToast(
        `Saved: "${stagedDoo.title}" marked as ${
          stagedDoo.nextStatus === "done" ? "Completed" : "To-Do"
        }.`
      );
      setStagedDoo(null);
      await loadOverview();
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not confirm task status change.");
    } finally {
      setIsConfirmingDoo(false);
    }
  };

  const handleConfirmSeedSample = async () => {
    if (!accessToken) return;
    setIsSeedingSample(true);
    try {
      const populated = await seedSampleWorkspaceData(
        accessToken,
        currentWorkspace?.id
      );
      setOverview(populated);
      setShowSeedConfirm(false);
      triggerPulse();
      setConfirmToast("Sample financial, wish, and task data loaded into workspace.");
    } catch (err: any) {
      setErrorMessage(err?.message || "Unable to seed sample data.");
    } finally {
      setIsSeedingSample(false);
    }
  };

  const currency =
    overview?.workspace.currency || currentWorkspace?.currency || "USD";
  const workspaceName =
    overview?.workspace.name || currentWorkspace?.name || "Personal Workspace";
  const displayName = user?.display_name || "Alex Rivera";

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      {/* Screen 4 Perimeter Radial Gradient Position: "corner-bottom-right" */}
      <AmbientMeshBackground variant="corner-bottom-right" />

      <AdaptiveShell
        activeTab="dashboard"
        userDisplayName={displayName}
        userEmail={user?.email}
        workspaceName={workspaceName}
        workspaceCurrency={currency}
        onSignOut={isAuthenticated ? handleSignOut : undefined}
      >
        {/* Unauthenticated Session Prompt (with 1-Click Demo Sign-In) */}
        {!isAuthenticated ? (
          <Animated.View style={heroEntrance}>
            <Card
              style={{
                padding: 24,
                gap: 16,
                borderColor: tokens.finance,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: tokens.financeSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcons
                    name="verified-user"
                    size={22}
                    color={tokens.finance}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: tokens.foreground,
                      fontSize: 18,
                      fontWeight: "800",
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  >
                    Sign In to View Your Workspace Overview
                  </Text>
                  <Text
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 13,
                    }}
                  >
                    Load Alex Rivera's seeded demo workspace with 1 click or sign in with your own account.
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <Button
                  label="Load Demo Workspace (Alex Rivera)"
                  variant="finance"
                  loading={isLoading}
                  onPress={handleQuickDemoSignIn}
                  rightIcon={
                    <MaterialIcons
                      name="arrow-forward"
                      size={16}
                      color={tokens.primaryForeground}
                    />
                  }
                />
                <Button
                  label="Go to Sign In"
                  variant="secondary"
                  onPress={() => router.push("/login")}
                />
              </View>
            </Card>
          </Animated.View>
        ) : null}

        {/* Error Alert Banner */}
        {errorMessage ? (
          <View
            accessibilityRole="alert"
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: tokens.radiusControl,
              backgroundColor: tokens.muted,
              borderWidth: 1,
              borderColor: tokens.destructive,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <MaterialIcons
                name="error-outline"
                size={18}
                color={tokens.destructive}
              />
              <Text
                style={{
                  color: tokens.destructive,
                  fontSize: 13,
                  fontWeight: "600",
                  flex: 1,
                }}
              >
                {errorMessage}
              </Text>
            </View>
            <Button
              label="Retry"
              size="sm"
              variant="secondary"
              onPress={loadOverview}
            />
          </View>
        ) : null}

        {/* Explicit Save Confirmation Toast */}
        {confirmToast ? (
          <Animated.View
            style={{
              transform: [{ scale: confirmPulse }],
              marginBottom: 16,
              paddingHorizontal: 14,
              paddingVertical: 11,
              borderRadius: tokens.radiusControl,
              backgroundColor: tokens.financeSoft,
              borderWidth: 1,
              borderColor: tokens.finance,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <MaterialIcons
                name="check-circle"
                size={18}
                color={tokens.finance}
              />
              <Text
                style={{
                  color: tokens.foreground,
                  fontSize: 13,
                  fontWeight: "700",
                  flex: 1,
                }}
              >
                {confirmToast}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss confirmation toast"
              onPress={() => setConfirmToast(null)}
            >
              <MaterialIcons
                name="close"
                size={16}
                color={tokens.mutedForeground}
              />
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Loading State */}
        {isAuthenticated && isLoading && !overview ? (
          <Card style={{ padding: 36, alignItems: "center", gap: 12 }}>
            <ActivityIndicator size="large" color={tokens.finance} />
            <Text
              style={{
                color: tokens.mutedForeground,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              Loading workspace financial overview, wishes, and tasks...
            </Text>
          </Card>
        ) : null}

        {/* Populated Dashboard Bento Grid */}
        {overview ? (
          <View style={{ gap: 20 }}>
            {/* Optional Sample Data Seeder for Brand-New Empty Workspaces */}
            {overview.finance_summary.accounts.length === 0 ? (
              <Card
                style={{
                  padding: 20,
                  borderColor: tokens.finance,
                  gap: 12,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <MaterialIcons
                    name="auto-awesome"
                    size={20}
                    color={tokens.finance}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: tokens.foreground,
                        fontSize: 15,
                        fontWeight: "800",
                      }}
                    >
                      Fresh Workspace Ready ({overview.workspace.name})
                    </Text>
                    <Text
                      style={{
                        color: tokens.mutedForeground,
                        fontSize: 12,
                      }}
                    >
                      Your new workspace starts at {formatCurrency(0, currency)}. Want to populate sample accounts, budgets, wishes, and tasks to preview the dashboard?
                    </Text>
                  </View>
                </View>

                {!showSeedConfirm ? (
                  <View style={{ alignSelf: "flex-start" }}>
                    <Button
                      label="Populate Sample Overview Data"
                      size="sm"
                      variant="secondary"
                      onPress={() => setShowSeedConfirm(true)}
                    />
                  </View>
                ) : (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: tokens.financeSoft,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: tokens.foreground,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      Confirm adding sample wallets, goals, wishes, and tasks?
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Button
                        label="Cancel"
                        size="sm"
                        variant="ghost"
                        onPress={() => setShowSeedConfirm(false)}
                      />
                      <Button
                        label="Save & Confirm Sample Data"
                        size="sm"
                        variant="finance"
                        loading={isSeedingSample}
                        onPress={handleConfirmSeedSample}
                      />
                    </View>
                  </View>
                )}
              </Card>
            ) : null}

            {/* ROW 1: Total Net Balance Hero (Left) + Savings Goals Preview (Right) */}
            <View
              style={{
                flexDirection: isTwoColumn ? "row" : "column",
                gap: 20,
              }}
            >
              {/* Total Net Balance & Monthly Cashflow Card */}
              <Animated.View
                style={[
                  { flex: isTwoColumn ? 1.35 : undefined },
                  heroEntrance,
                ]}
              >
                <Card
                  style={{
                    padding: 24,
                    gap: 20,
                    height: "100%",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ gap: 14 }}>
                    {/* Card Top Badge Row */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        <View
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 9,
                            backgroundColor: tokens.financeSoft,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <MaterialIcons
                            name="account-balance-wallet"
                            size={16}
                            color={tokens.finance}
                          />
                        </View>
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 12,
                            fontWeight: "700",
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                          }}
                        >
                          Total Net Balance
                        </Text>
                      </View>

                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: tokens.financeSoft,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <MaterialIcons
                          name="trending-up"
                          size={14}
                          color={tokens.finance}
                        />
                        <Text
                          style={{
                            color: tokens.finance,
                            fontSize: 12,
                            fontWeight: "700",
                            fontFamily: "JetBrains Mono",
                          }}
                        >
                          {overview.finance_summary.savings_rate_pct}% saved ·{" "}
                          {overview.finance_summary.period_label}
                        </Text>
                      </View>
                    </View>

                    {/* Primary Balance Amount in Tabular Monospace */}
                    <Text
                      style={[
                        {
                          color: tokens.foreground,
                          fontSize: isTwoColumn ? 38 : 32,
                          fontWeight: "800",
                          letterSpacing: -1,
                          fontFamily: "JetBrains Mono",
                        },
                        Platform.OS === "web"
                          ? ({ fontVariantNumeric: "tabular-nums" } as any)
                          : null,
                      ]}
                    >
                      {formatCurrency(
                        overview.finance_summary.total_net_balance,
                        currency
                      )}
                    </Text>

                    {/* Monthly Income vs Expense vs Net Cashflow Strip */}
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          minWidth: 130,
                          padding: 12,
                          borderRadius: tokens.radiusControl,
                          backgroundColor: tokens.muted,
                          borderWidth: 1,
                          borderColor: tokens.border,
                          gap: 4,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <MaterialIcons
                            name="south-west"
                            size={14}
                            color={tokens.finance}
                          />
                          <Text
                            style={{
                              color: tokens.mutedForeground,
                              fontSize: 11,
                              fontWeight: "600",
                            }}
                          >
                            Monthly Income
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: tokens.finance,
                            fontSize: 16,
                            fontWeight: "800",
                            fontFamily: "JetBrains Mono",
                          }}
                        >
                          +
                          {formatCurrency(
                            overview.finance_summary.monthly_income,
                            currency
                          )}
                        </Text>
                      </View>

                      <View
                        style={{
                          flex: 1,
                          minWidth: 130,
                          padding: 12,
                          borderRadius: tokens.radiusControl,
                          backgroundColor: tokens.muted,
                          borderWidth: 1,
                          borderColor: tokens.border,
                          gap: 4,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <MaterialIcons
                            name="north-east"
                            size={14}
                            color={tokens.foreground}
                          />
                          <Text
                            style={{
                              color: tokens.mutedForeground,
                              fontSize: 11,
                              fontWeight: "600",
                            }}
                          >
                            Monthly Expense
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 16,
                            fontWeight: "800",
                            fontFamily: "JetBrains Mono",
                          }}
                        >
                          -
                          {formatCurrency(
                            overview.finance_summary.monthly_expense,
                            currency
                          )}
                        </Text>
                      </View>

                      <View
                        style={{
                          flex: 1,
                          minWidth: 130,
                          padding: 12,
                          borderRadius: tokens.radiusControl,
                          backgroundColor: tokens.financeSoft,
                          borderWidth: 1,
                          borderColor: tokens.finance,
                          gap: 4,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <MaterialIcons
                            name="savings"
                            size={14}
                            color={tokens.finance}
                          />
                          <Text
                            style={{
                              color: tokens.finance,
                              fontSize: 11,
                              fontWeight: "700",
                            }}
                          >
                            Net Cashflow
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: tokens.finance,
                            fontSize: 16,
                            fontWeight: "800",
                            fontFamily: "JetBrains Mono",
                          }}
                        >
                          {overview.finance_summary.monthly_net_cashflow >= 0
                            ? "+"
                            : ""}
                          {formatCurrency(
                            overview.finance_summary.monthly_net_cashflow,
                            currency
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Account Wallets Strip */}
                  <View style={{ gap: 8 }}>
                    <Text
                      style={{
                        color: tokens.mutedForeground,
                        fontSize: 11,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Connected Wallets ({overview.finance_summary.accounts.length})
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {overview.finance_summary.accounts.map((acc) => (
                        <View
                          key={acc.id}
                          style={{
                            flex: 1,
                            minWidth: 135,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: tokens.background,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 7,
                              flex: 1,
                            }}
                          >
                            <MaterialIcons
                              name={resolveMaterialIconName(
                                acc.icon,
                                "account-balance-wallet"
                              )}
                              size={16}
                              color={tokens.finance}
                            />
                            <Text
                              numberOfLines={1}
                              style={{
                                color: tokens.foreground,
                                fontSize: 12,
                                fontWeight: "700",
                                flex: 1,
                              }}
                            >
                              {acc.name}
                            </Text>
                          </View>
                          <Text
                            style={{
                              color: tokens.foreground,
                              fontSize: 12,
                              fontWeight: "800",
                              fontFamily: "JetBrains Mono",
                            }}
                          >
                            {formatCurrency(acc.balance, currency)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </Card>
              </Animated.View>

              {/* Savings Goals Preview Card */}
              <Animated.View
                style={[
                  { flex: isTwoColumn ? 1 : undefined },
                  goalsEntrance,
                ]}
              >
                <Card
                  style={{
                    padding: 24,
                    gap: 16,
                    height: "100%",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ gap: 14 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <View
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 9,
                            backgroundColor: tokens.financeSoft,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <MaterialIcons
                            name="flag"
                            size={16}
                            color={tokens.finance}
                          />
                        </View>
                        <View>
                          <Text
                            style={{
                              color: tokens.foreground,
                              fontSize: 15,
                              fontWeight: "800",
                              fontFamily: "Plus Jakarta Sans",
                            }}
                          >
                            Savings Goals
                          </Text>
                          <Text
                            style={{
                              color: tokens.mutedForeground,
                              fontSize: 11,
                            }}
                          >
                            Backing Wishes & Reserves
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={{
                          color: tokens.finance,
                          fontSize: 13,
                          fontWeight: "800",
                          fontFamily: "JetBrains Mono",
                        }}
                      >
                        {formatCurrency(
                          overview.savings_goals.total_saved,
                          currency
                        )}
                      </Text>
                    </View>

                    {/* Goal Progress Items */}
                    <View style={{ gap: 12 }}>
                      {overview.savings_goals.items.map((goal) => {
                        const isWishTone = goal.color === "wish";
                        const barColor = isWishTone
                          ? tokens.wish
                          : tokens.finance;
                        const softBg = isWishTone
                          ? tokens.wishSoft
                          : tokens.financeSoft;

                        return (
                          <View
                            key={goal.id}
                            style={{
                              padding: 12,
                              borderRadius: tokens.radiusControl,
                              backgroundColor: tokens.background,
                              borderWidth: 1,
                              borderColor: tokens.border,
                              gap: 8,
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 7,
                                  flex: 1,
                                }}
                              >
                                <View
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 7,
                                    backgroundColor: softBg,
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <MaterialIcons
                                    name={resolveMaterialIconName(
                                      goal.icon,
                                      "savings"
                                    )}
                                    size={13}
                                    color={barColor}
                                  />
                                </View>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    color: tokens.foreground,
                                    fontSize: 13,
                                    fontWeight: "700",
                                    flex: 1,
                                  }}
                                >
                                  {goal.name}
                                </Text>
                              </View>

                              <Text
                                style={{
                                  color: barColor,
                                  fontSize: 12,
                                  fontWeight: "800",
                                  fontFamily: "JetBrains Mono",
                                }}
                              >
                                {goal.progress_pct}%
                              </Text>
                            </View>

                            <View
                              style={{
                                height: 7,
                                borderRadius: 999,
                                backgroundColor: tokens.muted,
                                overflow: "hidden",
                              }}
                            >
                              <View
                                style={{
                                  width: `${Math.min(100, goal.progress_pct)}%`,
                                  height: "100%",
                                  borderRadius: 999,
                                  backgroundColor: barColor,
                                }}
                              />
                            </View>

                            <View
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                              }}
                            >
                              <Text
                                style={{
                                  color: tokens.mutedForeground,
                                  fontSize: 11,
                                  fontFamily: "JetBrains Mono",
                                }}
                              >
                                {formatCurrency(goal.current_amount, currency)}{" "}
                                saved
                              </Text>
                              <Text
                                style={{
                                  color: tokens.mutedForeground,
                                  fontSize: 11,
                                  fontFamily: "JetBrains Mono",
                                }}
                              >
                                Target{" "}
                                {formatCurrency(goal.target_amount, currency)}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </Card>
              </Animated.View>
            </View>

            {/* ROW 2: Budget Health Bars (Left) + Top Wishes Peek (Right) */}
            <View
              style={{
                flexDirection: isTwoColumn ? "row" : "column",
                gap: 20,
              }}
            >
              {/* Monthly Budget Health Card */}
              <Animated.View
                style={[{ flex: isTwoColumn ? 1 : undefined }, budgetEntrance]}
              >
                <Card style={{ padding: 24, gap: 16, height: "100%" }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          backgroundColor: tokens.financeSoft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialIcons
                          name="pie-chart"
                          size={16}
                          color={tokens.finance}
                        />
                      </View>
                      <View>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 15,
                            fontWeight: "800",
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          Budget Health
                        </Text>
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 11,
                          }}
                        >
                          Monthly Category Limits ({overview.budget_health.period_month})
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: tokens.muted,
                      }}
                    >
                      <Text
                        style={{
                          color: tokens.foreground,
                          fontSize: 11,
                          fontWeight: "700",
                          fontFamily: "JetBrains Mono",
                        }}
                      >
                        {overview.budget_health.utilization_pct}% used
                      </Text>
                    </View>
                  </View>

                  {/* Category Budget Bars */}
                  <View style={{ gap: 12 }}>
                    {overview.budget_health.categories.map((cat) => {
                      const isWarning =
                        cat.status === "warning" || cat.status === "over";
                      const barColor =
                        cat.status === "over"
                          ? tokens.destructive
                          : isWarning
                          ? tokens.wish
                          : tokens.finance;

                      return (
                        <View
                          key={cat.id}
                          style={{
                            padding: 12,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: tokens.background,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            gap: 8,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 7,
                              }}
                            >
                              <MaterialIcons
                                name={resolveMaterialIconName(
                                  cat.category_icon,
                                  "pie-chart"
                                )}
                                size={15}
                                color={barColor}
                              />
                              <Text
                                style={{
                                  color: tokens.foreground,
                                  fontSize: 13,
                                  fontWeight: "700",
                                }}
                              >
                                {cat.category_name}
                              </Text>
                            </View>

                            <Text
                              style={{
                                color: barColor,
                                fontSize: 12,
                                fontWeight: "800",
                                fontFamily: "JetBrains Mono",
                              }}
                            >
                              {formatCurrency(cat.spent, currency)} /{" "}
                              {formatCurrency(cat.monthly_limit, currency)}
                            </Text>
                          </View>

                          <View
                            style={{
                              height: 7,
                              borderRadius: 999,
                              backgroundColor: tokens.muted,
                              overflow: "hidden",
                            }}
                          >
                            <View
                              style={{
                                width: `${Math.min(100, cat.utilization_pct)}%`,
                                height: "100%",
                                borderRadius: 999,
                                backgroundColor: barColor,
                              }}
                            />
                          </View>

                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                            }}
                          >
                            <Text
                              style={{
                                color: tokens.mutedForeground,
                                fontSize: 11,
                              }}
                            >
                              {formatCurrency(cat.remaining, currency)} remaining
                            </Text>
                            <Text
                              style={{
                                color: barColor,
                                fontSize: 11,
                                fontWeight: "700",
                                fontFamily: "JetBrains Mono",
                              }}
                            >
                              {cat.utilization_pct}%
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              </Animated.View>

              {/* Top Wishes Peek Card */}
              <Animated.View
                style={[{ flex: isTwoColumn ? 1.15 : undefined }, wishesEntrance]}
              >
                <Card style={{ padding: 24, gap: 16, height: "100%" }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          backgroundColor: tokens.wishSoft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialIcons
                          name="auto-awesome"
                          size={16}
                          color={tokens.wish}
                        />
                      </View>
                      <View>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 15,
                            fontWeight: "800",
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          Top Wishes
                        </Text>
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 11,
                          }}
                        >
                          Goal Funding & Linked DOO Progress
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: tokens.wishSoft,
                      }}
                    >
                      <Text
                        style={{
                          color: tokens.wish,
                          fontSize: 11,
                          fontWeight: "700",
                          fontFamily: "JetBrains Mono",
                        }}
                      >
                        {overview.top_wishes.active_count} Active
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 12 }}>
                    {overview.top_wishes.items.map((wish) => (
                      <View
                        key={wish.id}
                        style={{
                          padding: 13,
                          borderRadius: tokens.radiusControl,
                          backgroundColor: tokens.background,
                          borderWidth: 1,
                          borderColor: tokens.border,
                          gap: 9,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              flex: 1,
                            }}
                          >
                            <MaterialIcons
                              name={resolveMaterialIconName(
                                wish.category_icon,
                                "auto-awesome"
                              )}
                              size={16}
                              color={tokens.wish}
                            />
                            <Text
                              numberOfLines={1}
                              style={{
                                color: tokens.foreground,
                                fontSize: 14,
                                fontWeight: "700",
                                flex: 1,
                              }}
                            >
                              {wish.title}
                            </Text>
                          </View>

                          <Text
                            style={{
                              color: tokens.foreground,
                              fontSize: 13,
                              fontWeight: "800",
                              fontFamily: "JetBrains Mono",
                            }}
                          >
                            {formatCurrency(wish.estimated_price, currency)}
                          </Text>
                        </View>

                        {/* Funding Progress Bar */}
                        {wish.savings_goal_name ? (
                          <View style={{ gap: 5 }}>
                            <View
                              style={{
                                height: 6,
                                borderRadius: 999,
                                backgroundColor: tokens.muted,
                                overflow: "hidden",
                              }}
                            >
                              <View
                                style={{
                                  width: `${Math.min(100, wish.funded_pct)}%`,
                                  height: "100%",
                                  borderRadius: 999,
                                  backgroundColor: tokens.wish,
                                }}
                              />
                            </View>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <Text
                                style={{
                                  color: tokens.wish,
                                  fontSize: 11,
                                  fontWeight: "700",
                                  fontFamily: "JetBrains Mono",
                                }}
                              >
                                {wish.funded_pct}% funded via{" "}
                                {wish.savings_goal_name}
                              </Text>
                              {wish.linked_doos_total > 0 ? (
                                <Text
                                  style={{
                                    color: tokens.doo,
                                    fontSize: 11,
                                    fontWeight: "700",
                                    fontFamily: "JetBrains Mono",
                                  }}
                                >
                                  {wish.linked_doos_completed}/
                                  {wish.linked_doos_total} DOOs done
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        ) : (
                          <Text
                            style={{
                              color: tokens.mutedForeground,
                              fontSize: 11,
                            }}
                          >
                            {wish.category_name} · Priority:{" "}
                            {wish.priority.toUpperCase()}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </Card>
              </Animated.View>
            </View>

            {/* ROW 3: Today's DOOs (with Explicit Confirm) + Recent Transactions */}
            <View
              style={{
                flexDirection: isTwoColumn ? "row" : "column",
                gap: 20,
              }}
            >
              {/* Today's DOOs Card */}
              <Animated.View
                style={[{ flex: isTwoColumn ? 1.15 : undefined }, doosEntrance]}
              >
                <Card style={{ padding: 24, gap: 16, height: "100%" }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          backgroundColor: tokens.dooSoft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialIcons
                          name="checklist"
                          size={16}
                          color={tokens.doo}
                        />
                      </View>
                      <View>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 15,
                            fontWeight: "800",
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          Today's DOOs
                        </Text>
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 11,
                          }}
                        >
                          Tap a task to stage · Explicit Save & Confirm
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: tokens.dooSoft,
                      }}
                    >
                      <Text
                        style={{
                          color: tokens.doo,
                          fontSize: 11,
                          fontWeight: "700",
                          fontFamily: "JetBrains Mono",
                        }}
                      >
                        {overview.todays_doos.pending_count} Pending ·{" "}
                        {overview.todays_doos.completed_count} Done
                      </Text>
                    </View>
                  </View>

                  {/* Explicit Save & Confirm Action Bar when a DOO status change is staged */}
                  {stagedDoo ? (
                    <View
                      style={{
                        padding: 12,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: tokens.dooSoft,
                        borderWidth: 1,
                        borderColor: tokens.doo,
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <MaterialIcons
                          name="task-alt"
                          size={18}
                          color={tokens.doo}
                        />
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 12,
                            fontWeight: "700",
                            flex: 1,
                          }}
                        >
                          Mark "{stagedDoo.title}" as{" "}
                          {stagedDoo.nextStatus === "done"
                            ? "Completed"
                            : "To-Do"}
                          ?
                        </Text>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "flex-end",
                          gap: 8,
                        }}
                      >
                        <Button
                          label="Cancel"
                          size="sm"
                          variant="secondary"
                          onPress={() => setStagedDoo(null)}
                        />
                        <Button
                          label="Save & Confirm Status"
                          size="sm"
                          variant="primary"
                          loading={isConfirmingDoo}
                          onPress={handleConfirmDooStatus}
                        />
                      </View>
                    </View>
                  ) : null}

                  <View style={{ gap: 10 }}>
                    {overview.todays_doos.items.map((item) => (
                      <DooTaskRow
                        key={item.id}
                        item={item}
                        isStaged={stagedDoo?.id === item.id}
                        stagedStatus={
                          stagedDoo?.id === item.id
                            ? stagedDoo.nextStatus
                            : null
                        }
                        onSelectForConfirm={handleStageDooToggle}
                      />
                    ))}
                  </View>
                </Card>
              </Animated.View>

              {/* Recent Transactions Feed Card */}
              <Animated.View
                style={[{ flex: isTwoColumn ? 1 : undefined }, txEntrance]}
              >
                <Card style={{ padding: 24, gap: 16, height: "100%" }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          backgroundColor: tokens.muted,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialIcons
                          name="receipt-long"
                          size={16}
                          color={tokens.foreground}
                        />
                      </View>
                      <View>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 15,
                            fontWeight: "800",
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          Recent Activity
                        </Text>
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 11,
                          }}
                        >
                          Latest Workspace Transactions
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ gap: 10 }}>
                    {overview.finance_summary.recent_transactions.map((tx) => {
                      const isIncome = tx.type === "income";
                      return (
                        <View
                          key={tx.id}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: tokens.background,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                              flex: 1,
                            }}
                          >
                            <View
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 9,
                                backgroundColor: isIncome
                                  ? tokens.financeSoft
                                  : tokens.muted,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <MaterialIcons
                                name={resolveMaterialIconName(
                                  tx.category_icon,
                                  "receipt-long"
                                )}
                                size={15}
                                color={
                                  isIncome ? tokens.finance : tokens.foreground
                                }
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                numberOfLines={1}
                                style={{
                                  color: tokens.foreground,
                                  fontSize: 13,
                                  fontWeight: "700",
                                }}
                              >
                                {tx.description}
                              </Text>
                              <Text
                                style={{
                                  color: tokens.mutedForeground,
                                  fontSize: 11,
                                }}
                              >
                                {tx.category_name} · {tx.transaction_date}
                              </Text>
                            </View>
                          </View>

                          <Text
                            style={{
                              color: isIncome
                                ? tokens.finance
                                : tokens.foreground,
                              fontSize: 13,
                              fontWeight: "800",
                              fontFamily: "JetBrains Mono",
                            }}
                          >
                            {isIncome ? "+" : "-"}
                            {formatCurrency(tx.amount, currency)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              </Animated.View>
            </View>
          </View>
        ) : null}
      </AdaptiveShell>
    </View>
  );
}
