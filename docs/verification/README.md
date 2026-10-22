# Verifying Toll-E's data

**Status on 22 October 2026: nothing has been verified by a person yet.** All 2026 prices were collected from
search-indexed extracts of the official publications and from corroborating secondary sources. The official
sites could not be opened from the environment Toll-E was built in, so no value could be checked against the
document itself. The app labels every price **Unverified** or **Under review** and calls every total an
**estimate**.

A public (production) release is blocked until the release gate passes:

```
npm run release:check          # summary; add -- --all for every gap
```

On 22 October 2026 it reports **not ready**: 0 of 249 plaza-and-class prices are verified, 244 prices await a
check, 5 are missing, and 8 route sequences are unverified. The closed test on Google Play can run on this
clearly-labelled data while the checks below are done. See [`../release/google-play-checklist.md`](../release/google-play-checklist.md).

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
| Johannesburg → Durban (N3) | De Hoek, Wilge, Tugela, Mooi (N3TC); Mariannhill (SANRAL) | **Sources disagree.** The N3TC website (as indexed) and the SANRAL 2026 poster give different N3 figures. De Hoek and Mooi Classes 2–4 come only from a secondary table. Use the Gazette. |
| Gauteng → Cape Town (N1) | Grasmere, Vaal, Verkeerdevlei; Huguenot (only if using the tunnel) | Huguenot Class 3 (R236.00) fails the CPI-consistency check against 2025. Confirm it. |
| Pretoria → Polokwane (N1) | Pumulani, Carousel (Bakwena); Kranskop, Nyl (SANRAL) | Kranskop and Nyl figures come from a motoring-site table quoting SANRAL. The Nyl Ramp has no Class 4 price. |
| Gauteng → Mbombela (N4) | Diamond Hill, Middelburg, Machado (TRAC) | The TRAC page lists two Class 3 amounts for Middelburg (R277 and R281). R277 is loaded, under review. |
| Pretoria → Rustenburg (N4) | Doornpoort, Brits, Marikana (Bakwena); Pumulani and Kroondal Ramp are conditional | Bakwena's table is valid 1 March 2026 – 28 February 2027. |

## Known gaps that need research, not just checking

- **Sebetiela (N1, Limpopo)**: listed on SANRAL's plaza list, but no tariff was found. It shows as "no price".
- **Nyl Ramp Class 4**: missing.
- **Murrayhill, Maubane and Hammanskraal (Bakwena N1 ramps)**: search extracts disagree on whether Bakwena's
  page lists them. Their prices match a secondary table and are marked under review until confirmed.
- **Map positions** are approximate, from secondary sources, and shown as such. 43 plazas have no position.
- **Payment methods and operator contact details** come from news reports and are unverified.
- **Discounts** (frequent-user, local-user, e-tag) are not modelled. The app says so on every total.

The full per-plaza picture is in [`../coverage-register.md`](../coverage-register.md). Sources and how each one was
used are in [`../research-register.md`](../research-register.md).
