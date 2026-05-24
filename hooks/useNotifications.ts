import { useEffect, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router"; // ← singleton import, NOT the hook
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotifications() {
  // No useRouter() hook here — the singleton router does NOT
  // subscribe this component to navigation state changes.
  // useRouter() was causing RootNavigator to re-render on every
  // navigation event → <Stack> re-subscribed → infinite loop.

  const { user } = useAuth();
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();
  const registeredForUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      registeredForUserId.current = null;
      return;
    }

    if (registeredForUserId.current !== user.id) {
      registeredForUserId.current = user.id;
      registerForPushNotificationsAsync(user.id);
    }

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Notification received in foreground:", notification);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log("Notification tapped, data:", data);
        if (data?.courseId) {
          router.push(`/course/${data.courseId}`); // ← singleton, no subscription
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user?.id]);
}

async function registerForPushNotificationsAsync(userId: string) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1A56DB",
    });
  }

  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device.");
    return;
  }

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
    const deviceTokenResponse = await Notifications.getDevicePushTokenAsync();
    const fcmToken = deviceTokenResponse.data as string;
    console.log("FCM Device Token:", fcmToken);

    const { error } = await supabase
      .from("users")
      .update({ fcm_token: fcmToken })
      .eq("id", userId)
      .neq("fcm_token", fcmToken);

    if (error) {
      console.error("Error saving FCM token:", error.message);
    } else {
      console.log("FCM token successfully synced to Supabase.");
    }
  } catch (error) {
    console.error("Error fetching FCM device token:", error);
  }
}