import React from 'react';
import { View, StyleSheet } from 'react-native';
import Skeleton from './Skeleton';
import { useTheme } from '../../context/ThemeContext';

export default function CourseCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.courseRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton width={78} height={62} borderRadius={10} />
      
      <View style={styles.courseBody}>
        <View style={styles.titleRow}>
          <Skeleton width="70%" height={15} borderRadius={4} />
          <Skeleton width={30} height={12} borderRadius={4} />
        </View>

        <Skeleton width="90%" height={12} borderRadius={4} style={{ marginTop: 6, marginBottom: 12 }} />
        <Skeleton width="40%" height={12} borderRadius={4} style={{ marginBottom: 8 }} />
        
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  courseRow: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  courseBody: {
    flex: 1,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  progressTrack: {
    width: "100%",
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
});
