import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppThemeColors, useTheme } from "../../context/ThemeContext";
import { useWishlist } from "../../context/WishlistContext";

type AllCourse = {
  id: string;
  title: string;
  mentor: string;
  category: "English Spoken" | "Academics" | "Competitive Exams";
  level: "Beginner" | "Intermediate" | "Advanced";
  lessons: number;
  duration: string;
  rating: number;
  learners: string;
  price: string;
  image: string;
};

type CourseCategory = AllCourse["category"];
type CategoryFilter = "All" | CourseCategory;
type PriceFilter = "All" | "Under $60" | "$60 - $70" | "Above $70";
const COURSES_PAGE_SIZE = 4;
const FILTER_LOAD_DELAY_MS = 450;
const LOAD_MORE_DELAY_MS = 350;
const DETAILS_SHEET_HIDDEN_Y = 520;

const allCourses: AllCourse[] = [
  {
    id: "all-1",
    title: "Fluent English in 30 Days",
    mentor: "Riya Sharma",
    category: "English Spoken",
    level: "Beginner",
    lessons: 36,
    duration: "8h 40m",
    rating: 4.8,
    learners: "12.3k",
    price: "$49",
    image:
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "all-2",
    title: "Public Speaking Confidence",
    mentor: "Aman Verma",
    category: "English Spoken",
    level: "Intermediate",
    lessons: 28,
    duration: "6h 20m",
    rating: 4.7,
    learners: "8.7k",
    price: "$59",
    image:
      "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "all-3",
    title: "Class 10 Science Masterclass",
    mentor: "Neha Tiwari",
    category: "Academics",
    level: "Beginner",
    lessons: 42,
    duration: "11h 15m",
    rating: 4.9,
    learners: "19.4k",
    price: "$69",
    image:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "all-4",
    title: "Math Problem Solving Sprint",
    mentor: "Sarthak Jain",
    category: "Academics",
    level: "Intermediate",
    lessons: 31,
    duration: "7h 50m",
    rating: 4.6,
    learners: "10.9k",
    price: "$55",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "all-5",
    title: "SSC CGL Complete Preparation",
    mentor: "Rohit Yadav",
    category: "Competitive Exams",
    level: "Intermediate",
    lessons: 54,
    duration: "14h 10m",
    rating: 4.8,
    learners: "22.1k",
    price: "$79",
    image:
      "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "all-6",
    title: "Bank PO Quant + Reasoning",
    mentor: "Priya Nair",
    category: "Competitive Exams",
    level: "Advanced",
    lessons: 47,
    duration: "12h 25m",
    rating: 4.7,
    learners: "15.8k",
    price: "$74",
    image:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "all-7",
    title: "IELTS Speaking Booster",
    mentor: "Nikita Rao",
    category: "English Spoken",
    level: "Advanced",
    lessons: 24,
    duration: "5h 55m",
    rating: 4.8,
    learners: "9.1k",
    price: "$62",
    image:
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "all-8",
    title: "Olympiad Math Challenge",
    mentor: "Kavya Singh",
    category: "Academics",
    level: "Advanced",
    lessons: 39,
    duration: "9h 10m",
    rating: 4.9,
    learners: "7.6k",
    price: "$68",
    image:
      "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?auto=format&fit=crop&w=900&q=80",
  },
];

function getCategoryIcon(
  category: AllCourse["category"],
): React.ComponentProps<typeof Ionicons>["name"] {
  if (category === "English Spoken") {
    return "people-outline";
  }

  if (category === "Academics") {
    return "school-outline";
  }

  return "ribbon-outline";
}

function parsePrice(price: string): number {
  return Number(price.replace(/[^0-9.]/g, ""));
}

function isCategoryFilter(value: string): value is CategoryFilter {
  return (
    value === "All" ||
    value === "English Spoken" ||
    value === "Academics" ||
    value === "Competitive Exams"
  );
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

    if (rawCategory && isCategoryFilter(rawCategory)) {
      return rawCategory;
    }

    return "All";
  }, [params.category]);

  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>(initialCategory);
  const [selectedPrice, setSelectedPrice] = useState<PriceFilter>("All");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(COURSES_PAGE_SIZE);
  const [isCoursesLoading, setIsCoursesLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<AllCourse | null>(null);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const detailsSlideY = useState(
    () => new Animated.Value(DETAILS_SHEET_HIDDEN_Y),
  )[0];
  const detailsBackdropOpacity = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setVisibleCount(COURSES_PAGE_SIZE);
  }, [selectedCategory, selectedPrice]);

  useEffect(() => {
    setIsCoursesLoading(true);
    const timer = setTimeout(() => {
      setIsCoursesLoading(false);
    }, FILTER_LOAD_DELAY_MS);

    return () => clearTimeout(timer);
  }, [selectedCategory, selectedPrice]);

  const categoryFilters: CategoryFilter[] = [
    "All",
    "English Spoken",
    "Academics",
    "Competitive Exams",
  ];

  const priceFilters: PriceFilter[] = [
    "All",
    "Under $60",
    "$60 - $70",
    "Above $70",
  ];

  const filteredCourses = useMemo(() => {
    return allCourses.filter((course) => {
      const numericPrice = parsePrice(course.price);
      const matchesCategory =
        selectedCategory === "All" || course.category === selectedCategory;

      let matchesPrice = true;

      if (selectedPrice === "Under $60") {
        matchesPrice = numericPrice < 60;
      } else if (selectedPrice === "$60 - $70") {
        matchesPrice = numericPrice >= 60 && numericPrice <= 70;
      } else if (selectedPrice === "Above $70") {
        matchesPrice = numericPrice > 70;
      }

      return matchesCategory && matchesPrice;
    });
  }, [selectedCategory, selectedPrice]);

  const visibleCourses = useMemo(() => {
    return filteredCourses.slice(0, visibleCount);
  }, [filteredCourses, visibleCount]);

  const hasMoreCourses = visibleCount < filteredCourses.length;

  const handleShowMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((previous) => previous + COURSES_PAGE_SIZE);
      setIsLoadingMore(false);
    }, LOAD_MORE_DELAY_MS);
  };

  const openCourseDetails = (course: AllCourse) => {
    setSelectedCourse(course);
    setIsDetailsVisible(true);
    detailsSlideY.setValue(DETAILS_SHEET_HIDDEN_Y);
    detailsBackdropOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(detailsSlideY, {
        toValue: 0,
        damping: 17,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(detailsBackdropOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeCourseDetails = () => {
    Animated.parallel([
      Animated.timing(detailsSlideY, {
        toValue: DETAILS_SHEET_HIDDEN_Y,
        duration: 230,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(detailsBackdropOpacity, {
        toValue: 0,
        duration: 190,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsDetailsVisible(false);
        setSelectedCourse(null);
      }
    });
  };

  const handleBuyNow = () => {
    if (!selectedCourse) {
      return;
    }

    Alert.alert(
      "Checkout coming soon",
      `You selected ${selectedCourse.title}. We will add full checkout flow next.`,
    );
  };

  const handleToggleWishlist = () => {
    if (!selectedCourse) {
      return;
    }

    toggleWishlist(selectedCourse);
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

        {!isCoursesLoading && filteredCourses.length === 0 ? (
          <View style={styles.emptyState}>
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
                onPress={() => openCourseDetails(course)}
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
                    <Text style={styles.priceTag}>{course.price}</Text>
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
                      <Text style={styles.metaText}>{course.level}</Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons
                        name="book-outline"
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.secondaryMetaText}>
                        {course.lessons} lessons
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.secondaryMetaText}>
                        {course.duration}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons
                        name="star-outline"
                        size={14}
                        color={colors.warning}
                      />
                      <Text style={styles.secondaryMetaText}>
                        {course.rating.toFixed(1)}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons
                        name="people-outline"
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.secondaryMetaText}>
                        {course.learners} learners
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
        visible={isDetailsVisible}
        animationType="none"
        onRequestClose={closeCourseDetails}
      >
        <View style={styles.modalRoot}>
          <Animated.View
            style={[styles.modalBackdrop, { opacity: detailsBackdropOpacity }]}
          >
            <Pressable
              style={styles.modalBackdropPressable}
              onPress={closeCourseDetails}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.detailsSheet,
              {
                transform: [{ translateY: detailsSlideY }],
              },
            ]}
          >
            {selectedCourse ? (
              <>
                <View style={styles.detailsHandle} />
                <Image
                  source={{ uri: selectedCourse.image }}
                  style={styles.detailsImage}
                />

                <View style={styles.detailsTitleRow}>
                  <Text style={styles.detailsTitle}>
                    {selectedCourse.title}
                  </Text>
                  <Text style={styles.detailsPrice}>
                    {selectedCourse.price}
                  </Text>
                </View>

                <Text style={styles.detailsMentor}>
                  by {selectedCourse.mentor}
                </Text>

                <View style={styles.detailsMetaGrid}>
                  <View style={styles.detailsMetaItem}>
                    <Ionicons
                      name={getCategoryIcon(selectedCourse.category)}
                      size={15}
                      color={colors.primary}
                    />
                    <Text style={styles.detailsMetaText}>
                      {selectedCourse.category}
                    </Text>
                  </View>
                  <View style={styles.detailsMetaItem}>
                    <Ionicons
                      name="layers-outline"
                      size={15}
                      color={colors.primary}
                    />
                    <Text style={styles.detailsMetaText}>
                      {selectedCourse.level}
                    </Text>
                  </View>
                  <View style={styles.detailsMetaItem}>
                    <Ionicons
                      name="book-outline"
                      size={15}
                      color={colors.primary}
                    />
                    <Text style={styles.detailsMetaText}>
                      {selectedCourse.lessons} lessons
                    </Text>
                  </View>
                  <View style={styles.detailsMetaItem}>
                    <Ionicons
                      name="time-outline"
                      size={15}
                      color={colors.primary}
                    />
                    <Text style={styles.detailsMetaText}>
                      {selectedCourse.duration}
                    </Text>
                  </View>
                  <View style={styles.detailsMetaItem}>
                    <Ionicons
                      name="star-outline"
                      size={15}
                      color={colors.warning}
                    />
                    <Text style={styles.detailsMetaText}>
                      {selectedCourse.rating.toFixed(1)} rating
                    </Text>
                  </View>
                  <View style={styles.detailsMetaItem}>
                    <Ionicons
                      name="people-outline"
                      size={15}
                      color={colors.primary}
                    />
                    <Text style={styles.detailsMetaText}>
                      {selectedCourse.learners} learners
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsActionsRow}>
                  <Pressable style={styles.buyNowButton} onPress={handleBuyNow}>
                    <Text style={styles.buyNowButtonText}>Buy Now</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.wishlistIconButton,
                      isSelectedCourseWishlisted &&
                        styles.wishlistIconButtonActive,
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
          </Animated.View>
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
      justifyContent: "flex-end",
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    modalBackdropPressable: {
      flex: 1,
    },
    detailsSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 22,
      gap: 10,
    },
    detailsHandle: {
      alignSelf: "center",
      width: 46,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.border,
      marginBottom: 4,
    },
    detailsImage: {
      width: "100%",
      height: 180,
      borderRadius: 14,
      backgroundColor: colors.border,
    },
    detailsTitleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 2,
    },
    detailsTitle: {
      flex: 1,
      fontSize: 18,
      color: colors.textPrimary,
      fontWeight: "800",
    },
    detailsPrice: {
      fontSize: 13,
      color: isDark ? "#0B1220" : colors.white,
      fontWeight: "700",
      backgroundColor: isDark ? "#C7D4FF" : colors.primary,
      borderRadius: 9,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    detailsMentor: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "600",
      marginTop: -2,
    },
    detailsMetaGrid: {
      marginTop: 2,
      gap: 8,
    },
    detailsMetaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    detailsMetaText: {
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    detailsActionsRow: {
      marginTop: 4,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    buyNowButton: {
      flex: 1,
      marginTop: 4,
      backgroundColor: colors.primary,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
    },
    buyNowButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: "700",
    },
    wishlistIconButton: {
      marginTop: 4,
      width: 48,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    wishlistIconButtonActive: {
      backgroundColor: colors.primary,
    },
  });
