-- 0005_audit_log.sql
-- Run this AFTER 0000 (initial schema, which already includes the audit_log table), 0001-0004. NOT applied yet:
-- Supabase is wired up last. Mirrors recordAudit() calls in the mock repositories — the action names and summary
-- wording must stay identical to AUDIT_ACTIONS (packages/db/src/audit.ts) and the mock repositories.
--
-- The app never writes audit rows. Triggers do, as the signed-in user (auth.uid()), so the log can't be skipped or
-- forged by a client. There is no insert/update/delete policy: authenticated users can only read (owner/admin).

alter table audit_log enable row level security;

create policy "owner admin select audit log" on audit_log
  for select using (employee_has_role(business_id, array['owner','admin']::employee_role[]));

-- audit_write(): the one place rows are inserted. security definer so it can write despite RLS;
-- the actor is whoever's auth.uid() is an employee of that business (otherwise "System", e.g. service-role jobs).
create or replace function audit_write(p_business uuid, p_action text, p_entity_type text, p_entity uuid, p_summary text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_name text;
begin
  -- Skip when the business no longer exists (e.g. rows removed by a business cascade delete)
  if not exists (select 1 from businesses where id = p_business) then
    return;
  end if;
  select id, full_name into v_actor_id, v_actor_name
    from employees where business_id = p_business and user_id = auth.uid() limit 1;
  insert into audit_log (business_id, actor_id, actor_name, action, entity_type, entity_id, summary)
  values (p_business, v_actor_id, coalesce(v_actor_name, 'System'), p_action, p_entity_type, p_entity, p_summary);
end;
$$;

-- peso(): "₱50.00" — same format as auditPeso() in the app
create or replace function audit_peso(amount numeric)
returns text language sql immutable as $$ select '₱' || to_char(amount, 'FM999999990.00') $$;

-- Sales (pos_orders insert; the payment record is inserted first, so the method is known)
create or replace function audit_trg_sale() returns trigger language plpgsql security definer set search_path = public as $$
declare v_method text;
begin
  select method::text into v_method from payment_records where id = new.payment_record_id;
  perform audit_write(new.business_id, 'sale.completed', 'sale', new.id,
    'Sale of ' || audit_peso(new.total) || ' paid by ' || coalesce(v_method, 'unknown'));
  return new;
end $$;
create trigger audit_sale after insert on pos_orders for each row execute function audit_trg_sale();

-- Payment void (voided_at null -> set)
create or replace function audit_trg_payment_void() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.voided_at is null and new.voided_at is not null then
    perform audit_write(new.business_id, 'payment.voided', 'payment', new.id,
      'Voided ' || audit_peso(new.amount) || ' ' || new.source_module::text || ' payment (' || new.method::text || ')');
  end if;
  return new;
end $$;
create trigger audit_payment_void after update on payment_records for each row execute function audit_trg_payment_void();

-- Bookings
create or replace function audit_trg_booking() returns trigger language plpgsql security definer set search_path = public as $$
declare v_offering text;
begin
  select name into v_offering from offerings where id = new.offering_id;
  perform audit_write(new.business_id, 'booking.created', 'booking', new.id,
    'Booked ' || coalesce(v_offering, 'an offering') || ' for ' || new.customer_name);
  return new;
end $$;
create trigger audit_booking after insert on bookings for each row execute function audit_trg_booking();

-- Offerings: created, and availability flips
create or replace function audit_trg_offering() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform audit_write(new.business_id, 'offering.created', 'offering', new.id,
      'Added ' || new.type::text || ' "' || new.name || '" at ' || audit_peso(new.price));
  elsif old.is_available is distinct from new.is_available then
    perform audit_write(new.business_id, 'offering.availability_changed', 'offering', new.id,
      'Marked "' || new.name || '" ' || case when new.is_available then 'available' else 'sold out' end);
  end if;
  return new;
end $$;
create trigger audit_offering after insert or update on offerings for each row execute function audit_trg_offering();

-- Expenses: recorded, voided
create or replace function audit_trg_expense() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform audit_write(new.business_id, 'expense.created', 'expense', new.id,
      'Recorded expense "' || new.description || '" ' || audit_peso(new.amount) || ' (' || new.category::text || ')');
  elsif old.voided_at is null and new.voided_at is not null then
    perform audit_write(new.business_id, 'expense.voided', 'expense', new.id,
      'Voided expense "' || new.description || '" ' || audit_peso(new.amount));
  end if;
  return new;
end $$;
create trigger audit_expense after insert or update on expenses for each row execute function audit_trg_expense();

-- Employees: added, changed (name and/or role), removed
create or replace function audit_trg_employee() returns trigger language plpgsql security definer set search_path = public as $$
declare v_changes text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform audit_write(new.business_id, 'employee.created', 'employee', new.id, 'Added ' || new.full_name || ' as ' || new.role::text);
  elsif tg_op = 'UPDATE' then
    if old.full_name is distinct from new.full_name then v_changes := v_changes || ('renamed from "' || old.full_name || '"'); end if;
    if old.role is distinct from new.role then v_changes := v_changes || ('role ' || old.role::text || ' → ' || new.role::text); end if;
    if array_length(v_changes, 1) > 0 then
      perform audit_write(new.business_id, 'employee.updated', 'employee', new.id, 'Updated ' || new.full_name || ': ' || array_to_string(v_changes, ', '));
    end if;
  else
    perform audit_write(old.business_id, 'employee.deleted', 'employee', old.id, 'Removed ' || old.full_name || ' (' || old.role::text || ')');
    return old;
  end if;
  return new;
end $$;
create trigger audit_employee after insert or update or delete on employees for each row execute function audit_trg_employee();

-- Business: rename / setup completed
create or replace function audit_trg_business() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.name is distinct from new.name then
    perform audit_write(new.id, 'business.updated', 'business', new.id, 'Business renamed from "' || old.name || '" to "' || new.name || '"');
  elsif old.setup_completed_at is null and new.setup_completed_at is not null then
    perform audit_write(new.id, 'business.updated', 'business', new.id, 'Business setup completed');
  end if;
  return new;
end $$;
create trigger audit_business after update on businesses for each row execute function audit_trg_business();

-- Modules: one entry per module that is switched on or off
create or replace function audit_trg_module() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.enabled) or (tg_op = 'UPDATE' and old.enabled is distinct from new.enabled) then
    perform audit_write(new.business_id, 'business.modules_changed', 'business', new.business_id,
      'Module ' || new.module_key::text || ' turned ' || case when new.enabled then 'on' else 'off' end);
  end if;
  return new;
end $$;
create trigger audit_module after insert or update on business_modules for each row execute function audit_trg_module();
