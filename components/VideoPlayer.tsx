import React, { useEffect } from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
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
        <Text style={[styles.errorText, { color: colors.danger }]}>
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

  return <VideoPlayerInner streamUrl={streamUrl} referer={validReferer} colors={colors} />;
}

function VideoPlayerInner({
  streamUrl,
  referer,
  colors,
}: {
  streamUrl: string;
  referer: string;
  colors: AppThemeColors;
}) {
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");

  const player = useVideoPlayer(
    { uri: streamUrl, headers: { Referer: referer } },
    (p) => {
      p.play();
    }
  );

  useEffect(() => {
    if (!player) return;

    const statusSub = player.addListener("statusChange", (event) => {
      if (event.status === "readyToPlay") {
        setStatus("ready");
      } else if (event.status === "error") {
        setStatus("error");
      }
    });

    return () => {
      statusSub.remove();
      // Release the player to free native resources
      player.release();
    };
  }, [player]);

  if (status === "error") {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>
          Failed to load video. Please check your connection and try again.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      {status === "loading" && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 16,
  },
});
