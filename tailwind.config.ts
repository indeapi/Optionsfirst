import type { Config } from "tailwindcss";

/**
 * Options First design system.
 * Colors are driven by CSS variables (see globals.css) so that a single
 * `data-theme` switch flips the entire surface between light and dark without
 * re-rendering React. Semantic tokens keep components theme-agnostic.
 */
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg) / <alpha-value>)",
        "bg-elev": "hsl(var(--bg-elev) / <alpha-value>)",
        "bg-sunken": "hsl(var(--bg-sunken) / <alpha-value>)",
        panel: "hsl(var(--panel) / <alpha-value>)",
        "panel-2": "hsl(var(--panel-2) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
        fg: "hsl(var(--fg) / <alpha-value>)",
        "fg-muted": "hsl(var(--fg-muted) / <alpha-value>)",
        "fg-subtle": "hsl(var(--fg-subtle) / <alpha-value>)",
        brand: "hsl(var(--brand) / <alpha-value>)",
        "brand-soft": "hsl(var(--brand-soft) / <alpha-value>)",
        call: "hsl(var(--call) / <alpha-value>)",
        "call-soft": "hsl(var(--call-soft) / <alpha-value>)",
        put: "hsl(var(--put) / <alpha-value>)",
        "put-soft": "hsl(var(--put-soft) / <alpha-value>)",
        warn: "hsl(var(--warn) / <alpha-value>)",
        info: "hsl(var(--info) / <alpha-value>)",
        sim: "hsl(var(--sim) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.875rem" }],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 2px hsl(var(--shadow) / 0.06), 0 1px 1px hsl(var(--shadow) / 0.04)",
        elevated:
          "0 4px 16px -2px hsl(var(--shadow) / 0.14), 0 2px 6px -2px hsl(var(--shadow) / 0.10)",
        pop: "0 12px 40px -8px hsl(var(--shadow) / 0.28)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(2px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        "flash-up": {
          "0%": { backgroundColor: "hsl(var(--call) / 0.22)" },
          "100%": { backgroundColor: "transparent" },
        },
        "flash-down": {
          "0%": { backgroundColor: "hsl(var(--put) / 0.22)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.18s ease-out",
        "pulse-soft": "pulse-soft 1.6s ease-in-out infinite",
        "flash-up": "flash-up 0.6s ease-out",
        "flash-down": "flash-down 0.6s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
