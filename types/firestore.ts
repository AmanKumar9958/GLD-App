import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

/**
 * Represents a document in the `users` collection.
 * Document ID: Firebase Auth UID
 */
export interface User {
  /** Firebase Auth UID (same as the document ID) */
  uid: string;
  name: string;
  email: string;
  role: "student" | "admin";
  /** Array of Course document IDs the user has purchased */
  purchasedCourses: string[];
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

/**
 * Represents a document in the `courses` collection.
 * Document ID: Auto-generated
 */
export interface Course {
  /** Firestore document ID */
  id: string;
  /** e.g. "Target JEE 2026", "Court Assistant Mastery" */
  title: string;
  /** e.g. "Maths", "Reasoning" */
  category: string;
  price: number;
  thumbnailUrl: string;
  instructorName: string;
  isPublished: boolean;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

/**
 * Represents a document in the `modules` sub-collection.
 * Path: courses/{courseId}/modules/{moduleId}
 * Document ID: Auto-generated
 */
export interface Module {
  /** Firestore document ID */
  id: string;
  /** e.g. "Chapter 1: Algebra", "Synonyms" */
  title: string;
  /** Used for sorting modules in the UI */
  orderIndex: number;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

/**
 * Represents a document in the `videos` sub-collection.
 * Path: courses/{courseId}/modules/{moduleId}/videos/{videoId}
 * Document ID: Auto-generated
 *
 * Note: `videos` documents intentionally omit `createdAt` — the spec does not
 * require a timestamp at this level, keeping the write payload minimal.
 */
export interface Video {
  /** Firestore document ID */
  id: string;
  /** e.g. "Algebra Part 1" */
  title: string;
  /** ID from the Bunny.net API */
  bunnyVideoId: string;
  /** Duration in minutes */
  duration: number;
  /** true if this video is available before purchase (preview) */
  isPreview: boolean;
  /** Used for sorting videos within a module */
  orderIndex: number;
}

/**
 * A Module with its nested videos, returned by deep-fetch helpers.
 */
export interface ModuleWithVideos extends Module {
  videos: Video[];
}

/**
 * A Course with all its nested modules and videos.
 */
export interface CourseWithModules extends Course {
  modules: ModuleWithVideos[];
}
