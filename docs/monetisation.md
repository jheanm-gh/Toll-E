# Ads and the ad-free purchase

Toll-E is free. It shows a small number of banner ads, and offers a once-off purchase that removes them. Toll
information, the map and the calculator are never paywalled and never blocked by ads.

All placements and product identifiers are defined in one file:
[`apps/mobile/src/monetisation/config.ts`](../apps/mobile/src/monetisation/config.ts).

## Ads (Google AdMob)

### Policy built into the code

- **Banners only.** No interstitial, rewarded, app-open or video ads.
- **Three placements**, each at most once per screen: the bottom of Home (`home_footer`), one banner after the
  8th result in the plaza list (`directory_inline`), and the bottom of a plaza page (`plaza_detail_footer`).
- **Never** on the map, in the calculator, on the purchase screen, or next to directions.
- Every banner is labelled "Advertisement" and separated from toll information. If a banner fails to load, the
  space closes up.
- **Non-personalised by default.** Personalised ads only if the user switches them on in More → Privacy.
- **Consent first.** Google's User Messaging Platform (UMP) runs before any ad request. Where consent is required
  and not given, no ads are requested at all.
- **Ad-free users never start the ads SDK**, not even briefly at start-up (covered by `apps/mobile/test/ads.test.tsx`).
- A master switch, `ADS_ENABLED`, turns all ads off.

### Test ads and real ads

| Build | Ads served |
| --- | --- |
| Local development, EAS `development`, `preview` and `closed-test` | **Google's test ads** (sample app id and test banner unit). Real inventory is never used. |
| EAS `production` | Your real AdMob banner unit, or no ads if none is configured. |

The production build refuses to start if the real AdMob **app id** is missing (see `app.config.ts`).

### Setting up AdMob (owner, once)

1. Sign in at [admob.google.com](https://admob.google.com) with the Google account that owns the Play developer account.
2. **Apps → Add app → Android**, "Is the app listed on a supported app store?" → *No* (link it to the Play
   listing later, once it is live). Name: Toll-E.
3. Note the **App ID** (`ca-app-pub-…~…`).
4. **Ad units → Add ad unit → Banner**. Name it "Toll-E banner". Note the **ad unit ID** (`ca-app-pub-…/…`).
5. **Privacy & messaging → European regulations (GDPR)**: create a consent message for Toll-E. Add the privacy policy
   URL (see [`release/legal-pages.md`](release/legal-pages.md)) and publish it. South African users do not see it,
   but it is required for users in the EEA, UK and Switzerland.
6. In EAS (expo.dev → project → **Environment variables**, environment *production*), add:
   - `ADMOB_ANDROID_APP_ID` = the App ID (plain text; it is not a secret),
   - `EXPO_PUBLIC_ADMOB_BANNER_ANDROID` = the banner ad unit ID.
7. Optional but recommended: publish an `app-ads.txt` file. AdMob looks for it at the root of the developer
   website listed on Google Play. A project page such as `jheanm-gh.github.io/Toll-E/` is not a root, so the file would need a
   separate `jheanm-gh.github.io` repository or a custom domain. Without it, ads still serve, but AdMob shows a
   warning.

Never tap your own real ads. Use the closed-test build (which shows test ads) for testing.

## The ad-free purchase

| Item | Value |
| --- | --- |
| Play product id | `tolle_ad_free_lifetime` (one-time, non-consumable) |
| RevenueCat entitlement | `ad_free` |
| Feature flag | `EXPO_PUBLIC_ENABLE_PURCHASES` (default **off**) |

### Why it is behind a flag

A purchase button that cannot complete a purchase must not ship. Until the product exists in Play Console and a
licence tester has bought it successfully, the flag stays **off**. While it is off:

- no "Remove ads" or "Restore purchase" controls appear anywhere, and the purchase screen (if opened by link)
  says the option is not offered;
- the privacy summary does not mention purchases;
- RevenueCat is never configured, so no purchase data leaves the device.

This is covered by `apps/mobile/test/missing-config.test.tsx`.

### What happens when it is on

- The price comes from Google Play, in the user's currency. Toll-E never sees card details.
- **Cancelled, pending or failed purchases never remove ads.** A pending payment removes them once Google
  confirms it.
- The entitlement is cached on the device, so ads do not flash on start-up and the app works offline. It is
  re-checked with the store on every start. A definite "not entitled" (for example after a refund) brings the ads
  back. A network failure does not.
- "Restore purchase" finds the purchase on a new phone signed in to the same Google account.

These states are tested in `apps/mobile/test/purchases.test.tsx`.

### Setting it up (owner, once)

The app must already be uploaded to a Play testing track (internal or closed). Play does not allow products for
an app that has never been uploaded.

1. **Play Console → Toll-E → Monetize with Play → Products → In-app products → Create product**
   - Product ID: `tolle_ad_free_lifetime` (exactly; it can never be changed)
   - Name: "Remove ads"; description: "Removes all advertising from Toll-E. Toll information stays free."
   - Price: your choice (for example R49.99). **Activate** it.
2. **RevenueCat** ([app.revenuecat.com](https://app.revenuecat.com), free tier):
   - Create a project "Toll-E" → **Add app → Google Play** with the package name.
   - Upload a Google Play **service account credentials JSON**. RevenueCat's guide walks you through creating it
     in Google Cloud and granting it access in Play Console. Allow up to 36 hours for Google to activate it.
   - **Products → Import** `tolle_ad_free_lifetime`.
   - **Entitlements → New** `ad_free`, and attach the product to it.
   - Copy the **public Android SDK key** (`goog_…`). It is designed to be public.
3. In EAS environment variables (environments *preview* and *production*):
   - `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` = the `goog_…` key,
   - `EXPO_PUBLIC_ENABLE_PURCHASES` = `true`.
4. **Play Console → Settings → License testing**: add the Google accounts of everyone who will test. Licence
   testers can buy the product without being charged.
5. Build with the `closed-test` profile, install it from the closed-test track on a tester's phone, and check:
   buy → ads disappear; uninstall and reinstall → **Restore purchase** brings it back; cancel the payment sheet →
   ads stay. Only then set the flag in the *production* environment.

Do not switch purchases off again once anyone has bought: a build with the flag off does not check
entitlements, so buyers would see ads until a build with the flag on is installed. Their purchase is kept in
Google Play and RevenueCat throughout.

## Development tools

In development and preview builds only, **More → Developer → Simulated store** replaces the real store with an
on-screen sheet: approve, cancel, pending or error. Use it to test every purchase state without accounts. It never
exists in closed-test or production builds.
