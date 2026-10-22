# Privacy policy, terms and support page

Google Play needs a public privacy policy URL. Toll-E's pages are plain HTML in [`site/`](../../site/) and are
published free with GitHub Pages (the repository is public, so GitHub Pages costs nothing):

| Page | URL once published |
| --- | --- |
| About | <https://jheanm-gh.github.io/Toll-E/> |
| Privacy policy | <https://jheanm-gh.github.io/Toll-E/privacy.html> |
| Terms of use | <https://jheanm-gh.github.io/Toll-E/terms.html> |
| Support | <https://jheanm-gh.github.io/Toll-E/support.html> |

**Not yet published.** Nothing has been deployed. Publishing is a deliberate step you take, below.

## Before publishing: fill in three things

Search `site/` for `{{` and replace:

| Placeholder | Replace with |
| --- | --- |
| `{{OWNER_NAME}}` | The full name of the person (or registered business) responsible for Toll-E. Under POPIA this is the "responsible party" and, for a one-person operation, also the Information Officer. |
| `{{SUPPORT_EMAIL}}` | A support address you will monitor, e.g. a dedicated Gmail address. It is public. |
| `{{EFFECTIVE_DATE}}` | The date the policy takes effect, e.g. `1 December 2026`. |

The publish workflow refuses to run while any placeholder remains.

Read the privacy policy once more against the build you are releasing. It describes AdMob, the optional
RevenueCat purchase, Supabase, OpenFreeMap and on-device location. If you add an SDK or a new kind of data,
update the policy, the in-app summary (`apps/mobile/src/app/privacy.tsx`) and the Data safety form together.

> These pages are written in plain language for a small, no-account app. They are not legal advice. If Toll-E
> grows (accounts, fleet features, analytics), have them reviewed.

## Publishing (about five minutes)

1. Merge the branch containing `site/` and `.github/workflows/pages.yml` into `main`. GitHub only offers manual
   workflows that are on the default branch.
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Actions → Publish site → Run workflow** (branch `main`).
4. After a minute, open <https://jheanm-gh.github.io/Toll-E/privacy.html> and check it.
5. Put the URLs in the EAS environment variables `EXPO_PUBLIC_PRIVACY_POLICY_URL` and `EXPO_PUBLIC_TERMS_URL`, in
   Play Console (store listing and App content → Privacy policy), and in AdMob's consent message.

To update the pages later, edit `site/`, merge, and run the workflow again. The URLs stay the same.

## Alternative host

If you would rather not use GitHub Pages, any static host works. For example, EAS Hosting can serve `site/` on
a free `*.expo.app` subdomain with `npx eas-cli@latest deploy`, pointed at the `site` folder (check
`eas deploy --help` for the current option name). Then use those URLs everywhere above.
