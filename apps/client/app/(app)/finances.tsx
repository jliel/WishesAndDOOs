import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { AmbientMeshBackground } from "@/components/ui/AmbientMeshBackground";
import { AdaptiveShell } from "@/components/layout/AdaptiveShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuthStore } from "@/store/authStore";
import {
  createFinanceAccount,
  createFinanceSavingsGoal,
  createFinanceTransaction,
  deleteFinanceAccount,
  deleteFinanceSavingsGoal,
  deleteFinanceTransaction,
  fetchFinancesOverview,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceSavingsGoal,
  FinancesOverviewResponse,
  FinanceTransaction,
  fundFinanceSavingsGoal,
  setFinanceBudget,
} from "@/api/finances";
import {
  useErrorShake,
  usePulseScale,
  useStaggerEntrance,
} from "@/lib/motion";
import { loginWithEmail } from "@/api/auth";

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

const DEMO_EMAIL = "demo@wishesanddoos.app";
const DEMO_PASSWORD = "DemoPassword123!";

export type FinanceTabKey = "transactions" | "budgets" | "savings" | "accounts";

interface TabItemConfig {
  key: FinanceTabKey;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
}

const FINANCE_TABS: TabItemConfig[] = [
  { key: "transactions", label: "Transactions", icon: "receipt-long" },
  { key: "budgets", label: "Budgets", icon: "pie-chart-outline" },
  { key: "savings", label: "Savings Goals", icon: "savings" },
  { key: "accounts", label: "Accounts", icon: "account-balance-wallet" },
];

export default function FinancesScreen() {
  const { tokens, colorMode } = useAppTheme();
  const isDark = colorMode === "dark";
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const setSession = useAuthStore((s) => s.setSession);

  const [activeTab, setActiveTab] = useState<FinanceTabKey>("transactions");
  const [data, setData] = useState<FinancesOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Filter state for transactions tab
  const [txTypeFilter, setTxTypeFilter] = useState<"all" | "expense" | "income" | "transfer">("all");

  // Modal / Bottom Sheet visibility
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedGoalForFunding, setSelectedGoalForFunding] = useState<FinanceSavingsGoal | null>(null);

  // Form states
  const [txType, setTxType] = useState<"expense" | "income" | "transfer">("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txAccountId, setTxAccountId] = useState("");
  const [txCategoryId, setTxCategoryId] = useState("");
  const [txGoalId, setTxGoalId] = useState("");

  const [budgetCatId, setBudgetCatId] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("");

  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("0");
  const [goalAccountId, setGoalAccountId] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");

  const [fundAmount, setFundAmount] = useState("");
  const [fundAccountId, setFundAccountId] = useState("");

  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState<"checking" | "savings" | "cash" | "credit">("checking");
  const [accBalance, setAccBalance] = useState("0");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const errorShake = useErrorShake();
  const fundPulse = usePulseScale();

  const loadFinances = useCallback(
    async (token: string, wsId?: string) => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const res = await fetchFinancesOverview(token, wsId);
        setData(res);
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to load financial records.");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    async function initScreen() {
      if (!accessToken) {
        try {
          const auth = await loginWithEmail({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
          setSession(auth);
          await loadFinances(auth.access_token, auth.workspaces[0]?.id);
        } catch (err: any) {
          setErrorMessage("Failed to authenticate session.");
          setIsLoading(false);
        }
      } else {
        await loadFinances(accessToken, currentWorkspace?.id);
      }
    }
    initScreen();
  }, [accessToken, currentWorkspace?.id, loadFinances, setSession]);

  // Set default account / category when modal opens
  useEffect(() => {
    if (data?.accounts?.length && !txAccountId) {
      setTxAccountId(data.accounts[0].id);
    }
    if (data?.categories?.length && !txCategoryId) {
      setTxCategoryId(data.categories[0].id);
    }
    if (data?.accounts?.length && !fundAccountId) {
      setFundAccountId(data.accounts[0].id);
    }
    if (data?.categories?.length && !budgetCatId) {
      setBudgetCatId(data.categories[0].id);
    }
  }, [data, txAccountId, txCategoryId, fundAccountId, budgetCatId]);

  // Handle Log Transaction Mutation
  const handleConfirmTransaction = async () => {
    if (!accessToken) return;
    const parsedAmount = parseFloat(txAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setModalError("Please enter a valid positive amount.");
      errorShake.triggerShake();
      return;
    }
    if (!txDescription.trim()) {
      setModalError("Please enter a description for this transaction.");
      errorShake.triggerShake();
      return;
    }
    if (!txAccountId) {
      setModalError("Please choose an account.");
      errorShake.triggerShake();
      return;
    }

    try {
      setIsSubmitting(true);
      setModalError(null);
      await createFinanceTransaction(accessToken, {
        workspace_id: currentWorkspace?.id,
        account_id: txAccountId,
        category_id: txCategoryId || null,
        savings_goal_id: txGoalId || null,
        type: txType,
        amount: parsedAmount,
        description: txDescription.trim(),
      });
      setShowTransactionModal(false);
      setTxAmount("");
      setTxDescription("");
      setTxGoalId("");
      setFeedbackNotice(`Transaction confirmed: ${formatCurrency(parsedAmount, currentWorkspace?.currency || "USD")}`);
      await loadFinances(accessToken, currentWorkspace?.id);
    } catch (err: any) {
      setModalError(err.message || "Failed to confirm transaction.");
      errorShake.triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Transaction
  const handleDeleteTransaction = async (id: string, desc: string) => {
    if (!accessToken) return;
    try {
      await deleteFinanceTransaction(accessToken, id);
      setFeedbackNotice(`Deleted transaction: ${desc}`);
      await loadFinances(accessToken, currentWorkspace?.id);
    } catch (err: any) {
      setFeedbackNotice(err.message || "Failed to delete transaction.");
    }
  };

  // Handle Set Budget Mutation
  const handleConfirmBudget = async () => {
    if (!accessToken) return;
    const parsedLimit = parseFloat(budgetLimit);
    if (isNaN(parsedLimit) || parsedLimit < 0) {
      setModalError("Please enter a valid monthly limit.");
      errorShake.triggerShake();
      return;
    }
    if (!budgetCatId) {
      setModalError("Please select a category.");
      errorShake.triggerShake();
      return;
    }

    try {
      setIsSubmitting(true);
      setModalError(null);
      await setFinanceBudget(accessToken, {
        workspace_id: currentWorkspace?.id,
        category_id: budgetCatId,
        monthly_limit: parsedLimit,
      });
      setShowBudgetModal(false);
      setBudgetLimit("");
      setFeedbackNotice("Monthly budget updated.");
      await loadFinances(accessToken, currentWorkspace?.id);
    } catch (err: any) {
      setModalError(err.message || "Failed to set budget.");
      errorShake.triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Create Savings Goal Mutation
  const handleConfirmGoal = async () => {
    if (!accessToken) return;
    const parsedTarget = parseFloat(goalTarget);
    const parsedCurrent = parseFloat(goalCurrent || "0");
    if (!goalName.trim()) {
      setModalError("Please enter a name for the savings goal.");
      errorShake.triggerShake();
      return;
    }
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      setModalError("Please enter a valid target amount.");
      errorShake.triggerShake();
      return;
    }

    try {
      setIsSubmitting(true);
      setModalError(null);
      await createFinanceSavingsGoal(accessToken, {
        workspace_id: currentWorkspace?.id,
        name: goalName.trim(),
        target_amount: parsedTarget,
        current_amount: isNaN(parsedCurrent) ? 0 : parsedCurrent,
        target_date: goalTargetDate.trim() || null,
        account_id: goalAccountId || null,
      });
      setShowGoalModal(false);
      setGoalName("");
      setGoalTarget("");
      setGoalCurrent("0");
      setGoalTargetDate("");
      setFeedbackNotice(`Savings goal "${goalName.trim()}" created.`);
      await loadFinances(accessToken, currentWorkspace?.id);
    } catch (err: any) {
      setModalError(err.message || "Failed to create savings goal.");
      errorShake.triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Fund Goal Mutation
  const handleConfirmFund = async () => {
    if (!accessToken || !selectedGoalForFunding) return;
    const parsedAmount = parseFloat(fundAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setModalError("Please enter a valid amount to fund.");
      errorShake.triggerShake();
      return;
    }
    if (!fundAccountId) {
      setModalError("Please select the funding source account.");
      errorShake.triggerShake();
      return;
    }

    try {
      setIsSubmitting(true);
      setModalError(null);
      await fundFinanceSavingsGoal(accessToken, selectedGoalForFunding.id, {
        amount: parsedAmount,
        account_id: fundAccountId,
      });
      fundPulse.triggerPulse();
      setShowFundModal(false);
      setFundAmount("");
      setFeedbackNotice(`Successfully allocated ${formatCurrency(parsedAmount, currentWorkspace?.currency || "USD")} to "${selectedGoalForFunding.name}".`);
      await loadFinances(accessToken, currentWorkspace?.id);
    } catch (err: any) {
      setModalError(err.message || "Failed to transfer funds.");
      errorShake.triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Goal
  const handleDeleteGoal = async (id: string, name: string) => {
    if (!accessToken) return;
    try {
      await deleteFinanceSavingsGoal(accessToken, id);
      setFeedbackNotice(`Removed savings goal "${name}".`);
      await loadFinances(accessToken, currentWorkspace?.id);
    } catch (err: any) {
      setFeedbackNotice(err.message || "Failed to delete savings goal.");
    }
  };

  // Handle Add Account Mutation
  const handleConfirmAccount = async () => {
    if (!accessToken) return;
    const parsedBalance = parseFloat(accBalance || "0");
    if (!accName.trim()) {
      setModalError("Please enter an account name.");
      errorShake.triggerShake();
      return;
    }

    try {
      setIsSubmitting(true);
      setModalError(null);
      await createFinanceAccount(accessToken, {
        workspace_id: currentWorkspace?.id,
        name: accName.trim(),
        type: accType,
        balance: isNaN(parsedBalance) ? 0 : parsedBalance,
      });
      setShowAccountModal(false);
      setAccName("");
      setAccBalance("0");
      setFeedbackNotice(`Account "${accName.trim()}" added.`);
      await loadFinances(accessToken, currentWorkspace?.id);
    } catch (err: any) {
      setModalError(err.message || "Failed to create account.");
      errorShake.triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Account
  const handleDeleteAccount = async (id: string, name: string) => {
    if (!accessToken) return;
    try {
      await deleteFinanceAccount(accessToken, id);
      setFeedbackNotice(`Deleted account "${name}".`);
      await loadFinances(accessToken, currentWorkspace?.id);
    } catch (err: any) {
      setFeedbackNotice(err.message || "Failed to delete account.");
    }
  };

  const currency = data?.workspace.currency || currentWorkspace?.currency || "USD";
  const summary = data?.summary;

  // Filter transactions
  const filteredTransactions = (data?.transactions || []).filter((tx) => {
    if (txTypeFilter === "all") return true;
    return tx.type === txTypeFilter;
  });

  // Stagger entrances for main layout components
  const heroEntrance = useStaggerEntrance(0);
  const tabsEntrance = useStaggerEntrance(1);
  const contentEntrance = useStaggerEntrance(2);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      <AmbientMeshBackground variant="top-to-bottom" />

      <AdaptiveShell
        activeTab="finances"
        userDisplayName={authUser?.display_name || "Alex Rivera"}
        userEmail={authUser?.email}
        workspaceName={data?.workspace.name || currentWorkspace?.name || "Personal Workspace"}
        workspaceCurrency={currency}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 32 : isTablet ? 24 : 16,
            paddingTop: isDesktop ? 24 : 18,
            paddingBottom: isDesktop ? 48 : 88,
            gap: 20,
            maxWidth: 1240,
            width: "100%",
            alignSelf: "center",
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Feedback notice toast */}
          {feedbackNotice ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: tokens.radiusControl,
                backgroundColor: tokens.financeSoft,
                borderWidth: 1,
                borderColor: tokens.finance,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <MaterialIcons name="check-circle" size={18} color={tokens.finance} />
                <Text
                  style={{
                    color: tokens.foreground,
                    fontSize: 13,
                    fontWeight: "700",
                    flex: 1,
                  }}
                >
                  {feedbackNotice}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss notice"
                onPress={() => setFeedbackNotice(null)}
              >
                <MaterialIcons name="close" size={16} color={tokens.mutedForeground} />
              </Pressable>
            </View>
          ) : null}

          {/* Hero Net Worth & Monthly Cashflow Strip */}
          <Animated.View style={heroEntrance}>
            <View
              style={{
                flexDirection: isDesktop ? "row" : "column",
                gap: 16,
                alignItems: "stretch",
              }}
            >
              {/* Net Balance Card */}
              <Card
                variant="default"
                style={{
                  flex: isDesktop ? 1.4 : undefined,
                  padding: isDesktop ? 24 : 18,
                  gap: 14,
                  backgroundColor: tokens.card,
                  borderColor: tokens.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: tokens.financeSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons name="account-balance-wallet" size={18} color={tokens.finance} />
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
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: tokens.muted,
                    }}
                  >
                    <Text
                      style={{
                        color: tokens.mutedForeground,
                        fontSize: 11,
                        fontWeight: "700",
                        fontFamily: "JetBrains Mono",
                      }}
                    >
                      {summary?.accounts_count || 0} Accounts
                    </Text>
                  </View>
                </View>

                <View>
                  <Text
                    style={{
                      color: tokens.foreground,
                      fontSize: isDesktop ? 36 : 30,
                      fontWeight: "800",
                      letterSpacing: -1,
                      fontFamily: "JetBrains Mono",
                    }}
                  >
                    {formatCurrency(summary?.net_balance || 0, currency)}
                  </Text>
                  <Text
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    Available liquid assets and reserves across all wallets
                  </Text>
                </View>

                {/* Primary Action Button Bar */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: tokens.border,
                  }}
                >
                  <Button
                    variant="primary"
                    size="sm"
                    label="+ Log Transaction"
                    onPress={() => {
                      setModalError(null);
                      setShowTransactionModal(true);
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    label="+ Add Wallet"
                    onPress={() => {
                      setModalError(null);
                      setShowAccountModal(true);
                    }}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>

              {/* Monthly Cashflow Overview */}
              <Card
                variant="default"
                style={{
                  flex: isDesktop ? 1 : undefined,
                  padding: isDesktop ? 22 : 18,
                  gap: 12,
                  justifyContent: "space-between",
                  backgroundColor: tokens.card,
                  borderColor: tokens.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 12,
                      fontWeight: "700",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                    }}
                  >
                    Cashflow (This Month)
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 999,
                      backgroundColor: (summary?.net_savings || 0) >= 0 ? tokens.financeSoft : `${tokens.destructive}22`,
                    }}
                  >
                    <Text
                      style={{
                        color: (summary?.net_savings || 0) >= 0 ? tokens.finance : tokens.destructive,
                        fontSize: 11,
                        fontWeight: "700",
                        fontFamily: "JetBrains Mono",
                      }}
                    >
                      {(summary?.net_savings || 0) >= 0 ? "+" : ""}
                      {formatCurrency(summary?.net_savings || 0, currency)}
                    </Text>
                  </View>
                </View>

                {/* Income / Expense comparison row */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "600" }}>
                      Income
                    </Text>
                    <Text
                      style={{
                        color: tokens.finance,
                        fontSize: 17,
                        fontWeight: "700",
                        fontFamily: "JetBrains Mono",
                      }}
                    >
                      +{formatCurrency(summary?.monthly_income || 0, currency)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "600" }}>
                      Expenses
                    </Text>
                    <Text
                      style={{
                        color: tokens.foreground,
                        fontSize: 17,
                        fontWeight: "700",
                        fontFamily: "JetBrains Mono",
                      }}
                    >
                      -{formatCurrency(summary?.monthly_expenses || 0, currency)}
                    </Text>
                  </View>
                </View>

                {/* Savings Rate Bar */}
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: tokens.mutedForeground, fontSize: 11 }}>Savings Rate</Text>
                    <Text
                      style={{
                        color: tokens.finance,
                        fontSize: 11,
                        fontWeight: "700",
                        fontFamily: "JetBrains Mono",
                      }}
                    >
                      {summary?.savings_rate || 0}%
                    </Text>
                  </View>
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
                        height: "100%",
                        width: `${Math.min(100, Math.max(0, summary?.savings_rate || 0))}%`,
                        backgroundColor: tokens.finance,
                        borderRadius: 999,
                      }}
                    />
                  </View>
                </View>
              </Card>
            </View>
          </Animated.View>

          {/* 4 Top Pill-Tabs for Finances */}
          <Animated.View style={tabsEntrance}>
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                padding: 4,
                borderRadius: tokens.radiusControl,
                backgroundColor: tokens.card,
                borderWidth: 1,
                borderColor: tokens.border,
              }}
            >
              {FINANCE_TABS.map((tab) => {
                const isSelected = activeTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Switch to ${tab.label} tab`}
                    onPress={() => setActiveTab(tab.key)}
                    style={[
                      {
                        flex: 1,
                        minHeight: 44,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: isSelected ? tokens.financeSoft : "transparent",
                        borderWidth: 1,
                        borderColor: isSelected ? tokens.finance : "transparent",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      },
                      Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                    ]}
                  >
                    <MaterialIcons
                      name={tab.icon}
                      size={17}
                      color={isSelected ? tokens.finance : tokens.mutedForeground}
                    />
                    <Text
                      style={{
                        color: isSelected ? tokens.finance : tokens.foreground,
                        fontSize: isDesktop ? 13 : 12,
                        fontWeight: isSelected ? "800" : "600",
                        fontFamily: "Plus Jakarta Sans",
                      }}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Tab Content Section */}
          <Animated.View style={contentEntrance}>
            {isLoading ? (
              <View style={{ paddingVertical: 48, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={tokens.finance} />
                <Text style={{ color: tokens.mutedForeground, marginTop: 12, fontSize: 13 }}>
                  Loading financial records...
                </Text>
              </View>
            ) : errorMessage ? (
              <Card style={{ padding: 24, alignItems: "center", gap: 12 }}>
                <MaterialIcons name="error-outline" size={32} color={tokens.destructive} />
                <Text style={{ color: tokens.destructive, fontWeight: "700" }}>{errorMessage}</Text>
                <Button
                  variant="outline"
                  size="sm"
                  label="Retry"
                  onPress={() => loadFinances(accessToken!, currentWorkspace?.id)}
                />
              </Card>
            ) : (
              <>
                {/* 1. TRANSACTIONS TAB */}
                {activeTab === "transactions" && (
                  <View style={{ gap: 14 }}>
                    {/* Filter bar & Quick Add button */}
                    <View
                      style={{
                        flexDirection: isDesktop ? "row" : "column",
                        gap: 10,
                        justifyContent: "space-between",
                        alignItems: isDesktop ? "center" : "stretch",
                      }}
                    >
                      {/* Type filter chips */}
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {(["all", "expense", "income", "transfer"] as const).map((filter) => {
                          const isSel = txTypeFilter === filter;
                          return (
                            <Pressable
                              key={filter}
                              accessibilityRole="button"
                              accessibilityLabel={`Filter by ${filter}`}
                              onPress={() => setTxTypeFilter(filter)}
                              style={[
                                {
                                  minHeight: 36,
                                  paddingHorizontal: 12,
                                  borderRadius: tokens.radiusControl,
                                  backgroundColor: isSel ? tokens.primary : tokens.muted,
                                  alignItems: "center",
                                  justifyContent: "center",
                                },
                                Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                              ]}
                            >
                              <Text
                                style={{
                                  color: isSel ? tokens.primaryForeground : tokens.mutedForeground,
                                  fontSize: 12,
                                  fontWeight: "700",
                                  textTransform: "capitalize",
                                }}
                              >
                                {filter}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <Button
                        variant="primary"
                        size="sm"
                        label="+ New Transaction"
                        onPress={() => {
                          setModalError(null);
                          setShowTransactionModal(true);
                        }}
                      />
                    </View>

                    {/* Transactions List */}
                    {filteredTransactions.length === 0 ? (
                      <Card style={{ padding: 32, alignItems: "center", gap: 8 }}>
                        <MaterialIcons name="receipt-long" size={36} color={tokens.mutedForeground} />
                        <Text style={{ color: tokens.foreground, fontWeight: "700" }}>No transactions logged yet</Text>
                        <Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>
                          Tap "+ New Transaction" to record an expense, income, or transfer.
                        </Text>
                      </Card>
                    ) : (
                      <Card style={{ padding: 6, gap: 2 }}>
                        {filteredTransactions.map((tx, idx) => {
                          const isIncome = tx.type === "income";
                          const isTransfer = tx.type === "transfer";
                          return (
                            <View
                              key={tx.id}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                borderRadius: tokens.radiusControl,
                                borderBottomWidth: idx < filteredTransactions.length - 1 ? 1 : 0,
                                borderBottomColor: tokens.border,
                              }}
                            >
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                                <View
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    backgroundColor: isIncome
                                      ? tokens.financeSoft
                                      : isTransfer
                                      ? `${tokens.doo}22`
                                      : tokens.muted,
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <MaterialIcons
                                    name={(tx.category_icon as any) || "receipt"}
                                    size={18}
                                    color={isIncome ? tokens.finance : isTransfer ? tokens.doo : tokens.foreground}
                                  />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      color: tokens.foreground,
                                      fontSize: 14,
                                      fontWeight: "700",
                                      fontFamily: "Plus Jakarta Sans",
                                    }}
                                  >
                                    {tx.description}
                                  </Text>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                                    <Text style={{ color: tokens.mutedForeground, fontSize: 11 }}>
                                      {tx.transaction_date}
                                    </Text>
                                    <Text style={{ color: tokens.border }}>•</Text>
                                    <Text style={{ color: tokens.mutedForeground, fontSize: 11 }}>
                                      {tx.account_name}
                                    </Text>
                                    {tx.category_name ? (
                                      <>
                                        <Text style={{ color: tokens.border }}>•</Text>
                                        <Text style={{ color: tokens.mutedForeground, fontSize: 11 }}>
                                          {tx.category_name}
                                        </Text>
                                      </>
                                    ) : null}
                                  </View>
                                </View>
                              </View>

                              {/* Amount & Delete */}
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                <Text
                                  style={{
                                    color: isIncome ? tokens.finance : tokens.foreground,
                                    fontSize: 14,
                                    fontWeight: "800",
                                    fontFamily: "JetBrains Mono",
                                  }}
                                >
                                  {isIncome ? "+" : isTransfer ? "⇄ " : "-"}
                                  {formatCurrency(tx.amount, currency)}
                                </Text>

                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`Delete transaction ${tx.description}`}
                                  onPress={() => handleDeleteTransaction(tx.id, tx.description)}
                                  style={[
                                    {
                                      width: 28,
                                      height: 28,
                                      borderRadius: 6,
                                      alignItems: "center",
                                      justifyContent: "center",
                                    },
                                    Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                                  ]}
                                >
                                  <MaterialIcons name="delete-outline" size={16} color={tokens.mutedForeground} />
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </Card>
                    )}
                  </View>
                )}

                {/* 2. BUDGETS TAB */}
                {activeTab === "budgets" && (
                  <View style={{ gap: 14 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <View>
                        <Text style={{ color: tokens.foreground, fontSize: 15, fontWeight: "800" }}>
                          Monthly Category Limits
                        </Text>
                        <Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>
                          Period: {data?.period_month}
                        </Text>
                      </View>
                      <Button
                        variant="primary"
                        size="sm"
                        label="+ Set Budget"
                        onPress={() => {
                          setModalError(null);
                          setShowBudgetModal(true);
                        }}
                      />
                    </View>

                    {/* Budgets Grid */}
                    <View
                      style={{
                        flexDirection: isDesktop ? "row" : "column",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      {(data?.budgets || []).map((b) => (
                        <Card
                          key={b.category_id}
                          style={{
                            flex: isDesktop ? 1 : undefined,
                            minWidth: isDesktop ? 280 : undefined,
                            padding: 16,
                            gap: 10,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <View
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  backgroundColor: tokens.financeSoft,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <MaterialIcons name={(b.category_icon as any) || "label"} size={16} color={tokens.finance} />
                              </View>
                              <Text style={{ color: tokens.foreground, fontWeight: "700", fontSize: 14 }}>
                                {b.category_name}
                              </Text>
                            </View>

                            <View
                              style={{
                                paddingHorizontal: 7,
                                paddingVertical: 2,
                                borderRadius: 999,
                                backgroundColor: b.is_over_budget ? `${tokens.destructive}22` : tokens.financeSoft,
                              }}
                            >
                              <Text
                                style={{
                                  color: b.is_over_budget ? tokens.destructive : tokens.finance,
                                  fontSize: 10,
                                  fontWeight: "800",
                                  fontFamily: "JetBrains Mono",
                                }}
                              >
                                {b.percentage_used}%
                              </Text>
                            </View>
                          </View>

                          {/* Progress bar */}
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
                                height: "100%",
                                width: `${Math.min(100, b.percentage_used)}%`,
                                backgroundColor: b.is_over_budget ? tokens.destructive : tokens.finance,
                              }}
                            />
                          </View>

                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={{ color: tokens.mutedForeground, fontSize: 11 }}>
                              Spent: <Text style={{ fontFamily: "JetBrains Mono", color: tokens.foreground }}>{formatCurrency(b.spent_amount, currency)}</Text>
                            </Text>
                            <Text style={{ color: tokens.mutedForeground, fontSize: 11 }}>
                              Limit: <Text style={{ fontFamily: "JetBrains Mono", color: tokens.foreground }}>{formatCurrency(b.monthly_limit, currency)}</Text>
                            </Text>
                          </View>
                        </Card>
                      ))}
                    </View>
                  </View>
                )}

                {/* 3. SAVINGS GOALS TAB */}
                {activeTab === "savings" && (
                  <View style={{ gap: 14 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <View>
                        <Text style={{ color: tokens.foreground, fontSize: 15, fontWeight: "800" }}>
                          Active Savings Goals
                        </Text>
                        <Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>
                          {formatCurrency(summary?.total_goals_saved || 0, currency)} saved toward {formatCurrency(summary?.total_goals_target || 0, currency)}
                        </Text>
                      </View>
                      <Button
                        variant="primary"
                        size="sm"
                        label="+ New Goal"
                        onPress={() => {
                          setModalError(null);
                          setShowGoalModal(true);
                        }}
                      />
                    </View>

                    {/* Goals List */}
                    <View
                      style={{
                        flexDirection: isDesktop ? "row" : "column",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      {(data?.savings_goals || []).map((goal) => (
                        <Card
                          key={goal.id}
                          style={{
                            flex: isDesktop ? 1 : undefined,
                            minWidth: isDesktop ? 320 : undefined,
                            padding: 18,
                            gap: 12,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <View
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 10,
                                  backgroundColor: tokens.wishSoft,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <MaterialIcons name={(goal.icon as any) || "savings"} size={18} color={tokens.wish} />
                              </View>
                              <View>
                                <Text style={{ color: tokens.foreground, fontWeight: "800", fontSize: 14 }}>
                                  {goal.name}
                                </Text>
                                {goal.target_date ? (
                                  <Text style={{ color: tokens.mutedForeground, fontSize: 11 }}>
                                    Target: {goal.target_date}
                                  </Text>
                                ) : null}
                              </View>
                            </View>

                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Delete goal ${goal.name}`}
                              onPress={() => handleDeleteGoal(goal.id, goal.name)}
                            >
                              <MaterialIcons name="delete-outline" size={17} color={tokens.mutedForeground} />
                            </Pressable>
                          </View>

                          {/* Goal progress */}
                          <View style={{ gap: 6 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                              <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700", fontFamily: "JetBrains Mono" }}>
                                {formatCurrency(goal.current_amount, currency)}
                              </Text>
                              <Text style={{ color: tokens.mutedForeground, fontSize: 13, fontFamily: "JetBrains Mono" }}>
                                / {formatCurrency(goal.target_amount, currency)} ({goal.progress_percent}%)
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
                                  height: "100%",
                                  width: `${Math.min(100, goal.progress_percent)}%`,
                                  backgroundColor: tokens.wish,
                                }}
                              />
                            </View>
                          </View>

                          {/* Fund Action Button */}
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 8,
                              paddingTop: 8,
                              borderTopWidth: 1,
                              borderTopColor: tokens.border,
                            }}
                          >
                            <Button
                              variant="secondary"
                              size="sm"
                              label="Transfer / Fund Goal"
                              onPress={() => {
                                setSelectedGoalForFunding(goal);
                                setModalError(null);
                                setShowFundModal(true);
                              }}
                              style={{ flex: 1 }}
                            />
                          </View>
                        </Card>
                      ))}
                    </View>
                  </View>
                )}

                {/* 4. ACCOUNTS TAB */}
                {activeTab === "accounts" && (
                  <View style={{ gap: 14 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <View>
                        <Text style={{ color: tokens.foreground, fontSize: 15, fontWeight: "800" }}>
                          Connected Wallets & Accounts
                        </Text>
                        <Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>
                          {data?.accounts.length || 0} active accounts
                        </Text>
                      </View>
                      <Button
                        variant="primary"
                        size="sm"
                        label="+ Add Account"
                        onPress={() => {
                          setModalError(null);
                          setShowAccountModal(true);
                        }}
                      />
                    </View>

                    {/* Accounts Grid */}
                    <View
                      style={{
                        flexDirection: isDesktop ? "row" : "column",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      {(data?.accounts || []).map((acc) => (
                        <Card
                          key={acc.id}
                          style={{
                            flex: isDesktop ? 1 : undefined,
                            minWidth: isDesktop ? 280 : undefined,
                            padding: 18,
                            gap: 12,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <View
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 10,
                                  backgroundColor: tokens.financeSoft,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <MaterialIcons name={(acc.icon as any) || "account-balance-wallet"} size={18} color={tokens.finance} />
                              </View>
                              <View>
                                <Text style={{ color: tokens.foreground, fontWeight: "800", fontSize: 14 }}>
                                  {acc.name}
                                </Text>
                                <Text style={{ color: tokens.mutedForeground, fontSize: 11, textTransform: "capitalize" }}>
                                  {acc.type}
                                </Text>
                              </View>
                            </View>

                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Delete account ${acc.name}`}
                              onPress={() => handleDeleteAccount(acc.id, acc.name)}
                            >
                              <MaterialIcons name="delete-outline" size={17} color={tokens.mutedForeground} />
                            </Pressable>
                          </View>

                          <View>
                            <Text style={{ color: tokens.mutedForeground, fontSize: 11 }}>Current Balance</Text>
                            <Text
                              style={{
                                color: tokens.foreground,
                                fontSize: 22,
                                fontWeight: "800",
                                fontFamily: "JetBrains Mono",
                                marginTop: 2,
                              }}
                            >
                              {formatCurrency(acc.balance, currency)}
                            </Text>
                          </View>
                        </Card>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </Animated.View>
        </ScrollView>
      </AdaptiveShell>

      {/* 1. LOG TRANSACTION MODAL */}
      {showTransactionModal && (
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowTransactionModal(false)} />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: tokens.card,
                borderColor: tokens.border,
                maxWidth: isDesktop ? 480 : "100%",
              },
            ]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "800", fontFamily: "Plus Jakarta Sans" }}>
                Log Transaction
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close transaction modal"
                onPress={() => setShowTransactionModal(false)}
              >
                <MaterialIcons name="close" size={20} color={tokens.mutedForeground} />
              </Pressable>
            </View>

            {modalError ? (
              <Animated.View style={{ transform: [{ translateX: errorShake.translateX }] }}>
                <View style={{ padding: 10, borderRadius: 8, backgroundColor: `${tokens.destructive}22` }}>
                  <Text style={{ color: tokens.destructive, fontSize: 12, fontWeight: "700" }}>{modalError}</Text>
                </View>
              </Animated.View>
            ) : null}

            {/* Transaction Type Selector */}
            <View style={{ flexDirection: "row", gap: 6 }}>
              {(["expense", "income", "transfer"] as const).map((t) => (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${t} transaction type`}
                  onPress={() => setTxType(t)}
                  style={[
                    {
                      flex: 1,
                      minHeight: 40,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: txType === t ? tokens.primary : tokens.muted,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                  ]}
                >
                  <Text
                    style={{
                      color: txType === t ? tokens.primaryForeground : tokens.foreground,
                      fontSize: 12,
                      fontWeight: "700",
                      textTransform: "capitalize",
                    }}
                  >
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Amount */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>AMOUNT ({currency})</Text>
              <TextInput
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={tokens.mutedForeground}
                value={txAmount}
                onChangeText={setTxAmount}
                style={[
                  styles.input,
                  {
                    color: tokens.foreground,
                    backgroundColor: tokens.background,
                    borderColor: tokens.border,
                    fontFamily: "JetBrains Mono",
                  },
                ]}
              />
            </View>

            {/* Description */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>DESCRIPTION</Text>
              <TextInput
                placeholder="e.g. Grocery run or Freelance invoice"
                placeholderTextColor={tokens.mutedForeground}
                value={txDescription}
                onChangeText={setTxDescription}
                style={[
                  styles.input,
                  {
                    color: tokens.foreground,
                    backgroundColor: tokens.background,
                    borderColor: tokens.border,
                  },
                ]}
              />
            </View>

            {/* Account Selector */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>ACCOUNT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {(data?.accounts || []).map((acc) => (
                  <Pressable
                    key={acc.id}
                    onPress={() => setTxAccountId(acc.id)}
                    style={[
                      {
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: txAccountId === acc.id ? tokens.financeSoft : tokens.muted,
                        borderWidth: 1,
                        borderColor: txAccountId === acc.id ? tokens.finance : tokens.border,
                      },
                      Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                    ]}
                  >
                    <Text
                      style={{
                        color: txAccountId === acc.id ? tokens.finance : tokens.foreground,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {acc.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Category Selector (for expense/income) */}
            {txType !== "transfer" && (
              <View style={{ gap: 4 }}>
                <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>CATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {(data?.categories || []).map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => setTxCategoryId(cat.id)}
                      style={[
                        {
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          borderRadius: tokens.radiusControl,
                          backgroundColor: txCategoryId === cat.id ? tokens.primary : tokens.muted,
                        },
                        Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                      ]}
                    >
                      <Text
                        style={{
                          color: txCategoryId === cat.id ? tokens.primaryForeground : tokens.foreground,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Explicit Save & Confirm */}
            <Button
              variant="primary"
              size="lg"
              label={isSubmitting ? "Confirming..." : "Save & Confirm Transaction"}
              onPress={handleConfirmTransaction}
              disabled={isSubmitting}
            />
          </View>
        </View>
      )}

      {/* 2. SET BUDGET MODAL */}
      {showBudgetModal && (
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowBudgetModal(false)} />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: tokens.card,
                borderColor: tokens.border,
                maxWidth: isDesktop ? 440 : "100%",
              },
            ]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "800" }}>Set Monthly Budget</Text>
              <Pressable accessibilityLabel="Close budget modal" onPress={() => setShowBudgetModal(false)}>
                <MaterialIcons name="close" size={20} color={tokens.mutedForeground} />
              </Pressable>
            </View>

            {modalError ? (
              <Animated.View style={{ transform: [{ translateX: errorShake.translateX }] }}>
                <View style={{ padding: 10, borderRadius: 8, backgroundColor: `${tokens.destructive}22` }}>
                  <Text style={{ color: tokens.destructive, fontSize: 12, fontWeight: "700" }}>{modalError}</Text>
                </View>
              </Animated.View>
            ) : null}

            {/* Category */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {(data?.categories || []).map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setBudgetCatId(cat.id)}
                    style={[
                      {
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: budgetCatId === cat.id ? tokens.financeSoft : tokens.muted,
                        borderWidth: 1,
                        borderColor: budgetCatId === cat.id ? tokens.finance : tokens.border,
                      },
                      Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                    ]}
                  >
                    <Text
                      style={{
                        color: budgetCatId === cat.id ? tokens.finance : tokens.foreground,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Monthly Limit */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>MONTHLY LIMIT ({currency})</Text>
              <TextInput
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={tokens.mutedForeground}
                value={budgetLimit}
                onChangeText={setBudgetLimit}
                style={[
                  styles.input,
                  {
                    color: tokens.foreground,
                    backgroundColor: tokens.background,
                    borderColor: tokens.border,
                    fontFamily: "JetBrains Mono",
                  },
                ]}
              />
            </View>

            <Button
              variant="primary"
              size="lg"
              label={isSubmitting ? "Saving..." : "Save & Confirm Budget"}
              onPress={handleConfirmBudget}
              disabled={isSubmitting}
            />
          </View>
        </View>
      )}

      {/* 3. CREATE SAVINGS GOAL MODAL */}
      {showGoalModal && (
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowGoalModal(false)} />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: tokens.card,
                borderColor: tokens.border,
                maxWidth: isDesktop ? 460 : "100%",
              },
            ]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "800" }}>New Savings Goal</Text>
              <Pressable accessibilityLabel="Close goal modal" onPress={() => setShowGoalModal(false)}>
                <MaterialIcons name="close" size={20} color={tokens.mutedForeground} />
              </Pressable>
            </View>

            {modalError ? (
              <Animated.View style={{ transform: [{ translateX: errorShake.translateX }] }}>
                <View style={{ padding: 10, borderRadius: 8, backgroundColor: `${tokens.destructive}22` }}>
                  <Text style={{ color: tokens.destructive, fontSize: 12, fontWeight: "700" }}>{modalError}</Text>
                </View>
              </Animated.View>
            ) : null}

            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>GOAL NAME</Text>
              <TextInput
                placeholder="e.g. Kyoto Trip or Emergency Vault"
                placeholderTextColor={tokens.mutedForeground}
                value={goalName}
                onChangeText={setGoalName}
                style={[
                  styles.input,
                  { color: tokens.foreground, backgroundColor: tokens.background, borderColor: tokens.border },
                ]}
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>TARGET AMOUNT ({currency})</Text>
              <TextInput
                keyboardType="decimal-pad"
                placeholder="1000.00"
                placeholderTextColor={tokens.mutedForeground}
                value={goalTarget}
                onChangeText={setGoalTarget}
                style={[
                  styles.input,
                  {
                    color: tokens.foreground,
                    backgroundColor: tokens.background,
                    borderColor: tokens.border,
                    fontFamily: "JetBrains Mono",
                  },
                ]}
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>INITIAL AMOUNT ({currency})</Text>
              <TextInput
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={tokens.mutedForeground}
                value={goalCurrent}
                onChangeText={setGoalCurrent}
                style={[
                  styles.input,
                  {
                    color: tokens.foreground,
                    backgroundColor: tokens.background,
                    borderColor: tokens.border,
                    fontFamily: "JetBrains Mono",
                  },
                ]}
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>TARGET DATE (OPTIONAL, YYYY-MM-DD)</Text>
              <TextInput
                placeholder="2026-12-31"
                placeholderTextColor={tokens.mutedForeground}
                value={goalTargetDate}
                onChangeText={setGoalTargetDate}
                style={[
                  styles.input,
                  {
                    color: tokens.foreground,
                    backgroundColor: tokens.background,
                    borderColor: tokens.border,
                    fontFamily: "JetBrains Mono",
                  },
                ]}
              />
            </View>

            <Button
              variant="primary"
              size="lg"
              label={isSubmitting ? "Creating..." : "Save & Confirm Goal"}
              onPress={handleConfirmGoal}
              disabled={isSubmitting}
            />
          </View>
        </View>
      )}

      {/* 4. FUND SAVINGS GOAL MODAL */}
      {showFundModal && selectedGoalForFunding && (
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFundModal(false)} />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: tokens.card,
                borderColor: tokens.border,
                maxWidth: isDesktop ? 440 : "100%",
              },
            ]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "800" }}>
                Fund Goal: {selectedGoalForFunding.name}
              </Text>
              <Pressable accessibilityLabel="Close fund modal" onPress={() => setShowFundModal(false)}>
                <MaterialIcons name="close" size={20} color={tokens.mutedForeground} />
              </Pressable>
            </View>

            {modalError ? (
              <Animated.View style={{ transform: [{ translateX: errorShake.translateX }] }}>
                <View style={{ padding: 10, borderRadius: 8, backgroundColor: `${tokens.destructive}22` }}>
                  <Text style={{ color: tokens.destructive, fontSize: 12, fontWeight: "700" }}>{modalError}</Text>
                </View>
              </Animated.View>
            ) : null}

            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>TRANSFER AMOUNT ({currency})</Text>
              <TextInput
                keyboardType="decimal-pad"
                placeholder="100.00"
                placeholderTextColor={tokens.mutedForeground}
                value={fundAmount}
                onChangeText={setFundAmount}
                style={[
                  styles.input,
                  {
                    color: tokens.foreground,
                    backgroundColor: tokens.background,
                    borderColor: tokens.border,
                    fontFamily: "JetBrains Mono",
                  },
                ]}
              />
            </View>

            {/* Source Account */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>DEDUCT FROM ACCOUNT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {(data?.accounts || []).map((acc) => (
                  <Pressable
                    key={acc.id}
                    onPress={() => setFundAccountId(acc.id)}
                    style={[
                      {
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: fundAccountId === acc.id ? tokens.financeSoft : tokens.muted,
                        borderWidth: 1,
                        borderColor: fundAccountId === acc.id ? tokens.finance : tokens.border,
                      },
                      Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                    ]}
                  >
                    <Text
                      style={{
                        color: fundAccountId === acc.id ? tokens.finance : tokens.foreground,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {acc.name} ({formatCurrency(acc.balance, currency)})
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <Animated.View style={{ transform: [{ scale: fundPulse.scale }] }}>
              <Button
                variant="primary"
                size="lg"
                label={isSubmitting ? "Transferring..." : "Confirm & Transfer Funds"}
                onPress={handleConfirmFund}
                disabled={isSubmitting}
              />
            </Animated.View>
          </View>
        </View>
      )}

      {/* 5. ADD ACCOUNT MODAL */}
      {showAccountModal && (
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAccountModal(false)} />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: tokens.card,
                borderColor: tokens.border,
                maxWidth: isDesktop ? 440 : "100%",
              },
            ]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "800" }}>New Account / Wallet</Text>
              <Pressable accessibilityLabel="Close account modal" onPress={() => setShowAccountModal(false)}>
                <MaterialIcons name="close" size={20} color={tokens.mutedForeground} />
              </Pressable>
            </View>

            {modalError ? (
              <Animated.View style={{ transform: [{ translateX: errorShake.translateX }] }}>
                <View style={{ padding: 10, borderRadius: 8, backgroundColor: `${tokens.destructive}22` }}>
                  <Text style={{ color: tokens.destructive, fontSize: 12, fontWeight: "700" }}>{modalError}</Text>
                </View>
              </Animated.View>
            ) : null}

            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>ACCOUNT NAME</Text>
              <TextInput
                placeholder="e.g. Daily Checking or Cash Vault"
                placeholderTextColor={tokens.mutedForeground}
                value={accName}
                onChangeText={setAccName}
                style={[
                  styles.input,
                  { color: tokens.foreground, backgroundColor: tokens.background, borderColor: tokens.border },
                ]}
              />
            </View>

            {/* Type */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>ACCOUNT TYPE</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {(["checking", "savings", "cash", "credit"] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setAccType(t)}
                    style={[
                      {
                        flex: 1,
                        minHeight: 38,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: accType === t ? tokens.primary : tokens.muted,
                        alignItems: "center",
                        justifyContent: "center",
                      },
                      Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                    ]}
                  >
                    <Text
                      style={{
                        color: accType === t ? tokens.primaryForeground : tokens.foreground,
                        fontSize: 11,
                        fontWeight: "700",
                        textTransform: "capitalize",
                      }}
                    >
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 11, fontWeight: "700" }}>STARTING BALANCE ({currency})</Text>
              <TextInput
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={tokens.mutedForeground}
                value={accBalance}
                onChangeText={setAccBalance}
                style={[
                  styles.input,
                  {
                    color: tokens.foreground,
                    backgroundColor: tokens.background,
                    borderColor: tokens.border,
                    fontFamily: "JetBrains Mono",
                  },
                ]}
              />
            </View>

            <Button
              variant="primary"
              size="lg"
              label={isSubmitting ? "Creating..." : "Save & Confirm Account"}
              onPress={handleConfirmAccount}
              disabled={isSubmitting}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalSheet: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    gap: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.35)",
      } as any,
      default: {
        elevation: 8,
      },
    }),
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
  },
});
