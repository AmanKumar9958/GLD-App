import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { AppThemeColors, useTheme } from "../../context/ThemeContext";
import { useWishlist } from "../../context/WishlistContext";
import {
  getModules,
  subscribeToPublishedCourses,
} from "../../services/courseService";
import {
  UserProfile,
  getUserProfileWithCache,
} from "../../services/userProfile";
import type { Course as FirestoreCourse } from "../../types/firestore";

type HomeCourse = {
  id: string;
  title: string;
  mentor: string;
  lessons: number;
  price: string;
  image: string;
};

type CategoryItem = {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

const categories: CategoryItem[] = [
  { id: "english", label: "English Spoken", icon: "people-outline" },
  { id: "academics", label: "Academics", icon: "school-outline" },
  { id: "competitive", label: "Competitive Exams", icon: "ribbon-outline" },
  { id: "more", label: "More", icon: "grid-outline" },
];

const HOME_SECTION_SIZE = 8;
const HEADER_ICONS_PANEL_WIDTH = 124;
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=900&q=80";

const defaultAvatar =
  "https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=200&q=80";

function getIndiaGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );

  if (hour >= 5 && hour < 12) {
    return "Good Morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good Afternoon";
  }

  if (hour >= 17 && hour < 22) {
    return "Good Evening";
  }

  return "Good Night";
}

function CourseCard({
  course,
  styles,
  onPress,
}: {
  course: HomeCourse;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.courseCard} onPress={onPress}>
      <Image source={{ uri: course.image }} style={styles.courseImage} />
      <View style={styles.courseMetaRow}>
        <Text style={styles.courseTitle} numberOfLines={1}>
          {course.title}
        </Text>
        <Text style={styles.coursePrice}>{course.price}</Text>
      </View>
      <Text style={styles.courseSub} numberOfLines={1}>
        {course.mentor}
      </Text>
      <Text style={styles.courseSub}>{course.lessons} lessons</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { wishlistCount } = useWishlist();
  const hasUnreadNotifications = false;
  const showHeaderAlertDot = wishlistCount > 0 || hasUnreadNotifications;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recommendedCourses, setRecommendedCourses] = useState<HomeCourse[]>(
    [],
  );
  const [popularCourses, setPopularCourses] = useState<HomeCourse[]>([]);
  const [isCoursesLoading, setIsCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [areHeaderIconsOpen, setAreHeaderIconsOpen] = useState(false);
  const [greeting, setGreeting] = useState(getIndiaGreeting);
  const toggleProgress = useSharedValue(isDark ? 1 : 0);
  const headerIconsProgress = useSharedValue(0);

  const navigateToAllCourses = useCallback(
    (category?: CategoryItem["label"]) => {
      if (category && category !== "More") {
        router.push({
          pathname: "/all-courses",
          params: { category },
        });
        return;
      }

      router.push("/all-courses");
    },
    [router],
  );

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      if (!currentUser?.uid) {
        return;
      }

      try {
        const { cached, fresh } = await getUserProfileWithCache(
          currentUser.uid,
        );

        if (!active) {
          return;
        }

        if (cached) {
          setProfile(cached);
        }

        if (fresh) {
          setProfile(fresh);
        }

        if (!cached && !fresh) {
          setProfile({
            uid: currentUser.uid,
            name: currentUser.displayName || "User",
            email: currentUser.email || undefined,
            photoURL: currentUser.photoURL || undefined,
          });
        }
      } catch {
        if (!active) {
          return;
        }

        setProfile({
          uid: currentUser.uid,
          name: currentUser.displayName || "User",
          email: currentUser.email || undefined,
          photoURL: currentUser.photoURL || undefined,
        });
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [
    currentUser?.uid,
    currentUser?.displayName,
    currentUser?.email,
    currentUser?.photoURL,
  ]);

  useFocusEffect(
    useCallback(() => {
      setGreeting(getIndiaGreeting());
      return undefined;
    }, []),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setGreeting(getIndiaGreeting());
    }, 60_000);

    return () => clearInterval(timer);
  }, []);

  const displayName = useMemo(() => {
    return profile?.name || currentUser?.displayName || "User";
  }, [profile?.name, currentUser?.displayName]);

  const displayPhoto = useMemo(() => {
    return profile?.photoURL || currentUser?.photoURL || defaultAvatar;
  }, [profile?.photoURL, currentUser?.photoURL]);

  useEffect(() => {
    let active = true;
    let snapshotSeq = 0;

    const mapHomeCourses = async (
      source: FirestoreCourse[],
    ): Promise<HomeCourse[]> => {
      const selected = source.slice(0, HOME_SECTION_SIZE);

      return Promise.all(
        selected.map(async (course) => {
          let lessons = 0;

          try {
            const modules = await getModules(course.id);
            lessons = modules.length;
          } catch {
            lessons = 0;
          }

          return {
            id: course.id,
            title: course.title,
            mentor: course.instructorName || "Instructor",
            lessons,
            price: `Rs. ${course.price}`,
            image: course.thumbnailUrl || FALLBACK_IMAGE,
          };
        }),
      );
    };

    const unsubscribe = subscribeToPublishedCourses(
      (courses) => {
        const currentSeq = snapshotSeq + 1;
        snapshotSeq = currentSeq;

        const byNewest = [...courses].sort((a, b) => {
          const bSeconds = b.createdAt?.seconds || 0;
          const aSeconds = a.createdAt?.seconds || 0;

          if (bSeconds === aSeconds) {
            return a.title.localeCompare(b.title);
          }

          return bSeconds - aSeconds;
        });

        const byPriceDesc = [...courses].sort((a, b) => b.price - a.price);

        Promise.all([mapHomeCourses(byNewest), mapHomeCourses(byPriceDesc)])
          .then(([recommended, popular]) => {
            if (!active || currentSeq !== snapshotSeq) {
              return;
            }

            setRecommendedCourses(recommended);
            setPopularCourses(popular);
            setCoursesError(null);
            setIsCoursesLoading(false);
          })
          .catch((error) => {
            console.error("Failed to map home courses:", error);

            if (!active || currentSeq !== snapshotSeq) {
              return;
            }

            setCoursesError("Failed to load courses.");
            setIsCoursesLoading(false);
          });
      },
      (error) => {
        console.error("Failed to subscribe courses:", error);

        if (!active) {
          return;
        }

        setCoursesError("Failed to load courses.");
        setIsCoursesLoading(false);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    toggleProgress.value = withTiming(isDark ? 1 : 0, {
      duration: 460,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [isDark, toggleProgress]);

  const toggleIconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${toggleProgress.value * 180}deg`,
      },
      {
        scale: interpolate(toggleProgress.value, [0, 1], [0.94, 1]),
      },
    ],
    opacity: interpolate(toggleProgress.value, [0, 0.5, 1], [0.75, 1, 0.9]),
  }));

  const toggleThumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(toggleProgress.value, [0, 1], [0, 19]) },
    ],
  }));

  const toggleTrackAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      toggleProgress.value,
      [0, 1],
      [colors.surface, colors.surfaceAlt],
    ),
  }));

  const closeHeaderActionsIfOpen = useCallback(() => {
    setAreHeaderIconsOpen((previous) => (previous ? false : previous));
  }, []);

  useEffect(() => {
    headerIconsProgress.value = withTiming(areHeaderIconsOpen ? 1 : 0, {
      duration: 320,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [areHeaderIconsOpen, headerIconsProgress]);

  const headerIconsPanelAnimatedStyle = useAnimatedStyle(() => ({
    width: interpolate(
      headerIconsProgress.value,
      [0, 1],
      [0, HEADER_ICONS_PANEL_WIDTH],
    ),
    opacity: interpolate(headerIconsProgress.value, [0, 0.2, 1], [0, 0.3, 1]),
    transform: [
      {
        translateX: interpolate(headerIconsProgress.value, [0, 1], [14, 0]),
      },
    ],
  }));

  const headerArrowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(headerIconsProgress.value, [0, 1], [0, 180])}deg`,
      },
    ],
  }));

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onTouchStart={closeHeaderActionsIfOpen}
      >
        <View style={styles.headerRow}>
          <View style={styles.profileRow}>
            <Image
              source={{
                uri: displayPhoto,
              }}
              style={styles.avatar}
            />
            <View>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.name}>{displayName}</Text>
            </View>
          </View>
          <View style={styles.headerActionsRow}>
            <Animated.View
              style={[styles.headerIconsPanel, headerIconsPanelAnimatedStyle]}
            >
              <View
                style={styles.headerIcons}
                pointerEvents={areHeaderIconsOpen ? "auto" : "none"}
              >
                <Pressable
                  style={styles.wishlistTrigger}
                  onPress={() => router.push("/wishlist")}
                  hitSlop={8}
                >
                  <Ionicons
                    name="heart-outline"
                    size={20}
                    color={colors.primary}
                    style={styles.headerIcon}
                  />
                  {wishlistCount > 0 ? (
                    <View style={styles.wishlistBadge}>
                      <Text style={styles.wishlistBadgeText}>
                        {wishlistCount > 99 ? "99+" : wishlistCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  style={styles.themeSwitch}
                  onPress={toggleTheme}
                  hitSlop={8}
                >
                  <Animated.View
                    style={[styles.themeTrack, toggleTrackAnimatedStyle]}
                  />
                  <Animated.View
                    style={[styles.themeThumb, toggleThumbAnimatedStyle]}
                  />
                  <Animated.View style={toggleIconAnimatedStyle}>
                    <Ionicons
                      name={isDark ? "sunny-outline" : "moon-outline"}
                      size={14}
                      color={colors.primary}
                    />
                  </Animated.View>
                </Pressable>

                <Pressable style={styles.notificationTrigger} hitSlop={8}>
                  <Ionicons
                    name="notifications-outline"
                    size={20}
                    color={colors.primary}
                    style={styles.headerIcon}
                  />
                </Pressable>
              </View>
            </Animated.View>

            <Pressable
              style={styles.headerToggleButton}
              onPress={() => setAreHeaderIconsOpen((previous) => !previous)}
              hitSlop={8}
            >
              {showHeaderAlertDot ? (
                <View style={styles.headerAlertDot} />
              ) : null}
              <Animated.View style={headerArrowAnimatedStyle}>
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={colors.primary}
                />
              </Animated.View>
            </Pressable>
          </View>
        </View>

        <View style={styles.banner}>
          <View>
            <Text style={styles.bannerKicker}>TODAY&apos;S SPECIAL</Text>
            <Text style={styles.bannerText}>
              Hurry! Today&apos;s your last chance
            </Text>
            <Text style={styles.bannerText}>
              for a discount on all courses.
            </Text>
          </View>
          <Text style={styles.bannerPercent}>10%</Text>
        </View>

        <View style={styles.categoryRow}>
          {categories.map((item) => {
            const isMore = item.id === "more";

            return (
              <Pressable
                key={item.id}
                style={styles.categoryItem}
                onPress={() =>
                  navigateToAllCourses(isMore ? undefined : item.label)
                }
              >
                <View style={styles.categoryIconWrap}>
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={colors.primary}
                    style={styles.categoryIcon}
                  />
                </View>
                <Text style={styles.categoryLabel}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recommended Courses</Text>
          <Pressable onPress={() => navigateToAllCourses()} hitSlop={8}>
            <Text style={styles.sectionAction}>View all</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {recommendedCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              styles={styles}
              onPress={() => navigateToAllCourses()}
            />
          ))}
        </ScrollView>

        {isCoursesLoading ? (
          <View style={styles.sectionStatusWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}

        {!isCoursesLoading && coursesError ? (
          <Text style={styles.sectionStatusText}>{coursesError}</Text>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Courses</Text>
          <Pressable onPress={() => navigateToAllCourses()} hitSlop={8}>
            <Text style={styles.sectionAction}>View all</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {popularCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              styles={styles}
              onPress={() => navigateToAllCourses()}
            />
          ))}
        </ScrollView>
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
    flex: {
      flex: 1,
    },
    screen: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 24,
    },
    headerRow: {
      marginTop: 22,
      marginBottom: 16,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
    },
    avatarPlaceholder: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    greeting: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 2,
      fontWeight: "500",
    },
    name: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    headerActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    headerIconsPanel: {
      overflow: "hidden",
    },
    headerIcons: {
      flexDirection: "row",
      gap: 14,
      alignItems: "center",
      width: HEADER_ICONS_PANEL_WIDTH,
      paddingVertical: 4,
    },
    headerToggleButton: {
      position: "relative",
      width: 28,
      height: 28,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerIcon: {
      opacity: 0.95,
    },
    notificationTrigger: {
      width: 22,
      height: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    wishlistTrigger: {
      position: "relative",
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    wishlistBadge: {
      position: "absolute",
      top: -2,
      right: -3,
      minWidth: 16,
      height: 16,
      borderRadius: 999,
      paddingHorizontal: 4,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    wishlistBadgeText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "800",
      lineHeight: 11,
    },
    headerAlertDot: {
      position: "absolute",
      top: -1,
      right: -1,
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.danger,
      borderWidth: 1,
      borderColor: colors.surface,
      zIndex: 2,
    },
    banner: {
      marginHorizontal: 16,
      borderRadius: 22,
      paddingVertical: 20,
      paddingHorizontal: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceAlt,
    },
    bannerKicker: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 8,
    },
    bannerText: {
      color: colors.textPrimary,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "500",
    },
    bannerPercent: {
      color: colors.textPrimary,
      fontSize: 36,
      fontWeight: "800",
      letterSpacing: -1,
      marginTop: 2,
    },
    categoryRow: {
      marginTop: 18,
      marginBottom: 16,
      paddingHorizontal: 10,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    categoryItem: {
      width: "24%",
      alignItems: "center",
      gap: 7,
    },
    categoryIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryIcon: {
      opacity: 0.95,
    },
    categoryLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "600",
      textAlign: "center",
    },
    sectionHeader: {
      paddingHorizontal: 16,
      marginTop: 4,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: {
      fontSize: 20,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    sectionAction: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: "600",
    },
    horizontalList: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 12,
    },
    sectionStatusWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },
    sectionStatusText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    courseCard: {
      width: 170,
      borderRadius: 16,
      backgroundColor: colors.surface,
      padding: 8,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
    },
    courseImage: {
      width: "100%",
      height: 92,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: colors.border,
    },
    courseMetaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      marginBottom: 3,
    },
    courseTitle: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    coursePrice: {
      fontSize: 11,
      color: isDark ? "#0B1220" : colors.white,
      fontWeight: "700",
      backgroundColor: isDark ? "#C7D4FF" : colors.primary,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    courseSub: {
      fontSize: 10,
      color: colors.textSecondary,
      marginBottom: 2,
      fontWeight: "500",
    },
    themeSwitch: {
      width: 44,
      height: 24,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      paddingHorizontal: 4,
      position: "relative",
      overflow: "hidden",
    },
    themeTrack: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 999,
      backgroundColor: colors.surface,
    },
    themeThumb: {
      position: "absolute",
      left: 2,
      width: 20,
      height: 20,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
    },
  });
