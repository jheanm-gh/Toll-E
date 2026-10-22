-- Toll-E RPC functions: the public dataset feed, the correction inbox, and the
-- publication workflow used by the admin app.

-- ---------------------------------------------------------------------------------------
-- Public: the published dataset in the exact JSON shape of the app's `Dataset` type.
-- One request gives the app everything it needs; the app validates it before use.
-- ---------------------------------------------------------------------------------------
create function public.published_dataset() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'datasetVersion', coalesce((select value from dataset_meta where key = 'dataset_version'), '1970-01-01.0'),
    'generatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'country', 'ZA',
    'sources', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', s.id, 'title', s.title, 'publisher', s.publisher, 'url', s.url, 'kind', s.kind,
                           'official', s.official, 'retrievedOn', to_char(s.retrieved_on, 'YYYY-MM-DD'))
        || jsonb_strip_nulls(jsonb_build_object('publishedOn', to_char(s.published_on, 'YYYY-MM-DD'),
                                                'reference', s.reference, 'notes', s.notes))
        order by s.id)
      from sources s), '[]'::jsonb),
    'operators', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', o.id, 'name', o.name, 'shortName', o.short_name, 'kind', o.kind,
                           'contactStatus', o.contact_status, 'sourceIds', to_jsonb(o.source_ids))
        || jsonb_strip_nulls(jsonb_build_object(
             'website', o.website, 'phone', o.phone, 'email', o.email, 'notes', o.notes,
             'payment', case when o.payment_methods is null then null else
               jsonb_build_object('methods', to_jsonb(o.payment_methods), 'status', o.payment_status,
                                  'sourceIds', to_jsonb(o.payment_source_ids))
               || jsonb_strip_nulls(jsonb_build_object('notes', o.payment_notes)) end))
        order by o.id)
      from operators o), '[]'::jsonb),
    'tollRoads', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', r.id, 'name', r.name, 'routes', to_jsonb(r.routes), 'operatorId', r.operator_id,
                           'provinces', to_jsonb(r.provinces), 'sourceIds', to_jsonb(r.source_ids))
        || jsonb_strip_nulls(jsonb_build_object('description', r.description))
        order by r.id)
      from toll_roads r), '[]'::jsonb),
    'vehicleClassSchemes', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', sc.id, 'name', sc.name, 'fromStandard', sc.from_standard,
                           'sourceIds', to_jsonb(sc.source_ids),
                           'classes', coalesce((
                             select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label,
                                                                 'shortDescription', c.short_description,
                                                                 'description', c.description) order by c.sort_order)
                             from vehicle_classes c where c.scheme_id = sc.id), '[]'::jsonb))
        order by sc.id)
      from vehicle_class_schemes sc), '[]'::jsonb),
    'plazas', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', p.id, 'name', p.name, 'tollRoadId', p.toll_road_id, 'operatorId', p.operator_id,
                           'route', p.route, 'type', p.type, 'province', p.province, 'status', p.status,
                           'classSchemeId', p.class_scheme_id, 'sourceIds', to_jsonb(p.source_ids),
                           'publicationStatus', p.publication_status,
                           'location', case when p.lat is null then null else
                             jsonb_build_object('lat', p.lat, 'lng', p.lng, 'precision', p.location_precision,
                                                'sourceIds', to_jsonb(p.location_source_ids))
                             || jsonb_strip_nulls(jsonb_build_object('notes', p.location_notes)) end)
        || jsonb_strip_nulls(jsonb_build_object(
             'locality', p.locality, 'carriageway', p.carriageway,
             'aliases', case when cardinality(p.aliases) > 0 then to_jsonb(p.aliases) end,
             'notes', case when cardinality(p.notes) > 0 then to_jsonb(p.notes) end))
        order by p.id)
      from plazas p where p.publication_status = 'published'), '[]'::jsonb),
    'schedules', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', s.id, 'name', s.name, 'operatorIds', to_jsonb(s.operator_ids),
                           'effectiveFrom', to_char(s.effective_from, 'YYYY-MM-DD'),
                           'effectiveTo', to_char(s.effective_to, 'YYYY-MM-DD'),
                           'sourceIds', to_jsonb(s.source_ids))
        || jsonb_strip_nulls(jsonb_build_object('nextReviewExpected', to_char(s.next_review_expected, 'YYYY-MM-DD'),
                                                'adjustmentBps', s.adjustment_bps, 'notes', s.notes))
        order by s.id)
      from tariff_schedules s), '[]'::jsonb),
    'tariffs', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', t.id, 'plazaId', t.plaza_id, 'vehicleClassId', t.vehicle_class_id,
                           'amountCents', t.amount_cents, 'currency', t.currency, 'vatInclusive', t.vat_inclusive,
                           'chargingBasis', t.charging_basis, 'direction', t.direction,
                           'effectiveFrom', to_char(t.effective_from, 'YYYY-MM-DD'),
                           'effectiveTo', to_char(t.effective_to, 'YYYY-MM-DD'),
                           'scheduleId', t.schedule_id, 'sourceId', t.source_id,
                           'checkedOn', to_char(t.checked_on, 'YYYY-MM-DD'),
                           'verifiedOn', to_char(t.verified_on, 'YYYY-MM-DD'), 'verifiedBy', t.verified_by,
                           'verificationStatus', t.verification_status, 'publicationStatus', t.publication_status)
        || jsonb_strip_nulls(jsonb_build_object('condition', t.condition, 'sourceLocator', t.source_locator,
                                                'notes', t.notes))
        order by t.id)
      from tariffs t join plazas p on p.id = t.plaza_id
      where t.publication_status = 'published' and p.publication_status = 'published'), '[]'::jsonb),
    'journeys', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', j.id, 'name', j.name,
                           'origin', jsonb_build_object('label', j.origin_label, 'query', j.origin_query),
                           'destination', jsonb_build_object('label', j.destination_label, 'query', j.destination_query),
                           'via', j.via, 'description', j.description, 'sequenceStatus', j.sequence_status,
                           'limitations', to_jsonb(j.limitations), 'sourceIds', to_jsonb(j.source_ids),
                           'publicationStatus', j.publication_status,
                           'events', coalesce((
                             select jsonb_agg(jsonb_build_object('plazaId', e.plaza_id, 'direction', e.direction,
                                                                 'requirement', e.requirement)
                                              || jsonb_strip_nulls(jsonb_build_object('condition', e.condition))
                                              order by e.seq)
                             from journey_events e where e.journey_id = j.id and e.leg = 'outbound'), '[]'::jsonb))
        || jsonb_strip_nulls(jsonb_build_object('returnEvents', (
             select jsonb_agg(jsonb_build_object('plazaId', e.plaza_id, 'direction', e.direction,
                                                 'requirement', e.requirement)
                              || jsonb_strip_nulls(jsonb_build_object('condition', e.condition))
                              order by e.seq)
             from journey_events e where e.journey_id = j.id and e.leg = 'return')))
        order by j.id)
      from journeys j where j.publication_status = 'published'), '[]'::jsonb),
    'notices', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'severity', n.severity,
                           'showFrom', to_char(n.show_from, 'YYYY-MM-DD'),
                           'showUntil', to_char(n.show_until, 'YYYY-MM-DD'),
                           'sourceIds', to_jsonb(n.source_ids))
        order by n.id)
      from notices n), '[]'::jsonb)
  );
$$;
comment on function public.published_dataset() is
  'Public feed of all published toll data, shaped like the app''s Dataset type.';

-- ---------------------------------------------------------------------------------------
-- Public: report incorrect information. Validated and rate limited.
-- ---------------------------------------------------------------------------------------
create function public.submit_correction(
  p_client_id uuid,
  p_category text,
  p_message text,
  p_plaza_id text default null,
  p_contact_email text default null,
  p_app_version text default null,
  p_dataset_version text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  clean_message text;
begin
  if p_client_id is null then
    raise exception 'client id required' using errcode = 'invalid_parameter_value';
  end if;
  -- strip control characters other than newlines and tabs
  clean_message := btrim(regexp_replace(coalesce(p_message, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));
  if char_length(clean_message) < 10 or char_length(clean_message) > 2000 then
    raise exception 'message must be between 10 and 2000 characters' using errcode = 'invalid_parameter_value';
  end if;
  if p_plaza_id is not null and not exists (select 1 from plazas where id = p_plaza_id and publication_status = 'published') then
    raise exception 'unknown plaza' using errcode = 'invalid_parameter_value';
  end if;
  -- abuse controls: per device and overall
  if (select count(*) from corrections where client_id = p_client_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many reports from this device; please try again later' using errcode = 'P0429';
  end if;
  if (select count(*) from corrections where created_at > now() - interval '1 hour') >= 500 then
    raise exception 'reports are temporarily paused; please try again later' using errcode = 'P0429';
  end if;
  insert into corrections (client_id, plaza_id, category, message, contact_email, app_version, dataset_version)
  values (p_client_id, p_plaza_id, p_category, clean_message, nullif(btrim(p_contact_email), ''),
          left(p_app_version, 40), left(p_dataset_version, 40))
  returning id into new_id;
  return new_id;
end;
$$;
comment on function public.submit_correction is
  'Public endpoint for "report incorrect information". 5 per device per hour, 500 per hour overall.';

-- Retention: resolved reports (including any contact e-mail) are removed after a year.
create function public.purge_resolved_corrections(p_older_than interval default interval '12 months') returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (public.is_publisher() or current_user in ('postgres', 'service_role')) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  delete from corrections
  where status in ('accepted', 'rejected', 'duplicate') and coalesce(resolved_at, created_at) < now() - p_older_than;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Admin workflow
-- ---------------------------------------------------------------------------------------

-- Publish a draft tariff. Closes the open-ended predecessor (same plaza/class/direction) the
-- day before, so publishing an announced future tariff never leaves an overlap, and withdraws
-- the record a correction supersedes.
create function public.publish_tariff(p_id text, p_close_previous boolean default true) returns public.tariffs
language plpgsql security invoker set search_path = public as $$
declare
  t public.tariffs;
begin
  if not public.is_publisher() then
    raise exception 'only publishers can publish tariffs' using errcode = 'insufficient_privilege';
  end if;
  select * into t from public.tariffs where id = p_id for update;
  if not found then raise exception 'tariff % not found', p_id; end if;
  if t.publication_status <> 'draft' then
    raise exception 'tariff % is %, not draft', p_id, t.publication_status using errcode = 'check_violation';
  end if;

  if t.supersedes_id is not null then
    update public.tariffs
       set publication_status = 'withdrawn',
           notes = concat_ws(' ', notes, format('Withdrawn %s: superseded by %s.', current_date, t.id))
     where id = t.supersedes_id and publication_status = 'published';
  end if;

  if p_close_previous then
    update public.tariffs o
       set effective_to = t.effective_from - 1
     where o.publication_status = 'published'
       and o.plaza_id = t.plaza_id
       and o.vehicle_class_id = t.vehicle_class_id
       and o.direction = t.direction
       and o.effective_to is null
       and o.effective_from < t.effective_from;
  end if;

  update public.tariffs set publication_status = 'published' where id = p_id returning * into t;
  return t;
end;
$$;

-- Record that a person checked a tariff against its (official) source.
create function public.verify_tariff(p_id text, p_verified_on date default (now() at time zone 'Africa/Johannesburg')::date)
returns public.tariffs
language plpgsql security invoker set search_path = public as $$
declare t public.tariffs;
begin
  if not public.is_publisher() then
    raise exception 'only publishers can verify tariffs' using errcode = 'insufficient_privilege';
  end if;
  update public.tariffs
     set verification_status = 'verified', verified_on = p_verified_on, verified_by = public.current_admin_name(),
         checked_on = greatest(checked_on, p_verified_on)
   where id = p_id
  returning * into t;
  if not found then raise exception 'tariff % not found', p_id; end if;
  return t;
end;
$$;

-- Any admin may flag a tariff (even a published one) for review; this never changes a price.
create function public.flag_tariff_for_review(p_id text, p_note text) returns public.tariffs
language plpgsql security definer set search_path = public as $$
declare t public.tariffs;
begin
  if not public.is_editor() then
    raise exception 'only admins can flag tariffs' using errcode = 'insufficient_privilege';
  end if;
  if char_length(coalesce(p_note, '')) < 5 then
    raise exception 'explain why the tariff needs review' using errcode = 'invalid_parameter_value';
  end if;
  update public.tariffs
     set verification_status = 'pending_review', verified_on = null, verified_by = null,
         notes = concat_ws(' ', notes, format('Flagged %s by %s: %s', current_date, public.current_admin_name(), p_note))
   where id = p_id and publication_status <> 'withdrawn'
  returning * into t;
  if not found then raise exception 'tariff % not found or withdrawn', p_id; end if;
  return t;
end;
$$;

-- Set the last day a published tariff applies (e.g. when an operator announces an end date).
create function public.expire_tariff(p_id text, p_effective_to date) returns public.tariffs
language plpgsql security invoker set search_path = public as $$
declare t public.tariffs;
begin
  if not public.is_publisher() then
    raise exception 'only publishers can expire tariffs' using errcode = 'insufficient_privilege';
  end if;
  update public.tariffs set effective_to = p_effective_to where id = p_id returning * into t;
  if not found then raise exception 'tariff % not found', p_id; end if;
  return t;
end;
$$;

-- Withdraw a published tariff that should never have been published. It stays in history.
create function public.withdraw_tariff(p_id text, p_reason text) returns public.tariffs
language plpgsql security invoker set search_path = public as $$
declare t public.tariffs;
begin
  if not public.is_publisher() then
    raise exception 'only publishers can withdraw tariffs' using errcode = 'insufficient_privilege';
  end if;
  if char_length(coalesce(p_reason, '')) < 5 then
    raise exception 'a reason is required' using errcode = 'invalid_parameter_value';
  end if;
  update public.tariffs
     set publication_status = 'withdrawn',
         notes = concat_ws(' ', notes, format('Withdrawn %s by %s: %s', current_date, public.current_admin_name(), p_reason))
   where id = p_id and publication_status = 'published'
  returning * into t;
  if not found then raise exception 'tariff % is not published', p_id; end if;
  return t;
end;
$$;

-- Prepare a correction to a published tariff as a new draft that supersedes it.
create function public.create_tariff_correction(
  p_id text,
  p_amount_cents integer,
  p_source_id text,
  p_note text,
  p_source_locator text default null
) returns public.tariffs
language plpgsql security invoker set search_path = public as $$
declare
  old public.tariffs;
  t public.tariffs;
  base text;
  n integer := 2;
  new_id text;
begin
  if not public.is_editor() then
    raise exception 'only admins can prepare corrections' using errcode = 'insufficient_privilege';
  end if;
  select * into old from public.tariffs where id = p_id;
  if not found or old.publication_status <> 'published' then
    raise exception 'tariff % is not published', p_id;
  end if;
  base := regexp_replace(old.id, '-r[0-9]+$', '');
  loop
    new_id := base || '-r' || n;
    exit when not exists (select 1 from public.tariffs where id = new_id);
    n := n + 1;
  end loop;
  insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, currency, vat_inclusive,
                              charging_basis, direction, condition, effective_from, effective_to, schedule_id,
                              source_id, source_locator, checked_on, verification_status, publication_status,
                              notes, supersedes_id)
  values (new_id, old.plaza_id, old.vehicle_class_id, old.class_scheme_id, p_amount_cents, old.currency,
          old.vat_inclusive, old.charging_basis, old.direction, old.condition, old.effective_from, old.effective_to,
          old.schedule_id, p_source_id, p_source_locator, (now() at time zone 'Africa/Johannesburg')::date,
          'unverified', 'draft', format('Correction of %s: %s', old.id, p_note), old.id)
  returning * into t;
  return t;
end;
$$;

-- Public may call the feed and the correction endpoint only.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.published_dataset() to anon, authenticated;
grant execute on function public.submit_correction(uuid, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.is_editor(), public.is_publisher(), public.current_admin_name() to anon, authenticated;
grant execute on function public.publish_tariff(text, boolean), public.verify_tariff(text, date),
  public.flag_tariff_for_review(text, text), public.expire_tariff(text, date), public.withdraw_tariff(text, text),
  public.create_tariff_correction(text, integer, text, text, text), public.purge_resolved_corrections(interval)
  to authenticated;
