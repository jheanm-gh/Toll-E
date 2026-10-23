# Verifying Toll-E's data

**Status on 23 October 2026: every 2026 price matches the official publications, but none is marked verified
yet.** With access to the official sites, Toll-E's data was compared row by row with:

- **SANRAL's 2026 tariff poster** ("New toll tariffs from 1 March 2026"), an official SANRAL publication covering
  every SANRAL, N3TC, TRAC and Bakwena conventional plaza. All 73 rows were read by machine and all 296 prices
  match the data.
- **TRAC's and Bakwena's own tariff pages**, which agree with the poster.
- **The 2025 Government Gazettes** (Nos. 52072 and 52073), for the 2025 history. This found and fixed one error
  (Huguenot Class 3 in 2025).

Two official sources could not be opened: the **2026 Government Gazettes** themselves (Nos. 54087 and 54088,
which gpwonline serves through SharePoint) and the **N3TC website** (certificate problem). The poster says it
"does not replace" the Gazette. That is why the last step is left to a person: compare against the Gazette, or
accept the poster as the official SANRAL publication, and record it under your name.

```
npm run release:check          # summary; add -- --all for every gap
```

On 23 October 2026 it reports **not ready**: 0 of 297 plaza-and-class prices are verified (296 match the poster,
plus Chapman's Peak), no price is missing, and 8 route sequences are unverified. See
[`../release/google-play-checklist.md`](../release/google-play-checklist.md).

## The quickest way to finish

If you accept SANRAL's poster as the official source (it is SANRAL's own publication of the gazetted tariffs),
open it, spot-check it against the data, and record it. One command per schedule:

```
npm run data:verify -- --by "Full Name" --against sanral-tariffs-2026-poster --schedule sanral-2026
npm run data:verify -- --by "Full Name" --against sanral-tariffs-2026-poster --schedule n3tc-2026
npm run data:verify -- --by "Full Name" --against trac-toll-fees --schedule trac-2026
npm run data:verify -- --by "Full Name" --against bakwena-tolls-and-tariffs --schedule bakwena-2026
npm run data:validate && npm run data:build
```

Then commit, push, and run the matching `verify_schedule` calls in Supabase (step 5 below).

## What "verified" means

A person has opened the **official** document (a Government Gazette notice, a SANRAL publication or the
operator's own tariff page) and confirmed the exact amount, vehicle class, plaza and effective date. The data
records who did it and when (`verified_by`, `verified_on`), and the database refuses "verified" for any source
not marked official.

Secondary sources (news articles, motoring sites, fleet-company tables) can corroborate a value but never verify it.

## How to verify (about two evenings for everything)

1. Open [`worksheet.md`](worksheet.md). It lists every price grouped by operator, with the document to check
   against and the exact command to run afterwards. Print it or keep it open beside the document.
2. Compare every row. Tick it if it matches. Write the correct amount next to any row that does not.
3. Record the result for that operator section, for example:

   ```
   npm run data:verify -- --by "Full Name" --against sanral-tariffs-2026-poster --schedule sanral-2026 --correct sanral-2026-n1-vaal-class1=92.00
   ```

   `--except id1,id2` leaves rows you could not confirm unverified. `--dry-run` previews the change.
4. Run `npm run data:validate`, then `npm run data:build`, then commit and push (see
   [`../data-operations.md`](../data-operations.md), step A6).
5. Apply the same verification to Supabase:
   `select public.verify_schedule('sanral-2026', 'Full Name', array['ids','you','skipped']);`, plus
   `select public.correct_tariff(…)` for each corrected value (Procedure B in `data-operations.md`).
6. Confirm each route's plaza sequence (Procedure C in `data-operations.md`) using the operator's route map, or
   your own knowledge of the road. The worksheet's last section lists each route's plazas in order.
7. Run `npm run release:check` again, and record what you did in `data/verification-log.json` (date, who, what
   was checked, against what, result).

## Do these first: the MVP corridors

| Corridor | Plazas to check | Notes |
| --- | --- | --- |
| Johannesburg → Durban (N3) | De Hoek, Wilge, Tugela, Mooi (N3TC); Mariannhill (SANRAL) | All match the SANRAL 2026 poster. The earlier disagreement came from an index snapshot of the N3TC website showing the 2025 Gazette values. N3TC's site could not be opened to confirm. |
| Gauteng → Cape Town (N1) | Grasmere, Vaal, Verkeerdevlei; Huguenot (only if using the tunnel) | All match the poster. The Huguenot Class 3 flag was caused by a 2025 history typo (R299; the 2025 Gazette gives R229), now fixed. |
| Pretoria → Polokwane (N1) | Pumulani, Carousel (Bakwena); Kranskop, Nyl (SANRAL) | All match the poster and Bakwena's page. The Nyl Ramp Class 4 price is now filled from the poster. |
| Gauteng → Mbombela (N4) | Diamond Hill, Middelburg, Machado (TRAC) | All match the poster and TRAC's page. TRAC now lists a single Class 3 amount for Middelburg (R277). |
| Pretoria → Rustenburg (N4) | Doornpoort, Brits, Marikana (Bakwena); Pumulani and Kroondal Ramp are conditional | All match the poster and Bakwena's page (valid 1 March 2026 – 28 February 2027). |

## Known gaps that need research, not just checking

- **The 2026 Gazettes** (Nos. 54087 and 54088) could not be downloaded here. If you can open them, they are
  the strongest source to verify against.
- **K99 Ramp (Bakwena N4)**: on SANRAL's poster. Bakwena's own page has no "K99" but lists "Doornpoort Ramps" with
  the same tariffs. They are probably the same plaza. This is recorded on the plaza, not assumed.
- **Pelindaba and Quagga (SANRAL N4 Magalies)**, **Cullinan Ramp (TRAC)** and the other plazas added from the poster
  have no province or map position yet.
- **Map positions** are approximate for 20 plazas and missing for the rest. They came from secondary sources and are shown as such.
- **Payment methods and operator contact details** come from news reports and are unverified.
- **Chapman's Peak Drive**: its own provincial Gazette was not reachable. The light-vehicle toll is still under review.
- **Discounts** (frequent-user, local-user, e-tag) are not modelled. The app says so on every total.

The full per-plaza picture is in [`../coverage-register.md`](../coverage-register.md). Sources and how each one was
used are in [`../research-register.md`](../research-register.md).
