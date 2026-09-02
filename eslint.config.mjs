import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends("next/core-web-vitals"),
  {
    settings: {
      next: {
        rootDir: "frontend/"
      }
    },
    rules: {
      "@next/next/no-html-link-for-pages": "off"
    }
  },
  {
    ignores: [
      ".next/**",
      "frontend/.next/**",
      "node_modules/**",
      "artifacts/**",
      "cache/**",
      "typechain-types/**"
    ]
  }
];

export default config;
