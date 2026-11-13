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
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

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
import {
  addSubtask,
  deleteDoo,
  deleteSubtask,
  DooItem,
  fetchDooDetail,
  toggleDooStatus,
  toggleSubtask,
  updateDoo,
} from "@/api/doos";
import { fetchWishes, WishItem } from "@/api/wishes";

export default function DooDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tokens, colorMode } = useAppTheme();
  const isDark = colorMode === "dark";
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);

  // Screen Data State
  const [doo, setDoo] = useState<DooItem | null>(null);
  const [wishes, setWishes] = useState<WishItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Subtask Input in Screen
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high">("medium");
  const [editDueDate, setEditDueDate] = useState("");
  const [editRecurrence, setEditRecurrence] = useState<"none" | "daily" | "weekly" | "monthly" | "custom">("none");
  const [editWishId, setEditWishId] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Notifications & Undo
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [feedbackVariant, setFeedbackVariant] = useState<"finance" | "warning" | "destructive">("finance");
  const [pendingUndo, setPendingUndo] = useState<{ label: string; onUndo: () => Promise<void> } | null>(null);

  // Motion Stagger
  const heroEntrance = useStaggerEntrance(0);
  const checklistEntrance = useStaggerEntrance(1);
  const linkedWishEntrance = useStaggerEntrance(2);

  // Load Task Detail
  const loadTask = useCallback(async () => {
    if (!id) return;
    const token = accessToken || "demo-token";
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [dooRes, wishRes] = await Promise.all([
        fetchDooDetail(token, id),
        fetchWishes(token, { workspace_id: currentWorkspace?.id }).catch(() => null),
      ]);
      setDoo(dooRes);
      if (wishRes) {
        setWishes(wishRes.wishes || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load task details.");
    } finally {
      setIsLoading(false);
    }
  }, [id, accessToken, currentWorkspace?.id]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  // Toggle Task Status
  const handleToggleStatus = async () => {
    if (!doo) return;
    const token = accessToken || "demo-token";
    const previousStatus = doo.status;
    const isNowDone = previousStatus !== "done";

    try {
      const updated = await toggleDooStatus(token, doo.id);
      setDoo(updated);
      setFeedbackVariant(isNowDone ? "finance" : "warning");
      setFeedbackNotice(
        isNowDone ? `Marked "${doo.title}" as completed!` : `Reopened "${doo.title}".`
      );
      setPendingUndo({
        label: "Undo",
        onUndo: async () => {
          const reverted = await toggleDooStatus(token, doo.id, previousStatus);
          setDoo(reverted);
        },
      });
    } catch (err: any) {
      setFeedbackVariant("destructive");
      setFeedbackNotice(err.message || "Failed to update status.");
    }
  };

  // Add Subtask Directly in Screen
  const handleAddSubtask = async () => {
    if (!doo || !newSubtaskTitle.trim()) return;
    const token = accessToken || "demo-token";
    try {
      setIsAddingSubtask(true);
      const updated = await addSubtask(token, doo.id, newSubtaskTitle.trim(), doo.subtasks.length);
      setDoo(updated);
      setNewSubtaskTitle("");
      setFeedbackVariant("finance");
      setFeedbackNotice("Subtask added!");
    } catch (err: any) {
      setFeedbackVariant("destructive");
      setFeedbackNotice(err.message || "Failed to add subtask.");
    } finally {
      setIsAddingSubtask(false);
    }
  };

  // Toggle Subtask Directly
  const handleToggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    if (!doo) return;
    const token = accessToken || "demo-token";
    try {
      const updated = await toggleSubtask(token, doo.id, subtaskId, isCompleted);
      setDoo(updated);
    } catch (err: any) {
      setFeedbackVariant("destructive");
      setFeedbackNotice(err.message || "Failed to update subtask.");
    }
  };

  // Delete Subtask Directly
  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!doo) return;
    const token = accessToken || "demo-token";
    try {
      const updated = await deleteSubtask(token, doo.id, subtaskId);
      setDoo(updated);
      setFeedbackVariant("warning");
      setFeedbackNotice("Subtask deleted.");
    } catch (err: any) {
      setFeedbackVariant("destructive");
      setFeedbackNotice(err.message || "Failed to delete subtask.");
    }
  };

  // Open Edit Modal
  const handleOpenEdit = () => {
    if (!doo) return;
    setEditTitle(doo.title);
    setEditNotes(doo.notes || "");
    setEditPriority(doo.priority);
    setEditDueDate(doo.due_date || "");
    setEditRecurrence(doo.recurrence_rule || "none");
    setEditWishId(doo.wish_id || "");
    setEditError(null);
    setShowEditModal(true);
  };

  // Confirm Edit
  const handleConfirmEdit = async () => {
    if (!doo) return;
    if (!editTitle.trim()) {
      setEditError("Please enter a task title.");
      return;
    }

    const token = accessToken || "demo-token";
    const previousDoo = { ...doo };

    try {
      setIsSubmittingEdit(true);
      setEditError(null);
      const updated = await updateDoo(token, doo.id, {
        title: editTitle.trim(),
        notes: editNotes.trim() || null,
        priority: editPriority,
        due_date: editDueDate.trim() || null,
        recurrence_rule: editRecurrence,
        wish_id: editWishId || null,
      });

      setDoo(updated);
      setShowEditModal(false);
      setFeedbackVariant("warning");
      setFeedbackNotice(`Updated "${updated.title}".`);
      setPendingUndo({
        label: "Undo Edit",
        onUndo: async () => {
          const reverted = await updateDoo(token, doo.id, {
            title: previousDoo.title,
            notes: previousDoo.notes,
            priority: previousDoo.priority,
            due_date: previousDoo.due_date,
            recurrence_rule: previousDoo.recurrence_rule,
            wish_id: previousDoo.wish_id,
          });
          setDoo(reverted);
        },
      });
    } catch (err: any) {
      setEditError(err.message || "Failed to save changes.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!doo) return;
    const token = accessToken || "demo-token";
    try {
      setIsDeleting(true);
      await deleteDoo(token, doo.id);
      setShowDeleteModal(false);
      router.replace("/doos");
    } catch (err: any) {
      setFeedbackVariant("destructive");
      setFeedbackNotice(err.message || "Failed to delete task.");
      setIsDeleting(false);
    }
  };

  const isDone = doo?.status === "done";

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      {/* Screen 9 Perimeter Radial Gradient Origin: "top-to-bottom" */}
      <AmbientMeshBackground variant="top-to-bottom" />

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
        workspaceName={currentWorkspace?.name || "Personal Workspace"}
        workspaceCurrency={currentWorkspace?.currency || "USD"}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 32 : 16,
            paddingTop: 20,
            paddingBottom: 100,
            maxWidth: 960,
            width: "100%",
            alignSelf: "center",
            gap: 20,
          }}
        >
          {/* Top Navigation Row: Back Button & Actions */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to DOOs list"
              onPress={() => router.push("/doos")}
              style={({ hovered }: any) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: tokens.radiusControl,
                  backgroundColor: hovered ? tokens.muted : "transparent",
                },
                Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
              ]}
            >
              <MaterialIcons name="arrow-back" size={18} color={tokens.foreground} />
              <Text
                style={{
                  color: tokens.foreground,
                  fontSize: 14,
                  fontWeight: "700",
                  fontFamily: "Plus Jakarta Sans",
                }}
              >
                Back to DOOs
              </Text>
            </Pressable>

            {doo ? (
              <View style={{ padding: 4, margin: -4, backgroundColor: "transparent" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Button
                    label="Edit"
                    variant="outline"
                    size="sm"
                    icon={<MaterialIcons name="edit" size={15} color={tokens.foreground} />}
                    onPress={handleOpenEdit}
                  />
                  <Button
                    label="Delete"
                    variant="outline"
                    size="sm"
                    icon={<MaterialIcons name="delete-outline" size={15} color={tokens.destructive} />}
                    onPress={() => setShowDeleteModal(true)}
                    style={{ borderColor: `${tokens.destructive}40` }}
                  />
                </View>
              </View>
            ) : null}
          </View>

          {isLoading ? (
            <View style={{ paddingVertical: 80, alignItems: "center", gap: 12 }}>
              <ActivityIndicator size="large" color={tokens.doo} />
              <Text style={{ color: tokens.mutedForeground, fontSize: 13, fontFamily: "Plus Jakarta Sans" }}>
                Loading task details...
              </Text>
            </View>
          ) : errorMessage || !doo ? (
            <Card style={{ padding: 32, alignItems: "center", gap: 14 }}>
              <MaterialIcons name="error-outline" size={36} color={tokens.destructive} />
              <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: "700" }}>
                {errorMessage || "Task not found."}
              </Text>
              <Button label="Back to DOOs" variant="primary" size="md" onPress={() => router.push("/doos")} />
            </Card>
          ) : (
            <>
              {/* Hero Task Overview Card */}
              <Animated.View style={heroEntrance}>
                <Card
                  style={{
                    padding: isDesktop ? 28 : 20,
                    borderRadius: tokens.radiusCard,
                    borderColor: isDone ? tokens.finance : tokens.border,
                    borderWidth: 1,
                    backgroundColor: tokens.card,
                    gap: 16,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, flex: 1 }}>
                      {/* Big Interactive Complete Button */}
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isDone }}
                        accessibilityLabel={isDone ? "Mark as todo" : "Mark as completed"}
                        onPress={handleToggleStatus}
                        style={({ hovered }: any) => [
                          {
                            width: 32,
                            height: 32,
                            borderRadius: 8,
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
                          <MaterialIcons name="check" size={20} color={tokens.primaryForeground} />
                        ) : null}
                      </Pressable>

                      <View style={{ flex: 1, gap: 8 }}>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 22,
                            fontWeight: "800",
                            fontFamily: "Plus Jakarta Sans",
                            letterSpacing: -0.3,
                            textDecorationLine: isDone ? "line-through" : "none",
                            opacity: isDone ? 0.7 : 1,
                            lineHeight: 28,
                          }}
                        >
                          {doo.title}
                        </Text>

                        {/* Badges Row */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {/* Priority */}
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 999,
                              backgroundColor:
                                doo.priority === "high"
                                  ? `${tokens.destructive}18`
                                  : doo.priority === "medium"
                                  ? `${tokens.warning}18`
                                  : tokens.muted,
                              borderWidth: 1,
                              borderColor:
                                doo.priority === "high"
                                  ? `${tokens.destructive}40`
                                  : doo.priority === "medium"
                                  ? `${tokens.warning}40`
                                  : tokens.border,
                            }}
                          >
                            <Text
                              style={{
                                color:
                                  doo.priority === "high"
                                    ? tokens.destructive
                                    : doo.priority === "medium"
                                    ? tokens.warning
                                    : tokens.mutedForeground,
                                fontSize: 11,
                                fontWeight: "800",
                                fontFamily: "Plus Jakarta Sans",
                                textTransform: "uppercase",
                                letterSpacing: 0.6,
                              }}
                            >
                              {doo.priority} Priority
                            </Text>
                          </View>

                          {/* Recurrence */}
                          {doo.recurrence_rule && doo.recurrence_rule !== "none" ? (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 999,
                                backgroundColor: tokens.dooSoft,
                                borderWidth: 1,
                                borderColor: `${tokens.doo}40`,
                              }}
                            >
                              <MaterialIcons name="repeat" size={13} color={tokens.doo} />
                              <Text
                                style={{
                                  color: tokens.doo,
                                  fontSize: 11,
                                  fontWeight: "700",
                                  fontFamily: "Plus Jakarta Sans",
                                  textTransform: "capitalize",
                                }}
                              >
                                Recurs {doo.recurrence_rule}
                              </Text>
                            </View>
                          ) : null}

                          {/* Due Date */}
                          {doo.due_date ? (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 999,
                                backgroundColor: tokens.muted,
                              }}
                            >
                              <MaterialIcons name="event" size={13} color={tokens.mutedForeground} />
                              <Text
                                style={{
                                  color: tokens.foreground,
                                  fontSize: 11,
                                  fontWeight: "700",
                                  fontFamily: "JetBrains Mono",
                                }}
                              >
                                Due {doo.due_date}
                              </Text>
                            </View>
                          ) : null}

                          {/* Status */}
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 999,
                              backgroundColor: isDone ? tokens.financeSoft : tokens.muted,
                              borderWidth: 1,
                              borderColor: isDone ? tokens.finance : tokens.border,
                            }}
                          >
                            <Text
                              style={{
                                color: isDone ? tokens.finance : tokens.mutedForeground,
                                fontSize: 11,
                                fontWeight: "700",
                                fontFamily: "Plus Jakarta Sans",
                                textTransform: "capitalize",
                              }}
                            >
                              {isDone ? "Completed" : "In Progress"}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Notes / Description */}
                  {doo.notes ? (
                    <View
                      style={{
                        padding: 14,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: tokens.muted,
                        borderWidth: 1,
                        borderColor: tokens.border,
                        gap: 6,
                      }}
                    >
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
                        Notes
                      </Text>
                      <Text
                        style={{
                          color: tokens.foreground,
                          fontSize: 14,
                          lineHeight: 20,
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      >
                        {doo.notes}
                      </Text>
                    </View>
                  ) : null}
                </Card>
              </Animated.View>

              {/* Subtasks Checklist Card */}
              <Animated.View style={checklistEntrance}>
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
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          backgroundColor: tokens.dooSoft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialIcons name="checklist" size={18} color={tokens.doo} />
                      </View>
                      <View>
                        <Text
                          style={{
                            color: tokens.foreground,
                            fontSize: 17,
                            fontWeight: "800",
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          Checklist Sub-tasks
                        </Text>
                        <Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>
                          {doo.done_subtasks} of {doo.total_subtasks} steps completed
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={{
                        color: tokens.doo,
                        fontSize: 16,
                        fontWeight: "900",
                        fontFamily: "JetBrains Mono",
                      }}
                    >
                      {doo.progress_percent}%
                    </Text>
                  </View>

                  {/* Progress Bar */}
                  <View
                    style={{
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: tokens.border,
                      overflow: "hidden",
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

                  {/* Subtask Items */}
                  <View style={{ gap: 8 }}>
                    {doo.subtasks && doo.subtasks.length > 0 ? (
                      doo.subtasks.map((st) => (
                        <View
                          key={st.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: tokens.radiusControl,
                            backgroundColor: tokens.muted,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            gap: 10,
                          }}
                        >
                          <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: st.is_completed }}
                            accessibilityLabel={`Toggle ${st.title}`}
                            onPress={() => handleToggleSubtask(st.id, !st.is_completed)}
                            style={({ hovered }: any) => [
                              {
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                                flex: 1,
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <MaterialIcons
                              name={st.is_completed ? "check-box" : "check-box-outline-blank"}
                              size={20}
                              color={st.is_completed ? tokens.doo : tokens.mutedForeground}
                            />
                            <Text
                              style={{
                                color: st.is_completed ? tokens.mutedForeground : tokens.foreground,
                                fontSize: 14,
                                textDecorationLine: st.is_completed ? "line-through" : "none",
                                fontFamily: "Plus Jakarta Sans",
                                flex: 1,
                              }}
                            >
                              {st.title}
                            </Text>
                          </Pressable>

                          <IconButton
                            icon="delete-outline"
                            size="sm"
                            variant="destructive"
                            accessibilityLabel={`Delete subtask ${st.title}`}
                            onPress={() => handleDeleteSubtask(st.id)}
                          />
                        </View>
                      ))
                    ) : (
                      <Text
                        style={{
                          color: tokens.mutedForeground,
                          fontSize: 13,
                          fontStyle: "italic",
                          textAlign: "center",
                          paddingVertical: 12,
                        }}
                      >
                        No sub-tasks added yet. Add steps below to break down this task!
                      </Text>
                    )}

                    {/* Add Subtask Input Form */}
                    <View style={{ flexDirection: "row", gap: 8, paddingTop: 6 }}>
                      <TextInput
                        value={newSubtaskTitle}
                        onChangeText={setNewSubtaskTitle}
                        placeholder="Add a new checklist step..."
                        placeholderTextColor={tokens.mutedForeground}
                        onSubmitEditing={handleAddSubtask}
                        style={{
                          flex: 1,
                          height: 42,
                          paddingHorizontal: 14,
                          borderRadius: tokens.radiusControl,
                          backgroundColor: tokens.muted,
                          color: tokens.foreground,
                          borderColor: tokens.border,
                          borderWidth: 1,
                          fontSize: 14,
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      />
                      <Button
                        label="Add Step"
                        variant="primary"
                        size="md"
                        loading={isAddingSubtask}
                        disabled={isAddingSubtask || !newSubtaskTitle.trim()}
                        onPress={handleAddSubtask}
                        style={{ backgroundColor: tokens.doo, borderColor: tokens.doo }}
                      />
                    </View>
                  </View>
                </Card>
              </Animated.View>

              {/* Linked Wish Card (if linked) */}
              {doo.wish ? (
                <Animated.View style={linkedWishEntrance}>
                  <Card
                    style={{
                      padding: 20,
                      borderRadius: tokens.radiusCard,
                      borderColor: tokens.border,
                      borderWidth: 1,
                      backgroundColor: tokens.card,
                      gap: 12,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
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
                        <View>
                          <Text
                            style={{
                              color: tokens.foreground,
                              fontSize: 15,
                              fontWeight: "800",
                              fontFamily: "Plus Jakarta Sans",
                            }}
                          >
                            Linked Parent Wish
                          </Text>
                          <Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>
                            Completing this task progresses your Wish milestone
                          </Text>
                        </View>
                      </View>

                      <Button
                        label="View Wish"
                        variant="secondary"
                        size="sm"
                        icon={<MaterialIcons name="arrow-forward" size={14} color={tokens.foreground} />}
                        onPress={() => router.push(`/wishes/${doo.wish?.id}` as any)}
                      />
                    </View>

                    <View
                      style={{
                        padding: 12,
                        borderRadius: tokens.radiusControl,
                        backgroundColor: tokens.muted,
                        borderWidth: 1,
                        borderColor: tokens.border,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        style={{
                          color: tokens.foreground,
                          fontSize: 14,
                          fontWeight: "700",
                          fontFamily: "Plus Jakarta Sans",
                        }}
                      >
                        {doo.wish.title}
                      </Text>
                      {doo.wish.estimated_price !== null && doo.wish.estimated_price !== undefined ? (
                        <Text
                          style={{
                            color: tokens.wish,
                            fontSize: 14,
                            fontWeight: "800",
                            fontFamily: "JetBrains Mono",
                          }}
                        >
                          ${doo.wish.estimated_price}
                        </Text>
                      ) : null}
                    </View>
                  </Card>
                </Animated.View>
              ) : null}
            </>
          )}
        </ScrollView>

        {/* Edit Task Modal Sheet */}
        {showEditModal ? (
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
            <Pressable
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: "rgba(15, 23, 42, 0.45)",
                  ...(Platform.OS === "web" ? ({ backdropFilter: "blur(4px)" } as any) : {}),
                },
              ]}
              onPress={() => setShowEditModal(false)}
            />

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
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: tokens.foreground, fontSize: 18, fontWeight: "800", fontFamily: "Plus Jakarta Sans" }}>
                    Edit DOO Task
                  </Text>
                  <IconButton
                    icon="close"
                    size="sm"
                    variant="ghost"
                    accessibilityLabel="Close modal"
                    onPress={() => setShowEditModal(false)}
                  />
                </View>

                {editError ? (
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
                      {editError}
                    </Text>
                  </View>
                ) : null}

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>Task Title *</Text>
                    <TextInput
                      value={editTitle}
                      onChangeText={setEditTitle}
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

                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>Priority</Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {(["low", "medium", "high"] as const).map((p) => (
                          <Pressable
                            key={p}
                            onPress={() => setEditPriority(p)}
                            style={({ hovered }: any) => [
                              {
                                flex: 1,
                                height: 36,
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: tokens.radiusControl,
                                backgroundColor: editPriority === p ? tokens.doo : hovered ? tokens.dooSoft : tokens.muted,
                                borderWidth: 1,
                                borderColor: editPriority === p ? tokens.doo : tokens.border,
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <Text
                              style={{
                                color: editPriority === p ? tokens.primaryForeground : tokens.foreground,
                                fontSize: 12,
                                fontWeight: "700",
                                textTransform: "capitalize",
                              }}
                            >
                              {p}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>Recurrence</Text>
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        {(["none", "daily", "weekly", "monthly"] as const).map((r) => (
                          <Pressable
                            key={r}
                            onPress={() => setEditRecurrence(r)}
                            style={({ hovered }: any) => [
                              {
                                flex: 1,
                                height: 36,
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: tokens.radiusControl,
                                backgroundColor: editRecurrence === r ? tokens.doo : hovered ? tokens.dooSoft : tokens.muted,
                                borderWidth: 1,
                                borderColor: editRecurrence === r ? tokens.doo : tokens.border,
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <Text
                              style={{
                                color: editRecurrence === r ? tokens.primaryForeground : tokens.foreground,
                                fontSize: 11,
                                fontWeight: "700",
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

                  <DatePicker
                    label="Due Date (Optional)"
                    value={editDueDate}
                    onChange={setEditDueDate}
                    placeholder="Pick due date (e.g. 2026-11-20)"
                  />

                  <View style={{ gap: 6 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>Link to Wish (Optional)</Text>
                    {wishes.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        <Pressable
                          onPress={() => setEditWishId("")}
                          style={[
                            {
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: tokens.radiusControl,
                              backgroundColor: !editWishId ? tokens.wish : tokens.muted,
                              borderWidth: 1,
                              borderColor: !editWishId ? tokens.wish : tokens.border,
                            },
                            Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                          ]}
                        >
                          <Text style={{ color: !editWishId ? tokens.primaryForeground : tokens.foreground, fontSize: 12, fontWeight: "700" }}>
                            None (Standalone)
                          </Text>
                        </Pressable>
                        {wishes.map((w) => (
                          <Pressable
                            key={w.id}
                            onPress={() => setEditWishId(w.id)}
                            style={[
                              {
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: tokens.radiusControl,
                                backgroundColor: editWishId === w.id ? tokens.wish : tokens.muted,
                                borderWidth: 1,
                                borderColor: editWishId === w.id ? tokens.wish : tokens.border,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              },
                              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                            ]}
                          >
                            <MaterialIcons name="auto-awesome" size={12} color={editWishId === w.id ? tokens.primaryForeground : tokens.wish} />
                            <Text numberOfLines={1} style={{ color: editWishId === w.id ? tokens.primaryForeground : tokens.foreground, fontSize: 12, fontWeight: "700", maxWidth: 140 }}>
                              {w.title}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    ) : (
                      <Text style={{ color: tokens.mutedForeground, fontSize: 12, fontStyle: "italic" }}>
                        No wishes created in this workspace yet. Create one in the Wishes tab to link it here!
                      </Text>
                    )}
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "700" }}>Notes</Text>
                    <TextInput
                      value={editNotes}
                      onChangeText={setEditNotes}
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

                <View style={{ padding: 4, marginHorizontal: -4, marginTop: 4, backgroundColor: "transparent" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                    <Button label="Cancel" variant="ghost" size="md" disabled={isSubmittingEdit} onPress={() => setShowEditModal(false)} />
                    <Button
                      label="Save Changes"
                      variant="primary"
                      size="md"
                      loading={isSubmittingEdit}
                      disabled={isSubmittingEdit}
                      icon={<MaterialIcons name="check" size={16} color={tokens.primaryForeground} />}
                      onPress={handleConfirmEdit}
                      style={{ backgroundColor: tokens.doo, borderColor: tokens.doo }}
                    />
                  </View>
                </View>
              </Animated.View>
            </View>
          </View>
        ) : null}

        {/* Delete Modal Sheet */}
        {showDeleteModal ? (
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
            <Pressable
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: "rgba(15, 23, 42, 0.45)",
                  ...(Platform.OS === "web" ? ({ backdropFilter: "blur(4px)" } as any) : {}),
                },
              ]}
              onPress={() => setShowDeleteModal(false)}
            />

            <View
              style={{
                width: "100%",
                maxWidth: 420,
                borderRadius: tokens.radiusCard + 6,
                backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
                padding: 8,
                zIndex: 201,
              }}
            >
              <View
                style={{
                  width: "100%",
                  backgroundColor: tokens.card,
                  borderRadius: tokens.radiusCard,
                  padding: 20,
                  gap: 14,
                  borderWidth: 1,
                  borderColor: tokens.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: `${tokens.destructive}20`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialIcons name="delete" size={20} color={tokens.destructive} />
                  </View>
                  <Text style={{ color: tokens.foreground, fontSize: 17, fontWeight: "800", fontFamily: "Plus Jakarta Sans" }}>
                    Delete Task?
                  </Text>
                </View>

                <Text style={{ color: tokens.mutedForeground, fontSize: 13, lineHeight: 18, fontFamily: "Plus Jakarta Sans" }}>
                  Are you sure you want to delete "{doo?.title}"? This will permanently remove the task and its subtasks.
                </Text>

                <View style={{ padding: 4, marginHorizontal: -4, marginTop: 4, backgroundColor: "transparent" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                    <Button label="Cancel" variant="ghost" size="md" disabled={isDeleting} onPress={() => setShowDeleteModal(false)} />
                    <Button
                      label="Confirm Delete"
                      variant="destructive"
                      size="md"
                      loading={isDeleting}
                      disabled={isDeleting}
                      icon={<MaterialIcons name="delete" size={16} color={tokens.primaryForeground} />}
                      onPress={handleConfirmDelete}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : null}
      </AdaptiveShell>
    </View>
  );
}
