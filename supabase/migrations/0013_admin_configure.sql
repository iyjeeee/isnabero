-- 0013_admin_configure.sql
-- Run this AFTER 0000-0012. Admins now have the same permissions as owners (permissions.ts: business.configure includes admin),
-- so the two policies that were owner-only in 0004 must allow admins too: renaming the business / receipt details / finishing
-- setup (businesses) and turning modules on or off (business_modules). Everything else was already owner + admin.

drop policy if exists "owners update own business" on businesses;
create policy "owner admin update own business" on businesses
  for update using (employee_has_role(id, array['owner','admin']::employee_role[]))
  with check (employee_has_role(id, array['owner','admin']::employee_role[]));

drop policy if exists "owners modify business modules" on business_modules;
create policy "owner admin modify business modules" on business_modules
  for all using (employee_has_role(business_id, array['owner','admin']::employee_role[]))
  with check (employee_has_role(business_id, array['owner','admin']::employee_role[]));
