import React from 'react';
import { View, StyleSheet } from 'react-native';
import Skeleton from './Skeleton';
import { useTheme } from '../../context/ThemeContext';

export default function CourseDetailSkeleton() {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.courseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton width="80%" height={24} style={{ marginBottom: 6 }} />
      <Skeleton width="40%" height={14} style={{ marginBottom: 6 }} />
      <Skeleton width="50%" height={14} style={{ marginBottom: 16 }} />

      <View style={styles.badgeRow}>
        <Skeleton width={80} height={28} borderRadius={14} />
        <Skeleton width={80} height={28} borderRadius={14} />
        <Skeleton width={80} height={28} borderRadius={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  courseCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 0,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
