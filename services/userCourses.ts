import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type CourseState = "ongoing" | "completed";

export type UserCourse = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  progress: number;
  state: CourseState;
};

function getCourseCacheKey(uid: string): string {
  return `user_courses:${uid}`;
}

export async function getCachedCourses(uid: string): Promise<UserCourse[]> {
  const cache = await AsyncStorage.getItem(getCourseCacheKey(uid));
  if (!cache) return [];
  return JSON.parse(cache) as UserCourse[];
}

export async function fetchUserCourses(uid: string): Promise<UserCourse[]> {
  const { data, error } = await supabase
    .from("user_courses")
    .select(`
      progress,
      state,
      course_id,
      courses (
        id,
        title,
        instructor_name,
        thumbnail_url
      )
    `)
    .eq("user_id", uid);

  if (error) {
    console.error("Error fetching user courses:", error);
    return [];
  }

  return (data || [])
    .filter((item: any) => item.courses != null)
    .map((item: any) => ({
      id: item.course_id,
      title: item.courses.title,
      subtitle: item.courses.instructor_name || "Instructor",
      image: item.courses.thumbnail_url || "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80",
      progress: item.progress,
      state: item.state as CourseState,
    }));
}

export async function cacheUserCourses(
  uid: string,
  courses: UserCourse[]
): Promise<void> {
  await AsyncStorage.setItem(getCourseCacheKey(uid), JSON.stringify(courses));
}

export async function getUserCoursesWithCache(uid: string): Promise<{
  cached: UserCourse[];
  fresh: UserCourse[];
}> {
  const cached = await getCachedCourses(uid);
  let fresh: UserCourse[] = [];
  
  try {
    fresh = await fetchUserCourses(uid);
    // Always update cache even if empty, to handle cases where all courses were deleted
    await cacheUserCourses(uid, fresh);
  } catch (error) {
    console.error("Error in getUserCoursesWithCache:", error);
  }

  return {
    cached,
    fresh,
  };
}
