import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import {
  fetchAttemptDetails,
  fetchTestLeaderboard,
  AttemptAnalysisDetails,
  LeaderboardEntry,
} from "../../../services/testService";
import { DatabaseTestQuestion } from "../../../types/supabase";

const { width } = Dimensions.get("window");

type TabType = "analysis" | "solutions" | "leaderboard";
type FilterType = "all" | "correct" | "incorrect" | "unattempted";

export default function TestResultScreen() {
  const router = useRouter();
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("analysis");
  const [details, setDetails] = useState<AttemptAnalysisDetails | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  // Solutions Tab States
  const [solutionFilter, setSolutionFilter] = useState<FilterType>("all");
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  // Load Attempt Details
  useEffect(() => {
    async function loadData() {
      if (!attemptId) return;
      try {
        setIsLoading(true);
        const data = await fetchAttemptDetails(attemptId, user?.id);
        setDetails(data);
      } catch (err) {
        console.error("Failed to load attempt details:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [attemptId, user?.id]);

  // Load Leaderboard when tab selected
  useEffect(() => {
    async function loadLeaderboard() {
      if (activeTab === "leaderboard" && details?.test.id) {
        try {
          setIsLeaderboardLoading(true);
          const data = await fetchTestLeaderboard(details.test.id, user?.id);
          setLeaderboard(data);
        } catch (err) {
          console.error("Failed to load leaderboard:", err);
        } finally {
          setIsLeaderboardLoading(false);
        }
      }
    }
    loadLeaderboard();
  }, [activeTab, details?.test.id, user?.id]);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m ${s}s`;
    }
    return `${m}m ${s}s`;
  };

  // Filtered Questions for Solutions Tab
  const filteredQuestions = useMemo(() => {
    if (!details) return [];
    return details.questions.filter((q, idx) => {
      const ans = details.attempt.answers?.[q.id];
      if (solutionFilter === "all") return true;
      if (solutionFilter === "correct") return ans?.is_correct === true;
      if (solutionFilter === "incorrect")
        return ans?.selected_option !== null && ans?.selected_option !== undefined && !ans.is_correct;
      if (solutionFilter === "unattempted")
        return ans?.selected_option === null || ans?.selected_option === undefined;
      return true;
    });
  }, [details, solutionFilter]);

  // Share Scorecard
  const handleShare = async () => {
    if (!details) return;
    try {
      await Share.share({
        message: `I scored ${details.attempt.score}/${details.attempt.total_marks} with ${details.attempt.accuracy_percentage}% accuracy in "${details.test.title}" on GLD Institute Mock Test Platform! Can you beat my rank? 🏆`,
      });
    } catch (err) {
      console.error("Error sharing score:", err);
    }
  };

  // Section Breakdown Data
  const sectionBreakdown = useMemo(() => {
    if (!details) return [];
    const map: Record<
      string,
      { section: string; total: number; attempted: number; correct: number; incorrect: number; score: number }
    > = {};

    details.questions.forEach((q) => {
      const sec = q.section_name || "General";
      if (!map[sec]) {
        map[sec] = { section: sec, total: 0, attempted: 0, correct: 0, incorrect: 0, score: 0 };
      }
      map[sec].total += 1;
      const ans = details.attempt.answers?.[q.id];
      const posMarks = q.positive_marks ?? details.test.positive_marks;
      const negMarks = q.negative_marks ?? details.test.negative_marks;

      if (ans?.selected_option !== null && ans?.selected_option !== undefined) {
        map[sec].attempted += 1;
        if (ans.is_correct) {
          map[sec].correct += 1;
          map[sec].score += Number(posMarks);
        } else {
          map[sec].incorrect += 1;
          map[sec].score -= Number(negMarks);
        }
      }
    });

    return Object.values(map);
  }, [details]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.darkContainer}>
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Analyzing test results...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!details) {
    return (
      <SafeAreaView style={styles.darkContainer}>
        <View style={styles.centerLoading}>
          <Ionicons name="alert-circle-outline" size={54} color="#EF4444" />
          <Text style={styles.errorText}>Test result not found.</Text>
          <Pressable
            style={styles.backButtonAction}
            onPress={() => router.replace("/(tabs)/mock-tests" as any)}
          >
            <Text style={styles.backButtonActionText}>Go to Mock Tests</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { attempt, test, questions, rank, totalTakers, percentile } = details;
  const currentQ = filteredQuestions[selectedQuestionIndex] || filteredQuestions[0];
  const currentAnswer = currentQ ? attempt.answers?.[currentQ.id] : undefined;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.darkContainer}>
      {/* 1. TOP APP BAR (matching 6.jpeg) */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.iconButton}
          onPress={() => router.replace("/(tabs)/mock-tests" as any)}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.appBarTitle} numberOfLines={1}>
          {test.title}
        </Text>

        <View style={styles.appBarActions}>
          <Pressable style={styles.langBadge} onPress={() => {}}>
            <Text style={styles.langBadgeText}>E अ</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={handleShare} hitSlop={12}>
            <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* 2. PROMO / MOTIVATION BANNER (matching 6.jpeg) */}
      <View style={styles.bannerContainer}>
        <View style={styles.bannerLeft}>
          <View style={styles.bannerBrandRow}>
            <Text style={styles.brandTitle}>GLD</Text>
            <View style={styles.brandDivider} />
            <Text style={styles.brandSubtitle}>ACHIEVERS LAB</Text>
          </View>
          <Text style={styles.bannerHeadline}>Your Story,</Text>
          <Text style={styles.bannerHeadlineAccent}>Their Inspiration.</Text>
          <Text style={styles.bannerCaption}>Learn. Improve. Get Featured.</Text>
        </View>

        <View style={styles.bannerRight}>
          <View style={styles.rewardCard}>
            <View style={styles.coinBadge}>
              <Ionicons name="sparkles" size={12} color="#FBBF24" />
              <Text style={styles.coinBadgeText}>GLD Coins</Text>
            </View>
            <Text style={styles.rewardAmount}>+50</Text>
            <Text style={styles.rewardSubtext}>Test Complete</Text>
            <View style={styles.claimButton}>
              <Text style={styles.claimButtonText}>Earned</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 3. TABS: Analysis | Solutions | Leaderboard (matching 6.jpeg) */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabItem, activeTab === "analysis" && styles.tabItemActive]}
          onPress={() => setActiveTab("analysis")}
        >
          <Text
            style={[styles.tabItemText, activeTab === "analysis" && styles.tabItemTextActive]}
          >
            Analysis
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabItem, activeTab === "solutions" && styles.tabItemActive]}
          onPress={() => {
            setActiveTab("solutions");
            setSelectedQuestionIndex(0);
          }}
        >
          <Text
            style={[styles.tabItemText, activeTab === "solutions" && styles.tabItemTextActive]}
          >
            Solutions
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabItem, activeTab === "leaderboard" && styles.tabItemActive]}
          onPress={() => setActiveTab("leaderboard")}
        >
          <Text
            style={[styles.tabItemText, activeTab === "leaderboard" && styles.tabItemTextActive]}
          >
            Leaderboard
          </Text>
        </Pressable>
      </View>

      {/* 4. TAB CONTENTS */}
      {activeTab === "analysis" && (
        <ScrollView
          style={styles.tabContentScroll}
          contentContainerStyle={styles.analysisContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Summary Header with Cut-off */}
          <View style={styles.summaryHeaderRow}>
            <View style={styles.summaryHeaderLeft}>
              <Text style={styles.summaryHeaderTitle}>QUICK SUMMARY</Text>
              <Ionicons name="information-circle-outline" size={18} color="#9CA3AF" />
            </View>

            <View style={styles.summaryHeaderRight}>
              <View style={styles.categoryDropdown}>
                <Text style={styles.categoryDropdownText}>General</Text>
                <Ionicons name="chevron-down" size={14} color="#3B82F6" />
              </View>
              <Text style={styles.cutoffText}>
                Cut off: {Math.round(attempt.total_marks * 0.6)}-
                {Math.round(attempt.total_marks * 0.7)}
              </Text>
            </View>
          </View>

          {/* CARD 1: RANK (matching 6.jpeg) */}
          <View style={styles.metricCard}>
            <View style={styles.metricLeft}>
              <View style={[styles.metricIconBox, { backgroundColor: "#361B23" }]}>
                <Ionicons name="flag-outline" size={24} color="#F43F5E" />
              </View>
              <Text style={styles.metricLabel}>Rank</Text>
            </View>
            <Text style={styles.metricValue}>
              {rank}
              <Text style={styles.metricSubValue}>/{totalTakers}</Text>
            </Text>
          </View>

          {/* CARD 2: SCORE (matching 6.jpeg) */}
          <View style={styles.metricCard}>
            <View style={styles.metricLeft}>
              <View style={[styles.metricIconBox, { backgroundColor: "#2A1B3D" }]}>
                <Ionicons name="trophy-outline" size={24} color="#A855F7" />
              </View>
              <Text style={styles.metricLabel}>Score</Text>
            </View>
            <Text style={styles.metricValue}>
              {attempt.score}
              <Text style={styles.metricSubValue}>/{attempt.total_marks}</Text>
            </Text>
          </View>

          {/* CARD 3: GROUPED CARD (Percentile, Accuracy, Qs. Attempted - matching 6.jpeg) */}
          <View style={styles.groupedMetricCard}>
            {/* Percentile Row */}
            <View style={styles.groupedRow}>
              <View style={styles.metricLeft}>
                <View style={[styles.metricIconBox, { backgroundColor: "#2D1D3A" }]}>
                  <Ionicons name="person-outline" size={22} color="#C084FC" />
                </View>
                <Text style={styles.metricLabel}>Percentile</Text>
              </View>
              <Text style={styles.metricValue}>{percentile} %</Text>
            </View>

            <View style={styles.groupedDivider} />

            {/* Accuracy Row */}
            <View style={styles.groupedRow}>
              <View style={styles.metricLeft}>
                <View style={[styles.metricIconBox, { backgroundColor: "#152C28" }]}>
                  <Ionicons name="locate-outline" size={22} color="#2DD4BF" />
                </View>
                <Text style={styles.metricLabel}>Accuracy</Text>
              </View>
              <Text style={styles.metricValue}>{attempt.accuracy_percentage} %</Text>
            </View>

            <View style={styles.groupedDivider} />

            {/* Qs. Attempted Row */}
            <View style={styles.groupedRow}>
              <View style={styles.metricLeft}>
                <View style={[styles.metricIconBox, { backgroundColor: "#18263E" }]}>
                  <Ionicons name="reader-outline" size={22} color="#60A5FA" />
                </View>
                <Text style={styles.metricLabel}>Qs. Attempted</Text>
              </View>
              <Text style={styles.metricValue}>
                {attempt.correct_count + attempt.incorrect_count}
                <Text style={styles.metricSubValue}>/{attempt.total_questions}</Text>
              </Text>
            </View>
          </View>

          {/* 3 BOTTOM CHIPS: Correct | Incorrect | Unattempted (matching 6.jpeg) */}
          <View style={styles.chipsRow}>
            <View style={styles.chipCorrect}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.chipText}>Correct: {attempt.correct_count}</Text>
            </View>

            <View style={styles.chipIncorrect}>
              <Ionicons name="close-circle" size={16} color="#EF4444" />
              <Text style={styles.chipText}>Incorrect: {attempt.incorrect_count}</Text>
            </View>

            <View style={styles.chipUnattempted}>
              <Ionicons name="help-circle" size={16} color="#9CA3AF" />
              <Text style={styles.chipText}>Unattempted: {attempt.unattempted_count}</Text>
            </View>
          </View>

          {/* Time & Speed Insights */}
          <View style={styles.timeInsightCard}>
            <View style={styles.timeInsightRow}>
              <View style={styles.timeInsightItem}>
                <Ionicons name="time-outline" size={20} color="#3B82F6" />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.insightLabel}>Time Spent</Text>
                  <Text style={styles.insightValue}>{formatTime(attempt.time_taken_seconds)}</Text>
                </View>
              </View>

              <View style={styles.insightVerticalDivider} />

              <View style={styles.timeInsightItem}>
                <Ionicons name="speedometer-outline" size={20} color="#F59E0B" />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.insightLabel}>Avg. Speed</Text>
                  <Text style={styles.insightValue}>
                    {Math.round(attempt.time_taken_seconds / (attempt.total_questions || 1))}s / Q
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Section-wise Analysis Breakdown */}
          {sectionBreakdown.length > 0 && (
            <View style={styles.sectionBreakdownContainer}>
              <Text style={styles.sectionBreakdownHeader}>Section Breakdown</Text>
              {sectionBreakdown.map((sec, idx) => {
                const acc = sec.attempted > 0 ? Math.round((sec.correct / sec.attempted) * 100) : 0;
                return (
                  <View key={idx} style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionNameText}>{sec.section}</Text>
                      <Text style={styles.sectionScoreText}>
                        {sec.score.toFixed(1)} Marks
                      </Text>
                    </View>
                    <View style={styles.sectionStatsRow}>
                      <Text style={styles.sectionStatItem}>
                        Attempted: <Text style={styles.statBold}>{sec.attempted}/{sec.total}</Text>
                      </Text>
                      <Text style={styles.sectionStatItem}>
                        Correct: <Text style={[styles.statBold, { color: "#10B981" }]}>{sec.correct}</Text>
                      </Text>
                      <Text style={styles.sectionStatItem}>
                        Accuracy: <Text style={styles.statBold}>{acc}%</Text>
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <Pressable
              style={styles.primaryActionButton}
              onPress={() => {
                setActiveTab("solutions");
                setSelectedQuestionIndex(0);
              }}
            >
              <Ionicons name="book-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryActionButtonText}>View Detailed Solutions</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryActionButton}
              onPress={() => router.replace(`/test/exam/${test.id}` as any)}
            >
              <Ionicons name="refresh-outline" size={20} color="#94A3B8" style={{ marginRight: 8 }} />
              <Text style={styles.secondaryActionButtonText}>Re-attempt Test</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* 5. SOLUTIONS TAB */}
      {activeTab === "solutions" && (
        <View style={styles.solutionsWrapper}>
          {/* Solution Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            <Pressable
              style={[
                styles.filterPill,
                solutionFilter === "all" && styles.filterPillActive,
              ]}
              onPress={() => {
                setSolutionFilter("all");
                setSelectedQuestionIndex(0);
              }}
            >
              <Text
                style={[
                  styles.filterPillText,
                  solutionFilter === "all" && styles.filterPillTextActive,
                ]}
              >
                All ({questions.length})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterPill,
                solutionFilter === "correct" && styles.filterPillActive,
              ]}
              onPress={() => {
                setSolutionFilter("correct");
                setSelectedQuestionIndex(0);
              }}
            >
              <Text
                style={[
                  styles.filterPillText,
                  solutionFilter === "correct" && styles.filterPillTextActive,
                ]}
              >
                Correct ({attempt.correct_count})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterPill,
                solutionFilter === "incorrect" && styles.filterPillActive,
              ]}
              onPress={() => {
                setSolutionFilter("incorrect");
                setSelectedQuestionIndex(0);
              }}
            >
              <Text
                style={[
                  styles.filterPillText,
                  solutionFilter === "incorrect" && styles.filterPillTextActive,
                ]}
              >
                Incorrect ({attempt.incorrect_count})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterPill,
                solutionFilter === "unattempted" && styles.filterPillActive,
              ]}
              onPress={() => {
                setSolutionFilter("unattempted");
                setSelectedQuestionIndex(0);
              }}
            >
              <Text
                style={[
                  styles.filterPillText,
                  solutionFilter === "unattempted" && styles.filterPillTextActive,
                ]}
              >
                Unattempted ({attempt.unattempted_count})
              </Text>
            </Pressable>
          </ScrollView>

          {/* Question Number Quick Jump Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.qJumpContainer}
          >
            {filteredQuestions.map((q, idx) => {
              const ans = attempt.answers?.[q.id];
              const isSelected = idx === selectedQuestionIndex;
              let dotBg = "#374151"; // Unattempted
              if (ans?.selected_option !== null && ans?.selected_option !== undefined) {
                dotBg = ans.is_correct ? "#10B981" : "#EF4444";
              }

              return (
                <Pressable
                  key={q.id}
                  style={[
                    styles.qJumpPill,
                    isSelected && styles.qJumpPillSelected,
                    { backgroundColor: dotBg },
                  ]}
                  onPress={() => setSelectedQuestionIndex(idx)}
                >
                  <Text style={styles.qJumpPillText}>{idx + 1}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Current Question View */}
          {currentQ ? (
            <ScrollView
              style={styles.solutionQuestionScroll}
              contentContainerStyle={styles.solutionQuestionContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Question Meta Header */}
              <View style={styles.solutionMetaRow}>
                <View style={styles.metaLeftGroup}>
                  <Text style={styles.solutionQNumber}>
                    Question {selectedQuestionIndex + 1}
                  </Text>
                  <View style={styles.sectionPill}>
                    <Text style={styles.sectionPillText}>
                      {currentQ.section_name || "General"}
                    </Text>
                  </View>
                </View>

                {/* Status Badge */}
                {currentAnswer?.selected_option === null ||
                currentAnswer?.selected_option === undefined ? (
                  <View style={styles.unattemptedStatusBadge}>
                    <Text style={styles.unattemptedStatusText}>Skipped (0)</Text>
                  </View>
                ) : currentAnswer.is_correct ? (
                  <View style={styles.correctStatusBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={styles.correctStatusText}>
                      +{currentQ.positive_marks ?? test.positive_marks}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.incorrectStatusBadge}>
                    <Ionicons name="close-circle" size={14} color="#EF4444" />
                    <Text style={styles.incorrectStatusText}>
                      -{currentQ.negative_marks ?? test.negative_marks}
                    </Text>
                  </View>
                )}
              </View>

              {/* Question Text */}
              <Text style={styles.solutionQuestionText}>{currentQ.question_text}</Text>

              {/* Options */}
              <View style={styles.optionsList}>
                {currentQ.options.map((optText, optIdx) => {
                  const isUserSelection = currentAnswer?.selected_option === optIdx;
                  const isCorrectOption = optIdx === currentQ.correct_option_index;

                  let optionStyle = styles.neutralOption;
                  let badge = null;

                  if (isCorrectOption) {
                    optionStyle = styles.correctOption;
                    badge = (
                      <View style={styles.optionBadgeGreen}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={styles.optionBadgeTextGreen}>Correct Answer</Text>
                      </View>
                    );
                  } else if (isUserSelection && !isCorrectOption) {
                    optionStyle = styles.wrongOption;
                    badge = (
                      <View style={styles.optionBadgeRed}>
                        <Ionicons name="close-circle" size={16} color="#EF4444" />
                        <Text style={styles.optionBadgeTextRed}>Your Answer</Text>
                      </View>
                    );
                  }

                  return (
                    <View key={optIdx} style={[styles.optionCard, optionStyle]}>
                      <View style={styles.optionHeaderRow}>
                        <Text style={styles.optionIndex}>{optIdx + 1}.</Text>
                        <Text style={styles.optionText}>{optText}</Text>
                      </View>
                      {badge}
                    </View>
                  );
                })}
              </View>

              {/* Solution / Explanation Box */}
              <View style={styles.explanationBox}>
                <View style={styles.explanationHeader}>
                  <Ionicons name="bulb-outline" size={20} color="#FBBF24" />
                  <Text style={styles.explanationTitle}>Solution & Explanation</Text>
                </View>
                <Text style={styles.explanationBody}>
                  {currentQ.explanation ||
                    "Correct option is " +
                      (currentQ.correct_option_index + 1) +
                      ". " +
                      (currentQ.options[currentQ.correct_option_index] || "")}
                </Text>
              </View>

              {/* Prev / Next Question Buttons */}
              <View style={styles.solutionNavRow}>
                <Pressable
                  style={[
                    styles.solutionNavBtn,
                    selectedQuestionIndex === 0 && styles.solutionNavBtnDisabled,
                  ]}
                  disabled={selectedQuestionIndex === 0}
                  onPress={() => setSelectedQuestionIndex((prev) => Math.max(0, prev - 1))}
                >
                  <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
                  <Text style={styles.solutionNavBtnText}>Previous</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.solutionNavBtn,
                    selectedQuestionIndex >= filteredQuestions.length - 1 &&
                      styles.solutionNavBtnDisabled,
                  ]}
                  disabled={selectedQuestionIndex >= filteredQuestions.length - 1}
                  onPress={() =>
                    setSelectedQuestionIndex((prev) =>
                      Math.min(filteredQuestions.length - 1, prev + 1)
                    )
                  }
                >
                  <Text style={styles.solutionNavBtnText}>Next</Text>
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.noQuestionsBox}>
              <Text style={styles.noQuestionsText}>No questions in this filter.</Text>
            </View>
          )}
        </View>
      )}

      {/* 6. LEADERBOARD TAB */}
      {activeTab === "leaderboard" && (
        <ScrollView
          style={styles.tabContentScroll}
          contentContainerStyle={styles.leaderboardContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {isLeaderboardLoading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Fetching toppers...</Text>
            </View>
          ) : leaderboard.length === 0 ? (
            <View style={styles.centerLoading}>
              <Ionicons name="trophy-outline" size={48} color="#64748B" />
              <Text style={styles.emptyLeaderboardText}>
                No test submissions yet. Be the first to top the leaderboard!
              </Text>
            </View>
          ) : (
            <>
              {/* Podium View for Top 3 */}
              <View style={styles.podiumContainer}>
                {/* 2nd Place */}
                {leaderboard[1] && (
                  <View style={[styles.podiumCol, { marginTop: 24 }]}>
                    <View style={styles.podiumAvatarBox}>
                      <Text style={styles.podiumAvatarText}>
                        {leaderboard[1].userName.charAt(0).toUpperCase()}
                      </Text>
                      <View style={[styles.podiumBadge, { backgroundColor: "#94A3B8" }]}>
                        <Text style={styles.podiumBadgeText}>2</Text>
                      </View>
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {leaderboard[1].userName}
                    </Text>
                    <Text style={styles.podiumScore}>{leaderboard[1].score} pts</Text>
                    <View style={[styles.podiumBar, { height: 70, backgroundColor: "#334155" }]} />
                  </View>
                )}

                {/* 1st Place */}
                {leaderboard[0] && (
                  <View style={styles.podiumCol}>
                    <Ionicons name="ribbon" size={28} color="#FBBF24" style={{ marginBottom: 4 }} />
                    <View style={styles.podiumAvatarBox}>
                      <Text style={styles.podiumAvatarText}>
                        {leaderboard[0].userName.charAt(0).toUpperCase()}
                      </Text>
                      <View style={[styles.podiumBadge, { backgroundColor: "#FBBF24" }]}>
                        <Text style={[styles.podiumBadgeText, { color: "#000" }]}>1</Text>
                      </View>
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {leaderboard[0].userName}
                    </Text>
                    <Text style={styles.podiumScore}>{leaderboard[0].score} pts</Text>
                    <View style={[styles.podiumBar, { height: 95, backgroundColor: "#EAB308" }]} />
                  </View>
                )}

                {/* 3rd Place */}
                {leaderboard[2] && (
                  <View style={[styles.podiumCol, { marginTop: 36 }]}>
                    <View style={styles.podiumAvatarBox}>
                      <Text style={styles.podiumAvatarText}>
                        {leaderboard[2].userName.charAt(0).toUpperCase()}
                      </Text>
                      <View style={[styles.podiumBadge, { backgroundColor: "#D97706" }]}>
                        <Text style={styles.podiumBadgeText}>3</Text>
                      </View>
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {leaderboard[2].userName}
                    </Text>
                    <Text style={styles.podiumScore}>{leaderboard[2].score} pts</Text>
                    <View style={[styles.podiumBar, { height: 55, backgroundColor: "#78350F" }]} />
                  </View>
                )}
              </View>

              {/* Full Leaderboard List */}
              <View style={styles.leaderboardList}>
                <Text style={styles.leaderboardListHeader}>Overall Rankings</Text>
                {leaderboard.map((item) => (
                  <View
                    key={item.attemptId}
                    style={[
                      styles.leaderboardRow,
                      item.isCurrentUser && styles.leaderboardRowHighlight,
                    ]}
                  >
                    <View style={styles.leaderboardRankBadge}>
                      <Text
                        style={[
                          styles.leaderboardRankText,
                          item.rank <= 3 && { color: "#F59E0B", fontWeight: "700" },
                        ]}
                      >
                        #{item.rank}
                      </Text>
                    </View>

                    <View style={styles.leaderboardUserInfo}>
                      <Text style={styles.leaderboardUserName} numberOfLines={1}>
                        {item.userName} {item.isCurrentUser && "(You)"}
                      </Text>
                      <Text style={styles.leaderboardUserMeta}>
                        Accuracy: {item.accuracy}% • Time: {formatTime(item.timeTakenSeconds)}
                      </Text>
                    </View>

                    <View style={styles.leaderboardScoreBox}>
                      <Text style={styles.leaderboardScoreValue}>{item.score}</Text>
                      <Text style={styles.leaderboardScoreMax}>/{item.totalMarks}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  darkContainer: {
    flex: 1,
    backgroundColor: "#18191D",
  },
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: "#94A3B8",
    fontSize: 14,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    textAlign: "center",
  },
  backButtonAction: {
    marginTop: 20,
    backgroundColor: "#3B82F6",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonActionText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  /* 1. TOP APP BAR */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#262930",
    backgroundColor: "#18191D",
  },
  iconButton: {
    padding: 6,
  },
  appBarTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
    marginRight: 8,
  },
  appBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  langBadge: {
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  langBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },

  /* 2. PROMO BANNER */
  bannerContainer: {
    flexDirection: "row",
    backgroundColor: "#1A2234",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#25324E",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerLeft: {
    flex: 1,
  },
  bannerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  brandTitle: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  brandDivider: {
    width: 1,
    height: 10,
    backgroundColor: "#475569",
    marginHorizontal: 6,
  },
  brandSubtitle: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  bannerHeadline: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  bannerHeadlineAccent: {
    color: "#38BDF8",
    fontSize: 15,
    fontWeight: "700",
  },
  bannerCaption: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 4,
  },
  bannerRight: {
    marginLeft: 12,
  },
  rewardCard: {
    backgroundColor: "#131B2A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2B3C5E",
  },
  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  coinBadgeText: {
    color: "#FBBF24",
    fontSize: 10,
    fontWeight: "600",
  },
  rewardAmount: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginVertical: 2,
  },
  rewardSubtext: {
    color: "#94A3B8",
    fontSize: 9,
    marginBottom: 4,
  },
  claimButton: {
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  claimButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  /* 3. TABS */
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#262930",
    marginTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: "#3B82F6",
  },
  tabItemText: {
    color: "#9CA3AF",
    fontSize: 15,
    fontWeight: "600",
  },
  tabItemTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  /* 4. ANALYSIS TAB */
  tabContentScroll: {
    flex: 1,
  },
  analysisContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 12,
  },
  summaryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryHeaderTitle: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  summaryHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryDropdown: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  categoryDropdownText: {
    color: "#3B82F6",
    fontSize: 12,
    fontWeight: "600",
  },
  cutoffText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "500",
  },

  /* METRIC CARDS (matching 6.jpeg) */
  metricCard: {
    backgroundColor: "#20232A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2D323F",
  },
  metricLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metricIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  metricLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  metricSubValue: {
    color: "#9CA3AF",
    fontSize: 15,
    fontWeight: "500",
  },

  /* GROUPED METRIC CARD */
  groupedMetricCard: {
    backgroundColor: "#20232A",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#2D323F",
  },
  groupedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  groupedDivider: {
    height: 1,
    backgroundColor: "#2A2E39",
  },

  /* 3 BOTTOM CHIPS ROW */
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  chipCorrect: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#162B22",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#10B98140",
    gap: 6,
  },
  chipIncorrect: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2E1B1E",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EF444440",
    gap: 6,
  },
  chipUnattempted: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#20232A",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    gap: 6,
  },
  chipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },

  /* TIME & SPEED INSIGHT */
  timeInsightCard: {
    backgroundColor: "#20232A",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2D323F",
  },
  timeInsightRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  timeInsightItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  insightVerticalDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#2D323F",
  },
  insightLabel: {
    color: "#9CA3AF",
    fontSize: 11,
  },
  insightValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },

  /* SECTION BREAKDOWN */
  sectionBreakdownContainer: {
    marginBottom: 16,
  },
  sectionBreakdownHeader: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: "#20232A",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2D323F",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionNameText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  sectionScoreText: {
    color: "#3B82F6",
    fontSize: 13,
    fontWeight: "700",
  },
  sectionStatsRow: {
    flexDirection: "row",
    gap: 16,
  },
  sectionStatItem: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  statBold: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  /* ACTIONS */
  actionButtonsContainer: {
    gap: 10,
    marginTop: 8,
  },
  primaryActionButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryActionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryActionButtonText: {
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "600",
  },

  /* 5. SOLUTIONS TAB */
  solutionsWrapper: {
    flex: 1,
  },
  filterPillsRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterPill: {
    backgroundColor: "#20232A",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2D323F",
  },
  filterPillActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#3B82F6",
  },
  filterPillText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  qJumpContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  qJumpPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  qJumpPillSelected: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  qJumpPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  solutionQuestionScroll: {
    flex: 1,
  },
  solutionQuestionContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },
  solutionMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  metaLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  solutionQNumber: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  sectionPill: {
    backgroundColor: "#1F2937",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sectionPillText: {
    color: "#94A3B8",
    fontSize: 11,
  },
  correctStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#064E3B",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  correctStatusText: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "700",
  },
  incorrectStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7F1D1D",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  incorrectStatusText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
  },
  unattemptedStatusBadge: {
    backgroundColor: "#374151",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unattemptedStatusText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
  },
  solutionQuestionText: {
    color: "#F3F4F6",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 18,
    fontWeight: "500",
  },
  optionsList: {
    gap: 10,
    marginBottom: 18,
  },
  optionCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
  },
  neutralOption: {
    backgroundColor: "#20232A",
    borderColor: "#2D323F",
  },
  correctOption: {
    backgroundColor: "#064E3B30",
    borderColor: "#10B981",
  },
  wrongOption: {
    backgroundColor: "#7F1D1D30",
    borderColor: "#EF4444",
  },
  optionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  optionIndex: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "700",
    marginRight: 8,
    width: 20,
  },
  optionText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
  },
  optionBadgeGreen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingLeft: 28,
  },
  optionBadgeTextGreen: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "700",
  },
  optionBadgeRed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingLeft: 28,
  },
  optionBadgeTextRed: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
  },
  explanationBox: {
    backgroundColor: "#1F2430",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2D384E",
    marginBottom: 20,
  },
  explanationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  explanationTitle: {
    color: "#FBBF24",
    fontSize: 14,
    fontWeight: "700",
  },
  explanationBody: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 22,
  },
  solutionNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  solutionNavBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#20232A",
    borderWidth: 1,
    borderColor: "#374151",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  solutionNavBtnDisabled: {
    opacity: 0.4,
  },
  solutionNavBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  noQuestionsBox: {
    padding: 32,
    alignItems: "center",
  },
  noQuestionsText: {
    color: "#94A3B8",
    fontSize: 14,
  },

  /* 6. LEADERBOARD TAB */
  leaderboardContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 16,
  },
  emptyLeaderboardText: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
    maxWidth: 240,
  },
  podiumContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  podiumCol: {
    flex: 1,
    alignItems: "center",
  },
  podiumAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1F2937",
    borderWidth: 2,
    borderColor: "#475569",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    position: "relative",
  },
  podiumAvatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  podiumBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  podiumBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  podiumName: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  podiumScore: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  podiumBar: {
    width: "85%",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  leaderboardList: {
    backgroundColor: "#20232A",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2D323F",
  },
  leaderboardListHeader: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#282C37",
    borderRadius: 8,
  },
  leaderboardRowHighlight: {
    backgroundColor: "#1E2A44",
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  leaderboardRankBadge: {
    width: 36,
    alignItems: "center",
  },
  leaderboardRankText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
  },
  leaderboardUserInfo: {
    flex: 1,
    marginLeft: 8,
  },
  leaderboardUserName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  leaderboardUserMeta: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
  },
  leaderboardScoreBox: {
    flexDirection: "row",
    alignItems: "baseline",
    marginLeft: 8,
  },
  leaderboardScoreValue: {
    color: "#38BDF8",
    fontSize: 16,
    fontWeight: "800",
  },
  leaderboardScoreMax: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
  },
});
