-- 0015_cash_close.sql — end-of-shift cash count. Run AFTER 0000-0014.
-- A close compares the cash the app expects in the drawer (starting cash + cash sales - cash expenses since the last close)
-- with what was actually counted. The totals are worked out by the database, so a client cannot invent the expected amount.
-- Each close starts where the previous one ended; the first one starts at the time the app passes in (start of today).

create table if not exists cash_closes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  opening_float numeric(12,2) not null check (opening_float >= 0),
  cash_sales numeric(12,2) not null,
  cash_expenses numeric(12,2) not null,
  expected numeric(12,2) not null,
  counted numeric(12,2) not null check (counted >= 0),
  difference numeric(12,2) not null, -- counted - expected: negative = short, positive = over
  note text,
  closed_by uuid references employees(id) on delete set null,
  closed_by_name text not null default 'System', -- snapshot, so history still reads right after a rename or removal
  created_at timestamptz not null default now()
);
create index if not exists cash_closes_business_end on cash_closes (business_id, period_end desc);

alter table cash_closes enable row level security;
-- read-only for the app: rows are only written by close_cash()
create policy "members read cash closes" on cash_closes for select using (business_id in (select employee_business_ids()));

-- cash_totals(): cash taken in and paid out between two moments (voided records are left out)
create or replace function cash_totals(p_business uuid, p_start timestamptz, p_end timestamptz)
returns table (cash_sales numeric, cash_expenses numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(amount) from payment_records where business_id = p_business and method = 'cash' and voided_at is null and created_at >= p_start and created_at < p_end), 0),
    coalesce((select sum(amount) from expenses where business_id = p_business and method = 'cash' and voided_at is null and created_at >= p_start and created_at < p_end), 0)
$$;

-- cash_close_summary(): what the close screen shows before counting
create or replace function cash_close_summary(p_business uuid, p_day_start timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_last record;
  v_start timestamptz;
  v_end timestamptz := now();
  v_totals record;
begin
  if not exists (select 1 from employees where business_id = p_business and user_id = auth.uid()) then
    raise exception 'You are not allowed to close cash for this business.' using errcode = '42501';
  end if;
  select period_end, counted into v_last from cash_closes where business_id = p_business order by period_end desc limit 1;
  v_start := coalesce(v_last.period_end, least(p_day_start, v_end)); -- never in the future
  select * into v_totals from cash_totals(p_business, v_start, v_end);
  return jsonb_build_object('period_start', v_start, 'period_end', v_end, 'cash_sales', v_totals.cash_sales, 'cash_expenses', v_totals.cash_expenses,
    'last_counted', v_last.counted);
end;
$$;

-- close_cash(): records the close. The period, sales and expenses come from the database, not the app.
create or replace function close_cash(p_business uuid, p_day_start timestamptz, p_opening_float numeric, p_counted numeric, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee record;
  v_last_end timestamptz;
  v_start timestamptz;
  v_end timestamptz := now();
  v_totals record;
  v_expected numeric;
  v_id uuid;
begin
  select id, full_name into v_employee from employees where business_id = p_business and user_id = auth.uid() limit 1;
  if v_employee.id is null then
    raise exception 'You are not allowed to close cash for this business.' using errcode = '42501';
  end if;
  if p_opening_float is null or p_opening_float < 0 or p_counted is null or p_counted < 0 then
    raise exception 'Starting cash and counted cash must be zero or more.';
  end if;
  -- one close at a time per business, so two cashiers closing together cannot count the same period twice
  perform pg_advisory_xact_lock(hashtext('cash_close:' || p_business::text));
  select max(period_end) into v_last_end from cash_closes where business_id = p_business;
  v_start := coalesce(v_last_end, least(p_day_start, v_end));
  select * into v_totals from cash_totals(p_business, v_start, v_end);
  v_expected := round(p_opening_float + v_totals.cash_sales - v_totals.cash_expenses, 2);
  insert into cash_closes (business_id, period_start, period_end, opening_float, cash_sales, cash_expenses, expected, counted, difference, note, closed_by, closed_by_name)
    values (p_business, v_start, v_end, round(p_opening_float, 2), v_totals.cash_sales, v_totals.cash_expenses, v_expected, round(p_counted, 2),
            round(p_counted, 2) - v_expected, nullif(trim(p_note), ''), v_employee.id, v_employee.full_name)
    returning id into v_id;
  return jsonb_build_object('id', v_id, 'expected', v_expected, 'difference', round(p_counted, 2) - v_expected);
end;
$$;

-- audit: one line per close (same wording as the mock repository)
create or replace function audit_trg_cash_close() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform audit_write(new.business_id, 'cash.closed', 'cash_close', new.id,
    'Cash closed: counted ' || audit_peso(new.counted) || ' vs expected ' || audit_peso(new.expected) ||
    case when new.difference = 0 then ' (balanced)' when new.difference < 0 then ' (short ' || audit_peso(-new.difference) || ')' else ' (over ' || audit_peso(new.difference) || ')' end);
  return new;
end $$;
create trigger audit_cash_close after insert on cash_closes for each row execute function audit_trg_cash_close();
revoke all on function audit_trg_cash_close() from public, anon, authenticated;

-- only signed-in members may call these (they also check membership themselves)
revoke all on function cash_totals(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function cash_close_summary(uuid, timestamptz) from public, anon;
grant execute on function cash_close_summary(uuid, timestamptz) to authenticated;
revoke all on function close_cash(uuid, timestamptz, numeric, numeric, text) from public, anon;
grant execute on function close_cash(uuid, timestamptz, numeric, numeric, text) to authenticated;
