import { getAuth } from "@react-native-firebase/auth";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Spinner from "../../components/Spinner";
import { signOutCurrentUser } from "../../services/auth";
import {
  UserProfile,
  getUserProfileWithCache,
} from "../../services/userProfile";

const defaultAvatar =
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80";

const menuItems = [
  { id: "edit", label: "Edit profile", icon: "👤" },
  { id: "fav", label: "My Favorite", icon: "💙" },
  { id: "pay", label: "Payment method", icon: "💳" },
  { id: "settings", label: "Settings", icon: "⚙️" },
  { id: "security", label: "Security", icon: "🛡️" },
  { id: "privacy", label: "Privacy policy", icon: "📄" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const opacity = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      opacity.value = withTiming(1, { duration: 280 });
      return () => {
        opacity.value = 0;
      };
    }, [opacity]),
  );

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      if (!currentUser?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        const { cached, fresh } = await getUserProfileWithCache(
          currentUser.uid,
        );

        if (!active) {
          return;
        }

        if (cached) {
          setProfile(cached);
        }

        if (fresh) {
          setProfile(fresh);
        }

        if (!cached && !fresh) {
          setProfile({
            uid: currentUser.uid,
            name: currentUser.displayName || "User",
            email: currentUser.email || undefined,
            photoURL: currentUser.photoURL || undefined,
          });
        }
      } catch {
        if (!active) {
          return;
        }

        setProfile({
          uid: currentUser.uid,
          name: currentUser.displayName || "User",
          email: currentUser.email || undefined,
          photoURL: currentUser.photoURL || undefined,
        });
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [
    currentUser?.uid,
    currentUser?.displayName,
    currentUser?.email,
    currentUser?.photoURL,
  ]);

  const displayName = useMemo(() => {
    return profile?.name || currentUser?.displayName || "User";
  }, [profile?.name, currentUser?.displayName]);

  const displayEmail = useMemo(() => {
    return profile?.email || currentUser?.email || "No email found";
  }, [profile?.email, currentUser?.email]);

  const displayPhoto = useMemo(() => {
    return profile?.photoURL || currentUser?.photoURL || defaultAvatar;
  }, [profile?.photoURL, currentUser?.photoURL]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOutCurrentUser();
      setTimeout(() => {
        router.replace("/");
      }, 100);
    } catch (error) {
      setIsLoggingOut(false);
      const message =
        error instanceof Error ? error.message : "Unable to logout right now.";
      Alert.alert("Logout failed", message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <Animated.View style={[styles.flex, animatedStyle]}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileHeader}>
            <Image source={{ uri: displayPhoto }} style={styles.avatar} />
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{displayEmail}</Text>
          </View>

          {isLoading ? (
            <View style={styles.loaderWrap}>
              <Spinner size={32} color="#2f74e4" />
            </View>
          ) : null}

          <View style={styles.listCard}>
            {menuItems.map((item) => (
              <Pressable key={item.id} style={styles.menuItem}>
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconWrap}>
                    <Text style={styles.menuIcon}>{item.icon}</Text>
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[
              styles.logoutButton,
              isLoggingOut && styles.logoutButtonDisabled,
            ]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <Spinner size={22} color="#ffffff" />
            ) : (
              <Text style={styles.logoutText}>Logout</Text>
            )}
          </Pressable>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f6f8fc",
  },
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  profileHeader: {
    marginTop: 8,
    alignItems: "center",
    marginBottom: 18,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: 10,
    backgroundColor: "#e0e6f2",
  },
  name: {
    fontSize: 19,
    color: "#1f2632",
    fontWeight: "700",
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
    color: "#8690a3",
    fontWeight: "500",
  },
  loaderWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  listCard: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#edf1f8",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f4f9",
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e9f1ff",
  },
  menuIcon: {
    fontSize: 12,
  },
  menuLabel: {
    fontSize: 15,
    color: "#273043",
    fontWeight: "600",
  },
  chevron: {
    fontSize: 22,
    color: "#a8b1c2",
    marginTop: -2,
  },
  logoutButton: {
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: "#2f74e4",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    minHeight: 50,
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
