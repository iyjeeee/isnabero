-- 0016_expense_edit.sql — expenses can now be corrected, not just voided. Run AFTER 0000-0015.
-- Rules: an active expense can have its category, description, amount, date, method and notes changed (each change is audited);
-- who recorded it and when never change; a voided expense is frozen completely, and voiding itself changes nothing else.

create or replace function expenses_only_void()
returns trigger
language plpgsql
as $$
begin
  if (new.id, new.business_id, new.recorded_by, new.created_at) is distinct from (old.id, old.business_id, old.recorded_by, old.created_at) then
    raise exception 'an expense''s owner and recorded time can''t be changed';
  end if;
  if old.voided_at is not null and new is distinct from old then
    raise exception 'a voided expense can''t be changed';
  end if;
  if new.voided_at is not null and old.voided_at is null
     and (new.category, new.description, new.amount, new.expense_date, new.method, new.notes)
         is distinct from (old.category, old.description, old.amount, old.expense_date, old.method, old.notes) then
    raise exception 'voiding an expense can''t also edit it';
  end if;
  return new;
end;
$$;

-- audit: edits get their own line, worded like the mock repository (AUDIT_ACTIONS "expense.updated")
create or replace function audit_trg_expense() returns trigger language plpgsql security definer set search_path = public as $$
declare v_changes text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform audit_write(new.business_id, 'expense.created', 'expense', new.id,
      'Recorded expense "' || new.description || '" ' || audit_peso(new.amount) || ' (' || new.category::text || ')');
  elsif old.voided_at is null and new.voided_at is not null then
    perform audit_write(new.business_id, 'expense.voided', 'expense', new.id,
      'Voided expense "' || new.description || '" ' || audit_peso(new.amount));
  else
    if old.description is distinct from new.description then v_changes := v_changes || ('description from "' || old.description || '"'); end if;
    if old.amount is distinct from new.amount then v_changes := v_changes || ('amount ' || audit_peso(old.amount) || ' → ' || audit_peso(new.amount)); end if;
    if old.category is distinct from new.category then v_changes := v_changes || ('category ' || old.category::text || ' → ' || new.category::text); end if;
    if old.method is distinct from new.method then v_changes := v_changes || ('method ' || old.method::text || ' → ' || new.method::text); end if;
    if old.expense_date is distinct from new.expense_date then v_changes := v_changes || ('date ' || old.expense_date::text || ' → ' || new.expense_date::text); end if;
    if coalesce(old.notes, '') is distinct from coalesce(new.notes, '') then v_changes := v_changes || 'notes changed'::text; end if;
    if array_length(v_changes, 1) > 0 then
      perform audit_write(new.business_id, 'expense.updated', 'expense', new.id, 'Edited expense "' || new.description || '": ' || array_to_string(v_changes, ', '));
    end if;
  end if;
  return new;
end $$;
revoke all on function audit_trg_expense() from public, anon, authenticated;
