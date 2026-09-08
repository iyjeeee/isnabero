-- 0001_rls_policies.sql
-- Run this AFTER the initial drizzle-generated migration (0000_*.sql) has created the tables.
-- This is the core multi-tenancy enforcement: every business only ever sees its own rows.

-- employee_business_ids(): helper returning the business_id(s) the currently authenticated user belongs to
create or replace function employee_business_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select business_id from employees where user_id = auth.uid();
$$;

-- Enable RLS on every tenant-scoped table
alter table businesses enable row level security;
alter table business_modules enable row level security;
alter table employees enable row level security;
alter table payment_records enable row level security;
alter table offerings enable row level security;
alter table offering_inclusions enable row level security;
alter table pos_orders enable row level security;
alter table pos_order_items enable row level security;
alter table bookings enable row level security;

-- businesses: a user can only see businesses they belong to
create policy "select own business" on businesses
  for select using (id in (select employee_business_ids()));

-- business_modules: scoped to the employee's business
create policy "select own business modules" on business_modules
  for select using (business_id in (select employee_business_ids()));
create policy "modify own business modules" on business_modules
  for all using (business_id in (select employee_business_ids()))
  with check (business_id in (select employee_business_ids()));

-- employees: scoped to the same business (staff can see co-workers, not other tenants)
create policy "select own business employees" on employees
  for select using (business_id in (select employee_business_ids()));

-- payment_records
create policy "select own business payment records" on payment_records
  for select using (business_id in (select employee_business_ids()));
create policy "insert own business payment records" on payment_records
  for insert with check (business_id in (select employee_business_ids()));

-- offerings + inclusions
create policy "select own business offerings" on offerings
  for select using (business_id in (select employee_business_ids()));
create policy "modify own business offerings" on offerings
  for all using (business_id in (select employee_business_ids()))
  with check (business_id in (select employee_business_ids()));
create policy "select own business offering inclusions" on offering_inclusions
  for select using (offering_id in (select id from offerings where business_id in (select employee_business_ids())));

-- pos_orders + items
create policy "select own business pos orders" on pos_orders
  for select using (business_id in (select employee_business_ids()));
create policy "modify own business pos orders" on pos_orders
  for all using (business_id in (select employee_business_ids()))
  with check (business_id in (select employee_business_ids()));
create policy "select own business pos order items" on pos_order_items
  for select using (order_id in (select id from pos_orders where business_id in (select employee_business_ids())));

-- bookings
create policy "select own business bookings" on bookings
  for select using (business_id in (select employee_business_ids()));
create policy "modify own business bookings" on bookings
  for all using (business_id in (select employee_business_ids()))
  with check (business_id in (select employee_business_ids()));
