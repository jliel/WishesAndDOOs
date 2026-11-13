import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { Button } from "@/components/ui/Button";

export interface ConfirmDeleteModalProps {
  visible: boolean;
  title: string;
  description: string;
  itemTitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export function ConfirmDeleteModal({
  visible,
  title,
  description,
  itemTitle,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isDeleting = false,
}: ConfirmDeleteModalProps) {
  const { tokens, colorMode } = useAppTheme();
  const isDark = colorMode === "dark";
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss confirmation modal"
        />

        {/* Framing backing card */}
        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              maxWidth: isDesktop ? 440 : 380,
            },
          ]}
        >
          {/* Top warning icon & title */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: `${tokens.destructive}22`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="delete-forever" size={24} color={tokens.destructive} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: tokens.foreground,
                  fontSize: 17,
                  fontWeight: "800",
                  fontFamily: "Plus Jakarta Sans",
                }}
              >
                {title}
              </Text>
              <Text style={{ color: tokens.mutedForeground, fontSize: 12, marginTop: 2 }}>
                Explicit Confirmation
              </Text>
            </View>
          </View>

          {/* Description & Item Highlight */}
          <Text
            style={{
              color: tokens.mutedForeground,
              fontSize: 13,
              lineHeight: 19,
            }}
          >
            {description}
          </Text>

          {itemTitle ? (
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: tokens.radiusControl,
                backgroundColor: tokens.muted,
                borderLeftWidth: 3,
                borderLeftColor: tokens.destructive,
              }}
            >
              <Text
                numberOfLines={2}
                style={{
                  color: tokens.foreground,
                  fontWeight: "700",
                  fontSize: 13,
                  fontFamily: "Plus Jakarta Sans",
                }}
              >
                {itemTitle}
              </Text>
            </View>
          ) : null}

          {/* Action Button Bar */}
          <View
            style={{
              flexDirection: width < 396 ? "column" : "row",
              gap: 10,
              marginTop: 6,
            }}
          >
            <Button
              variant="outline"
              size="md"
              label={cancelLabel}
              onPress={onCancel}
              style={{ flex: width < 396 ? undefined : 1, minHeight: 46 }}
            />
            <Button
              variant="destructive"
              size="md"
              label={isDeleting ? "Deleting..." : confirmLabel}
              icon="delete-outline"
              onPress={onConfirm}
              disabled={isDeleting}
              style={{ flex: width < 396 ? undefined : 1.2, minHeight: 46 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    zIndex: 1000,
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
        boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.45)",
      } as any,
      default: {
        elevation: 10,
      },
    }),
  },
});
