/**
 * Supabase CRUD helpers for the `courses`, `modules`, and `videos` tables.
 */

import {
  CourseWithModules,
  DatabaseCourse,
  DatabaseModule,
  DatabaseVideo
} from "../types/supabase";
import { supabase } from "./supabase";

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
    .limit(8)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Fetch a paginated list of published courses.
 */
export async function getPaginatedCourses({
  pageParam = 0,
  category = 'All',
  priceFilter = 'All'
}): Promise<{ data: DatabaseCourse[], nextPage: number | null }> {
  const limit = 6;
  const from = pageParam * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("courses")
    .select("*")
    .eq("is_published", true);

  if (category !== "All") {
    query = query.eq("category", category);
  }

  if (priceFilter === "Under ₹ 60") {
    query = query.lt("price", 60);
  } else if (priceFilter === "₹ 60 - ₹ 70") {
    query = query.gte("price", 60).lte("price", 70);
  } else if (priceFilter === "Above ₹ 70") {
    query = query.gt("price", 70);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data: data || [],
    nextPage: (data && data.length === limit) ? pageParam + 1 : null
  };
}

/**
 * Fetch top courses for the home screen to avoid fetching all courses into memory
 * and avoid N+1 queries for module counts.
 */
export async function getHomeCoursesData() {
  const { data, error } = await supabase
    .from("courses")
    .select("*, modules(id)")
    .eq("is_published", true)
    .limit(20);

  if (error) throw error;

  const courses = data || [];

  const byNewest = [...courses].sort((a, b) => {
    const bTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const aTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (bTime === aTime) return a.title.localeCompare(b.title);
    return bTime - aTime;
  }).slice(0, 8);

  const byPriceDesc = [...courses].sort((a, b) => b.price - a.price).slice(0, 8);

  return { recommended: byNewest, popular: byPriceDesc };
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
