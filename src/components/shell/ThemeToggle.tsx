"use client";

import { useTheme } from "@/lib/hooks/useTheme";
import { Icon } from "@/components/ui/Icon";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-panel text-fg-muted transition-colors hover:bg-bg-sunken hover:text-fg focus-ring"
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
    </button>
  );
}
