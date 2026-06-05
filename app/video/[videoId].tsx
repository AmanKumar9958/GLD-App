import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { AppThemeColors, useTheme } from "../../context/ThemeContext";
import { getVideoById } from "../../services/courseService";
import { DatabaseVideo } from "../../types/supabase";
import VideoPlayer from "../../components/VideoPlayer";
import Skeleton from "../../components/ui/Skeleton";

export default function VideoDetailScreen() {
  useKeepAwake(); // Keep screen from sleeping during video playback
  const router = useRouter();
  const params = useLocalSearchParams<{ videoId?: string | string[] }>();
  const { colors, isDark } = useTheme();

  const videoId =
    typeof params.videoId === "string"
      ? params.videoId
      : params.videoId?.[0] || "";

  const [video, setVideo] = useState<DatabaseVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const toggleDescription = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDescExpanded((prev) => !prev);
  };

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    async function loadVideo() {
      if (!videoId) {
        if (isMounted.current) {
          setError("Invalid video selection.");
          setIsLoading(false);
        }
        return;
      }
      try {
        const v = await getVideoById(videoId);
        if (isMounted.current) {
          if (!v) {
            setError("Video not found.");
          } else {
            setVideo(v);
          }
        }
      } catch (err) {
        console.error("Load video err:", err);
        if (isMounted.current) {
          setError("Failed to load video properties.");
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    }
    void loadVideo();
  }, [videoId]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
           <View style={styles.playerContainer}>
              <Skeleton width="100%" height="100%" style={{ aspectRatio: 16/9, borderRadius: 12 }} />
           </View>
           <View style={[styles.metaSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Skeleton width="70%" height={24} style={{ marginBottom: 12 }} />
              <Skeleton width={60} height={20} borderRadius={4} />
           </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error || !video) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.headerRow, { paddingHorizontal: 16 }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {video.title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.playerContainer}>
           <VideoPlayer bunnyVideoId={video.bunny_video_id} />
        </View>
        
        <View style={[styles.metaSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.videoTitle, { color: colors.textPrimary }]}>{video.title}</Text>
            {video.is_preview && (
              <View style={[styles.previewBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.previewText, { color: colors.primary }]}>Preview</Text>
              </View>
            )}
        </View>

        {/* Collapsible Description Section */}
        {!!video.description?.trim() && (
          <View style={[styles.descriptionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              onPress={toggleDescription}
              style={styles.descriptionHeader}
              hitSlop={4}
            >
              <View style={styles.descriptionLabelRow}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={colors.primary}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.descriptionLabel, { color: colors.textPrimary }]}>
                  About this video
                </Text>
              </View>
              <Ionicons
                name={descExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>

            {descExpanded && (
              <View style={[styles.descriptionBody, { borderTopColor: colors.border }]}>
                <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
                  {video.description}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
  },
  content: {
    paddingBottom: 40,
  },
  playerContainer: {
    marginVertical: 12,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5, // Android shadow
  },
  metaSection: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  videoTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  previewBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  previewText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  descriptionCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  descriptionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  descriptionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
  },
});
