import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { WishlistProvider } from "../context/WishlistContext";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <AuthProvider>
        <WishlistProvider>
          <RootNavigator />
        </WishlistProvider>
      </AuthProvider>
    </>
  );
}

function RootNavigator() {
  const { isAuthResolved } = useAuth();

  if (!isAuthResolved) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#1E3989" />
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
      <Stack.Screen name="wishlist" />
    </Stack>
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
