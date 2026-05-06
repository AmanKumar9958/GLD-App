import { useEffect, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
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
  const { session } = useAuth();
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    if (!session?.user?.id) return;

    // 1. Register for push notifications and sync token
    registerForPushNotificationsAsync(session.user.id);

    // 2. Setup Foreground Listener
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        // You could show a custom in-app banner here if you prefer
        console.log("Notification received in foreground:", notification);
      }
    );

    // 3. Setup Response Listener (when user taps the notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log("Notification tapped, data:", data);

        // Example: Navigate to a specific course if courseId is provided
        if (data?.courseId) {
          router.push(`/course/${data.courseId}`);
        }
      }
    );

    // 4. Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [session?.user?.id, router]);
}

/**
 * Requests permissions, gets the push token, and saves it to Supabase.
 */
async function registerForPushNotificationsAsync(userId: string) {
  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  // Ensure it's a physical device (Emulators often don't support push notifications reliably)
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // Request permission if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    // If permission still denied, abort
    if (finalStatus !== "granted") {
      console.warn("Failed to get push token for push notification! User denied permission.");
      return;
    }

    try {
      // Get the Expo Push Token (or FCM token by using getDevicePushTokenAsync)
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;
        
      if (!projectId) {
        throw new Error("Project ID not found in app.json");
      }

      // We get the standard Expo Push Token
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      token = tokenResponse.data;
      
      console.log("Expo Push Token:", token);

      // Save token to Supabase users table (assuming 'fcm_token' column exists)
      const { error } = await supabase
        .from("users")
        .update({ fcm_token: token })
        .eq("id", userId);

      if (error) {
        console.error("Error saving push token to Supabase:", error.message);
      } else {
        console.log("Push token successfully synced to Supabase.");
      }
      
    } catch (error) {
      console.error("Error fetching push token:", error);
    }
  } else {
    console.warn("Must use physical device for Push Notifications");
  }

  return token;
}
