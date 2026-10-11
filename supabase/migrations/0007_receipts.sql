-- 0007_receipts.sql
-- Sales receipts: business details printed on them (address, TIN, phone, footer) and a sequential receipt number per
-- business on every POS order. Run AFTER 0006. Safe to re-run, and safe on a 0000 baseline that already has the columns.
-- NOT applied yet: Supabase is wired up last. Receipts are sales receipts, NOT BIR-registered official receipts.

-- 1. Receipt details on the business (the existing "owners update own business" policy already limits who can edit them)
alter table businesses add column if not exists address text;
alter table businesses add column if not exists tin text;
alter table businesses add column if not exists contact_number text;
alter table businesses add column if not exists receipt_footer text;

-- 2. Receipt number: existing orders are numbered oldest-first per business, then the column becomes required and unique
alter table pos_orders add column if not exists receipt_number integer;
update pos_orders o
   set receipt_number = r.n
  from (select id, row_number() over (partition by business_id order by created_at, id)::int as n from pos_orders) r
 where o.id = r.id and o.receipt_number is null;
alter table pos_orders alter column receipt_number set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pos_orders_receipt_unique') then
    alter table pos_orders add constraint pos_orders_receipt_unique unique (business_id, receipt_number);
  end if;
end $$;

-- New orders always get the next number for their business, whatever the client sends. The advisory lock makes two
-- simultaneous sales in one business take turns, so numbers never repeat (and never skip, since orders aren't deleted).
create or replace function pos_orders_assign_receipt() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('receipt:' || new.business_id::text, 0));
  select coalesce(max(receipt_number), 0) + 1 into new.receipt_number from pos_orders where business_id = new.business_id;
  return new;
end $$;
drop trigger if exists pos_orders_assign_receipt on pos_orders;
create trigger pos_orders_assign_receipt before insert on pos_orders for each row execute function pos_orders_assign_receipt();

-- A receipt number never changes once issued
create or replace function pos_orders_freeze_receipt() returns trigger language plpgsql as $$
begin
  if new.receipt_number is distinct from old.receipt_number then
    raise exception 'A receipt number cannot be changed.';
  end if;
  return new;
end $$;
drop trigger if exists pos_orders_freeze_receipt on pos_orders;
create trigger pos_orders_freeze_receipt before update on pos_orders for each row execute function pos_orders_freeze_receipt();

-- 3. Audit: editing the receipt details is logged (without the values, so a TIN never lands in the log)
create or replace function audit_trg_business() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.name is distinct from new.name then
    perform audit_write(new.id, 'business.updated', 'business', new.id, 'Business renamed from "' || old.name || '" to "' || new.name || '"');
  elsif old.setup_completed_at is null and new.setup_completed_at is not null then
    perform audit_write(new.id, 'business.updated', 'business', new.id, 'Business setup completed');
  elsif (old.address, old.tin, old.contact_number, old.receipt_footer) is distinct from (new.address, new.tin, new.contact_number, new.receipt_footer) then
    perform audit_write(new.id, 'business.updated', 'business', new.id, 'Receipt details updated');
  end if;
  return new;
end $$;

-- 4. checkout_sale() now also returns the receipt number of the new order (everything else is unchanged from 0006)
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
  v_receipt integer;
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
    values (p_business, v_employee, 'paid', v_total, v_payment) returning id, receipt_number into v_order, v_receipt;

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

  return jsonb_build_object('order_id', v_order, 'total', v_total, 'receipt_number', v_receipt);
end;
$$;
revoke all on function checkout_sale(uuid, payment_method, text, jsonb) from public;
grant execute on function checkout_sale(uuid, payment_method, text, jsonb) to authenticated;
