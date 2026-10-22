# Setting up the Supabase backend

Supabase holds the published toll data that phones download, plus the correction reports users send. The app
works without it, on the data built into each release, but then the 1 March change would need an app update.
Supabase is what lets prices change without one.

**Not yet done:** no Supabase project has been created for Toll-E. The schema, security rules and update
procedures have been tested on a local PostgreSQL 16 database with Supabase stand-ins (`npm run test:db`), not
on a real Supabase project.

## 1. Create the project

1. Sign in at [supabase.com](https://supabase.com/dashboard) and click **New project**.
2. Name: `toll-e`. Database password: generate one and store it in a password manager. It is never put in the
   app or the repository.
3. Region: the one closest to South Africa that is offered.
4. Plan: Free is enough to start. Check Supabase's current free-plan terms. Free projects can be **paused after
   a period of inactivity**. If that happens, phones keep using their saved copy of the data, and you restore the
   project from the dashboard.

## 2. Create the tables and load the data

In **SQL Editor → New query**, paste and run each file from `supabase/migrations/`, one at a time, **in name
order**:

1. `20261021000000_initial_schema.sql`
2. `20261021000100_functions.sql`
3. `20261021000200_release_workflow.sql`
4. `20261022000000_verify_journey.sql`
5. `20261022000100_correct_tariff.sql`

Each should end with `Success. No rows returned`. Then load the data: paste and run `supabase/seed.sql`
(about 140 KB; regenerate it first with `npm run data:build` if `data/` has changed). If the editor rejects a
file of that size, run it with `psql` and the connection string from **Connect** (top of the dashboard):

```
psql "postgresql://postgres:…@…/postgres" -f supabase/seed.sql
```

Do **not** run anything from `supabase/tests/`: those files are for the local test database only.

Alternatively, a developer can use the Supabase CLI (`npx supabase@latest link` then `db push`) for the migrations.

## 3. Check it

In the SQL Editor:

```sql
select jsonb_array_length(public.published_dataset() -> 'tariffs') as tariffs,
       jsonb_array_length(public.published_dataset() -> 'plazas')  as plazas;
```

This should match `npm run data:validate` (published records only).

## 4. Connect the app

**Project settings → API keys**: copy the project URL and the **public** key (the legacy `anon` key or a
`sb_publishable_…` key; the app supports both). Put them in the EAS environment variables
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see [android-release.md](android-release.md)).

**Never** use the `service_role` or secret key in the app, in EAS variables, or in the repository. The public key
can only do what the row-level security rules allow:

- read published toll data, through `published_dataset()` and the published rows;
- submit a correction report, rate-limited per device and unable to read anyone's reports.

Everything else (loading, verifying, correcting and publishing tariffs) happens in the SQL Editor as the project
owner, by the procedures in [`../data-operations.md`](../data-operations.md). Each action is recorded in
`public.audit_log` with the person's name.

## 5. Reading correction reports

```sql
select created_at, category, plaza_id, message, contact_email, status
from public.corrections
order by created_at desc;
```

When you have dealt with one, set its status to `accepted` (the data was fixed), `rejected` or `duplicate`:

```sql
update public.corrections set status = 'accepted', resolved_at = now(), admin_notes = 'Fixed in sanral-2026' where id = '…';
```

The privacy policy promises that resolved reports, including any email address, are deleted within 12 months.
Once a quarter, run:

```sql
select public.purge_resolved_corrections();
```

It returns how many old resolved reports it deleted.

## Backups

The master copy of all toll data is in `data/` in GitHub, so the database can always be rebuilt with steps 2–3.
Correction reports and the audit log exist only in Supabase. The free plan's backup options are limited, so
export them now and then from **Table editor → … → Export to CSV**.
