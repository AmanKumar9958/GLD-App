import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";
import { fetchUserProfile, UserProfile } from "../services/userProfile";

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isAuthResolved: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);

  const refreshProfile = async (uid: string) => {
    try {
      const fresh = await fetchUserProfile(uid);
      setProfile(fresh);
    } catch (error) {
      console.error("Error refreshing profile in AuthContext:", error);
    }
  };

  useEffect(() => {
    // Check initial session
    const checkInitialSession = async () => {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await refreshProfile(currentUser.id);
      }
      setIsAuthResolved(true);
    };

    checkInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await refreshProfile(currentUser.id);
        } else {
          setProfile(null);
        }
        setIsAuthResolved(true);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      isAuthenticated: Boolean(user),
      isAuthResolved,
      refreshProfile: () => (user ? refreshProfile(user.id) : Promise.resolve()),
    }),
    [user, profile, isAuthResolved]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
