/**
 * Supabase PostgreSQL types mirroring the schema in the database.
 */

export interface DatabaseUser {
  id: string; // UUID (matches auth.users.id)
  name: string;
  email: string;
  photo_url: string | null;
  phone: string | null;
  role: "student" | "admin";
  fcm_token?: string | null;
  created_at: string; // ISO timestamp
  updated_at: string;
}

export interface DatabaseCourse {
  id: string;
  title: string;
  category: string;
  price: number;
  thumbnail_url: string | null;
  instructor_name: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseModule {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  parent_id?: string | null;
  created_at: string;
}

export interface DatabaseVideo {
  id: string;
  module_id: string;
  title: string;
  bunny_video_id: string;
  duration: number;
  is_preview: boolean;
  order_index: number;
  description: string | null;
}

export interface DatabaseUserCourse {
  id: string;
  user_id: string;
  course_id: string;
  progress: number;
  state: "ongoing" | "completed";
  enrolled_at: string;
  updated_at: string;
}

export interface DatabaseWishlist {
  id: string;
  user_id: string;
  course_id: string;
  added_at: string;
}

export interface DatabasePayment {
  id: string;
  user_id: string;
  course_id: string;
  order_id: string;
  payment_session_id: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  created_at: string;
  updated_at: string;
}

/**
 * Composite types for UI usage (nested structures).
 */

export interface SubModuleWithVideos extends DatabaseModule {
  videos: DatabaseVideo[];
}

export interface ModuleWithSubModules extends DatabaseModule {
  subModules: SubModuleWithVideos[];
  videos: DatabaseVideo[];
}

export interface CourseWithModules extends DatabaseCourse {
  modules: ModuleWithSubModules[];
}

/**
 * Mock Tests & Exam System Types (Testbook Style)
 */

export interface DatabaseMockTest {
  id: string;
  title: string;
  description: string | null;
  category: string;
  duration_minutes: number;
  total_marks: number;
  positive_marks: number;
  negative_marks: number;
  is_free: boolean;
  price: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseTestQuestion {
  id: string;
  test_id: string;
  section_name: string;
  question_text: string;
  question_image_url: string | null;
  options: string[]; // 4 options
  correct_option_index: number;
  explanation: string | null;
  order_index: number;
  positive_marks: number | null;
  negative_marks: number | null;
  created_at: string;
}

export type QuestionAnswerStatus =
  | "answered"
  | "not_answered"
  | "marked_for_review"
  | "answered_and_marked"
  | "not_visited";

export interface StudentAnswerItem {
  selected_option: number | null; // index 0..3 or null
  is_correct?: boolean;
  time_spent_seconds?: number;
  status: QuestionAnswerStatus;
}

export interface DatabaseTestAttempt {
  id: string;
  user_id: string;
  test_id: string;
  score: number;
  total_marks: number;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unattempted_count: number;
  accuracy_percentage: number;
  time_taken_seconds: number;
  answers: Record<string, StudentAnswerItem>; // { [questionId]: StudentAnswerItem }
  status: "in_progress" | "completed";
  started_at: string;
  submitted_at: string;
}

export interface MockTestWithQuestions extends DatabaseMockTest {
  questions: DatabaseTestQuestion[];
}

