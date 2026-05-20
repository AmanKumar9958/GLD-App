import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

export default function TabsLayout() {
  const { isAuthenticated, isAuthResolved } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const screenOptions = useCallback(
    ({ route }: { route: { name: string } }) => {
      let iconName: React.ComponentProps<typeof Ionicons>["name"] = "ellipse-outline";

      if (route.name === "index") {
        iconName = "home-outline";
      } else if (route.name === "courses") {
        iconName = "library-outline";
      } else if (route.name === "profile") {
        iconName = "person-circle-outline";
      } else if (route.name === "all-courses") {
        iconName = "grid-outline";
      }

      return {
        headerShown: false,
        animation: "shift" as const,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: isDark ? colors.white : colors.primary,
        tabBarInactiveTintColor: isDark ? colors.textSecondary : colors.tabInactive,
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
          <Ionicons name={iconName} size={size} color={color} />
        ),
      };
    },
    [colors.background, colors.primary, colors.white, colors.textSecondary, colors.tabInactive, isDark, styles.tabBar]
  );

  // Show a loader while auth state is being resolved
  if (!isAuthResolved) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  // Declarative redirect — Expo Router's correct pattern for guarding routes.
  // The infinite loop this previously caused was due to an unstable screenOptions
  // reference (new object every render). That is now fixed with useCallback above,
  // so <Redirect> is safe to use here.
  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="all-courses" options={{ title: "All Courses" }} />
      <Tabs.Screen name="courses" options={{ title: "My Courses" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const createStyles = (colors: {
  background: string;
  surface: string;
  border: string;
}) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    tabBar: {
      height: 64,
      paddingBottom: 8,
      paddingTop: 6,
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
    },
  });