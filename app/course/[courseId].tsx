import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppThemeColors, useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import {
  getCourseById,
  getModules,
  getVideos,
} from "../../services/courseService";
import { supabase } from "../../services/supabase";
import { saveUserProfile } from "../../services/userProfile";
import { createCashfreeOrder, startCashfreePayment } from "../../services/paymentService";
import { DatabaseVideo } from "../../types/supabase";
import CourseDetailSkeleton from "../../components/ui/CourseDetailSkeleton";
import CourseCardSkeleton from "../../components/ui/CourseCardSkeleton";
import { FlashList } from "@shopify/flash-list";

type ModuleWithLectureCount = {
  id: string;
  title: string;
  orderIndex: number;
  lectureCount: number;
  videos: DatabaseVideo[];
};

type CourseHeader = {
  title: string;
  category: string;
  mentor: string;
  price: number;
};

function formatPrice(price: number): string {
  return `₹${price.toLocaleString("en-IN")}`;
}

// ─── Phone Collection Modal ────────────────────────────────────────────────────

function PhoneModal({
  visible,
  onSubmit,
  onCancel,
  colors,
  isDark,
  styles,
}: {
  visible: boolean;
  onSubmit: (phone: string) => void;
  onCancel: () => void;
  colors: AppThemeColors;
  isDark: boolean;
  styles: any;
}) {
  const [phone, setPhone] = useState("");
  const isValid = /^[6-9]\d{9}$/.test(phone.trim());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={[styles.modalIconWrap, { backgroundColor: isDark ? "#1A2E4A" : "#EFF6FF" }]}>
            <Ionicons name="call" size={24} color={colors.primary} />
          </View>

          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            One last step!
          </Text>
          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
            Enter your mobile number to complete the payment. It will be saved to your profile.
          </Text>

          <View style={[styles.inputWrap, { borderColor: isValid ? colors.primary : colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.dialCode, { color: colors.textSecondary }]}>+91</Text>
            <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />
            <TextInput
              style={[styles.phoneInput, { color: colors.textPrimary }]}
              placeholder="Enter 10-digit mobile number"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
              autoFocus
            />
          </View>

          <Pressable
            style={[styles.modalBtn, { backgroundColor: isValid ? colors.primary : colors.border }]}
            onPress={() => isValid && onSubmit(phone.trim())}
            disabled={!isValid}
          >
            <Text style={styles.modalBtnText}>Continue to Payment</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function CourseDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ courseId?: string | string[] }>();
  const { colors, isDark } = useTheme();
  const { user, profile, refreshProfile } = useAuth();
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
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  // Payment states
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isBuyLoading, setIsBuyLoading] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const isAdmin = profile?.role === "admin";

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadCourseDetails = useCallback(async () => {
    if (!courseId) {
      if (isMounted.current) {
        setError("Invalid course.");
        setIsLoading(false);
        setIsRefreshing(false);
      }
      return;
    }

    try {
      const [courseDoc, courseModules] = await Promise.all([
        getCourseById(courseId),
        getModules(courseId),
      ]);

      if (!courseDoc) {
        if (isMounted.current) {
          setError("Course not found.");
          setModules([]);
          setCourse(null);
        }
        return;
      }

      if (isMounted.current) {
        setCourse({
          title: courseDoc.title,
          category: courseDoc.category,
          mentor: courseDoc.instructor_name || "Instructor",
          price: courseDoc.price,
        });
      }

      // Check enrollment
      if (user) {
        const { data } = await supabase
          .from("user_courses")
          .select("id")
          .eq("user_id", user.id)
          .eq("course_id", courseId)
          .maybeSingle();
        if (isMounted.current) {
          setIsEnrolled(!!data);
        }
      }

      const moduleWithCounts = await Promise.all(
        courseModules.map(async (module) => {
          try {
            const videos = await getVideos(courseId, module.id);
            return {
              id: module.id,
              title: module.title,
              orderIndex: module.order_index,
              lectureCount: videos.length,
              videos,
            } as ModuleWithLectureCount;
          } catch {
            return {
              id: module.id,
              title: module.title,
              orderIndex: module.order_index,
              lectureCount: 0,
              videos: [],
            } as ModuleWithLectureCount;
          }
        }),
      );

      if (isMounted.current) {
        setModules(moduleWithCounts.sort((a, b) => a.orderIndex - b.orderIndex));
        setError(null);
      }
    } catch (err) {
      console.error("Failed to load course details:", err);
      if (isMounted.current) {
        setError("Failed to load course modules. Please try again.");
        setModules([]);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [courseId, user]);

  useEffect(() => {
    setIsLoading(true);
    void loadCourseDetails();
  }, [loadCourseDetails]);

  const handleRefresh = () => {
    if (!isMounted.current) return;
    setIsRefreshing(true);
    void loadCourseDetails();
  };

  const totalLectures = useMemo(
    () => modules.reduce((acc, m) => acc + m.lectureCount, 0),
    [modules]
  );

  // ─── Payment flow ────────────────────────────────────────────────────────────

  const handleBuyNow = () => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to purchase this course.");
      return;
    }
    // If phone is missing, collect it first
    if (!profile?.phone) {
      setShowPhoneModal(true);
      return;
    }
    void initiatePayment();
  };

  const handlePhoneSubmit = async (phone: string) => {
    if (isMounted.current) setShowPhoneModal(false);
    try {
      // Save phone to DB and refresh local profile
      await saveUserProfile({ ...profile!, uid: user!.id, phone });
      await refreshProfile();
    } catch (e) {
      console.error("Failed to save phone:", e);
    }
    if (isMounted.current) void initiatePayment();
  };

  const initiatePayment = async () => {
    if (!courseId || !course) return;
    if (isMounted.current) setIsBuyLoading(true);
    try {
      const order = await createCashfreeOrder(courseId);

      if (!isMounted.current) return;

      startCashfreePayment(order.orderId, order.paymentSessionId, {
        onSuccess: (orderId) => {
          if (!isMounted.current) return;
          router.replace({
            pathname: "/payment/success",
            params: {
              orderId,
              courseTitle: course.title,
              courseId,
            },
          } as any);
        },
        onError: (code, message) => {
          if (!isMounted.current) return;
          router.replace({
            pathname: "/payment/failure",
            params: { orderId: order.orderId, code, message, courseId },
          } as any);
        },
        onExit: () => {
          if (isMounted.current) {
            Alert.alert("Cancelled", "Payment was cancelled.");
          }
        },
      });
    } catch (err: any) {
      if (isMounted.current) {
        Alert.alert("Error", err?.message ?? "Could not start payment. Please try again.");
      }
    } finally {
      if (isMounted.current) setIsBuyLoading(false);
    }
  };

  // ─── Bottom CTA bar ──────────────────────────────────────────────────────────

  const renderBottomBar = () => {
    if (isAdmin || !course) return null;

    if (isEnrolled) {
      return (
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Pressable
            style={[styles.enrolledBtn, { borderColor: colors.primary }]}
            onPress={() => router.push(`/course/${courseId}` as any)}
          >
            <Ionicons name="play-circle" size={20} color={colors.primary} />
            <Text style={[styles.enrolledBtnText, { color: colors.primary }]}>
              Continue Learning
            </Text>
          </Pressable>
        </View>
      );
    }

    if (course.price === 0) {
      return (
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Pressable
            style={[styles.buyBtn, { backgroundColor: colors.primary }]}
            onPress={() => Alert.alert("Free Enroll", "Free enrollment coming soon!")}
          >
            <Text style={styles.buyBtnText}>Enroll for Free</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.priceRow}>
          <Text style={[styles.bottomPrice, { color: colors.textPrimary }]}>
            {formatPrice(course.price)}
          </Text>
          <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>one-time</Text>
        </View>

        <Pressable
          style={[styles.buyBtn, { backgroundColor: isBuyLoading ? colors.border : colors.primary }]}
          onPress={handleBuyNow}
          disabled={isBuyLoading}
        >
          {isBuyLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="card" size={18} color="#fff" />
              <Text style={styles.buyBtnText}>Buy Now</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Phone modal */}
      <PhoneModal
        visible={showPhoneModal}
        onSubmit={handlePhoneSubmit}
        onCancel={() => setShowPhoneModal(false)}
        colors={colors}
        isDark={isDark}
        styles={styles}
      />

      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Course Modules</Text>
        <View style={styles.rightPlaceholder} />
      </View>

      <View style={styles.screen}>
        {/* @ts-ignore */}
        <FlashList
          data={isLoading ? [] : modules}
          keyExtractor={(item) => item.id}
          estimatedItemSize={60}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            course ? (
              <View style={[styles.courseCard, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 12 }]}>
                <Text style={[styles.courseTitle, { color: colors.textPrimary }]}>{course.title}</Text>
                <Text style={[styles.courseMeta, { color: colors.textSecondary }]}>by {course.mentor}</Text>
                <Text style={[styles.courseMeta, { color: colors.textSecondary }]}>Category: {course.category}</Text>

                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name="layers-outline" size={14} color={colors.primary} />
                    <Text style={[styles.badgeText, { color: colors.textPrimary }]}>{modules.length} modules</Text>
                  </View>
                  <View style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name="play-circle-outline" size={14} color={colors.primary} />
                    <Text style={[styles.badgeText, { color: colors.textPrimary }]}>{totalLectures} lectures</Text>
                  </View>
                  <View style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
                    <Text style={[styles.badgeText, { color: colors.textPrimary }]}>{formatPrice(course.price)}</Text>
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            isLoading ? (
              <View style={{ gap: 12 }}>
                <CourseDetailSkeleton />
                {[1, 2, 3].map((key) => <CourseCardSkeleton key={key} />)}
              </View>
            ) : error ? (
              <View style={[styles.emptyState, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <ExpoImage source={require("../../assets/images/404-not-found.svg")} style={styles.emptyImage} contentFit="contain" />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Something went wrong</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{error}</Text>
              </View>
            ) : modules.length === 0 ? (
              <View style={[styles.emptyState, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <ExpoImage source={require("../../assets/images/empty-folder.svg")} style={styles.emptyImage} contentFit="contain" />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No modules yet</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>This course does not have modules at the moment.</Text>
              </View>
            ) : null
          }
          renderItem={({ item: module, index }) => (
            <View style={styles.moduleContainer}>
              <Pressable
                style={[
                  styles.moduleCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  expandedModuleId === module.id && styles.moduleCardExpanded,
                ]}
                onPress={() => setExpandedModuleId(expandedModuleId === module.id ? null : module.id)}
              >
                <View style={[styles.moduleIndexWrap, { backgroundColor: isDark ? "#223253" : "#E8EEFF", borderColor: colors.border }]}>
                  <Text style={[styles.moduleIndex, { color: colors.textPrimary }]}>{index + 1}</Text>
                </View>

                <View style={styles.moduleBody}>
                  <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>{module.title}</Text>
                  <Text style={[styles.moduleSubtitle, { color: colors.textSecondary }]}>
                    {module.lectureCount} lecture{module.lectureCount === 1 ? "" : "s"}
                  </Text>
                </View>

                <Ionicons
                  name={expandedModuleId === module.id ? "chevron-down-outline" : "chevron-forward-outline"}
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>

              {expandedModuleId === module.id && module.videos.length > 0 && (
                <View style={[styles.videosListContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  {module.videos.map((video, vIndex) => (
                    <Pressable
                      key={video.id}
                      style={[styles.videoItem, { borderBottomColor: colors.border }, vIndex === module.videos.length - 1 && styles.lastVideoItem]}
                      onPress={() => router.push(`/video/${video.id}` as any)}
                    >
                      <Ionicons name="play-circle" size={24} color={colors.primary} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.videoTitleText, { color: colors.textPrimary }]} numberOfLines={1}>{video.title}</Text>
                        <Text style={[styles.videoDurationText, { color: colors.textSecondary }]}>{video.duration} min</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}
        />
      </View>

      {/* Sticky bottom bar */}
      {renderBottomBar()}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    screen: { flex: 1 },
    content: { paddingHorizontal: 14, paddingBottom: 24, gap: 12 },
    headerRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10,
    },
    pageTitle: { fontSize: 20, fontWeight: "700" },
    rightPlaceholder: { width: 22, height: 22 },
    courseCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
    courseTitle: { fontSize: 17, fontWeight: "800" },
    courseMeta: { fontSize: 12, fontWeight: "600" },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    badge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10 },
    badgeText: { fontSize: 11, fontWeight: "700" },
    emptyState: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 32, alignItems: "center", marginTop: 8 },
    emptyImage: { width: 140, height: 100, marginBottom: 16 },
    emptyTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
    emptySubtitle: { fontSize: 13, textAlign: "center", fontWeight: "500", lineHeight: 18 },
    moduleContainer: { marginBottom: 0 },
    moduleCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 10, gap: 10 },
    moduleCardExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
    videosListContainer: { paddingHorizontal: 16, paddingVertical: 8, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, borderWidth: 1, borderTopWidth: 0, paddingBottom: 12 },
    videoItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
    lastVideoItem: { borderBottomWidth: 0 },
    videoTitleText: { fontSize: 14, fontWeight: "600" },
    videoDurationText: { fontSize: 12, marginTop: 2 },
    moduleIndexWrap: { width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1 },
    moduleIndex: { fontSize: 12, fontWeight: "800" },
    moduleBody: { flex: 1, gap: 2 },
    moduleTitle: { fontSize: 14, fontWeight: "700" },
    moduleSubtitle: { fontSize: 12, fontWeight: "600" },

    // Bottom bar
    bottomBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1,
    },
    priceRow: { flexDirection: "column", gap: 2 },
    bottomPrice: { fontSize: 20, fontWeight: "800" },
    priceLabel: { fontSize: 11, fontWeight: "500" },
    buyBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      borderRadius: 12, paddingVertical: 13, paddingHorizontal: 24,
    },
    buyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    enrolledBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, borderRadius: 12, paddingVertical: 13, borderWidth: 1.5,
    },
    enrolledBtnText: { fontWeight: "700", fontSize: 15 },

    // Phone Modal
    modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
    modalSheet: {
      borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1,
      paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12,
      alignItems: "center", gap: 14,
    },
    handle: { width: 40, height: 4, borderRadius: 999, marginBottom: 8 },
    modalIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
    modalTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
    modalSubtitle: { fontSize: 13, textAlign: "center", lineHeight: 20, fontWeight: "500" },
    inputWrap: {
      flexDirection: "row", alignItems: "center", borderWidth: 1.5,
      borderRadius: 12, paddingHorizontal: 14, width: "100%", height: 52,
    },
    dialCode: { fontSize: 16, fontWeight: "600", marginRight: 4 },
    inputDivider: { width: 1, height: 24, marginHorizontal: 10 },
    phoneInput: { flex: 1, fontSize: 16, fontWeight: "600" },
    modalBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      width: "100%", borderRadius: 12, paddingVertical: 14, justifyContent: "center",
    },
    modalBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    cancelBtn: { paddingVertical: 8 },
    cancelText: { fontSize: 14, fontWeight: "600" },
  });
