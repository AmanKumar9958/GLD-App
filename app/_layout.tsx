import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" backgroundColor="#f6f8fc" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Ye aapki Login Screen hai (app/index.tsx) */}
        <Stack.Screen name="index" />

        {/* Ye aapka Tabs wala section hai */}
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
