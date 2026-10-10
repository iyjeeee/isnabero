-- 0004_roles_and_expenses.sql
-- Run this AFTER 0000 (initial schema, which already includes the expenses table, expense_category enum and
-- businesses.setup_completed_at), 0001 (RLS), 0002 and 0003. NOT applied yet: Supabase is wired up last.
-- Mirrors apps/web/src/lib/permissions.ts at the database level:
--   business.configure -> owner      expenses.view / expenses.manage -> owner, admin
--   payments.void / employees.manage -> owner, admin

-- Safety net for databases created from an older 0000 that predates the setup wizard
alter table businesses add column if not exists setup_completed_at timestamptz;

-- employee_has_role(): true when the signed-in user holds one of the roles in the given business.
-- security definer + fixed search_path so the lookup can't be redirected and doesn't recurse into employees' RLS.
create or replace function employee_has_role(business uuid, roles employee_role[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from employees
    where business_id = business and user_id = auth.uid() and role = any (roles)
  );
$$;

-- businesses: only owners can rename the business or finish setup
create policy "owners update own business" on businesses
  for update using (employee_has_role(id, array['owner']::employee_role[]))
  with check (employee_has_role(id, array['owner']::employee_role[]));

-- business_modules: everyone in the business can read; only owners can turn modules on or off
drop policy if exists "modify own business modules" on business_modules;
create policy "owners modify business modules" on business_modules
  for all using (employee_has_role(business_id, array['owner']::employee_role[]))
  with check (employee_has_role(business_id, array['owner']::employee_role[]));

-- expenses: owner/admin only — staff can't even read them. No delete policy: expenses are voided, never deleted.
alter table expenses enable row level security;
create policy "owner admin select expenses" on expenses
  for select using (employee_has_role(business_id, array['owner','admin']::employee_role[]));
create policy "owner admin insert expenses" on expenses
  for insert with check (employee_has_role(business_id, array['owner','admin']::employee_role[]));
create policy "owner admin update expenses" on expenses
  for update using (employee_has_role(business_id, array['owner','admin']::employee_role[]))
  with check (employee_has_role(business_id, array['owner','admin']::employee_role[]));

-- Voiding is the only allowed change: every other column is frozen once the row exists
create or replace function expenses_only_void()
returns trigger
language plpgsql
as $$
begin
  if (new.id, new.business_id, new.category, new.description, new.amount, new.expense_date, new.method, new.notes, new.recorded_by, new.created_at)
     is distinct from
     (old.id, old.business_id, old.category, old.description, old.amount, old.expense_date, old.method, old.notes, old.recorded_by, old.created_at) then
    raise exception 'expenses can only be voided, not edited';
  end if;
  return new;
end;
$$;
create trigger expenses_only_void before update on expenses
  for each row execute function expenses_only_void();

-- payment_records: 0001 only allowed select + insert, so voiding (an UPDATE of voided_at) was blocked for everyone.
-- Owner/admin may update, and a trigger freezes every column except voided_at (a payment is a snapshot of a sale).
create policy "owner admin void payment records" on payment_records
  for update using (employee_has_role(business_id, array['owner','admin']::employee_role[]))
  with check (employee_has_role(business_id, array['owner','admin']::employee_role[]));

create or replace function payment_records_only_void()
returns trigger
language plpgsql
as $$
begin
  if (new.id, new.business_id, new.source_module, new.method, new.reference_code, new.amount, new.created_at)
     is distinct from
     (old.id, old.business_id, old.source_module, old.method, old.reference_code, old.amount, old.created_at) then
    raise exception 'payment records can only be voided, not edited';
  end if;
  return new;
end;
$$;
create trigger payment_records_only_void before update on payment_records
  for each row execute function payment_records_only_void();

-- employees: 0001 only allowed select, so the app's update/delete calls were blocked. Owner/admin manage staff in their
-- own business (inviting still goes through the invite-employee edge function). The last-owner rule stays app-level.
create policy "owner admin insert employees" on employees
  for insert with check (employee_has_role(business_id, array['owner','admin']::employee_role[]));
create policy "owner admin update employees" on employees
  for update using (employee_has_role(business_id, array['owner','admin']::employee_role[]))
  with check (employee_has_role(business_id, array['owner','admin']::employee_role[]));
create policy "owner admin delete employees" on employees
  for delete using (employee_has_role(business_id, array['owner','admin']::employee_role[]));
