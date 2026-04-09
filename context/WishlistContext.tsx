import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../services/supabase";

export type WishlistCourse = {
  id: string;
  title: string;
  mentor: string;
  category: string;
  price: string;
  image: string;
  // These might be static or handled elsewhere in the current schema
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

const WishlistContext = createContext<WishlistContextValue | undefined>(
  undefined
);

function getStorageKey(uid: string): string {
  return `wishlist:${uid}`;
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<WishlistCourse[]>([]);

  const loadWishlist = useCallback(async () => {
    if (!user?.id) {
      setWishlist([]);
      return;
    }

    try {
      // 1. Load from Cache first
      const cacheRaw = await AsyncStorage.getItem(getStorageKey(user.id));
      if (cacheRaw) {
        setWishlist(JSON.parse(cacheRaw));
      }

      // 2. Fetch from Supabase
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
        .eq("user_id", user.id);

      if (error) throw error;

      const syncedWishlist: WishlistCourse[] = (data || []).map((item: any) => ({
        id: item.courses.id,
        title: item.courses.title,
        mentor: item.courses.instructor_name,
        category: item.courses.category,
        price: item.courses.price.toString(),
        image: item.courses.thumbnail_url || "",
      }));

      setWishlist(syncedWishlist);
      await AsyncStorage.setItem(getStorageKey(user.id), JSON.stringify(syncedWishlist));
    } catch (error) {
      console.error("Error loading wishlist:", error);
    }
  }, [user?.id]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const isInWishlist = useCallback(
    (courseId: string) => wishlist.some((course) => course.id === courseId),
    [wishlist]
  );

  const toggleWishlist = useCallback(async (course: WishlistCourse) => {
    if (!user?.id) return;

    const exists = wishlist.some((item) => item.id === course.id);

    if (exists) {
      // Remove from DB
      setWishlist((prev) => prev.filter((item) => item.id !== course.id));
      await supabase
        .from("wishlists")
        .delete()
        .eq("user_id", user.id)
        .eq("course_id", course.id);
    } else {
      // Add to DB
      setWishlist((prev) => [course, ...prev]);
      await supabase
        .from("wishlists")
        .insert([{ user_id: user.id, course_id: course.id }]);
    }
    
    // Update Cache
    const updated = exists 
      ? wishlist.filter((item) => item.id !== course.id)
      : [course, ...wishlist];
    await AsyncStorage.setItem(getStorageKey(user.id), JSON.stringify(updated));
  }, [user?.id, wishlist]);

  const removeFromWishlist = useCallback(async (courseId: string) => {
    if (!user?.id) return;

    setWishlist((prev) => prev.filter((course) => course.id !== courseId));
    
    await supabase
      .from("wishlists")
      .delete()
      .eq("user_id", user.id)
      .eq("course_id", courseId);

    const updated = wishlist.filter((course) => course.id !== courseId);
    await AsyncStorage.setItem(getStorageKey(user.id), JSON.stringify(updated));
  }, [user?.id, wishlist]);

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
