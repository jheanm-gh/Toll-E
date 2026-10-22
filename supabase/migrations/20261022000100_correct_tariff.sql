-- Correct a published tariff from the SQL editor (docs/data-operations.md). Published tariffs
-- are immutable, so this withdraws the wrong row and publishes a corrected copy that points
-- back to it (supersedes_id), in one transaction. The app picks up the correction on its next
-- data refresh.
create function public.correct_tariff(
  p_tariff_id text,
  p_amount_rand numeric,
  p_source_id text,
  p_corrected_by text,
  p_reason text,
  p_verified boolean default false
) returns text
language plpgsql security definer set search_path = public as $$
declare
  old public.tariffs;
  base_id text;
  new_id text;
  n integer;
  today date := (now() at time zone 'Africa/Johannesburg')::date;
begin
  if not public.can_publish() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if char_length(coalesce(p_corrected_by, '')) < 3 then
    raise exception 'give the full name of the person making the correction' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(coalesce(p_reason, '')) < 5 then
    raise exception 'say why the value is being corrected' using errcode = 'invalid_parameter_value';
  end if;
  if p_amount_rand is null or p_amount_rand <= 0 or p_amount_rand <> round(p_amount_rand, 2) then
    raise exception 'amount must be in rand with at most two decimals, e.g. 94.50' using errcode = 'invalid_parameter_value';
  end if;
  select * into old from public.tariffs where id = p_tariff_id and publication_status = 'published';
  if not found then
    raise exception 'no published tariff with id %', p_tariff_id using errcode = 'no_data_found';
  end if;

  -- Corrections are numbered from the original id: x-c1, x-c2, ...
  base_id := regexp_replace(p_tariff_id, '-c[0-9]+$', '');
  select coalesce(max(substring(id from '-c([0-9]+)$')::integer), 0) + 1 into n
    from public.tariffs where id ~ ('^' || base_id || '-c[0-9]+$');
  new_id := base_id || '-c' || n;
  perform set_config('tolle.actor', p_corrected_by, true);

  update public.tariffs set publication_status = 'withdrawn' where id = old.id;
  insert into public.tariffs (
    id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, currency, vat_inclusive, charging_basis,
    direction, condition, effective_from, effective_to, schedule_id, source_id, source_locator, checked_on,
    verified_on, verified_by, verification_status, publication_status, notes, supersedes_id
  ) values (
    new_id, old.plaza_id, old.vehicle_class_id, old.class_scheme_id, (p_amount_rand * 100)::integer, old.currency,
    old.vat_inclusive, old.charging_basis, old.direction, old.condition, old.effective_from, old.effective_to,
    old.schedule_id, p_source_id, null, today,
    case when p_verified then today end, case when p_verified then p_corrected_by end,
    case when p_verified then 'verified' else 'unverified' end::public.verification_status,
    'published', p_reason, old.id
  );
  return new_id;
end;
$$;

revoke execute on function public.correct_tariff(text, numeric, text, text, text, boolean) from public, anon, authenticated;
