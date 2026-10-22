# Toll-E

**Know your tolls. Know your costs. Know before you go.**

Toll-E is a South African toll-intelligence app. It provides a directory of toll plazas, a toll map, and a trip
toll calculator for every vehicle class. Every price carries its source and verification status. It is not a
navigation app: directions open in Google Maps or Waze.

> **Status:** MVP feature-complete for Android, not yet released. The 2026 tariffs are loaded but **not yet
> verified by a person**, and the app labels them as such. See [docs/implementation-status.md](docs/implementation-status.md).

## Repository

| Path | Contents |
| --- | --- |
| `apps/mobile` | Expo (React Native) app: Android first, web compiles |
| `packages/core` | Domain logic shared by everything: model, money, tariffs, calculator, validation |
| `data/` | **Master copy of the toll data**: plazas, operators, sources, schedules, tariffs (CSV), routes |
| `scripts/` | Data tools (validate, verify, build, next year, Supabase SQL), DB tests, screenshots |
| `supabase/` | Postgres schema, row-level security, audit, update helpers, SQL tests |
| `site/` | Privacy policy, terms and support pages (GitHub Pages) |
| `docs/` | Everything else; start with the index below |

## Getting started (developers)

Requirements: Node 22 (`.nvmrc`). PostgreSQL 16 only for `npm run test:db`.

```
npm ci
npm run check                 # format, lint, typecheck, data validation, all unit tests
npm run mobile                # Expo dev server (maps and ads need a development build, not Expo Go)
npm run mobile:web            # the web build in a browser
```

Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` to connect a Supabase project. Without it, the app
uses the toll data built into it.

| Command | What it does |
| --- | --- |
| `npm test` | Core unit tests (vitest) and mobile UI tests (jest) |
| `npm run test:db` | Throwaway PostgreSQL cluster: migrations, seed, RLS and workflow tests |
| `npm run data:validate` | Check `data/` (schema, references, overlaps, CPI consistency) |
| `npm run data:build` | Rebuild the bundled dataset, `supabase/seed.sql` and the coverage register |
| `npm run data:verify` | Record a person's verification against an official source |
| `npm run data:next-year` | Start next year's tariff sheet |
| `npm run data:supabase-sql` | SQL to load a schedule into Supabase as drafts |
| `npm run data:worksheet` | Regenerate the verification worksheet |
| `npm run release:check` | Is the data good enough for a public release? |
| `npm run build:web` | Static web export of the app |

## Documentation

- [Implementation status](docs/implementation-status.md): what is done, tested and outstanding
- [Architecture](docs/architecture.md): structure and key decisions
- [Updating toll data](docs/data-operations.md): the 1 March procedure, step by step, for a non-developer
- [Verifying the data](docs/verification/README.md) and the [worksheet](docs/verification/worksheet.md)
- [Coverage register](docs/coverage-register.md) (generated) and [research register](docs/research-register.md)
- [Ads and the ad-free purchase](docs/monetisation.md)
- Release: [Android build](docs/release/android-release.md) · [Supabase set-up](docs/release/backend-setup.md) ·
  [Legal pages](docs/release/legal-pages.md) · [Play listing](docs/release/play-store-listing.md) ·
  [Google Play checklist](docs/release/google-play-checklist.md)
- [Post-MVP backlog](docs/backlog.md)

## Data and licensing notes

Tariffs come from the Government Gazette, SANRAL and the toll concessionaires' published tariffs. Official texts
of a legislative or administrative nature have no copyright in South Africa (Copyright Act 98 of 1978, s12(8)(a)).
Third-party compilations are used only as labelled, secondary cross-checks. Map outline: Natural Earth (public
domain). Map tiles: OpenFreeMap / OpenStreetMap contributors.

Toll-E is independent and is not affiliated with SANRAL or any toll operator.
