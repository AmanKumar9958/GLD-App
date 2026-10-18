import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchTestWithQuestions } from "../../services/testService";
import { MockTestWithQuestions } from "../../types/supabase";

export default function TestInstructionsScreen() {
  const router = useRouter();
  const { testId } = useLocalSearchParams<{ testId: string }>();

  const [testData, setTestData] = useState<MockTestWithQuestions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTest() {
      if (!testId) return;
      try {
        const data = await fetchTestWithQuestions(testId);
        setTestData(data);
      } catch (err) {
        console.error("Failed to load test instructions:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadTest();
  }, [testId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.darkContainer}>
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!testData) {
    return (
      <SafeAreaView style={styles.darkContainer}>
        <View style={styles.centerLoading}>
          <Text style={styles.errorText}>Test not found or unavailable.</Text>
          <Pressable style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const sectionsSet = new Set(
    testData.questions.map((q) => q.section_name || "General")
  );
  const totalSections = sectionsSet.size || 1;
  const totalQuestions = testData.questions.length;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.darkContainer}>
      {/* Top Header matching 1.jpeg: < Your Tests */}
      <View style={styles.topHeader}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          <Text style={styles.backBtnText}>Your Tests</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Test Title */}
        <Text style={styles.testTitle}>{testData.title}</Text>

        {/* Duration and Maximum Marks Row */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Duration: {testData.duration_minutes} Mins.</Text>
          <Text style={styles.metaText}>
            Maximum Marks: {Number(testData.total_marks).toFixed(1)}
          </Text>
        </View>

        {/* Instructions Bullets matching exact text & structure */}
        <View style={styles.bulletList}>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              The test contains {totalSections} {totalSections === 1 ? "section" : "sections"} having {totalQuestions} questions in total.
            </Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              Each question has 4 options out of which only one is correct.
            </Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              You have to finish the test in {testData.duration_minutes} minutes.
            </Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              You will be awarded {testData.positive_marks} marks for each correct answer and {testData.negative_marks} marks will be deducted for wrong answers.
            </Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              There is no negative marking for the questions that you have not attempted.
            </Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              I have read all the instructions carefully and have understood them. I agree not to cheat or use unfair means in this examination. I understand that using unfair means of any sort for my own or someone else's advantage will lead to my immediate disqualification. The decision of GLD Institute will be final in these matters and cannot be appealed.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Button: Agree and Continue */}
      <View style={styles.bottomBar}>
        <Pressable
          style={styles.agreeBtn}
          onPress={() => router.replace(`/test/exam/${testData.id}` as any)}
        >
          <Text style={styles.agreeBtnText}>Agree and Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  darkContainer: {
    flex: 1,
    backgroundColor: "#1F2125",
  },
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 12,
  },
  errorText: {
    color: "#E5E7EB",
    fontSize: 16,
  },
  backLink: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#374151",
    borderRadius: 8,
  },
  backLinkText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  topHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  testTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  metaText: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  bulletList: {
    gap: 16,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    color: "#9CA3AF",
    fontSize: 16,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    color: "#D1D5DB",
    fontSize: 14.5,
    lineHeight: 22,
    fontWeight: "400",
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1F2125",
    borderTopWidth: 1,
    borderTopColor: "#2A2D33",
  },
  agreeBtn: {
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  agreeBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
