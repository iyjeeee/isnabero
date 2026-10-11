-- 0008_scheduling.sql
-- Staff scheduling: the `scheduling` module key and the `shifts` table. Run AFTER 0007. The 0000 baseline generated from
-- the Drizzle schema already has the table and enum value, so everything here is safe to run on top of it (and re-run).
-- NOT applied yet: Supabase is wired up last.

alter type module_key add value if not exists 'scheduling';

create extension if not exists btree_gist;

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists shifts_business_date_idx on shifts (business_id, shift_date);

-- Same-day shifts of 15 minutes to 16 hours, and never two overlapping shifts for one employee (touching is fine).
-- The app checks both first for friendly messages; these make the database the final word, even when two people save at once.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shifts_length_check') then
    alter table shifts add constraint shifts_length_check check (end_time - start_time between interval '15 minutes' and interval '16 hours');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shifts_no_overlap') then
    alter table shifts add constraint shifts_no_overlap
      exclude using gist (employee_id with =, tsrange(shift_date + start_time, shift_date + end_time) with &&);
  end if;
end $$;

-- RLS: everyone in the business can read the schedule; only owner/admin change it (mirrors `schedule.manage` in
-- apps/web/src/lib/permissions.ts). The employee must belong to the same business as the shift.
alter table shifts enable row level security;
drop policy if exists "select own business shifts" on shifts;
create policy "select own business shifts" on shifts
  for select using (business_id in (select employee_business_ids()));
drop policy if exists "owner admin insert shifts" on shifts;
create policy "owner admin insert shifts" on shifts
  for insert with check (
    employee_has_role(business_id, array['owner','admin']::employee_role[])
    and exists (select 1 from employees e where e.id = employee_id and e.business_id = shifts.business_id)
  );
drop policy if exists "owner admin update shifts" on shifts;
create policy "owner admin update shifts" on shifts
  for update using (employee_has_role(business_id, array['owner','admin']::employee_role[]))
  with check (
    employee_has_role(business_id, array['owner','admin']::employee_role[])
    and exists (select 1 from employees e where e.id = employee_id and e.business_id = shifts.business_id)
  );
drop policy if exists "owner admin delete shifts" on shifts;
create policy "owner admin delete shifts" on shifts
  for delete using (employee_has_role(business_id, array['owner','admin']::employee_role[]));

-- The employee of an existing shift can't be swapped (the app removes and re-adds instead), and a shift can't move to another business
create or replace function shifts_freeze_owner() returns trigger language plpgsql as $$
begin
  if new.business_id is distinct from old.business_id or new.employee_id is distinct from old.employee_id then
    raise exception 'A shift''s employee cannot be changed. Remove the shift and add a new one.';
  end if;
  return new;
end $$;
drop trigger if exists shifts_freeze_owner on shifts;
create trigger shifts_freeze_owner before update on shifts for each row execute function shifts_freeze_owner();

-- Audit (wording mirrors the mock repository). A note-only edit isn't logged. When an employee is removed their shifts
-- cascade away silently (their removal is already logged).
create or replace function audit_trg_shift() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_employee uuid;
begin
  v_employee := case when tg_op = 'DELETE' then old.employee_id else new.employee_id end;
  select full_name into v_name from employees where id = v_employee;
  if tg_op = 'INSERT' then
    perform audit_write(new.business_id, 'shift.created', 'shift', new.id,
      'Scheduled ' || coalesce(v_name, 'an employee') || ' on ' || new.shift_date || ' ' || to_char(new.start_time, 'HH24:MI') || '–' || to_char(new.end_time, 'HH24:MI'));
  elsif tg_op = 'UPDATE' then
    if (old.shift_date, old.start_time, old.end_time) is distinct from (new.shift_date, new.start_time, new.end_time) then
      perform audit_write(new.business_id, 'shift.updated', 'shift', new.id,
        'Changed shift for ' || coalesce(v_name, 'an employee') || ': '
        || old.shift_date || ' ' || to_char(old.start_time, 'HH24:MI') || '–' || to_char(old.end_time, 'HH24:MI')
        || ' → ' || new.shift_date || ' ' || to_char(new.start_time, 'HH24:MI') || '–' || to_char(new.end_time, 'HH24:MI'));
    end if;
  elsif v_name is not null then
    perform audit_write(old.business_id, 'shift.deleted', 'shift', old.id,
      'Removed ' || v_name || '''s shift on ' || old.shift_date || ' ' || to_char(old.start_time, 'HH24:MI') || '–' || to_char(old.end_time, 'HH24:MI'));
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists audit_shift on shifts;
create trigger audit_shift after insert or update or delete on shifts for each row execute function audit_trg_shift();
