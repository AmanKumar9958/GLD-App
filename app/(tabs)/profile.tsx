import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Spinner from "../../components/Spinner";
import { useAuth } from "../../context/AuthContext";
import { AppThemeColors, useTheme } from "../../context/ThemeContext";
import { signOutCurrentUser } from "../../services/auth";
import {
  UserProfile,
  getUserProfileWithCache,
} from "../../services/userProfile";

const defaultAvatar =
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80";

type ProfileMenuItem = {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

const menuItems: ProfileMenuItem[] = [
  { id: "fav", label: "My Favorite", icon: "heart-outline" },
  { id: "my-courses", label: "My Courses", icon: "book-outline" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

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

  const confirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      setIsLogoutModalVisible(false);
      await signOutCurrentUser();
      // Do nothing here — _layout.tsx onAuthStateChanged handles the redirect
    } catch (error) {
      setIsLoggingOut(false);
      const message =
        error instanceof Error ? error.message : "Unable to logout right now.";
      Alert.alert("Logout failed", message);
    }
  };

  const handleLogout = () => {
    setIsLogoutModalVisible(true);
  };

  const handleMenuPress = (itemId: ProfileMenuItem["id"]) => {
    if (itemId === "my-courses") {
      router.push("/(tabs)/courses");
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
              <Spinner size={32} color={colors.primary} />
            </View>
          ) : null}

          <View style={styles.listCard}>
            {menuItems.map((item) => (
              <Pressable
                key={item.id}
                style={styles.menuItem}
                onPress={() => handleMenuPress(item.id)}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconWrap}>
                    <Ionicons
                      name={item.icon}
                      size={16}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textSecondary}
                />
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

        <Modal
          visible={isLogoutModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsLogoutModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.logoutModalCard}>
              <View style={styles.logoutIconWrap}>
                <Ionicons
                  name="log-out-outline"
                  size={24}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.modalTitle}>Logout</Text>
              <Text style={styles.modalSubtitle}>
                Are you sure you want to logout from your account?
              </Text>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setIsLogoutModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable style={styles.confirmButton} onPress={confirmLogout}>
                  <Text style={styles.confirmButtonText}>Yes, Logout</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
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
      marginTop: 12,
      alignItems: "center",
      marginBottom: 18,
    },
    avatar: {
      width: 84,
      height: 84,
      borderRadius: 42,
      marginBottom: 10,
      backgroundColor: colors.border,
    },
    name: {
      fontSize: 19,
      color: colors.textPrimary,
      fontWeight: "700",
      marginBottom: 4,
    },
    email: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    loaderWrap: {
      alignItems: "center",
      marginBottom: 12,
    },
    listCard: {
      borderRadius: 16,
      backgroundColor: colors.surface,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
      backgroundColor: colors.surfaceAlt,
    },
    menuLabel: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    logoutButton: {
      marginTop: 18,
      borderRadius: 12,
      backgroundColor: colors.danger,
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
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    logoutModalCard: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    logoutIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
      marginBottom: 10,
    },
    modalTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    modalActions: {
      marginTop: 16,
      flexDirection: "row",
      gap: 10,
    },
    cancelButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
    },
    cancelButtonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    confirmButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.danger,
    },
    confirmButtonText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },
  });
