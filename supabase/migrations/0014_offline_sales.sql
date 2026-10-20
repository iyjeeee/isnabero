-- 0014_offline_sales.sql — selling while offline.
-- A sale made without a connection is saved on the device and sent later, possibly more than once if the reply is lost. So:
--   * pos_orders.client_id: an id the app makes for each sale; checkout_sale() returns the existing sale when it sees the same id again
--   * p_sold_at: when the sale really happened, so reports don't move to the sync time (never in the future)
-- Receipt numbers are still issued by the database when the sale arrives. Prices are read when it arrives.

alter table pos_orders add column if not exists client_id uuid;
create unique index if not exists pos_orders_client_unique on pos_orders (business_id, client_id) where client_id is not null;

-- replace the old 4-argument function (a second overload would leave two callable versions)
drop function if exists checkout_sale(uuid, payment_method, text, jsonb);

create or replace function checkout_sale(p_business uuid, p_method payment_method, p_reference text, p_lines jsonb, p_client_id uuid default null, p_sold_at timestamptz default null)
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
  v_existing record;
  v_when timestamptz := least(coalesce(p_sold_at, now()), now()); -- the moment of the sale (offline sales sync later); never in the future
begin
  select id into v_employee from employees where business_id = p_business and user_id = auth.uid() limit 1;
  if v_employee is null then
    raise exception 'You are not allowed to sell for this business.' using errcode = '42501';
  end if;
  -- Offline sales are sent again until the app hears back, so a repeat of the same client id returns the sale already recorded
  if p_client_id is not null then
    select o.id, o.total, o.receipt_number into v_existing from pos_orders o where o.business_id = p_business and o.client_id = p_client_id;
    if found then
      return jsonb_build_object('order_id', v_existing.id, 'total', v_existing.total, 'receipt_number', v_existing.receipt_number, 'duplicate', true);
    end if;
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

  insert into payment_records (business_id, source_module, method, reference_code, amount, created_at)
    values (p_business, 'pos', p_method, p_reference, v_total, v_when) returning id into v_payment;
  insert into pos_orders (business_id, employee_id, status, total, payment_record_id, client_id, created_at)
    values (p_business, v_employee, 'paid', v_total, v_payment, p_client_id, v_when) returning id, receipt_number into v_order, v_receipt;

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
      insert into stock_movements (business_id, offering_id, delta, kind, reference_id, recorded_by, created_at)
        values (p_business, v_agg.offering_id, -v_agg.qty, 'sale', v_order, v_employee, v_when);
    end if;
  end loop;

  return jsonb_build_object('order_id', v_order, 'total', v_total, 'receipt_number', v_receipt);
end;
$$;
revoke all on function checkout_sale(uuid, payment_method, text, jsonb, uuid, timestamptz) from public, anon;
grant execute on function checkout_sale(uuid, payment_method, text, jsonb, uuid, timestamptz) to authenticated;
