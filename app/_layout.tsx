import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { WishlistProvider } from "../context/WishlistContext";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, Suspense } from "react";
import BrandedLoader from "../components/BrandedLoader";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar
        style={isDark ? "light" : "dark"}
        translucent
        backgroundColor="transparent"
      />
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
  const { colors } = useTheme();
  const styles = createStyles(colors.background);

  useEffect(() => {
    if (isAuthResolved) {
      SplashScreen.hideAsync();
    }
  }, [isAuthResolved]);

  if (!isAuthResolved) {
    return <BrandedLoader />;
  }

  return (
    <Suspense fallback={<BrandedLoader />}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      />
    </Suspense>
  );
}

const createStyles = (backgroundColor: string) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor,
    },
  });
