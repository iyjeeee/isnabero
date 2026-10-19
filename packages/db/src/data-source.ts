// getDataSource: single source of truth for whether hooks read from the in-memory mock store or real
// Supabase. Defaults to "mock" so the frontend can be built/polished without a running Supabase instance.
// Flip via VITE_DATA_SOURCE=supabase in apps/web/.env.local once the backend is ready to wire up.
export type DataSource = "mock" | "supabase";

export function getDataSource(): DataSource {
  try {
    // Must be the literal `import.meta.env.VITE_DATA_SOURCE` — Vite only replaces that exact form (an optional-chained or cast
    // `import.meta?.env` is left alone, so it reads undefined in the browser and silently falls back to mock). Plain Node has no
    // import.meta.env, so the try/catch below covers drizzle-kit and edge functions.
    const source = (import.meta as unknown as { env: { VITE_DATA_SOURCE?: string } }).env.VITE_DATA_SOURCE;
    if (source === "supabase") return "supabase";
    if (source === "mock") return "mock";
  } catch {
    // import.meta not available in this runtime — fall through to the default below
  }
  return "mock";
}
