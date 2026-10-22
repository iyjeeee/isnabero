import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV_FILES_FOUND } from "./load-env";
import { createSupabaseCoreRepository } from "../src/lib/repositories/supabase-repository";
import { createSupabaseCatalogRepository } from "../../../packages/modules/catalog/src/supabase-repository";
import { createSupabasePosRepository } from "../../../packages/modules/pos/src/supabase-repository";
import { createSupabaseInventoryRepository } from "../../../packages/modules/inventory/src/supabase-repository";
import { createSupabaseExpensesRepository } from "../../../packages/modules/expenses/src/supabase-repository";
import { createSupabaseBookingRepository } from "../../../packages/modules/booking/src/supabase-repository";
import { createSupabaseSchedulingRepository } from "../../../packages/modules/scheduling/src/supabase-repository";

// Where the tests run and who they act as. Everything comes from environment variables (or apps/web/.env.local / .env.integration):
//   INT_SUPABASE_URL / INT_SUPABASE_ANON_KEY   default to VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
//   INT_EMAIL, INT_PASSWORD                    the owner login (E2E_EMAIL / E2E_PASSWORD also work)
//   INT_STAFF_EMAIL, INT_STAFF_PASSWORD        optional: a login that is STAFF in the test business (enables the permission tests)
//   INT_OUTSIDER_EMAIL, INT_OUTSIDER_PASSWORD  optional: a login that is NOT in the test business (enables the tenant-isolation tests)
//   INT_BUSINESS_NAME                          defaults to "E2E Test Business" (create it with supabase/e2e-test-business.sql)
// Local Supabase CLI / self-hosted alternative to passwords: INT_JWT_SECRET plus INT_OWNER_ID / INT_STAFF_ID / INT_OUTSIDER_ID (auth user ids).
const env = (name: string, ...fallbacks: string[]) => [name, ...fallbacks].map((key) => process.env[key]).find((value) => value);

export interface Actor {
  client: SupabaseClient;
  userId: string;
}

const base64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");
const mintJwt = (secret: string, claims: Record<string, unknown>) => {
  const head = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, ...claims }));
  return `${head}.${body}.${base64url(crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest())}`;
};

// retryingFetch: retries a dropped connection (TypeError "fetch failed") up to 3 times so a network blip can't fail a suite; HTTP errors are never retried
const retryingFetch: typeof fetch = async (input, init) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (attempt >= 3 || !(error instanceof TypeError)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt)); // short backoff
    }
  }
};

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: retryingFetch } };

async function signIn(url: string, anonKey: string, email: string, password: string): Promise<Actor> {
  const client = createClient(url, anonKey, options);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Could not sign in as ${email}: ${error?.message ?? "no user"}`);
  return { client, userId: data.user.id };
}

function minted(url: string, anonKey: string, secret: string, userId: string): Actor {
  const token = mintJwt(secret, { role: "authenticated", sub: userId });
  return { client: createClient(url, anonKey, { ...options, global: { ...options.global, headers: { Authorization: `Bearer ${token}` } } }), userId };
}

export interface TestContext {
  url: string;
  anon: SupabaseClient; // no login at all
  owner: Actor;
  staff?: Actor;
  outsider?: Actor;
  businessId: string;
  ownerEmployeeId: string;
}

let cached: Promise<TestContext> | undefined;

// getContext: connects once per test file. Fails with a clear message when something is missing, never silently skips the whole suite.
export function getContext(): Promise<TestContext> {
  cached ??= (async () => {
    const url = env("INT_SUPABASE_URL", "VITE_SUPABASE_URL");
    const secret = env("INT_JWT_SECRET");
    if (!url) throw new Error("Set INT_SUPABASE_URL (or VITE_SUPABASE_URL in apps/web/.env.local). See apps/web/integration/README.md.");
    const anonKey = env("INT_SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY") ?? (secret ? mintJwt(secret, { role: "anon" }) : undefined);
    if (!anonKey) throw new Error("Set INT_SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY).");

    const actor = async (role: "OWNER" | "STAFF" | "OUTSIDER"): Promise<Actor | undefined> => {
      const id = env(`INT_${role}_ID`);
      if (secret && id) return minted(url, anonKey, secret, id);
      const email = env(`INT_${role}_EMAIL`, ...(role === "OWNER" ? ["INT_EMAIL", "E2E_EMAIL"] : []));
      const password = env(`INT_${role}_PASSWORD`, ...(role === "OWNER" ? ["INT_PASSWORD", "E2E_PASSWORD"] : []));
      return email && password ? signIn(url, anonKey, email, password) : undefined;
    };
    const owner = await actor("OWNER");
    if (!owner) {
      const seen = ["INT_EMAIL", "INT_PASSWORD"].map((key) => `${key}=${env(key) ? "set" : "MISSING/empty"}`).join(", ");
      throw new Error(`Owner login not found (${seen}). Env files read from apps/web: ${ENV_FILES_FOUND.join(", ") || "none"}. Create apps/web/.env.integration (exact name, no .txt) with INT_EMAIL and INT_PASSWORD. See apps/web/integration/README.md.`);
    }

    const name = env("INT_BUSINESS_NAME") ?? "E2E Test Business";
    const { data: businesses, error } = await owner.client.from("businesses").select("id, name").eq("name", name);
    if (error) throw new Error(`Could not read businesses: ${error.message || JSON.stringify(error)}`);
    if (!businesses?.length) throw new Error(`No business named "${name}" is visible to the owner login. Run supabase/e2e-test-business.sql first (it keeps the tests away from your real data).`);
    const businessId = businesses[0]!.id as string;
    const { data: employee, error: employeeError } = await owner.client.from("employees").select("id").eq("business_id", businessId).eq("user_id", owner.userId).single();
    if (employeeError) throw new Error(`The owner login has no employee row in "${name}": ${employeeError.message}`);

    return {
      url,
      anon: createClient(url, anonKey, options),
      owner,
      staff: await actor("STAFF"),
      outsider: await actor("OUTSIDER"),
      businessId,
      ownerEmployeeId: employee.id as string,
    };
  })();
  return cached;
}

// repos: the app's own Supabase repositories bound to one login, so the tests exercise the exact code the app runs
export function repos(client: SupabaseClient) {
  return {
    core: createSupabaseCoreRepository(client),
    catalog: createSupabaseCatalogRepository(client),
    pos: createSupabasePosRepository(client),
    inventory: createSupabaseInventoryRepository(client),
    expenses: createSupabaseExpensesRepository(client),
    booking: createSupabaseBookingRepository(client),
    scheduling: createSupabaseSchedulingRepository(client),
  };
}

// tag: every record the tests create carries this prefix, so leftovers are easy to spot in the dashboard
export const tag = (label: string) => `[E2E] ${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
