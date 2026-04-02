import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { AppThemeColors, useTheme } from "../context/ThemeContext";
import { signInWithGoogle } from "../services/auth";

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

  return (
    <View style={[style, { backgroundColor: colors[0] }]}>{children}</View>
  );
}

export default function Index() {
  const { isAuthResolved, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const quoteSlideProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(quoteSlideProgress, {
        toValue: 1,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setCurrentQuoteIndex(
          (previous) => (previous + 1) % educationQuotes.length,
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

  const quoteAnimatedStyle = {
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

  if (!isAuthResolved) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredSpinner}>
          <Spinner size={28} color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppGradient
        colors={["#EAF2FF", "#FFF3F8", "#E9EEFF"]}
        style={styles.container}
      >
        <View style={styles.heroWrap}>
          <AppGradient
            colors={["#4A86FF", "#F0437A"]}
            style={styles.heroGradientBubble}
          >
            <View style={styles.heroIconRow}>
              <View style={styles.heroIconPill}>
                <Ionicons name="school-outline" size={24} color="#1B3D92" />
              </View>
              <View style={styles.heroIconPill}>
                <Ionicons
                  name="phone-portrait-outline"
                  size={24}
                  color="#A0204C"
                />
              </View>
            </View>
          </AppGradient>

          <Text style={styles.title} numberOfLines={2}>Welcome, learner!</Text>
          <Text style={styles.subtitle}>
            Sign in and keep building your future.
          </Text>
        </View>

        <View style={styles.quotesCard}>
          <Text style={styles.quoteLabel}>Daily Motivation</Text>
          <View style={styles.quoteViewport}>
            <Animated.View style={quoteAnimatedStyle}>
              <Text style={styles.quoteText}>
                {educationQuotes[currentQuoteIndex]}
              </Text>
            </Animated.View>
          </View>
        </View>

        <Pressable
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={isSigningIn}
        >
          <AppGradient
            colors={["#2D68ED", "#E43D64"]}
            style={styles.googleButtonGradient}
          >
            <Ionicons name="logo-google" size={20} color="#FFFFFF" />
            {isSigningIn ? (
              <Spinner size={22} color="#FFFFFF" />
            ) : (
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            )}
          </AppGradient>
        </Pressable>
      </AppGradient>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: 22,
      paddingTop: 18,
      paddingBottom: 26,
      alignItems: "center",
      justifyContent: "center"
    },
    
    centeredSpinner: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    heroWrap: {
      width: "100%",
      alignItems: "center",
      paddingVertical: 24,
      gap: 12,
    },
    heroGradientBubble: {
      width: 182,
      height: 182,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#1F469F",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
      elevation: 5,
    },
    heroIconRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    heroIconPill: {
      width: 62,
      height: 62,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.86)",
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 32,
      lineHeight: 38,
      fontWeight: "800",
      color: "#102A66",
      marginTop: 8,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 20,
      color: "#3D4E7C",
      fontWeight: "600",
      textAlign: "center",
    },
    quotesCard: {
      backgroundColor: "rgba(255,255,255,0.78)",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(84,121,220,0.18)",
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginTop: 10,
      marginBottom: 16,
    },
    quoteLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: "#5E73A5",
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    quoteViewport: {
      minHeight: 44,
      justifyContent: "center",
    },
    quoteText: {
      fontSize: 14,
      lineHeight: 18,
      color: "#344470",
      fontWeight: "600",
      textAlign: "center",
    },
    googleButton: {
      width: "100%",
      borderRadius: 14,
      overflow: "hidden",
    },
    googleButtonGradient: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingVertical: 14,
    },
    googleButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#FFFFFF",
    },
  });
