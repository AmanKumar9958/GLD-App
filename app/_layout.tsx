import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { WishlistProvider } from "../context/WishlistContext";
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryStorageAdapter } from "../utils/storage";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useMemo, useRef } from "react";
import BrandedLoader from "../components/BrandedLoader";
import { useNotifications } from "../hooks/useNotifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const syncStoragePersister = createSyncStoragePersister({
  storage: queryStorageAdapter,
});

// Moved outside AppShell so it never causes PersistQueryClientProvider to remount
const persistOptions = { persister: syncStoragePersister };

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
            persistOptions={persistOptions}  // ← stable, defined outside component
          >
            <NotificationsWrapper />
            <RootNavigator />
          </PersistQueryClientProvider>
        </WishlistProvider>
      </AuthProvider>
    </>
  );
}

// Separate component so useNotifications() never lives inside RootNavigator.
// This prevents the useRouter() subscription from causing RootNavigator
// to re-render on every navigation state change.
function NotificationsWrapper() {
  useNotifications();
  return null;
}

function RootNavigator() {
  const { isAuthResolved, isAuthenticated } = useAuth();
  const { colors } = useTheme();

  const backgroundColorRef = useRef(colors.background);
  useEffect(() => {
    backgroundColorRef.current = colors.background;
  }, [colors.background]);

  const stackScreenOptions = useMemo(
    () => ({
      headerShown: false,
      animation: "slide_from_right" as const,
      contentStyle: { backgroundColor: backgroundColorRef.current },
    }),
    []
  );

  useEffect(() => {
    if (isAuthResolved) {
      SplashScreen.hideAsync();
    }
  }, [isAuthResolved]);

  // Track previous auth state so we only navigate on actual transitions
  // (logout), not on initial load where app/index.tsx handles redirection.
  const prevAuthRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!isAuthResolved) return;

    const wasAuthenticated = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    // Only redirect when the user was previously authenticated and is now
    // logged out (i.e. an actual logout transition).  On initial load
    // (wasAuthenticated === null) we let app/index.tsx handle it.
    if (wasAuthenticated === true && !isAuthenticated) {
      router.replace("/welcome");
    }
  }, [isAuthResolved, isAuthenticated]);

  if (!isAuthResolved) {
    return <BrandedLoader />;
  }

  return <Stack screenOptions={stackScreenOptions} />;
}