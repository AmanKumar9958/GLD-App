import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ThemeToggleButton from "../../components/ThemeToggleButton";
import { useAuth } from "../../context/AuthContext";
import { ThemePalette, useTheme } from "../../context/ThemeContext";
import {
  UserProfile,
  getUserProfileWithCache,
} from "../../services/userProfile";

type Course = {
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

const popularCourses: Course[] = [
  {
    id: "course-1",
    title: "Graphic Design Pro",
    mentor: "Aadil Arif",
    lessons: 32,
    price: "$98.00",
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "course-2",
    title: "UX/UI Essentials",
    mentor: "Buse Erhan",
    lessons: 28,
    price: "$75.00",
    image:
      "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=900&q=80",
  },
];

const topRatedCourses: Course[] = [
  {
    id: "course-3",
    title: "Motion Design Lab",
    mentor: "Nina Callen",
    lessons: 24,
    price: "$83.00",
    image:
      "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "course-4",
    title: "App Branding Kit",
    mentor: "Zain Ali",
    lessons: 19,
    price: "$69.00",
    image:
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=900&q=80",
  },
];

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
}: {
  course: Course;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.courseCard}>
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
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [greeting, setGreeting] = useState(getIndiaGreeting);

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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
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
          <View style={styles.headerIcons}>
            <ThemeToggleButton />
            <Ionicons
              name="search-outline"
              size={20}
              color={theme.primary}
              style={styles.headerIcon}
            />
            <Ionicons
              name="notifications-outline"
              size={20}
              color={theme.primary}
              style={styles.headerIcon}
            />
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
                    color={theme.primary}
                    style={styles.categoryIcon}
                  />
                </View>
                <Text style={styles.categoryLabel}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

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
            <CourseCard key={course.id} course={course} styles={styles} />
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Rated Courses</Text>
          <Pressable onPress={() => navigateToAllCourses()} hitSlop={8}>
            <Text style={styles.sectionAction}>View all</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {topRatedCourses.map((course) => (
            <CourseCard key={course.id} course={course} styles={styles} />
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: ThemePalette) {
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.bg,
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
    backgroundColor: theme.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 2,
    fontWeight: "500",
  },
  name: {
    fontSize: 14,
    color: theme.text,
    fontWeight: "700",
  },
  headerIcons: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  headerIcon: {
    opacity: 0.95,
  },
  banner: {
    marginHorizontal: 16,
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: theme.bannerBg,
  },
  bannerKicker: {
    color: "#CCDEFF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  bannerText: {
    color: "#EEF4FF",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  bannerPercent: {
    color: "#ffffff",
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
    backgroundColor: theme.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIcon: {
    opacity: 0.95,
  },
  categoryLabel: {
    fontSize: 11,
    color: theme.textSecondary,
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
    color: theme.text,
    fontWeight: "700",
  },
  sectionAction: {
    fontSize: 13,
    color: theme.primary,
    fontWeight: "600",
  },
  horizontalList: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  courseCard: {
    width: 170,
    borderRadius: 16,
    backgroundColor: theme.surface,
    padding: 8,
    shadowColor: "#1E3989",
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
    backgroundColor: theme.border,
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
    color: theme.text,
    fontWeight: "700",
  },
  coursePrice: {
    fontSize: 11,
    color: "#ffffff",
    fontWeight: "700",
    backgroundColor: theme.primary,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  courseSub: {
    fontSize: 10,
    color: theme.textSecondary,
    marginBottom: 2,
    fontWeight: "500",
  },
  });
}
