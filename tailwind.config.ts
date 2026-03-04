import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1536px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-mono)", ...defaultTheme.fontFamily.mono],
      },
      colors: {
        surface: {
          0: "#0a0e17",
          1: "#111827",
          2: "#1e293b",
          3: "#283548",
        },
        border: {
          DEFAULT: "#334155",
          subtle: "#1f2937",
        },
        text: {
          primary: "#f1f5f9",
          secondary: "#cbd5e1",
          muted: "#64748b",
        },
        accent: {
          DEFAULT: "#dc2626",
          hover: "#b91c1c",
          muted: "rgba(220, 38, 38, 0.15)",
        },
        success: { DEFAULT: "#10b981", muted: "rgba(16, 185, 129, 0.15)" },
        warning: { DEFAULT: "#fbbf24", muted: "rgba(251, 191, 36, 0.15)" },
        danger: { DEFAULT: "#ef4444", muted: "rgba(239, 68, 68, 0.15)" },
        info: { DEFAULT: "#60a5fa", muted: "rgba(96, 165, 250, 0.15)" },
        purple: { DEFAULT: "#a78bfa", muted: "rgba(167, 139, 250, 0.15)" },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      fontSize: {
        "data-xs": ["0.65rem", { lineHeight: "1rem" }],
        "data-sm": ["0.75rem", { lineHeight: "1rem" }],
        "data-base": ["0.8125rem", { lineHeight: "1.25rem" }],
        "data-lg": ["0.9375rem", { lineHeight: "1.25rem" }],
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
