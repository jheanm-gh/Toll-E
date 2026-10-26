# Architecture

## Overview

```
┌────────────────────────── repository (GitHub) ──────────────────────────┐
│ data/*.json, data/tariffs/*.csv   ← master copy of all toll data         │
│        │  scripts/ (validate, verify, build, next-year, supabase-sql)    │
│        ├──▶ apps/mobile/src/data/generated/dataset.json (bundled)        │
│        ├──▶ supabase/seed.sql, imports/<schedule>.sql                    │
│        └──▶ docs/coverage-register.md, docs/verification/worksheet.md    │
│                                                                          │
│ packages/core   ← all domain logic, used by the app, scripts and tests   │
│ apps/mobile     ← Expo (React Native) app: Android first, web compiles   │
│ supabase/       ← migrations (schema, RLS, audit, helpers) and SQL tests │
│ site/           ← privacy policy, terms, support (GitHub Pages)          │
└──────────────────────────────────────────────────────────────────────────┘
                     SQL Editor (owner)          published_dataset() (public)
data/ ──scripts──▶ Supabase Postgres ─────────────────────────────────────▶ app
                                                       refresh ≤ 6 h, cached on device
```

## Packages

| Path | What it is |
| --- | --- |
| `packages/core` | Platform-independent TypeScript. Contents: the data model, zod schemas, integer-cents money, SAST dates, tariff selection and trust states, the journey calculator, validation (including CPI-consistency checks), CSV import, search, navigation links, coverage, route matching (not used by the app yet), the release gate and display labels. 164 unit tests (vitest). |
| `apps/mobile` | Expo SDK 58 / React Native 0.88 app with Expo Router. 34 UI tests (Jest + React Native Testing Library). |
| `scripts` | Node/tsx tools for the data workflow, the DB test harness, screenshots and store assets. |
| `supabase` | Postgres migrations, generated seed, and SQL tests run by `scripts/db-test.sh`. |

## App structure (`apps/mobile/src`)

- `app/`: routes. Tabs: Home, Toll map, Calculate, Saved, More. Stack: plaza list and plaza page, sources,
  privacy, terms, advertising, remove-ads (modal) and report (modal).
- `data/DataProvider.tsx`: chooses the data source in order: a valid cached download, then the bundled snapshot,
  then a live refresh when online and older than 6 hours. Everything downloaded is validated before use.
  `data/journeys.ts` decides which routes a build may offer.
- `monetisation/`: `config.ts` (placements and product ids), `ads/` (UMP consent, banner slot, test-ads policy),
  `purchases/` (RevenueCat on native, unavailable on web, simulated store in development builds; entitlement cached on
  device).
- `state/`: preferences, saved and recent calculations, favourites, all in validated AsyncStorage.
- `components/`: UI kit (`ui/`), plaza, calculator, map (MapLibre native, maplibre-gl on web, offline outline
  fallback).

## Key decisions

1. **The data files in git are the master copy; Supabase is the distribution channel.** Every change is reviewed
   and versioned in git and checked by the same code the app uses. Supabase lets prices change without an app
   release, and its triggers make published history immutable.
2. **Money is integer cents; dates are South African calendar dates.** No floating point, no time zones
   (SAST has had no daylight saving since 1944), and inclusive effective ranges.
3. **Trust is explicit.** Every tariff has a verification status and a source. Every result has a confidence
   (`confirmed`, `estimate`, `partial` or `unavailable`) computed from its weakest input. "Verified" requires a named
   person and an official source, enforced in the schema, the scripts and the database.
4. **The calculator never invents a charge.** Unpriced plazas make a total *partial*. Conditional ramps are
   priced only when the user confirms them. A return trip prices each direction separately.
5. **The release is gated on data.** `releaseReadiness` (in core) and `npm run release:check` define what
   "ready" means. Production builds hide routes whose plaza sequence is unverified (`offeredJourneys`).
6. **Monetisation never touches toll information.** Banners only, never in the calculator or map. The purchase
   only removes ads and sits behind a feature flag until it can be tested end to end.
7. **Offline first.** A bundled snapshot plus a validated cache, with the source and retrieval date always shown.
   A broken download can never replace good data.
8. **Least privilege.** The app holds only the public Supabase key. Writes from the public are limited to
   rate-limited correction reports. Data changes run as the owner in the SQL Editor through audited helper
   functions that require a person's name.
9. **Android first.** iOS and a public web version are on the [backlog](backlog.md). The web build is kept
   compiling, because it is also how screenshots are produced.

## Testing

| Layer | Command | What it covers |
| --- | --- | --- |
| Core logic | `npm test` (vitest, 164 tests) | money, dates, tariff selection, calculator, validation, CSV import, search and sorting, matching, and the real dataset per corridor |
| App UI | `npm test` (jest, 34 tests) | plaza search, sorting and filters, plaza page, data-origin label, ads (test inventory, ad-free, no consent, fixed position), clearing history, purchase states, no-config production build, API headers |
| Database | `npm run test:db` | RLS for anonymous, editor and publisher roles; tariff integrity triggers; the 1 March drill; route verification; corrections; the feed after every helper, checked with the app's validator |
| Data | `npm run data:validate`, `npm run release:check` | schema, references, overlaps, CPI consistency, coverage, release readiness |
| Static | `npm run lint`, `npm run typecheck`, `npm run format:check` | ESLint (Expo + React Compiler rules), strict TypeScript, Prettier |

`npm run check` runs format, lint, typecheck, data validation and unit tests together.
