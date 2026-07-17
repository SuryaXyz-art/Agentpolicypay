import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./frontend/app/**/*.{ts,tsx}", "./frontend/components/**/*.{ts,tsx}", "./frontend/lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#030303",
        ink: "#0a0a0a",
        aqua: "#ffffff",
        violet: "#bdbdbd",
        plasma: "#f5f5f5"
      },
      boxShadow: {
        glow: "0 0 70px rgba(255, 255, 255, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
