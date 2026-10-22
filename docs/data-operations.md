# Updating toll data — a step-by-step guide

This guide is for the person who keeps Toll-E's prices correct. You do not need to be a developer. You will copy
and paste a few commands and click through the Supabase website. Every step tells you what you should see.

**The most important thing:** the 1 March price change does **not** need a new app release. You load next year's
prices into Supabase before 1 March and publish them. Phones download them within six hours. The app shows them as
"upcoming" until the date arrives, then switches over automatically.

## How the data flows

```
data/ files in GitHub  ──(checked by the scripts)──▶  SQL file  ──(pasted into Supabase)──▶  Supabase database
        │                                                                                          │
        └──▶ built into the next app release (offline fallback)              phones download it ◀──┘
                                                                              every 6 hours when online
```

- **The files in `data/` are the master copy.** Every change starts there, so there is a reviewed history in GitHub.
- **Supabase is what phones read.** A change reaches users only once it is in Supabase and published.
- Nothing you load is visible in the app until you run the **publish** step.

## What you need (one-time)

1. **Access to the GitHub repository** `jheanm-gh/Toll-E` with permission to push.
2. **A Codespace**, which is a ready-made workspace that runs in your browser, so you install nothing. On the repository page, click
   **Code → Codespaces → Create codespace on main**. It opens an editor with a **Terminal** panel at the bottom.
   The first time, type this in the terminal and press Enter:

   ```
   npm ci
   ```

   You should see `added … packages`. (Codespaces has a monthly free allowance; stop the codespace when you
   finish: **Code → Codespaces → … → Stop codespace**.)

3. **A login to the Toll-E project at [supabase.com](https://supabase.com/dashboard)**. You will use the
   **SQL Editor** (left-hand menu).
4. **The official documents**:
   - the Government Gazette notice for the year's tariffs, and/or SANRAL's tariff booklet or poster;
   - the operator pages: [N3TC](https://www.n3tc.co.za/), [TRAC](https://tracn4.co.za/toll-plazas-toll-fees/),
     [Bakwena](https://www.bakwena.co.za/tolls-and-tariffs/).

   Save a PDF or screenshot of each one. Only official documents can be used to mark a price **verified**.

Throughout this guide, replace `Full Name` with your own full name. It is recorded next to every change.

## The tariff schedules

Prices are grouped into **schedules**, one per operator per year:

| Operator | This year's schedule | Changes on | Next year's schedule (example) |
| --- | --- | --- | --- |
| SANRAL (N1, N2, N3 Mariannhill, N4, N17 …) | `sanral-2026` | 1 March | `sanral-2027` |
| N3 Toll Concession (N3) | `n3tc-2026` | 1 March | `n3tc-2027` |
| TRAC (N4 east) | `trac-2026` | 1 March | `trac-2027` |
| Bakwena (N1 north, N4 west) | `bakwena-2026` | 1 March | `bakwena-2027` |
| Chapman's Peak Drive | `chapmans-peak-2026` | 1 July | `chapmans-peak-2027` |

---

## Procedure A — the annual price change (do this in February)

SANRAL's new tariffs are normally gazetted in early February. Allow two evenings, and finish before 1 March.

### A1. Record the official document as a source

Open `data/sources.json` in the Codespace editor. Add an entry at the end of the list (mind the commas between
entries):

```json
{
  "id": "gazette-2027-sanral-tariffs",
  "title": "Toll tariffs from 1 March 2027",
  "publisher": "Government Gazette",
  "url": "https://… link to the notice …",
  "kind": "government_gazette",
  "official": true,
  "publishedOn": "2027-02-05",
  "retrievedOn": "2027-02-10",
  "reference": "Government Gazette No. …, Notice …"
}
```

`kind` is one of `government_gazette`, `agency_publication` (SANRAL), `operator_publication`, `operator_website`
(these count as official), or `news` / `secondary_compilation` (never official). Add one source per document.

### A2. Create next year's price sheet

In the terminal (one line per operator, changing the names and dates):

```
npm run data:next-year -- --from sanral-2026 --to sanral-2027 --effective 2027-03-01 --source gazette-2027-sanral-tariffs
```

You should see `Created …/data/tariffs/sanral-2027.csv with … rows to fill in`. The script also adds the
schedule to `data/schedules.json`. Open that file and check the new entry's name. If the Gazette states the
percentage increase, set `"adjustmentBps"` to the percentage × 100 (for example, 4.2% becomes `420`). The checks
then flag any price that does not match it.

### A3. Fill in the new prices

Open `data/tariffs/sanral-2027.csv` in the Codespace editor. Each row is one plaza and one vehicle class. For
every row:

- type the new price in rand in the **`amount`** column, e.g. `96.50` (no "R", no spaces);
- `previous_amount` shows last year's price **for reference only**; it is ignored;
- leave the other columns as they are.

> Do not open the CSV in Excel: it can silently change dates and numbers. Use the Codespace editor, or Google
> Sheets/LibreOffice with every column formatted as text.

### A4. Check your work

```
npm run data:validate
```

- `Data validation passed.` means everything is consistent.
- Lines starting with `✖` are errors (for example `empty amount` means you missed a row). Fix them and run it
  again.
- `suspicious_change` warnings mean a price moved much more or less than the published percentage. Re-check those
  rows against the document. They are often typing mistakes.

### A5. Mark the prices verified (only after comparing every value)

When you have compared **every** amount with the official document:

```
npm run data:verify -- --by "Full Name" --against gazette-2027-sanral-tariffs --schedule sanral-2027
```

If one value in the file is wrong, correct it while verifying, using the tariff id printed by the script:

```
npm run data:verify -- --by "Full Name" --against gazette-2027-sanral-tariffs --schedule sanral-2027 --correct sanral-2027-n1-vaal-class1=96.50
```

Add `--dry-run` first if you want to see what would change without saving anything.

### A6. Rebuild and save to GitHub

```
npm run data:build
git add data docs apps/mobile/src/data/generated supabase/seed.sql
git commit -m "Tariffs from 1 March 2027 (SANRAL)"
git push
```

(`data:build` refreshes the copy built into the next app release and the coverage register.)

### A7. Make the SQL file for Supabase

```
npm run data:supabase-sql -- --schedule sanral-2027
```

This writes `imports/sanral-2027.sql`. Open it in the Codespace editor, select everything (Ctrl+A / Cmd+A) and copy it.

### A8. Load the prices into Supabase as drafts

1. In Supabase, open **SQL Editor → New query**.
2. Paste the file and click **Run**. You should see `Success. No rows returned`.
3. Nothing changes in the app yet: the prices are **drafts**. Running the same file twice is safe.

### A9. Review the drafts

In a new query, run:

```sql
select plaza_name, vehicle_class_id, previous_amount_cents / 100.0 as previous_rand,
       new_amount_cents / 100.0 as new_rand, change_percent, verification_status
from public.schedule_review
where schedule_id = 'sanral-2027'
order by change_percent desc nulls first;
```

Read down the list. Most rows should change by roughly the published percentage. Rows at the top or bottom, or
rows with no previous price, deserve a second look. If something is wrong, fix the CSV (step A3), then repeat
steps A4–A8. Loading the file again updates the drafts.

If you did not run step A5 but have now checked every value, you can mark them verified here instead:

```sql
select public.verify_schedule('sanral-2027', 'Full Name');
```

It returns the number of rows marked.

### A10. Publish

```sql
select public.publish_schedule('sanral-2027', 'Full Name');
```

It returns the number of prices published. Publishing also sets the end date of the old prices to the day
before (28 February). From now on:

- phones that go online download the new prices within six hours (users can also pull down on Home, or tap
  **More → Check for updates**);
- the app shows the new prices as **upcoming** until 1 March, then uses them automatically.

Repeat A1–A10 for each operator (N3TC, TRAC and Bakwena usually publish later in February than SANRAL).

### A11. Check in the app

Open Toll-E on a phone, go to **More → Check for updates**, open a plaza from the updated schedule and confirm
that the new price appears under "upcoming" with the right date.

---

## Procedure B — correcting one wrong price

Use this when a published price turns out to be wrong (for example after a user report). Published prices are
never edited in place: the wrong one is withdrawn and a corrected copy is published, and both are kept in the
audit log.

1. **Fix the master copy.** In the Codespace, correct the amount while verifying it against the official document:

   ```
   npm run data:verify -- --by "Full Name" --against <official-source-id> --ids sanral-2026-n1-vaal-class1 --correct sanral-2026-n1-vaal-class1=92.00
   npm run data:validate
   npm run data:build
   git add data docs apps/mobile/src/data/generated supabase/seed.sql && git commit -m "Correct Vaal Class 1" && git push
   ```

2. **Fix Supabase.** In the SQL Editor:

   ```sql
   select public.correct_tariff(
     'sanral-2026-n1-vaal-class1',   -- the tariff id
     92.00,                          -- correct amount in rand
     'sanral-tariffs-2026-poster',   -- id of the source you checked
     'Full Name',
     'Gazette shows R92.00, not R91.50',  -- why
     true                            -- true only if the source is official and you checked it yourself
   );
   ```

   It returns the id of the corrected price (for example `sanral-2026-n1-vaal-class1-c1`). Phones pick it up on
   their next refresh.

To find a tariff id, look in the CSV or run
`select id, amount_cents / 100.0 as rand from public.tariffs where plaza_id = 'n1-vaal' and publication_status = 'published';`.

## Procedure C — confirming a route's plaza sequence

Production builds of the app only show a popular route (for example Johannesburg → Durban) once someone has
confirmed that its list of toll plazas is correct and complete. Use the operator's route map or drive the route.
The plazas in each route are listed in `docs/verification/worksheet.md`.

1. Master copy: `npm run data:verify -- --by "Full Name" --journey jhb-dbn-n3`, then `npm run data:build`, commit and push.
2. Supabase: `select public.verify_journey('jhb-dbn-n3', 'Full Name');`

The route appears in the app on its next data refresh.

## Procedure D — verifying today's prices for the first time

None of the current 2026 prices has been verified by a person yet. See
[`docs/verification/README.md`](verification/README.md) for the checklist and worksheet.

## If something goes wrong

| Problem | What to do |
| --- | --- |
| `✖ Fix the data errors first` | Run `npm run data:validate` and fix the lines it lists. |
| Supabase says `not allowed` | You are not signed in as a project owner, or you are using the API instead of the SQL Editor. |
| Supabase says `… overlaps another published tariff` | A price for the same plaza, class and dates is already published. Check the dates in the CSV. |
| Supabase says `… can only be verified against an official source` | The source you named has `"official": false`. Use the Gazette or operator source. |
| You published the wrong schedule | Do not delete anything. Use `correct_tariff` for each wrong row (Procedure B), or ask a developer. |
| The app does not show new prices | The phone may be offline. The data line in **More** shows when it last downloaded. |

## Where the safeguards are

- The scripts refuse to build if any check fails, and flag prices that do not match the published percentage.
- The database rejects overlapping prices, edits to published prices, deletion of published prices, and
  "verified" status without an official source. Every change is written to `public.audit_log` with your name.
- The app validates everything it downloads. If the data were ever broken, phones would keep the last good copy.
- These procedures are rehearsed automatically on every test run (`supabase/tests/30_annual_update.sql`,
  `40_verify_journey.sql`, `50_correct_tariff.sql`).
