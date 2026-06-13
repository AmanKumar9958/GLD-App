import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { AppThemeColors, useTheme } from "../../context/ThemeContext";
import {
  getUserCoursesWithCache,
  UserCourse,
} from "../../services/userCourses";
import CourseCardSkeleton from "../../components/ui/CourseCardSkeleton";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";

type FilterKey = "all" | "ongoing" | "completed";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ongoing", label: "Ongoing" },
  { key: "completed", label: "Completed" },
];

export default function CoursesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const { data: courses = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['userCourses', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { fresh } = await getUserCoursesWithCache(user.id);
      return fresh;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const handleRefresh = async () => {
    await refetch();
  };

  const filteredCourses = useMemo(() => {
    if (activeFilter === "all") {
      return courses;
    }

    return courses.filter((course) => course.state === activeFilter);
  }, [activeFilter, courses]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable onPress={handleBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
        </Pressable>
        <Text style={styles.pageTitle}>My Courses</Text>
        <View style={styles.rightPlaceholder} />
      </View>

      <View style={styles.filterRow}>
        {filters.map((filter) => {
          const isActive = activeFilter === filter.key;

          return (
            <Pressable
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              style={styles.filterItem}
            >
              <Text
                style={[
                  styles.filterLabel,
                  isActive && styles.filterLabelActive,
                ]}
              >
                {filter.label}
              </Text>
              <View
                style={[
                  styles.filterUnderline,
                  isActive && styles.filterUnderlineActive,
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.listContainer}>
        {/* @ts-ignore */}
        <FlashList
          data={isLoading ? [] : filteredCourses}
          keyExtractor={(item) => item.id}
          estimatedItemSize={100}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          }
          ListEmptyComponent={
            isLoading ? (
              <>
                {[1, 2, 3, 4].map((key) => (
                  <CourseCardSkeleton key={key} />
                ))}
              </>
            ) : (
              <View style={styles.emptyState}>
                <ExpoImage
                  source={require("../../assets/images/empty-folder.svg")}
                  style={styles.emptyImage}
                  contentFit="contain"
                />
                <Text style={styles.emptyTitle}>No courses found</Text>
                <Text style={styles.emptySubtitle}>
                  Your courses will appear here once you enroll in them.
                </Text>
              </View>
            )
          }
          renderItem={({ item: course }) => {
            const statusText =
              course.progress === 100 ? "Completed" : "In progress";

            return (
              <Pressable
                style={styles.courseRow}
                onPress={() => router.push(`/course/${course.id}` as any)}
              >
                <ExpoImage
                  source={{ uri: course.image }}
                  style={styles.courseImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />

                <View style={styles.courseBody}>
                  <View style={styles.titleRow}>
                    <Text style={styles.courseTitle} numberOfLines={1}>
                      {course.title}
                    </Text>
                  </View>

                  <Text style={styles.courseSubtitle} numberOfLines={1}>
                    {course.subtitle}
                  </Text>

                  <Text style={styles.statusText}>{statusText}</Text>


                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 14,
    },
    pageTitle: {
      fontSize: 20,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    rightPlaceholder: {
      width: 24,
    },
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 6,
    },
    filterItem: {
      alignItems: "center",
      minWidth: 86,
    },
    filterLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "600",
      paddingBottom: 10,
    },
    filterLabelActive: {
      color: colors.textPrimary,
    },
    filterUnderline: {
      width: "100%",
      height: 2,
      backgroundColor: "transparent",
    },
    filterUnderlineActive: {
      backgroundColor: colors.primary,
    },
    listContainer: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 24,
      gap: 12,
    },
    loaderWrap: {
      paddingVertical: 24,
      alignItems: "center",
    },
    emptyState: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 32,
      alignItems: "center",
      marginTop: 8,
    },
    emptyImage: {
      width: 120,
      height: 90,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "800",
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
      fontWeight: "500",
      lineHeight: 18,
    },
    courseRow: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    courseImage: {
      width: 78,
      height: 62,
      borderRadius: 10,
      backgroundColor: colors.border,
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
    courseTitle: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    progressPct: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "700",
    },
    courseSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: 4,
      fontWeight: "500",
    },
    statusText: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 5,
      fontWeight: "600",
    },
    progressTrack: {
      width: "100%",
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    progressBar: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
  });
