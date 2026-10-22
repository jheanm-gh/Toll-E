-- Release workflow helpers for running tariff updates from the Supabase SQL editor
-- (see docs/data-operations.md). The SQL editor runs as the `postgres` role, which has no
-- auth.uid(), so these functions take the person's name explicitly and record it.

alter table public.journeys
  add column sequence_verified_on date,
  add column sequence_verified_by text,
  add constraint journeys_verified_has_verifier
    check (sequence_status <> 'verified' or (sequence_verified_on is not null and sequence_verified_by is not null));

-- Who may run the dashboard helpers: publishers (signed in), or the SQL editor / service role.
create function public.can_publish() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_publisher() or current_user in ('postgres', 'supabase_admin', 'service_role');
$$;

-- Record the person's name in the audit log for statements run from the SQL editor.
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  old_j jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_j jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  rec jsonb := coalesce(new_j, old_j);
  rid text := coalesce(rec ->> 'id', concat_ws(':', rec ->> 'journey_id', rec ->> 'leg', rec ->> 'seq'), rec ->> 'user_id');
  fields text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into fields
    from jsonb_object_keys(new_j) k
    where new_j -> k is distinct from old_j -> k and k not in ('updated_at', 'updated_by');
    if fields is null then
      return new;
    end if;
  end if;
  insert into public.audit_log (table_name, record_id, action, changed_by, changed_by_email, changed_fields, old_row, new_row)
  values (tg_table_name, rid, tg_op, auth.uid(),
          coalesce(auth.jwt() ->> 'email', nullif(current_setting('tolle.actor', true), '')),
          fields, old_j, new_j);
  return coalesce(new, old);
end;
$$;

-- Mark every draft or published tariff in a schedule as verified, except listed ids.
-- Use only after checking each value against the official document.
create function public.verify_schedule(
  p_schedule_id text,
  p_verified_by text,
  p_except text[] default '{}',
  p_verified_on date default (now() at time zone 'Africa/Johannesburg')::date
) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.can_publish() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if char_length(coalesce(p_verified_by, '')) < 3 then
    raise exception 'give the full name of the person who checked the values' using errcode = 'invalid_parameter_value';
  end if;
  perform set_config('tolle.actor', p_verified_by, true);
  update public.tariffs
     set verification_status = 'verified', verified_on = p_verified_on, verified_by = p_verified_by,
         checked_on = greatest(checked_on, p_verified_on)
   where schedule_id = p_schedule_id
     and publication_status <> 'withdrawn'
     and verification_status <> 'verified'
     and not (id = any (p_except));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Publish every draft tariff in a schedule (typically next year's, before 1 March). The
-- open-ended tariffs they replace are closed the day before, so the change happens on the
-- effective date without an app update.
create function public.publish_schedule(p_schedule_id text, p_published_by text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  t record;
  n integer := 0;
begin
  if not public.can_publish() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if char_length(coalesce(p_published_by, '')) < 3 then
    raise exception 'give the full name of the person publishing' using errcode = 'invalid_parameter_value';
  end if;
  perform set_config('tolle.actor', p_published_by, true);
  for t in select * from public.tariffs where schedule_id = p_schedule_id and publication_status = 'draft' order by id loop
    update public.tariffs o
       set effective_to = t.effective_from - 1
     where o.publication_status = 'published'
       and o.plaza_id = t.plaza_id
       and o.vehicle_class_id = t.vehicle_class_id
       and o.direction = t.direction
       and o.effective_to is null
       and o.effective_from < t.effective_from;
    update public.tariffs set publication_status = 'published' where id = t.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- What a schedule looks like before publishing: each draft next to the tariff it replaces.
create view public.schedule_review with (security_invoker = true) as
select d.schedule_id, d.id as tariff_id, d.plaza_id, p.name as plaza_name, d.vehicle_class_id,
       d.amount_cents as new_amount_cents, prev.amount_cents as previous_amount_cents,
       case when prev.amount_cents is null then null
            else round(100.0 * (d.amount_cents - prev.amount_cents) / prev.amount_cents, 2) end as change_percent,
       d.effective_from, d.verification_status, d.publication_status, d.source_id
from public.tariffs d
join public.plazas p on p.id = d.plaza_id
left join lateral (
  select o.amount_cents from public.tariffs o
  where o.plaza_id = d.plaza_id and o.vehicle_class_id = d.vehicle_class_id and o.direction = d.direction
    and o.publication_status = 'published' and o.effective_from < d.effective_from and o.id <> d.id
  order by o.effective_from desc limit 1
) prev on true;

revoke all on public.schedule_review from anon;
grant select on public.schedule_review to authenticated;
revoke execute on function public.verify_schedule(text, text, text[], date), public.publish_schedule(text, text),
  public.can_publish() from public, anon, authenticated;

-- The public feed now carries who verified journey sequences.
create or replace function public.published_dataset() returns jsonb
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
        || jsonb_strip_nulls(jsonb_build_object('sequenceVerifiedOn', to_char(j.sequence_verified_on, 'YYYY-MM-DD'),
                                                'sequenceVerifiedBy', j.sequence_verified_by))
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
