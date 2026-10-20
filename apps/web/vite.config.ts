import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

// stampServiceWorker: writes a build id into dist/sw.js so each release is a different file and installed apps see the update
const stampServiceWorker = () => ({
  name: "stamp-service-worker",
  apply: "build" as const,
  closeBundle() {
    const file = path.resolve(__dirname, "dist/sw.js");
    try {
      writeFileSync(file, readFileSync(file, "utf8").replace("__BUILD_ID__", Date.now().toString(36)));
    } catch {
      // no dist/sw.js (e.g. a build that skips public files): nothing to stamp
    }
  },
});

export default defineConfig({
  plugins: [react(), stampServiceWorker()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Splits large, React-INDEPENDENT vendor libraries into their own cacheable chunks. Deliberately
        // does NOT split React itself or anything that depends on it (react-router, react-query, radix,
        // react-hook-form) into a separate chunk from React — doing that previously caused a circular
        // chunk (vendor-radix <-> vendor-react) that broke module load order in the browser
        // ("Cannot read properties of undefined (reading 'forwardRef')"). Route-based code splitting
        // (see the lazy() imports in App.tsx) already provides most of the real-world benefit here.
        manualChunks(id) {
          if (id.includes("node_modules") && id.includes("@supabase")) return "vendor-supabase";
        },
      },
    },
  },
});
