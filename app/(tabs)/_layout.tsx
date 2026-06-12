import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

export default function TabsLayout() {
  const { isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();

  const sceneStyle = useMemo(
    () => ({ backgroundColor: colors.background }),
    [colors.background]
  );

  const tabBarStyle = useMemo(
    () => ({
      height: 64,
      paddingBottom: 8,
      paddingTop: 6,
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
    }),
    [colors.surface, colors.border]
  );

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      animation: "shift" as const,
      sceneStyle,
      tabBarActiveTintColor: isDark ? colors.white : colors.primary,
      tabBarInactiveTintColor: isDark ? colors.textSecondary : colors.tabInactive,
      tabBarStyle,
    }),
    [colors.white, colors.primary, colors.textSecondary, colors.tabInactive, isDark, tabBarStyle, sceneStyle]
  );

  // While the root navigator redirects to login, prevent
  // rendering empty/stale tab content during the transition.
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="all-courses"
        options={{
          title: "All Courses",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: "My Courses",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}