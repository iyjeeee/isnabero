import { defineConfig } from "drizzle-kit";

// reads DATABASE_URL from the environment — for local dev this points at the Supabase CLI's local Postgres
// (default: postgresql://postgres:postgres@127.0.0.1:54322/postgres)
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "../../supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  },
});
