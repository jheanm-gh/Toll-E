# Implementation status

_Last updated 29 October 2026._ This page says plainly what exists, what has been tested and how, and what is
still outstanding. "Tested" means an automated test or a manual check actually ran and passed in this
repository. The only check on an Android device was the owner's, on a local build (below). Expo/EAS was connected
on 27 October 2026. Supabase, AdMob, RevenueCat and Google Play are not connected yet.

## MVP scope (first release, Android)

| Item | Status | Evidence / what is missing |
| --- | --- | --- |
| **a. Toll data verified** for classes 1–4 | ◐ **Checked against official publications; final sign-off needs a person** | On 23 Oct 2026 every 2026 price (296 across 74 plazas) was compared with SANRAL's official 2026 tariff poster and with TRAC's and Bakwena's pages: all match. That comparison fixed one 2025 error, filled 5 gaps and added 12 plazas. The 2026 Gazettes and the N3TC site could not be opened. Prices stay marked *unverified* until a named person signs off ([verification/README.md](verification/README.md) shows one command per schedule). Route plaza sequences (8) are not yet verified. |
| **b. Phase 4 screens**, no placeholders | ✅ Done | Home, map (with offline fallback), plaza list and page, calculator (routes or chosen plazas, ramps, return, date, save, share), saved, more, sources, privacy, terms, advertising, report, remove-ads. Inspected as web-build screenshots at phone size; UI tests for search, plaza page, data label and no-config build. |
| b. Routes only if sequence verified | ✅ Done | Production builds hide unverified routes (`offeredJourneys`, tested). Closed-test builds show them labelled "Plaza sequence not yet checked". |
| b. Supabase + bundled fallback + dated offline cache | ✅ Built, ❌ not connected | Feed RPC, validation, cache and retrieval-date label are implemented and tested (Jest, SQL). No Supabase project exists yet ([release/backend-setup.md](release/backend-setup.md)). |
| **c. Tariff updates without an app release** | ✅ Done (procedure), ❌ not rehearsed on real Supabase | `data:next-year` → `data:supabase-sql` → SQL Editor → `schedule_review` → `verify_schedule` → `publish_schedule`; plus `correct_tariff` and `verify_journey`. Rehearsed end to end in the SQL tests; the feed is then checked with the app's validator. Guide: [data-operations.md](data-operations.md). |
| **d. AdMob banners**, central config, test ids, UMP | ✅ Built, ❌ not run on a device | Three banner placements, each fixed to the bottom of its screen (Home, plaza list, plaza page; never the map tab), test ads in every non-production build, consent before requests, non-personalised by default, and ad-free users never start the SDK. |
| **e. Purchase / restore / entitlement** | ✅ Built behind a flag, **flag off** | `EXPO_PUBLIC_ENABLE_PURCHASES` is off until a licence-tester purchase works. With it off, no purchase controls exist (tested). The states are tested with the simulated store. Not tested against Google Play/RevenueCat. |
| **f. Typecheck, lint, tests** | ✅ Pass | See "Checks run" below. |
| f. Run on a real Android device | ✅ Done by the owner on a Samsung Galaxy S26 Ultra (23 Oct 2026, local test build 3) | Every screen works. The first two builds closed at launch because R8 code shrinking had removed classes native code needs; shrinking is now off. Not yet testable: sending a correction report (needs Supabase or a support email). The emulator cannot run in the build container (no hardware virtualisation). |
| f. EAS Android production profile | ✅ EAS closed-test build succeeded (29 Oct 2026) | Project `@haxolotl/toll-e`, package `za.co.tolle.app`. The `closed-test` AAB to upload is versionCode 4 (0.1.0, commit `719299a`), signed with an EAS-managed upload key, with the support email and legal-page URLs set (no Supabase yet). It has not been uploaded to Play. On 28 Oct 2026 the owner installed an EAS `preview` APK with the same app code (`d1aa7cb`) on a phone, and it works. Do not upload versionCode 2 (no environment variables) or 3 (built before the Expo SDK 58 patch updates). Earlier, a local release build (23 Oct 2026) found and fixed unused template permissions and expo-location's background services. |
| f. Play listing material | ✅ Written | Name, descriptions, content rating and Data safety answers, feature graphic, icon and 7 screenshots ([release/play-store-listing.md](release/play-store-listing.md)). The screenshots come from the web build. |
| f. Privacy policy and terms at a free URL | ✅ Written and filled in, ❌ not published | `site/` plus a manual GitHub Pages workflow → `https://jheanm-gh.github.io/Toll-E/`. Owner name, support email and effective date (27 October 2026) filled in ([release/legal-pages.md](release/legal-pages.md)). |

## Tester feedback (26 October 2026)

| Feedback | Change |
| --- | --- |
| Let users clear their history | More → Privacy: **Clear history** (recent calculations and recently viewed plazas) and **Delete all saved items** (also saved trips and favourites), each after a confirmation. The Saved screen has a Clear button on each history section. Tested in `apps/mobile/test/history.test.tsx`. |
| Sort and filter toll plazas by price, name, province | Plaza list: **Sort** (default, name, price lowest or highest first for your vehicle class, province, distance) and **Province** and **Operator** filters beside the road and type filters, with "Clear filters". Plazas missing the value (no current price, no province, no position) are listed last and the app says so. Sorting is in `@toll-e/core` (`sortPlazaResults`); tested in core and in `directory.test.tsx`. |
| Keep the banner on screen while scrolling | Banners are anchored to the bottom edge, outside the scrolling content, on Home, the plaza list and plaza pages. The banner no longer appears between list results, and the map tab's list has none. Tested in `ads.test.tsx`. |

## Checks run (26 October 2026)

| Check | Result |
| --- | --- |
| `npm run format:check` | pass |
| `npm run lint` (ESLint, Expo + React Compiler rules) | pass, 0 problems |
| `npm run typecheck` (mobile, core, core tests, scripts) | pass |
| `npm run data:validate` | pass: 75 plazas, 562 tariffs, 0 errors, 1 warning (insecure source URL) |
| Core unit tests (vitest) | 164 passed |
| Mobile UI tests (Jest + RNTL) | 34 passed |
| `npm run test:db` (PostgreSQL 16, Supabase stand-ins) | 99 checks passed, plus feed parity and app validation of the feed (22 Oct; no database change since) |
| `npm run build:web` (Expo web export) | pass |
| `npm run release:check` | **not ready**: 0 of 297 prices signed off by a person, 8 routes unverified, 0 missing |

## Outstanding, in order

1. **Sign off the data** (owner, an hour if you accept SANRAL's poster; longer to check the Gazette yourself): [verification/README.md](verification/README.md).
2. **Create the Supabase project** and load it: [release/backend-setup.md](release/backend-setup.md).
3. **Publish the legal pages** (details filled in; merge to `main`, then run the workflow): [release/legal-pages.md](release/legal-pages.md).
4. **Closed-test AAB**: versionCode 4 is built and ready to upload. Rebuild once Supabase exists. Back up the upload
   keystore from expo.dev → Credentials: [release/android-release.md](release/android-release.md).
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
