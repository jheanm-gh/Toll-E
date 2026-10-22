-- Prints the public feed after using every SQL-editor helper. scripts/db-test.sh runs this last,
-- on its throwaway database, and checks the output with the app's own validator, so dashboard
-- edits can never produce a feed the app rejects.
\set ON_ERROR_STOP on
\o /dev/null
\i :drill_sql
\o
do $$ begin
  perform public.correct_tariff('sanral-2026-n1-vaal-class1', 92.00, 'sanral-tariffs-2026-poster', 'Data Checker',
                                'Gazette shows R92.00', true);
  perform public.correct_tariff('sanral-2026-n1-vaal-class1-c1', 92.50, 'sanral-tariffs-2026-poster', 'Data Checker',
                                'Second look at the Gazette');
  perform public.verify_journey('jhb-dbn-n3', 'Route Checker');
  perform public.verify_schedule('sanral-2027-drill', 'Drill Reviewer');
  perform public.publish_schedule('sanral-2027-drill', 'Drill Publisher');
end $$;
set role anon;
select public.published_dataset();
