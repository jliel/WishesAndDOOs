import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAppTheme } from "@/theme/ThemeProvider";
import { useAuthStore } from "@/store/authStore";
import { useInteractiveMotion, useStaggerEntrance } from "@/lib/motion";
import { AdaptiveShell } from "@/components/layout/AdaptiveShell";
import { AmbientMeshBackground } from "@/components/ui/AmbientMeshBackground";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { TimedNotice } from "@/components/ui/TimedNotice";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  createDoo,
  deleteDoo,
  DooItem,
  DoosListResponse,
  fetchDoos,
  toggleDooStatus,
  toggleSubtask,
  updateDoo,
} from "@/api/doos";
import { fetchWishes, WishItem } from "@/api/wishes";

type ViewKey = "all" | "today" | "upcoming" | "completed";
type PriorityKey = "all" | "high" | "medium" | "low";

interface PriorityBadgeProps {
  priority: "low" | "medium" | "high";
}

function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { tokens } = useAppTheme();
  const config = {
    high: {
      bg: `${tokens.destructive}18`,
      text: tokens.destructive,
      border: `${tokens.destructive}40`,
      label: "High",
    },
    medium: {
      bg: `${tokens.warning}18`,
      text: tokens.warning,
      border: `${tokens.warning}40`,
      label: "Med",
    },
    low: {
      bg: `${tokens.muted}`,
      text: tokens.mutedForeground,
      border: tokens.border,
      label: "Low",
    },
  }[priority];

  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: config.bg,
        borderWidth: 1,
        borderColor: config.border,
      }}
    >
      <Text
        style={{
          color: config.text,
          fontSize: 10,
          fontWeight: "800",
          fontFamily: "Plus Jakarta Sans",
          textTransform: "uppercase",
          letterSpacing: 0.6,
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
              ? tokens.doo
              : motion.isHovered
              ? tokens.dooSoft
              : tokens.card,
            borderWidth: 1,
            borderColor: isSelected
              ? tokens.doo
              : motion.isHovered
              ? `${tokens.doo}88`
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
            color={isSelected ? tokens.primaryForeground : tokens.mutedForeground}
          />
        ) : null}
        <Text
          style={{
            color: isSelected ? tokens.primaryForeground : tokens.foreground,
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

interface DooCardProps {
  doo: DooItem;
  onToggleStatus: (doo: DooItem) => void;
  onToggleSubtask: (dooId: string, subtaskId: string, isCompleted: boolean) => void;
  onEdit: (doo: DooItem) => void;
  onDelete: (doo: DooItem) => void;
  onOpenDetail: (doo: DooItem) => void;
}

function DooCard({ doo, onToggleStatus, onToggleSubtask, onEdit, onDelete, onOpenDetail }: DooCardProps) {
  const { tokens, colorMode } = useAppTheme();
  const isDark = colorMode === "dark";
  const motion = useInteractiveMotion({
    hoverScale: 1.012,
    hoverLift: -2,
    pressScale: 0.985,
  });

  const isDone = doo.status === "done";

  return (
    <Animated.View style={[{ width: "100%" }, motion.animatedStyle]}>
      <Card
        style={[
          {
            padding: 16,
            borderRadius: tokens.radiusCard,
            borderColor: isDone ? tokens.finance : tokens.border,
            borderWidth: 1,
            backgroundColor: tokens.card,
            gap: 12,
          },
          Platform.OS === "web"
            ? ({
                boxShadow: motion.isHovered
                  ? isDark
                    ? "0 12px 24px -4px rgba(0, 0, 0, 0.65), 0 0 12px rgba(16, 185, 129, 0.18)"
                    : "0 12px 24px -4px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(16, 185, 129, 0.08)"
                  : isDark
                  ? "0 4px 12px rgba(0, 0, 0, 0.3)"
                  : "0 4px 12px rgba(15, 23, 42, 0.04)",
                transition: "all 180ms cubic-bezier(0.16, 1, 0.3, 1)",
              } as any)
            : null,
        ]}
      >
        {/* Top Header Row: Checkbox, Title, Badges */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 }}>
            {/* Task Completion Checkbox Button */}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDone }}
              accessibilityLabel={isDone ? `Mark ${doo.title} as incomplete` : `Mark ${doo.title} as completed`}
              onPress={() => onToggleStatus(doo)}
              style={({ hovered }: any) => [
                {
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: isDone ? tokens.finance : hovered ? tokens.doo : tokens.border,
                  backgroundColor: isDone ? tokens.finance : hovered ? tokens.dooSoft : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2,
                },
                Platform.OS === "web"
                  ? ({
                      cursor: "pointer",
                      transform: hovered ? "scale(1.08)" : "none",
                      transition: "all 160ms cubic-bezier(0.16, 1, 0.3, 1)",
                    } as any)
                  : null,
              ]}
            >
              {isDone ? (
                <MaterialIcons name="check" size={16} color={tokens.primaryForeground} />
              ) : null}
            </Pressable>

            {/* Title & Metadata */}
            <View style={{ flex: 1, gap: 4 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View details for ${doo.title}`}
                onPress={() => onOpenDetail(doo)}
                style={Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null}
              >
                <Text
                  style={{
                    color: tokens.foreground,
                    fontSize: 15,
                    fontWeight: "700",
                    fontFamily: "Plus Jakarta Sans",
                    textDecorationLine: isDone ? "line-through" : "none",
                    opacity: isDone ? 0.7 : 1,
                    lineHeight: 20,
                  }}
                >
                  {doo.title}
                </Text>
              </Pressable>

              {/* Tag Row: Due Date, Wish Link, Recurrence */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 2 }}>
                {doo.due_date ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <MaterialIcons name="event" size={13} color={tokens.mutedForeground} />
                    <Text
                      style={{
                        color: tokens.mutedForeground,
                        fontSize: 11,
                        fontFamily: "JetBrains Mono",
                      }}
                    >
                      {doo.due_date}
                    </Text>
                  </View>
                ) : null}

                {doo.recurrence_rule && doo.recurrence_rule !== "none" ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 999,
                      backgroundColor: tokens.muted,
                    }}
                  >
                    <MaterialIcons name="repeat" size={11} color={tokens.doo} />
                    <Text
                      style={{
                        color: tokens.doo,
                        fontSize: 10,
                        fontWeight: "700",
                        fontFamily: "Plus Jakarta Sans",
                        textTransform: "capitalize",
                      }}
                    >
                      {doo.recurrence_rule}
                    </Text>
                  </View>
                ) : null}

                {doo.wish ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 999,
                      backgroundColor: tokens.wishSoft,
                      borderWidth: 1,
                      borderColor: `${tokens.wish}40`,
                    }}
                  >
                    <MaterialIcons name="auto-awesome" size={11} color={tokens.wish} />
                    <Text
                      numberOfLines={1}
                      style={{
                        color: tokens.wish,
                        fontSize: 10,
                        fontWeight: "700",
                        fontFamily: "Plus Jakarta Sans",
                        maxWidth: 130,
                      }}
                    >
                      {doo.wish.title}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Right Badges & Action Group */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <PriorityBadge priority={doo.priority} />

            {/* Invisible padded buffer container so button hover states never clip or grow under parent bounds */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 2, backgroundColor: "transparent" }}>
              <IconButton
                icon="edit"
                size="sm"
                variant="default"
                accessibilityLabel={`Edit task ${doo.title}`}
                onPress={() => onEdit(doo)}
              />
              <IconButton
                icon="delete-outline"
                size="sm"
                variant="destructive"
                accessibilityLabel={`Delete task ${doo.title}`}
                onPress={() => onDelete(doo)}
              />
              <IconButton
                icon="arrow-forward"
                size="sm"
                variant="ghost"
                accessibilityLabel={`View task details for ${doo.title}`}
                onPress={() => onOpenDetail(doo)}
              />
            </View>
          </View>
        </View>

        {/* Notes (if any) */}
        {doo.notes ? (
          <Text
            style={{
              color: tokens.mutedForeground,
              fontSize: 12,
              lineHeight: 17,
              fontFamily: "Plus Jakarta Sans",
              paddingLeft: 36,
            }}
          >
            {doo.notes}
          </Text>
        ) : null}

        {/* Subtasks Checklist */}
        {doo.subtasks && doo.subtasks.length > 0 ? (
          <View style={{ paddingLeft: 36, gap: 6, paddingTop: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <Text
                style={{
                  color: tokens.mutedForeground,
                  fontSize: 11,
                  fontWeight: "700",
                  fontFamily: "Plus Jakarta Sans",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                Subtasks ({doo.done_subtasks}/{doo.total_subtasks})
              </Text>
              <Text
                style={{
                  color: tokens.doo,
                  fontSize: 11,
                  fontWeight: "800",
                  fontFamily: "JetBrains Mono",
                }}
              >
                {doo.progress_percent}%
              </Text>
            </View>

            {/* Mini Progress Bar */}
            <View
              style={{
                height: 4,
                borderRadius: 999,
                backgroundColor: tokens.border,
                overflow: "hidden",
                marginBottom: 4,
              }}
            >
              <View
                style={{
                  width: `${doo.progress_percent}%`,
                  height: "100%",
                  borderRadius: 999,
                  backgroundColor: tokens.doo,
                }}
              />
            </View>

            {/* Subtask list */}
            {doo.subtasks.map((sub) => (
              <Pressable
                key={sub.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: sub.is_completed }}
                accessibilityLabel={`Toggle subtask ${sub.title}`}
                onPress={() => onToggleSubtask(doo.id, sub.id, !sub.is_completed)}
                style={({ hovered }: any) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 3,
                    paddingHorizontal: 4,
                    borderRadius: 4,
                    backgroundColor: hovered ? tokens.muted : "transparent",
                  },
                  Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                ]}
              >
                <MaterialIcons
                  name={sub.is_completed ? "check-box" : "check-box-outline-blank"}
                  size={15}
                  color={sub.is_completed ? tokens.doo : tokens.mutedForeground}
                />
                <Text
                  style={{
                    color: sub.is_completed ? tokens.mutedForeground : tokens.foreground,
                    fontSize: 13,
                    textDecorationLine: sub.is_completed ? "line-through" : "none",
                    fontFamily: "Plus Jakarta Sans",
                  }}
                >
                  {sub.title}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Card>
    </Animated.View>
  );
}

export default function DoosScreen() {
  const { tokens, colorMode } = useAppTheme();
  const { t } = useLanguage();
  const isDark = colorMode === "dark";
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const router = useRouter();

  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const clearSession = useAuthStore((s) => s.clearSession);

  // State
  const [data, setData] = useState<DoosListResponse | null>(null);
  const [wishes, setWishes] = useState<WishItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deleteTargetDoo, setDeleteTargetDoo] = useState<DooItem | null>(null);
  const [isDeletingDoo, setIsDeletingDoo] = useState(false);

  // Filters
  const [activeView, setActiveView] = useState<ViewKey>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityKey>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Notification / Undo Feedback
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [feedbackVariant, setFeedbackVariant] = useState<"finance" | "warning" | "destructive">("finance");
  const [pendingUndo, setPendingUndo] = useState<{ label: string; onUndo: () => Promise<void> } | null>(null);

  // Add / Edit Modal State
  const [showDooModal, setShowDooModal] = useState(false);
  const [editingDoo, setEditingDoo] = useState<DooItem | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const [modalPriority, setModalPriority] = useState<"low" | "medium" | "high">("medium");
  const [modalDueDate, setModalDueDate] = useState("");
  const [modalRecurrence, setModalRecurrence] = useState<"none" | "daily" | "weekly" | "monthly" | "custom">("none");
  const [modalWishId, setModalWishId] = useState("");
  const [modalSubtasks, setModalSubtasks] = useState<{ title: string; is_completed: boolean }[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Motion Stagger
  const heroEntrance = useStaggerEntrance(0);
  const filtersEntrance = useStaggerEntrance(1);
  const listEntrance = useStaggerEntrance(2);

  // Load DOOs & Wishes
  const loadData = useCallback(async () => {
    const token = accessToken || "demo-token";
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [dooRes, wishRes] = await Promise.all([
        fetchDoos(token, {
          workspace_id: currentWorkspace?.id,
          view: activeView,
          priority: priorityFilter !== "all" ? priorityFilter : undefined,
          search: searchQuery.trim() || undefined,
        }),
        fetchWishes(token, { workspace_id: currentWorkspace?.id }).catch(() => null),
      ]);

      setData(dooRes);
      if (wishRes) {
        setWishes(wishRes.wishes || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load tasks.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, currentWorkspace?.id, activeView, priorityFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle DOO status with 1-click Undo
  const handleToggleStatus = async (doo: DooItem) => {
    const token = accessToken || "demo-token";
    const previousStatus = doo.status;
    const isNowDone = previousStatus !== "done";

    try {
      const updated = await toggleDooStatus(token, doo.id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) => (item.id === doo.id ? updated : item)),
              summary: {
                ...prev.summary,
                completed_doos: isNowDone
                  ? prev.summary.completed_doos + 1
                  : Math.max(0, prev.summary.completed_doos - 1),
                pending_doos: isNowDone
                  ? Math.max(0, prev.summary.pending_doos - 1)
                  : prev.summary.pending_doos + 1,
              },
            }
          : prev
      );

      setFeedbackVariant(isNowDone ? "finance" : "warning");
      setFeedbackNotice(
        isNowDone ? `Completed "${doo.title}"!` : `Reopened "${doo.title}".`
      );
      setPendingUndo({
        label: "Undo",
        onUndo: async () => {
          await toggleDooStatus(token, doo.id, previousStatus);
          await loadData();
        },
      });
    } catch (err: any) {
      setFeedbackVariant("destructive");
      setFeedbackNotice(err.message || "Failed to update task.");
    }
  };

  // Toggle Subtask
  const handleToggleSubtask = async (dooId: string, subtaskId: string, isCompleted: boolean) => {
    const token = accessToken || "demo-token";
    try {
      const updated = await toggleSubtask(token, dooId, subtaskId, isCompleted);
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) => (item.id === dooId ? updated : item)),
            }
          : prev
      );
    } catch (err: any) {
      setFeedbackVariant("destructive");
      setFeedbackNotice(err.message || "Failed to update subtask.");
    }
  };

  // Open Add DOO modal
  const handleOpenAddDoo = () => {
    setEditingDoo(null);
    setModalTitle("");
    setModalNotes("");
    setModalPriority("medium");
    setModalDueDate("");
    setModalRecurrence("none");
    setModalWishId("");
    setModalSubtasks([]);
    setNewSubtaskInput("");
    setModalError(null);
    setShowDooModal(true);
  };

  // Open Edit DOO modal
  const handleOpenEditDoo = (doo: DooItem) => {
    setEditingDoo(doo);
    setModalTitle(doo.title);
    setModalNotes(doo.notes || "");
    setModalPriority(doo.priority);
    setModalDueDate(doo.due_date || "");
    setModalRecurrence(doo.recurrence_rule || "none");
    setModalWishId(doo.wish_id || "");
    setModalSubtasks(
      (doo.subtasks || []).map((s) => ({ title: s.title, is_completed: s.is_completed }))
    );
    setNewSubtaskInput("");
    setModalError(null);
    setShowDooModal(true);
  };

  // Save / Confirm Modal Mutation
  const handleConfirmDoo = async () => {
    if (!modalTitle.trim()) {
      setModalError("Please enter a task title.");
      return;
    }

    const token = accessToken || "demo-token";
    setIsSubmitting(true);
    setModalError(null);

    try {
      if (editingDoo) {
        // Edit existing DOO
        const previousDoo = { ...editingDoo };
        const updated = await updateDoo(token, editingDoo.id, {
          title: modalTitle.trim(),
          notes: modalNotes.trim() || null,
          priority: modalPriority,
          due_date: modalDueDate.trim() || null,
          recurrence_rule: modalRecurrence,
          wish_id: modalWishId || null,
          subtasks: modalSubtasks.map((s, idx) => ({ ...s, sort_order: idx })),
        });

        setShowDooModal(false);
        setData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((item) => (item.id === editingDoo.id ? updated : item)),
              }
            : prev
        );

        setFeedbackVariant("warning");
        setFeedbackNotice(`Updated task "${updated.title}".`);
        setPendingUndo({
          label: "Undo Edit",
          onUndo: async () => {
            await updateDoo(token, editingDoo.id, {
              title: previousDoo.title,
              notes: previousDoo.notes,
              priority: previousDoo.priority,
              due_date: previousDoo.due_date,
              recurrence_rule: previousDoo.recurrence_rule,
              wish_id: previousDoo.wish_id,
            });
            await loadData();
          },
        });
      } else {
        // Create new DOO
        const created = await createDoo(token, {
          title: modalTitle.trim(),
          workspace_id: currentWorkspace?.id,
          notes: modalNotes.trim() || undefined,
          priority: modalPriority,
          due_date: modalDueDate.trim() || undefined,
          recurrence_rule: modalRecurrence,
          wish_id: modalWishId || undefined,
          subtasks: modalSubtasks.map((s, idx) => ({ ...s, sort_order: idx })),
        });

        setShowDooModal(false);
        setData((prev) =>
          prev
            ? {
                ...prev,
                items: [created, ...prev.items],
                summary: {
                  ...prev.summary,
                  total_doos: prev.summary.total_doos + 1,
                  pending_doos: prev.summary.pending_doos + 1,
                },
              }
            : prev
        );

        setFeedbackVariant("finance");
        setFeedbackNotice(`Task "${created.title}" created!`);
        setPendingUndo({
          label: "Undo",
          onUndo: async () => {
            await deleteDoo(token, created.id);
            await loadData();
          },
        });
      }
    } catch (err: any) {
      setModalError(err.message || "Failed to save task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete DOO with 1-click Undo
  const handleDeleteDoo = async (doo: DooItem) => {
    const token = accessToken || "demo-token";
    const deletedCopy = { ...doo };

    try {
      await deleteDoo(token, doo.id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((item) => item.id !== doo.id),
              summary: {
                ...prev.summary,
                total_doos: Math.max(0, prev.summary.total_doos - 1),
                pending_doos:
                  doo.status !== "done"
                    ? Math.max(0, prev.summary.pending_doos - 1)
                    : prev.summary.pending_doos,
                completed_doos:
                  doo.status === "done"
                    ? Math.max(0, prev.summary.completed_doos - 1)
                    : prev.summary.completed_doos,
              },
            }
          : prev
      );

      setFeedbackVariant("destructive");
      setFeedbackNotice(`Task "${deletedCopy.title}" deleted.`);
      setPendingUndo({
        label: "Undo Delete",
        onUndo: async () => {
          await createDoo(token, {
            title: deletedCopy.title,
            workspace_id: currentWorkspace?.id,
            notes: deletedCopy.notes || undefined,
            priority: deletedCopy.priority,
            due_date: deletedCopy.due_date || undefined,
            recurrence_rule: deletedCopy.recurrence_rule,
            wish_id: deletedCopy.wish_id || undefined,
            subtasks: (deletedCopy.subtasks || []).map((s) => ({
              title: s.title,
              is_completed: s.is_completed,
            })),
          });
          await loadData();
        },
      });
    } catch (err: any) {
      setFeedbackVariant("destructive");
      setFeedbackNotice(err.message || "Failed to delete task.");
    }
  };

  // Add subtask in modal
  const handleAddModalSubtask = () => {
    if (!newSubtaskInput.trim()) return;
    setModalSubtasks([...modalSubtasks, { title: newSubtaskInput.trim(), is_completed: false }]);
    setNewSubtaskInput("");
  };

  const handleRemoveModalSubtask = (index: number) => {
    setModalSubtasks(modalSubtasks.filter((_, idx) => idx !== index));
  };

  const summary = data?.summary;
  const items = data?.items || [];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      {/* Screen 8 Perimeter Radial Gradient Origin: "corner-bottom-right" */}
      <AmbientMeshBackground variant="corner-bottom-right" />

      {/* Floating Action Notifications */}
      {feedbackNotice ? (
        <TimedNotice
          message={feedbackNotice}
          variant={feedbackVariant}
          cancelLabel={pendingUndo?.label || "Undo"}
          onCancel={
            pendingUndo
              ? async () => {
                  await pendingUndo.onUndo();
                  setFeedbackNotice(null);
                  setPendingUndo(null);
                }
              : undefined
          }
          onDismiss={() => {
            setFeedbackNotice(null);
            setPendingUndo(null);
          }}
        />
      ) : null}

      <AdaptiveShell
        activeTab="doos"
        userDisplayName={authUser?.display_name || "Alex Rivera"}
        userEmail={authUser?.email}
        workspaceName={data?.workspace.name || currentWorkspace?.name || "Personal Workspace"}
        workspaceCurrency={data?.workspace.currency || currentWorkspace?.currency || "USD"}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 32 : 16,
            paddingTop: 24,
            paddingBottom: 100,
            maxWidth: 1240,
            width: "100%",
            alignSelf: "center",
            gap: 20,
          }}
        >
          {/* Hero Task Overview Card */}
          <Animated.View style={heroEntrance}>
            <Card
              style={{
                padding: isDesktop ? 24 : 18,
                borderRadius: tokens.radiusCard,
                borderColor: tokens.border,
                borderWidth: 1,
                backgroundColor: tokens.card,
                gap: 16,
              }}
            >
              <View
                style={{
                  flexDirection: isDesktop ? "row" : "column",
                  alignItems: isDesktop ? "center" : "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: tokens.dooSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons name="checklist" size={20} color={tokens.doo} />
                    </View>
                    <Text
                      style={{
                        color: tokens.foreground,
                        fontSize: 22,
                        fontWeight: "800",
                        fontFamily: "Plus Jakarta Sans",
                        letterSpacing: -0.4,
                      }}
                    >
                      {t.doosActionItems}
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
                    {t.doosHeroSubtitle}
                  </Text>
                </View>

                {/* Add DOO Primary CTA Button */}
                <View style={{ padding: 4, margin: -4, backgroundColor: "transparent" }}>
                  <Button
                    label={t.newTask}
                    variant="primary"
                    size="md"
                    icon={<MaterialIcons name="add-task" size={18} color={tokens.primaryForeground} />}
                    onPress={handleOpenAddDoo}
                    style={{ backgroundColor: tokens.doo, borderColor: tokens.doo }}
                  />
                </View>
              </View>

              {/* Summary Metric Counters */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: tokens.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Text style={{ color: tokens.foreground, fontSize: 18, fontWeight: "900", fontFamily: "JetBrains Mono" }}>
                    {summary?.pending_doos ?? 0}
                  </Text>
                  <Text style={{ color: tokens.mutedForeground, fontSize: 12, fontWeight: "600", fontFamily: "Plus Jakarta Sans" }}>
                    {t.pending}
                  </Text>
                </View>

                <View style={{ width: 1, height: 16, backgroundColor: tokens.border }} />

                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Text style={{ color: tokens.destructive, fontSize: 18, fontWeight: "900", fontFamily: "JetBrains Mono" }}>
                    {summary?.today_doos ?? 0}
                  </Text>
                  <Text style={{ color: tokens.mutedForeground, fontSize: 12, fontWeight: "600", fontFamily: "Plus Jakarta Sans" }}>
                    {t.dueToday}
                  </Text>
                </View>

                <View style={{ width: 1, height: 16, backgroundColor: tokens.border }} />

                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Text style={{ color: tokens.doo, fontSize: 18, fontWeight: "900", fontFamily: "JetBrains Mono" }}>
                    {summary?.upcoming_doos ?? 0}
                  </Text>
                  <Text style={{ color: tokens.mutedForeground, fontSize: 12, fontWeight: "600", fontFamily: "Plus Jakarta Sans" }}>
                    {t.upcoming}
                  </Text>
                </View>

                <View style={{ width: 1, height: 16, backgroundColor: tokens.border }} />

                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Text style={{ color: tokens.finance, fontSize: 18, fontWeight: "900", fontFamily: "JetBrains Mono" }}>
                    {summary?.completed_doos ?? 0}
                  </Text>
                  <Text style={{ color: tokens.mutedForeground, fontSize: 12, fontWeight: "600", fontFamily: "Plus Jakarta Sans" }}>
                    {t.done}
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* Filter Bar: Views & Priority Chips */}
          <Animated.View style={filtersEntrance}>
            <View style={{ gap: 10 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -4 }}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 4, paddingVertical: 6 }}
              >
                {/* View Pills */}
                <FilterPill
                  label={t.allDoos}
                  icon="list"
                  isSelected={activeView === "all"}
                  onSelect={() => setActiveView("all")}
                  count={summary?.total_doos}
                />
                <FilterPill
                  label={t.dueToday}
                  icon="today"
                  isSelected={activeView === "today"}
                  onSelect={() => setActiveView("today")}
                  count={summary?.today_doos}
                />
                <FilterPill
                  label={t.upcoming}
                  icon="event"
                  isSelected={activeView === "upcoming"}
                  onSelect={() => setActiveView("upcoming")}
                  count={summary?.upcoming_doos}
                />
                <FilterPill
                  label={t.completed}
                  icon="check-circle"
                  isSelected={activeView === "completed"}
                  onSelect={() => setActiveView("completed")}
                  count={summary?.completed_doos}
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

          {/* DOOs List Container */}
          <Animated.View style={listEntrance}>
            {isLoading ? (
              <View style={{ paddingVertical: 60, alignItems: "center", gap: 12 }}>
                <ActivityIndicator size="large" color={tokens.doo} />
                <Text style={{ color: tokens.mutedForeground, fontSize: 13, fontFamily: "Plus Jakarta Sans" }}>
                  {t.loading}
                </Text>
              </View>
            ) : errorMessage ? (
              <Card style={{ padding: 24, alignItems: "center", gap: 12 }}>
                <MaterialIcons name="error-outline" size={32} color={tokens.destructive} />
                <Text style={{ color: tokens.foreground, fontSize: 14, fontWeight: "700" }}>{errorMessage}</Text>
                <Button label="Retry" variant="outline" size="sm" onPress={loadData} />
              </Card>
            ) : items.length === 0 ? (
              <Card
                style={{
                  padding: 40,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  borderColor: tokens.border,
                  borderWidth: 1,
                  backgroundColor: tokens.card,
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: tokens.dooSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcons name="playlist-add-check" size={28} color={tokens.doo} />
                </View>
                <Text
                  style={{
                    color: tokens.foreground,
                    fontSize: 16,
                    fontWeight: "800",
                    fontFamily: "Plus Jakarta Sans",
                  }}
                >
                  {t.noTasksFound}
                </Text>
                <Text
                  style={{
                    color: tokens.mutedForeground,
                    fontSize: 13,
                    textAlign: "center",
                    maxWidth: 320,
                    lineHeight: 18,
                    fontFamily: "Plus Jakarta Sans",
                  }}
                >
                  {activeView !== "all"
                    ? t.noTasksFilterDesc
                    : t.noTasksDesc}
                </Text>
                <Button label={t.addFirstDoo} variant="primary" size="md" onPress={handleOpenAddDoo} style={{ backgroundColor: tokens.doo, borderColor: tokens.doo }} />
              </Card>
            ) : (
              <View style={{ gap: 12 }}>
                {items.map((doo) => (
                  <DooCard
                    key={doo.id}
                    doo={doo}
                    onToggleStatus={handleToggleStatus}
                    onToggleSubtask={handleToggleSubtask}
                    onEdit={handleOpenEditDoo}
                    onDelete={(target) => setDeleteTargetDoo(target)}
                    onOpenDetail={(d) => router.push(`/doos/${d.id}` as any)}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Add / Edit DOO Modal Sheet with Bounded Gray Backing Panel */}
        {showDooModal ? (
          <Modal
            visible={showDooModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDooModal(false)}
          >
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  zIndex: 200,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  ...(Platform.OS === "web" ? ({ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 } as any) : {}),
                },
              ]}
            >
            {/* Scrim Overlay */}
            <Pressable
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: "rgba(15, 23, 42, 0.45)",
                  ...(Platform.OS === "web" ? ({ backdropFilter: "blur(4px)" } as any) : {}),
                },
              ]}
              onPress={() => setShowDooModal(false)}
            />

            {/* Bounded Gray Backing Panel */}
            <View
              style={{
                width: "100%",
                maxWidth: 520,
                borderRadius: tokens.radiusCard + 6,
                backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
                padding: 8,
                zIndex: 201,
              }}
            >
              <Animated.View
                style={{
                  width: "100%",
                  backgroundColor: tokens.card,
                  borderRadius: tokens.radiusCard,
                  padding: 20,
                  gap: 16,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  maxHeight: "85vh" as any,
                }}
              >
                {/* Modal Header */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text
                    style={{
                      color: tokens.foreground,
                      fontSize: 18,
                      fontWeight: "800",
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  >
                    {editingDoo ? "Edit DOO (Task)" : "New DOO (Task)"}
                  </Text>
                  <IconButton
                    icon="close"
                    size="sm"
                    variant="ghost"
                    accessibilityLabel="Close modal"
                    onPress={() => setShowDooModal(false)}
                  />
                </View>

                {modalError ? (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: tokens.radiusControl,
                      backgroundColor: `${tokens.destructive}18`,
                      borderColor: tokens.destructive,
                      borderWidth: 1,
                    }}
                  >
                    <Text style={{ color: tokens.destructive, fontSize: 12, fontWeight: "600" }}>
                      {modalError}
                    </Text>
                  </View>
                ) : null}

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                  {/* Task Title */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                      Task Title *
                    </Text>
                    <TextInput
                      value={modalTitle}
                      onChangeText={setModalTitle}
                      placeholder="e.g. Research flight tickets, Buy birthday present"
                      placeholderTextColor={tokens.mutedForeground}
                      style={{
                        height: 42,
                        paddingHorizontal: 12,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: tokens.muted,
                        color: tokens.foreground,
                        borderColor: tokens.border,
                        borderWidth: 1,
                        fontSize: 14,
                        fontFamily: "Plus Jakarta Sans",
                      }}
                    />
                  </View>

                  {/* Priority & Recurrence Row */}
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    {/* Priority Selector */}
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                        Priority
                      </Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {(["low", "medium", "high"] as const).map((p) => (
                          <Pressable
                            key={p}
                            onPress={() => setModalPriority(p)}
                            style={({ hovered }: any) => [
                              {
                                flex: 1,
                                height: 36,
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: tokens.radiusControl,
                                backgroundColor: modalPriority === p ? tokens.doo : hovered ? tokens.dooSoft : tokens.muted,
                                borderWidth: 1,
                                borderColor: modalPriority === p ? tokens.doo : tokens.border,
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <Text
                              style={{
                                color: modalPriority === p ? tokens.primaryForeground : tokens.foreground,
                                fontSize: 12,
                                fontWeight: "700",
                                fontFamily: "Plus Jakarta Sans",
                                textTransform: "capitalize",
                              }}
                            >
                              {p}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    {/* Recurrence Selector */}
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                        Recurrence
                      </Text>
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        {(["none", "daily", "weekly", "monthly"] as const).map((r) => (
                          <Pressable
                            key={r}
                            onPress={() => setModalRecurrence(r)}
                            style={({ hovered }: any) => [
                              {
                                flex: 1,
                                height: 36,
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: tokens.radiusControl,
                                backgroundColor: modalRecurrence === r ? tokens.doo : hovered ? tokens.dooSoft : tokens.muted,
                                borderWidth: 1,
                                borderColor: modalRecurrence === r ? tokens.doo : tokens.border,
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <Text
                              style={{
                                color: modalRecurrence === r ? tokens.primaryForeground : tokens.foreground,
                                fontSize: 11,
                                fontWeight: "700",
                                fontFamily: "Plus Jakarta Sans",
                                textTransform: "capitalize",
                              }}
                            >
                              {r}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Due Date (DatePicker) */}
                  <DatePicker
                    label="Due Date (Optional)"
                    value={modalDueDate}
                    onChange={setModalDueDate}
                    placeholder="Pick due date (e.g. 2026-11-20)"
                  />

                  {/* Link to Wish Selector */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                      Link to a Wish (Optional)
                    </Text>
                    {wishes.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 6 }}
                      >
                        <Pressable
                          onPress={() => setModalWishId("")}
                          style={[
                            {
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: tokens.radiusControl,
                              backgroundColor: !modalWishId ? tokens.wish : tokens.muted,
                              borderWidth: 1,
                              borderColor: !modalWishId ? tokens.wish : tokens.border,
                            },
                            Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                          ]}
                        >
                          <Text
                            style={{
                              color: !modalWishId ? tokens.primaryForeground : tokens.foreground,
                              fontSize: 12,
                              fontWeight: "700",
                            }}
                          >
                            None (Standalone)
                          </Text>
                        </Pressable>
                        {wishes.map((w) => (
                          <Pressable
                            key={w.id}
                            onPress={() => setModalWishId(w.id)}
                            style={[
                              {
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: tokens.radiusControl,
                                backgroundColor: modalWishId === w.id ? tokens.wish : tokens.muted,
                                borderWidth: 1,
                                borderColor: modalWishId === w.id ? tokens.wish : tokens.border,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <MaterialIcons
                              name="auto-awesome"
                              size={12}
                              color={modalWishId === w.id ? tokens.primaryForeground : tokens.wish}
                            />
                            <Text
                              numberOfLines={1}
                              style={{
                                color: modalWishId === w.id ? tokens.primaryForeground : tokens.foreground,
                                fontSize: 12,
                                fontWeight: "700",
                                maxWidth: 140,
                              }}
                            >
                              {w.title}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    ) : (
                      <Text
                        style={{
                          color: tokens.mutedForeground,
                          fontSize: 12,
                          fontStyle: "italic",
                        }}
                      >
                        No wishes created in this workspace yet. Create one in the Wishes tab to link it here!
                      </Text>
                    )}
                  </View>

                  {/* Subtasks Builder */}
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                      Checklist Subtasks ({modalSubtasks.length})
                    </Text>
                    {modalSubtasks.map((st, idx) => (
                      <View
                        key={idx}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: tokens.radiusControl,
                          backgroundColor: tokens.muted,
                        }}
                      >
                        <Text style={{ color: tokens.foreground, fontSize: 13, flex: 1 }}>
                          {st.title}
                        </Text>
                        <IconButton
                          icon="close"
                          size="sm"
                          variant="ghost"
                          accessibilityLabel="Remove subtask"
                          onPress={() => handleRemoveModalSubtask(idx)}
                        />
                      </View>
                    ))}

                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextInput
                        value={newSubtaskInput}
                        onChangeText={setNewSubtaskInput}
                        placeholder="Add step / checklist item..."
                        placeholderTextColor={tokens.mutedForeground}
                        onSubmitEditing={handleAddModalSubtask}
                        style={{
                          flex: 1,
                          height: 38,
                          paddingHorizontal: 12,
                          borderRadius: tokens.radiusControl,
                          backgroundColor: tokens.muted,
                          color: tokens.foreground,
                          borderColor: tokens.border,
                          borderWidth: 1,
                          fontSize: 13,
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      />
                      <Button
                        label="Add"
                        variant="secondary"
                        size="sm"
                        onPress={handleAddModalSubtask}
                      />
                    </View>
                  </View>

                  {/* Notes */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>
                      Notes / Description
                    </Text>
                    <TextInput
                      value={modalNotes}
                      onChangeText={setModalNotes}
                      placeholder="Additional details, reminder specifics..."
                      placeholderTextColor={tokens.mutedForeground}
                      multiline
                      numberOfLines={3}
                      style={{
                        minHeight: 70,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: tokens.muted,
                        color: tokens.foreground,
                        borderColor: tokens.border,
                        borderWidth: 1,
                        fontSize: 13,
                        fontFamily: "Plus Jakarta Sans",
                        textAlignVertical: "top",
                      }}
                    />
                  </View>
                </ScrollView>

                {/* Modal Action Buttons Wrapped in Invisible Container */}
                <View style={{ padding: 4, marginHorizontal: -4, marginTop: 4, backgroundColor: "transparent" }}>
                  <View style={{ flexDirection: width < 396 ? "column" : "row", alignItems: width < 396 ? "stretch" : "center", justifyContent: "flex-end", gap: 10 }}>
                    <Button
                      label={t.cancel}
                      variant="ghost"
                      size="md"
                      disabled={isSubmitting}
                      onPress={() => setShowDooModal(false)}
                      style={width < 396 ? { minHeight: 46 } : undefined}
                    />
                    <Button
                      label={editingDoo ? t.saveChanges : t.saveAndConfirmDoo}
                      variant="primary"
                      size="md"
                      loading={isSubmitting}
                      disabled={isSubmitting}
                      icon={<MaterialIcons name="check" size={16} color={tokens.primaryForeground} />}
                      onPress={handleConfirmDoo}
                      style={{ backgroundColor: tokens.doo, borderColor: tokens.doo, minHeight: 46 }}
                    />
                  </View>
                </View>
              </Animated.View>
            </View>
          </View>
        </Modal>
        ) : null}

        {/* Delete Confirmation Modal for DOOs */}
        <ConfirmDeleteModal
          visible={!!deleteTargetDoo}
          title={t.deleteDooConfirmTitle}
          description={t.deleteDooConfirmDesc}
          itemTitle={deleteTargetDoo?.title}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          isDeleting={isDeletingDoo}
          onCancel={() => setDeleteTargetDoo(null)}
          onConfirm={async () => {
            if (!deleteTargetDoo) return;
            try {
              setIsDeletingDoo(true);
              const target = deleteTargetDoo;
              setDeleteTargetDoo(null);
              await handleDeleteDoo(target);
            } finally {
              setIsDeletingDoo(false);
            }
          }}
        />
      </AdaptiveShell>
    </View>
  );
}
