import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0A0B0D",
        surface: "rgba(255,255,255,0.04)",
        border: "rgba(255,255,255,0.08)",
        signal: "#4CE0D2",
        indigo: "#5B6EF5",
        secure: "#34D399",
        alert: "#F2634A",
        ink: "#E9EDF1",
        muted: "#8891A0",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        pulseline: {
          "0%": { strokeDashoffset: "40" },
          "100%": { strokeDashoffset: "0" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseline: "pulseline 1.2s linear infinite",
        blink: "blink 1.8s ease-in-out infinite",
        rise: "rise 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
