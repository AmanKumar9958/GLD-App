import { supabase } from "./supabase";

/**
 * Supabase Storage utility service.
 * Handles uploads, deletions, and public URL generation.
 */

/**
 * Gets the permanent public URL for a file in a public bucket.
 */
export const getPublicImageURL = (bucket: "avatars" | "thumbnails", path: string) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

/**
 * Uploads a file to a specified bucket.
 * In React Native, 'file' can be a Blob, ArrayBuffer, or FormData.
 */
export const uploadImage = async (
  bucket: "avatars" | "thumbnails",
  path: string,
  file: any,
  contentType: string = "image/jpeg"
) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: true,
    });

  if (error) throw error;
  return data;
};

/**
 * Helper to convert a local file URI to a Blob for Supabase upload.
 * Useful in React Native / Expo environments.
 */
export const uriToBlob = async (uri: string): Promise<Blob> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blob;
};

/**
 * Deletes a file from a specified bucket.
 */
export const deleteImage = async (bucket: "avatars" | "thumbnails", path: string) => {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
};
