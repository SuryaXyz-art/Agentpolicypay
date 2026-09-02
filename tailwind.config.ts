import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./frontend/app/**/*.{ts,tsx}", "./frontend/components/**/*.{ts,tsx}", "./frontend/lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      colors: {
        night: "#070707",
        ink: "#111111",
        aqua: "#e50914",
        violet: "#ffffff",
        plasma: "#ef4444"
      },
      boxShadow: {
        glow: "0 0 70px rgba(229, 9, 20, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
