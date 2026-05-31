"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

/** Reads the theme set by ThemeScript, lets the toggle flip and persist it. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const cur = document.documentElement.getAttribute("data-theme") as Theme | null;
    if (cur === "light" || cur === "dark") setThemeState(cur);
  }, []);

  const setTheme = (t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("of-theme", t);
    } catch {
      /* ignore */
    }
    setThemeState(t);
  };

  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
