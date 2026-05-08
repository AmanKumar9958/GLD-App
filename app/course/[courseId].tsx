import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Image as ExpoImage } from "expo-image";
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
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CourseCardSkeleton from "../../components/ui/CourseCardSkeleton";
import CourseDetailSkeleton from "../../components/ui/CourseDetailSkeleton";
import { useAuth } from "../../context/AuthContext";
import { AppThemeColors, useTheme } from "../../context/ThemeContext";
import {
  getCourseWithModules, // <--- N+1 Fix: Single query service use kar rahe hain
} from "../../services/courseService";
import { createCashfreeOrder, startCashfreePayment } from "../../services/paymentService";
import { supabase } from "../../services/supabase";
import { saveUserProfile } from "../../services/userProfile";
import { DatabaseVideo } from "../../types/supabase";

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
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={[styles.modalIconWrap, { backgroundColor: isDark ? "#1A2E4A" : "#EFF6FF" }]}>
            <Ionicons name="call" size={24} color={colors.primary} />
          </View>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>One last step!</Text>
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

  const courseId = typeof params.courseId === "string" ? params.courseId : params.courseId?.[0] || "";

  const [course, setCourse] = useState<CourseHeader | null>(null);
  const [modules, setModules] = useState<ModuleWithLectureCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isBuyLoading, setIsBuyLoading] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showEnrolledModal, setShowEnrolledModal] = useState(false);

  const isAdmin = profile?.role === "admin";
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ✅ FIXED: N+1 Query Resolved. Using joined query to fetch everything at once.
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
      // Step 1: Single request fetches Course -> Modules -> Videos in one go
      const fullCourseData = await getCourseWithModules(courseId);

      if (!fullCourseData) {
        if (isMounted.current) {
          setError("Course not found.");
          setCourse(null);
          setModules([]);
        }
        return;
      }

      if (!isMounted.current) return;

      // Step 2: Update Course Header info
      setCourse({
        title: fullCourseData.title,
        category: fullCourseData.category,
        mentor: fullCourseData.instructor_name || "Instructor",
        price: fullCourseData.price,
      });

      // Step 3: Check enrollment status
      if (user) {
        const { data } = await supabase
          .from("user_courses")
          .select("id")
          .eq("user_id", user.id)
          .eq("course_id", courseId)
          .maybeSingle();
        setIsEnrolled(!!data);
      }

      // Step 4: Map nested data to UI structure (No more extra loops/fetches!)
      const mappedModules = (fullCourseData.modules || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        orderIndex: m.order_index,
        lectureCount: m.videos?.length || 0,
        videos: m.videos || [],
      })).sort((a: any, b: any) => a.orderIndex - b.orderIndex);

      setModules(mappedModules);
      setError(null);
    } catch (err) {
      console.error("Failed to load course details:", err);
      if (isMounted.current) {
        setError("Failed to load course details. Please try again.");
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

  const totalLectures = useMemo(() => modules.reduce((acc, m) => acc + m.lectureCount, 0), [modules]);

  // ─── Payment flow ────────────────────────────────────────────────────────────

  const handleBuyNow = () => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to purchase this course.");
      return;
    }
    if (!profile?.phone) {
      setShowPhoneModal(true);
      return;
    }
    void initiatePayment();
  };

  const handlePhoneSubmit = async (phone: string) => {
    if (isMounted.current) setShowPhoneModal(false);
    try {
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
            params: { orderId, courseTitle: course.title, courseId },
          } as any);
        },
        onError: (code, message) => {
          if (!isMounted.current) return;
          router.replace({
            pathname: "/payment/failure",
            params: { orderId: order.orderId, code, message, courseId },
          } as any);
        },
        onExit: () => { },
      });
    } catch (err: any) {
      if (isMounted.current) {
        const msg: string = err?.message ?? "";
        if (msg.toLowerCase().includes("already enrolled")) {
          setShowEnrolledModal(true);
        } else {
          Alert.alert("Error", msg || "Could not start payment. Please try again.");
        }
      }
    } finally {
      if (isMounted.current) setIsBuyLoading(false);
    }
  };

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
            <Text style={[styles.enrolledBtnText, { color: colors.primary }]}>Continue Learning</Text>
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
          <Text style={[styles.bottomPrice, { color: colors.textPrimary }]}>{formatPrice(course.price)}</Text>
          <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>one-time</Text>
        </View>
        <Pressable
          style={[styles.buyBtn, { backgroundColor: isBuyLoading ? colors.border : colors.primary }]}
          onPress={handleBuyNow}
          disabled={isBuyLoading}
        >
          {isBuyLoading ? <ActivityIndicator color="#fff" size="small" /> : (
            <><Ionicons name="card" size={18} color="#fff" /><Text style={styles.buyBtnText}>Buy Now</Text></>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <PhoneModal visible={showPhoneModal} onSubmit={handlePhoneSubmit} onCancel={() => setShowPhoneModal(false)} colors={colors} isDark={isDark} styles={styles} />

      <Modal transparent animationType="fade" visible={showEnrolledModal} onRequestClose={() => setShowEnrolledModal(false)}>
        <View style={styles.enrolledModalRoot}>
          <View style={[styles.enrolledModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.enrolledIconWrap, { backgroundColor: isDark ? "#0D2E1A" : "#E8FFF0" }]}>
              <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
            </View>
            <Text style={[styles.enrolledModalTitle, { color: colors.textPrimary }]}>Already Enrolled!</Text>
            <Text style={[styles.enrolledModalSubtitle, { color: colors.textSecondary }]}>You already have access to this course. Continue your learning journey!</Text>
            <Pressable style={[styles.enrolledStartBtn, { backgroundColor: colors.primary }]} onPress={() => { setShowEnrolledModal(false); setIsEnrolled(true); }}>
              <Ionicons name="play-circle" size={18} color="#fff" /><Text style={styles.enrolledStartBtnText}>Continue Learning</Text>
            </Pressable>
            <Pressable style={styles.enrolledDismissBtn} onPress={() => setShowEnrolledModal(false)}>
              <Text style={[styles.enrolledDismissText, { color: colors.textSecondary }]}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{course ? course.title : "Course Details"}</Text>
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
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
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
            ) : (
              <View style={[styles.emptyState, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <ExpoImage source={require("../../assets/images/empty-folder.svg")} style={styles.emptyImage} contentFit="contain" />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No modules yet</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>This course does not have modules at the moment.</Text>
              </View>
            )
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
                <Ionicons name={expandedModuleId === module.id ? "chevron-down-outline" : "chevron-forward-outline"} size={18} color={colors.textSecondary} />
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
      {renderBottomBar()}
    </SafeAreaView>
  );
}

// ... createStyles code remains same as provided ...
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
    enrolledModalTitle: { fontSize: 22, fontWeight: "800", textAlign: "center" },
    enrolledModalSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, fontWeight: "500" },
    enrolledStartBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      width: "100%", borderRadius: 14, paddingVertical: 14, justifyContent: "center", marginTop: 8,
    },
    enrolledStartBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    enrolledDismissBtn: { paddingVertical: 8 },
    enrolledDismissText: { fontSize: 14, fontWeight: "600" },
  });