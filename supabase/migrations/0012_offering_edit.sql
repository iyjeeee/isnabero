-- 0012_offering_edit.sql
-- Run this AFTER 0000-0011. Catalog edit + delete, and a fix found while testing against a real Postgres: 0001 only let
-- people READ offering_inclusions, so adding a bundle with inclusions (a plain client insert) was blocked by RLS.

-- 1. Inclusions: anyone in the offering's business can add / change / remove them, like the offering itself (0001)
create policy "modify own business offering inclusions" on offering_inclusions
  for all using (offering_id in (select id from offerings where business_id in (select employee_business_ids())))
  with check (offering_id in (select id from offerings where business_id in (select employee_business_ids())));

-- 2. update_offering(): edit an offering and replace its inclusions in ONE transaction (a client doing this in two or three
-- requests could leave a bundle half-edited). security definer so it can write the audit row; it checks membership itself.
-- Mirrors the mock repository: the audit summary names the new type, name and price.
create or replace function update_offering(
  p_offering uuid, p_name text, p_description text, p_type offering_type, p_price numeric, p_duration integer, p_inclusions jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid;
begin
  select business_id into v_business from offerings where id = p_offering;
  if v_business is null or not exists (select 1 from employees where business_id = v_business and user_id = auth.uid()) then
    raise exception 'You are not allowed to edit this offering.';
  end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'Name is required'; end if;
  if p_price is null or p_price < 0 then raise exception 'Price must be 0 or more'; end if;

  update offerings
     set name = btrim(p_name), description = p_description, type = p_type, price = p_price, duration_minutes = p_duration
   where id = p_offering;

  delete from offering_inclusions where offering_id = p_offering;
  if p_type = 'bundle' then
    insert into offering_inclusions (offering_id, label, quantity)
    select p_offering, x.label, x.quantity from jsonb_to_recordset(coalesce(p_inclusions, '[]'::jsonb)) as x(label text, quantity integer);
  end if;

  perform audit_write(v_business, 'offering.updated', 'offering', p_offering, 'Edited ' || p_type::text || ' "' || btrim(p_name) || '" (' || audit_peso(p_price) || ')');
end $$;
revoke all on function update_offering(uuid, text, text, offering_type, numeric, integer, jsonb) from public, anon;
grant execute on function update_offering(uuid, text, text, offering_type, numeric, integer, jsonb) to authenticated;

-- 3. Deleting an offering is audited. It is refused by the database when sales or bookings point at it (those foreign keys
-- are ON DELETE RESTRICT), so the app tells people to mark it sold out instead.
create or replace function audit_trg_offering() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform audit_write(old.business_id, 'offering.deleted', 'offering', old.id, 'Deleted ' || old.type::text || ' "' || old.name || '"');
    return old;
  elsif tg_op = 'INSERT' then
    perform audit_write(new.business_id, 'offering.created', 'offering', new.id,
      'Added ' || new.type::text || ' "' || new.name || '" at ' || audit_peso(new.price));
  elsif old.is_available is distinct from new.is_available then
    perform audit_write(new.business_id, 'offering.availability_changed', 'offering', new.id,
      'Marked "' || new.name || '" ' || case when new.is_available then 'available' else 'sold out' end);
  end if;
  return new;
end $$;
drop trigger if exists audit_offering_delete on offerings;
create trigger audit_offering_delete before delete on offerings for each row execute function audit_trg_offering();

-- Deleting an offering cascades to its stock tracking; that row's own "Stopped tracking" line would show a blank name
-- (the offering is already gone), so it is skipped — the offering's "Deleted" entry covers it.
create or replace function audit_trg_stock_item() returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if tg_op = 'DELETE' then
    select name into v_name from offerings where id = old.offering_id;
    if v_name is null then return old; end if;
    perform audit_write(old.business_id, 'stock.tracking_changed', 'stock', old.offering_id, 'Stopped tracking "' || v_name || '"');
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
