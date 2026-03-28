import {
  FirebaseAuthTypes,
  getAuth,
  onAuthStateChanged,
} from "@react-native-firebase/auth";
import { Tabs } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";

export default function TabsLayout() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const navigation = useNavigation();
  const hasRedirected = useRef(false);

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsAuthResolved(true);

      if (!nextUser && !hasRedirected.current) {
        hasRedirected.current = true;
        setTimeout(() => {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "index" }], // this targets app/index.tsx (root index)
            })
          );
        }, 50);
      }

      if (nextUser) {
        hasRedirected.current = false; // reset on login
      }
    });

    return unsubscribe;
  }, [navigation]);

  if (!isAuthResolved || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#1E3989" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{ tabBarActiveTintColor: "#1E3989", headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="courses" options={{ title: "My Courses" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});