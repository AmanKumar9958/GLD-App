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
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  FadeInDown,
} from "react-native-reanimated";

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ orderId?: string; courseTitle?: string; courseId?: string }>();

  const courseTitle = params.courseTitle ?? "Your Course";
  const courseId    = params.courseId;

  // ─── Animations ─────────────────────────────────────────────────────────────
  const scale   = useSharedValue(0);
  const opacity = useSharedValue(0);
  const ring    = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    scale.value   = withSequence(
      withSpring(1.2, { damping: 8 }),
      withSpring(1,   { damping: 12 })
    );
    ring.value = withDelay(
      300,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + ring.value * 0.7 }],
    opacity:   (1 - ring.value) * 0.5,
  }));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* ── Ripple ring ── */}
        <Animated.View style={[styles.ring, { borderColor: "#22C55E" }, ringStyle]} />

        {/* ── Icon ── */}
        <Animated.View style={[styles.iconWrap, { backgroundColor: "#DCFCE7" }, iconStyle]}>
          <Ionicons name="checkmark" size={48} color="#16A34A" />
        </Animated.View>

        {/* ── Text ── */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Payment Successful! 🎉
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            You are now enrolled in
          </Text>
          <Text style={[styles.courseTitle, { color: colors.primary }]} numberOfLines={2}>
            {courseTitle}
          </Text>
        </Animated.View>

        {/* ── Order ID ── */}
        {params.orderId ? (
          <Animated.View
            entering={FadeInDown.delay(350).springify()}
            style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.orderLabel, { color: colors.textSecondary }]}>Order ID</Text>
            <Text style={[styles.orderId, { color: colors.textPrimary }]}>{params.orderId}</Text>
          </Animated.View>
        ) : null}

        {/* ── CTA ── */}
        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.actions}>
          {courseId ? (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push(`/course/${courseId}` as any)}
            >
              <Ionicons name="play-circle" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Start Learning</Text>
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
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 20,
  },
  ring: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
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
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 6,
    fontWeight: "500",
  },
  courseTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  orderCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    width: "100%",
  },
  orderLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  orderId: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
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
});
