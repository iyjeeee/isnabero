import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration tests: the app's real Supabase repositories against a real Supabase/PostgREST API (see integration/README.md).
// Run with `pnpm --filter @isnabero/web test:integration`. Kept out of `pnpm test`, which needs no network or credentials.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "node",
    include: ["integration/**/*.int.ts"],
    fileParallelism: false, // every file shares one test business (stock, cash drawer), so files run one after another
    testTimeout: 30_000,
    hookTimeout: 60_000,
    setupFiles: ["integration/load-env.ts"],
  },
});
