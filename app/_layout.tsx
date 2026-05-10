import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { WishlistProvider } from "../context/WishlistContext";
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { mmkv } from "../utils/storage";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, Suspense } from "react";
import BrandedLoader from "../components/BrandedLoader";
import { useNotifications } from "../hooks/useNotifications";
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const syncStoragePersister = createSyncStoragePersister({
  storage: {
    getItem: (key) => mmkv.getString(key) ?? null,
    setItem: (key, value) => mmkv.set(key, value),
    removeItem: (key) => mmkv.delete(key),
  },
});

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
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: syncStoragePersister }}
          >
            <RootNavigator />
          </PersistQueryClientProvider>
        </WishlistProvider>
      </AuthProvider>
    </>
  );
}



function RootNavigator() {
  const { isAuthResolved } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors.background);
  
  // Initialize push notification listeners
  useNotifications();

  useEffect(() => {
    // Hide native splash screen immediately so BrandedLoader is visible
    SplashScreen.hideAsync();
  }, []);

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
