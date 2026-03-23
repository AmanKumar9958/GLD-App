import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithGoogle } from "../services/auth";

export default function Index() {
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
      router.replace("/(tabs)");
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
            <ActivityIndicator size="small" color="#202124" />
          ) : (
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f4f6",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    shadowColor: "#1a1a1a",
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
    color: "#8a8a8a",
  },
  heroImage: {
    width: "100%",
    height: 320,
    backgroundColor: "#ececef",
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
    color: "#222222",
    marginBottom: 10,
  },
  highlight: {
    color: "#2b6cff",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#9b9b9b",
    fontWeight: "500",
  },
  googleButton: {
    width: "100%",
    maxWidth: 360,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#e4e5ea",
  },
  googleIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f1f3f4",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1a73e8",
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#202124",
  },
});
