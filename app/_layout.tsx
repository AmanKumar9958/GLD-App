import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { WishlistProvider } from "../context/WishlistContext";
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryStorageAdapter } from "../utils/storage";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useMemo } from "react";
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
  storage: queryStorageAdapter,
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
  const { isAuthResolved, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  const stackScreenOptions = useMemo(
    () => ({
      headerShown: false,
      animation: "slide_from_right" as const,
      contentStyle: { backgroundColor: colors.background },
    }),
    [colors.background]
  );

  useNotifications();

  // Only handle the case where an already-logged-in user lands on the login
  // screen (e.g., app cold-starts while authenticated). The logout redirect
  // is handled declaratively by <Redirect> inside (tabs)/_layout.tsx.
  const segmentKey = segments[0] ?? '__root__';
  useEffect(() => {
    if (!isAuthResolved || !isAuthenticated) return;
    if (segmentKey === '__root__') {
      const t = setTimeout(() => router.replace('/(tabs)'), 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAuthResolved, segmentKey]);

  useEffect(() => {
    if (isAuthResolved) {
      SplashScreen.hideAsync();
    }
  }, [isAuthResolved]);

  if (!isAuthResolved) {
    return <BrandedLoader />;
  }

  return <Stack screenOptions={stackScreenOptions} />;
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