import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
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
