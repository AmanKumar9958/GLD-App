import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  type ReactNode,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const isLinearGradientAvailable =
  UIManager.getViewManagerConfig?.("ExpoLinearGradient") != null;

function WelcomeGradient({
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

const features = [
  {
    icon: "book-outline" as const,
    title: "Expert Courses",
    desc: "Learn from top instructors",
    color: "#4F7CFF",
  },
  {
    icon: "videocam-outline" as const,
    title: "HD Video Lessons",
    desc: "Watch anywhere, anytime",
    color: "#E43D64",
  },
  {
    icon: "trophy-outline" as const,
    title: "Track Progress",
    desc: "Achieve your learning goals",
    color: "#F59E0B",
  },
];

export default function WelcomeScreen() {
  const { isAuthenticated, isAuthResolved } = useAuth();

  // If authenticated, skip welcome and go to tabs
  if (isAuthResolved && isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  // ─── Animations ────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const heroScale = useRef(new Animated.Value(0.8)).current;
  const featureAnims = useRef(
    features.map(() => new Animated.Value(0))
  ).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Main content fade + slide
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(heroScale, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered feature cards
    const featureAnimations = featureAnims.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: 400 + index * 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );
    Animated.stagger(120, featureAnimations).start();

    // Button entrance
    Animated.timing(buttonAnim, {
      toValue: 1,
      duration: 500,
      delay: 800,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();

    // Floating hero animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle pulse for CTA
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleGetStarted = () => {
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <WelcomeGradient
        colors={["#EAF0FF", "#F7F0FF", "#FFF0F5"]}
        style={styles.container}
      >
        {/* ─── Decorative circles ──────────────────────── */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <View style={styles.decorCircle3} />

        {/* ─── Hero Image ──────────────────────────────── */}
        <Animated.View
          style={[
            styles.heroWrap,
            {
              opacity: fadeAnim,
              transform: [
                { scale: heroScale },
                { translateY: floatAnim },
              ],
            },
          ]}
        >
          <View style={styles.heroGlow} />
          <Image
            source={require("../assets/images/welcome-hero.png")}
            style={styles.heroImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* ─── Title & Subtitle ────────────────────────── */}
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
            Unlock Your{"\n"}
            <Text style={styles.titleAccent}>Learning Potential</Text>
          </Text>
          <Text style={styles.subtitle}>
            Discover expert-led courses designed to help you grow, achieve, and succeed.
          </Text>
        </Animated.View>

        {/* ─── Feature Cards ───────────────────────────── */}
        <View style={styles.featuresRow}>
          {features.map((feature, index) => (
            <Animated.View
              key={feature.title}
              style={[
                styles.featureCard,
                {
                  opacity: featureAnims[index],
                  transform: [
                    {
                      translateY: featureAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                    {
                      scale: featureAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.featureIconWrap,
                  { backgroundColor: feature.color + "18" },
                ]}
              >
                <Ionicons
                  name={feature.icon}
                  size={20}
                  color={feature.color}
                />
              </View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.desc}</Text>
            </Animated.View>
          ))}
        </View>

        {/* ─── CTA Button ──────────────────────────────── */}
        <Animated.View
          style={[
            styles.ctaWrap,
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
              styles.ctaButton,
              pressed && styles.ctaPressed,
            ]}
            onPress={handleGetStarted}
          >
            <WelcomeGradient
              colors={["#2D68ED", "#6C3CE0", "#E43D64"]}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>Let's Study</Text>
              <View style={styles.ctaArrow}>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </View>
            </WelcomeGradient>
          </Pressable>
        </Animated.View>
      </WelcomeGradient>
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
    paddingBottom: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  // Decorative background circles
  decorCircle1: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(45, 104, 237, 0.08)",
  },
  decorCircle2: {
    position: "absolute",
    bottom: 80,
    left: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(228, 61, 100, 0.06)",
  },
  decorCircle3: {
    position: "absolute",
    top: "40%",
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(108, 60, 224, 0.05)",
  },

  // Hero
  heroWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  heroGlow: {
    position: "absolute",
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.55,
    borderRadius: SCREEN_WIDTH * 0.275,
    backgroundColor: "rgba(45, 104, 237, 0.08)",
  },
  heroImage: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.5,
  },

  // Text
  textBlock: {
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    color: "#0F1F4B",
    textAlign: "center",
    marginBottom: 10,
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

  // Feature cards
  featuresRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
    paddingHorizontal: 2,
  },
  featureCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(45, 104, 237, 0.1)",
    shadowColor: "#1E3989",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F1F4B",
    textAlign: "center",
    marginBottom: 3,
  },
  featureDesc: {
    fontSize: 10,
    color: "#7889B5",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 14,
  },

  // CTA
  ctaWrap: {
    width: "100%",
  },
  ctaButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#2D68ED",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  ctaPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    gap: 10,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  ctaArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
});
