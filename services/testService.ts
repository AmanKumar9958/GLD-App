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
