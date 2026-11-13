import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { Button } from "./Button";

export interface DatePickerProps {
  label?: string;
  value?: string | null; // "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  minDate?: string;
  maxDate?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseDateString(dateStr?: string | null): { year: number; month: number; day: number } | null {
  if (!dateStr || !dateStr.includes("-")) return null;
  const parts = dateStr.split("-").map((p) => parseInt(p, 10));
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return null;
  }
  return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

function formatDateString(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = "Select date (YYYY-MM-DD)",
  allowClear = true,
  minDate,
  maxDate,
  containerStyle,
}: DatePickerProps) {
  const { tokens, colorMode } = useAppTheme();
  const isDark = colorMode === "dark";

  const [isOpen, setIsOpen] = useState(false);

  // Initialize view date based on current value or today
  const parsed = parseDateString(value);
  const now = new Date();
  const [viewYear, setViewYear] = useState<number>(parsed ? parsed.year : now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(parsed ? parsed.month : now.getMonth());

  const handleOpen = () => {
    const cur = parseDateString(value);
    if (cur) {
      setViewYear(cur.year);
      setViewMonth(cur.month);
    } else {
      const today = new Date();
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
    }
    setIsOpen(true);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formatted = formatDateString(viewYear, viewMonth, day);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleQuickSelectToday = () => {
    const today = new Date();
    const formatted = formatDateString(today.getFullYear(), today.getMonth(), today.getDate());
    onChange(formatted);
    setIsOpen(false);
  };

  const handleQuickSelectTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const formatted = formatDateString(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    onChange(formatted);
    setIsOpen(false);
  };

  const handleQuickSelectInAWeek = () => {
    const inAWeek = new Date();
    inAWeek.setDate(inAWeek.getDate() + 7);
    const formatted = formatDateString(inAWeek.getFullYear(), inAWeek.getMonth(), inAWeek.getDate());
    onChange(formatted);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  // Calendar calculations
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  // Today marker
  const todayStr = formatDateString(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <Text
          style={{
            color: tokens.foreground,
            fontSize: 13,
            fontWeight: "700",
            fontFamily: "Plus Jakarta Sans",
          }}
        >
          {label}
        </Text>
      ) : null}

      {/* Trigger Button Row */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label || "Date Picker"}
        onPress={handleOpen}
        style={({ hovered }: any) => [
          {
            minHeight: 46,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: tokens.radiusControl,
            backgroundColor: tokens.background,
            borderWidth: 1,
            borderColor: isOpen ? tokens.primary : tokens.border,
            gap: 10,
          },
          hovered && {
            borderColor: tokens.primary,
            backgroundColor: tokens.muted,
          },
          Platform.OS === "web" ? ({ cursor: "pointer", transition: "all 160ms ease" } as any) : null,
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <MaterialIcons
            name="calendar-today"
            size={18}
            color={value ? tokens.primary : tokens.mutedForeground}
          />
          <Text
            numberOfLines={1}
            style={{
              color: value ? tokens.foreground : tokens.mutedForeground,
              fontSize: 14,
              fontFamily: value ? "JetBrains Mono" : "Plus Jakarta Sans",
              fontWeight: value ? "600" : "500",
            }}
          >
            {value || placeholder}
          </Text>
        </View>

        {value && allowClear ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear date"
            onPress={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            hitSlop={8}
            style={({ hovered }: any) => [
              {
                padding: 4,
                borderRadius: 999,
                backgroundColor: hovered ? `${tokens.destructive}20` : "transparent",
              },
              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
            ]}
          >
            <MaterialIcons name="close" size={16} color={tokens.mutedForeground} />
          </Pressable>
        ) : (
          <MaterialIcons name="arrow-drop-down" size={22} color={tokens.mutedForeground} />
        )}
      </Pressable>

      {/* Calendar Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
            zIndex: 120,
          }}
        >
          {/* Backdrop Dismiss Scrim */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close date picker"
            style={StyleSheet.absoluteFill}
            onPress={() => setIsOpen(false)}
          />

          {/* Calendar Card */}
          <View
            style={[
              {
                width: "100%",
                maxWidth: 360,
                backgroundColor: tokens.card,
                borderRadius: tokens.radiusCard,
                borderWidth: 1,
                borderColor: tokens.border,
                padding: 18,
                gap: 14,
                zIndex: 121,
              },
              Platform.OS === "web"
                ? ({
                    boxShadow: isDark
                      ? "0 24px 48px -12px rgba(0, 0, 0, 0.75)"
                      : "0 24px 48px -12px rgba(15, 23, 42, 0.25)",
                  } as any)
                : {
                    elevation: 10,
                    shadowColor: tokens.shadowColor,
                    shadowOpacity: 0.2,
                    shadowRadius: 20,
                  },
            ]}
          >
            {/* Header: Month & Year Navigator */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 4,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={handlePrevMonth}
                style={({ hovered }: any) => [
                  {
                    width: 36,
                    height: 36,
                    borderRadius: tokens.radiusControl,
                    backgroundColor: hovered ? tokens.muted : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                ]}
              >
                <MaterialIcons name="chevron-left" size={22} color={tokens.foreground} />
              </Pressable>

              <Text
                style={{
                  color: tokens.foreground,
                  fontSize: 16,
                  fontWeight: "800",
                  fontFamily: "Plus Jakarta Sans",
                }}
              >
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                onPress={handleNextMonth}
                style={({ hovered }: any) => [
                  {
                    width: 36,
                    height: 36,
                    borderRadius: tokens.radiusControl,
                    backgroundColor: hovered ? tokens.muted : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                ]}
              >
                <MaterialIcons name="chevron-right" size={22} color={tokens.foreground} />
              </Pressable>
            </View>

            {/* Quick Action Chips (Today, Tomorrow, +1 Week) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
            >
              <Pressable
                accessibilityRole="button"
                onPress={handleQuickSelectToday}
                style={({ hovered }: any) => [
                  {
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: hovered ? tokens.primary : tokens.muted,
                  },
                  Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                ]}
              >
                <Text
                  style={{
                    color: tokens.foreground,
                    fontSize: 11,
                    fontWeight: "700",
                    fontFamily: "Plus Jakarta Sans",
                  }}
                >
                  Today
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleQuickSelectTomorrow}
                style={({ hovered }: any) => [
                  {
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: hovered ? tokens.primary : tokens.muted,
                  },
                  Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                ]}
              >
                <Text
                  style={{
                    color: tokens.foreground,
                    fontSize: 11,
                    fontWeight: "700",
                    fontFamily: "Plus Jakarta Sans",
                  }}
                >
                  Tomorrow
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleQuickSelectInAWeek}
                style={({ hovered }: any) => [
                  {
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: hovered ? tokens.primary : tokens.muted,
                  },
                  Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                ]}
              >
                <Text
                  style={{
                    color: tokens.foreground,
                    fontSize: 11,
                    fontWeight: "700",
                    fontFamily: "Plus Jakarta Sans",
                  }}
                >
                  In 1 Week
                </Text>
              </Pressable>
            </ScrollView>

            {/* Weekday Names Bar */}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {WEEKDAY_NAMES.map((w, idx) => (
                <View
                  key={idx}
                  style={{ width: 38, alignItems: "center", justifyContent: "center" }}
                >
                  <Text
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 12,
                      fontWeight: "700",
                      fontFamily: "Plus Jakarta Sans",
                    }}
                  >
                    {w}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "flex-start",
                gap: 4,
              }}
            >
              {calendarCells.map((day, idx) => {
                if (day === null) {
                  return <View key={idx} style={{ width: 38, height: 38 }} />;
                }

                const cellDateStr = formatDateString(viewYear, viewMonth, day);
                const isSelected = value === cellDateStr;
                const isToday = todayStr === cellDateStr;

                return (
                  <Pressable
                    key={idx}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${cellDateStr}`}
                    onPress={() => handleSelectDay(day)}
                    style={({ hovered }: any) => [
                      {
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isSelected
                          ? tokens.primary
                          : hovered
                          ? tokens.muted
                          : "transparent",
                        borderWidth: isToday && !isSelected ? 1 : 0,
                        borderColor: tokens.primary,
                      },
                      Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
                    ]}
                  >
                    <Text
                      style={{
                        color: isSelected
                          ? tokens.primaryForeground
                          : isToday
                          ? tokens.primary
                          : tokens.foreground,
                        fontSize: 13,
                        fontWeight: isSelected || isToday ? "800" : "600",
                        fontFamily: "JetBrains Mono",
                      }}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Footer Buttons */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: tokens.border,
                gap: 8,
              }}
            >
              {allowClear && value ? (
                <Button
                  label="Clear Date"
                  variant="ghost"
                  size="sm"
                  onPress={handleClear}
                />
              ) : <View />}

              <Button
                label="Done"
                variant="outline"
                size="sm"
                onPress={() => setIsOpen(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
