import { getAuth } from "@react-native-firebase/auth";
import { useNavigation, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    getUserCoursesWithCache,
    UserCourse,
} from "../../services/userCourses";

type FilterKey = "all" | "ongoing" | "completed";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ongoing", label: "Ongoing" },
  { key: "completed", label: "Completed" },
];

export default function CoursesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const auth = getAuth();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [courses, setCourses] = useState<UserCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadCourses = async () => {
      const uid = auth.currentUser?.uid;

      if (!uid) {
        if (mounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const { cached, fresh } = await getUserCoursesWithCache(uid);

        if (!mounted) {
          return;
        }

        if (cached.length > 0) {
          setCourses(cached);
        }

        if (fresh.length > 0) {
          setCourses(fresh);
        }
      } catch {
        if (!mounted) {
          return;
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadCourses();

    return () => {
      mounted = false;
    };
  }, [auth]);

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
          <Text style={styles.backIcon}>←</Text>
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

      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color="#1E3989" />
          </View>
        ) : null}

        {!isLoading && filteredCourses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No courses found</Text>
            <Text style={styles.emptySubtitle}>
              Your courses will appear here once added in Firestore.
            </Text>
          </View>
        ) : null}

        {filteredCourses.map((course) => {
          const statusText =
            course.progress === 100 ? "Completed" : "In progress";

          return (
            <View key={course.id} style={styles.courseRow}>
              <Image
                source={{ uri: course.image }}
                style={styles.courseImage}
              />

              <View style={styles.courseBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.courseTitle} numberOfLines={1}>
                    {course.title}
                  </Text>
                  <Text style={styles.progressPct}>{course.progress}%</Text>
                </View>

                <Text style={styles.courseSubtitle} numberOfLines={1}>
                  {course.subtitle}
                </Text>

                <Text style={styles.statusText}>{statusText}</Text>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressBar,
                      { width: `${course.progress}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F0F4FB",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
  },
  backIcon: {
    fontSize: 20,
    color: "#1E3989",
    width: 24,
  },
  pageTitle: {
    fontSize: 20,
    color: "#1E3989",
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
    borderBottomColor: "#D5E2F5",
    marginBottom: 6,
  },
  filterItem: {
    alignItems: "center",
    minWidth: 86,
  },
  filterLabel: {
    fontSize: 13,
    color: "#8090C0",
    fontWeight: "600",
    paddingBottom: 10,
  },
  filterLabelActive: {
    color: "#1E3989",
  },
  filterUnderline: {
    width: "100%",
    height: 2,
    backgroundColor: "transparent",
  },
  filterUnderlineActive: {
    backgroundColor: "#1E3989",
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
    borderColor: "#D5E2F5",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 15,
    color: "#1E3989",
    fontWeight: "700",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#8090C0",
    textAlign: "center",
    fontWeight: "500",
  },
  courseRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: "#D5E2F5",
  },
  courseImage: {
    width: 78,
    height: 62,
    borderRadius: 10,
    backgroundColor: "#D5E2F5",
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
    color: "#1E3989",
    fontWeight: "700",
  },
  progressPct: {
    fontSize: 11,
    color: "#8090C0",
    fontWeight: "700",
  },
  courseSubtitle: {
    fontSize: 11,
    color: "#8090C0",
    marginTop: 2,
    marginBottom: 4,
    fontWeight: "500",
  },
  statusText: {
    fontSize: 11,
    color: "#8090C0",
    marginBottom: 5,
    fontWeight: "600",
  },
  progressTrack: {
    width: "100%",
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D5E2F5",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#1E3989",
  },
});
