-- Access control: what the public (anon) and each admin role may do.
\set ON_ERROR_STOP on
set client_min_messages = notice;

-- Test admins
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'editor@example.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'publisher@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'someone@example.test')
on conflict do nothing;
insert into public.admin_users (user_id, email, display_name, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'editor@example.test', 'Test Editor', 'editor'),
  ('00000000-0000-0000-0000-0000000000a1', 'publisher@example.test', 'Test Publisher', 'publisher');

-- A draft plaza and a draft tariff that the public must not see
insert into public.plazas (id, name, toll_road_id, operator_id, route, type, class_scheme_id, source_ids, publication_status)
values ('test-draft-plaza', 'Draft Plaza', 'sanral-n1-south', 'sanral', 'N1', 'mainline', 'za-standard', array['sanral-tariffs-2026-poster'], 'draft');
insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, effective_from, schedule_id, source_id, checked_on)
values ('test-draft-tariff', 'n1-vaal', 'class1', 'za-standard', 99900, '2027-03-01', 'sanral-2026', 'sanral-tariffs-2026-poster', '2026-10-21');

create or replace function pg_temp.expect_error(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok (rejected): %', label;
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

-- ---------------------------------------------------------------- anon
set role anon;
reset request.jwt.claim.sub;
select pg_temp.check((select count(*) from public.plazas where id = 'test-draft-plaza') = 0, 'anon cannot see draft plazas');
select pg_temp.check((select count(*) from public.tariffs where id = 'test-draft-tariff') = 0, 'anon cannot see draft tariffs');
select pg_temp.check((select count(*) from public.plazas) > 50, 'anon can read published plazas');
select pg_temp.check((select count(*) from public.tariffs where plaza_id = 'n1-vaal') >= 8, 'anon can read published tariffs');
select pg_temp.check((select count(*) from public.corrections) = 0, 'anon cannot read corrections');
select pg_temp.check((select count(*) from public.audit_log) = 0, 'anon cannot read the audit log');
select pg_temp.check((select count(*) from public.admin_users) = 0, 'anon cannot read admin users');
select pg_temp.check(jsonb_array_length(public.published_dataset() -> 'plazas') > 50, 'anon can call published_dataset');
select pg_temp.check(not (public.published_dataset()::text like '%test-draft%'), 'published_dataset excludes drafts');
-- RLS hides rows from anon updates rather than raising, so check the row is unchanged.
update public.tariffs set amount_cents = 1 where id = 'sanral-2026-n1-vaal-class1';
reset role;
select pg_temp.check((select amount_cents from public.tariffs where id = 'sanral-2026-n1-vaal-class1') = 9150, 'anon update had no effect');
set role anon;
select pg_temp.expect_error($$insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, effective_from, schedule_id, source_id, checked_on)
  values ('anon-tariff', 'n1-vaal', 'class1', 'za-standard', 100, '2030-01-01', 'sanral-2026', 'sanral-tariffs-2026-poster', '2026-10-21')$$, 'anon inserting a tariff');
select pg_temp.expect_error($$insert into public.corrections (client_id, category, message) values (gen_random_uuid(), 'other', 'direct insert attempt')$$, 'anon inserting corrections directly');
select pg_temp.expect_error($$select public.publish_tariff('test-draft-tariff')$$, 'anon publishing');
select pg_temp.expect_error($$delete from public.audit_log$$, 'anon deleting audit log');

-- corrections via the RPC, with validation and rate limiting
select pg_temp.check(public.submit_correction('11111111-1111-1111-1111-111111111111', 'tariff', 'Vaal class 1 shows the wrong amount', 'n1-vaal') is not null, 'anon can submit a correction');
select pg_temp.expect_error($$select public.submit_correction('11111111-1111-1111-1111-111111111111', 'tariff', 'short')$$, 'too-short correction');
select pg_temp.expect_error($$select public.submit_correction('11111111-1111-1111-1111-111111111111', 'nonsense', 'A long enough message here')$$, 'invalid category');
select pg_temp.expect_error($$select public.submit_correction('11111111-1111-1111-1111-111111111111', 'tariff', 'A long enough message here', 'no-such-plaza')$$, 'unknown plaza');
select public.submit_correction('11111111-1111-1111-1111-111111111111', 'other', 'Report number ' || g) from generate_series(2, 5) g;
select pg_temp.expect_error($$select public.submit_correction('11111111-1111-1111-1111-111111111111', 'other', 'Sixth report in an hour')$$, 'per-device rate limit');
select pg_temp.check(public.submit_correction('22222222-2222-2222-2222-222222222222', 'other', 'Another device is not limited') is not null, 'other devices unaffected');

-- ---------------------------------------------------------------- authenticated non-admin
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.check((select count(*) from public.tariffs where id = 'test-draft-tariff') = 0, 'signed-in non-admin cannot see drafts');
select pg_temp.expect_error($$insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, effective_from, schedule_id, source_id, checked_on)
  values ('user-tariff', 'n1-vaal', 'class1', 'za-standard', 100, '2030-01-01', 'sanral-2026', 'sanral-tariffs-2026-poster', '2026-10-21')$$, 'non-admin inserting a tariff');
select pg_temp.check((select count(*) from public.corrections) = 0, 'non-admin cannot read corrections');

-- ---------------------------------------------------------------- editor
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set request.jwt.claims = '{"email": "editor@example.test"}';
select pg_temp.check((select count(*) from public.tariffs where id = 'test-draft-tariff') = 1, 'editor sees drafts');
select pg_temp.check((select count(*) from public.corrections) = 6, 'editor reads corrections');
insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, effective_from, schedule_id, source_id, checked_on)
values ('editor-draft', 'n1-kranskop', 'class2', 'za-standard', 15700, '2026-03-01', 'sanral-2026', 'sanral-tariffs-2026-poster', '2026-10-21');
select pg_temp.check((select publication_status from public.tariffs where id = 'editor-draft') = 'draft', 'editor can create a draft tariff');
select pg_temp.expect_error($$insert into public.tariffs (id, plaza_id, vehicle_class_id, class_scheme_id, amount_cents, effective_from, schedule_id, source_id, checked_on, publication_status)
  values ('editor-published', 'n1-vaal', 'class3', 'za-standard', 100, '2030-01-01', 'sanral-2026', 'sanral-tariffs-2026-poster', '2026-10-21', 'published')$$, 'editor inserting a published tariff');
select pg_temp.expect_error($$update public.tariffs set publication_status = 'published' where id = 'editor-draft'$$, 'editor publishing by update');
select pg_temp.expect_error($$select public.publish_tariff('editor-draft')$$, 'editor calling publish_tariff');
select pg_temp.expect_error($$select public.verify_tariff('sanral-2026-n1-vaal-class1')$$, 'editor verifying');
select pg_temp.check((public.flag_tariff_for_review('sanral-2026-n1-vaal-class4', 'Check against the gazette')).verification_status = 'pending_review', 'editor can flag a published tariff for review');
select pg_temp.check((select count(*) from public.audit_log) > 0, 'editor can read the audit log');
update public.corrections set status = 'triaged', admin_notes = 'Looking into it' where message like 'Vaal class 1%';
select pg_temp.check((select count(*) from public.audit_log where table_name = 'corrections') = 1, 'correction triage is audited');
reset role;
reset request.jwt.claim.sub;
reset request.jwt.claims;
