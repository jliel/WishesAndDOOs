import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Modal,
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
import { useRouter } from "expo-router";

import { useAppTheme } from "@/theme/ThemeProvider";
import { AmbientMeshBackground } from "@/components/ui/AmbientMeshBackground";
import { AdaptiveShell } from "@/components/layout/AdaptiveShell";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Card } from "@/components/ui/Card";
import { TimedNotice } from "@/components/ui/TimedNotice";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAuthStore } from "@/store/authStore";
import { loginWithEmail, logoutAuthSession } from "@/api/auth";
import {
  createWish,
  deleteWish,
  fetchWishes,
  updateWish,
  uploadWishImage,
  WishItem,
  WishesListResponse,
} from "@/api/wishes";
import { fetchFinancesOverview, FinanceAccount, FinanceCategory, FinanceSavingsGoal } from "@/api/finances";
import { fetchDoos, DooItem } from "@/api/doos";
import {
  useErrorShake,
  useInteractiveMotion,
  usePulseScale,
  useStaggerEntrance,
} from "@/lib/motion";

const DEMO_EMAIL = "demo@wishesanddoos.app";
const DEMO_PASSWORD = "DemoPassword123!";

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
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${prefix}${absFormatted}` : `${prefix}${absFormatted}`;
}

type PriorityKey = "all" | "high" | "medium" | "low";
type StatusKey = "all" | "active" | "granted";

interface PriorityBadgeProps {
  priority: "low" | "medium" | "high";
}

function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { tokens } = useAppTheme();
  const config = {
    high: { label: "High", color: tokens.destructive, bg: `${tokens.destructive}18` },
    medium: { label: "Medium", color: tokens.wish, bg: tokens.wishSoft },
    low: { label: "Low", color: tokens.doo, bg: tokens.dooSoft },
  }[priority] || { label: priority, color: tokens.mutedForeground, bg: tokens.muted };

  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: config.bg,
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
      }}
    >
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          backgroundColor: config.color,
        }}
      />
      <Text
        style={{
          color: config.color,
          fontSize: 10,
          fontWeight: "800",
          fontFamily: "Plus Jakarta Sans",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {config.label}
      </Text>
    </View>
  );
}

interface FilterPillProps {
  label: string;
  icon?: React.ComponentProps<typeof MaterialIcons>["name"];
  isSelected: boolean;
  onSelect: () => void;
  count?: number;
}

function FilterPill({ label, icon, isSelected, onSelect, count }: FilterPillProps) {
  const { tokens } = useAppTheme();
  const motion = useInteractiveMotion({
    hoverScale: 1.03,
    hoverLift: -1.5,
    pressScale: 0.96,
  });

  return (
    <Animated.View style={motion.animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`Filter: ${label}`}
        onPress={onSelect}
        onHoverIn={motion.onHoverIn}
        onHoverOut={motion.onHoverOut}
        onPressIn={motion.onPressIn}
        onPressOut={motion.onPressOut}
        style={[
          {
            minHeight: 36,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: isSelected
              ? tokens.wish
              : motion.isHovered
              ? tokens.wishSoft
              : tokens.card,
            borderWidth: 1,
            borderColor: isSelected
              ? tokens.wish
              : motion.isHovered
              ? `${tokens.wish}88`
              : tokens.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          },
          Platform.OS === "web"
            ? ({
                cursor: "pointer",
                transition: "background-color 160ms ease, border-color 160ms ease",
              } as any)
            : null,
        ]}
      >
        {icon ? (
          <MaterialIcons
            name={icon}
            size={14}
            color={isSelected ? tokens.primaryForeground : motion.isHovered ? tokens.wish : tokens.mutedForeground}
          />
        ) : null}
        <Text
          style={{
            color: isSelected
              ? tokens.primaryForeground
              : motion.isHovered
              ? tokens.wish
              : tokens.foreground,
            fontSize: 12,
            fontWeight: isSelected ? "800" : "600",
            fontFamily: "Plus Jakarta Sans",
          }}
        >
          {label}
        </Text>
        {count !== undefined ? (
          <View
            style={{
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: 999,
              backgroundColor: isSelected
                ? "rgba(255, 255, 255, 0.25)"
                : tokens.muted,
            }}
          >
            <Text
              style={{
                color: isSelected ? tokens.primaryForeground : tokens.mutedForeground,
                fontSize: 10,
                fontWeight: "700",
                fontFamily: "JetBrains Mono",
              }}
            >
              {count}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

interface WishCardProps {
  wish: WishItem;
  currency: string;
  onToggleStatus: (wish: WishItem) => void;
  onEdit: (wish: WishItem) => void;
  onDelete: (wish: WishItem) => void;
  onOpenDetail: (wish: WishItem) => void;
  isDesktop: boolean;
  grantLabel: string;
  grantedLabel: string;
}

function WishCard({
  wish,
  currency,
  onToggleStatus,
  onEdit,
  onDelete,
  onOpenDetail,
  isDesktop,
  grantLabel,
  grantedLabel,
}: WishCardProps) {
  const { tokens, colorMode } = useAppTheme();
  const isDark = colorMode === "dark";
  const motion = useInteractiveMotion({
    hoverScale: 1.018,
    hoverLift: -3,
    pressScale: 0.982,
  });

  const isGranted = wish.status === "granted";
  const savingsPct = wish.savings_goal?.progress_percent ?? 0;
  const isGoalFunded = savingsPct >= 100;

  return (
    <Animated.View style={[{ width: "100%", height: "100%" }, motion.animatedStyle]}>
      <Card
        style={[
          {
            padding: 0,
            borderRadius: tokens.radiusCard,
            borderColor: isGranted ? tokens.finance : tokens.border,
            borderWidth: 1,
            backgroundColor: tokens.card,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
          },
          Platform.OS === "web"
            ? ({
                cursor: "pointer",
                transition: "all 180ms cubic-bezier(0.16, 1, 0.3, 1)",
                boxShadow: motion.isHovered
                  ? isDark
                    ? "0 14px 28px -4px rgba(0, 0, 0, 0.65), 0 0 14px rgba(124, 58, 237, 0.22)"
                    : "0 14px 28px -4px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(124, 58, 237, 0.08)"
                  : isDark
                  ? "0 4px 14px rgba(0, 0, 0, 0.35)"
                  : "0 4px 14px rgba(15, 23, 42, 0.06)",
              } as any)
            : null,
        ]}
      >
        {/* Top Cover / Thumbnail Banner (Clicking opens wish details) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open details for ${wish.title}`}
          onPress={() => onOpenDetail(wish)}
          style={[
            {
              position: "relative",
              width: "100%",
              height: 125,
              backgroundColor: isDark ? "#172033" : "#F1F5F9",
              overflow: "hidden",
            },
            Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
          ]}
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
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
              }}
            >
              <MaterialIcons name="auto-awesome" size={32} color={tokens.wish} />
            </View>
          )}

          {/* Floating Top Left: Category Badge */}
          <View style={{ position: "absolute", top: 8, left: 8, flexDirection: "row", gap: 6 }}>
            {wish.category_name ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: tokens.card,
                  borderWidth: 1,
                  borderColor: tokens.border,
                }}
              >
                <MaterialIcons name="folder-open" size={11} color={tokens.mutedForeground} />
                <Text
                  style={{
                    color: tokens.foreground,
                    fontSize: 10,
                    fontWeight: "700",
                    fontFamily: "Plus Jakarta Sans",
                  }}
                >
                  {wish.category_name}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Floating Top Right: Priority Badge */}
          <View style={{ position: "absolute", top: 8, right: 8 }}>
            <PriorityBadge priority={wish.priority} />
          </View>
        </Pressable>

        {/* Card Content Body */}
        <View style={{ padding: 14, gap: 10, flex: 1, justifyContent: "space-between" }}>
          <View style={{ gap: 6 }}>
            {/* Title */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View details for ${wish.title}`}
              onPress={() => onOpenDetail(wish)}
              style={Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null}
            >
              <Text
                numberOfLines={2}
                style={{
                  color: tokens.foreground,
                  fontSize: 15,
                  fontWeight: "800",
                  letterSpacing: -0.2,
                  fontFamily: "Plus Jakarta Sans",
                  textDecorationLine: isGranted ? "line-through" : "none",
                  opacity: isGranted ? 0.75 : 1,
                  lineHeight: 20,
                }}
              >
                {wish.title}
              </Text>
            </Pressable>

            {/* Price */}
            {wish.estimated_price !== null && wish.estimated_price !== undefined ? (
              <Text
                style={{
                  color: tokens.wish,
                  fontSize: 17,
                  fontWeight: "900",
                  fontFamily: "JetBrains Mono",
                  letterSpacing: -0.4,
                }}
              >
                {formatCurrency(wish.estimated_price, currency)}
              </Text>
            ) : null}

            {/* Linked Savings Goal (Compact) */}
            {wish.savings_goal ? (
              <View
                style={{
                  padding: 8,
                  borderRadius: tokens.radiusControl,
                  backgroundColor: isGoalFunded ? tokens.financeSoft : tokens.muted,
                  borderWidth: 1,
                  borderColor: isGoalFunded ? tokens.finance : tokens.border,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <MaterialIcons
                      name="savings"
                      size={12}
                      color={isGoalFunded ? tokens.finance : tokens.wish}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        color: tokens.foreground,
                        fontSize: 11,
                        fontWeight: "700",
                        fontFamily: "Plus Jakarta Sans",
                        maxWidth: 130,
                      }}
                    >
                      {wish.savings_goal.name}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: isGoalFunded ? tokens.finance : tokens.mutedForeground,
                      fontSize: 10,
                      fontWeight: "800",
                      fontFamily: "JetBrains Mono",
                    }}
                  >
                    {Math.round(savingsPct)}%
                  </Text>
                </View>

                {/* Mini Progress Bar */}
                <View
                  style={{
                    height: 4,
                    borderRadius: 999,
                    backgroundColor: tokens.border,
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
            ) : null}

            {/* Linked DOOs Steps (Compact) */}
            {wish.linked_doos_count > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <MaterialIcons name="checklist" size={13} color={tokens.doo} />
                  <Text
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 11,
                      fontWeight: "600",
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  >
                    {wish.linked_doos_done}/{wish.linked_doos_count} steps
                  </Text>
                </View>
                <Text
                  style={{
                    color: tokens.doo,
                    fontSize: 10,
                    fontWeight: "800",
                    fontFamily: "JetBrains Mono",
                  }}
                >
                  {wish.doo_progress_percent}%
                </Text>
              </View>
            ) : null}

            {/* Linked Paying Account */}
            {wish.account ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingTop: 2 }}>
                <MaterialIcons name={(wish.account.icon || "account-balance-wallet") as any} size={13} color={tokens.finance} />
                <Text
                  numberOfLines={1}
                  style={{
                    color: tokens.mutedForeground,
                    fontSize: 11,
                    fontWeight: "600",
                    fontFamily: "Plus Jakarta Sans",
                    maxWidth: 180,
                  }}
                >
                  {wish.account.name}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Card Footer: Quick Actions */}
          <View
            style={{
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: tokens.border,
            }}
          >
            {/* Invisible padded buffer container so button hover states never clip or grow under parent bounds */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 4,
                margin: -4,
                backgroundColor: "transparent",
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isGranted ? "Mark active" : "Mark as granted"}
                onPress={() => onToggleStatus(wish)}
                style={({ hovered }: any) => [
                  {
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: isGranted
                      ? (hovered ? "#059669" : tokens.finance)
                      : (hovered ? tokens.financeSoft : tokens.muted),
                    borderWidth: 1,
                    borderColor: isGranted
                      ? (hovered ? "#34D399" : tokens.finance)
                      : (hovered ? tokens.finance : "transparent"),
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  },
                  Platform.OS === "web"
                    ? ({
                        cursor: "pointer",
                        transform: hovered ? "translateY(-1px) scale(1.03)" : "none",
                        transition: "all 160ms cubic-bezier(0.16, 1, 0.3, 1)",
                      } as any)
                    : null,
                ]}
              >
                <MaterialIcons
                  name={isGranted ? "check" : "auto-awesome"}
                  size={12}
                  color={isGranted ? tokens.primaryForeground : tokens.foreground}
                />
                <Text
                  style={{
                    color: isGranted ? tokens.primaryForeground : tokens.foreground,
                    fontSize: 10,
                    fontWeight: "800",
                    fontFamily: "Plus Jakarta Sans",
                  }}
                >
                  {isGranted ? grantedLabel : grantLabel}
                </Text>
              </Pressable>

              {/* Group of action buttons wrapped in invisible padded buffer container */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  padding: 4,
                  backgroundColor: "transparent",
                }}
              >
                <IconButton
                  icon="edit"
                  size="sm"
                  variant="wish"
                  accessibilityLabel={`Edit wish ${wish.title}`}
                  onPress={() => onEdit(wish)}
                />

                <IconButton
                  icon="delete-outline"
                  size="sm"
                  variant="destructive"
                  accessibilityLabel={`Delete wish ${wish.title}`}
                  onPress={() => onDelete(wish)}
                />

                <IconButton
                  icon="arrow-forward"
                  size="sm"
                  variant="default"
                  accessibilityLabel={`View details for ${wish.title}`}
                  onPress={() => onOpenDetail(wish)}
                />
              </View>
            </View>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

export default function WishesScreen() {
  const { tokens, colorMode } = useAppTheme();
  const { t } = useLanguage();
  const isDark = colorMode === "dark";
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const router = useRouter();

  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [data, setData] = useState<WishesListResponse | null>(null);
  const [savingsGoals, setSavingsGoals] = useState<FinanceSavingsGoal[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [doosList, setDoosList] = useState<DooItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deleteTargetWish, setDeleteTargetWish] = useState<WishItem | null>(null);
  const [isDeletingWish, setIsDeletingWish] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityKey>("all");

  // Undo support for deletions / grants
  const [pendingUndo, setPendingUndo] = useState<{
    label: string;
    onUndo: () => Promise<void>;
  } | null>(null);

  // Quick Add Wish Modal Sheet State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWish, setEditingWish] = useState<WishItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [newGoalId, setNewGoalId] = useState("");
  const [newAccountId, setNewAccountId] = useState("");
  const [newSelectedDooIds, setNewSelectedDooIds] = useState<string[]>([]);
  const [newCatId, setNewCatId] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newImageKey, setNewImageKey] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const errorShake = useErrorShake();
  const pulseConfirm = usePulseScale();

  const loadData = useCallback(
    async (token: string, wsId?: string) => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const [wishesRes, financesRes, doosRes] = await Promise.all([
          fetchWishes(token, { workspace_id: wsId }),
          fetchFinancesOverview(token, wsId).catch(() => null),
          fetchDoos(token, { workspace_id: wsId }).catch(() => null),
        ]);
        setData(wishesRes);
        if (financesRes) {
          setSavingsGoals(financesRes.savings_goals || []);
          setCategories(financesRes.categories || []);
          setAccounts(financesRes.accounts || []);
        }
        if (doosRes) {
          setDoosList(doosRes.items || []);
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to load wishes.");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    async function init() {
      if (!accessToken) {
        try {
          const auth = await loginWithEmail({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
          setSession(auth);
          await loadData(auth.access_token, auth.workspaces[0]?.id);
        } catch {
          setErrorMessage("Failed to authenticate session.");
          setIsLoading(false);
        }
      } else {
        await loadData(accessToken, currentWorkspace?.id);
      }
    }
    init();
  }, [accessToken, currentWorkspace?.id, loadData, setSession]);

  const handleSignOut = async () => {
    try {
      if (refreshToken) {
        await logoutAuthSession(refreshToken);
      }
    } catch {}
    clearSession();
    setData(null);
    router.replace("/welcome");
  };

  // Image Upload on Web
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
        setModalError(null);
        const uploadRes = await uploadWishImage(
          accessToken,
          file,
          file.name,
          currentWorkspace?.id
        );
        setNewImageKey(uploadRes.storage_key);
        setImagePreviewUrl(uploadRes.image_url);
        pulseConfirm.triggerPulse();
      } catch (err: any) {
        setModalError(err.message || "Failed to upload image.");
        errorShake.triggerShake();
      } finally {
        setIsUploadingImage(false);
      }
    };
    input.click();
  };

  const handleOpenEditWish = (wish: WishItem) => {
    setEditingWish(wish);
    setNewTitle(wish.title);
    setNewPrice(wish.estimated_price !== null && wish.estimated_price !== undefined ? String(wish.estimated_price) : "");
    setNewPriority(wish.priority);
    setNewGoalId(wish.savings_goal_id || "");
    setNewAccountId(wish.account_id || "");
    // Find already linked DOOs for this wish
    const linked = doosList.filter((d) => d.wish_id === wish.id).map((d) => d.id);
    setNewSelectedDooIds(linked);
    setNewCatId(wish.category_id || "");
    setNewUrl(wish.url || "");
    setNewNotes(wish.notes || "");
    setNewImageKey(wish.image_storage_key || "");
    setImagePreviewUrl(wish.image_url || null);
    setModalError(null);
    setShowAddModal(true);
  };

  const handleOpenAddWish = () => {
    setEditingWish(null);
    setNewTitle("");
    setNewPrice("");
    setNewPriority("medium");
    setNewGoalId("");
    setNewAccountId("");
    setNewSelectedDooIds([]);
    setNewCatId("");
    setNewUrl("");
    setNewNotes("");
    setNewImageKey("");
    setImagePreviewUrl(null);
    setModalError(null);
    setShowAddModal(true);
  };
  // Explicit Save & Confirm Wish Mutation (Create or Edit)
  const handleConfirmSaveWish = async () => {
    if (!accessToken) return;
    if (!newTitle.trim()) {
      setModalError("Please enter a title for your wish.");
      errorShake.triggerShake();
      return;
    }

    const parsedPrice = newPrice.trim() ? parseFloat(newPrice) : null;
    if (parsedPrice !== null && (isNaN(parsedPrice) || parsedPrice < 0)) {
      setModalError("Please enter a valid positive target price.");
      errorShake.triggerShake();
      return;
    }

    try {
      setIsSubmitting(true);
      setModalError(null);

      if (editingWish) {
        // Edit existing wish
        const prevData = { ...editingWish };
        const updated = await updateWish(accessToken, editingWish.id, {
          title: newTitle.trim(),
          estimated_price: parsedPrice,
          priority: newPriority,
          savings_goal_id: newGoalId || null,
          account_id: newAccountId || null,
          linked_doo_ids: newSelectedDooIds,
          category_id: newCatId || null,
          url: newUrl.trim() || null,
          notes: newNotes.trim() || null,
          image_storage_key: newImageKey || null,
        });

        setShowAddModal(false);
        setEditingWish(null);
        pulseConfirm.triggerPulse();
        setFeedbackNotice(`Wish "${updated.title}" updated.`);

        setPendingUndo({
          label: "Undo",
          onUndo: async () => {
            try {
              await updateWish(accessToken, prevData.id, {
                title: prevData.title,
                estimated_price: prevData.estimated_price,
                priority: prevData.priority,
                savings_goal_id: prevData.savings_goal_id,
                account_id: prevData.account_id,
                category_id: prevData.category_id,
                url: prevData.url,
                notes: prevData.notes,
                image_storage_key: prevData.image_storage_key,
              });
              await loadData(accessToken, currentWorkspace?.id);
              setFeedbackNotice(`Reverted changes to "${prevData.title}".`);
            } catch (err: any) {
              setFeedbackNotice(err.message || "Failed to revert wish.");
            }
          },
        });
      } else {
        // Create new wish
        const created = await createWish(accessToken, {
          workspace_id: currentWorkspace?.id,
          title: newTitle.trim(),
          estimated_price: parsedPrice,
          priority: newPriority,
          savings_goal_id: newGoalId || null,
          account_id: newAccountId || null,
          linked_doo_ids: newSelectedDooIds,
          category_id: newCatId || null,
          url: newUrl.trim() || null,
          notes: newNotes.trim() || null,
          image_storage_key: newImageKey || null,
        });

        setShowAddModal(false);
        pulseConfirm.triggerPulse();
        setFeedbackNotice(`Wish "${created.title}" saved.`);

        setPendingUndo({
          label: "Undo",
          onUndo: async () => {
            try {
              await deleteWish(accessToken, created.id);
              await loadData(accessToken, currentWorkspace?.id);
              setFeedbackNotice("Wish creation undone.");
            } catch (err: any) {
              setFeedbackNotice(err.message || "Failed to undo wish.");
            }
          },
        });
      }

      setNewTitle("");
      setNewPrice("");
      setNewPriority("medium");
      setNewGoalId("");
      setNewCatId("");
      setNewUrl("");
      setNewNotes("");
      setNewImageKey("");
      setImagePreviewUrl(null);
      await loadData(accessToken, currentWorkspace?.id);
    } catch (err: any) {
      setModalError(err.message || (editingWish ? "Failed to update wish." : "Failed to create wish."));
      errorShake.triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Granted Status Mutation
  const handleToggleStatus = async (wish: WishItem) => {
    if (!accessToken) return;
    const nextStatus = wish.status === "granted" ? "active" : "granted";
    try {
      await updateWish(accessToken, wish.id, { status: nextStatus });
      setFeedbackNotice(
        nextStatus === "granted"
          ? `Marked "${wish.title}" as Granted!`
          : `Restored "${wish.title}" to Active.`
      );
      setPendingUndo({
        label: "Undo",
        onUndo: async () => {
          try {
            await updateWish(accessToken, wish.id, { status: wish.status });
            await loadData(accessToken, currentWorkspace?.id);
            setFeedbackNotice("Status change reverted.");
          } catch (err: any) {
            setFeedbackNotice(err.message || "Failed to revert status.");
          }
        },
      });
      await loadData(accessToken, currentWorkspace?.id);
    } catch (err: any) {
      setFeedbackNotice(err.message || "Failed to update wish status.");
    }
  };

  // Delete Wish Mutation
  const handleDeleteWish = async (wish: WishItem) => {
    if (!accessToken) return;
    try {
      await deleteWish(accessToken, wish.id);
      setFeedbackNotice(`Deleted wish "${wish.title}".`);
      setPendingUndo({
        label: "Undo",
        onUndo: async () => {
          try {
            await createWish(accessToken, {
              workspace_id: currentWorkspace?.id,
              title: wish.title,
              estimated_price: wish.estimated_price,
              priority: wish.priority,
              savings_goal_id: wish.savings_goal_id,
              category_id: wish.category_id,
              url: wish.url,
              notes: wish.notes,
              image_storage_key: wish.image_storage_key,
            });
            await loadData(accessToken, currentWorkspace?.id);
            setFeedbackNotice(`Restored wish "${wish.title}".`);
          } catch (err: any) {
            setFeedbackNotice(err.message || "Failed to restore wish.");
          }
        },
      });
      await loadData(accessToken, currentWorkspace?.id);
    } catch (err: any) {
      setFeedbackNotice(err.message || "Failed to delete wish.");
    }
  };

  // Filtered List
  const wishesList = (data?.wishes || []).filter((w) => {
    if (statusFilter !== "all" && w.status !== statusFilter) return false;
    if (priorityFilter !== "all" && w.priority !== priorityFilter) return false;
    return true;
  });

  const currency = data?.workspace.currency || currentWorkspace?.currency || "USD";
  const summary = data?.summary;

  const heroEntrance = useStaggerEntrance(0);
  const filtersEntrance = useStaggerEntrance(1);
  const listEntrance = useStaggerEntrance(2);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      {/* Perimeter radial origin for Screen 6: "corner-top-left" */}
      <AmbientMeshBackground variant="corner-top-left" />

      <AdaptiveShell
        activeTab="wishes"
        userDisplayName={authUser?.display_name || "Alex Rivera"}
        userEmail={authUser?.email}
        workspaceName={data?.workspace.name || currentWorkspace?.name || "Personal Workspace"}
        workspaceCurrency={currency}
        onSignOut={handleSignOut}
      >
        <View style={{ gap: 20, width: "100%" }}>
          {/* Timed Notification with Automatic Countdown Progress Bar & Undo */}
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
            variant="info"
          />

          {/* Hero Banner: Total Estimated Value + Active / Granted Counts + Quick Add Trigger */}
          <Animated.View style={heroEntrance}>
            <Card
              style={{
                padding: isDesktop ? 22 : 18,
                borderRadius: tokens.radiusCard,
                gap: 14,
                borderColor: tokens.border,
              }}
            >
              <View
                style={{
                  flexDirection: isDesktop ? "row" : "column",
                  alignItems: isDesktop ? "center" : "flex-start",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <MaterialIcons name="auto-awesome" size={16} color={tokens.wish} />
                    <Text
                      style={{
                        color: tokens.wish,
                        fontSize: 12,
                        fontWeight: "800",
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        fontFamily: "Plus Jakarta Sans",
                      }}
                    >
                      {t.wishlistAspirations}
                    </Text>
                  </View>

                  <Text
                    style={{
                      color: tokens.foreground,
                      fontSize: isDesktop ? 28 : 24,
                      fontWeight: "900",
                      letterSpacing: -0.6,
                      fontFamily: "JetBrains Mono",
                    }}
                  >
                    {formatCurrency(summary?.total_estimated_value || 0, currency)}
                  </Text>

                  <Text
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 12,
                      fontWeight: "500",
                    }}
                  >
                    {t.totalEstimatedValue}
                  </Text>
                </View>

                {/* Right Hero Stats + Quick Add Button */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: tokens.muted,
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Text style={{ color: tokens.mutedForeground, fontSize: 10, fontWeight: "700" }}>
                      {t.active.toUpperCase()}
                    </Text>
                    <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "800", fontFamily: "JetBrains Mono" }}>
                      {summary?.active_wishes || 0}
                    </Text>
                  </View>

                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: tokens.financeSoft,
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Text style={{ color: tokens.finance, fontSize: 10, fontWeight: "700" }}>
                      {t.granted.toUpperCase()}
                    </Text>
                    <Text style={{ color: tokens.finance, fontSize: 16, fontWeight: "800", fontFamily: "JetBrains Mono" }}>
                      {summary?.granted_wishes || 0}
                    </Text>
                  </View>

                  <Button
                    label={t.addWish}
                    accessibilityLabel="Open Quick Add Wish Sheet"
                    onPress={handleOpenAddWish}
                    variant="primary"
                    size="md"
                    icon={<MaterialIcons name="add" size={18} color={tokens.primaryForeground} />}
                    style={{
                      backgroundColor: tokens.wish,
                      borderColor: tokens.wish,
                      minHeight: 44,
                      paddingHorizontal: 16,
                    }}
                  />
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* Filter Bar: Status & Priority Chips */}
          <Animated.View style={filtersEntrance}>
            <View style={{ gap: 10 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -4 }}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 4, paddingVertical: 6 }}
              >
                {/* Status Pills */}
                <FilterPill
                  label={t.allWishes}
                  icon="list"
                  isSelected={statusFilter === "all"}
                  onSelect={() => setStatusFilter("all")}
                  count={summary?.total_wishes}
                />
                <FilterPill
                  label={t.active}
                  icon="auto-awesome"
                  isSelected={statusFilter === "active"}
                  onSelect={() => setStatusFilter("active")}
                  count={summary?.active_wishes}
                />
                <FilterPill
                  label={t.granted}
                  icon="check-circle"
                  isSelected={statusFilter === "granted"}
                  onSelect={() => setStatusFilter("granted")}
                  count={summary?.granted_wishes}
                />

                {/* Priority Separator & Pills */}
                <View style={{ width: 1, height: 24, backgroundColor: tokens.border, alignSelf: "center", marginHorizontal: 4 }} />

                <FilterPill
                  label={t.highPriority}
                  isSelected={priorityFilter === "high"}
                  onSelect={() => setPriorityFilter(priorityFilter === "high" ? "all" : "high")}
                />
                <FilterPill
                  label={t.mediumPriority}
                  isSelected={priorityFilter === "medium"}
                  onSelect={() => setPriorityFilter(priorityFilter === "medium" ? "all" : "medium")}
                />
                <FilterPill
                  label={t.lowPriority}
                  isSelected={priorityFilter === "low"}
                  onSelect={() => setPriorityFilter(priorityFilter === "low" ? "all" : "low")}
                />
              </ScrollView>
            </View>
          </Animated.View>

          {/* Wishes List Cards */}
          <Animated.View style={listEntrance}>
            {isLoading ? (
              <View style={{ paddingVertical: 48, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={tokens.wish} />
                <Text style={{ color: tokens.mutedForeground, marginTop: 12, fontSize: 13 }}>
                  {t.loading}
                </Text>
              </View>
            ) : errorMessage ? (
              <Card style={{ padding: 20, borderColor: tokens.destructive, gap: 10 }}>
                <Text style={{ color: tokens.destructive, fontWeight: "700" }}>{errorMessage}</Text>
                <Button
                  label="Retry"
                  variant="outline"
                  size="sm"
                  onPress={() => { if (accessToken) loadData(accessToken, currentWorkspace?.id); }}
                  style={{ alignSelf: "flex-start" }}
                />
              </Card>
            ) : wishesList.length === 0 ? (
              <Card style={{ padding: 36, alignItems: "center", gap: 12, borderStyle: "dashed" }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 999,
                    backgroundColor: tokens.wishSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcons name="auto-awesome" size={26} color={tokens.wish} />
                </View>
                <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "800", fontFamily: "Plus Jakarta Sans" }}>
                  {t.noWishesFound}
                </Text>
                <Text style={{ color: tokens.mutedForeground, fontSize: 12, textAlign: "center", maxWidth: 300 }}>
                  {statusFilter !== "all" || priorityFilter !== "all"
                    ? t.noWishesFilterDesc
                    : t.noWishesDesc}
                </Text>
                <Button
                  label={t.addFirstWish}
                  variant="primary"
                  size="md"
                  onPress={handleOpenAddWish}
                  style={{ backgroundColor: tokens.wish, borderColor: tokens.wish, marginTop: 6 }}
                />
              </Card>
            ) : (
              <View
                style={[
                  {
                    width: "100%",
                  },
                  Platform.OS === "web"
                    ? ({
                        display: "grid",
                        gridTemplateColumns: isDesktop
                          ? "repeat(auto-fill, minmax(280px, 1fr))"
                          : width >= 640
                          ? "repeat(2, minmax(0, 1fr))"
                          : "repeat(1, minmax(0, 1fr))",
                        gap: 16,
                      } as any)
                    : {
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 16,
                      },
                ]}
              >
                {wishesList.map((w) => (
                  <View
                    key={w.id}
                    style={{
                      flex: 1,
                      minWidth: Platform.OS === "web" ? undefined : isDesktop ? "30%" : width >= 640 ? "47%" : "100%",
                    }}
                  >
                    <WishCard
                      wish={w}
                      currency={currency}
                      onToggleStatus={handleToggleStatus}
                      onEdit={handleOpenEditWish}
                      onDelete={(targetWish) => setDeleteTargetWish(targetWish)}
                      onOpenDetail={(targetWish) => router.push(`/(app)/wishes/${targetWish.id}` as any)}
                      isDesktop={isDesktop}
                      grantLabel={t.grant}
                      grantedLabel={t.granted}
                    />
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        </View>

        {/* Quick Add Wish Bottom Sheet / Modal */}
        {showAddModal ? (
          <Modal
            visible={showAddModal}
            transparent
            animationType="fade"
            onRequestClose={() => !isSubmitting && setShowAddModal(false)}
          >
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  zIndex: 100,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  ...(Platform.OS === "web" ? ({ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 } as any) : {}),
                },
              ]}
            >
            {/* Soft dismissable overlay */}
            <Pressable
              accessibilityLabel="Close Add Wish Modal"
              onPress={() => !isSubmitting && setShowAddModal(false)}
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
                  maxWidth: 520,
                  maxHeight: "90%",
                  borderRadius: tokens.radiusCard + 6,
                  backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
                  padding: 8,
                  borderWidth: 1,
                  borderColor: isDark ? "#334155" : "#CBD5E1",
                  zIndex: 101,
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
                    borderColor: tokens.border,
                    padding: 20,
                    gap: 16,
                  },
                ]}
              >
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                {/* Sheet Header */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: tokens.wishSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons name="auto-awesome" size={18} color={tokens.wish} />
                    </View>
                    <Text style={{ color: tokens.foreground, fontSize: 17, fontWeight: "800", fontFamily: "Plus Jakarta Sans" }}>
                      {editingWish ? "Edit Wish" : "New Wish"}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityLabel="Close"
                    onPress={() => setShowAddModal(false)}
                    style={{ padding: 4 }}
                  >
                    <MaterialIcons name="close" size={20} color={tokens.mutedForeground} />
                  </Pressable>
                </View>

                {modalError ? (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: `${tokens.destructive}20`,
                      borderColor: tokens.destructive,
                      borderWidth: 1,
                    }}
                  >
                    <Text style={{ color: tokens.destructive, fontSize: 12, fontWeight: "700" }}>
                      {modalError}
                    </Text>
                  </View>
                ) : null}

                {/* Title */}
                <View style={{ gap: 4 }}>
                  <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700", fontFamily: "Plus Jakarta Sans" }}>
                    Wish Title *
                  </Text>
                  <TextInput
                    placeholder="e.g. Sony WH-1000XM5 Headphones"
                    placeholderTextColor={tokens.mutedForeground}
                    value={newTitle}
                    onChangeText={setNewTitle}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 12,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: tokens.muted,
                      borderWidth: 1,
                      borderColor: tokens.border,
                      color: tokens.foreground,
                      fontSize: 14,
                    }}
                  />
                </View>

                {/* Estimated Price */}
                <View style={{ gap: 4 }}>
                  <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700", fontFamily: "Plus Jakarta Sans" }}>
                    Estimated Price ({currency})
                  </Text>
                  <TextInput
                    placeholder="0.00"
                    placeholderTextColor={tokens.mutedForeground}
                    keyboardType="numeric"
                    value={newPrice}
                    onChangeText={setNewPrice}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 12,
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
                  <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700", fontFamily: "Plus Jakarta Sans" }}>
                    Priority
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(["low", "medium", "high"] as const).map((p) => {
                      const isSel = newPriority === p;
                      return (
                        <Pressable
                          key={p}
                          onPress={() => setNewPriority(p)}
                          style={[
                            {
                              flex: 1,
                              minHeight: 38,
                              borderRadius: tokens.radiusControl,
                              backgroundColor: isSel ? tokens.wish : tokens.muted,
                              alignItems: "center",
                              justifyContent: "center",
                              borderWidth: 1,
                              borderColor: isSel ? tokens.wish : tokens.border,
                            },
                            Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                          ]}
                        >
                          <Text
                            style={{
                              color: isSel ? tokens.primaryForeground : tokens.foreground,
                              fontWeight: isSel ? "800" : "600",
                              fontSize: 12,
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

                {/* Optional Link to Savings Goal */}
                {savingsGoals.length > 0 ? (
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700", fontFamily: "Plus Jakarta Sans" }}>
                      {t.linkToSavingsGoal}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      <Pressable
                        onPress={() => setNewGoalId("")}
                        style={[
                          {
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: newGoalId === "" ? tokens.wish : tokens.muted,
                            borderWidth: 1,
                            borderColor: newGoalId === "" ? tokens.wish : tokens.border,
                          },
                          Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                        ]}
                      >
                        <Text
                          style={{
                            color: newGoalId === "" ? tokens.primaryForeground : tokens.foreground,
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {t.noLinkedGoal}
                        </Text>
                      </Pressable>

                      {savingsGoals.map((g) => {
                        const isSel = newGoalId === g.id;
                        return (
                          <Pressable
                            key={g.id}
                            onPress={() => setNewGoalId(g.id)}
                            style={[
                              {
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: tokens.radiusControl,
                                backgroundColor: isSel ? tokens.wish : tokens.muted,
                                borderWidth: 1,
                                borderColor: isSel ? tokens.wish : tokens.border,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <MaterialIcons
                              name="savings"
                              size={12}
                              color={isSel ? tokens.primaryForeground : tokens.wish}
                            />
                            <Text
                              style={{
                                color: isSel ? tokens.primaryForeground : tokens.foreground,
                                fontSize: 11,
                                fontWeight: "700",
                              }}
                            >
                              {g.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                {/* Optional Link to Paying Account */}
                {accounts.length > 0 ? (
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700", fontFamily: "Plus Jakarta Sans" }}>
                      {t.linkToAccount}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      <Pressable
                        onPress={() => setNewAccountId("")}
                        style={[
                          {
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: newAccountId === "" ? tokens.finance : tokens.muted,
                            borderWidth: 1,
                            borderColor: newAccountId === "" ? tokens.finance : tokens.border,
                          },
                          Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                        ]}
                      >
                        <Text
                          style={{
                            color: newAccountId === "" ? tokens.primaryForeground : tokens.foreground,
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {t.noLinkedAccount}
                        </Text>
                      </Pressable>

                      {accounts.map((acc) => {
                        const isSel = newAccountId === acc.id;
                        return (
                          <Pressable
                            key={acc.id}
                            onPress={() => setNewAccountId(acc.id)}
                            style={[
                              {
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: tokens.radiusControl,
                                backgroundColor: isSel ? tokens.finance : tokens.muted,
                                borderWidth: 1,
                                borderColor: isSel ? tokens.finance : tokens.border,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <MaterialIcons
                              name="account-balance-wallet"
                              size={12}
                              color={isSel ? tokens.primaryForeground : tokens.finance}
                            />
                            <Text
                              style={{
                                color: isSel ? tokens.primaryForeground : tokens.foreground,
                                fontSize: 11,
                                fontWeight: "700",
                              }}
                            >
                              {acc.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                {/* Optional Link to Action Steps (DOOs) */}
                {doosList.length > 0 ? (
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700", fontFamily: "Plus Jakarta Sans" }}>
                      {t.linkToDoos}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {doosList.map((doo) => {
                        const isSel = newSelectedDooIds.includes(doo.id);
                        return (
                          <Pressable
                            key={doo.id}
                            onPress={() => {
                              if (isSel) {
                                setNewSelectedDooIds(newSelectedDooIds.filter((id) => id !== doo.id));
                              } else {
                                setNewSelectedDooIds([...newSelectedDooIds, doo.id]);
                              }
                            }}
                            style={[
                              {
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: tokens.radiusControl,
                                backgroundColor: isSel ? tokens.doo : tokens.muted,
                                borderWidth: 1,
                                borderColor: isSel ? tokens.doo : tokens.border,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <MaterialIcons
                              name={isSel ? "check-box" : "check-box-outline-blank"}
                              size={13}
                              color={isSel ? tokens.primaryForeground : tokens.doo}
                            />
                            <Text
                              numberOfLines={1}
                              style={{
                                color: isSel ? tokens.primaryForeground : tokens.foreground,
                                fontSize: 11,
                                fontWeight: "700",
                                maxWidth: 140,
                              }}
                            >
                              {doo.title}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                {/* Optional Link to Category */}
                {categories.length > 0 ? (
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700", fontFamily: "Plus Jakarta Sans" }}>
                      Category (Optional)
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      <Pressable
                        onPress={() => setNewCatId("")}
                        style={[
                          {
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: newCatId === "" ? tokens.wish : tokens.muted,
                            borderWidth: 1,
                            borderColor: newCatId === "" ? tokens.wish : tokens.border,
                          },
                          Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                        ]}
                      >
                        <Text
                          style={{
                            color: newCatId === "" ? tokens.primaryForeground : tokens.foreground,
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          None
                        </Text>
                      </Pressable>

                      {categories.map((c) => {
                        const isSel = newCatId === c.id;
                        return (
                          <Pressable
                            key={c.id}
                            onPress={() => setNewCatId(c.id)}
                            style={[
                              {
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: tokens.radiusControl,
                                backgroundColor: isSel ? tokens.wish : tokens.muted,
                                borderWidth: 1,
                                borderColor: isSel ? tokens.wish : tokens.border,
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <Text
                              style={{
                                color: isSel ? tokens.primaryForeground : tokens.foreground,
                                fontSize: 11,
                                fontWeight: "700",
                              }}
                            >
                              {c.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                {/* Image Upload Picker */}
                <View style={{ gap: 6 }}>
                  <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700", fontFamily: "Plus Jakarta Sans" }}>
                    Wish Image (EXIF Stripped)
                  </Text>
                  {imagePreviewUrl ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Image
                        source={{ uri: imagePreviewUrl }}
                        alt="Selected wish image preview"
                        accessibilityLabel="Selected wish image preview"
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: tokens.radiusControl,
                          borderWidth: 1,
                          borderColor: tokens.border,
                        }}
                      />
                      <Pressable
                        onPress={() => {
                          setNewImageKey("");
                          setImagePreviewUrl(null);
                        }}
                        style={{ padding: 4 }}
                      >
                        <Text style={{ color: tokens.destructive, fontSize: 12, fontWeight: "700" }}>Remove</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Button
                      label={isUploadingImage ? "Stripping EXIF & Uploading..." : "Choose Image (PNG, JPG, WebP)"}
                      variant="outline"
                      size="md"
                      loading={isUploadingImage}
                      icon={<MaterialIcons name="photo-camera" size={16} color={tokens.foreground} />}
                      onPress={handlePickImageWeb}
                      disabled={isUploadingImage}
                      style={{
                        borderStyle: "dashed",
                        borderWidth: 1,
                      }}
                    />
                  )}
                </View>

                {/* External URL */}
                <View style={{ gap: 4 }}>
                  <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700", fontFamily: "Plus Jakarta Sans" }}>
                    Product / Inspiration URL (Optional)
                  </Text>
                  <TextInput
                    placeholder="https://..."
                    placeholderTextColor={tokens.mutedForeground}
                    value={newUrl}
                    onChangeText={setNewUrl}
                    style={{
                      minHeight: 40,
                      paddingHorizontal: 12,
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
                  <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700", fontFamily: "Plus Jakarta Sans" }}>
                    Notes (Optional)
                  </Text>
                  <TextInput
                    placeholder="Specific color, size, specs, or reminders..."
                    placeholderTextColor={tokens.mutedForeground}
                    value={newNotes}
                    onChangeText={setNewNotes}
                    multiline
                    numberOfLines={3}
                    style={{
                      minHeight: 64,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: tokens.muted,
                      borderWidth: 1,
                      borderColor: tokens.border,
                      color: tokens.foreground,
                      fontSize: 13,
                      textAlignVertical: "top",
                    }}
                  />
                </View>

                {/* Explicit Save & Confirm Action (Padded invisible buffer container) */}
                <View
                  style={{
                    padding: 4,
                    marginHorizontal: -4,
                    marginTop: 8,
                    backgroundColor: "transparent",
                  }}
                >
                  <View style={{ flexDirection: width < 396 ? "column" : "row", gap: 10 }}>
                    <Button
                      label={t.cancel}
                      variant="outline"
                      size="md"
                      onPress={() => setShowAddModal(false)}
                      disabled={isSubmitting}
                      style={{ flex: width < 396 ? undefined : 1, minHeight: 46 }}
                    />

                    <Button
                      label={t.saveAndConfirm}
                      variant="primary"
                      size="md"
                      loading={isSubmitting}
                      icon={<MaterialIcons name="check" size={16} color={tokens.primaryForeground} />}
                      onPress={handleConfirmSaveWish}
                      disabled={isSubmitting}
                      style={{
                        flex: width < 396 ? undefined : 1.5,
                        backgroundColor: tokens.wish,
                        borderColor: tokens.wish,
                        minHeight: 46,
                      }}
                    />
                  </View>
                </View>
              </ScrollView>
              </Animated.View>
            </View>
          </View>
        </Modal>
        ) : null}

        {/* Delete Confirmation Modal for Wishes */}
        <ConfirmDeleteModal
          visible={!!deleteTargetWish}
          title={t.deleteWishConfirmTitle}
          description={t.deleteWishConfirmDesc}
          itemTitle={deleteTargetWish?.title}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          isDeleting={isDeletingWish}
          onCancel={() => setDeleteTargetWish(null)}
          onConfirm={async () => {
            if (!deleteTargetWish) return;
            try {
              setIsDeletingWish(true);
              const target = deleteTargetWish;
              setDeleteTargetWish(null);
              await handleDeleteWish(target);
            } finally {
              setIsDeletingWish(false);
            }
          }}
        />
      </AdaptiveShell>
    </View>
  );
}
