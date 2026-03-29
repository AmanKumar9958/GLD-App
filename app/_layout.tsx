import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";

function ThemedStatusBar() {
  const { theme } = useTheme();
  return (
    <StatusBar
      style={theme.isDark ? "light" : "dark"}
      translucent
      backgroundColor="transparent"
    />
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedStatusBar />
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { isAuthResolved } = useAuth();
  const { theme } = useTheme();

  if (!isAuthResolved) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: theme.bg }]}
      >
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="all-courses" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
