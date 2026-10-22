# Toll-E: notes for AI assistants and contributors

South African toll-intelligence app (Expo/React Native, Android first) with a Supabase backend. Read
`docs/implementation-status.md` first, then `docs/architecture.md`.

## Non-negotiable rules

- **Never invent toll data.** No guessed amounts, coordinates, payment methods or operator details. Anything
  not from a source stays absent and is shown as unavailable.
- **Never mark data verified** unless a named person compared it with an official source. Only `npm run
  data:verify` (or the SQL helpers) sets `verified`. The schema, scripts and database all enforce this. Do not
  work around them.
- **Money is integer cents.** Use `parseRandToCents` and `formatZAR` from `@toll-e/core`. Never do floating-point
  arithmetic on amounts.
- **Dates are SAST calendar dates** (`YYYY-MM-DD`, inclusive ranges). Use the helpers in `packages/core/src/dates.ts`.
- **No secrets in the app or repo.** Only `EXPO_PUBLIC_*` public configuration goes into the app. The Supabase
  key in the app is the public anon or publishable key, never `service_role`.
- **Test ads only** outside the EAS `production` profile (`usesTestAds` in `apps/mobile/src/config/env.ts`).
- **Ads never in the calculator, on the map or next to directions.** Placements live only in
  `apps/mobile/src/monetisation/config.ts`.
- **No purchase UI unless it works.** It stays behind `EXPO_PUBLIC_ENABLE_PURCHASES`.
- Do not deploy, publish to a store, create cloud resources or push without explicit authorisation from the owner.

## Where things are

- Domain logic: `packages/core/src` (calculator, tariffs, validation, release gate). Put logic here, not in screens.
- App: `apps/mobile/src` (`app/` routes, `data/` provider, `monetisation/`, `components/ui` kit).
- Master data: `data/` (JSON plus `data/tariffs/*.csv`). Generated files (do not edit by hand):
  `apps/mobile/src/data/generated/dataset.json`, `supabase/seed.sql`, `docs/coverage-register.md`,
  `docs/verification/worksheet.md`.
- Database: `supabase/migrations` (append new migrations; never edit an applied one), tests in `supabase/tests`.

## Before you commit

```
npm run check        # format:check, lint, typecheck, data:validate, all unit tests
npm run test:db      # when touching supabase/ or the feed (needs PostgreSQL 16)
npm run data:build   # after any change to data/ — commit the regenerated files too
```

- ESLint uses the React Compiler rules: no `setState` directly in effects, no reading refs during render.
- UI tests: `apps/mobile/test` (Jest, `jest-expo/android` preset, native modules mocked in `test/setup.ts`).
- Visual check without a device: `npm run build:web`, serve `apps/mobile/dist` on port 8081, then
  `node scripts/screenshots.mjs <outDir> "/path|name"`.

## Style

- Plain, specific UI copy. Say what is known and what is not ("Unverified", "Partial total"). Never overstate certainty.
- Follow the existing component kit and tokens (`apps/mobile/src/theme/tokens.ts`). Touch targets are at least 44 pt.
- Commit messages: imperative summary line, then a short body explaining why.
