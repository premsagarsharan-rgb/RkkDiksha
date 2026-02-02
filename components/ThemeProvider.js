"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("dark"); // "dark" | "light"

  useEffect(() => {
    const saved = localStorage.getItem("sysbyte_theme");
    setTheme(saved === "light" ? "light" : "dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", theme === "light");
    document.documentElement.classList.toggle("theme-dark", theme !== "light");
    try { localStorage.setItem("sysbyte_theme", theme); } catch {}
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggle: () => setTheme(t => (t === "light" ? "dark" : "light")),
  }), [theme]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
