import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "*.config.*"] }, // build output + tool configs
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // the service worker runs in a worker scope, not the page
    files: ["public/sw.js"],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    // PostgREST rows are untyped until Supabase types are generated — `any` is tolerated only in these mappers
    files: ["src/lib/repositories/supabase-*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
