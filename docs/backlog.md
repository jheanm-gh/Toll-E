# Post-MVP backlog

In priority order, as set by the product owner. Nothing here is started. The first release is Android-only and
covers the MVP scope in [implementation-status.md](implementation-status.md).

## 1. Admin web interface (Vite + Supabase)

A browser tool for editors and publishers, replacing the SQL Editor procedures in
[data-operations.md](data-operations.md).

- Sign in with Supabase Auth. The `admin_users` roles (`editor`, `publisher`) and their row-level security rules
  already exist in the schema.
- Screens: plaza list and editor; tariff schedule import with a side-by-side review (the `schedule_review` view
  already computes the old price, the new price and the percentage change); verify and publish buttons calling
  `verify_schedule`, `publish_schedule`, `verify_journey` and `correct_tariff`; a correction-report inbox; and the
  audit log.
- Reuse `@toll-e/core` for validation and CSV parsing, so the browser runs the same checks as the scripts.
- Deploy as a static site. It needs no server code, because everything goes through RLS and SECURITY DEFINER functions.

## 2. iOS release

- The app already builds for iOS in principle: React Native, Expo, platform-split purchase and ad modules, and an
  iOS AdMob app id in `app.config.ts`. It has not been run on iOS.
- Needed: Apple Developer Program membership, an App Store Connect app, the product `tolle_ad_free_lifetime` as a
  non-consumable, RevenueCat iOS app and key, `ADMOB_IOS_APP_ID` and `EXPO_PUBLIC_ADMOB_BANNER_IOS`, App
  Privacy answers, and the App Tracking Transparency position (Toll-E does not request tracking).
- Test on a real iPhone, including restore purchases (required by App Review).

## 3. Public web version with indexable route and plaza pages

- The web build already compiles (`npm run build:web`), but it is a single-page app and is not deployed.
- Switch Expo Router to static rendering (`web.output: 'static'`), with one pre-rendered page per plaza and per
  route, so that searches such as "Machado toll fee" land on Toll-E.
- Add structured data, a sitemap and canonical URLs, plus a refresh job that rebuilds pages when tariffs are published.
- Keep the same honesty labels: unverified prices must not be presented as fact in search snippets.

## 4. Tariff-change monitoring and update notices

- A scheduled job that watches the Gazette and the operator tariff pages for changes, and opens a task for a
  person to review. It never updates prices by itself.
- In-app notices before 1 March ("New tariffs from 1 March: Vaal R91.50 → R94.40") using the existing upcoming-tariff
  data, plus optional push notifications for favourite plazas (this needs consent and a privacy-policy update).

## 5. Automatic origin-to-destination routing with toll-plaza matching

- Enter a start and an end, get a route from a routing service, and match the plazas it passes with
  `matching.ts` (already in `@toll-e/core`, with tests). The map data needs verified plaza positions first.
- Handle alternatives ("avoid tolls" versus toll route), ramps based on the actual exit taken, and an honest
  "plazas we could not match" list.
- Choose a routing provider with acceptable terms and costs. This is the first feature with a variable running cost.

## 6. Fleet and business features, including a toll-data API

- Multiple vehicles and classes per account, trip logs, and monthly toll budgets.
- Exportable reports (CSV/PDF) for expense claims.
- A read-only toll-data API (versioned JSON, the same feed the app uses) with API keys, rate limits and terms of
  use. The data's provenance labels must be part of the API contract.
- This needs accounts, which means a larger privacy-policy and Data safety update.

## 7. Community corrections

- Make the existing correction reports visible as "reported by users" signals on plaza pages, after moderation.
- Let trusted contributors attach photos of plaza price boards (moderation, storage costs and POPIA implications).
- User reports can raise a price's priority for checking, but can never verify it: verification stays tied to
  official sources.
