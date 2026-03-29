import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { ThemePalette, useTheme } from "../context/ThemeContext";
import { signInWithGoogle } from "../services/auth";

export default function Index() {
  const { isAuthResolved, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isSigningIn, setIsSigningIn] = useState(false);

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
          <Spinner size={28} color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.skipRow}>
            <Text style={styles.skipText}>Skip</Text>
          </View>

          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=900&q=80",
            }}
            style={styles.heroImage}
            resizeMode="cover"
          />

          <View style={styles.content}>
            <Text style={styles.title}>
              Choosing the right online{"\n"}
              course <Text style={styles.highlight}>for growth</Text>
            </Text>
            <Text style={styles.subtitle}>
              Lorem Ipsum is simply dummy text of{"\n"}
              the Lorem Ipsum has been the industry&apos;s
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={isSigningIn}
        >
          <View style={styles.googleIconWrap}>
            <Text style={styles.googleIconText}>G</Text>
          </View>
          {isSigningIn ? (
            <Spinner size={22} color={theme.primary} />
          ) : (
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(theme: ThemePalette) {
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 20,
  },
  centeredSpinner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: theme.surface,
    overflow: "hidden",
    shadowColor: "#1E3989",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  skipRow: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 2,
  },
  skipText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.textSecondary,
  },
  heroImage: {
    width: "100%",
    height: 320,
    backgroundColor: theme.border,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    color: theme.text,
    marginBottom: 10,
  },
  highlight: {
    color: theme.primary,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.textSecondary,
    fontWeight: "500",
  },
  googleButton: {
    width: "100%",
    maxWidth: 360,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  googleIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.primary,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
  },
  });
}
