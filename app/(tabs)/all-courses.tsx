import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppThemeColors, useTheme } from "../../context/ThemeContext";
import {
  type WishlistCourse,
  useWishlist,
} from "../../context/WishlistContext";
import {
  getModules,
  getPaginatedCourses,
} from "../../services/courseService";
import { supabase } from "../../services/supabase";

type AllCourse = {
  id: string;
  title: string;
  mentor: string;
  category: string;
  price: number;
  image: string;
};

type CategoryFilter = "All" | string;
type PriceFilter = "All" | "Under Rs. 60" | "Rs. 60 - Rs. 70" | "Above Rs. 70";
const COURSES_PAGE_SIZE = 4;
const LOAD_MORE_DELAY_MS = 350;

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=900&q=80";

function getCategoryIcon(
  category: string,
): React.ComponentProps<typeof Ionicons>["name"] {
  const lower = category.toLowerCase();

  if (
    lower.includes("english") ||
    lower.includes("spoken") ||
    lower.includes("language")
  ) {
    return "people-outline";
  }

  if (
    lower.includes("academic") ||
    lower.includes("school") ||
    lower.includes("science") ||
    lower.includes("math")
  ) {
    return "school-outline";
  }

  return "ribbon-outline";
}

function formatPrice(price: number): string {
  return `Rs. ${price}`;
}

function mapToWishlistCategory(category: string): WishlistCourse["category"] {
  const lower = category.toLowerCase();

  if (lower.includes("english") || lower.includes("spoken") || lower === "jb") {
    return "English Spoken";
  }

  if (
    lower.includes("academic") ||
    lower.includes("school") ||
    lower.includes("science")
  ) {
    return "Academics";
  }

  return "Competitive Exams";
}

function CourseSkeletonCard({
  id,
  styles,
}: {
  id: number;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View key={`skeleton-${id}`} style={styles.courseCard}>
      <View style={[styles.courseImage, styles.skeletonBlock]} />

      <View style={styles.courseContent}>
        <View style={[styles.skeletonLine, styles.skeletonTitle]} />
        <View style={[styles.skeletonLine, styles.skeletonMentor]} />
        <View style={[styles.skeletonLine, styles.skeletonMeta]} />
        <View style={[styles.skeletonLine, styles.skeletonMeta]} />
      </View>
    </View>
  );
}

export default function AllCoursesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string | string[] }>();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { isInWishlist, toggleWishlist } = useWishlist();

  const initialCategory = useMemo<CategoryFilter>(() => {
    const rawCategory =
      typeof params.category === "string"
        ? params.category
        : params.category?.[0];

    return rawCategory || "All";
  }, [params.category]);

  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>(initialCategory);
  const [selectedPrice, setSelectedPrice] = useState<PriceFilter>("All");
  const [showFilters, setShowFilters] = useState(false);
  const [moduleCountByCourseId, setModuleCountByCourseId] = useState<
    Record<string, number>
  >({});
  const [isModulePopupVisible, setIsModulePopupVisible] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<AllCourse | null>(null);
  const [selectedCourseModules, setSelectedCourseModules] = useState<string[]>(
    [],
  );
  const [isModulesLoading, setIsModulesLoading] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);

  const loadModuleCounts = async (courseIds: string[]) => {
    const missingIds = courseIds.filter(id => !(id in moduleCountByCourseId));
    if (missingIds.length === 0) return;

    const statsEntries = await Promise.all(
      missingIds.map(async (courseId) => {
        try {
          const modules = await getModules(courseId);
          return [courseId, modules.length] as const;
        } catch {
          return [courseId, 0] as const;
        }
      }),
    );

    setModuleCountByCourseId((previous) => {
      const next = { ...previous };
      for (const [courseId, count] of statsEntries) {
        next[courseId] = count;
      }
      return next;
    });
  };

  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  const { data: allCategories = [] } = useQuery({
    queryKey: ['courseCategories'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('category').eq('is_published', true);
      const set = new Set(data?.map(d => d.category));
      return Array.from(set).filter(Boolean) as string[];
    }
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isCoursesLoading,
    error: fetchErrorValue,
    refetch,
    isRefetching: isRefreshing
  } = useInfiniteQuery({
    queryKey: ['allCourses', selectedCategory, selectedPrice],
    queryFn: ({ pageParam = 0 }) => getPaginatedCourses({ pageParam, category: selectedCategory, priceFilter: selectedPrice }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const fetchError = fetchErrorValue ? "Failed to load courses." : null;

  const courses = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.data.map(c => ({
      id: c.id,
      title: c.title,
      mentor: c.instructor_name || "Instructor",
      category: c.category || "General",
      price: c.price || 0,
      image: c.thumbnail_url || FALLBACK_IMAGE,
    })));
  }, [data]);

  useEffect(() => {
    if (courses.length > 0) {
      void loadModuleCounts(courses.map(c => c.id));
    }
  }, [courses]);

  const categoryFilters = useMemo<CategoryFilter[]>(() => {
    const set = new Set(allCategories);
    if (selectedCategory !== "All") set.add(selectedCategory);
    return ["All", ...[...set].sort()];
  }, [allCategories, selectedCategory]);

  const priceFilters: PriceFilter[] = [
    "All",
    "Under Rs. 60",
    "Rs. 60 - Rs. 70",
    "Above Rs. 70",
  ];

  const filteredCourses = courses;
  const visibleCourses = courses;
  const hasMoreCourses = !!hasNextPage;
  const isLoadingMore = isFetchingNextPage;

  const handleRefresh = async () => {
    await refetch();
  };

  const handleShowMore = () => {
    if (hasNextPage) {
      fetchNextPage();
    }
  };

  const openModulesPopup = async (course: AllCourse) => {
    setSelectedCourse(course);
    setSelectedCourseModules([]);
    setModulesError(null);
    setIsModulePopupVisible(true);
    setIsModulesLoading(true);

    try {
      const modules = await getModules(course.id);
      setSelectedCourseModules(modules.map((module) => module.title));
    } catch (err) {
      console.error("Failed to load modules:", err);
      setModulesError("Failed to load modules. Please try again.");
    } finally {
      setIsModulesLoading(false);
    }
  };

  const closeModulesPopup = () => {
    setIsModulePopupVisible(false);
    setSelectedCourse(null);
    setSelectedCourseModules([]);
    setModulesError(null);
  };

  const handleOpenCourse = () => {
    if (!selectedCourse) {
      return;
    }

    setIsModulePopupVisible(false);
    router.push({
      pathname: "/course/[courseId]",
      params: { courseId: selectedCourse.id },
    });
  };

  const handleToggleWishlist = () => {
    if (!selectedCourse) {
      return;
    }

    toggleWishlist({
      id: selectedCourse.id,
      title: selectedCourse.title,
      mentor: selectedCourse.mentor,
      category: mapToWishlistCategory(selectedCourse.category),
      level: "Beginner",
      lessons: moduleCountByCourseId[selectedCourse.id] ?? 0,
      duration: "--",
      rating: 4.5,
      learners: "--",
      price: formatPrice(selectedCourse.price),
      image: selectedCourse.image,
    });
  };

  const isSelectedCourseWishlisted = selectedCourse
    ? isInWishlist(selectedCourse.id)
    : false;



  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={styles.pageTitle}>All Courses</Text>
        <Pressable
          onPress={() => setShowFilters((prev) => !prev)}
          style={styles.filtersToggleBtn}
          hitSlop={8}
        >
          <Ionicons
            name={showFilters ? "eye-off-outline" : "eye-outline"}
            size={15}
            color={colors.primary}
          />
          <Text style={styles.filtersToggleText}>
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Text>
        </Pressable>
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
        {showFilters ? (
          <View style={styles.filtersCard}>
            <Text style={styles.filtersHeading}>Category</Text>
            <View style={styles.filterRow}>
              {categoryFilters.map((filter) => {
                const isSelected = selectedCategory === filter;

                return (
                  <Pressable
                    key={filter}
                    style={[
                      styles.filterChip,
                      isSelected && styles.filterChipSelected,
                    ]}
                    onPress={() => setSelectedCategory(filter)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextSelected,
                      ]}
                    >
                      {filter}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.filtersHeading}>Price</Text>
            <View style={styles.filterRow}>
              {priceFilters.map((filter) => {
                const isSelected = selectedPrice === filter;

                return (
                  <Pressable
                    key={filter}
                    style={[
                      styles.filterChip,
                      isSelected && styles.filterChipSelected,
                    ]}
                    onPress={() => setSelectedPrice(filter)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextSelected,
                      ]}
                    >
                      {filter}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {isCoursesLoading
          ? Array.from({ length: COURSES_PAGE_SIZE }, (_, idx) => (
            <CourseSkeletonCard key={idx + 1} id={idx + 1} styles={styles} />
          ))
          : null}

        {!isCoursesLoading && fetchError ? (
          <View style={styles.emptyState}>
            <ExpoImage
              source={require("../../assets/images/404-not-found.svg")}
              style={styles.emptyImage}
              contentFit="contain"
            />
            <Text style={styles.emptyTitle}>Something went wrong</Text>
            <Text style={styles.emptySubtitle}>{fetchError}</Text>
          </View>
        ) : null}

        {!isCoursesLoading && !fetchError && filteredCourses.length === 0 ? (
          <View style={styles.emptyState}>
            <ExpoImage
              source={require("../../assets/images/empty-folder.svg")}
              style={styles.emptyImage}
              contentFit="contain"
            />
            <Text style={styles.emptyTitle}>No matching courses</Text>
            <Text style={styles.emptySubtitle}>
              Try changing category or price filters.
            </Text>
          </View>
        ) : null}

        {!isCoursesLoading
          ? visibleCourses.map((course) => (
            <Pressable
              key={course.id}
              style={styles.courseCard}
              onPress={() => void openModulesPopup(course)}
            >
              <Image
                source={{ uri: course.image }}
                style={styles.courseImage}
              />

              <View style={styles.courseContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.courseTitle} numberOfLines={1}>
                    {course.title}
                  </Text>
                  <Text style={styles.priceTag}>
                    {formatPrice(course.price)}
                  </Text>
                </View>

                <Text style={styles.mentorText} numberOfLines={1}>
                  by {course.mentor}
                </Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons
                      name={getCategoryIcon(course.category)}
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={styles.metaText}>{course.category}</Text>
                  </View>

                  <View style={styles.metaItem}>
                    <Ionicons
                      name="layers-outline"
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={styles.secondaryMetaText}>
                      {moduleCountByCourseId[course.id] ?? 0} modules
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))
          : null}

        {!isCoursesLoading && hasMoreCourses ? (
          <Pressable
            style={[
              styles.showMoreButton,
              isLoadingMore && styles.showMoreDisabled,
            ]}
            onPress={handleShowMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <View style={styles.loadingMoreRow}>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={styles.showMoreButtonText}>Loading...</Text>
              </View>
            ) : (
              <Text style={styles.showMoreButtonText}>Show More</Text>
            )}
          </Pressable>
        ) : !isCoursesLoading && filteredCourses.length > 0 ? (
          <View style={styles.noMoreWrap}>
            <Text style={styles.noMoreText}>No more courses</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={isModulePopupVisible}
        onRequestClose={closeModulesPopup}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdropPressable}
            onPress={closeModulesPopup}
          />

          <View style={styles.modulePopupCard}>
            <View style={styles.modulePopupHeaderRow}>
              <Text style={styles.modulePopupTitle}>Course Modules</Text>
              <Pressable onPress={closeModulesPopup} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.modulePopupCourseLabel}>
              Course: {selectedCourse?.title || "-"}
            </Text>

            {isModulesLoading ? (
              <View style={styles.modulePopupLoadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}

            {!isModulesLoading && modulesError ? (
              <Text style={styles.modulePopupErrorText}>{modulesError}</Text>
            ) : null}

            {!isModulesLoading && !modulesError ? (
              <>
                <Text style={styles.modulePopupSubheading}>Modules</Text>

                {selectedCourseModules.length === 0 ? (
                  <Text style={styles.modulePopupEmptyText}>
                    No modules available for this course.
                  </Text>
                ) : (
                  <ScrollView
                    style={styles.modulePopupList}
                    contentContainerStyle={styles.modulePopupListContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {selectedCourseModules.map((moduleName, index) => (
                      <View
                        key={`${moduleName}-${index}`}
                        style={styles.modulePopupItem}
                      >
                        <Text style={styles.modulePopupItemIndex}>
                          {index + 1}.
                        </Text>
                        <Text style={styles.modulePopupItemText}>
                          {moduleName}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.modulePopupActionsRow}>
                  <Pressable
                    style={styles.modulePopupBuyButton}
                    onPress={handleOpenCourse}
                  >
                    <Text style={styles.modulePopupBuyButtonText}>Open Course</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.modulePopupWishlistButton,
                      isSelectedCourseWishlisted &&
                      styles.modulePopupWishlistButtonActive,
                    ]}
                    onPress={handleToggleWishlist}
                  >
                    <Ionicons
                      name={
                        isSelectedCourseWishlisted ? "heart" : "heart-outline"
                      }
                      size={20}
                      color={
                        isSelectedCourseWishlisted
                          ? colors.white
                          : colors.primary
                      }
                    />
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors, isDark: boolean) =>
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
      paddingTop: 18,
      paddingBottom: 10,
    },
    pageTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    filtersToggleBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filtersToggleText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    screen: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 14,
      paddingBottom: 24,
      gap: 12,
    },
    filtersCard: {
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 8,
    },
    filtersHeading: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "700",
      marginTop: 2,
    },
    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    filterChip: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    filterChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceAlt,
    },
    filterChipText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    filterChipTextSelected: {
      color: colors.textPrimary,
    },
    emptyState: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 32,
      alignItems: "center",
      marginTop: 12,
    },
    emptyImage: {
      width: 140,
      height: 100,
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
    showMoreButton: {
      marginTop: 2,
      marginBottom: 6,
      alignSelf: "center",
      minWidth: 140,
      borderRadius: 12,
      backgroundColor: isDark ? "#DDE6FF" : colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 11,
      paddingHorizontal: 20,
    },
    showMoreDisabled: {
      opacity: 0.8,
    },
    loadingMoreRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    showMoreButtonText: {
      color: isDark ? "#0B1220" : colors.white,
      fontSize: 14,
      fontWeight: "700",
    },
    noMoreWrap: {
      marginTop: 2,
      marginBottom: 6,
      alignSelf: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    noMoreText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
    skeletonBlock: {
      backgroundColor: colors.border,
    },
    skeletonLine: {
      borderRadius: 8,
      backgroundColor: colors.border,
      height: 11,
    },
    skeletonTitle: {
      width: "85%",
      height: 14,
    },
    skeletonMentor: {
      width: "58%",
    },
    skeletonMeta: {
      width: "72%",
    },
    courseCard: {
      flexDirection: "row",
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    courseImage: {
      width: 108,
      height: 128,
      backgroundColor: colors.border,
    },
    courseContent: {
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 6,
    },
    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    courseTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    priceTag: {
      fontSize: 11,
      color: isDark ? "#0B1220" : colors.white,
      fontWeight: "700",
      backgroundColor: isDark ? "#C7D4FF" : colors.primary,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    mentorText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      maxWidth: "52%",
    },
    metaText: {
      fontSize: 11,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    secondaryMetaText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    modalRoot: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    modalBackdropPressable: {
      ...StyleSheet.absoluteFillObject,
      flex: 1,
      backgroundColor: isDark
        ? "rgba(2, 8, 20, 0.78)"
        : "rgba(10, 26, 56, 0.58)",
    },
    modulePopupCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 14,
      maxHeight: "72%",
    },
    modulePopupHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    modulePopupTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    modulePopupCourseLabel: {
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: "700",
      marginBottom: 8,
    },
    modulePopupSubheading: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "700",
      marginBottom: 8,
    },
    modulePopupLoadingWrap: {
      alignItems: "center",
      paddingVertical: 18,
    },
    modulePopupErrorText: {
      fontSize: 12,
      color: colors.danger,
      fontWeight: "600",
      paddingVertical: 8,
    },
    modulePopupEmptyText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "600",
      paddingVertical: 8,
    },
    modulePopupList: {
      maxHeight: 250,
    },
    modulePopupListContent: {
      paddingBottom: 4,
      gap: 8,
    },
    modulePopupItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    modulePopupItemIndex: {
      width: 22,
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "700",
    },
    modulePopupItemText: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    modulePopupActionsRow: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    modulePopupBuyButton: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 11,
    },
    modulePopupBuyButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: "700",
    },
    modulePopupWishlistButton: {
      width: 46,
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    modulePopupWishlistButtonActive: {
      backgroundColor: colors.primary,
    },
  });
