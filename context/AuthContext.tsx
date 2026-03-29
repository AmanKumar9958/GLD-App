import {
    FirebaseAuthTypes,
    getAuth,
    onAuthStateChanged,
} from "@react-native-firebase/auth";
import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

type AuthContextValue = {
  user: FirebaseAuthTypes.User | null;
  isAuthenticated: boolean;
  isAuthResolved: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsAuthResolved(true);
    });

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isAuthResolved,
    }),
    [user, isAuthResolved],
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
