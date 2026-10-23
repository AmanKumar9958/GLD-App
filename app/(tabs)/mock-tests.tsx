import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import {
  fetchMockTests,
  fetchUserAttempts,
} from "../../services/testService";
import { DatabaseMockTest, DatabaseTestAttempt } from "../../types/supabase";
import Skeleton from "../../components/ui/Skeleton";

const CATEGORIES = ["All", "SSC", "Aptitude", "Banking", "Railways"];

export default function MockTestsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"tests" | "attempts">("tests");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [tests, setTests] = useState<DatabaseMockTest[]>([]);
  const [attempts, setAttempts] = useState<DatabaseTestAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [testsData, attemptsData] = await Promise.all([
        fetchMockTests(selectedCategory),
        user ? fetchUserAttempts(user.id) : Promise.resolve([]),
      ]);
      setTests(testsData);
      setAttempts(attemptsData);
    } catch (err) {
      console.error("Error loading mock tests data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCategory, user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Test Series
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Real exam pattern mock tests with live analysis
          </Text>
        </View>
        <View style={styles.badgeWrap}>
          <View style={[styles.liveBadge, { backgroundColor: "#10B981" }]}>
            <View style={styles.pulseDot} />
            <Text style={styles.liveText}>FREE AVAILABLE</Text>
          </View>
        </View>
      </View>

      {/* Main Mode Tabs: Available Tests vs My Attempts */}
      <View style={[styles.tabsWrap, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable
          style={[
            styles.tabBtn,
            activeTab === "tests" && [styles.activeTabBtn, { borderBottomColor: colors.primary }],
          ]}
          onPress={() => setActiveTab("tests")}
        >
          <Ionicons
            name="document-text-outline"
            size={18}
            color={activeTab === "tests" ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabBtnText,
              { color: activeTab === "tests" ? colors.primary : colors.textSecondary },
              activeTab === "tests" && styles.tabBtnTextActive,
            ]}
          >
            All Tests ({tests.length})
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabBtn,
            activeTab === "attempts" && [styles.activeTabBtn, { borderBottomColor: colors.primary }],
          ]}
          onPress={() => setActiveTab("attempts")}
        >
          <Ionicons
            name="ribbon-outline"
            size={18}
            color={activeTab === "attempts" ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabBtnText,
              { color: activeTab === "attempts" ? colors.primary : colors.textSecondary },
              activeTab === "attempts" && styles.tabBtnTextActive,
            ]}
          >
            My Attempts ({attempts.length})
          </Text>
        </Pressable>
      </View>

      {/* Category Pills (Visible when in All Tests tab) */}
      {activeTab === "tests" && (
        <View style={styles.categoriesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: isSelected ? "#FFFFFF" : colors.textSecondary },
                      isSelected && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={styles.contentScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingList}>
            {[1, 2, 3].map((key) => (
              <View
                key={key}
                style={[
                  styles.testCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Skeleton width="40%" height={20} borderRadius={6} />
                <Skeleton width="90%" height={24} borderRadius={6} style={{ marginTop: 10 }} />
                <Skeleton width="70%" height={16} borderRadius={6} style={{ marginTop: 8 }} />
                <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                  <Skeleton width={80} height={20} borderRadius={6} />
                  <Skeleton width={80} height={20} borderRadius={6} />
                </View>
              </View>
            ))}
          </View>
        ) : activeTab === "tests" ? (
          tests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={56} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No tests available
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Check back soon or choose another category filter.
              </Text>
            </View>
          ) : (
            tests.map((test) => (
              <View
                key={test.id}
                style={[
                  styles.testCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {/* Badges Row */}
                <View style={styles.cardTopRow}>
                  <View style={styles.tagsGroup}>
                    {test.is_free ? (
                      <View style={styles.freeBadge}>
                        <Ionicons name="checkmark-circle" size={13} color="#059669" />
                        <Text style={styles.freeBadgeText}>FREE MOCK</Text>
                      </View>
                    ) : (
                      <View style={[styles.freeBadge, { backgroundColor: "#FEF3C7" }]}>
                        <Ionicons name="star" size={13} color="#D97706" />
                        <Text style={[styles.freeBadgeText, { color: "#D97706" }]}>
                          ₹{test.price}
                        </Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
                      ]}
                    >
                      <Text style={[styles.categoryBadgeText, { color: colors.textSecondary }]}>
                        {test.category}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.langPill}>
                    <Text style={[styles.langText, { color: colors.textSecondary }]}>
                      English / हिंदी
                    </Text>
                  </View>
                </View>

                {/* Title & Description */}
                <Text style={[styles.testTitle, { color: colors.textPrimary }]}>
                  {test.title}
                </Text>
                {test.description ? (
                  <Text
                    style={[styles.testDesc, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {test.description}
                  </Text>
                ) : null}

                {/* Stats Bar */}
                <View
                  style={[
                    styles.statsRow,
                    { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" },
                  ]}
                >
                  <View style={styles.statItem}>
                    <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                      {test.duration_minutes} Mins
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statItem}>
                    <Ionicons name="trophy-outline" size={15} color={colors.textSecondary} />
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                      {test.total_marks} Marks
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statItem}>
                    <Ionicons name="help-circle-outline" size={15} color={colors.textSecondary} />
                    <Text style={[styles.statValue, { color: "#10B981" }]}>
                      +{test.positive_marks} / -{test.negative_marks}
                    </Text>
                  </View>
                </View>

                {/* Bottom CTA Button */}
                <Pressable
                  style={[styles.startBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push(`/test/${test.id}` as any)}
                >
                  <Text style={styles.startBtnText}>Attempt Now</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ))
          )
        ) : (
          /* My Attempts Tab */
          attempts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="ribbon-outline" size={56} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No test attempts yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Take your first mock test to see your score, rank, and detailed solutions here!
              </Text>
              <Pressable
                style={[styles.startBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
                onPress={() => setActiveTab("tests")}
              >
                <Text style={styles.startBtnText}>Explore Mock Tests</Text>
              </Pressable>
            </View>
          ) : (
            attempts.map((attempt) => (
              <View
                key={attempt.id}
                style={[
                  styles.attemptCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.attemptTopRow}>
                  <View style={styles.attemptStatusBadge}>
                    <Ionicons name="checkmark-done" size={14} color="#10B981" />
                    <Text style={styles.attemptStatusText}>COMPLETED</Text>
                  </View>
                  <Text style={[styles.attemptDate, { color: colors.textSecondary }]}>
                    {new Date(attempt.submitted_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                </View>

                {/* Score Summary Row */}
                <View style={styles.attemptScoreRow}>
                  <View style={styles.attemptMetricBox}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                      SCORE
                    </Text>
                    <Text style={[styles.metricBigValue, { color: colors.primary }]}>
                      {attempt.score}{" "}
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                        / {attempt.total_marks}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.attemptMetricBox}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                      ACCURACY
                    </Text>
                    <Text style={[styles.metricBigValue, { color: "#10B981" }]}>
                      {attempt.accuracy_percentage}%
                    </Text>
                  </View>

                  <View style={styles.attemptMetricBox}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                      ATTEMPTED
                    </Text>
                    <Text style={[styles.metricBigValue, { color: colors.textPrimary }]}>
                      {attempt.correct_count + attempt.incorrect_count}{" "}
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                        / {attempt.total_questions}
                      </Text>
                    </Text>
                  </View>
                </View>

                {/* Breakdown Tags */}
                <View style={styles.breakdownRow}>
                  <View style={[styles.breakdownChip, { backgroundColor: "#DCFCE7" }]}>
                    <Text style={[styles.breakdownText, { color: "#15803D" }]}>
                      ✔ {attempt.correct_count} Correct
                    </Text>
                  </View>
                  <View style={[styles.breakdownChip, { backgroundColor: "#FEE2E2" }]}>
                    <Text style={[styles.breakdownText, { color: "#B91C1C" }]}>
                      ✖ {attempt.incorrect_count} Incorrect
                    </Text>
                  </View>
                  <View style={[styles.breakdownChip, { backgroundColor: "#F1F5F9" }]}>
                    <Text style={[styles.breakdownText, { color: "#64748B" }]}>
                      ⊖ {attempt.unattempted_count} Skipped
                    </Text>
                  </View>
                </View>

                {/* View Result & Solutions CTA */}
                <Pressable
                  style={[
                    styles.viewSolutionsBtn,
                    { backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderColor: colors.border },
                  ]}
                  onPress={() => router.push(`/test/result/${attempt.id}` as any)}
                >
                  <Text style={[styles.viewSolutionsText, { color: colors.primary }]}>
                    View Analysis & Solutions
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </Pressable>
              </View>
            ))
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  badgeWrap: {
    alignItems: "flex-end",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  liveText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  tabsWrap: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTabBtn: {
    borderBottomWidth: 2,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabBtnTextActive: {
    fontWeight: "800",
  },
  categoriesContainer: {
    paddingVertical: 10,
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    fontWeight: "700",
  },
  contentScroll: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  loadingList: {
    gap: 14,
  },
  testCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tagsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  freeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  freeBadgeText: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  langPill: {},
  langText: {
    fontSize: 11,
    fontWeight: "500",
  },
  testTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  testDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#CBD5E1",
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  startBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  attemptCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  attemptTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  attemptStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  attemptStatusText: {
    color: "#15803D",
    fontSize: 10,
    fontWeight: "800",
  },
  attemptDate: {
    fontSize: 12,
    fontWeight: "500",
  },
  attemptScoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  attemptMetricBox: {
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  metricBigValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  breakdownRow: {
    flexDirection: "row",
    gap: 6,
  },
  breakdownChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  breakdownText: {
    fontSize: 11,
    fontWeight: "700",
  },
  viewSolutionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  viewSolutionsText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
