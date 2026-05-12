import { mmkv } from "../utils/storage";
import { supabase } from "./supabase";
import { DatabaseUser } from "../types/supabase";

export type UserProfile = {
  uid: string;
  name: string;
  email?: string;
  photoURL?: string;
  phone?: string;
  role?: "student" | "admin";
};

function getUserCacheKey(uid: string): string {
  return `user_profile:${uid}`;
}

function mapDatabaseUserToProfile(dbUser: DatabaseUser): UserProfile {
  return {
    uid: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    photoURL: dbUser.photo_url || undefined,
    phone: dbUser.phone || undefined,
    role: dbUser.role,
  };
}

export async function getCachedUserProfile(
  uid: string
): Promise<UserProfile | null> {
  const cache = mmkv.getString(getUserCacheKey(uid));
  if (!cache) return null;
  return JSON.parse(cache) as UserProfile;
}

export async function fetchUserProfile(
  uid: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .single();

  if (error || !data) return null;

  return mapDatabaseUserToProfile(data);
}

export async function cacheUserProfile(profile: UserProfile): Promise<void> {
  mmkv.set(
    getUserCacheKey(profile.uid),
    JSON.stringify(profile)
  );
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const updateData: Partial<DatabaseUser> = {
    name: profile.name,
    updated_at: new Date().toISOString(),
  };

  if (profile.email) updateData.email = profile.email;
  if (profile.photoURL) updateData.photo_url = profile.photoURL;
  if (profile.phone !== undefined) updateData.phone = profile.phone;
  if (profile.role) updateData.role = profile.role;

  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", profile.uid);

  if (error) throw error;

  await cacheUserProfile(profile);
}

export async function getUserProfileWithCache(uid: string): Promise<{
  cached: UserProfile | null;
  fresh: UserProfile | null;
}> {
  const cached = await getCachedUserProfile(uid);
  const fresh = await fetchUserProfile(uid);

  if (fresh) {
    await cacheUserProfile(fresh);
  }

  return {
    cached,
    fresh,
  };
}

/**
 * Partial update for a user.
 */
export async function upsertUser(
  uid: string,
  data: Partial<Omit<UserProfile, "uid">>
): Promise<void> {
  const updateData: any = { ...data };
  if (data.photoURL) {
    updateData.photo_url = data.photoURL;
    delete updateData.photoURL;
  }
  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", uid);

  if (error) throw error;
}
