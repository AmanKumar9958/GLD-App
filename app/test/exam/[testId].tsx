import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import {
  fetchTestWithQuestions,
  submitTestAttempt,
} from "../../../services/testService";
import {
  DatabaseTestQuestion,
  MockTestWithQuestions,
  QuestionAnswerStatus,
  StudentAnswerItem,
} from "../../../types/supabase";

type QuestionState = {
  selectedOption: number | null; // 0..3 or null
  isMarked: boolean;
  isVisited: boolean;
  timeSpentSeconds: number;
};

export default function ExamScreen() {
  const router = useRouter();
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const { user } = useAuth();

  const [testData, setTestData] = useState<MockTestWithQuestions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Current Question Index
  const [currentIndex, setCurrentIndex] = useState(0);

  // States per question: Map<questionId, QuestionState>
  const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>({});

  // Active section name
  const [activeSection, setActiveSection] = useState<string>("");

  // Total countdown timer
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Question timer (time spent on active question)
  const [questionTimer, setQuestionTimer] = useState<number>(0);

  // Modals
  const [showPalette, setShowPalette] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSectionSwitchModal, setShowSectionSwitchModal] = useState(false);
  const [targetSection, setTargetSection] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Start timestamp
  const startTimeRef = useRef<string>(new Date().toISOString());

  // 1. Fetch Test & Questions
  useEffect(() => {
    async function init() {
      if (!testId) return;
      try {
        const data = await fetchTestWithQuestions(testId);
        if (!data || data.questions.length === 0) {
          Alert.alert("Error", "No questions found for this mock test.");
          router.back();
          return;
        }

        setTestData(data);
        setTimeLeft(data.duration_minutes * 60);

        // Initialize question states
        const initialStates: Record<string, QuestionState> = {};
        const sectionsAccordion: Record<string, boolean> = {};

        data.questions.forEach((q, idx) => {
          initialStates[q.id] = {
            selectedOption: null,
            isMarked: false,
            isVisited: idx === 0, // First question is visited by default
            timeSpentSeconds: 0,
          };
          const sec = q.section_name || "General";
          sectionsAccordion[sec] = true;
        });

        setQuestionStates(initialStates);
        setExpandedSections(sectionsAccordion);
        setActiveSection(data.questions[0]?.section_name || "General");
      } catch (err) {
        console.error("Failed to load test questions:", err);
        Alert.alert("Error", "Could not load test. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [testId]);

  // Android hardware back button handler
  useEffect(() => {
    const onBackPress = () => {
      setShowSubmitModal(true);
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, []);

  // 2. Countdown Timer
  useEffect(() => {
    if (isLoading || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
      setQuestionTimer((q) => q + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, timeLeft]);

  // Current Question object
  const currentQuestion: DatabaseTestQuestion | undefined = testData?.questions[currentIndex];

  // Distinct Sections
  const sections = useMemo(() => {
    if (!testData) return [];
    return Array.from(new Set(testData.questions.map((q) => q.section_name || "General")));
  }, [testData]);

  // Format seconds to HH:MM:SS or MM:SS
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Switch Question helper
  const navigateToQuestion = useCallback((targetIdx: number) => {
    if (!testData || targetIdx < 0 || targetIdx >= testData.questions.length) return;

    // Save time spent on current question
    if (currentQuestion) {
      setQuestionStates((prev) => {
        const cur = prev[currentQuestion.id];
        return {
          ...prev,
          [currentQuestion.id]: {
            ...cur,
            timeSpentSeconds: (cur?.timeSpentSeconds || 0) + questionTimer,
          },
        };
      });
    }

    const nextQ = testData.questions[targetIdx];
    setCurrentIndex(targetIdx);
    setActiveSection(nextQ.section_name || "General");
    setQuestionTimer(0);

    // Mark next question as visited
    setQuestionStates((prev) => ({
      ...prev,
      [nextQ.id]: {
        ...prev[nextQ.id],
        isVisited: true,
      },
    }));

    setShowPalette(false);
  }, [currentQuestion, testData, questionTimer]);

  // Selecting an option
  const handleSelectOption = (optIndex: number) => {
    if (!currentQuestion) return;
    setQuestionStates((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        selectedOption: optIndex,
      },
    }));
  };

  // Clear current response
  const handleClear = () => {
    if (!currentQuestion) return;
    setQuestionStates((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        selectedOption: null,
      },
    }));
  };

  // Toggle Mark for review
  const handleToggleMark = () => {
    if (!currentQuestion) return;
    setQuestionStates((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        isMarked: !prev[currentQuestion.id]?.isMarked,
      },
    }));
  };

  // Mark & Next
  const handleMarkAndNext = () => {
    if (!currentQuestion || !testData) return;
    setQuestionStates((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        isMarked: true,
      },
    }));
    if (currentIndex < testData.questions.length - 1) {
      navigateToQuestion(currentIndex + 1);
    } else {
      setShowSubmitModal(true);
    }
  };

  // Save & Next
  const handleSaveAndNext = () => {
    if (!testData) return;
    if (currentIndex < testData.questions.length - 1) {
      navigateToQuestion(currentIndex + 1);
    } else {
      setShowSubmitModal(true);
    }
  };

  // Stats calculation for confirmation and palette
  const stats = useMemo(() => {
    let attempted = 0;
    let unattempted = 0;
    let marked = 0;
    let unseen = 0;

    if (!testData) return { attempted, unattempted, marked, unseen, total: 0 };

    testData.questions.forEach((q) => {
      const state = questionStates[q.id];
      if (state?.isMarked) marked++;

      if (state?.selectedOption !== null && state?.selectedOption !== undefined) {
        attempted++;
      } else if (state?.isVisited) {
        unattempted++;
      } else {
        unseen++;
      }
    });

    return {
      attempted,
      unattempted,
      marked,
      unseen,
      total: testData.questions.length,
    };
  }, [testData, questionStates]);

  // Section Switch Handler
  const handleSectionTabClick = (sectionName: string) => {
    if (sectionName === activeSection) return;
    setTargetSection(sectionName);
    setShowSectionSwitchModal(true);
  };

  const confirmSectionSwitch = () => {
    setShowSectionSwitchModal(false);
    if (!testData || !targetSection) return;
    const firstQIndex = testData.questions.findIndex(
      (q) => (q.section_name || "General") === targetSection
    );
    if (firstQIndex !== -1) {
      navigateToQuestion(firstQIndex);
    }
  };

  // Auto-Submit on timeout
  const handleAutoSubmit = () => {
    Alert.alert("Time's Up!", "Your test time has expired. Submitting your answers automatically...");
    confirmSubmit();
  };

  // Submit test to Supabase
  const confirmSubmit = async () => {
    if (!testData || isSubmitting) return;
    setIsSubmitting(true);

    try {
      let correctCount = 0;
      let incorrectCount = 0;
      let unattemptedCount = 0;
      let score = 0;

      const answersPayload: Record<string, StudentAnswerItem> = {};

      testData.questions.forEach((q) => {
        const state = questionStates[q.id];
        const selected = state?.selectedOption ?? null;
        const posMarks = q.positive_marks ?? testData.positive_marks;
        const negMarks = q.negative_marks ?? testData.negative_marks;

        let status: QuestionAnswerStatus = "not_visited";
        if (selected !== null) {
          status = state?.isMarked ? "answered_and_marked" : "answered";
        } else if (state?.isMarked) {
          status = "marked_for_review";
        } else if (state?.isVisited) {
          status = "not_answered";
        }

        const isCorrect = selected !== null ? selected === q.correct_option_index : undefined;

        if (selected !== null) {
          if (isCorrect) {
            correctCount++;
            score += Number(posMarks);
          } else {
            incorrectCount++;
            score -= Number(negMarks);
          }
        } else {
          unattemptedCount++;
        }

        answersPayload[q.id] = {
          selected_option: selected,
          is_correct: isCorrect,
          time_spent_seconds: state?.timeSpentSeconds || 0,
          status,
        };
      });

      const totalAttempted = correctCount + incorrectCount;
      const accuracy = totalAttempted > 0 ? (correctCount / totalAttempted) * 100 : 0;
      const timeTaken = testData.duration_minutes * 60 - timeLeft;

      const attemptResult = await submitTestAttempt({
        user_id: user?.id || "00000000-0000-0000-0000-000000000000",
        test_id: testData.id,
        score: Number(score.toFixed(2)),
        total_marks: testData.total_marks,
        total_questions: testData.questions.length,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        unattempted_count: unattemptedCount,
        accuracy_percentage: Number(accuracy.toFixed(2)),
        time_taken_seconds: Math.max(1, timeTaken),
        answers: answersPayload,
        status: "completed",
        started_at: startTimeRef.current,
      });

      setShowSubmitModal(false);
      // Navigate to Screen 6: Analysis
      router.replace(`/test/result/${attemptResult.id}` as any);
    } catch (err) {
      console.error("Submission failed:", err);
      Alert.alert("Submission Error", "Failed to submit test. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !testData || !currentQuestion) {
    return (
      <SafeAreaView style={styles.darkContainer}>
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={{ color: "#9CA3AF", marginTop: 12 }}>Loading exam environment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentState = questionStates[currentQuestion.id];
  const isCurrentMarked = currentState?.isMarked || false;
  const currentSelectedOption = currentState?.selectedOption;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.darkContainer}>
      {/* ─── Header: 4.jpeg & 5.jpeg ────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Left: Pause / Exit Button */}
        <Pressable
          style={styles.pauseBtn}
          onPress={() => setShowSubmitModal(true)}
          hitSlop={10}
        >
          <Ionicons name="pause" size={18} color="#FFFFFF" />
        </Pressable>

        {/* Center: Timer & Test Title */}
        <View style={styles.titleWrap}>
          <Text style={[styles.timerText, timeLeft < 300 && { color: "#EF4444" }]}>
            {formatTime(timeLeft)}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {testData.title}
          </Text>
        </View>

        {/* Right: Hamburger Palette Menu Button */}
        <Pressable
          style={styles.menuBtn}
          onPress={() => setShowPalette(true)}
          hitSlop={10}
        >
          <Ionicons name="menu" size={26} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* ─── Section Tabs Bar ──────────────────────────────────────────────── */}
      {sections.length > 1 && (
        <View style={styles.sectionTabsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sections.map((sec) => {
              const isActive = sec === activeSection;
              return (
                <Pressable
                  key={sec}
                  style={[styles.sectionTab, isActive && styles.activeSectionTab]}
                  onPress={() => handleSectionTabClick(sec)}
                >
                  <Text style={[styles.sectionTabText, isActive && styles.activeSectionTabText]}>
                    {sec}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ─── Question Sub-Bar (Number, Timer, Marks, Bookmark, Star) ────────── */}
      <View style={styles.subBar}>
        <View style={styles.subBarLeft}>
          <View style={styles.qNumBadge}>
            <Text style={styles.qNumBadgeText}>{currentIndex + 1}</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.qTimerWrap}>
            <Ionicons name="time-outline" size={14} color="#9CA3AF" />
            <Text style={styles.qTimerText}>{formatTime(questionTimer)}</Text>
          </View>
          <View style={styles.markBadgeGreen}>
            <Text style={styles.markBadgeGreenText}>
              +{currentQuestion.positive_marks ?? testData.positive_marks}
            </Text>
          </View>
          <View style={styles.markBadgeRed}>
            <Text style={styles.markBadgeRedText}>
              -{currentQuestion.negative_marks ?? testData.negative_marks}
            </Text>
          </View>
        </View>

        <View style={styles.subBarRight}>
          <Pressable hitSlop={8} style={styles.actionIconBtn}>
            <Ionicons name="warning-outline" size={18} color="#9CA3AF" />
          </Pressable>
          <Pressable hitSlop={8} style={styles.actionIconBtn}>
            <Ionicons name="bookmark-outline" size={18} color="#9CA3AF" />
          </Pressable>
          {/* Star Icon for Marked for Review */}
          <Pressable hitSlop={8} onPress={handleToggleMark} style={styles.actionIconBtn}>
            <Ionicons
              name={isCurrentMarked ? "star" : "star-outline"}
              size={20}
              color={isCurrentMarked ? "#F43F5E" : "#9CA3AF"}
            />
          </Pressable>
        </View>
      </View>

      {/* ─── Question Text & Options Area ───────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.questionScrollView}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.directionText}>
          {currentQuestion.section_name ? `Section: ${currentQuestion.section_name}` : "Direction:"}
        </Text>

        <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

        {/* 4 Options matching 4.jpeg & 5.jpeg */}
        <View style={styles.optionsList}>
          {currentQuestion.options.map((optionText, optIdx) => {
            const isSelected = currentSelectedOption === optIdx;
            return (
              <Pressable
                key={optIdx}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => handleSelectOption(optIdx)}
              >
                <Text style={[styles.optionNumber, isSelected && styles.optionNumberSelected]}>
                  {optIdx + 1}.
                </Text>
                <Text style={[styles.optionContent, isSelected && styles.optionContentSelected]}>
                  {optionText}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* ─── Bottom Actions Bar: 4.jpeg & 5.jpeg ─────────────────────────────── */}
      <View style={styles.bottomBar}>
        {/* Left Button: Mark & Next (or 'Marked' with pink border if already marked) */}
        <Pressable
          style={[styles.bottomBtn, isCurrentMarked ? styles.markedBtn : styles.secondaryBtn]}
          onPress={handleMarkAndNext}
        >
          <Text style={[styles.bottomBtnText, isCurrentMarked ? styles.markedBtnText : styles.secondaryBtnText]}>
            {isCurrentMarked ? "Marked" : "Mark & Next"}
          </Text>
        </Pressable>

        {/* Center Button: Clear */}
        <Pressable style={[styles.bottomBtn, styles.secondaryBtn]} onPress={handleClear}>
          <Text style={[styles.bottomBtnText, styles.secondaryBtnText]}>Clear</Text>
        </Pressable>

        {/* Right Button: Save & Next */}
        <Pressable style={[styles.bottomBtn, styles.primaryBtn]} onPress={handleSaveAndNext}>
          <Text style={styles.primaryBtnText}>Save & Next</Text>
        </Pressable>
      </View>

      {/* ─── Palette Modal: 2.jpeg & 3.jpeg (Question Grid View) ────────────── */}
      <Modal
        visible={showPalette}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPalette(false)}
      >
        <View style={styles.paletteModalOverlay}>
          <View style={styles.paletteContainer}>
            {/* Top Bar: Grid View / List View */}
            <View style={styles.paletteHeaderTabs}>
              <View style={styles.paletteTabActive}>
                <Text style={styles.paletteTabActiveText}>Grid View</Text>
              </View>
              <View style={styles.paletteTabInactive}>
                <Text style={styles.paletteTabInactiveText}>List View</Text>
              </View>
            </View>

            {/* View Instructions Header */}
            <View style={styles.viewInstructionsRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="information-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.viewInstructionsText}>View Instructions</Text>
              </View>
              <Pressable onPress={() => setShowPalette(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Legend (2.jpeg & 3.jpeg) */}
            <View style={styles.legendContainer}>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <Ionicons name="star" size={14} color="#F43F5E" />
                  <Text style={styles.legendLabel}>Marked for Review</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#6B7280" }]} />
                  <Text style={styles.legendLabel}>Unattempted</Text>
                </View>
              </View>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDotHollow, { borderColor: "#9CA3AF" }]} />
                  <Text style={styles.legendLabel}>Unseen</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#3B82F6" }]} />
                  <Text style={styles.legendLabel}>Attempted</Text>
                </View>
              </View>
            </View>

            {/* Question Sections Accordion */}
            <ScrollView style={styles.paletteScroll}>
              {sections.map((sectionName) => {
                const sectionQuestions = testData.questions.filter(
                  (q) => (q.section_name || "General") === sectionName
                );
                const isExpanded = expandedSections[sectionName] ?? true;

                // Section mini stats
                let sMarked = 0;
                let sAttempted = 0;
                let sUnattempted = 0;
                let sUnseen = 0;

                sectionQuestions.forEach((q) => {
                  const state = questionStates[q.id];
                  if (state?.isMarked) sMarked++;
                  if (state?.selectedOption !== null && state?.selectedOption !== undefined) {
                    sAttempted++;
                  } else if (state?.isVisited) {
                    sUnattempted++;
                  } else {
                    sUnseen++;
                  }
                });

                return (
                  <View key={sectionName} style={styles.accordionWrap}>
                    <Pressable
                      style={styles.accordionHeader}
                      onPress={() =>
                        setExpandedSections((prev) => ({
                          ...prev,
                          [sectionName]: !prev[sectionName],
                        }))
                      }
                    >
                      <Text style={styles.accordionTitle}>{sectionName}</Text>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#9CA3AF"
                      />
                    </Pressable>

                    {/* Blue progress line */}
                    <View style={styles.accordionProgressTrack}>
                      <View
                        style={[
                          styles.accordionProgressFill,
                          {
                            width: `${(sAttempted / Math.max(1, sectionQuestions.length)) * 100}%`,
                          },
                        ]}
                      />
                    </View>

                    {/* Section Count Badges Row */}
                    <View style={styles.sectionStatsPills}>
                      <View style={styles.statPill}>
                        <Ionicons name="star" size={12} color="#F43F5E" />
                        <Text style={styles.statPillNum}>{sMarked}</Text>
                      </View>
                      <View style={styles.statPill}>
                        <View style={[styles.statDot, { backgroundColor: "#3B82F6" }]} />
                        <Text style={styles.statPillNum}>{sAttempted}</Text>
                      </View>
                      <View style={styles.statPill}>
                        <View style={[styles.statDot, { backgroundColor: "#6B7280" }]} />
                        <Text style={styles.statPillNum}>{sUnattempted}</Text>
                      </View>
                      <View style={styles.statPill}>
                        <View style={[styles.statDotHollow, { borderColor: "#9CA3AF" }]} />
                        <Text style={styles.statPillNum}>{sUnseen}</Text>
                      </View>
                    </View>

                    {/* Grid of question circles */}
                    {isExpanded && (
                      <View style={styles.paletteGrid}>
                        {sectionQuestions.map((q) => {
                          const qGlobalIdx = testData.questions.findIndex((item) => item.id === q.id);
                          const state = questionStates[q.id];
                          const isCurrent = qGlobalIdx === currentIndex;
                          const hasAnswered =
                            state?.selectedOption !== null && state?.selectedOption !== undefined;
                          const isMarked = state?.isMarked || false;

                          let circleBg = "#374151"; // dark gray default
                          let textClr = "#D1D5DB";

                          if (hasAnswered) {
                            circleBg = "#3B82F6"; // blue
                            textClr = "#FFFFFF";
                          }

                          return (
                            <Pressable
                              key={q.id}
                              style={[
                                styles.gridCircle,
                                { backgroundColor: circleBg },
                                isCurrent && styles.gridCircleActive,
                              ]}
                              onPress={() => navigateToQuestion(qGlobalIdx)}
                            >
                              <Text style={[styles.gridCircleText, { color: textClr }]}>
                                {q.order_index}
                              </Text>
                              {/* Star badge at bottom right if marked */}
                              {isMarked && (
                                <View style={styles.starBadgeCorner}>
                                  <Ionicons name="star" size={10} color="#F43F5E" />
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Bottom Submit Test Button */}
            <View style={styles.paletteFooter}>
              <Pressable
                style={styles.submitTestBtn}
                onPress={() => {
                  setShowPalette(false);
                  setShowSubmitModal(true);
                }}
              >
                <Text style={styles.submitTestBtnText}>SUBMIT TEST</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Submit Confirmation Modal: 7.jpeg ──────────────────────────────── */}
      <Modal
        visible={showSubmitModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSubmitModal(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogRow}>
              <View style={styles.dialogLabelGroup}>
                <Ionicons name="time-outline" size={20} color="#9CA3AF" />
                <Text style={styles.dialogLabel}>Time Left</Text>
              </View>
              <Text style={styles.dialogTimeVal}>{formatTime(timeLeft)}</Text>
            </View>

            <View style={styles.dialogRow}>
              <View style={styles.dialogLabelGroup}>
                <Ionicons name="checkmark-done" size={20} color="#9CA3AF" />
                <Text style={styles.dialogLabel}>Attempted</Text>
              </View>
              <Text style={styles.dialogVal}>{stats.attempted}</Text>
            </View>

            <View style={styles.dialogRow}>
              <View style={styles.dialogLabelGroup}>
                <Ionicons name="remove-circle-outline" size={20} color="#9CA3AF" />
                <Text style={styles.dialogLabel}>Unattempted</Text>
              </View>
              <Text style={styles.dialogVal}>{stats.unattempted + stats.unseen}</Text>
            </View>

            <View style={styles.dialogRow}>
              <View style={styles.dialogLabelGroup}>
                <Ionicons name="star-outline" size={20} color="#9CA3AF" />
                <Text style={styles.dialogLabel}>Marked</Text>
              </View>
              <Text style={styles.dialogVal}>{stats.marked}</Text>
            </View>

            <Text style={styles.dialogQuestionPrompt}>
              Are you sure you want to submit the test?
            </Text>

            {/* Buttons Row: Yes / No */}
            <View style={styles.dialogBtnRow}>
              <Pressable
                style={[styles.dialogBtn, styles.dialogYesBtn]}
                onPress={confirmSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.dialogYesBtnText}>Yes</Text>
                )}
              </Pressable>

              <Pressable
                style={[styles.dialogBtn, styles.dialogNoBtn]}
                onPress={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.dialogNoBtnText}>No</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Section Switch Confirmation Modal: 7.jpeg ──────────────────────── */}
      <Modal
        visible={showSectionSwitchModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSectionSwitchModal(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogRow}>
              <View style={styles.dialogLabelGroup}>
                <Ionicons name="time-outline" size={20} color="#9CA3AF" />
                <Text style={styles.dialogLabel}>Time Left</Text>
              </View>
              <Text style={styles.dialogTimeVal}>{formatTime(timeLeft)}</Text>
            </View>

            <View style={styles.dialogRow}>
              <View style={styles.dialogLabelGroup}>
                <Ionicons name="checkmark-done" size={20} color="#9CA3AF" />
                <Text style={styles.dialogLabel}>Attempted</Text>
              </View>
              <Text style={styles.dialogVal}>{stats.attempted}</Text>
            </View>

            <View style={styles.dialogRow}>
              <View style={styles.dialogLabelGroup}>
                <Ionicons name="remove-circle-outline" size={20} color="#9CA3AF" />
                <Text style={styles.dialogLabel}>Unattempted</Text>
              </View>
              <Text style={styles.dialogVal}>{stats.unattempted + stats.unseen}</Text>
            </View>

            <View style={styles.dialogRow}>
              <View style={styles.dialogLabelGroup}>
                <Ionicons name="star-outline" size={20} color="#9CA3AF" />
                <Text style={styles.dialogLabel}>Marked</Text>
              </View>
              <Text style={styles.dialogVal}>{stats.marked}</Text>
            </View>

            <Text style={styles.dialogQuestionPrompt}>
              Switch to "{targetSection}" section?
            </Text>

            <View style={styles.dialogBtnRow}>
              <Pressable
                style={[styles.dialogBtn, styles.dialogYesBtn]}
                onPress={confirmSectionSwitch}
              >
                <Text style={styles.dialogYesBtnText}>Yes</Text>
              </Pressable>

              <Pressable
                style={[styles.dialogBtn, styles.dialogNoBtn]}
                onPress={() => setShowSectionSwitchModal(false)}
              >
                <Text style={styles.dialogNoBtnText}>No</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#1F2126",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2D34",
  },
  pauseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    alignItems: "center",
    maxWidth: "70%",
  },
  timerText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  menuBtn: {
    padding: 4,
  },
  sectionTabsWrap: {
    backgroundColor: "#1F2126",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2D34",
  },
  sectionTab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeSectionTab: {
    borderBottomColor: "#3B82F6",
  },
  sectionTabText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
  },
  activeSectionTabText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  subBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#18191D",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2D34",
  },
  subBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  qNumBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  vDivider: {
    width: 1,
    height: 18,
    backgroundColor: "#374151",
  },
  qTimerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  qTimerText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
  },
  markBadgeGreen: {
    backgroundColor: "#064E3B",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  markBadgeGreenText: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "700",
  },
  markBadgeRed: {
    backgroundColor: "#4C0519",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  markBadgeRedText: {
    color: "#FB7185",
    fontSize: 11,
    fontWeight: "700",
  },
  subBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionIconBtn: {
    padding: 2,
  },
  questionScrollView: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  directionText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 8,
    lineHeight: 18,
  },
  questionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
    marginBottom: 20,
  },
  optionsList: {
    gap: 12,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#20232A",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#323742",
    gap: 12,
  },
  optionCardSelected: {
    borderColor: "#3B82F6",
    backgroundColor: "#1E293B",
  },
  optionNumber: {
    color: "#9CA3AF",
    fontSize: 15,
    fontWeight: "700",
  },
  optionNumberSelected: {
    color: "#3B82F6",
  },
  optionContent: {
    flex: 1,
    color: "#E5E7EB",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
  },
  optionContentSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1F2126",
    borderTopWidth: 1,
    borderTopColor: "#2A2D34",
    gap: 10,
  },
  bottomBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    backgroundColor: "#242831",
    borderWidth: 1,
    borderColor: "#3B4252",
  },
  secondaryBtnText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
  },
  markedBtn: {
    backgroundColor: "#242831",
    borderWidth: 1,
    borderColor: "#F43F5E",
  },
  markedBtnText: {
    color: "#F43F5E",
    fontSize: 14,
    fontWeight: "700",
  },
  primaryBtn: {
    backgroundColor: "#3B82F6",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  bottomBtnText: {
    fontSize: 14,
  },
  paletteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  paletteContainer: {
    height: "82%",
    backgroundColor: "#1F2126",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  paletteHeaderTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2D34",
  },
  paletteTabActive: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#9CA3AF",
    backgroundColor: "#2A2E37",
  },
  paletteTabActiveText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  paletteTabInactive: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  paletteTabInactiveText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
  },
  viewInstructionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  viewInstructionsText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  legendContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "48%",
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendDotHollow: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  legendLabel: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "500",
  },
  paletteScroll: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  accordionWrap: {
    marginBottom: 20,
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  accordionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  accordionProgressTrack: {
    height: 3,
    backgroundColor: "#374151",
    borderRadius: 2,
    marginVertical: 8,
  },
  accordionProgressFill: {
    height: 3,
    backgroundColor: "#3B82F6",
    borderRadius: 2,
  },
  sectionStatsPills: {
    flexDirection: "row",
    gap: 16,
    marginVertical: 8,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statDotHollow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  statPillNum: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "600",
  },
  paletteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
  },
  gridCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  gridCircleActive: {
    borderWidth: 2,
    borderColor: "#3B82F6",
  },
  gridCircleText: {
    fontSize: 14,
    fontWeight: "700",
  },
  starBadgeCorner: {
    position: "absolute",
    bottom: -2,
    right: -2,
  },
  paletteFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#2A2D34",
  },
  submitTestBtn: {
    backgroundColor: "#607D8B",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  submitTestBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: "100%",
    backgroundColor: "#22252C",
    borderRadius: 14,
    padding: 22,
    gap: 16,
  },
  dialogRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  dialogLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dialogLabel: {
    color: "#D1D5DB",
    fontSize: 15,
    fontWeight: "500",
  },
  dialogTimeVal: {
    color: "#3B82F6",
    fontSize: 16,
    fontWeight: "800",
  },
  dialogVal: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  dialogQuestionPrompt: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  dialogBtnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  dialogBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogYesBtn: {
    backgroundColor: "#3B82F6",
  },
  dialogYesBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  dialogNoBtn: {
    backgroundColor: "#64748B",
  },
  dialogNoBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
