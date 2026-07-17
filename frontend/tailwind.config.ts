import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
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
