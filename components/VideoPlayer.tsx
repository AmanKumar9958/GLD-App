import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { AppThemeColors, useTheme } from "../context/ThemeContext";

interface VideoPlayerProps {
  bunnyVideoId: string;
}

export default function VideoPlayer({ bunnyVideoId }: VideoPlayerProps) {
  const { colors } = useTheme();
  
  const pullZone = process.env.EXPO_PUBLIC_BUNNY_PULL_ZONE;
  const referer = process.env.EXPO_PUBLIC_BUNNY_REFERER;

  if (!pullZone || !referer) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Text style={{ color: "red" }}>
          Missing Bunny.net environment variables.
        </Text>
      </View>
    );
  }

  const streamUrl = `https://${pullZone}/${bunnyVideoId}/playlist.m3u8`;
  let validReferer = referer.startsWith("http") ? referer : `https://${referer}`;
  if (!validReferer.endsWith("/")) {
    validReferer += "/";
  }

  const player = useVideoPlayer({ 
      uri: streamUrl, 
      headers: { "Referer": validReferer } 
    }, (player) => {
    player.play();
  });

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <VideoView 
        player={player} 
        style={styles.video} 
        contentFit="contain" 
        nativeControls={true} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
});
