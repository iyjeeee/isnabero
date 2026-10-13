/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_DATA_SOURCE?: "mock" | "supabase";
  readonly VITE_MOCK_ROLE?: "owner" | "admin" | "staff";
  readonly VITE_OFFLINE_CACHE?: "true" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
