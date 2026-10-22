-- Mark a journey's plaza sequence as verified from the SQL editor (docs/data-operations.md).
-- Production builds of the app only offer journeys whose sequence is verified, so this makes a
-- route appear in the app on its next data refresh, without an app update.
create function public.verify_journey(
  p_journey_id text,
  p_verified_by text,
  p_verified_on date default (now() at time zone 'Africa/Johannesburg')::date
) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.can_publish() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if char_length(coalesce(p_verified_by, '')) < 3 then
    raise exception 'give the full name of the person who checked the route' using errcode = 'invalid_parameter_value';
  end if;
  perform set_config('tolle.actor', p_verified_by, true);
  update public.journeys
     set sequence_status = 'verified', sequence_verified_on = p_verified_on, sequence_verified_by = p_verified_by
   where id = p_journey_id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'no journey with id %', p_journey_id using errcode = 'no_data_found';
  end if;
  return n;
end;
$$;

revoke execute on function public.verify_journey(text, text, date) from public, anon, authenticated;
