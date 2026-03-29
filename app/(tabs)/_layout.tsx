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
      screenOptions={{ tabBarActiveTintColor: "#1E3989", headerShown: false }}
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
});
