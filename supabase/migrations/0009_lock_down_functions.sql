-- 0009_lock_down_functions.sql
-- Run this AFTER 0000-0008. Found while testing against a real Postgres: Supabase grants EXECUTE on every new public function to
-- anon and authenticated by default, and PostgREST exposes public functions as /rest/v1/rpc/<name>. audit_write is security
-- definer, so any visitor could call it directly and forge audit rows for any business. Only the audit triggers (which run as
-- the function owner) need it, so nobody else gets execute.

revoke all on function audit_write(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function audit_peso(numeric) from public, anon, authenticated;

-- checkout_sale already rejects non-members, but anon has no reason to reach it at all
revoke all on function checkout_sale(uuid, payment_method, text, jsonb) from public, anon;
grant execute on function checkout_sale(uuid, payment_method, text, jsonb) to authenticated;
