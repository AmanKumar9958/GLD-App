import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  const handlePress = () => {
    rotation.value = withTiming(rotation.value + 360, { duration: 500 });
    scale.value = withSequence(
      withSpring(1.35, { damping: 5, stiffness: 280 }),
      withSpring(1, { damping: 9, stiffness: 200 }),
    );
    toggleTheme();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.wrapper, { backgroundColor: theme.surfaceAlt }]}
      hitSlop={8}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={theme.isDark ? "sunny-outline" : "moon-outline"}
          size={18}
          color={theme.primary}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
