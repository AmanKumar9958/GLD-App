import { useEffect, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";

// Set how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotifications() {
  const router = useRouter();
  // Stabilise the router reference in a ref so it never appears in the
  // useEffect dependency array. The `router` object gets a new identity on
  // every navigation-state change (e.g. the redirect triggered by logout),
  // which was causing the "Maximum update depth exceeded" infinite loop.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  });

  const { user } = useAuth();
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    if (!user?.id) return;

    // 1. Register for push notifications and sync raw FCM token
    registerForPushNotificationsAsync(user.id);

    // 2. Setup Foreground Listener
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Notification received in foreground:", notification);
      }
    );

    // 3. Setup Response Listener (when user taps the notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log("Notification tapped, data:", data);

        if (data?.courseId) {
          routerRef.current.push(`/course/${data.courseId}`);
        }
      }
    );

    // 4. Cleanup listeners on unmount
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user?.id]); // router intentionally omitted – stabilised via routerRef above
}

/**
 * Requests permissions, gets the raw FCM device token, and saves it to Supabase.
 * Uses getDevicePushTokenAsync() (Option B) so the token is compatible with
 * Firebase Admin SDK's sendMulticast() used in the Edge Function.
 */
async function registerForPushNotificationsAsync(userId: string) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1A56DB",
    });
  }

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device.");
    return;
  }

  // Request permission if not already granted
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Push notification permission denied by user.");
    return;
  }

  try {
    // Bug 3 fixed (Option B): Use getDevicePushTokenAsync() to get the raw FCM token.
    // This is the native device token required by Firebase Admin SDK's sendMulticast().
    // Unlike getExpoPushTokenAsync(), this returns a token directly usable by FCM.
    const deviceTokenResponse = await Notifications.getDevicePushTokenAsync();
    const fcmToken = deviceTokenResponse.data as string;

    console.log("FCM Device Token:", fcmToken);

    // Save raw FCM token to Supabase
    const { error } = await supabase
      .from("users")
      .update({ fcm_token: fcmToken })
      .eq("id", userId);

    if (error) {
      console.error("Error saving FCM token to Supabase:", error.message);
    } else {
      console.log("FCM token successfully synced to Supabase.");
    }
  } catch (error) {
    console.error("Error fetching FCM device token:", error);
  }
}
