-- 0003_booking_no_overlap.sql
-- Run this AFTER 0000 (initial schema), 0001 (RLS policies) and 0002 (void payment records).
-- Enforces "two bookings in the same business can't share a time slot" at the database level, so two
-- requests racing for the same slot can't both succeed. Back-to-back bookings are allowed (the range is
-- half-open: [start, end)) and cancelled bookings don't hold their slot. The app also pre-checks in
-- packages/modules/booking for a friendly error message; this constraint is the real guarantee.

create extension if not exists btree_gist;

alter table bookings
  add constraint bookings_valid_range check (end_time > start_time);

alter table bookings
  add constraint bookings_no_overlap
  exclude using gist (business_id with =, tstzrange(start_time, end_time) with &&)
  where (status <> 'cancelled');
