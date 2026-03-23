import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";

export type UserProfile = {
  uid: string;
  name: string;
  email?: string;
  photoURL?: string;
};

function getUserCacheKey(uid: string): string {
  return `user_profile:${uid}`;
}

function normalizeProfile(
  uid: string,
  raw: Record<string, unknown>,
): UserProfile {
  const displayName =
    (raw.name as string | undefined) ??
    (raw.fullName as string | undefined) ??
    (raw.displayName as string | undefined) ??
    "User";

  const photoURL =
    (raw.photoURL as string | undefined) ??
    (raw.avatarUrl as string | undefined) ??
    (raw.image as string | undefined);

  const email = raw.email as string | undefined;

  return {
    uid,
    name: displayName,
    email,
    photoURL,
  };
}

export async function getCachedUserProfile(
  uid: string,
): Promise<UserProfile | null> {
  const cache = await AsyncStorage.getItem(getUserCacheKey(uid));

  if (!cache) {
    return null;
  }

  return JSON.parse(cache) as UserProfile;
}

export async function fetchUserProfile(
  uid: string,
): Promise<UserProfile | null> {
  const userDoc = await firestore().collection("users").doc(uid).get();

  if (!userDoc.exists || !userDoc.data()) {
    return null;
  }

  return normalizeProfile(uid, userDoc.data() as Record<string, unknown>);
}

export async function cacheUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(
    getUserCacheKey(profile.uid),
    JSON.stringify(profile),
  );
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
