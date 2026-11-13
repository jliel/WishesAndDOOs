import React, { useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AmbientMeshBackground } from "@/components/ui/AmbientMeshBackground";
import { formatCurrency } from "@/lib/utils";
import {
  useInteractiveMotion,
  usePulseScale,
  useStaggerEntrance,
} from "@/lib/motion";

const INITIAL_DOOS = [
  { id: "d1", title: "Renew passport", done: true },
  { id: "d2", title: "Book Ryokan in Kyoto", done: true },
  { id: "d3", title: "Reserve JR Rail Pass", done: false },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { tokens } = useAppTheme();
  const { width } = useWindowDimensions();

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  const targetPrice = 3200;
  const [savedAmount, setSavedAmount] = useState(2400);
  const [balance, setBalance] = useState(4850);
  const [doos, setDoos] = useState(INITIAL_DOOS);

  // Apple HIG & Emil Kowalski Fluid Motion hooks
  const heroEntrance = useStaggerEntrance(0);
  const card1Entrance = useStaggerEntrance(1);
  const card2Entrance = useStaggerEntrance(2);
  const card3Entrance = useStaggerEntrance(3);
  const { scale: wishPulseScale, triggerPulse: triggerWishPulse } =
    usePulseScale(1.022);
  const transferChipMotion = useInteractiveMotion({
    hoverScale: 1.045,
    pressScale: 0.95,
    hoverLift: -1.5,
  });

  const fundedPercent = Math.min(
    100,
    Math.round((savedAmount / targetPrice) * 100)
  );
  const doneCount = doos.filter((d) => d.done).length;

  const handleSimulateSave = () => {
    triggerWishPulse();
    if (savedAmount < targetPrice) {
      setSavedAmount((prev) => Math.min(targetPrice, prev + 200));
      setBalance((prev) => prev - 200);
    } else {
      setSavedAmount(2400);
      setBalance(4850);
    }
  };

  const handleToggleDoo = (id: string) => {
    setDoos((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    );
  };

  const monoFont =
    Platform.OS === "web" ? "JetBrains Mono, monospace" : undefined;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.background }}
      edges={["top", "bottom"]}
    >
      <Head>
        <title>Wishes &amp; DOOs — Fund your wishes, finish your DOOs</title>
        <meta
          name="description"
          content="A calm, multi-tenant personal finance, wishlist, and task workspace. Track finances, save for wishes, and organize DOOs with clear explicit controls."
        />
        <link rel="canonical" href="https://wishesanddoos.app/welcome" />
        <meta
          property="og:title"
          content="Wishes &amp; DOOs — Fund your wishes, finish your DOOs"
        />
        <meta
          property="og:description"
          content="Your finances, wishlist goals, and daily tasks—connected in one calm, modern space."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://wishesanddoos.app/welcome" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <AmbientMeshBackground variant="bottom-to-top" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "space-between",
          paddingBottom: isTablet ? 48 : 108,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 1180,
            alignSelf: "center",
            paddingHorizontal: isDesktop ? 40 : isTablet ? 28 : 20,
          }}
        >
          {/* Minimal Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: isDesktop ? 28 : 18,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  backgroundColor: tokens.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  ...(Platform.OS === "web"
                    ? ({
                        boxShadow:
                          "0 8px 18px -4px rgba(15, 23, 42, 0.25)",
                      } as any)
                    : {}),
                }}
              >
                <MaterialIcons
                  name="auto-awesome"
                  size={18}
                  color={tokens.primaryForeground}
                />
              </View>
              <Text
                style={{
                  color: tokens.foreground,
                  fontSize: 18,
                  fontWeight: "800",
                  letterSpacing: -0.4,
                }}
              >
                Wishes & DOOs
              </Text>
            </View>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Button
                label="Sign In"
                variant="ghost"
                size="md"
                onPress={() => router.push("/login")}
              />
              {isTablet ? (
                <Button
                  label="Get Started"
                  variant="primary"
                  size="md"
                  rightIcon={
                    <MaterialIcons
                      name="arrow-forward"
                      size={16}
                      color={tokens.primaryForeground}
                    />
                  }
                  onPress={() => router.push("/register")}
                />
              ) : null}
            </View>
          </View>

          {/* Clean, Focused Hero (Stagger 0) */}
          <Animated.View
            style={[
              {
                alignItems: isTablet ? "center" : "flex-start",
                paddingTop: isDesktop ? 44 : 24,
                paddingBottom: isDesktop ? 48 : 28,
                gap: 16,
              },
              heroEntrance,
            ]}
          >
            <Text
              accessibilityRole="header"
              aria-level={1}
              style={{
                color: tokens.foreground,
                fontSize: isDesktop ? 56 : isTablet ? 44 : 36,
                lineHeight: isDesktop ? 64 : isTablet ? 50 : 42,
                fontWeight: "800",
                letterSpacing: -1.5,
                textAlign: isTablet ? "center" : "left",
                maxWidth: 760,
              }}
            >
              Fund your wishes.{"\n"}
              <Text style={{ color: tokens.finance }}>Finish your DOOs.</Text>
            </Text>

            <Text
              accessibilityRole="header"
              aria-level={1}
              style={{
                color: tokens.mutedForeground,
                fontSize: isDesktop ? 18 : 16,
                lineHeight: isDesktop ? 28 : 24,
                textAlign: isTablet ? "center" : "left",
                maxWidth: 520,
              }}
            >
              Your finances, wishlist goals, and daily tasks—connected in one
              calm, modern space.
            </Text>

            {isTablet ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingTop: 10,
                }}
              >
                <Button
                  label="Get Started"
                  variant="primary"
                  size="lg"
                  rightIcon={
                    <MaterialIcons
                      name="arrow-forward"
                      size={18}
                      color={tokens.primaryForeground}
                    />
                  }
                  onPress={() => router.push("/register")}
                />
                <Button
                  label="Sign In"
                  variant="outline"
                  size="lg"
                  onPress={() => router.push("/login")}
                />
              </View>
            ) : null}
          </Animated.View>

          {/* 3-Card Floating Showcase (Side-by-Side on Desktop, Stacked on Mobile) */}
          <View
            style={{
              flexDirection: isDesktop ? "row" : "column",
              alignItems: "stretch",
              gap: 20,
            }}
          >
            {/* Card 1: Finances (Stagger 1) */}
            <Animated.View style={[{ flex: 1 }, card1Entrance]}>
              <Card
                variant="glass"
                elevation="lg"
                padding="lg"
                style={{
                  flex: 1,
                  justifyContent: "space-between",
                  gap: 20,
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
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: tokens.financeSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons
                        name="account-balance-wallet"
                        size={19}
                        color={tokens.finance}
                      />
                    </View>
                    <Text
                      accessibilityRole="header"
                      aria-level={2}
                      style={{
                        color: tokens.foreground,
                        fontSize: 16,
                        fontWeight: "700",
                      }}
                    >
                      Finances
                    </Text>
                  </View>

                  <Text
                    style={{
                      color: tokens.finance,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    Safe to Spend
                  </Text>
                </View>

                <View style={{ gap: 4 }}>
                  <Text
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 12,
                      fontWeight: "500",
                    }}
                  >
                    Available Balance
                  </Text>
                  <Text
                    style={{
                      color: tokens.foreground,
                      fontSize: 32,
                      fontWeight: "800",
                      letterSpacing: -0.8,
                      fontVariant: ["tabular-nums"],
                      fontFamily: monoFont,
                    }}
                  >
                    {formatCurrency(balance)}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: tokens.financeSoft,
                  }}
                >
                  <View>
                    <Text
                      style={{
                        color: tokens.foreground,
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      Japan Travel Fund
                    </Text>
                    <Text
                      style={{
                        color: tokens.finance,
                        fontSize: 12,
                        fontWeight: "600",
                        fontFamily: monoFont,
                      }}
                    >
                      {formatCurrency(savedAmount)} saved
                    </Text>
                  </View>

                  <Animated.View style={transferChipMotion.animatedStyle}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Simulate +$200 transfer to wish fund"
                      onHoverIn={transferChipMotion.onHoverIn}
                      onHoverOut={transferChipMotion.onHoverOut}
                      onPressIn={transferChipMotion.onPressIn}
                      onPressOut={transferChipMotion.onPressOut}
                      onPress={handleSimulateSave}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: tokens.finance,
                        minHeight: 36,
                        ...(Platform.OS === "web"
                          ? ({
                              cursor: "pointer",
                              boxShadow: transferChipMotion.isHovered
                                ? "0 8px 18px -4px rgba(5, 150, 105, 0.45)"
                                : "0 2px 6px rgba(5, 150, 105, 0.2)",
                              transition:
                                "box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                            } as any)
                          : {}),
                      }}
                    >
                      <MaterialIcons name="add" size={14} color="#FFFFFF" />
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 12,
                          fontWeight: "700",
                          fontFamily: monoFont,
                        }}
                      >
                        {savedAmount < targetPrice ? "$200" : "Reset"}
                      </Text>
                    </Pressable>
                  </Animated.View>
                </View>
              </Card>
            </Animated.View>

            {/* Card 2: Wishes (Center Highlight Card - Stagger 2 + Pulse) */}
            <Animated.View style={[{ flex: 1.1 }, card2Entrance]}>
              <Animated.View
                style={{ flex: 1, transform: [{ scale: wishPulseScale }] }}
              >
                <Card
                  variant="glass"
                  elevation="floating"
                  padding="lg"
                  style={{
                    flex: 1,
                    justifyContent: "space-between",
                    gap: 20,
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
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          backgroundColor: tokens.wishSoft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialIcons
                          name="auto-awesome"
                          size={19}
                          color={tokens.wish}
                        />
                      </View>
                      <Text
                        accessibilityRole="header"
                        aria-level={2}
                        style={{
                          color: tokens.foreground,
                          fontSize: 16,
                          fontWeight: "700",
                        }}
                      >
                        Wishes
                      </Text>
                    </View>

                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: tokens.wishSoft,
                      }}
                    >
                      <Text
                        style={{
                          color: tokens.wish,
                          fontSize: 12,
                          fontWeight: "700",
                          fontFamily: monoFont,
                        }}
                      >
                        {fundedPercent}% Funded
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text
                      style={{
                        color: tokens.mutedForeground,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      ACTIVE GOAL
                    </Text>
                    <Text
                      style={{
                        color: tokens.foreground,
                        fontSize: 22,
                        fontWeight: "800",
                        letterSpacing: -0.4,
                      }}
                    >
                      Kyoto Autumn Trip
                    </Text>
                  </View>

                  <View style={{ gap: 10 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}
                    >
                      <Text
                        style={{
                          color: tokens.foreground,
                          fontSize: 16,
                          fontWeight: "700",
                          fontFamily: monoFont,
                        }}
                      >
                        {formatCurrency(savedAmount)}
                      </Text>
                      <Text
                        style={{
                          color: tokens.mutedForeground,
                          fontSize: 13,
                          fontFamily: monoFont,
                        }}
                      >
                        of {formatCurrency(targetPrice)}
                      </Text>
                    </View>

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
                          width: `${fundedPercent}%`,
                          height: "100%",
                          borderRadius: 999,
                          backgroundColor:
                            fundedPercent >= 100
                              ? tokens.finance
                              : tokens.wish,
                          ...(Platform.OS === "web"
                            ? ({
                                transition:
                                  "width 320ms cubic-bezier(0.16, 1, 0.3, 1), background-color 240ms ease",
                              } as any)
                            : {}),
                        }}
                      />
                    </View>
                  </View>
                </Card>
              </Animated.View>
            </Animated.View>

            {/* Card 3: DOOs (Stagger 3) */}
            <Animated.View style={[{ flex: 1 }, card3Entrance]}>
              <Card
                variant="glass"
                elevation="lg"
                padding="lg"
                style={{
                  flex: 1,
                  justifyContent: "space-between",
                  gap: 16,
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
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: tokens.dooSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons
                        name="checklist"
                        size={19}
                        color={tokens.doo}
                      />
                    </View>
                    <Text
                      accessibilityRole="header"
                      aria-level={2}
                      style={{
                        color: tokens.foreground,
                        fontSize: 16,
                        fontWeight: "700",
                      }}
                    >
                      DOOs
                    </Text>
                  </View>

                  <Text
                    style={{
                      color: tokens.doo,
                      fontSize: 12,
                      fontWeight: "700",
                      fontFamily: monoFont,
                    }}
                  >
                    {doneCount}/{doos.length} Done
                  </Text>
                </View>

                <View style={{ gap: 8 }}>
                  {doos.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: item.done }}
                      aria-checked={item.done}
                      accessibilityLabel={item.title}
                      onPress={() => handleToggleDoo(item.id)}
                      style={(state: any) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        minHeight: 44,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: state.hovered
                          ? tokens.doo
                          : "transparent",
                        backgroundColor: state.hovered
                          ? tokens.dooSoft
                          : tokens.muted,
                        ...(Platform.OS === "web"
                          ? ({
                              cursor: "pointer",
                              transform: state.pressed
                                ? "scale(0.98)"
                                : state.hovered
                                  ? "translateY(-1.5px)"
                                  : "translateY(0px)",
                              transition:
                                "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 160ms ease, border-color 160ms ease",
                            } as any)
                          : {}),
                      })}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          borderWidth: 1.5,
                          borderColor: item.done ? tokens.doo : tokens.border,
                          backgroundColor: item.done
                            ? tokens.doo
                            : tokens.card,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {item.done ? (
                          <MaterialIcons
                            name="check"
                            size={13}
                            color="#FFFFFF"
                          />
                        ) : null}
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          color: item.done
                            ? tokens.mutedForeground
                            : tokens.foreground,
                          fontSize: 14,
                          fontWeight: "600",
                          textDecorationLine: item.done
                            ? "line-through"
                            : "none",
                        }}
                      >
                        {item.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Card>
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      {/* Mobile Bottom Dock (< 768px) */}
      {!isTablet ? (
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 16,
            borderTopWidth: 1,
            borderTopColor: tokens.border,
            backgroundColor: tokens.card,
            gap: 10,
          }}
        >
          <Button
            label="Get Started"
            variant="primary"
            size="lg"
            fullWidth
            rightIcon={
              <MaterialIcons
                name="arrow-forward"
                size={18}
                color={tokens.primaryForeground}
              />
            }
            onPress={() => router.push("/register")}
          />

          <Button
            label="Sign In"
            variant="outline"
            size="lg"
            fullWidth
            onPress={() => router.push("/login")}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
