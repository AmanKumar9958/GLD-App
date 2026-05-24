import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../services/supabase";
import { mmkv } from "../utils/storage";
import { useAuth } from "./AuthContext";

export type WishlistCourse = {
  id: string;
  title: string;
  mentor: string;
  category: string;
  price: string;
  image: string;
  level?: string;
  lessons?: number;
  duration?: string;
  rating?: number;
  learners?: string;
};

type WishlistContextValue = {
  wishlist: WishlistCourse[];
  wishlistCount: number;
  isInWishlist: (courseId: string) => boolean;
  toggleWishlist: (course: WishlistCourse) => void;
  removeFromWishlist: (courseId: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

function getStorageKey(uid: string): string {
  return `wishlist:${uid}`;
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<WishlistCourse[]>([]);

  // Stable ref so toggleWishlist/removeFromWishlist always see latest
  // wishlist without needing it in their useCallback dependency arrays
  const wishlistRef = useRef(wishlist);
  useEffect(() => {
    wishlistRef.current = wishlist;
  }, [wishlist]);

  // Stable ref for user id — prevents loadWishlist from rebuilding
  // just because the user object reference changed
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  const loadWishlist = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setWishlist([]);
      return;
    }

    try {
      const cacheRaw = mmkv.getString(getStorageKey(uid));
      if (cacheRaw) {
        setWishlist(JSON.parse(cacheRaw));
      }

      const { data, error } = await supabase
        .from("wishlists")
        .select(`
          course_id,
          courses (
            id,
            title,
            instructor_name,
            category,
            price,
            thumbnail_url
          )
        `)
        .eq("user_id", uid);

      if (error) throw error;

      const synced: WishlistCourse[] = (data || []).map((item: any) => ({
        id: item.courses.id,
        title: item.courses.title,
        mentor: item.courses.instructor_name,
        category: item.courses.category,
        price: item.courses.price.toString(),
        image: item.courses.thumbnail_url || "",
      }));

      setWishlist(synced);
      mmkv.set(getStorageKey(uid), JSON.stringify(synced));
    } catch (error) {
      console.error("Error loading wishlist:", error);
    }
  }, []); // ← empty deps: function never rebuilds

  useEffect(() => {
    loadWishlist(user?.id);
  }, [user?.id, loadWishlist]);

  const isInWishlist = useCallback(
    (courseId: string) => wishlistRef.current.some((c) => c.id === courseId),
    [] // ← uses ref, no wishlist dep, never rebuilds
  );

  const toggleWishlist = useCallback(async (course: WishlistCourse) => {
    const uid = userIdRef.current;
    if (!uid) return;

    const current = wishlistRef.current;
    const exists = current.some((item) => item.id === course.id);
    const updated = exists
      ? current.filter((item) => item.id !== course.id)
      : [course, ...current];

    setWishlist(updated);
    mmkv.set(getStorageKey(uid), JSON.stringify(updated));

    if (exists) {
      await supabase
        .from("wishlists")
        .delete()
        .eq("user_id", uid)
        .eq("course_id", course.id);
    } else {
      await supabase
        .from("wishlists")
        .insert([{ user_id: uid, course_id: course.id }]);
    }
  }, []); // ← uses refs, never rebuilds

  const removeFromWishlist = useCallback(async (courseId: string) => {
    const uid = userIdRef.current;
    if (!uid) return;

    const updated = wishlistRef.current.filter((c) => c.id !== courseId);
    setWishlist(updated);
    mmkv.set(getStorageKey(uid), JSON.stringify(updated));

    await supabase
      .from("wishlists")
      .delete()
      .eq("user_id", uid)
      .eq("course_id", courseId);
  }, []); // ← uses refs, never rebuilds

  const value = useMemo(
    () => ({
      wishlist,
      wishlistCount: wishlist.length,
      isInWishlist,
      toggleWishlist,
      removeFromWishlist,
    }),
    [wishlist, isInWishlist, toggleWishlist, removeFromWishlist]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider.");
  }
  return context;
}