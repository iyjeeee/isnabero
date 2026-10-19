-- 0010_restock_on_void.sql
-- Run this AFTER 0000-0009. Voiding a POS payment record cancels the sale: its order is marked voided (so it drops out of the
-- top-sellers report) and its tracked items go back into stock as "return" movements, exactly once. Booking payments are untouched.
-- Mirrors voidMockSale() in packages/db/src/mock/stock.ts — keep the wording identical.

create or replace function payment_records_restock_void() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_order pos_orders%rowtype;
  v_employee uuid;
begin
  if old.voided_at is not null or new.voided_at is null or new.source_module <> 'pos' then
    return new;
  end if;
  select * into v_order from pos_orders where payment_record_id = new.id and status <> 'voided' limit 1;
  if not found then
    return new;
  end if;
  update pos_orders set status = 'voided' where id = v_order.id;
  select id into v_employee from employees where business_id = new.business_id and user_id = auth.uid() limit 1;
  -- Only items that are still tracked go back; the stock_movements trigger applies the count and audits the return
  insert into stock_movements (business_id, offering_id, delta, kind, note, reference_id, recorded_by)
  select v_order.business_id, i.offering_id, i.quantity, 'return', 'Sale #' || v_order.receipt_number || ' voided', v_order.id, v_employee
  from pos_order_items i
  join stock_items s on s.offering_id = i.offering_id and s.business_id = v_order.business_id
  where i.order_id = v_order.id;
  return new;
end $$;

-- Named to sort after audit_payment_void, so "Payment voided" is logged before the stock returns
drop trigger if exists payment_records_restock_void on payment_records;
create trigger payment_records_restock_void after update on payment_records
  for each row execute function payment_records_restock_void();
