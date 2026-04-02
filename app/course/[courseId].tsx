import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppThemeColors, useTheme } from "../../context/ThemeContext";
import {
    getCourseById,
    getModules,
    getVideos,
} from "../../services/courseService";

type ModuleWithLectureCount = {
  id: string;
  title: string;
  orderIndex: number;
  lectureCount: number;
};

type CourseHeader = {
  title: string;
  category: string;
  mentor: string;
  price: number;
};

function formatPrice(price: number): string {
  return `Rs. ${price}`;
}

export default function CourseDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ courseId?: string | string[] }>();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const courseId =
    typeof params.courseId === "string"
      ? params.courseId
      : params.courseId?.[0] || "";

  const [course, setCourse] = useState<CourseHeader | null>(null);
  const [modules, setModules] = useState<ModuleWithLectureCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCourseDetails = useCallback(async () => {
    if (!courseId) {
      setError("Invalid course.");
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const [courseDoc, courseModules] = await Promise.all([
        getCourseById(courseId),
        getModules(courseId),
      ]);

      if (!courseDoc) {
        setError("Course not found.");
        setModules([]);
        setCourse(null);
        return;
      }

      setCourse({
        title: courseDoc.title,
        category: courseDoc.category,
        mentor: courseDoc.instructorName,
        price: courseDoc.price,
      });

      const moduleWithCounts = await Promise.all(
        courseModules.map(async (module) => {
          try {
            const videos = await getVideos(courseId, module.id);
            return {
              id: module.id,
              title: module.title,
              orderIndex: module.orderIndex,
              lectureCount: videos.length,
            } as ModuleWithLectureCount;
          } catch {
            return {
              id: module.id,
              title: module.title,
              orderIndex: module.orderIndex,
              lectureCount: 0,
            } as ModuleWithLectureCount;
          }
        }),
      );

      setModules(moduleWithCounts.sort((a, b) => a.orderIndex - b.orderIndex));
      setError(null);
    } catch (err) {
      console.error("Failed to load course details:", err);
      setError("Failed to load course modules. Please try again.");
      setModules([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [courseId]);

  useEffect(() => {
    setIsLoading(true);
    void loadCourseDetails();
  }, [loadCourseDetails]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void loadCourseDetails();
  };

  const totalLectures = useMemo(() => {
    return modules.reduce((acc, module) => acc + module.lectureCount, 0);
  }, [modules]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </Pressable>

        <Text style={styles.pageTitle}>Course Modules</Text>

        <View style={styles.rightPlaceholder} />
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {course ? (
          <View style={styles.courseCard}>
            <Text style={styles.courseTitle}>{course.title}</Text>
            <Text style={styles.courseMeta}>by {course.mentor}</Text>
            <Text style={styles.courseMeta}>Category: {course.category}</Text>

            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Ionicons
                  name="layers-outline"
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.badgeText}>{modules.length} modules</Text>
              </View>

              <View style={styles.badge}>
                <Ionicons
                  name="play-circle-outline"
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.badgeText}>{totalLectures} lectures</Text>
              </View>

              <View style={styles.badge}>
                <Ionicons
                  name="pricetag-outline"
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.badgeText}>
                  {formatPrice(course.price)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}

        {!isLoading && error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Something went wrong</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
          </View>
        ) : null}

        {!isLoading && !error && modules.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No modules yet</Text>
            <Text style={styles.emptySubtitle}>
              This course does not have modules at the moment.
            </Text>
          </View>
        ) : null}

        {!isLoading
          ? modules.map((module, index) => (
              <View key={module.id} style={styles.moduleCard}>
                <View style={styles.moduleIndexWrap}>
                  <Text style={styles.moduleIndex}>{index + 1}</Text>
                </View>

                <View style={styles.moduleBody}>
                  <Text style={styles.moduleTitle}>{module.title}</Text>
                  <Text style={styles.moduleSubtitle}>
                    {module.lectureCount} lecture
                    {module.lectureCount === 1 ? "" : "s"}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward-outline"
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
            ))
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    screen: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 14,
      paddingBottom: 24,
      gap: 12,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 10,
    },
    pageTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    rightPlaceholder: {
      width: 22,
      height: 22,
    },
    courseCard: {
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 4,
    },
    courseTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    courseMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    badgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 8,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: colors.surfaceAlt,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    loaderWrap: {
      paddingVertical: 24,
      alignItems: "center",
    },
    emptyState: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 20,
      alignItems: "center",
    },
    emptyTitle: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: "700",
      marginBottom: 4,
    },
    emptySubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
      fontWeight: "500",
    },
    moduleCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 10,
    },
    moduleIndexWrap: {
      width: 30,
      height: 30,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "#223253" : "#E8EEFF",
      borderWidth: 1,
      borderColor: colors.border,
    },
    moduleIndex: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    moduleBody: {
      flex: 1,
      gap: 2,
    },
    moduleTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    moduleSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "600",
    },
  });
