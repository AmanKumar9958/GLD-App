import {
    FirebaseAuthTypes,
    getAuth,
    onAuthStateChanged,
} from "@react-native-firebase/auth";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function TabsLayout() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsAuthResolved(true);
    });

    return unsubscribe;
  }, []);

  if (!isAuthResolved) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#2f74e4" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={{ tabBarActiveTintColor: "#007BFF", headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          // tabBarIcon: () => <Icon name="home" /> (Icon baad mein add kar lenge)
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: "My Courses",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f6f8fc",
  },
});
