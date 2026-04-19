/**
 * Supabase CRUD helpers for the `courses`, `modules`, and `videos` tables.
 */

import { supabase } from "./supabase";
import {
  DatabaseCourse,
  DatabaseModule,
  DatabaseVideo,
  CourseWithModules,
  ModuleWithVideos,
} from "../types/supabase";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapDbCourseToUi(c: DatabaseCourse) {
  return {
    ...c,
    // Add any UI-specific field mappings if necessary
  };
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

/**
 * Fetch all published courses ordered by creation date (newest first).
 */
export async function getPublishedCourses(): Promise<DatabaseCourse[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Subscribe to all published courses and receive live updates.
 * Returns an unsubscribe function.
 */
export function subscribeToPublishedCourses(
  onData: (courses: DatabaseCourse[]) => void,
  onError?: (error: Error) => void
): () => void {
  // Initial fetch
  getPublishedCourses().then(onData).catch(onError);

  // Subscribe to changes
  // Use a unique channel name to avoid "callbacks after subscribe" errors if multiple components subscribe
  const channelId = `published-courses-${Date.now()}`;
  const channel = supabase
    .channel(channelId)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "courses" },
      async (payload) => {
        // payload can be used for granular updates, but for now we re-fetch to keep it simple and consistent with initial load
        try {
          const courses = await getPublishedCourses();
          onData(courses);
        } catch (err) {
          onError?.(err as Error);
        }
      }
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn("Supabase realtime channel error. Live updates may not work.");
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Fetch a single course by its ID.
 */
export async function getCourseById(
  courseId: string
): Promise<DatabaseCourse | null> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return data;
}

/**
 * Fetch a course together with all its modules and videos in one call.
 * Uses Supabase's relational embedding.
 */
export async function getCourseWithModules(
  courseId: string
): Promise<CourseWithModules | null> {
  const { data, error } = await supabase
    .from("courses")
    .select(`
      *,
      modules:modules(
        *,
        videos:videos(*)
      )
    `)
    .eq("id", courseId)
    .order("order_index", { foreignTable: "modules", ascending: true })
    .order("order_index", { foreignTable: "modules.videos", ascending: true })
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data as CourseWithModules;
}

/**
 * Create a new course record.
 */
export async function createCourse(
  data: Omit<DatabaseCourse, "id" | "created_at" | "updated_at">
): Promise<string> {
  const { data: result, error } = await supabase
    .from("courses")
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return result.id;
}

/**
 * Update an existing course record.
 */
export async function updateCourse(
  courseId: string,
  data: Partial<Omit<DatabaseCourse, "id" | "created_at" | "updated_at">>
): Promise<void> {
  const { error } = await supabase
    .from("courses")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", courseId);

  if (error) throw error;
}

/**
 * Delete a course record. Primary key CASCADE handles modules/videos.
 */
export async function deleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export async function getModules(courseId: string): Promise<DatabaseModule[]> {
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createModule(
  courseId: string,
  data: Omit<DatabaseModule, "id" | "course_id" | "created_at">
): Promise<string> {
  const { data: result, error } = await supabase
    .from("modules")
    .insert([{ ...data, course_id: courseId }])
    .select()
    .single();

  if (error) throw error;
  return result.id;
}

export async function updateModule(
  courseId: string,
  moduleId: string,
  data: Partial<Omit<DatabaseModule, "id" | "course_id" | "created_at">>
): Promise<void> {
  const { error } = await supabase
    .from("modules")
    .update(data)
    .eq("id", moduleId);

  if (error) throw error;
}

export async function deleteModule(
  courseId: string,
  moduleId: string
): Promise<void> {
  const { error } = await supabase.from("modules").delete().eq("id", moduleId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

export async function getVideos(
  courseId: string,
  moduleId: string
): Promise<DatabaseVideo[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("module_id", moduleId)
    .order("order_index", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getVideoById(
  videoId: string
): Promise<DatabaseVideo | null> {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("Error fetching video by id:", error);
    }
    return null;
  }
  return data;
}

export async function createVideo(
  courseId: string,
  moduleId: string,
  data: Omit<DatabaseVideo, "id" | "module_id">
): Promise<string> {
  const { data: result, error } = await supabase
    .from("videos")
    .insert([{ ...data, module_id: moduleId }])
    .select()
    .single();

  if (error) throw error;
  return result.id;
}

export async function updateVideo(
  courseId: string,
  moduleId: string,
  videoId: string,
  data: Partial<Omit<DatabaseVideo, "id" | "module_id">>
): Promise<void> {
  const { error } = await supabase
    .from("videos")
    .update(data)
    .eq("id", videoId);

  if (error) throw error;
}

export async function deleteVideo(
  courseId: string,
  moduleId: string,
  videoId: string
): Promise<void> {
  const { error } = await supabase.from("videos").delete().eq("id", videoId);
  if (error) throw error;
}
