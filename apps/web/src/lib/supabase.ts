import { createClient } from "@supabase/supabase-js";
import { getDataSource } from "@isnabero/db";

// Reads from .env.local — see .env.example. Never hardcode keys here.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (getDataSource() === "supabase" && (!supabaseUrl || !supabaseAnonKey)) {
  // Only warn when supabase is actually the active data source — in mock mode (the default while
  // the frontend is being built out) these vars are expected to be unset.
  console.warn(
    "VITE_DATA_SOURCE=supabase but VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are missing — copy .env.example to .env.local and fill in your local Supabase CLI values.",
  );
}

// createClient validates its URL eagerly and throws if given an empty string, so a placeholder is used
// when running in mock mode without real credentials — this client is simply never called in that mode.
export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder-anon-key");
