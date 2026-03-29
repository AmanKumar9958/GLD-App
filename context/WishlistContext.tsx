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

export type WishlistCourse = {
  id: string;
  title: string;
  mentor: string;
  category: "English Spoken" | "Academics" | "Competitive Exams";
  level: "Beginner" | "Intermediate" | "Advanced";
  lessons: number;
  duration: string;
  rating: number;
  learners: string;
  price: string;
  image: string;
};

type WishlistContextValue = {
  wishlist: WishlistCourse[];
  wishlistCount: number;
  isInWishlist: (courseId: string) => boolean;
  toggleWishlist: (course: WishlistCourse) => void;
  removeFromWishlist: (courseId: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | undefined>(
  undefined,
);

function getStorageKey(uid: string): string {
  return `wishlist:${uid}`;
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<WishlistCourse[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadWishlist = async () => {
      if (!user?.uid) {
        if (isMounted) {
          setWishlist([]);
        }
        return;
      }

      try {
        const raw = await AsyncStorage.getItem(getStorageKey(user.uid));

        if (!isMounted) {
          return;
        }

        if (!raw) {
          setWishlist([]);
          return;
        }

        const parsed = JSON.parse(raw) as WishlistCourse[];
        setWishlist(Array.isArray(parsed) ? parsed : []);
      } catch {
        if (isMounted) {
          setWishlist([]);
        }
      }
    };

    loadWishlist();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    const saveWishlist = async () => {
      if (!user?.uid) {
        return;
      }

      try {
        await AsyncStorage.setItem(
          getStorageKey(user.uid),
          JSON.stringify(wishlist),
        );
      } catch {
        // Keep UI functional even if persistence fails.
      }
    };

    saveWishlist();
  }, [wishlist, user?.uid]);

  const isInWishlist = useCallback(
    (courseId: string) => wishlist.some((course) => course.id === courseId),
    [wishlist],
  );

  const toggleWishlist = useCallback((course: WishlistCourse) => {
    setWishlist((previous) => {
      const exists = previous.some((item) => item.id === course.id);

      if (exists) {
        return previous.filter((item) => item.id !== course.id);
      }

      return [course, ...previous];
    });
  }, []);

  const removeFromWishlist = useCallback((courseId: string) => {
    setWishlist((previous) =>
      previous.filter((course) => course.id !== courseId),
    );
  }, []);

  const value = useMemo(
    () => ({
      wishlist,
      wishlistCount: wishlist.length,
      isInWishlist,
      toggleWishlist,
      removeFromWishlist,
    }),
    [wishlist, isInWishlist, toggleWishlist, removeFromWishlist],
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
