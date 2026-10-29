// supabase/functions/invite-employee/index.ts
// Deploy with: supabase functions deploy invite-employee
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to Edge Functions automatically on hosted projects.
// Optional secret: SITE_URL (e.g. https://app.example.com) — where the invite email sends the person to set a password.
// If it isn't set, the browser's own address (Origin header) is used.
// Called from the client via supabase.functions.invoke("invite-employee", { body: {...} }) —
// see apps/web/src/components/employees/AddEmployeeModal.tsx for the calling code.
//
// Why this exists: creating an employee with a real login requires creating an actual auth.users row, which needs the
// service role key — something that must never reach the browser. This function runs server-side with that privilege.
//
// The redirect address must be allowed in Supabase: Authentication > URL Configuration > Redirect URLs
// (add <your site>/set-password), otherwise the invite link falls back to the Site URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void };

interface InviteEmployeeRequest {
  businessId: string;
  email: string;
  fullName: string;
  role: "owner" | "admin" | "staff";
}

// CORS: the browser sends a preflight (OPTIONS) before invoking a function, so every reply — errors included — must carry these.
// Allow-Headers echoes what the preflight asks for: newer supabase-js versions send extra headers (e.g. x-retry-count) and a
// fixed list would make the browser block the call with "Failed to send a request to the Edge Function".
const DEFAULT_ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type, x-retry-count";
let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ROLES = ["owner", "admin", "staff"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
  corsHeaders = { ...corsHeaders, "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") || DEFAULT_ALLOWED_HEADERS };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  try {
    const body = (await req.json()) as Partial<InviteEmployeeRequest>;
    const businessId = body.businessId;
    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim();
    const role = body.role;

    if (!businessId || !email || !fullName || !role) return reply(400, { error: "businessId, email, fullName, and role are all required" });
    if (!EMAIL.test(email)) return reply(400, { error: "That email address doesn't look right." });
    if (!ROLES.includes(role)) return reply(400, { error: "Role must be owner, admin or staff." });

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify the caller: a signed-in owner/admin of this business
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return reply(401, { error: "Not signed in" });
    const { data: caller, error: callerError } = await supabaseAdmin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (callerError || !caller.user) return reply(401, { error: "Not signed in" });
    const { data: callerRow } = await supabaseAdmin
      .from("employees")
      .select("id, role")
      .eq("business_id", businessId)
      .eq("user_id", caller.user.id)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (!callerRow) return reply(403, { error: "Only an owner or admin can invite employees" });
    // the service role below skips the database's owner guard (migration 0018), so the same rule is checked here
    if (role === "owner" && callerRow.role !== "owner") return reply(403, { error: "Only an owner can invite another owner." });

    const siteUrl = (Deno.env.get("SITE_URL") || req.headers.get("origin") || "").replace(/\/$/, "");
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, siteUrl ? { redirectTo: `${siteUrl}/set-password` } : undefined);
    if (inviteError) {
      const alreadyUsed = /already|registered|exists/i.test(inviteError.message);
      return reply(alreadyUsed ? 409 : 400, { error: alreadyUsed ? "Someone with that email already has an account. Ask them to sign in, or use a different email." : inviteError.message });
    }

    const { data: employee, error: insertError } = await supabaseAdmin
      .from("employees")
      .insert({ business_id: businessId, user_id: invited.user.id, full_name: fullName, role })
      .select()
      .single();

    if (insertError) {
      // The login was just created for this invite and has no employee row: remove it so the email can be invited again
      await supabaseAdmin.auth.admin.deleteUser(invited.user.id);
      return reply(400, { error: insertError.message });
    }

    return reply(200, { employee });
  } catch (error) {
    return reply(500, { error: error instanceof Error ? error.message : "Unknown error" });
  }
});
