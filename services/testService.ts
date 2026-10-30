import { supabase } from "./supabase";
import {
  DatabaseMockTest,
  DatabaseTestQuestion,
  DatabaseTestAttempt,
  MockTestWithQuestions,
} from "../types/supabase";

/**
 * Fetch all published mock tests (optionally filtered by category).
 */
export async function fetchMockTests(category?: string): Promise<DatabaseMockTest[]> {
  let query = supabase
    .from("mock_tests")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (category && category !== "All") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching mock tests:", error);
    throw error;
  }
  return (data || []) as DatabaseMockTest[];
}

/**
 * Fetch all unique categories from published mock tests.
 */
export async function fetchMockTestCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from("mock_tests")
    .select("category")
    .eq("is_published", true);

  if (error || !data) {
    return ["All", "SSC", "Banking", "Railways", "State Exams"];
  }

  const set = new Set(["All", "SSC", "Banking", "Railways", "State Exams"]);
  data.forEach((item) => {
    if (item.category && item.category.trim()) {
      set.add(item.category.trim());
    }
  });

  return Array.from(set);
}

/**
 * Fetch a single mock test with all its questions ordered by order_index.
 */
export async function fetchTestWithQuestions(
  testId: string
): Promise<MockTestWithQuestions | null> {
  const { data: test, error: testErr } = await supabase
    .from("mock_tests")
    .select("*")
    .eq("id", testId)
    .single();

  if (testErr || !test) {
    console.error("Error fetching test:", testErr);
    return null;
  }

  const { data: questions, error: qErr } = await supabase
    .from("test_questions")
    .select("*")
    .eq("test_id", testId)
    .order("order_index", { ascending: true });

  if (qErr) {
    console.error("Error fetching questions for test:", qErr);
    return null;
  }

  return {
    ...(test as DatabaseMockTest),
    questions: (questions || []) as DatabaseTestQuestion[],
  };
}

/**
 * Submit a student's completed test attempt.
 */
export async function submitTestAttempt(
  attemptData: Omit<DatabaseTestAttempt, "id" | "started_at" | "submitted_at"> & {
    started_at?: string;
  }
): Promise<DatabaseTestAttempt> {
  const { data, error } = await supabase
    .from("test_attempts")
    .insert([
      {
        ...attemptData,
        submitted_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error saving test attempt:", error);
    throw error;
  }

  return data as DatabaseTestAttempt;
}

/**
 * Fetch all past attempts for a user on a specific test (or all tests).
 */
export async function fetchUserAttempts(
  userId: string,
  testId?: string
): Promise<DatabaseTestAttempt[]> {
  let query = supabase
    .from("test_attempts")
    .select("*")
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false });

  if (testId) {
    query = query.eq("test_id", testId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching user test attempts:", error);
    return [];
  }
  return (data || []) as DatabaseTestAttempt[];
}

/**
 * Fetch a single attempt by ID.
 */
export async function fetchAttemptById(
  attemptId: string
): Promise<DatabaseTestAttempt | null> {
  const { data, error } = await supabase
    .from("test_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();

  if (error) {
    console.error("Error fetching attempt by id:", error);
    return null;
  }
  return data as DatabaseTestAttempt;
}

export interface LeaderboardEntry {
  rank: number;
  attemptId: string;
  userId: string;
  userName: string;
  userPhoto?: string | null;
  score: number;
  totalMarks: number;
  accuracy: number;
  timeTakenSeconds: number;
  isCurrentUser: boolean;
}

export interface AttemptAnalysisDetails {
  attempt: DatabaseTestAttempt;
  test: DatabaseMockTest;
  questions: DatabaseTestQuestion[];
  rank: number;
  totalTakers: number;
  percentile: number;
}

/**
 * Fetch detailed analysis for a completed test attempt including test details,
 * all questions, rank, and percentile.
 */
export async function fetchAttemptDetails(
  attemptId: string,
  currentUserId?: string
): Promise<AttemptAnalysisDetails | null> {
  const attempt = await fetchAttemptById(attemptId);
  if (!attempt) return null;

  const testData = await fetchTestWithQuestions(attempt.test_id);
  if (!testData) return null;

  // Fetch all attempts for this test to calculate relative rank & percentile
  const { data: attempts, error } = await supabase
    .from("test_attempts")
    .select("id, user_id, score, time_taken_seconds")
    .eq("test_id", attempt.test_id)
    .order("score", { ascending: false })
    .order("time_taken_seconds", { ascending: true });

  const allAttempts = attempts || [];
  const totalTakers = Math.max(allAttempts.length, 1);
  const myIndex = allAttempts.findIndex((a) => a.id === attempt.id);
  const rank = myIndex !== -1 ? myIndex + 1 : 1;
  const percentile =
    totalTakers > 1
      ? Math.max(0, Math.min(100, Number((((totalTakers - rank) / totalTakers) * 100).toFixed(2))))
      : 100;

  return {
    attempt,
    test: testData,
    questions: testData.questions,
    rank,
    totalTakers,
    percentile,
  };
}

/**
 * Fetch leaderboard for a given test.
 */
export async function fetchTestLeaderboard(
  testId: string,
  currentUserId?: string
): Promise<LeaderboardEntry[]> {
  const { data: attempts, error } = await supabase
    .from("test_attempts")
    .select("id, user_id, score, total_marks, accuracy_percentage, time_taken_seconds")
    .eq("test_id", testId)
    .order("score", { ascending: false })
    .order("time_taken_seconds", { ascending: true })
    .limit(50);

  if (error || !attempts) {
    console.error("Error fetching test leaderboard:", error);
    return [];
  }

  // Get user details for unique userIds
  const userIds = Array.from(new Set(attempts.map((a) => a.user_id).filter(Boolean)));
  const userMap: Record<string, { name: string; photo_url: string | null }> = {};

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name, photo_url")
      .in("id", userIds);

    if (users) {
      users.forEach((u) => {
        userMap[u.id] = { name: u.name, photo_url: u.photo_url };
      });
    }
  }

  return attempts.map((att, idx) => {
    const uInfo = userMap[att.user_id];
    const isCurrent = currentUserId ? att.user_id === currentUserId : false;
    return {
      rank: idx + 1,
      attemptId: att.id,
      userId: att.user_id,
      userName: uInfo?.name || `Aspirant #${att.user_id ? att.user_id.slice(0, 5) : idx + 1}`,
      userPhoto: uInfo?.photo_url,
      score: att.score,
      totalMarks: att.total_marks,
      accuracy: att.accuracy_percentage,
      timeTakenSeconds: att.time_taken_seconds,
      isCurrentUser: isCurrent,
    };
  });
}

