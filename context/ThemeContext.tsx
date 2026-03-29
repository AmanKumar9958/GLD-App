import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { LayoutAnimation } from "react-native";

export type ThemeMode = "light" | "dark";

export type AppThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  primary: string;
  textPrimary: string;
  textSecondary: string;
  tabInactive: string;
  overlay: string;
  danger: string;
  warning: string;
  white: string;
};

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: AppThemeColors;
  toggleTheme: () => void;
};

const THEME_STORAGE_KEY = "gld-app-theme";

const lightColors: AppThemeColors = {
  background: "#F0F4FB",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFF",
  border: "#D5E2F5",
  primary: "#1E3989",
  textPrimary: "#1E3989",
  textSecondary: "#8090C0",
  tabInactive: "#8FA1CC",
  overlay: "rgba(18, 25, 48, 0.42)",
  danger: "#EF4444",
  warning: "#F59E0B",
  white: "#FFFFFF",
};

const darkColors: AppThemeColors = {
  background: "#0B1220",
  surface: "#111B2E",
  surfaceAlt: "#16233A",
  border: "#243755",
  primary: "#8AA4FF",
  textPrimary: "#E5ECFF",
  textSecondary: "#A8B6D9",
  tabInactive: "#6F83B8",
  overlay: "rgba(4, 8, 18, 0.62)",
  danger: "#F87171",
  warning: "#FBBF24",
  white: "#FFFFFF",
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Removed experimental Android call for LayoutAnimation

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    let active = true;

    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);

        if (!active) {
          return;
        }

        if (stored === "dark" || stored === "light") {
          setMode(stored);
        }
      } catch {
        // Keep default theme when restore fails.
      }
    };

    loadTheme();

    return () => {
      active = false;
    };
  }, []);

  const toggleTheme = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setMode((previous) => (previous === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    const persistTheme = async () => {
      try {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      } catch {
        // Keep UI responsive even if persistence fails.
      }
    };

    persistTheme();
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === "dark",
      colors: mode === "dark" ? darkColors : lightColors,
      toggleTheme,
    }),
    [mode],
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
