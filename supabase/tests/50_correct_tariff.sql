-- Correcting a published tariff from the SQL editor (postgres role).
\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', label; end if;
  raise notice 'ok: %', label;
end;
$$;

begin;
select pg_temp.check(
  public.correct_tariff('sanral-2026-n1-vaal-class1', 92.00, 'sanral-tariffs-2026-poster', 'Data Checker',
                        'Gazette shows R92.00', true) = 'sanral-2026-n1-vaal-class1-c1',
  'correction returns the new id');
select pg_temp.check(
  (select publication_status = 'withdrawn' from public.tariffs where id = 'sanral-2026-n1-vaal-class1'),
  'the wrong tariff is withdrawn');
select pg_temp.check(
  (select amount_cents = 9200 and verification_status = 'verified' and verified_by = 'Data Checker'
          and supersedes_id = 'sanral-2026-n1-vaal-class1' and publication_status = 'published'
     from public.tariffs where id = 'sanral-2026-n1-vaal-class1-c1'),
  'the correction is published, verified and linked to the old row');
select pg_temp.check(
  public.published_dataset()::text like '%sanral-2026-n1-vaal-class1-c1%'
  and public.published_dataset()::text not like '%"sanral-2026-n1-vaal-class1"%',
  'the feed has the correction and not the withdrawn row');
select pg_temp.check(
  (select changed_by_email from public.audit_log where record_id = 'sanral-2026-n1-vaal-class1' order by id desc limit 1) = 'Data Checker',
  'audit log names the corrector');
select pg_temp.check(
  public.correct_tariff('sanral-2026-n1-vaal-class1-c1', 92.50, 'sanral-tariffs-2026-poster', 'Data Checker',
                        'Second look at the Gazette') = 'sanral-2026-n1-vaal-class1-c2',
  'a correction can itself be corrected');

do $$ begin
  perform public.correct_tariff('sanral-2026-n1-grasmere-class1', 30.00, 'foresight-n3-2026', 'Data Checker', 'Typo fixed', true);
  raise exception 'FAILED: verified against a non-official source';
exception when check_violation then raise notice 'ok (rejected): verified against a non-official source';
end $$;

do $$ begin
  perform public.correct_tariff('sanral-2026-n1-vaal-class1', 92.00, 'sanral-tariffs-2026-poster', 'Data Checker', 'Already withdrawn');
  raise exception 'FAILED: corrected a withdrawn tariff';
exception when no_data_found then raise notice 'ok (rejected): withdrawn tariff';
end $$;

do $$ begin
  perform public.correct_tariff('sanral-2026-n1-grasmere-class1', 30.123, 'sanral-tariffs-2026-poster', 'Data Checker', 'Bad amount');
  raise exception 'FAILED: accepted an amount with three decimals';
exception when invalid_parameter_value then raise notice 'ok (rejected): amount with three decimals';
end $$;
rollback;

set role anon;
do $$ begin
  perform public.correct_tariff('sanral-2026-n1-vaal-class1', 1.00, 'sanral-tariffs-2026-poster', 'Anon User', 'Vandalism');
  raise exception 'FAILED: anon could call correct_tariff';
exception when insufficient_privilege then raise notice 'ok (rejected): anon calling correct_tariff';
end $$;
reset role;
