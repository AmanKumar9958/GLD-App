/**
 * Firestore CRUD helpers for the `courses` collection and its
 * `modules` / `videos` sub-collections.
 *
 * Uses @react-native-firebase/firestore (compatible with React Native / Expo).
 */

import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
} from "@react-native-firebase/firestore";
import type {
    Course,
    CourseWithModules,
    Module,
    ModuleWithVideos,
    Video,
} from "../types/firestore";

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function coursesCol() {
  return collection(getFirestore(), "courses");
}

function modulesCol(courseId: string) {
  return collection(getFirestore(), "courses", courseId, "modules");
}

function videosCol(courseId: string, moduleId: string) {
  return collection(
    getFirestore(),
    "courses",
    courseId,
    "modules",
    moduleId,
    "videos",
  );
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

/**
 * Fetch all published courses ordered by creation date (newest first).
 */
export async function getPublishedCourses(): Promise<Course[]> {
  const q = query(
    coursesCol(),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);

  return snap.docs
    .map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      const data = d.data() as Omit<Course, "id">;
      return { ...data, id: d.id } as Course;
    })
    .filter((c: Course) => c.isPublished);
}

/**
 * Fetch a single course by its Firestore document ID.
 * Returns `null` when no document exists.
 */
export async function getCourseById(courseId: string): Promise<Course | null> {
  const ref = doc(coursesCol(), courseId);
  const snap = await getDoc(ref);

  if (!snap.exists) {
    return null;
  }

  return { ...(snap.data() as Omit<Course, "id">), id: snap.id };
}

/**
 * Fetch a course together with all its modules and videos in one call.
 * Modules and videos are sorted by `orderIndex` ascending.
 */
export async function getCourseWithModules(
  courseId: string,
): Promise<CourseWithModules | null> {
  const course = await getCourseById(courseId);

  if (!course) {
    return null;
  }

  const modulesQuery = query(modulesCol(courseId), orderBy("orderIndex", "asc"));
  const modulesSnap = await getDocs(modulesQuery);

  const modules: ModuleWithVideos[] = await Promise.all(
    modulesSnap.docs.map(async (mDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      const moduleData = {
        ...(mDoc.data() as Omit<Module, "id">),
        id: mDoc.id,
      } as Module;

      const videosQuery = query(
        videosCol(courseId, mDoc.id),
        orderBy("orderIndex", "asc"),
      );
      const videosSnap = await getDocs(videosQuery);

      const videos: Video[] = videosSnap.docs.map((vDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
        ...(vDoc.data() as Omit<Video, "id">),
        id: vDoc.id,
      }));

      return { ...moduleData, videos };
    }),
  );

  return { ...course, modules };
}

/**
 * Create a new course document. Returns the new document's ID.
 */
export async function createCourse(
  data: Omit<Course, "id" | "createdAt">,
): Promise<string> {
  const ref = await addDoc(coursesCol(), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Update an existing course document (partial update).
 */
export async function updateCourse(
  courseId: string,
  data: Partial<Omit<Course, "id" | "createdAt">>,
): Promise<void> {
  const ref = doc(coursesCol(), courseId);
  await setDoc(ref, data, { merge: true });
}

/**
 * Delete a course document.
 * Note: sub-collections (modules / videos) must be deleted separately or via
 * a Cloud Function; the client SDK does not cascade-delete sub-collections.
 */
export async function deleteCourse(courseId: string): Promise<void> {
  await deleteDoc(doc(coursesCol(), courseId));
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

/**
 * Fetch all modules for a course, sorted by `orderIndex`.
 */
export async function getModules(courseId: string): Promise<Module[]> {
  const q = query(modulesCol(courseId), orderBy("orderIndex", "asc"));
  const snap = await getDocs(q);

  return snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
    ...(d.data() as Omit<Module, "id">),
    id: d.id,
  }));
}

/**
 * Create a new module inside a course. Returns the new module's ID.
 */
export async function createModule(
  courseId: string,
  data: Omit<Module, "id" | "createdAt">,
): Promise<string> {
  const ref = await addDoc(modulesCol(courseId), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Update an existing module (partial update).
 */
export async function updateModule(
  courseId: string,
  moduleId: string,
  data: Partial<Omit<Module, "id" | "createdAt">>,
): Promise<void> {
  const ref = doc(modulesCol(courseId), moduleId);
  await setDoc(ref, data, { merge: true });
}

/**
 * Delete a module document.
 * Videos inside it must be deleted separately or via a Cloud Function.
 */
export async function deleteModule(
  courseId: string,
  moduleId: string,
): Promise<void> {
  await deleteDoc(doc(modulesCol(courseId), moduleId));
}

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

/**
 * Fetch all videos inside a module, sorted by `orderIndex`.
 */
export async function getVideos(
  courseId: string,
  moduleId: string,
): Promise<Video[]> {
  const q = query(
    videosCol(courseId, moduleId),
    orderBy("orderIndex", "asc"),
  );
  const snap = await getDocs(q);

  return snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
    ...(d.data() as Omit<Video, "id">),
    id: d.id,
  }));
}

/**
 * Create a new video inside a module. Returns the new video's ID.
 */
export async function createVideo(
  courseId: string,
  moduleId: string,
  data: Omit<Video, "id">,
): Promise<string> {
  const ref = await addDoc(videosCol(courseId, moduleId), data);
  return ref.id;
}

/**
 * Update an existing video (partial update).
 */
export async function updateVideo(
  courseId: string,
  moduleId: string,
  videoId: string,
  data: Partial<Omit<Video, "id">>,
): Promise<void> {
  const ref = doc(videosCol(courseId, moduleId), videoId);
  await setDoc(ref, data, { merge: true });
}

/**
 * Delete a video document.
 */
export async function deleteVideo(
  courseId: string,
  moduleId: string,
  videoId: string,
): Promise<void> {
  await deleteDoc(doc(videosCol(courseId, moduleId), videoId));
}