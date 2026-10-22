# Google Play checklist (plain language)

Work through this from top to bottom. Each item says what to do, where, and how long it takes. Details are in the
linked documents. Nothing here has been done yet.

## 1. Developer account (allow a few days)

- [ ] Go to [play.google.com/console](https://play.google.com/console) and sign up as an **individual** (personal
      account). There is a once-off registration fee (US$25 at the time of writing).
- [ ] Complete **identity verification** (ID document) and **verify a phone and email**. You may also be asked to
      verify access to a real Android device via the Play Console app.
- [ ] Note that new personal accounts must run a **closed test with at least 12 testers for at least 14 days in a
      row** before they can apply to publish to production. Plan for this. It is the longest step.

## 2. Create the app (15 minutes)

- [ ] **Create app**: name "Toll-E: SA Toll Costs & Map", default language English (South Africa) if offered,
      otherwise English, **App**, **Free**, accept the declarations.
- [ ] Decide the **package name** before the first upload. It can never change
      ([android-release.md](android-release.md), step 3).

## 3. Privacy policy and support pages (30 minutes)

- [ ] Fill in the owner name, support email and effective date in `site/`, then publish with GitHub Pages
      ([legal-pages.md](legal-pages.md)).
- [ ] Privacy policy URL: `https://jheanm-gh.github.io/Toll-E/privacy.html`.

## 4. App content declarations (1 hour), under Policy → App content

All answers are written out in [play-store-listing.md](play-store-listing.md).

- [ ] Privacy policy URL.
- [ ] Ads: **Yes, contains ads**.
- [ ] App access: no login needed.
- [ ] Target audience: **18+**.
- [ ] **Content rating** questionnaire (IARC): category "All other app types", no to all content questions.
- [ ] **Data safety** form: AdMob, optional correction-report email and text, the device code, and purchase
      history only if purchases are enabled.
- [ ] Government app: No. Financial features: None. Health: None. News: No.

## 5. Store listing (1 hour), under Grow → Store presence

- [ ] Name, short description, full description: copy from [play-store-listing.md](play-store-listing.md).
- [ ] Icon `docs/store/icon-512.png`, feature graphic `docs/store/feature-graphic.png`, at least 2 (up to 8) phone
      screenshots from `docs/store/screenshots/`.
- [ ] Category Travel & Local; contact email; website `https://jheanm-gh.github.io/Toll-E/`.

## 6. AdMob (30 minutes, plus a day for approval)

- [ ] Create the AdMob app and one banner ad unit. Put the IDs in EAS (production only).
- [ ] Create and publish the GDPR consent message with the privacy policy URL.
- [ ] Never tap your own real ads. Closed-test builds show test ads.
- Details: [monetisation.md → Setting up AdMob](../monetisation.md#setting-up-admob-owner-once).

## 7. Build and upload the closed test (1–2 hours the first time)

- [ ] Set up Supabase ([backend-setup.md](backend-setup.md)) and the EAS environment variables
      ([android-release.md](android-release.md)).
- [ ] `npx eas-cli@latest build --platform android --profile closed-test`, then download the `.aab`.
- [ ] **Test and release → Testing → Closed testing → Create track** (for example "Testers").
- [ ] Add testers: an email list, or a Google Group with at least 12 people. Testers need Android phones and must
      use the Google account you add.
- [ ] **Create release → upload the `.aab`**, release name "0.1.0 closed test", release notes ("First test
      version. Prices are not yet verified; please report anything that looks wrong."), then **Review → Start
      rollout**. Google reviews it (hours to a few days).
- [ ] Send testers the **opt-in link** from the track page. Each tester opens it, joins, installs Toll-E from Play
      **and keeps it installed for 14 days**.
- [ ] Run the smoke test in [android-release.md](android-release.md) on your own phone.

## 8. The ad-free purchase (optional for launch; 1 hour plus waiting time)

Only once a closed-test build is uploaded:

- [ ] Create the one-time product `tolle_ad_free_lifetime` and activate it.
- [ ] Set up RevenueCat (project, Play service credentials, product, `ad_free` entitlement).
- [ ] Add licence testers, enable `EXPO_PUBLIC_ENABLE_PURCHASES=true`, build a new closed test, and buy, cancel
      and restore on a tester phone.
- [ ] Update the Content rating ("digital purchases": Yes) and the Data safety form (Purchase history).
- Details: [monetisation.md → The ad-free purchase](../monetisation.md#the-ad-free-purchase).
- If this is not finished, leave the flag off. The app then has no purchase controls at all.

## 9. Before applying for production

- [ ] At least 12 testers opted in for 14 consecutive days.
- [ ] Data verified: `npm run release:check` says **READY**. Every published plaza has verified current prices
      for every class, and every popular route's plaza sequence is verified
      ([verification/README.md](../verification/README.md)).
- [ ] Retake the screenshots from the production build (with a banner ad visible).
- [ ] Apply for production access in Play Console (it asks about your testing and feedback).

## 10. Production release

- [ ] `npx eas-cli@latest build --platform android --profile production` (needs `ADMOB_ANDROID_APP_ID` and the
      banner unit in EAS).
- [ ] **Production → Create release** → upload → staged rollout (for example 20%) → review → full rollout.
- [ ] Every year in February, follow the 1 March update in [data-operations.md](../data-operations.md). No app
      release is needed for it.
