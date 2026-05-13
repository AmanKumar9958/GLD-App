import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  FlatList,
} from "react-native";
import {
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppThemeColors, useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import {
  type WishlistCourse,
  useWishlist,
} from "../../context/WishlistContext";
import {
  getPaginatedCourses,
  getCourseCategories,
} from "../../services/courseService";
import { supabase } from "../../services/supabase";
import { saveUserProfile } from "../../services/userProfile";
import { createCashfreeOrder, startCashfreePayment } from "../../services/paymentService";
import { FlashList } from "@shopify/flash-list";

type AllCourse = {
  id: string;
  title: string;
  mentor: string;
  category: string;
  price: number;
  image: string;
};

type CategoryFilter = "All" | string;
type PriceFilter = "All" | "Under ₹ 60" | "₹ 60 - ₹ 70" | "Above ₹ 70";
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
  return `₹${price}`;
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
  const { user, profile, refreshProfile } = useAuth();

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
  const [isModulePopupVisible, setIsModulePopupVisible] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<AllCourse | null>(null);
  const [selectedCourseModules, setSelectedCourseModules] = useState<string[]>(
    [],
  );
  const [isModulesLoading, setIsModulesLoading] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [isBuyLoading, setIsBuyLoading] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [showEnrolledModal, setShowEnrolledModal] = useState(false);
  const [enrolledCourseId, setEnrolledCourseId] = useState<string | null>(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  const { data: allCategories = [] } = useQuery({
    queryKey: ['courseCategories'],
    queryFn: getCourseCategories,
    staleTime: 1000 * 60 * 10, // 10 minutes — categories rarely change
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

  // ✅ Derive module counts from the embedded query data — zero extra DB calls
  const moduleCountByCourseId = useMemo(() => {
    const map: Record<string, number> = {};
    data?.pages.forEach((page) => {
      page.data.forEach((c) => {
        map[c.id] = (c.modules as { id: string }[] | undefined)?.length ?? 0;
      });
    });
    return map;
  }, [data]);

  const categoryFilters = useMemo<CategoryFilter[]>(() => {
    const set = new Set(allCategories);
    if (selectedCategory !== "All") set.add(selectedCategory);
    return ["All", ...[...set].sort()];
  }, [allCategories, selectedCategory]);

  const priceFilters: PriceFilter[] = [
    "All",
    "Under ₹ 60",
    "₹ 60 - ₹ 70",
    "Above ₹ 70",
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
      if (isMounted.current) {
        setSelectedCourseModules(modules.map((module) => module.title));
      }
    } catch (err) {
      console.error("Failed to load modules:", err);
      if (isMounted.current) {
        setModulesError("Failed to load modules. Please try again.");
      }
    } finally {
      if (isMounted.current) {
        setIsModulesLoading(false);
      }
    }
  };

  const closeModulesPopup = () => {
    setIsModulePopupVisible(false);
    setSelectedCourse(null);
    setSelectedCourseModules([]);
    setModulesError(null);
  };

  const handleBuyNow = () => {
    if (!selectedCourse) return;
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to purchase this course.");
      return;
    }
    if (!profile?.phone) {
      setPhoneInput("");
      setShowPhoneModal(true);
      return;
    }
    void initiatePayment(selectedCourse);
  };

  const handlePhoneSubmit = async () => {
    const phone = phoneInput.trim();
    if (!/^[6-9]\d{9}$/.test(phone)) return;
    if (isMounted.current) setShowPhoneModal(false);
    try {
      await saveUserProfile({ ...profile!, uid: user!.id, phone });
      await refreshProfile();
    } catch (e) {
      console.error("Failed to save phone:", e);
    }
    if (selectedCourse && isMounted.current) void initiatePayment(selectedCourse);
  };

  const initiatePayment = async (course: AllCourse) => {
    if (isMounted.current) {
      setIsBuyLoading(true);
      setIsModulePopupVisible(false);
    }
    try {
      const order = await createCashfreeOrder(course.id);
      
      if (!isMounted.current) return;

      startCashfreePayment(order.orderId, order.paymentSessionId, {
        onSuccess: (orderId) => {
          if (!isMounted.current) return;
          router.replace({
            pathname: "/payment/success",
            params: { orderId, courseTitle: course.title, courseId: course.id },
          } as any);
        },
        onError: (code, message) => {
          if (!isMounted.current) return;
          router.replace({
            pathname: "/payment/failure",
            params: { orderId: order.orderId, code, message, courseId: course.id },
          } as any);
        },
        onExit: () => {
          // Silently handle cancellation
        },
      });
    } catch (err: any) {
      if (isMounted.current) {
        const msg: string = err?.message ?? "";
        if (msg.toLowerCase().includes("already enrolled")) {
          setEnrolledCourseId(course.id);
          setShowEnrolledModal(true);
        } else {
          Alert.alert("Error", msg || "Could not start payment. Please try again.");
        }
      }
    } finally {
      if (isMounted.current) setIsBuyLoading(false);
    }
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
    <>
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

        <FlashList
          data={isCoursesLoading ? [] : courses}
          keyExtractor={(item) => item.id}
          estimatedItemSize={128}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          }
          ListHeaderComponent={
            showFilters ? (
              <View style={[styles.filtersCard, { marginBottom: 12 }]}>
                <Text style={styles.filtersHeading}>Category</Text>
                <View style={styles.filterRow}>
                  {categoryFilters.map((filter) => (
                    <Pressable
                      key={filter}
                      style={[styles.filterChip, selectedCategory === filter && styles.filterChipSelected]}
                      onPress={() => setSelectedCategory(filter)}
                    >
                      <Text style={[styles.filterChipText, selectedCategory === filter && styles.filterChipTextSelected]}>
                        {filter}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.filtersHeading}>Price</Text>
                <View style={styles.filterRow}>
                  {priceFilters.map((filter) => (
                    <Pressable
                      key={filter}
                      style={[styles.filterChip, selectedPrice === filter && styles.filterChipSelected]}
                      onPress={() => setSelectedPrice(filter)}
                    >
                      <Text style={[styles.filterChipText, selectedPrice === filter && styles.filterChipTextSelected]}>
                        {filter}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            isCoursesLoading ? (
              <>
                {Array.from({ length: COURSES_PAGE_SIZE }, (_, idx) => (
                  <CourseSkeletonCard key={idx + 1} id={idx + 1} styles={styles} />
                ))}
              </>
            ) : fetchError ? (
              <View style={styles.emptyState}>
                <ExpoImage source={require("../../assets/images/404-not-found.svg")} style={styles.emptyImage} contentFit="contain" />
                <Text style={styles.emptyTitle}>Something went wrong</Text>
                <Text style={styles.emptySubtitle}>{fetchError}</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <ExpoImage source={require("../../assets/images/empty-folder.svg")} style={styles.emptyImage} contentFit="contain" />
                <Text style={styles.emptyTitle}>No matching courses</Text>
                <Text style={styles.emptySubtitle}>Try changing category or price filters.</Text>
              </View>
            )
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : !isCoursesLoading && courses.length > 0 && !hasNextPage ? (
              <View style={styles.noMoreWrap}>
                <Text style={styles.noMoreText}>No more courses</Text>
              </View>
            ) : null
          }
          renderItem={({ item: course }) => (
            <Pressable
              style={[styles.courseCard, { marginBottom: 12 }]}
              onPress={() => void openModulesPopup(course)}
            >
              <ExpoImage
                source={{ uri: course.image }}
                style={styles.courseImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <View style={styles.courseContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.courseTitle} numberOfLines={1}>
                    {course.title}
                  </Text>
                  <Text style={styles.priceTag}>{formatPrice(course.price)}</Text>
                </View>
                <Text style={styles.mentorText} numberOfLines={1}>by {course.mentor}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name={getCategoryIcon(course.category)} size={14} color={colors.primary} />
                    <Text style={styles.metaText}>{course.category}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="layers-outline" size={14} color={colors.primary} />
                    <Text style={styles.secondaryMetaText}>
                      {moduleCountByCourseId[course.id] ?? 0} modules
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />

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
                      style={[styles.modulePopupBuyButton, { opacity: isBuyLoading ? 0.7 : 1 }]}
                      onPress={handleBuyNow}
                      disabled={isBuyLoading}
                    >
                      {isBuyLoading ? (
                        <ActivityIndicator color={colors.white} size="small" />
                      ) : (
                        <>
                          <Ionicons name="card-outline" size={16} color={colors.white} />
                          <Text style={styles.modulePopupBuyButtonText}>Buy Now</Text>
                        </>
                      )}
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

        {/* Already Enrolled Modal */}
        <Modal
          transparent
          animationType="fade"
          visible={showEnrolledModal}
          onRequestClose={() => setShowEnrolledModal(false)}
        >
          <View style={styles.enrolledModalRoot}>
            <View style={[styles.enrolledModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.enrolledIconWrap, { backgroundColor: isDark ? "#0D2E1A" : "#E8FFF0" }]}>
                <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
              </View>
              <Text style={[styles.enrolledModalTitle, { color: colors.textPrimary }]}>Already Enrolled!</Text>
              <Text style={[styles.enrolledModalSubtitle, { color: colors.textSecondary }]}>
                You already have access to this course. Jump right back in and continue learning!
              </Text>
              <Pressable
                style={[styles.enrolledStartBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowEnrolledModal(false);
                  if (enrolledCourseId) router.push(`/course/${enrolledCourseId}` as any);
                }}
              >
                <Ionicons name="play-circle" size={18} color="#fff" />
                <Text style={styles.enrolledStartBtnText}>Start Learning</Text>
              </Pressable>
              <Pressable style={styles.enrolledDismissBtn} onPress={() => setShowEnrolledModal(false)}>
                <Text style={[styles.enrolledDismissText, { color: colors.textSecondary }]}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>

      {/* Phone collection modal */}
      <Modal
        visible={showPhoneModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowPhoneModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.phoneModalOverlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPhoneModal(false)} />
          <View style={[styles.phoneModalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.phoneModalHandle, { backgroundColor: colors.border }]} />

            <View style={[styles.phoneModalIconWrap, { backgroundColor: isDark ? "#1A2E4A" : "#EFF6FF" }]}>
              <Ionicons name="call" size={24} color={colors.primary} />
            </View>

            <Text style={[styles.phoneModalTitle, { color: colors.textPrimary }]}>One last step!</Text>
            <Text style={[styles.phoneModalSubtitle, { color: colors.textSecondary }]}>
              Enter your mobile number to complete the payment.
            </Text>

            <View style={[
              styles.phoneInputWrap,
              { borderColor: /^[6-9]\d{9}$/.test(phoneInput.trim()) ? colors.primary : colors.border, backgroundColor: colors.background }
            ]}>
              <Text style={[styles.dialCode, { color: colors.textSecondary }]}>+91</Text>
              <View style={[styles.phoneInputDivider, { backgroundColor: colors.border }]} />
              <TextInput
                style={[styles.phoneInput, { color: colors.textPrimary }]}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                maxLength={10}
                value={phoneInput}
                onChangeText={setPhoneInput}
                autoFocus
              />
            </View>

            <Pressable
              style={[styles.phoneModalBtn, { backgroundColor: /^[6-9]\d{9}$/.test(phoneInput.trim()) ? colors.primary : colors.border }]}
              onPress={() => void handlePhoneSubmit()}
              disabled={!/^[6-9]\d{9}$/.test(phoneInput.trim())}
            >
              <Text style={styles.phoneModalBtnText}>Continue to Payment</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>

            <Pressable onPress={() => setShowPhoneModal(false)}>
              <Text style={[styles.phoneCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 12,
      backgroundColor: colors.primary,
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
    // Phone modal styles
    phoneModalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    phoneModalSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      paddingHorizontal: 24,
      paddingBottom: 36,
      paddingTop: 12,
      alignItems: "center",
      gap: 14,
    },
    phoneModalHandle: {
      width: 40,
      height: 4,
      borderRadius: 999,
      marginBottom: 8,
    },
    phoneModalIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    phoneModalTitle: {
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
    },
    phoneModalSubtitle: {
      fontSize: 13,
      textAlign: "center",
      lineHeight: 20,
      fontWeight: "500",
    },
    phoneInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderRadius: 12,
      paddingHorizontal: 14,
      width: "100%",
      height: 52,
    },
    dialCode: {
      fontSize: 16,
      fontWeight: "600",
      marginRight: 4,
    },
    phoneInputDivider: {
      width: 1,
      height: 24,
      marginHorizontal: 10,
    },
    phoneInput: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
    },
    phoneModalBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      width: "100%",
      borderRadius: 12,
      paddingVertical: 14,
      justifyContent: "center",
    },
    phoneModalBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 16,
    },
    phoneCancelText: {
      fontSize: 14,
      fontWeight: "600",
      paddingVertical: 8,
    },
    // Already Enrolled Modal
    enrolledModalRoot: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 28,
    },
    enrolledModalCard: {
      width: "100%",
      borderRadius: 24,
      borderWidth: 1,
      paddingVertical: 32,
      paddingHorizontal: 24,
      alignItems: "center",
      gap: 12,
    },
    enrolledIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    enrolledModalTitle: {
      fontSize: 22,
      fontWeight: "800",
      textAlign: "center",
    },
    enrolledModalSubtitle: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
      fontWeight: "500",
    },
    enrolledStartBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      width: "100%",
      borderRadius: 14,
      paddingVertical: 14,
      justifyContent: "center",
      marginTop: 8,
    },
    enrolledStartBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 16,
    },
    enrolledDismissBtn: {
      paddingVertical: 8,
    },
    enrolledDismissText: {
      fontSize: 14,
      fontWeight: "600",
    },
  });
