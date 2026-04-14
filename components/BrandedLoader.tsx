import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";

export default function BrandedLoader() {
  const { colors } = useTheme();
  
  // Create shared value for scaling
  const scale = useSharedValue(0.85);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const duration = 2500;
    const intervalTime = duration / 100;
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Pulse animation: smoothly scale up and down continuously
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.85, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // Infinite repeat
      true // Reverse direction
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.Image
        source={require("../assets/images/icon.png")}
        style={[styles.logo, animatedStyle]}
        resizeMode="contain"
      />
      
      <View style={styles.progressContainer}>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View 
            style={[
              styles.fill, 
              { 
                backgroundColor: colors.primary, 
                width: `${progress}%` 
              }
            ]} 
          />
        </View>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          Loading... {progress}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 40,
  },
  progressContainer: {
    width: '60%',
    alignItems: 'center',
    gap: 12,
  },
  track: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  }
});
