import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

/**
 * Applies a persisted desktop theme preference to the document root and exposes it via context.
 *
 * The provider intentionally writes the resolved theme class directly to `documentElement`
 * because desktop shells often mount outside the routing tree and still need global styling.
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(storageKey);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : defaultTheme;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      root.classList.remove("light", "dark");
      root.classList.add(theme === "system" ? (query.matches ? "dark" : "light") : theme);
    };
    applyTheme();
    if (theme !== "system") {
      return;
    }
    query.addEventListener("change", applyTheme);
    return () => query.removeEventListener("change", applyTheme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

/**
 * Returns the current theme preference and setter from the nearest `ThemeProvider`.
 *
 * The hook throws when used outside the provider so desktop shells fail fast during setup
 * instead of silently rendering with inconsistent theme state.
 */
export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
