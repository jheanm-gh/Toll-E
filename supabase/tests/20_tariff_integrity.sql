-- Tariff integrity and the publication workflow, exercised as a publisher.
\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function pg_temp.expect_error(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok (rejected): % — %', label, sqlerrm;
    return;
  end;
  raise exception 'FAILED: expected an error for %', label;
end;
$$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', label; end if;
  raise notice 'ok: %', label;
end;
$$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set request.jwt.claims = '{"email": "publisher@example.test"}';

-- ---- constraints
select pg_temp.expect_error($$insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, effective_from, schedule_id, source_id, checked_on)
  values ('bad-amount', 'n1-vaal', 'class1', 'za-standard', 0, '2030-01-01', 'sanral-2026', 'sanral-tariffs-2026-poster', '2026-10-21')$$, 'zero amount');
select pg_temp.expect_error($$insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, effective_from, effective_to, schedule_id, source_id, checked_on)
  values ('bad-range', 'n1-vaal', 'class1', 'za-standard', 100, '2030-01-01', '2029-01-01', 'sanral-2026', 'sanral-tariffs-2026-poster', '2026-10-21')$$, 'end before start');
select pg_temp.expect_error($$insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, effective_from, schedule_id, source_id, checked_on)
  values ('bad-class', 'm6-chapmans-peak', 'class3', 'za-standard', 100, '2030-01-01', 'chapmans-peak-2026', 'chapmans-peak-gazette-2026', '2026-10-21')$$, 'class not in the plaza''s scheme');
select pg_temp.expect_error($$insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, effective_from, schedule_id, source_id, checked_on)
  values ('Bad Id', 'n1-vaal', 'class1', 'za-standard', 100, '2030-01-01', 'sanral-2026', 'sanral-tariffs-2026-poster', '2026-10-21')$$, 'non-slug id');
select pg_temp.expect_error($$insert into public.plazas (id, name, toll_road_id, operator_id, route, class_scheme_id, source_ids, lat, lng, location_precision, location_source_ids)
  values ('plaza-in-london', 'London', 'sanral-n1-south', 'sanral', 'N1', 'za-standard', array['sanral-tariffs-2026-poster'], 51.5, -0.12, 'approximate', array['wikipedia-n1'])$$, 'plaza outside South Africa');
select pg_temp.expect_error($$insert into public.plazas (id, name, toll_road_id, operator_id, route, class_scheme_id, source_ids)
  values ('plaza-no-source', 'No Source', 'sanral-n1-south', 'sanral', 'N1', 'za-standard', '{}')$$, 'plaza without a source');

-- ---- overlap prevention
select pg_temp.expect_error($$insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, effective_from, schedule_id, source_id, checked_on, publication_status)
  values ('overlap-same', 'n1-vaal', 'class1', 'za-standard', 9200, '2026-06-01', 'sanral-2026', 'sanral-tariffs-2026-poster', '2026-10-21', 'published')$$, 'overlapping published tariff');
select pg_temp.expect_error($$insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, direction, effective_from, schedule_id, source_id, checked_on, publication_status)
  values ('overlap-direction', 'n1-vaal', 'class1', 'za-standard', 9200, 'northbound', '2026-06-01', 'sanral-2026', 'sanral-tariffs-2026-poster', '2026-10-21', 'published')$$, 'direction-specific tariff overlapping an any-direction one');

-- ---- immutability and history
select pg_temp.expect_error($$update public.tariffs set amount_cents = 9999 where id = 'sanral-2026-n1-vaal-class1'$$, 'changing a published price');
select pg_temp.expect_error($$update public.tariffs set effective_from = '2026-04-01' where id = 'sanral-2026-n1-vaal-class1'$$, 'changing a published start date');
select pg_temp.expect_error($$update public.tariffs set publication_status = 'draft' where id = 'sanral-2026-n1-vaal-class1'$$, 'unpublishing to draft');
-- RLS hides published rows from deletes, so the statements affect nothing...
delete from public.tariffs where id = 'sanral-2025-n1-vaal-class1';
delete from public.plazas where id = 'n1-vaal';
select pg_temp.check((select count(*) from public.tariffs where id = 'sanral-2025-n1-vaal-class1') = 1, 'publisher cannot delete an expired (published) tariff');
select pg_temp.check((select count(*) from public.plazas where id = 'n1-vaal') = 1, 'publisher cannot delete a published plaza');
-- ...and the triggers stop privileged roles (service role / SQL editor) too.
reset role;
select pg_temp.expect_error($$delete from public.tariffs where id = 'sanral-2025-n1-vaal-class1'$$, 'service role deleting a published tariff');
select pg_temp.expect_error($$delete from public.plazas where id = 'n1-vaal'$$, 'service role deleting a published plaza');
-- A draft that cites a secondary (non-official) source, for the verification checks below.
insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, effective_from, schedule_id, source_id, checked_on, publication_status)
values ('test-secondary-n1-kranskop-class1', 'n1-kranskop', 'class1', 'za-standard', 6150, '2027-03-01', 'sanral-2026', 'foresight-n3-2026', '2026-10-21', 'draft');
set role authenticated;

-- ---- verification needs an official source and a named verifier
select pg_temp.expect_error($$select public.verify_tariff('test-secondary-n1-kranskop-class1')$$, 'verifying against a secondary source');
select pg_temp.check((public.verify_tariff('sanral-2026-n1-vaal-class2', '2026-10-21')).verified_by = 'Test Publisher', 'publisher verifies against the official poster');
select pg_temp.check((select verification_status from public.tariffs where id = 'sanral-2026-n1-vaal-class2') = 'verified', 'verification recorded');
select pg_temp.expect_error($$update public.tariffs set verification_status = 'verified', verified_on = null where id = 'sanral-2026-n1-vaal-class3'$$, 'verified without a date');

-- ---- publishing an announced future tariff closes the current one the day before
insert into public.tariff_schedules (id, name, operator_ids, effective_from, source_ids)
values ('sanral-2027-test', 'Test 2027', array['sanral'], '2027-03-01', array['sanral-tariffs-2026-poster']);
insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, effective_from, schedule_id, source_id, checked_on)
values ('future-vaal-class1', 'n1-vaal', 'class1', 'za-standard', 9450, '2027-03-01', 'sanral-2027-test', 'sanral-tariffs-2026-poster', '2026-10-21');
select pg_temp.check((public.publish_tariff('future-vaal-class1')).publication_status = 'published', 'future tariff published');
select pg_temp.check((select effective_to from public.tariffs where id = 'sanral-2026-n1-vaal-class1') = '2027-02-28', 'current tariff closed on 28 Feb 2027');
select pg_temp.expect_error($$update public.tariffs set effective_to = '2027-03-31' where id = 'sanral-2026-n1-vaal-class1'$$, 'moving an end date that is already set');
select pg_temp.expect_error($$select public.publish_tariff('future-vaal-class1')$$, 'publishing twice');

-- ---- corrections create a new record and withdraw the old one on publication
select pg_temp.check((public.create_tariff_correction('sanral-2026-n1-grasmere-class4', 12700, 'sanral-tariffs-2026-poster', 'Gazette shows R127')).id = 'sanral-2026-n1-grasmere-class4-r2', 'correction drafted as a revision');
select pg_temp.check((public.publish_tariff('sanral-2026-n1-grasmere-class4-r2')).amount_cents = 12700, 'correction published');
select pg_temp.check((select publication_status from public.tariffs where id = 'sanral-2026-n1-grasmere-class4') = 'withdrawn', 'original withdrawn, not deleted');
select pg_temp.check((select amount_cents from public.tariffs where id = 'sanral-2026-n1-grasmere-class4') = 12600, 'original price preserved for history');
select pg_temp.expect_error($$update public.tariffs set notes = 'x' where id = 'sanral-2026-n1-grasmere-class4'$$, 'editing a withdrawn tariff');
select pg_temp.check(not (public.published_dataset()::text like '%"sanral-2026-n1-grasmere-class4"%'), 'withdrawn tariff left the public feed');

-- ---- withdrawal requires a reason
select pg_temp.expect_error($$select public.withdraw_tariff('sanral-2026-n1-grasmere-class3', '')$$, 'withdrawal without a reason');

-- ---- drafts can be deleted
insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, effective_from, schedule_id, source_id, checked_on)
values ('throwaway-draft', 'n1-vaal', 'class3', 'za-standard', 100, '2030-01-01', 'sanral-2026', 'sanral-tariffs-2026-poster', '2026-10-21');
delete from public.tariffs where id = 'throwaway-draft';
select pg_temp.check((select count(*) from public.tariffs where id = 'throwaway-draft') = 0, 'drafts can be deleted');

-- ---- audit log
select pg_temp.check(
  (select changed_fields from public.audit_log where table_name = 'tariffs' and record_id = 'sanral-2026-n1-vaal-class1' and action = 'UPDATE' order by id desc limit 1) = array['effective_to'],
  'audit log records the changed field');
select pg_temp.check(
  (select changed_by_email from public.audit_log where table_name = 'tariffs' and record_id = 'future-vaal-class1' and action = 'INSERT') = 'publisher@example.test',
  'audit log records who made the change');
select pg_temp.check(
  (select count(*) from public.audit_log where table_name = 'tariffs' and record_id = 'throwaway-draft') = 2,
  'insert and delete of a draft are both audited');

-- ---- dataset version bumps after content changes
select pg_temp.check((select value from public.dataset_meta where key = 'dataset_version') <> '2026-10-21.1', 'dataset version bumped after publishing');

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claims;
