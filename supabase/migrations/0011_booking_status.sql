-- 0011_booking_status.sql
-- Run this AFTER 0000-0010. Bookings can now be edited and moved through pending -> confirmed -> completed (or cancelled).
-- Mirrors packages/modules/booking/src/status.ts; the audit wording matches the mock repository.
-- Cancelling already frees the time slot: the bookings_no_overlap constraint (0003) ignores cancelled rows.

-- Guard: legal status moves only, completed/cancelled bookings are final, and a booking never changes business
create or replace function bookings_guard() returns trigger language plpgsql as $$
begin
  if new.business_id is distinct from old.business_id then
    raise exception 'a booking cannot be moved to another business';
  end if;
  if new.status is distinct from old.status
     and not ((old.status = 'pending' and new.status in ('confirmed', 'cancelled'))
           or (old.status = 'confirmed' and new.status in ('completed', 'cancelled'))) then
    raise exception 'A % booking can''t be changed to %.', old.status, new.status;
  end if;
  if old.status in ('completed', 'cancelled')
     and (old.offering_id, old.customer_name, old.customer_contact, old.start_time, old.end_time)
         is distinct from (new.offering_id, new.customer_name, new.customer_contact, new.start_time, new.end_time) then
    raise exception 'Only pending or confirmed bookings can be edited.';
  end if;
  return new;
end $$;
drop trigger if exists bookings_guard on bookings;
create trigger bookings_guard before update on bookings for each row execute function bookings_guard();

-- Audit: creation (unchanged), status changes and edits
create or replace function audit_trg_booking() returns trigger language plpgsql security definer set search_path = public as $$
declare v_offering text;
begin
  select name into v_offering from offerings where id = new.offering_id;
  if tg_op = 'INSERT' then
    perform audit_write(new.business_id, 'booking.created', 'booking', new.id,
      'Booked ' || coalesce(v_offering, 'an offering') || ' for ' || new.customer_name);
  elsif old.status is distinct from new.status then
    perform audit_write(new.business_id, 'booking.status_changed', 'booking', new.id,
      'Booking for ' || new.customer_name || ' (' || coalesce(v_offering, 'an offering') || '): ' || old.status::text || ' → ' || new.status::text);
  elsif (old.offering_id, old.customer_name, old.customer_contact, old.start_time, old.end_time)
        is distinct from (new.offering_id, new.customer_name, new.customer_contact, new.start_time, new.end_time) then
    perform audit_write(new.business_id, 'booking.updated', 'booking', new.id,
      'Updated booking for ' || new.customer_name || ' (' || coalesce(v_offering, 'an offering') || ')');
  end if;
  return new;
end $$;
drop trigger if exists audit_booking on bookings;
create trigger audit_booking after insert or update on bookings for each row execute function audit_trg_booking();
