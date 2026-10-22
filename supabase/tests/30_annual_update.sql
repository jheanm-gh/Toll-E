-- The annual (1 March) tariff update as a non-developer would run it in the SQL editor:
-- load drafts, review, verify, publish. Run as the SQL editor's role (postgres).
\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', label; end if;
  raise notice 'ok: %', label;
end;
$$;

\i :drill_sql
select pg_temp.check((select count(*) from public.tariffs where schedule_id = 'sanral-2027-drill' and publication_status = 'draft') = 4, 'update loads as 4 drafts');
select pg_temp.check(not (public.published_dataset()::text like '%sanral-2027-drill-n1-%'), 'draft tariffs are not in the public feed');
select pg_temp.check((select count(*) from public.schedule_review where schedule_id = 'sanral-2027-drill' and previous_amount_cents is not null) = 4, 'review view shows the previous amounts');
select pg_temp.check((select max(abs(change_percent)) from public.schedule_review where schedule_id = 'sanral-2027-drill') between 2.9 and 3.1, 'review view shows about 3% change');

-- running the same file again is harmless
\i :drill_sql
select pg_temp.check((select count(*) from public.tariffs where schedule_id = 'sanral-2027-drill') = 4, 'loading twice does not duplicate');

select pg_temp.check(public.verify_schedule('sanral-2027-drill', 'Drill Reviewer') = 4, 'verify_schedule marks 4 rows');
select pg_temp.check((select bool_and(verified_by = 'Drill Reviewer') from public.tariffs where schedule_id = 'sanral-2027-drill'), 'verifier recorded');
select pg_temp.check(public.publish_schedule('sanral-2027-drill', 'Drill Publisher') = 4, 'publish_schedule publishes 4 rows');
select pg_temp.check(
  (select bool_and(effective_to = '2027-02-28') from public.tariffs where schedule_id = 'sanral-2026' and plaza_id = 'n1-verkeerdevlei'),
  '2026 tariffs closed on 28 February 2027');
select pg_temp.check((public.published_dataset()::text like '%sanral-2027-drill-n1-verkeerdevlei-class4%'), 'new tariffs are in the public feed');
select pg_temp.check(
  (select changed_by_email from public.audit_log where record_id = 'sanral-2027-drill-n1-verkeerdevlei-class1' and 'publication_status' = any (changed_fields) order by id desc limit 1) = 'Drill Publisher',
  'audit log names the publisher');

-- re-running after publishing never changes published rows
\i :drill_sql
select pg_temp.check((select count(*) from public.tariffs where schedule_id = 'sanral-2027-drill' and publication_status = 'published') = 4, 're-running the file leaves published rows untouched');

-- outsiders cannot use the dashboard helpers
set role anon;
do $$ begin
  perform public.publish_schedule('sanral-2027-drill', 'Anon');
  raise exception 'FAILED: anon could call publish_schedule';
exception when insufficient_privilege then raise notice 'ok (rejected): anon calling publish_schedule';
end $$;
reset role;
