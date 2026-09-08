// supabase/functions/invite-employee/index.ts
// Deploy with: supabase functions deploy invite-employee
// Requires these secrets set on the project (NOT the anon key — this needs admin privileges):
//   supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
// Called from the client via supabase.functions.invoke("invite-employee", { body: {...} }) —
// see apps/web/src/components/employees/AddEmployeeModal.tsx for the calling code.
//
// Why this exists: creating an employee record with a real login requires creating an actual
// auth.users row, which requires the service role key — something that must never be exposed to the
// browser. This function runs server-side with that privilege; the client never sees the key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

interface InviteEmployeeRequest {
  businessId: string;
  email: string;
  fullName: string;
  role: "owner" | "admin" | "staff";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { businessId, email, fullName, role } = (await req.json()) as InviteEmployeeRequest;

    if (!businessId || !email || !fullName || !role) {
      return new Response(JSON.stringify({ error: "businessId, email, fullName, and role are all required" }), { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // TODO once auth is fully wired up: verify the caller is themselves an owner/admin of `businessId`
    // before proceeding — this function currently trusts the request body, which is fine for local
    // development but must NOT ship to production as-is. Check the caller's JWT (req.headers
    // "Authorization") against employees for businessId with role in (owner, admin) first.

    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), { status: 400 });
    }

    const { data: employee, error: insertError } = await supabaseAdmin
      .from("employees")
      .insert({ business_id: businessId, user_id: invited.user.id, full_name: fullName, role })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ employee }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500 });
  }
});
