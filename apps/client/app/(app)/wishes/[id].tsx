import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppTheme } from "@/theme/ThemeProvider";
import { useErrorShake, useInteractiveMotion, usePulseScale, useStaggerEntrance } from "@/lib/motion";
import { AmbientMeshBackground } from "@/components/ui/AmbientMeshBackground";
import { AdaptiveShell } from "@/components/layout/AdaptiveShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TimedNotice } from "@/components/ui/TimedNotice";
import { useAuthStore } from "@/store/authStore";
import {
  deleteWish,
  fetchWishDetail,
  fulfillWish,
  updateWish,
  uploadWishImage,
  WishDetailResponse,
} from "@/api/wishes";
import {
  fetchFinancesOverview,
  FinanceAccount,
  FinanceCategory,
  FinanceSavingsGoal,
} from "@/api/finances";
import { fetchDoos, DooItem } from "@/api/doos";

const DEMO_EMAIL = "demo@wishesanddoos.app";

function formatCurrency(amount: number | null | undefined, currency: string = "USD"): string {
  if (amount === null || amount === undefined) return "$0.00";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

export default function WishDetailScreen() {
  const { tokens, colorMode } = useAppTheme();
  const isDark = colorMode === "dark";
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [wish, setWish] = useState<WishDetailResponse | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<FinanceSavingsGoal[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Timed Notification & Undo Support
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [feedbackVariant, setFeedbackVariant] = useState<"info" | "success" | "warning" | "destructive">("info");
  const [pendingUndo, setPendingUndo] = useState<{
    label: string;
    onUndo: () => Promise<void>;
  } | null>(null);

  // Fulfill Modal State
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [fulfillRecordExpense, setFulfillRecordExpense] = useState(true);
  const [fulfillAccountId, setFulfillAccountId] = useState("");
  const [fulfillAmount, setFulfillAmount] = useState("");
  const [fulfillCategoryId, setFulfillCategoryId] = useState("");
  const [fulfillDescription, setFulfillDescription] = useState("");
  const [isSubmittingFulfill, setIsSubmittingFulfill] = useState(false);
  const [fulfillError, setFulfillError] = useState<string | null>(null);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high">("medium");
  const [editGoalId, setEditGoalId] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editSelectedDooIds, setEditSelectedDooIds] = useState<string[]>([]);
  const [availableDoos, setAvailableDoos] = useState<DooItem[]>([]);
  const [editCatId, setEditCatId] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editImageKey, setEditImageKey] = useState("");
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Confirm Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Motion Hooks
  const errorShake = useErrorShake();
  const pulseConfirm = usePulseScale();
  const heroEntrance = useStaggerEntrance(0);
  const detailsEntrance = useStaggerEntrance(1);
  const doosEntrance = useStaggerEntrance(2);

  const currency = wish?.workspace.currency || currentWorkspace?.currency || "USD";

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const token = accessToken || "demo-token";

      const [detailRes, financesRes, doosRes] = await Promise.all([
        fetchWishDetail(token, id),
        fetchFinancesOverview(token, currentWorkspace?.id).catch(() => null),
        fetchDoos(token, { workspace_id: currentWorkspace?.id }).catch(() => null),
      ]);

      setWish(detailRes);
      if (financesRes) {
        setAccounts(financesRes.accounts || []);
        setSavingsGoals(financesRes.savings_goals || []);
        setCategories(financesRes.categories || []);
      }
      if (doosRes) {
        setAvailableDoos(doosRes.items || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load wish details.");
    } finally {
      setIsLoading(false);
    }
  }, [id, accessToken, currentWorkspace?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSignOut = async () => {
    clearSession();
    router.replace("/welcome");
  };

  // Open Fulfill Modal
  const handleOpenFulfillModal = () => {
    if (!wish) return;
    setFulfillRecordExpense(true);
    setFulfillAccountId(wish.account_id || accounts[0]?.id || "");
    setFulfillAmount(wish.estimated_price !== null && wish.estimated_price !== undefined ? String(wish.estimated_price) : "");
    setFulfillCategoryId(wish.category_id || categories[0]?.id || "");
    setFulfillDescription(`Fulfilled Wish: ${wish.title}`);
    setFulfillError(null);
    setShowFulfillModal(true);
  };

  // Submit Fulfillment (Atomic)
  const handleConfirmFulfill = async () => {
    if (!wish) return;
    const token = accessToken || "demo-token";

    if (fulfillRecordExpense) {
      if (!fulfillAccountId) {
        setFulfillError("Please select an account to pay from.");
        errorShake.triggerShake();
        return;
      }
      const parsedAmount = fulfillAmount.trim() ? parseFloat(fulfillAmount) : 0;
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setFulfillError("Please enter a valid expense amount greater than zero.");
        errorShake.triggerShake();
        return;
      }
    }

    try {
      setIsSubmittingFulfill(true);
      setFulfillError(null);

      const res = await fulfillWish(token, wish.id, {
        record_expense: fulfillRecordExpense,
        account_id: fulfillRecordExpense ? fulfillAccountId : null,
        expense_amount: fulfillRecordExpense ? parseFloat(fulfillAmount) : null,
        category_id: fulfillRecordExpense ? (fulfillCategoryId || null) : null,
        description: fulfillRecordExpense ? fulfillDescription.trim() : null,
      });

      setWish(res.wish);
      setShowFulfillModal(false);
      pulseConfirm.triggerPulse();
      setFeedbackVariant("success");
      setFeedbackNotice(`Wish "${wish.title}" fulfilled & granted successfully!`);
    } catch (err: any) {
      setFulfillError(err.message || "Failed to fulfill wish.");
      errorShake.triggerShake();
    } finally {
      setIsSubmittingFulfill(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = () => {
    if (!wish) return;
    setEditTitle(wish.title);
    setEditPrice(wish.estimated_price !== null && wish.estimated_price !== undefined ? String(wish.estimated_price) : "");
    setEditPriority(wish.priority);
    setEditGoalId(wish.savings_goal_id || "");
    setEditAccountId(wish.account_id || "");
    setEditSelectedDooIds((wish.linked_doos || []).map((d) => d.id));
    setEditCatId(wish.category_id || "");
    setEditUrl(wish.url || "");
    setEditNotes(wish.notes || "");
    setEditImageKey(wish.image_storage_key || "");
    setEditImagePreview(wish.image_url || null);
    setEditError(null);
    setShowEditModal(true);
  };

  // Upload Image on Web
  const handlePickImageWeb = () => {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file || !accessToken) return;
      try {
        setIsUploadingImage(true);
        setEditError(null);
        const uploadRes = await uploadWishImage(accessToken, file, file.name, currentWorkspace?.id);
        setEditImageKey(uploadRes.storage_key);
        setEditImagePreview(uploadRes.image_url);
        pulseConfirm.triggerPulse();
      } catch (err: any) {
        setEditError(err.message || "Failed to upload image.");
        errorShake.triggerShake();
      } finally {
        setIsUploadingImage(false);
      }
    };
    input.click();
  };

  // Submit Edit Wish
  const handleConfirmEditWish = async () => {
    if (!wish) return;
    const token = accessToken || "demo-token";

    if (!editTitle.trim()) {
      setEditError("Please enter a title for your wish.");
      errorShake.triggerShake();
      return;
    }

    const parsedPrice = editPrice.trim() ? parseFloat(editPrice) : null;
    if (parsedPrice !== null && (isNaN(parsedPrice) || parsedPrice < 0)) {
      setEditError("Please enter a valid positive target price.");
      errorShake.triggerShake();
      return;
    }

    try {
      setIsSubmittingEdit(true);
      setEditError(null);

      const updated = await updateWish(token, wish.id, {
        title: editTitle.trim(),
        estimated_price: parsedPrice,
        priority: editPriority,
        savings_goal_id: editGoalId || null,
        account_id: editAccountId || null,
        linked_doo_ids: editSelectedDooIds,
        category_id: editCatId || null,
        url: editUrl.trim() || null,
        notes: editNotes.trim() || null,
        image_storage_key: editImageKey || null,
      });

      // Reload fresh detail
      const refreshed = await fetchWishDetail(token, wish.id);
      setWish(refreshed);
      setShowEditModal(false);
      setFeedbackVariant("warning");
      setFeedbackNotice(`Wish "${updated.title}" updated successfully.`);
    } catch (err: any) {
      setEditError(err.message || "Failed to update wish.");
      errorShake.triggerShake();
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Toggle Wish Status (Active <-> Granted)
  const handleToggleStatus = async () => {
    if (!wish) return;
    const token = accessToken || "demo-token";
    const targetStatus = wish.status === "granted" ? "active" : "granted";
    try {
      const updated = await updateWish(token, wish.id, { status: targetStatus });
      const refreshed = await fetchWishDetail(token, wish.id);
      setWish(refreshed);
      setFeedbackVariant(targetStatus === "granted" ? "success" : "warning");
      setFeedbackNotice(
        targetStatus === "granted"
          ? `Marked "${wish.title}" as granted.`
          : `Re-activated "${wish.title}".`
      );
    } catch (err: any) {
      setFeedbackVariant("destructive");
      setFeedbackNotice(err.message || "Failed to update status.");
    }
  };

  // Delete Wish with 1-Click Undo
  const handleConfirmDelete = async () => {
    if (!wish) return;
    const token = accessToken || "demo-token";
    const deletedCopy = { ...wish };
    try {
      setIsDeleting(true);
      await deleteWish(token, wish.id);
      setShowDeleteModal(false);

      // Offer Undo before leaving
      setFeedbackVariant("destructive");
      setFeedbackNotice(`Wish "${deletedCopy.title}" deleted.`);
      setPendingUndo({
        label: "Undo Delete",
        onUndo: async () => {
          // Re-create wish
          await updateWish(token, deletedCopy.id, {
            title: deletedCopy.title,
            estimated_price: deletedCopy.estimated_price,
            priority: deletedCopy.priority,
            category_id: deletedCopy.category_id,
            savings_goal_id: deletedCopy.savings_goal_id,
            url: deletedCopy.url,
            notes: deletedCopy.notes,
            image_storage_key: deletedCopy.image_storage_key,
          });
          loadData();
        },
      });

      // Navigate back to wishes after short delay
      setTimeout(() => {
        router.push("/wishes");
      }, 900);
    } catch (err: any) {
      setFeedbackVariant("destructive");
      setFeedbackNotice(err.message || "Failed to delete wish.");
    } finally {
      setIsDeleting(false);
    }
  };

  const isGranted = wish?.status === "granted";
  const savingsGoal = wish?.savings_goal;
  const savingsPct = savingsGoal?.progress_percent ?? 0;
  const isGoalFunded = savingsPct >= 100;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      {/* Screen 7 Perimeter Radial Gradient Origin: "corner-top-right" */}
      <AmbientMeshBackground variant="corner-top-right" />

      <AdaptiveShell
        activeTab="wishes"
        userDisplayName={authUser?.display_name || "Alex Rivera"}
        userEmail={authUser?.email}
        workspaceName={wish?.workspace.name || currentWorkspace?.name || "Personal Workspace"}
        workspaceCurrency={currency}
        onSignOut={handleSignOut}
      >
        <View style={{ gap: 20, width: "100%", paddingBottom: 40 }}>
          {/* Floating Timed Notification Badge */}
          <TimedNotice
            message={feedbackNotice}
            onDismiss={() => {
              setFeedbackNotice(null);
              setPendingUndo(null);
            }}
            onCancel={
              pendingUndo
                ? async () => {
                    const undoFn = pendingUndo.onUndo;
                    setPendingUndo(null);
                    await undoFn();
                  }
                : undefined
            }
            cancelLabel={pendingUndo?.label || "Undo"}
            durationMs={5200}
            variant={feedbackVariant}
          />

          {/* Top Bar: Back Button & Fast Actions */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Wishes"
              onPress={() => router.push("/wishes")}
              style={[
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: tokens.radiusControl,
                  backgroundColor: tokens.card,
                  borderWidth: 1,
                  borderColor: tokens.border,
                },
                Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
              ]}
            >
              <MaterialIcons name="arrow-back" size={16} color={tokens.foreground} />
              <Text
                style={{
                  color: tokens.foreground,
                  fontSize: 13,
                  fontWeight: "700",
                  fontFamily: "Plus Jakarta Sans",
                }}
              >
                Back to Wishes
              </Text>
            </Pressable>

            {wish ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {/* Fulfill CTA Button (if active) */}
                {!isGranted ? (
                  <Button
                    label="Fulfill & Grant Wish"
                    variant="primary"
                    size="sm"
                    icon={<MaterialIcons name="auto-awesome" size={15} color={tokens.primaryForeground} />}
                    onPress={handleOpenFulfillModal}
                    style={{ backgroundColor: tokens.finance, borderColor: tokens.finance }}
                  />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Toggle to Active"
                    onPress={handleToggleStatus}
                    style={[
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: tokens.financeSoft,
                        borderWidth: 1,
                        borderColor: `${tokens.finance}50`,
                      },
                      Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                    ]}
                  >
                    <MaterialIcons name="check-circle" size={14} color={tokens.finance} />
                    <Text
                      style={{
                        color: tokens.finance,
                        fontSize: 12,
                        fontWeight: "800",
                        fontFamily: "Plus Jakarta Sans",
                      }}
                    >
                      Granted · Click to Reactivate
                    </Text>
                  </Pressable>
                )}

                {/* Edit Button */}
                <Button
                  label="Edit"
                  variant="outline"
                  size="sm"
                  icon={<MaterialIcons name="edit" size={14} color={tokens.foreground} />}
                  onPress={handleOpenEditModal}
                />

                {/* Delete Button */}
                <Button
                  label="Delete"
                  variant="outline"
                  size="sm"
                  icon={<MaterialIcons name="delete-outline" size={14} color={tokens.destructive} />}
                  onPress={() => setShowDeleteModal(true)}
                  style={{ borderColor: `${tokens.destructive}40` }}
                />
              </View>
            ) : null}
          </View>

          {/* Loading State */}
          {isLoading ? (
            <Card style={{ padding: 40, alignItems: "center", justifyContent: "center", gap: 12 }}>
              <ActivityIndicator size="large" color={tokens.wish} />
              <Text
                style={{
                  color: tokens.mutedForeground,
                  fontSize: 13,
                  fontWeight: "600",
                  fontFamily: "Plus Jakarta Sans",
                }}
              >
                Loading wish details...
              </Text>
            </Card>
          ) : errorMessage || !wish ? (
            <Card style={{ padding: 32, alignItems: "center", gap: 12 }}>
              <MaterialIcons name="error-outline" size={32} color={tokens.destructive} />
              <Text
                style={{
                  color: tokens.foreground,
                  fontSize: 16,
                  fontWeight: "800",
                  fontFamily: "Plus Jakarta Sans",
                }}
              >
                {errorMessage || "Wish not found."}
              </Text>
              <Button
                label="Return to Wishes"
                variant="primary"
                size="md"
                onPress={() => router.push("/wishes")}
              />
            </Card>
          ) : (
            <View style={{ gap: 20 }}>
              {/* Hero Showcase Card */}
              <Animated.View style={heroEntrance}>
                <Card
                  style={{
                    padding: 24,
                    borderRadius: tokens.radiusCard,
                    borderColor: isGranted ? tokens.finance : tokens.border,
                    backgroundColor: tokens.card,
                    gap: 20,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isDesktop ? "row" : "column",
                      gap: 24,
                      alignItems: isDesktop ? "flex-start" : "stretch",
                    }}
                  >
                    {/* Hero Image or Fallback Visual Badge */}
                    <View
                      style={{
                        width: isDesktop ? 240 : "100%",
                        height: isDesktop ? 220 : 180,
                        borderRadius: tokens.radiusControl,
                        overflow: "hidden",
                        backgroundColor: tokens.muted,
                        borderWidth: 1,
                        borderColor: tokens.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {wish.image_url ? (
                        <Image
                          source={{ uri: wish.image_url }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                          alt={wish.title ? `Cover photo for ${wish.title}` : "Wish cover photo"}
                          accessibilityLabel={wish.title ? `Cover photo for ${wish.title}` : "Wish cover photo"}
                        />
                      ) : (
                        <View style={{ alignItems: "center", gap: 8 }}>
                          <MaterialIcons name="auto-awesome" size={48} color={tokens.wish} />
                          <Text
                            style={{
                              color: tokens.mutedForeground,
                              fontSize: 11,
                              fontWeight: "700",
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                              fontFamily: "Plus Jakarta Sans",
                            }}
                          >
                            No Image Attached
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Main Details Body */}
                    <View style={{ flex: 1, gap: 14 }}>
                      {/* Badge Row: Priority + Category + Granted */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {/* Priority Badge */}
                        <View
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 3,
                            borderRadius: 999,
                            backgroundColor:
                              wish.priority === "high"
                                ? `${tokens.destructive}20`
                                : wish.priority === "medium"
                                ? `${tokens.warning}20`
                                : tokens.muted,
                          }}
                        >
                          <Text
                            style={{
                              color:
                                wish.priority === "high"
                                  ? tokens.destructive
                                  : wish.priority === "medium"
                                  ? tokens.warning
                                  : tokens.mutedForeground,
                              fontSize: 11,
                              fontWeight: "800",
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                              fontFamily: "Plus Jakarta Sans",
                            }}
                          >
                            {wish.priority} Priority
                          </Text>
                        </View>

                        {/* Category Badge */}
                        {wish.category_name ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 5,
                              paddingHorizontal: 10,
                              paddingVertical: 3,
                              borderRadius: 999,
                              backgroundColor: tokens.muted,
                            }}
                          >
                            <MaterialIcons name="folder-open" size={13} color={tokens.mutedForeground} />
                            <Text
                              style={{
                                color: tokens.foreground,
                                fontSize: 11,
                                fontWeight: "700",
                                fontFamily: "Plus Jakarta Sans",
                              }}
                            >
                              {wish.category_name}
                            </Text>
                          </View>
                        ) : null}

                        {/* Granted Status Badge */}
                        {isGranted ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 5,
                              paddingHorizontal: 10,
                              paddingVertical: 3,
                              borderRadius: 999,
                              backgroundColor: tokens.financeSoft,
                            }}
                          >
                            <MaterialIcons name="check-circle" size={13} color={tokens.finance} />
                            <Text
                              style={{
                                color: tokens.finance,
                                fontSize: 11,
                                fontWeight: "800",
                                fontFamily: "Plus Jakarta Sans",
                              }}
                            >
                              Granted {wish.granted_at ? `· ${formatDate(wish.granted_at)}` : ""}
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 3,
                              borderRadius: 999,
                              backgroundColor: `${tokens.wish}18`,
                            }}
                          >
                            <Text
                              style={{
                                color: tokens.wish,
                                fontSize: 11,
                                fontWeight: "800",
                                fontFamily: "Plus Jakarta Sans",
                              }}
                            >
                              Active Wish
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Wish Title */}
                      <Text
                        style={{
                          color: tokens.foreground,
                          fontSize: isDesktop ? 28 : 22,
                          fontWeight: "800",
                          letterSpacing: -0.5,
                          fontFamily: "Plus Jakarta Sans",
                          textDecorationLine: isGranted ? "line-through" : "none",
                          opacity: isGranted ? 0.85 : 1,
                        }}
                      >
                        {wish.title}
                      </Text>

                      {/* Estimated Price */}
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 12,
                            fontWeight: "700",
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          Target Cost:
                        </Text>
                        <Text
                          style={{
                            color: tokens.wish,
                            fontSize: 26,
                            fontWeight: "900",
                            fontFamily: "JetBrains Mono",
                            letterSpacing: -0.6,
                          }}
                        >
                          {formatCurrency(wish.estimated_price, currency)}
                        </Text>
                      </View>

                      {/* External Product / Inspiration Link */}
                      {wish.url ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Open external product link"
                          onPress={() => Linking.openURL(wish.url!)}
                          style={[
                            {
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: tokens.radiusControl,
                              backgroundColor: tokens.muted,
                              borderWidth: 1,
                              borderColor: tokens.border,
                              alignSelf: "flex-start",
                            },
                            Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                          ]}
                        >
                          <MaterialIcons name="open-in-new" size={14} color={tokens.wish} />
                          <Text
                            numberOfLines={1}
                            style={{
                              color: tokens.wish,
                              fontSize: 12,
                              fontWeight: "700",
                              fontFamily: "Plus Jakarta Sans",
                              textDecorationLine: "underline",
                              maxWidth: 320,
                            }}
                          >
                            {wish.url.replace(/^https?:\/\/(www\.)?/, "")}
                          </Text>
                        </Pressable>
                      ) : null}

                      {/* Notes Section */}
                      {wish.notes ? (
                        <View
                          style={{
                            padding: 12,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: tokens.muted,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            gap: 4,
                          }}
                        >
                          <Text
                            style={{
                              color: tokens.mutedForeground,
                              fontSize: 10,
                              fontWeight: "700",
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                              fontFamily: "Plus Jakarta Sans",
                            }}
                          >
                            Personal Notes
                          </Text>
                          <Text
                            style={{
                              color: tokens.foreground,
                              fontSize: 13,
                              lineHeight: 19,
                              fontFamily: "Plus Jakarta Sans",
                            }}
                          >
                            {wish.notes}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Card>
              </Animated.View>

              {/* ROW 2: Linked Savings Goal (Left) & Fulfillment Summary (Right) */}
              <Animated.View style={detailsEntrance}>
                <View
                  style={{
                    flexDirection: isDesktop ? "row" : "column",
                    gap: 20,
                    alignItems: "stretch",
                  }}
                >
                  {/* Linked Savings Goal Card */}
                  <Card
                    style={{
                      flex: 1,
                      padding: 20,
                      borderRadius: tokens.radiusCard,
                      borderColor: isGoalFunded ? tokens.finance : tokens.border,
                      backgroundColor: tokens.card,
                      gap: 14,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: isGoalFunded ? tokens.financeSoft : `${tokens.wish}18`,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <MaterialIcons
                            name="savings"
                            size={18}
                            color={isGoalFunded ? tokens.finance : tokens.wish}
                          />
                        </View>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 15,
                            fontWeight: "800",
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          Linked Savings Goal
                        </Text>
                      </View>

                      {savingsGoal ? (
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 999,
                            backgroundColor: isGoalFunded ? tokens.financeSoft : tokens.muted,
                          }}
                        >
                          <Text
                            style={{
                              color: isGoalFunded ? tokens.finance : tokens.mutedForeground,
                              fontSize: 11,
                              fontWeight: "800",
                              fontFamily: "Plus Jakarta Sans",
                            }}
                          >
                            {isGoalFunded ? "Goal 100% Funded!" : `${savingsPct}% Saved`}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {savingsGoal ? (
                      <View style={{ gap: 10 }}>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 16,
                            fontWeight: "700",
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          {savingsGoal.name}
                        </Text>

                        {/* Amount Metrics */}
                        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                          <Text
                            style={{
                              color: tokens.mutedForeground,
                              fontSize: 12,
                              fontWeight: "600",
                              fontFamily: "Plus Jakarta Sans",
                            }}
                          >
                            Saved:{" "}
                            <Text style={{ color: tokens.foreground, fontWeight: "800", fontFamily: "JetBrains Mono" }}>
                              {formatCurrency(savingsGoal.current_amount, currency)}
                            </Text>
                          </Text>
                          <Text
                            style={{
                              color: tokens.mutedForeground,
                              fontSize: 12,
                              fontWeight: "600",
                              fontFamily: "Plus Jakarta Sans",
                            }}
                          >
                            Target:{" "}
                            <Text style={{ color: tokens.wish, fontWeight: "800", fontFamily: "JetBrains Mono" }}>
                              {formatCurrency(savingsGoal.target_amount, currency)}
                            </Text>
                          </Text>
                        </View>

                        {/* Progress Bar */}
                        <View
                          style={{
                            height: 10,
                            borderRadius: 999,
                            backgroundColor: tokens.muted,
                            overflow: "hidden",
                          }}
                        >
                          <View
                            style={{
                              width: `${Math.min(100, Math.max(0, savingsPct))}%`,
                              height: "100%",
                              borderRadius: 999,
                              backgroundColor: isGoalFunded ? tokens.finance : tokens.wish,
                            }}
                          />
                        </View>
                      </View>
                    ) : (
                      <View style={{ gap: 10, paddingVertical: 8 }}>
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 13,
                            lineHeight: 18,
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          No dedicated savings goal is linked to this wish. Link one in Edit Wish to track your target reserve.
                        </Text>
                        <Button
                          label="Link a Savings Goal"
                          variant="outline"
                          size="sm"
                          icon={<MaterialIcons name="link" size={14} color={tokens.foreground} />}
                          onPress={handleOpenEditModal}
                          style={{ alignSelf: "flex-start" }}
                        />
                      </View>
                    )}
                  </Card>

                  {/* Fulfillment Summary Card */}
                  <Card
                    style={{
                      flex: 1,
                      padding: 20,
                      borderRadius: tokens.radiusCard,
                      borderColor: isGranted ? tokens.finance : tokens.border,
                      backgroundColor: tokens.card,
                      gap: 14,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: isGranted ? tokens.financeSoft : tokens.muted,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialIcons
                          name={isGranted ? "receipt-long" : "auto-awesome"}
                          size={18}
                          color={isGranted ? tokens.finance : tokens.mutedForeground}
                        />
                      </View>
                      <Text
                        style={{
                          color: tokens.foreground,
                          fontSize: 15,
                          fontWeight: "800",
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      >
                        Fulfillment Status
                      </Text>
                    </View>

                    {isGranted ? (
                      <View style={{ gap: 10 }}>
                        <View
                          style={{
                            padding: 12,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: tokens.financeSoft,
                            borderWidth: 1,
                            borderColor: `${tokens.finance}40`,
                            gap: 4,
                          }}
                        >
                          <Text
                            style={{
                              color: tokens.finance,
                              fontSize: 13,
                              fontWeight: "800",
                              fontFamily: "Plus Jakarta Sans",
                            }}
                          >
                            Granted on {formatDate(wish.granted_at)}
                          </Text>
                          <Text
                            style={{
                              color: tokens.mutedForeground,
                              fontSize: 12,
                              fontFamily: "Plus Jakarta Sans",
                            }}
                          >
                            This wish has been achieved and celebrated!
                          </Text>
                        </View>

                        {/* Linked Expense Transaction */}
                        {wish.fulfilled_transaction ? (
                          <View
                            style={{
                              padding: 12,
                              borderRadius: tokens.radiusControl,
                              backgroundColor: tokens.muted,
                              borderWidth: 1,
                              borderColor: tokens.border,
                              gap: 6,
                            }}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                              <Text
                                style={{
                                  color: tokens.mutedForeground,
                                  fontSize: 11,
                                  fontWeight: "700",
                                  textTransform: "uppercase",
                                  letterSpacing: 0.6,
                                  fontFamily: "Plus Jakarta Sans",
                                }}
                              >
                                Expense Logged in Finances
                              </Text>
                              <Text
                                style={{
                                  color: tokens.destructive,
                                  fontSize: 14,
                                  fontWeight: "800",
                                  fontFamily: "JetBrains Mono",
                                }}
                              >
                                - {formatCurrency(wish.fulfilled_transaction.amount, currency)}
                              </Text>
                            </View>
                            <Text
                              style={{
                                color: tokens.foreground,
                                fontSize: 13,
                                fontWeight: "700",
                                fontFamily: "Plus Jakarta Sans",
                              }}
                            >
                              Paid from: {wish.fulfilled_transaction.account_name}
                            </Text>
                            <Text
                              style={{
                                color: tokens.mutedForeground,
                                fontSize: 11,
                                fontFamily: "Plus Jakarta Sans",
                              }}
                            >
                              Date: {formatDate(wish.fulfilled_transaction.transaction_date)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <View style={{ gap: 12, paddingVertical: 4 }}>
                        <Text
                          style={{
                            color: tokens.mutedForeground,
                            fontSize: 13,
                            lineHeight: 18,
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          Ready to grant this wish? Fulfilling allows you to mark it complete and optionally record an expense transaction in Finances to deduct your wallet balance.
                        </Text>

                        {/* Assigned Paying Account */}
                        {wish.account ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                              padding: 12,
                              borderRadius: tokens.radiusControl,
                              backgroundColor: tokens.muted,
                              borderWidth: 1,
                              borderColor: tokens.border,
                            }}
                          >
                            <View
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                backgroundColor: tokens.financeSoft,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <MaterialIcons
                                name={(wish.account.icon || "account-balance-wallet") as any}
                                size={16}
                                color={tokens.finance}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  color: tokens.mutedForeground,
                                  fontSize: 10,
                                  fontWeight: "700",
                                  textTransform: "uppercase",
                                  letterSpacing: 0.5,
                                  fontFamily: "Plus Jakarta Sans",
                                }}
                              >
                                Assigned Paying Account
                              </Text>
                              <Text
                                style={{
                                  color: tokens.foreground,
                                  fontSize: 13,
                                  fontWeight: "700",
                                  fontFamily: "Plus Jakarta Sans",
                                }}
                              >
                                {wish.account.name} ·{" "}
                                <Text style={{ fontFamily: "JetBrains Mono" }}>
                                  {formatCurrency(wish.account.balance, currency)}
                                </Text>
                              </Text>
                            </View>
                          </View>
                        ) : null}

                        <Button
                          label="Confirm & Fulfill Wish"
                          variant="primary"
                          size="md"
                          icon={<MaterialIcons name="auto-awesome" size={16} color={tokens.primaryForeground} />}
                          onPress={handleOpenFulfillModal}
                          style={{ backgroundColor: tokens.finance, borderColor: tokens.finance }}
                        />
                      </View>
                    )}
                  </Card>
                </View>
              </Animated.View>

              {/* ROW 3: Linked DOOs (Action Steps) Checklist */}
              <Animated.View style={doosEntrance}>
                <Card
                  style={{
                    padding: 20,
                    borderRadius: tokens.radiusCard,
                    borderColor: tokens.border,
                    backgroundColor: tokens.card,
                    gap: 16,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: `${tokens.doo}18`,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialIcons name="checklist" size={18} color={tokens.doo} />
                      </View>
                      <Text
                        style={{
                          color: tokens.foreground,
                          fontSize: 15,
                          fontWeight: "800",
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      >
                        Linked Action Steps (DOOs)
                      </Text>
                    </View>

                    <Text
                      style={{
                        color: tokens.doo,
                        fontSize: 12,
                        fontWeight: "800",
                        fontFamily: "JetBrains Mono",
                      }}
                    >
                      {wish.linked_doos.length} Linked Task{wish.linked_doos.length === 1 ? "" : "s"}
                    </Text>
                  </View>

                  {wish.linked_doos.length === 0 ? (
                    <View
                      style={{
                        padding: 16,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: tokens.muted,
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: tokens.foreground,
                          fontSize: 13,
                          fontWeight: "700",
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      >
                        No action steps linked to this wish yet.
                      </Text>
                      <Text
                        style={{
                          color: tokens.mutedForeground,
                          fontSize: 12,
                          textAlign: "center",
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      >
                        You can link actionable DOO tasks and checklists to this wish in Screen 8 (DOOs Manager).
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      {wish.linked_doos.map((doo) => (
                        <View
                          key={doo.id}
                          style={{
                            padding: 14,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: tokens.muted,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            gap: 10,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                              <MaterialIcons
                                name={doo.status === "completed" ? "check-circle" : "radio-button-unchecked"}
                                size={16}
                                color={doo.status === "completed" ? tokens.finance : tokens.mutedForeground}
                              />
                              <Text
                                style={{
                                  color: tokens.foreground,
                                  fontSize: 14,
                                  fontWeight: "800",
                                  fontFamily: "Plus Jakarta Sans",
                                  textDecorationLine: doo.status === "completed" ? "line-through" : "none",
                                }}
                              >
                                {doo.title}
                              </Text>
                            </View>

                            {doo.due_date ? (
                              <Text
                                style={{
                                  color: tokens.mutedForeground,
                                  fontSize: 11,
                                  fontFamily: "Plus Jakarta Sans",
                                }}
                              >
                                Due {formatDate(doo.due_date)}
                              </Text>
                            ) : null}
                          </View>

                          {/* Nested Subtasks Checklist */}
                          {doo.subtasks && doo.subtasks.length > 0 ? (
                            <View style={{ gap: 6, paddingLeft: 22 }}>
                              {doo.subtasks.map((st) => (
                                <View key={st.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  <MaterialIcons
                                    name={st.is_completed ? "check-box" : "check-box-outline-blank"}
                                    size={14}
                                    color={st.is_completed ? tokens.finance : tokens.mutedForeground}
                                  />
                                  <Text
                                    style={{
                                      color: tokens.foreground,
                                      fontSize: 12,
                                      fontFamily: "Plus Jakarta Sans",
                                      textDecorationLine: st.is_completed ? "line-through" : "none",
                                      opacity: st.is_completed ? 0.7 : 1,
                                    }}
                                  >
                                    {st.title}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              </Animated.View>
            </View>
          )}
        </View>

        {/* Modal: Confirm & Fulfill Wish (Explicit Save & Confirm) */}
        {showFulfillModal && wish ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                zIndex: 120,
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                ...(Platform.OS === "web" ? ({ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 } as any) : {}),
              },
            ]}
          >
            {/* Soft dismissable overlay */}
            <Pressable
              accessibilityLabel="Close Fulfill Modal"
              onPress={() => !isSubmittingFulfill && setShowFulfillModal(false)}
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDark ? "rgba(15, 23, 42, 0.45)" : "rgba(100, 116, 139, 0.3)",
                },
              ]}
            />

            {/* Bounded Gray Backing Panel that doesn't use all the screen */}
            <View
              style={[
                {
                  width: "100%",
                  maxWidth: 536,
                  maxHeight: "90%",
                  borderRadius: tokens.radiusCard + 6,
                  backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
                  padding: 8,
                  borderWidth: 1,
                  borderColor: isDark ? "#334155" : "#CBD5E1",
                  zIndex: 121,
                },
                Platform.OS === "web"
                  ? ({
                      boxShadow: isDark
                        ? "0 24px 50px -12px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255, 255, 255, 0.08)"
                        : "0 20px 40px -12px rgba(15, 23, 42, 0.2), 0 0 1px 1px rgba(15, 23, 42, 0.08)",
                    } as any)
                  : null,
              ]}
            >
              <Animated.View
                style={[
                  { transform: [{ translateX: errorShake.translateX }] },
                  {
                    width: "100%",
                    maxHeight: "100%",
                    borderRadius: tokens.radiusCard,
                    backgroundColor: tokens.card,
                    borderWidth: 1,
                    borderColor: tokens.finance,
                    padding: 24,
                    gap: 16,
                  },
                ]}
              >
              {/* Modal Header */}
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
                    <MaterialIcons name="auto-awesome" size={18} color={tokens.finance} />
                  </View>
                  <Text
                    style={{
                      color: tokens.foreground,
                      fontSize: 18,
                      fontWeight: "800",
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  >
                    Confirm & Fulfill Wish
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => !isSubmittingFulfill && setShowFulfillModal(false)}
                  style={Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null}
                >
                  <MaterialIcons name="close" size={20} color={tokens.mutedForeground} />
                </Pressable>
              </View>

              <Text
                style={{
                  color: tokens.mutedForeground,
                  fontSize: 13,
                  lineHeight: 18,
                  fontFamily: "Plus Jakarta Sans",
                }}
              >
                Marking "{wish.title}" as fulfilled celebrates its achievement. You can also record an expense to deduct funds from your account.
              </Text>

              {fulfillError ? (
                <View
                  style={{
                    padding: 10,
                    borderRadius: tokens.radiusControl,
                    backgroundColor: `${tokens.destructive}20`,
                    borderWidth: 1,
                    borderColor: tokens.destructive,
                  }}
                >
                  <Text
                    style={{
                      color: tokens.destructive,
                      fontSize: 12,
                      fontWeight: "700",
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  >
                    {fulfillError}
                  </Text>
                </View>
              ) : null}

              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 14 }}>
                  {/* Expense Toggle */}
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: fulfillRecordExpense }}
                    onPress={() => setFulfillRecordExpense(!fulfillRecordExpense)}
                    style={[
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        padding: 12,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: fulfillRecordExpense ? tokens.financeSoft : tokens.muted,
                        borderWidth: 1,
                        borderColor: fulfillRecordExpense ? tokens.finance : tokens.border,
                      },
                      Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                    ]}
                  >
                    <MaterialIcons
                      name={fulfillRecordExpense ? "check-box" : "check-box-outline-blank"}
                      size={20}
                      color={fulfillRecordExpense ? tokens.finance : tokens.mutedForeground}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: tokens.foreground,
                          fontSize: 13,
                          fontWeight: "800",
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      >
                        Log as an expense in Finances
                      </Text>
                      <Text
                        style={{
                          color: tokens.mutedForeground,
                              fontSize: 11,
                              fontFamily: "Plus Jakarta Sans",
                        }}
                      >
                        Atomically creates an expense transaction and deducts your wallet balance.
                      </Text>
                    </View>
                  </Pressable>

                  {fulfillRecordExpense ? (
                    <View style={{ gap: 12 }}>
                      {/* Account Selector */}
                      <View style={{ gap: 6 }}>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 12,
                            fontWeight: "700",
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          Paying Account *
                        </Text>
                        <View style={{ gap: 6 }}>
                          {accounts.length === 0 ? (
                            <Text style={{ color: tokens.warning, fontSize: 12 }}>
                              No accounts found in this workspace. Create one in Finances first.
                            </Text>
                          ) : (
                            accounts.map((acc) => {
                              const isSelected = fulfillAccountId === acc.id;
                              return (
                                <Pressable
                                  key={acc.id}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Pay from ${acc.name}`}
                                  onPress={() => setFulfillAccountId(acc.id)}
                                  style={[
                                    {
                                      flexDirection: "row",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      padding: 10,
                                      borderRadius: tokens.radiusControl,
                                      backgroundColor: isSelected ? `${tokens.finance}18` : tokens.muted,
                                      borderWidth: 1,
                                      borderColor: isSelected ? tokens.finance : tokens.border,
                                    },
                                    Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                                  ]}
                                >
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <MaterialIcons
                                      name={isSelected ? "radio-button-checked" : "radio-button-unchecked"}
                                      size={16}
                                      color={isSelected ? tokens.finance : tokens.mutedForeground}
                                    />
                                    <Text
                                      style={{
                                        color: tokens.foreground,
                                        fontSize: 13,
                                        fontWeight: isSelected ? "800" : "600",
                                        fontFamily: "Plus Jakarta Sans",
                                      }}
                                    >
                                      {acc.name}
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
                                    {formatCurrency(acc.balance, currency)}
                                  </Text>
                                </Pressable>
                              );
                            })
                          )}
                        </View>
                      </View>

                      {/* Expense Amount */}
                      <View style={{ gap: 6 }}>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 12,
                            fontWeight: "700",
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          Expense Amount ({currency}) *
                        </Text>
                        <TextInput
                          accessibilityLabel="Expense Amount"
                          value={fulfillAmount}
                          onChangeText={setFulfillAmount}
                          placeholder="0.00"
                          placeholderTextColor={tokens.mutedForeground}
                          keyboardType="numeric"
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: tokens.muted,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            color: tokens.foreground,
                            fontSize: 15,
                            fontFamily: "JetBrains Mono",
                          }}
                        />
                      </View>

                      {/* Description */}
                      <View style={{ gap: 6 }}>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 12,
                            fontWeight: "700",
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          Transaction Description
                        </Text>
                        <TextInput
                          accessibilityLabel="Transaction Description"
                          value={fulfillDescription}
                          onChangeText={setFulfillDescription}
                          placeholder="Fulfilled Wish..."
                          placeholderTextColor={tokens.mutedForeground}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: tokens.muted,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            color: tokens.foreground,
                            fontSize: 13,
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={{ padding: 4, marginHorizontal: -4, marginTop: 4, backgroundColor: "transparent" }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                  <Button
                    label="Cancel"
                    variant="ghost"
                    size="md"
                    disabled={isSubmittingFulfill}
                    onPress={() => setShowFulfillModal(false)}
                  />
                  <Button
                    label="Save & Confirm Fulfillment"
                    variant="primary"
                    size="md"
                    loading={isSubmittingFulfill}
                    icon={<MaterialIcons name="check" size={16} color={tokens.primaryForeground} />}
                    onPress={handleConfirmFulfill}
                    style={{ backgroundColor: tokens.finance, borderColor: tokens.finance }}
                  />
                </View>
              </View>
              </Animated.View>
            </View>
          </View>
        ) : null}

        {/* Modal: Edit Wish (Explicit Save & Confirm) */}
        {showEditModal && wish ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                zIndex: 120,
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                ...(Platform.OS === "web" ? ({ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 } as any) : {}),
              },
            ]}
          >
            {/* Soft dismissable overlay */}
            <Pressable
              accessibilityLabel="Close Edit Modal"
              onPress={() => !isSubmittingEdit && setShowEditModal(false)}
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDark ? "rgba(15, 23, 42, 0.45)" : "rgba(100, 116, 139, 0.3)",
                },
              ]}
            />

            {/* Bounded Gray Backing Panel that doesn't use all the screen */}
            <View
              style={[
                {
                  width: "100%",
                  maxWidth: 536,
                  maxHeight: "90%",
                  borderRadius: tokens.radiusCard + 6,
                  backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
                  padding: 8,
                  borderWidth: 1,
                  borderColor: isDark ? "#334155" : "#CBD5E1",
                  zIndex: 121,
                },
                Platform.OS === "web"
                  ? ({
                      boxShadow: isDark
                        ? "0 24px 50px -12px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255, 255, 255, 0.08)"
                        : "0 20px 40px -12px rgba(15, 23, 42, 0.2), 0 0 1px 1px rgba(15, 23, 42, 0.08)",
                    } as any)
                  : null,
              ]}
            >
              <Animated.View
                style={[
                  { transform: [{ translateX: errorShake.translateX }] },
                  {
                    width: "100%",
                    maxHeight: "100%",
                    borderRadius: tokens.radiusCard,
                    backgroundColor: tokens.card,
                    borderWidth: 1,
                    borderColor: tokens.wish,
                    padding: 24,
                    gap: 16,
                  },
                ]}
              >
              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text
                  style={{
                    color: tokens.foreground,
                    fontSize: 18,
                    fontWeight: "800",
                    fontFamily: "Plus Jakarta Sans",
                  }}
                >
                  Edit Wish
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => !isSubmittingEdit && setShowEditModal(false)}
                  style={Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null}
                >
                  <MaterialIcons name="close" size={20} color={tokens.mutedForeground} />
                </Pressable>
              </View>

              {editError ? (
                <View
                  style={{
                    padding: 10,
                    borderRadius: tokens.radiusControl,
                    backgroundColor: `${tokens.destructive}20`,
                    borderWidth: 1,
                    borderColor: tokens.destructive,
                  }}
                >
                  <Text
                    style={{
                      color: tokens.destructive,
                      fontSize: 12,
                      fontWeight: "700",
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  >
                    {editError}
                  </Text>
                </View>
              ) : null}

              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 12 }}>
                  {/* Title */}
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>Title *</Text>
                    <TextInput
                      accessibilityLabel="Wish Title"
                      value={editTitle}
                      onChangeText={setEditTitle}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: tokens.muted,
                        borderWidth: 1,
                        borderColor: tokens.border,
                        color: tokens.foreground,
                        fontSize: 14,
                        fontFamily: "Plus Jakarta Sans",
                      }}
                    />
                  </View>

                  {/* Estimated Price */}
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>Estimated Price</Text>
                    <TextInput
                      accessibilityLabel="Estimated Price"
                      value={editPrice}
                      onChangeText={setEditPrice}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={tokens.mutedForeground}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: tokens.muted,
                        borderWidth: 1,
                        borderColor: tokens.border,
                        color: tokens.foreground,
                        fontSize: 14,
                        fontFamily: "JetBrains Mono",
                      }}
                    />
                  </View>

                  {/* Priority Selector */}
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>Priority</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {(["low", "medium", "high"] as const).map((p) => {
                        const isSelected = editPriority === p;
                        return (
                          <Pressable
                            key={p}
                            accessibilityRole="button"
                            accessibilityLabel={`Set priority ${p}`}
                            onPress={() => setEditPriority(p)}
                            style={[
                              {
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: tokens.radiusControl,
                                backgroundColor: isSelected ? tokens.primary : tokens.muted,
                                alignItems: "center",
                                justifyContent: "center",
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <Text
                              style={{
                                color: isSelected ? tokens.primaryForeground : tokens.foreground,
                                fontSize: 12,
                                fontWeight: "800",
                                textTransform: "capitalize",
                              }}
                            >
                              {p}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Category Selector */}
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>Category</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {categories.map((c) => {
                        const isSelected = editCatId === c.id;
                        return (
                          <Pressable
                            key={c.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Select category ${c.name}`}
                            onPress={() => setEditCatId(isSelected ? "" : c.id)}
                            style={[
                              {
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 999,
                                backgroundColor: isSelected ? tokens.primary : tokens.muted,
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <Text
                              style={{
                                color: isSelected ? tokens.primaryForeground : tokens.foreground,
                                fontSize: 11,
                                fontWeight: "700",
                              }}
                            >
                              {c.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Savings Goal Selector */}
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>Linked Savings Goal (Optional)</Text>
                    <View style={{ gap: 6 }}>
                      {savingsGoals.map((sg) => {
                        const isSelected = editGoalId === sg.id;
                        return (
                          <Pressable
                            key={sg.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Link goal ${sg.name}`}
                            onPress={() => setEditGoalId(isSelected ? "" : sg.id)}
                            style={[
                              {
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: 8,
                                borderRadius: tokens.radiusControl,
                                backgroundColor: isSelected ? `${tokens.wish}18` : tokens.muted,
                                borderWidth: 1,
                                borderColor: isSelected ? tokens.wish : tokens.border,
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>{sg.name}</Text>
                            <Text style={{ color: tokens.wish, fontSize: 12, fontFamily: "JetBrains Mono" }}>
                              {formatCurrency(sg.target_amount, currency)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Account Selector */}
                  {accounts.length > 0 ? (
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>Linked Paying Account (Optional)</Text>
                      <View style={{ gap: 6 }}>
                        {accounts.map((acc) => {
                          const isSelected = editAccountId === acc.id;
                          return (
                            <Pressable
                              key={acc.id}
                              accessibilityRole="button"
                              accessibilityLabel={`Link account ${acc.name}`}
                              onPress={() => setEditAccountId(isSelected ? "" : acc.id)}
                              style={[
                                {
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: 8,
                                  borderRadius: tokens.radiusControl,
                                  backgroundColor: isSelected ? `${tokens.finance}18` : tokens.muted,
                                  borderWidth: 1,
                                  borderColor: isSelected ? tokens.finance : tokens.border,
                                },
                                Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                              ]}
                            >
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <MaterialIcons name="account-balance-wallet" size={14} color={isSelected ? tokens.finance : tokens.mutedForeground} />
                                <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>{acc.name}</Text>
                              </View>
                              <Text style={{ color: tokens.finance, fontSize: 12, fontFamily: "JetBrains Mono" }}>
                                {formatCurrency(acc.balance, currency)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {/* DOO Tasks Link Selector */}
                  {availableDoos.length > 0 ? (
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>Linked Action Steps (DOOs)</Text>
                      <View style={{ gap: 6 }}>
                        {availableDoos.map((doo) => {
                          const isSelected = editSelectedDooIds.includes(doo.id);
                          return (
                            <Pressable
                              key={doo.id}
                              accessibilityRole="button"
                              accessibilityLabel={`Link DOO task ${doo.title}`}
                              onPress={() => {
                                if (isSelected) {
                                  setEditSelectedDooIds(editSelectedDooIds.filter((id) => id !== doo.id));
                                } else {
                                  setEditSelectedDooIds([...editSelectedDooIds, doo.id]);
                                }
                              }}
                              style={[
                                {
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: 8,
                                  borderRadius: tokens.radiusControl,
                                  backgroundColor: isSelected ? `${tokens.doo}18` : tokens.muted,
                                  borderWidth: 1,
                                  borderColor: isSelected ? tokens.doo : tokens.border,
                                },
                                Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                              ]}
                            >
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <MaterialIcons
                                  name={isSelected ? "check-box" : "check-box-outline-blank"}
                                  size={16}
                                  color={isSelected ? tokens.doo : tokens.mutedForeground}
                                />
                                <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>{doo.title}</Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {/* External URL */}
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>Product / Inspiration URL</Text>
                    <TextInput
                      accessibilityLabel="Product URL"
                      value={editUrl}
                      onChangeText={setEditUrl}
                      placeholder="https://..."
                      placeholderTextColor={tokens.mutedForeground}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: tokens.muted,
                        borderWidth: 1,
                        borderColor: tokens.border,
                        color: tokens.foreground,
                        fontSize: 13,
                      }}
                    />
                  </View>

                  {/* Notes */}
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>Personal Notes</Text>
                    <TextInput
                      accessibilityLabel="Personal Notes"
                      value={editNotes}
                      onChangeText={setEditNotes}
                      multiline
                      numberOfLines={3}
                      placeholder="Notes, size, color, motivation..."
                      placeholderTextColor={tokens.mutedForeground}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: tokens.muted,
                        borderWidth: 1,
                        borderColor: tokens.border,
                        color: tokens.foreground,
                        fontSize: 13,
                        minHeight: 70,
                      }}
                    />
                  </View>

                  {/* Image Uploader (Sanitized WebP via Backend Pillow) */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>Hero Image</Text>
                    {editImagePreview ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Image
                          source={{ uri: editImagePreview }}
                          alt="Edited wish preview image"
                          accessibilityLabel="Edited wish preview image"
                          style={{ width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: tokens.border }}
                        />
                        <Button
                          label="Change Image"
                          variant="outline"
                          size="sm"
                          loading={isUploadingImage}
                          onPress={handlePickImageWeb}
                        />
                        <Button
                          label="Remove"
                          variant="ghost"
                          size="sm"
                          onPress={() => {
                            setEditImageKey("");
                            setEditImagePreview(null);
                          }}
                        />
                      </View>
                    ) : (
                      <Button
                        label="Upload Image (EXIF Stripped)"
                        variant="outline"
                        size="sm"
                        loading={isUploadingImage}
                        icon={<MaterialIcons name="add-photo-alternate" size={16} color={tokens.foreground} />}
                        onPress={handlePickImageWeb}
                      />
                    )}
                  </View>
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={{ padding: 4, marginHorizontal: -4, marginTop: 4, backgroundColor: "transparent" }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                  <Button
                    label="Cancel"
                    variant="ghost"
                    size="md"
                    disabled={isSubmittingEdit}
                    onPress={() => setShowEditModal(false)}
                  />
                  <Button
                    label="Save Changes"
                    variant="primary"
                    size="md"
                    loading={isSubmittingEdit}
                    onPress={handleConfirmEditWish}
                    style={{ backgroundColor: tokens.wish, borderColor: tokens.wish }}
                  />
                </View>
              </View>
              </Animated.View>
            </View>
          </View>
        ) : null}

        {/* Modal: Confirm Deletion */}
        {showDeleteModal && wish ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                zIndex: 130,
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                ...(Platform.OS === "web" ? ({ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 } as any) : {}),
              },
            ]}
          >
            <Pressable
              accessibilityLabel="Close Delete Modal"
              onPress={() => !isDeleting && setShowDeleteModal(false)}
              style={StyleSheet.absoluteFill}
            />

            <View
              style={{
                width: "100%",
                maxWidth: 440,
                borderRadius: tokens.radiusCard,
                backgroundColor: tokens.card,
                borderWidth: 1,
                borderColor: tokens.destructive,
                padding: 24,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    backgroundColor: `${tokens.destructive}20`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcons name="delete" size={18} color={tokens.destructive} />
                </View>
                <Text
                  style={{
                    color: tokens.foreground,
                    fontSize: 18,
                    fontWeight: "800",
                    fontFamily: "Plus Jakarta Sans",
                  }}
                >
                  Delete Wish?
                </Text>
              </View>

              <Text
                style={{
                  color: tokens.mutedForeground,
                  fontSize: 13,
                  lineHeight: 18,
                  fontFamily: "Plus Jakarta Sans",
                }}
              >
                Are you sure you want to delete "{wish.title}"? You will be able to undo this action within 5 seconds.
              </Text>

              <View style={{ padding: 4, marginHorizontal: -4, marginTop: 4, backgroundColor: "transparent" }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                  <Button
                    label="Cancel"
                    variant="ghost"
                    size="md"
                    disabled={isDeleting}
                    onPress={() => setShowDeleteModal(false)}
                  />
                  <Button
                    label="Confirm Delete"
                    variant="primary"
                    size="md"
                    loading={isDeleting}
                    onPress={handleConfirmDelete}
                    style={{ backgroundColor: tokens.destructive, borderColor: tokens.destructive }}
                  />
                </View>
              </View>
            </View>
          </View>
        ) : null}
      </AdaptiveShell>
    </View>
  );
}
