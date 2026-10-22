-- supabase/e2e-test-business.sql
-- Run ONCE in the Supabase SQL editor (after the migrations) to create a separate "E2E Test Business" for the automated tests.
-- The tests only ever write inside this business, so your real business data is never touched.
-- 1) Replace you@example.com below with the email of your test owner login (your own login is fine; it will own both businesses).
-- 2) Run it. It is safe to run again (nothing is duplicated).
-- Optional: to also test staff permissions on your project, create a second user in Authentication > Users, set the staff email below, and re-run.

do $$
declare
  owner_email text := 'you@example.com';          -- <- change this
  staff_email text := null;                        -- <- optional: a second login that should act as STAFF in the test business
  biz uuid := '00000000-0000-0000-0000-00000000e2e1';
  owner_id uuid;
  staff_id uuid;
begin
  select id into owner_id from auth.users where email = owner_email;
  if owner_id is null then raise exception 'No user with email % — create it first (Authentication > Users).', owner_email; end if;

  insert into businesses (id, name, slug, setup_completed_at) values (biz, 'E2E Test Business', 'e2e-test-business', now()) on conflict do nothing;
  insert into business_modules (business_id, module_key, enabled)
    select biz, m, true from unnest(array['catalog','pos','booking','expenses','inventory','scheduling']::module_key[]) as m
    on conflict do nothing;
  insert into employees (business_id, user_id, full_name, role)
    select biz, owner_id, 'E2E Owner', 'owner' where not exists (select 1 from employees where business_id = biz and user_id = owner_id);

  if staff_email is not null then
    select id into staff_id from auth.users where email = staff_email;
    if staff_id is null then raise exception 'No user with email % — create it first.', staff_email; end if;
    insert into employees (business_id, user_id, full_name, role)
      select biz, staff_id, 'E2E Staff', 'staff' where not exists (select 1 from employees where business_id = biz and user_id = staff_id);
  end if;
end $$;

-- Check: should list the E2E Test Business with your owner row
select b.name, e.full_name, e.role, u.email
from businesses b join employees e on e.business_id = b.id left join auth.users u on u.id = e.user_id
where b.slug = 'e2e-test-business';
