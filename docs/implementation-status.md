# Implementation status

_Last updated 23 October 2026._ This page says plainly what exists, what has been tested and how, and what is
still outstanding. "Tested" means an automated test or a manual check actually ran and passed in this
repository. Nothing here was run on an Android device or emulator, and no external service (Expo/EAS,
Supabase, AdMob, RevenueCat, Google Play) has been connected yet.

## MVP scope (first release, Android)

| Item | Status | Evidence / what is missing |
| --- | --- | --- |
| **a. Toll data verified** for classes 1–4 | ◐ **Checked against official publications; final sign-off needs a person** | On 23 Oct 2026 every 2026 price (296 across 74 plazas) was compared with SANRAL's official 2026 tariff poster and with TRAC's and Bakwena's pages: all match. That comparison fixed one 2025 error, filled 5 gaps and added 12 plazas. The 2026 Gazettes and the N3TC site could not be opened. Prices stay marked *unverified* until a named person signs off ([verification/README.md](verification/README.md) shows one command per schedule). Route plaza sequences (8) are not yet verified. |
| **b. Phase 4 screens**, no placeholders | ✅ Done | Home, map (with offline fallback), plaza list and page, calculator (routes or chosen plazas, ramps, return, date, save, share), saved, more, sources, privacy, terms, advertising, report, remove-ads. Inspected as web-build screenshots at phone size; UI tests for search, plaza page, data label and no-config build. |
| b. Routes only if sequence verified | ✅ Done | Production builds hide unverified routes (`offeredJourneys`, tested). Closed-test builds show them labelled "Plaza sequence not yet checked". |
| b. Supabase + bundled fallback + dated offline cache | ✅ Built, ❌ not connected | Feed RPC, validation, cache and retrieval-date label are implemented and tested (Jest, SQL). No Supabase project exists yet ([release/backend-setup.md](release/backend-setup.md)). |
| **c. Tariff updates without an app release** | ✅ Done (procedure), ❌ not rehearsed on real Supabase | `data:next-year` → `data:supabase-sql` → SQL Editor → `schedule_review` → `verify_schedule` → `publish_schedule`; plus `correct_tariff` and `verify_journey`. Rehearsed end to end in the SQL tests; the feed is then checked with the app's validator. Guide: [data-operations.md](data-operations.md). |
| **d. AdMob banners**, central config, test ids, UMP | ✅ Built, ❌ not run on a device | Three banner placements, test ads in every non-production build, consent before requests, non-personalised by default, and ad-free users never start the SDK (a bug fixed and tested in this session). |
| **e. Purchase / restore / entitlement** | ✅ Built behind a flag, **flag off** | `EXPO_PUBLIC_ENABLE_PURCHASES` is off until a licence-tester purchase works. With it off, no purchase controls exist (tested). The states are tested with the simulated store. Not tested against Google Play/RevenueCat. |
| **f. Typecheck, lint, tests** | ✅ Pass | See "Checks run" below. |
| f. Run on a real Android device | ✅ Done by the owner on a Samsung Galaxy S26 Ultra (23 Oct 2026, local test build 3) | Every screen works. The first two builds closed at launch because R8 code shrinking had removed classes native code needs; shrinking is now off. Not yet testable: sending a correction report (needs Supabase or a support email). The emulator cannot run in the build container (no hardware virtualisation). |
| f. EAS Android production profile | ✅ Configured; native build verified locally | `production` and `closed-test` profiles produce AABs. No EAS build yet (needs your Expo account). A local release build of the same native project succeeded on 23 Oct 2026 (arm64 AAB). Fixes found by it: unused template permissions and expo-location's background services removed. |
| f. Play listing material | ✅ Written | Name, descriptions, content rating and Data safety answers, feature graphic, icon and 7 screenshots ([release/play-store-listing.md](release/play-store-listing.md)). The screenshots come from the web build. |
| f. Privacy policy and terms at a free URL | ✅ Written, ❌ not published | `site/` plus a manual GitHub Pages workflow → `https://jheanm-gh.github.io/Toll-E/`. The owner name, email and date are placeholders that block publishing until filled in ([release/legal-pages.md](release/legal-pages.md)). |

## Checks run (22 October 2026)

| Check | Result |
| --- | --- |
| `npm run format:check` | pass |
| `npm run lint` (ESLint, Expo + React Compiler rules) | pass, 0 problems |
| `npm run typecheck` (mobile, core, core tests, scripts) | pass |
| `npm run data:validate` | pass: 75 plazas, 562 tariffs, 0 errors, 1 warning (insecure source URL) |
| Core unit tests (vitest) | 158 passed |
| Mobile UI tests (Jest + RNTL) | 23 passed |
| `npm run test:db` (PostgreSQL 16, Supabase stand-ins) | 99 checks passed, plus feed parity and app validation of the feed |
| `npm run build:web` (Expo web export) | pass |
| `npm run release:check` | **not ready**: 0 of 297 prices signed off by a person, 8 routes unverified, 0 missing |

## Outstanding, in order

1. **Sign off the data** (owner, an hour if you accept SANRAL's poster; longer to check the Gazette yourself): [verification/README.md](verification/README.md).
2. **Create the Supabase project** and load it: [release/backend-setup.md](release/backend-setup.md).
3. **Publish the legal pages** after filling in the placeholders: [release/legal-pages.md](release/legal-pages.md).
4. **Set up EAS and build the closed-test AAB**, then run the smoke test on a phone. Fix whatever the first real
   build shows: [release/android-release.md](release/android-release.md).
5. **Google Play**: developer account, listing, declarations, closed test with 12 testers for 14 days:
   [release/google-play-checklist.md](release/google-play-checklist.md).
6. **AdMob** account, banner unit and consent message: [monetisation.md](monetisation.md).
7. Optional: **ad-free purchase** with RevenueCat, then switch the flag on.
8. **Production**: once `release:check` passes and Play grants production access.

## Known limitations

- Discounts (frequent-user, local-user, e-tag) are not modelled. Every total says so.
- Map positions are approximate for 20 plazas and missing for 55, from secondary sources.
- Payment methods and operator contacts come from news reports and are unverified.
- The 2026 Gazettes (Nos. 54087/54088) and the N3TC website could not be retrieved; the data rests on SANRAL's official poster and the TRAC and Bakwena pages.
- Chapman's Peak Drive uses its own vehicle classes. Only the light-vehicle and motorcycle tolls are loaded, and
  its frequent-user tariffs are not modelled.
- The web build is not a product. It is kept compiling for development and screenshots, and it shows no ads.
- `packages/core/src/matching.ts` (route-to-plaza matching) is implemented and tested but unused until automatic
  routing (backlog item 5).

## Earlier phases (from the original plan)

Research, scaffolding, the core engine, the consumer screens and the Supabase schema with RLS, audit and
publication workflow are complete. The admin web interface moved to the [backlog](backlog.md) (item 1).
