import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  FadeInDown,
} from "react-native-reanimated";

export default function PaymentFailureScreen() {
  const router  = useRouter();
  const { colors } = useTheme();
  const params  = useLocalSearchParams<{
    orderId?:  string;
    code?:     string;
    message?:  string;
    courseId?: string;
  }>();

  const errorMessage = params.message ?? "Your payment could not be processed. Please try again.";

  // ─── Shake animation ─────────────────────────────────────────────────────────
  const shakeX = useSharedValue(0);
  const scale  = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 10 });
    shakeX.value = withSequence(
      withTiming(0,    { duration: 0 }),
      withTiming(12,   { duration: 80 }),
      withTiming(-12,  { duration: 80 }),
      withTiming(8,    { duration: 80 }),
      withTiming(-8,   { duration: 80 }),
      withTiming(0,    { duration: 80 }),
    );
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: shakeX.value }],
  }));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* ── Icon ── */}
        <Animated.View style={[styles.iconWrap, { backgroundColor: "#FEE2E2" }, iconStyle]}>
          <Ionicons name="close" size={48} color="#DC2626" />
        </Animated.View>

        {/* ── Text ── */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={{ alignItems: "center" }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Payment Failed
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {errorMessage}
          </Text>
        </Animated.View>

        {/* ── Error Code ── */}
        {params.code ? (
          <Animated.View
            entering={FadeInDown.delay(300).springify()}
            style={[styles.codeCard, { backgroundColor: colors.surface, borderColor: "#FCA5A5" }]}
          >
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={[styles.codeText, { color: "#DC2626" }]}>Error code: {params.code}</Text>
          </Animated.View>
        ) : null}

        {/* ── Actions ── */}
        <Animated.View entering={FadeInDown.delay(450).springify()} style={styles.actions}>
          {params.courseId ? (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.replace(`/course/${params.courseId}` as any)}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => router.replace("/(tabs)" as any)}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
              Back to Home
            </Text>
          </Pressable>

          <Pressable
            style={styles.linkBtn}
            onPress={() => {
              // Deep link to WhatsApp or email
            }}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>
              Contact Support
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 20,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "500",
    lineHeight: 20,
  },
  codeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  codeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  actions: {
    width: "100%",
    gap: 12,
    marginTop: 8,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 28,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryBtn: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
  },
  secondaryBtnText: {
    fontWeight: "600",
    fontSize: 15,
  },
  linkBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
