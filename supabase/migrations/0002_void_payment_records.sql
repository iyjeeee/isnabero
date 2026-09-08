-- 0002_void_payment_records.sql
-- Run this AFTER 0000 (initial schema) and 0001 (RLS policies).
-- Adds soft-delete support to payment_records: voiding a mistaken/duplicate entry marks it instead
-- of erasing financial history outright.

alter table payment_records add column if not exists voided_at timestamptz;
