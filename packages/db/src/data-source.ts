// getDataSource: single source of truth for whether hooks read from the in-memory mock store or real
// Supabase. Defaults to "mock" so the frontend can be built/polished without a running Supabase instance.
// Flip via VITE_DATA_SOURCE=supabase in apps/web/.env.local once the backend is ready to wire up.
export type DataSource = "mock" | "supabase";

export function getDataSource(): DataSource {
  try {
    // import.meta.env is statically replaced by Vite at build time in apps/web (and any package it
    // bundles). Guarded in a try/catch since packages/db can also run in plain Node (drizzle-kit, edge
    // functions) where import.meta.env doesn't exist.
    const env = (import.meta as unknown as { env?: Record<string, string> })?.env;
    if (env?.VITE_DATA_SOURCE === "supabase") return "supabase";
    if (env?.VITE_DATA_SOURCE === "mock") return "mock";
  } catch {
    // import.meta not available in this runtime — fall through to the default below
  }
  return "mock";
}
