import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../../context/AuthContext";

export default function TabsLayout() {
  const { isAuthResolved, isAuthenticated } = useAuth();

  if (!isAuthResolved) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#1E3989" />
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
        tabBarActiveTintColor: "#1E3989",
        tabBarInactiveTintColor: "#8FA1CC",
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
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="courses" options={{ title: "My Courses" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F4FB",
  },
  tabBar: {
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
    backgroundColor: "#FFFFFF",
    borderTopColor: "#E4EDF9",
    borderTopWidth: 1,
  },
});
