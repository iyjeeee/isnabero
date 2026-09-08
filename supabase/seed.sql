-- supabase/seed.sql
-- Runs automatically on `supabase db reset`. Demo data only — safe to edit or clear for real use.
-- NOTE: this mirrors the same business/catalog/employees as packages/db/src/mock/store.ts, but does
-- NOT replicate the 21-day generated sales/booking history that the mock store creates — that's
-- randomized-but-deterministic JS logic that isn't worth hand-porting to SQL. If you want realistic
-- historical data in a real Supabase project, seed it by actually using the app (POS checkouts,
-- bookings) for a few days, or write a one-off script against these tables.

insert into businesses (id, name, slug) values
  ('00000000-0000-0000-0000-000000000001', 'Sample Business', 'sample-business')
on conflict do nothing;

insert into business_modules (business_id, module_key, enabled) values
  ('00000000-0000-0000-0000-000000000001', 'catalog', true),
  ('00000000-0000-0000-0000-000000000001', 'pos', true),
  ('00000000-0000-0000-0000-000000000001', 'booking', true)
on conflict do nothing;

-- NOTE: these employees use placeholder user_id values (not real auth.users rows) since seed.sql runs
-- before any real signups exist. Real employees should be added via the "Invite employee" flow
-- (supabase/functions/invite-employee) once you have actual users, not by editing this file.
insert into employees (id, business_id, user_id, full_name, role) values
  ('00000000-0000-0000-0000-00000000010e', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e', 'Juan Dela Cruz', 'owner'),
  ('00000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000210', 'Maria Santos', 'admin'),
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000211', 'Pedro Reyes', 'staff'),
  ('00000000-0000-0000-0000-000000000112', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000212', 'Ana Lopez', 'staff')
on conflict do nothing;

insert into offerings (id, business_id, name, description, type, price, duration_minutes, is_available) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Sisig', 'Sizzling pork sisig, single serving', 'item', 150.00, null, true),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Lumpia (6 pcs)', 'Crispy fried spring rolls', 'item', 80.00, null, true),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'Halo-Halo', 'Shaved ice dessert with mixed toppings', 'item', 120.00, null, true),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', 'Iced Tea', 'House-brewed iced tea, 16oz', 'item', 40.00, null, false),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Bundle A', '10 mins unli shots + 2 prints', 'bundle', 499.00, 10, true),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', 'Bundle B', '20 mins unli shots + 4 prints + 1 photo strip', 'bundle', 799.00, 20, true),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000001', 'Extra 5 Prints', 'Add-on for any photobooth package', 'addon', 100.00, null, true)
on conflict do nothing;

insert into offering_inclusions (offering_id, label, quantity) values
  ('00000000-0000-0000-0000-000000000102', 'Unli shots', null),
  ('00000000-0000-0000-0000-000000000102', 'Printed copies', 2),
  ('00000000-0000-0000-0000-000000000106', 'Unli shots', null),
  ('00000000-0000-0000-0000-000000000106', 'Printed copies', 4),
  ('00000000-0000-0000-0000-000000000106', 'Photo strip', 1)
on conflict do nothing;
