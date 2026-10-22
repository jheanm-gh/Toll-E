-- Verifying a journey's plaza sequence from the SQL editor (postgres role).
\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', label; end if;
  raise notice 'ok: %', label;
end;
$$;

begin;
select pg_temp.check(public.verify_journey('jhb-dbn-n3', 'Route Checker', '2026-10-22') = 1, 'verify_journey marks the journey');
select pg_temp.check(
  (select sequence_status = 'verified' and sequence_verified_by = 'Route Checker' and sequence_verified_on = '2026-10-22'
     from public.journeys where id = 'jhb-dbn-n3'),
  'verifier and date recorded');
select pg_temp.check(public.published_dataset()::text like '%"sequenceVerifiedBy": "Route Checker"%', 'the public feed carries the verification');
select pg_temp.check(
  (select changed_by_email from public.audit_log where table_name = 'journeys' and record_id = 'jhb-dbn-n3' order by id desc limit 1) = 'Route Checker',
  'audit log names the checker');

do $$ begin
  perform public.verify_journey('jhb-dbn-n3', 'X');
  raise exception 'FAILED: accepted a one-letter name';
exception when invalid_parameter_value then raise notice 'ok (rejected): name too short';
end $$;

do $$ begin
  perform public.verify_journey('no-such-journey', 'Route Checker');
  raise exception 'FAILED: accepted an unknown journey';
exception when no_data_found then raise notice 'ok (rejected): unknown journey';
end $$;
rollback;

set role anon;
do $$ begin
  perform public.verify_journey('jhb-dbn-n3', 'Anon User');
  raise exception 'FAILED: anon could call verify_journey';
exception when insufficient_privilege then raise notice 'ok (rejected): anon calling verify_journey';
end $$;
reset role;
