import React from 'react';
import { View, StyleSheet } from 'react-native';
import Skeleton from './Skeleton';
import { useTheme } from '../../context/ThemeContext';

export default function VideoListSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.videoItem, { borderBottomColor: colors.border }]}>
      <Skeleton width={24} height={24} borderRadius={12} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="80%" height={14} style={{ marginBottom: 6 }} />
        <Skeleton width="30%" height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  videoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
});
