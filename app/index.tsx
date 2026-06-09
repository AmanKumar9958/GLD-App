import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  type ReactNode,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { signInWithGoogle } from "../services/auth";
import { supabase } from "../services/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const educationQuotes = [
  "Success is the sum of small efforts repeated every day.",
  "The future belongs to those who prepare for it today.",
  "Learning never exhausts the mind, it empowers it.",
  "Your discipline today builds your dream tomorrow.",
];

const isLinearGradientAvailable =
  UIManager.getViewManagerConfig?.("ExpoLinearGradient") != null;

function AppGradient({
  colors,
  style,
  children,
}: {
  colors: readonly [string, string, ...string[]];
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  if (isLinearGradientAvailable) {
    return (
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={style}
      >
        {children}
      </LinearGradient>
    );
  }
  return <View style={[style, { backgroundColor: colors[0] }]}>{children}</View>;
}

const trustBadges = [
  { icon: "shield-checkmark-outline" as const, label: "Secure" },
  { icon: "people-outline" as const, label: "10K+ Learners" },
  { icon: "star-outline" as const, label: "4.9 ★ Rated" },
];

export default function Index() {
  const { isAuthResolved, isAuthenticated } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isReviewerSigningIn, setIsReviewerSigningIn] = useState(false); // <-- Reviewer Loading State
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

  // ─── Animations ────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const iconScale = useRef(new Animated.Value(0.5)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const quoteCardAnim = useRef(new Animated.Value(0)).current;
  const badgeAnims = useRef(
    trustBadges.map(() => new Animated.Value(0))
  ).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const quoteSlideProgress = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Icon entrance — spring scale + subtle rotation
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 50,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(iconRotate, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Title + subtitle fade/slide
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // 3. Quote card entrance
    Animated.timing(quoteCardAnim, {
      toValue: 1,
      duration: 500,
      delay: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // 4. Trust badges stagger
    const badgeAnimations = badgeAnims.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 350,
        delay: 650 + index * 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );
    Animated.stagger(100, badgeAnimations).start();

    // 5. Button entrance
    Animated.timing(buttonAnim, {
      toValue: 1,
      duration: 500,
      delay: 900,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();

    // 6. Floating icon loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 7. Subtle pulse on button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.025,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 8. Icon glow shimmer
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // ─── Rotating quotes ──────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(quoteSlideProgress, {
        toValue: 1,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setCurrentQuoteIndex(
          (prev) => (prev + 1) % educationQuotes.length
        );
        quoteSlideProgress.setValue(-1);
        Animated.timing(quoteSlideProgress, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    }, 3600);

    return () => clearInterval(interval);
  }, [quoteSlideProgress]);

  const quoteAnimStyle = {
    opacity: quoteSlideProgress.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 1, 0],
    }),
    transform: [
      {
        translateX: quoteSlideProgress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [24, 0, -24],
        }),
      },
    ],
  };

  const iconRotateInterpolated = iconRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["-8deg", "0deg"],
  });

  // ─── Handlers ─────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Google sign-in failed. Please try again.";
      Alert.alert("Sign-in failed", message);
    } finally {
      setIsSigningIn(false);
    }
  };

  // ─── Reviewer Backdoor Handler ────────────────────────────
  const handleReviewerLogin = async () => {
    try {
      setIsReviewerSigningIn(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: 'reviewer@gld.com',
        password: 'GldReview@2026',
      });

      if (error) throw error;
      // Note: AuthContext should automatically detect the session change and redirect to /(tabs)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to login securely.";
      Alert.alert("Reviewer Login Failed", message);
    } finally {
      setIsReviewerSigningIn(false);
    }
  };

  // ─── Auth guards ──────────────────────────────────────────
  if (!isAuthResolved) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredSpinner}>
          <Spinner size={28} color="#2D68ED" />
        </View>
      </SafeAreaView>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <AppGradient
        colors={["#EAF0FF", "#F7F0FF", "#FFF0F5"]}
        style={styles.container}
      >
        {/* Decorative circles */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <View style={styles.decorCircle3} />
        <View style={styles.decorCircle4} />

        {/* ─── App Icon ─────────────────────────────────── */}
        <Animated.View
          style={[
            styles.iconWrap,
            {
              transform: [
                { scale: iconScale },
                { translateY: floatAnim },
                { rotate: iconRotateInterpolated },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.iconGlow,
              {
                opacity: shimmerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.7],
                }),
                transform: [
                  {
                    scale: shimmerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.15],
                    }),
                  },
                ],
              },
            ]}
          />
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.appIcon}
            resizeMode="contain"
          />
        </Animated.View>

        {/* ─── Title & Subtitle ─────────────────────────── */}
        <Animated.View
          style={[
            styles.textBlock,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.title}>
            Welcome Back,{"\n"}
            <Text style={styles.titleAccent}>Learner!</Text>
          </Text>
          <Text style={styles.subtitle}>
            Sign in to continue your learning journey and unlock your potential.
          </Text>
        </Animated.View>

        {/* ─── Quote Card ───────────────────────────────── */}
        <Animated.View
          style={[
            styles.quoteCard,
            {
              opacity: quoteCardAnim,
              transform: [
                {
                  translateY: quoteCardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
                {
                  scale: quoteCardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.quoteLabelRow}>
            <Ionicons name="sparkles" size={13} color="#6C3CE0" />
            <Text style={styles.quoteLabel}>Daily Motivation</Text>
          </View>
          <View style={styles.quoteViewport}>
            <Animated.View style={quoteAnimStyle}>
              <Text style={styles.quoteText}>
                "{educationQuotes[currentQuoteIndex]}"
              </Text>
            </Animated.View>
          </View>
        </Animated.View>

        {/* ─── Trust Badges ─────────────────────────────── */}
        <View style={styles.badgesRow}>
          {trustBadges.map((badge, index) => (
            <Animated.View
              key={badge.label}
              style={[
                styles.badge,
                {
                  opacity: badgeAnims[index],
                  transform: [
                    {
                      translateY: badgeAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Ionicons name={badge.icon} size={14} color="#4F7CFF" />
              <Text style={styles.badgeText}>{badge.label}</Text>
            </Animated.View>
          ))}
        </View>

        {/* ─── Google Sign-In Button ────────────────────── */}
        <Animated.View
          style={[
            styles.buttonWrap,
            {
              opacity: buttonAnim,
              transform: [
                {
                  translateY: buttonAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
                { scale: pulseAnim },
              ],
            },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.googleButtonPressed,
            ]}
            onPress={handleGoogleSignIn}
            disabled={isSigningIn || isReviewerSigningIn}
          >
            <AppGradient
              colors={["#2D68ED", "#6C3CE0", "#E43D64"]}
              style={styles.googleButtonGradient}
            >
              <View style={styles.googleIconCircle}>
                <Ionicons name="logo-google" size={18} color="#FFFFFF" />
              </View>
              {isSigningIn ? (
                <Spinner size={22} color="#FFFFFF" />
              ) : (
                <Text style={styles.googleButtonText}>
                  Continue with Google
                </Text>
              )}
            </AppGradient>
          </Pressable>
        </Animated.View>

        {/* ─── Footer ───────────────────────────────────── */}
        <Animated.View
          style={[
            styles.footer,
            {
              opacity: buttonAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.7],
              }),
            },
          ]}
        >
          <Ionicons name="lock-closed-outline" size={12} color="#8090C0" />
          <Text style={styles.footerText}>
            Secured with Google Authentication
          </Text>
        </Animated.View>

        {/* ─── Play Store Reviewer Backdoor ─────────────── */}
        <Animated.View
          style={[
            styles.reviewerWrap,
            {
              opacity: buttonAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleReviewerLogin}
            disabled={isSigningIn || isReviewerSigningIn}
            hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
          >
            {isReviewerSigningIn ? (
              <Spinner size={14} color="#A0ABC0" />
            ) : (
              <Text style={styles.reviewerText}>App Reviewer Login</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

      </AppGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#EAF0FF",
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  centeredSpinner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF0FF",
  },

  // Decorative circles
  decorCircle1: {
    position: "absolute",
    top: -50,
    left: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(108, 60, 224, 0.06)",
  },
  decorCircle2: {
    position: "absolute",
    top: "30%",
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(45, 104, 237, 0.05)",
  },
  decorCircle3: {
    position: "absolute",
    bottom: 60,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(228, 61, 100, 0.05)",
  },
  decorCircle4: {
    position: "absolute",
    bottom: -30,
    right: 30,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(108, 60, 224, 0.04)",
  },

  // App Icon
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(45, 104, 237, 0.12)",
  },
  appIcon: {
    width: 110,
    height: 110,
    borderRadius: 28,
    shadowColor: "#1E3989",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },

  // Title
  textBlock: {
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    color: "#0F1F4B",
    textAlign: "center",
    marginBottom: 8,
  },
  titleAccent: {
    color: "#2D68ED",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#5A6B9A",
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 300,
  },

  // Quote card
  quoteCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(108, 60, 224, 0.12)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: "#6C3CE0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  quoteLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
  },
  quoteLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6C3CE0",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  quoteViewport: {
    minHeight: 40,
    justifyContent: "center",
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#344470",
    fontWeight: "600",
    textAlign: "center",
    fontStyle: "italic",
  },

  // Trust badges
  badgesRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(79, 124, 255, 0.12)",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#3D5A9E",
  },

  // Google button
  buttonWrap: {
    width: "100%",
  },
  googleButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#2D68ED",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  googleButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  googleButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  googleIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 14,
  },
  footerText: {
    fontSize: 11,
    color: "#8090C0",
    fontWeight: "500",
  },

  // Reviewer Backdoor
  reviewerWrap: {
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewerText: {
    fontSize: 12,
    color: "#A0ABC0", // Very subtle gray
    fontWeight: "500",
    letterSpacing: 0.5,
  },
});