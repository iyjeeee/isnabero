-- 0017_barcode.sql — optional barcode / item code on each offering, so the POS can add an item by scanning it. Run AFTER 0000-0016.
-- A code is unique within a business (ignoring upper/lower case); blank means "no code". update_offering() gains p_barcode.

alter table offerings add column if not exists barcode text;
alter table offerings add constraint offerings_barcode_length check (barcode is null or char_length(barcode) between 1 and 64);
create unique index if not exists offerings_barcode_unique on offerings (business_id, lower(barcode)) where barcode is not null;

-- replace the 7-argument version (a second overload would leave two callable versions)
drop function if exists update_offering(uuid, text, text, offering_type, numeric, integer, jsonb);

create or replace function update_offering(
  p_offering uuid, p_name text, p_description text, p_type offering_type, p_price numeric, p_duration integer, p_inclusions jsonb, p_barcode text default null
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
     set name = btrim(p_name), description = p_description, type = p_type, price = p_price, duration_minutes = p_duration, barcode = nullif(btrim(coalesce(p_barcode, '')), '')
   where id = p_offering;

  delete from offering_inclusions where offering_id = p_offering;
  if p_type = 'bundle' then
    insert into offering_inclusions (offering_id, label, quantity)
    select p_offering, x.label, x.quantity from jsonb_to_recordset(coalesce(p_inclusions, '[]'::jsonb)) as x(label text, quantity integer);
  end if;

  perform audit_write(v_business, 'offering.updated', 'offering', p_offering, 'Edited ' || p_type::text || ' "' || btrim(p_name) || '" (' || audit_peso(p_price) || ')');
end $$;
revoke all on function update_offering(uuid, text, text, offering_type, numeric, integer, jsonb, text) from public, anon;
grant execute on function update_offering(uuid, text, text, offering_type, numeric, integer, jsonb, text) to authenticated;
