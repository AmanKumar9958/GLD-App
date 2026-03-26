import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    collection,
    getDocs,
    getFirestore,
    query,
    where,
} from "@react-native-firebase/firestore";

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

function normalizeState(value: unknown, progress: number): CourseState {
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();

    if (lower === "completed") {
      return "completed";
    }

    if (lower === "ongoing") {
      return "ongoing";
    }
  }

  return progress >= 100 ? "completed" : "ongoing";
}

function normalizeCourse(
  id: string,
  raw: Record<string, unknown>,
): UserCourse | null {
  const title =
    (raw.title as string | undefined) ??
    (raw.courseTitle as string | undefined) ??
    (raw.name as string | undefined);

  if (!title) {
    return null;
  }

  const subtitle =
    (raw.subtitle as string | undefined) ??
    (raw.mentor as string | undefined) ??
    (raw.instructor as string | undefined) ??
    "";

  const image =
    (raw.image as string | undefined) ??
    (raw.imageUrl as string | undefined) ??
    (raw.thumbnail as string | undefined) ??
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80";

  const progressRaw = raw.progress;
  const progress =
    typeof progressRaw === "number"
      ? Math.max(0, Math.min(100, Math.round(progressRaw)))
      : 0;

  const state = normalizeState(raw.state ?? raw.status, progress);

  return {
    id,
    title,
    subtitle,
    image,
    progress,
    state,
  };
}

export async function getCachedCourses(uid: string): Promise<UserCourse[]> {
  const cache = await AsyncStorage.getItem(getCourseCacheKey(uid));

  if (!cache) {
    return [];
  }

  return JSON.parse(cache) as UserCourse[];
}

async function fetchFromUserSubcollection(uid: string): Promise<UserCourse[]> {
  const db = getFirestore();
  const coursesRef = collection(db, "users", uid, "courses");
  const snap = await getDocs(coursesRef);
  const courses: UserCourse[] = [];

  for (const courseDoc of snap.docs) {
    const normalized = normalizeCourse(
      courseDoc.id,
      courseDoc.data() as Record<string, unknown>,
    );

    if (normalized) {
      courses.push(normalized);
    }
  }

  return courses;
}

async function fetchFromRootCollection(uid: string): Promise<UserCourse[]> {
  const db = getFirestore();
  const coursesRef = collection(db, "courses");
  const userCoursesQuery = query(coursesRef, where("uid", "==", uid));
  const snap = await getDocs(userCoursesQuery);
  const courses: UserCourse[] = [];

  for (const courseDoc of snap.docs) {
    const normalized = normalizeCourse(
      courseDoc.id,
      courseDoc.data() as Record<string, unknown>,
    );

    if (normalized) {
      courses.push(normalized);
    }
  }

  return courses;
}

export async function fetchUserCourses(uid: string): Promise<UserCourse[]> {
  const fromSubcollection = await fetchFromUserSubcollection(uid);

  if (fromSubcollection.length > 0) {
    return fromSubcollection;
  }

  return fetchFromRootCollection(uid);
}

export async function cacheUserCourses(
  uid: string,
  courses: UserCourse[],
): Promise<void> {
  await AsyncStorage.setItem(getCourseCacheKey(uid), JSON.stringify(courses));
}

export async function getUserCoursesWithCache(uid: string): Promise<{
  cached: UserCourse[];
  fresh: UserCourse[];
}> {
  const cached = await getCachedCourses(uid);
  const fresh = await fetchUserCourses(uid);

  if (fresh.length > 0) {
    await cacheUserCourses(uid, fresh);
  }

  return {
    cached,
    fresh,
  };
}
