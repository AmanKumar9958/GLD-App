/**
 * Supabase PostgreSQL types mirroring the schema in the database.
 */

export interface DatabaseUser {
  id: string; // UUID (matches auth.users.id)
  name: string;
  email: string;
  photo_url: string | null;
  role: "student" | "admin";
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

/**
 * Composite types for UI usage (nested structures).
 */

export interface ModuleWithVideos extends DatabaseModule {
  videos: DatabaseVideo[];
}

export interface CourseWithModules extends DatabaseCourse {
  modules: ModuleWithVideos[];
}
