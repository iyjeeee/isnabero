-- supabase/link-owner.sql
-- Run in the Supabase SQL editor AFTER the migrations and seed, and AFTER you created your own user
-- (Authentication > Users > Add user, or sign up). It links that login to the seeded owner employee ("Juan Dela Cruz")
-- so you land in the Sample Business as its owner.
-- 1) Replace the email below with yours. 2) Run it. It changes one row and nothing else.

update employees
set user_id = (select id from auth.users where email = 'iyjeeee.recto@gmail.com')
where id = '00000000-0000-0000-0000-00000000010e'
  and exists (select 1 from auth.users where email = 'iyjeeee.recto@gmail.com'); -- no-op (0 rows) if the email isn't found

-- Check: should return one row showing your auth user id and role "owner"
select e.full_name, e.role, e.user_id, u.email
from employees e join auth.users u on u.id = e.user_id
where e.id = '00000000-0000-0000-0000-00000000010e';
