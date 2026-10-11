-- 0006_inventory.sql
-- Run this AFTER 0000 (initial schema, which already has stock_items, stock_movements, the stock_movement_kind enum
-- and the non-negative CHECK constraints) and 0001-0005. NOT applied yet: Supabase is wired up last.
--
-- Stock counts only ever change through stock_movements: a trigger applies each movement to stock_items.quantity, and
-- the CHECK (quantity >= 0) constraint makes the database itself refuse an oversell, even when two sales race.

alter table stock_items enable row level security;
alter table stock_movements enable row level security;

-- stock_items: everyone in the business can read (the POS needs it); owner/admin manage tracking.
-- New items start at 0 — the opening count arrives as an "initial" movement.
create policy "select own business stock items" on stock_items
  for select using (business_id in (select employee_business_ids()));
create policy "owner admin insert stock items" on stock_items
  for insert with check (quantity = 0 and employee_has_role(business_id, array['owner','admin']::employee_role[]));
create policy "owner admin update stock items" on stock_items
  for update using (employee_has_role(business_id, array['owner','admin']::employee_role[]))
  with check (employee_has_role(business_id, array['owner','admin']::employee_role[]));
create policy "owner admin delete stock items" on stock_items
  for delete using (employee_has_role(business_id, array['owner','admin']::employee_role[]));

-- stock_movements: readable by the business; only owner/admin can insert, and never a "sale" (those come from
-- checkout_sale() below, which runs with its own rights). No update/delete policy: the ledger is permanent.
create policy "select own business stock movements" on stock_movements
  for select using (business_id in (select employee_business_ids()));
create policy "owner admin insert stock movements" on stock_movements
  for insert with check (kind <> 'sale' and employee_has_role(business_id, array['owner','admin']::employee_role[]));

-- Counts can't be edited directly: the UPDATE of quantity is only allowed from inside the movement trigger (trigger depth 2)
create or replace function stock_items_guard() returns trigger language plpgsql as $$
begin
  if new.offering_id is distinct from old.offering_id or new.business_id is distinct from old.business_id then
    raise exception 'a stock item cannot be moved to another offering or business';
  end if;
  if new.quantity is distinct from old.quantity and pg_trigger_depth() < 2 then
    raise exception 'stock counts change only through stock movements';
  end if;
  return new;
end $$;
create trigger stock_items_guard before update on stock_items for each row execute function stock_items_guard();

-- Apply a movement to the count (security definer so it works for the roles allowed to insert movements)
create or replace function stock_movements_apply() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update stock_items set quantity = quantity + new.delta
   where offering_id = new.offering_id and business_id = new.business_id;
  if not found then
    raise exception 'this item is not tracked in inventory';
  end if;
  return new;
end $$;
create trigger stock_movements_apply after insert on stock_movements for each row execute function stock_movements_apply();

-- Audit (wording matches the mock repositories). Sales are already audited as sale.completed and the opening count is
-- visible in the stock history, so only tracking changes and manual adjustments are logged here.
create or replace function audit_trg_stock_item() returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if tg_op = 'DELETE' then
    select name into v_name from offerings where id = old.offering_id;
    perform audit_write(old.business_id, 'stock.tracking_changed', 'stock', old.offering_id, 'Stopped tracking "' || coalesce(v_name, 'item') || '"');
    return old;
  end if;
  select name into v_name from offerings where id = new.offering_id;
  if tg_op = 'INSERT' then
    perform audit_write(new.business_id, 'stock.tracking_changed', 'stock', new.offering_id, 'Started tracking "' || coalesce(v_name, 'item') || '"');
  elsif old.low_stock_threshold is distinct from new.low_stock_threshold then
    perform audit_write(new.business_id, 'stock.tracking_changed', 'stock', new.offering_id,
      'Low-stock level for "' || coalesce(v_name, 'item') || '" set to ' || new.low_stock_threshold);
  end if;
  return new;
end $$;
create trigger audit_stock_item after insert or update or delete on stock_items for each row execute function audit_trg_stock_item();

create or replace function audit_trg_stock_movement() returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if new.kind not in ('initial', 'sale') then
    select name into v_name from offerings where id = new.offering_id;
    perform audit_write(new.business_id, 'stock.adjusted', 'stock', new.offering_id,
      'Adjusted "' || coalesce(v_name, 'item') || '" ' || case when new.delta > 0 then '+' else '' end || new.delta
      || ' (' || new.kind::text || '): ' || coalesce(new.note, ''));
  end if;
  return new;
end $$;
create trigger audit_stock_movement after insert on stock_movements for each row execute function audit_trg_stock_movement();

-- checkout_sale(): the whole POS sale in ONE transaction — payment record, order, items and stock deduction — so a stock
-- shortage can't leave a half-recorded sale. security definer, so it checks membership itself; the cashier is the signed-in
-- employee and prices come from offerings (nothing price- or identity-related is trusted from the client). A shortage raises
-- check_violation (23514) with a user-facing message that the app shows as-is.
create or replace function checkout_sale(p_business uuid, p_method payment_method, p_reference text, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid;
  v_total numeric := 0;
  v_payment uuid;
  v_order uuid;
  v_off record;
  v_stock record;
  v_agg record;
  v_line record;
begin
  select id into v_employee from employees where business_id = p_business and user_id = auth.uid() limit 1;
  if v_employee is null then
    raise exception 'You are not allowed to sell for this business.' using errcode = '42501';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The sale has no items.';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_lines) as x(offering_id uuid, quantity int) where x.offering_id is null or x.quantity is null or x.quantity <= 0) then
    raise exception 'Every item needs a quantity of at least 1.';
  end if;

  -- Per offering: lock its stock row (if tracked), refuse a shortage, and add up the total
  for v_agg in
    select x.offering_id, sum(x.quantity)::int as qty
      from jsonb_to_recordset(p_lines) as x(offering_id uuid, quantity int)
     group by x.offering_id
  loop
    select * into v_off from offerings where id = v_agg.offering_id and business_id = p_business;
    if not found then
      raise exception 'An item in this sale no longer exists.';
    end if;
    select * into v_stock from stock_items where offering_id = v_agg.offering_id for update;
    if found and v_stock.quantity < v_agg.qty then
      raise exception using errcode = '23514', message =
        case when v_stock.quantity <= 0 then format('"%s" is out of stock.', v_off.name)
             else format('Not enough "%s" in stock — only %s left.', v_off.name, v_stock.quantity) end;
    end if;
    v_total := v_total + v_off.price * v_agg.qty;
  end loop;

  insert into payment_records (business_id, source_module, method, reference_code, amount)
    values (p_business, 'pos', p_method, p_reference, v_total) returning id into v_payment;
  insert into pos_orders (business_id, employee_id, status, total, payment_record_id)
    values (p_business, v_employee, 'paid', v_total, v_payment) returning id into v_order;

  for v_line in select x.offering_id, x.quantity from jsonb_to_recordset(p_lines) as x(offering_id uuid, quantity int) loop
    insert into pos_order_items (order_id, offering_id, quantity, unit_price)
      select v_order, v_line.offering_id, v_line.quantity, price from offerings where id = v_line.offering_id;
  end loop;

  for v_agg in
    select x.offering_id, sum(x.quantity)::int as qty
      from jsonb_to_recordset(p_lines) as x(offering_id uuid, quantity int)
     group by x.offering_id
  loop
    if exists (select 1 from stock_items where offering_id = v_agg.offering_id) then
      insert into stock_movements (business_id, offering_id, delta, kind, reference_id, recorded_by)
        values (p_business, v_agg.offering_id, -v_agg.qty, 'sale', v_order, v_employee);
    end if;
  end loop;

  return jsonb_build_object('order_id', v_order, 'total', v_total);
end;
$$;
revoke all on function checkout_sale(uuid, payment_method, text, jsonb) from public;
grant execute on function checkout_sale(uuid, payment_method, text, jsonb) to authenticated;
