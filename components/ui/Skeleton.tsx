import React from "react";
import { StyleProp, ViewStyle } from "react-native";
// @ts-ignore
import { createShimmerPlaceholder } from "react-native-shimmer-placeholder";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";

const ShimmerPlaceholder = createShimmerPlaceholder(LinearGradient);

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Skeleton({
  width,
  height,
  borderRadius = 4,
  style,
}: SkeletonProps) {
  const { isDark } = useTheme();

  const shimmerColors = isDark
    ? ["#16233A", "#243755", "#16233A"]
    : ["#E5E7EB", "#F3F4F6", "#E5E7EB"];

  return (
    <ShimmerPlaceholder
      shimmerColors={shimmerColors}
      style={[
        { width, height, borderRadius },
        style,
      ]}
    />
  );
}
