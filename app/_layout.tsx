import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
  const { isAuthResolved } = useAuth();
  const { colors } = useTheme();

  const stackScreenOptions = useMemo(
    () => ({
      headerShown: false,
      animation: "slide_from_right" as const,
      contentStyle: { backgroundColor: colors.background },
    }),
    [colors.background]
  );

  useNotifications();

  // Hide the splash screen once auth state is known.
  useEffect(() => {
    if (isAuthResolved) {
      SplashScreen.hideAsync();
    }
  }, [isAuthResolved]);

  // Show loader while auth is resolving.
  if (!isAuthResolved) {
    return <BrandedLoader />;
  }

  // Auth-based redirects are handled declaratively:
  //   Authenticated users at /   → <Redirect href="/(tabs)" /> in app/index.tsx
  //   Unauthenticated users at tabs → <Redirect href="/" /> in (tabs)/_layout.tsx
  // No imperative router.replace() here — it subscribed to nav state via
  // useRouter()/useSegments() and caused an infinite re-render loop.
  return <Stack screenOptions={stackScreenOptions} />;
}