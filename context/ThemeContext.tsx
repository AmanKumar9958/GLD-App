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

export type ThemePalette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  text: string;
  textSecondary: string;
  border: string;
  tabBar: string;
  tabBarBorder: string;
  destructive: string;
  bannerBg: string;
  destructiveSurface: string;
  isDark: boolean;
};

export const lightTheme: ThemePalette = {
  bg: "#F0F4FB",
  surface: "#FFFFFF",
  surfaceAlt: "#E4EDF9",
  primary: "#1E3989",
  text: "#1E3989",
  textSecondary: "#8090C0",
  border: "#D5E2F5",
  tabBar: "#FFFFFF",
  tabBarBorder: "#E4EDF9",
  destructive: "#EF4444",
  bannerBg: "#1E3989",
  destructiveSurface: "#FEE2E2",
  isDark: false,
};

export const darkTheme: ThemePalette = {
  bg: "#0D1B3E",
  surface: "#162244",
  surfaceAlt: "#1F2F5A",
  primary: "#6E94E8",
  text: "#EEF3FF",
  textSecondary: "#7A8DB8",
  border: "#253362",
  tabBar: "#101D40",
  tabBarBorder: "#1D2A50",
  destructive: "#EF4444",
  bannerBg: "#162E6E",
  destructiveSurface: "#2A1A1A",
  isDark: true,
};

const THEME_STORAGE_KEY = "@app_theme";

type ThemeContextValue = {
  theme: ThemePalette;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((value) => {
        if (value === "dark") {
          setIsDark(true);
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light").catch(
        () => {},
      );
      return next;
    });
  }, []);

  const theme = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);

  const value = useMemo(
    () => ({ theme, toggleTheme }),
    [theme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }
  return context;
}
