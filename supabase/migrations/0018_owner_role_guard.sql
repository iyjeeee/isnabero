-- 0018_owner_role_guard.sql
-- Only an owner may grant, change or remove the owner role. Before this, owner/admin RLS let an admin promote themselves
-- (or demote/remove the owner). Admins still manage admin and staff rows. The "keep one owner" rule now lives in the
-- database too (it was app-level only). Service role / SQL editor / migrations (auth.uid() is null) are not restricted,
-- so the invite-employee function checks the caller itself (see supabase/functions/invite-employee/index.ts).

create or replace function employees_owner_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  business uuid := coalesce(new.business_id, old.business_id);
  caller_is_owner boolean;
begin
  if auth.uid() is null then
    return coalesce(new, old); -- not a signed-in app user
  end if;
  caller_is_owner := employee_has_role(business, array['owner']::employee_role[]);

  if tg_op = 'INSERT' then
    if new.role = 'owner' and not caller_is_owner then
      raise exception 'Only an owner can add another owner.' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (old.role = 'owner' or new.role = 'owner')
       and (old.role is distinct from new.role or old.user_id is distinct from new.user_id or old.business_id is distinct from new.business_id)
       and not caller_is_owner then
      raise exception 'Only an owner can change who is an owner.' using errcode = '42501';
    end if;
  elsif tg_op = 'DELETE' then
    if old.role = 'owner' and not caller_is_owner then
      raise exception 'Only an owner can remove an owner.' using errcode = '42501';
    end if;
  end if;

  -- a business always keeps at least one owner (pg_trigger_depth() > 1 = removed by a cascade, e.g. the whole business)
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') and pg_trigger_depth() = 1
     and not exists (select 1 from employees where business_id = old.business_id and role = 'owner' and id <> old.id) then
    raise exception 'A business needs at least one owner.' using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists employees_owner_guard on employees;
create trigger employees_owner_guard
  before insert or update or delete on employees
  for each row execute function employees_owner_guard();

revoke all on function employees_owner_guard() from public, anon, authenticated;
