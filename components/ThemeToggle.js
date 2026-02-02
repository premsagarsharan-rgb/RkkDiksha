"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const t = useTheme();
  if (!t) return null;

  const isLight = t.theme === "light";

  return (
    <button
      type="button"
      onClick={t.toggle}
      className="px-3 py-2 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15 transition text-sm"
      title="Theme"
    >
      {isLight ? "Light" : "Dark"}
    </button>
  );
}
