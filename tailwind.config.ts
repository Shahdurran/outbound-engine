import type { Config } from "tailwindcss";

/**
 * One accent color (acid), one dark ground, one mono stack.
 * Deliberately no gradient utilities and no extra palettes: the trace console
 * should read like an instrument panel, not a marketing page.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#08090b",
          800: "#0d0f12",
          700: "#131519",
          600: "#1a1d22",
          500: "#23272e",
          400: "#2e333b",
        },
        fg: {
          DEFAULT: "#e6e8ec",
          dim: "#9aa1ad",
          faint: "#646b78",
        },
        accent: {
          DEFAULT: "#c8f042",
          dim: "#8aa72e",
          soft: "#1f2a10",
        },
        state: {
          ok: "#4ade80",
          warn: "#fbbf24",
          err: "#f87171",
          run: "#60a5fa",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
    },
  },
  plugins: [],
};

export default config;
