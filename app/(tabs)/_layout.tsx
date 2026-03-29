import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

export default function TabsLayout() {
  const { isAuthResolved, isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);

  if (!isAuthResolved) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: "shift",
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarActiveTintColor: isDark ? colors.white : colors.primary,
        tabBarInactiveTintColor: isDark
          ? colors.textSecondary
          : colors.tabInactive,
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ color, size }) => {
          let iconName: React.ComponentProps<typeof Ionicons>["name"] =
            "ellipse-outline";

          if (route.name === "index") {
            iconName = "home-outline";
          } else if (route.name === "courses") {
            iconName = "library-outline";
          } else if (route.name === "profile") {
            iconName = "person-circle-outline";
          } else if (route.name === "all-courses") {
            iconName = "grid-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
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
