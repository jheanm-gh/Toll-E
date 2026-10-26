# Google Play listing material

Everything to paste into Play Console. Character counts are within Play's limits. Assets are in
[`../store/`](../store/).

## Store listing (Grow → Store presence → Main store listing)

**App name** (27 of 30 characters)

```
Toll-E: SA Toll Costs & Map
```

**Short description** (75 of 80 characters)

```
South African toll plaza prices, map and trip costs for Class 1 to Class 4.
```

**Full description** (under 4,000 characters)

```
Know your tolls. Know your costs. Know before you go.

Toll-E shows what South African toll plazas charge, for cars and for heavy vehicles, and what a whole trip will cost before you leave.

TOLL PLAZA DIRECTORY
• Search toll plazas by name, road (N1, N2, N3, N4, N17 …) or nearby town
• Sort by price, name, province or distance; filter by road, province, operator or plaza type
• Prices for Class 1 (light vehicles) to Class 4 (5+ axle heavy vehicles)
• The tariff period, the source of every price, and whether it has been verified
• Announced price changes shown in advance, with the date they take effect

TRIP TOLL CALCULATOR
• Choose a popular route or pick the plazas you will pass, in order
• One way or return, for any vehicle class and travel date
• Every plaza itemised, with ramp plazas you may or may not pass shown separately
• Partial totals and estimates are clearly labelled, never presented as exact
• Save and share calculations

TOLL MAP
• See toll plazas on a map of South Africa, filtered by road
• Open directions to a plaza in your navigation app

HONEST ABOUT ITS DATA
Toll-E takes prices from the Government Gazette, SANRAL and the toll concessionaires' published tariffs. Every price says where it came from. Prices a person has not yet checked against the official document are marked "Unverified" or "Under review". Always confirm the amount displayed at the plaza.

WORKS OFFLINE, NO ACCOUNT
Toll-E keeps the latest toll data on your phone, so it works with no signal. You do not need an account. Your settings and saved trips stay on your device.

FREE
Toll-E is free and shows one clearly labelled banner at the bottom of some screens. Ads never appear on the map or in the calculator.

Toll-E is not a navigation app and is not affiliated with SANRAL, N3 Toll Concession, TRAC, Bakwena or any toll operator.
```

> When `EXPO_PUBLIC_ENABLE_PURCHASES` is switched on, change the heading "FREE" to "FREE, WITH OPTIONAL AD
> REMOVAL" and add the sentence "You can remove all ads with a once-off purchase." Until then, do not mention the
> purchase.

**App icon**: `docs/store/icon-512.png` (512 × 512)

**Feature graphic**: `docs/store/feature-graphic.png` (1024 × 500)

**Phone screenshots** (1080 × 1920, upload in this order): `docs/store/screenshots/1-home.png` …
`7-directory.png`.

> The screenshots were rendered from the app's web build, which runs the same screens as the Android app, in
> the closed-test configuration (popular routes shown, labelled "Plaza sequence not yet checked"). Before the
> production release, retake them on an Android phone or emulator, so they show the production build, including a
> banner ad on Home. Use `node scripts/store-assets.mjs`, or the phone's screenshot button.

**Category**: Travel & Local (alternative: Auto & Vehicles). **Tags**: Travel, Navigation & maps (as Play allows).

**Contact details**: email = the support address; website = `https://jheanm-gh.github.io/Toll-E/`.

**Privacy policy URL**: `https://jheanm-gh.github.io/Toll-E/privacy.html`

## App content (Policy → App content)

| Declaration | Answer |
| --- | --- |
| Privacy policy | `https://jheanm-gh.github.io/Toll-E/privacy.html` |
| Ads | **Yes**, the app contains ads |
| App access | All functionality is available without special access (no login) |
| Target audience | **18 and over** (Toll-E is for drivers; this also keeps it outside the Families programme) |
| Content rating | See below |
| News app | No |
| COVID-19 contact tracing/status | No |
| Government app | No (and say so: Toll-E is independent) |
| Financial features | None |
| Health | None |
| Data safety | See below |

## Content rating questionnaire (IARC)

- Email: the support address. Category: **All Other App Types** (a reference/utility app).
- Violence, fear, sexuality, crude humour, language, controlled substances: **No** to all.
- Gambling or simulated gambling: **No**.
- Does the app let users interact or exchange content with other users? **No.** Correction reports go only to
  the developer.
- Does the app share the user's current location with other users? **No.**
- Does the app allow users to purchase digital goods? **Yes** if purchases are enabled in that build, otherwise
  **No**. If you answer No now, update the questionnaire before enabling purchases.
- Does the app contain unrestricted internet access (a web browser)? **No.**

Expected outcome: rated for everyone (e.g. PEGI 3 / ESRB Everyone).

## Data safety form

Answer for the build you are submitting. Google's own guidance for the AdMob SDK is at
<https://developers.google.com/admob/android/privacy/play-data-disclosure>. Check it, because Google updates it.

**Does your app collect or share any of the required user data types?** Yes.
**Is all of the user data collected by your app encrypted in transit?** Yes.
**Do you provide a way for users to request that their data is deleted?** Yes. Email support (see the support
page). On-device data is deleted by uninstalling.

| Data type | Collected | Shared | Optional? | Purposes | Why |
| --- | --- | --- | --- | --- | --- |
| Location → Approximate location | Yes | Yes (Google) | No | Advertising or marketing; Analytics; Fraud prevention, security and compliance | AdMob derives approximate location from the IP address |
| App activity → App interactions | Yes | Yes (Google) | No | Advertising or marketing; Analytics | AdMob ad interactions |
| App info and performance → Diagnostics | Yes | Yes (Google) | No | Analytics; Fraud prevention, security and compliance | AdMob SDK diagnostics |
| Device or other IDs | Yes | Yes (Google) | No | Advertising or marketing; Analytics; Fraud prevention, security and compliance | Advertising ID (AdMob); random install code sent with correction reports (spam prevention) |
| Personal info → Email address | Yes | No | **Yes** | App functionality; Developer communications | Only if the user adds it to a correction report |
| App activity → Other user-generated content | Yes | No | **Yes** | App functionality | Text of correction reports |
| Financial info → Purchase history | Only when purchases are enabled | No | Yes | App functionality | RevenueCat confirms and restores the ad-free purchase |

**Not collected:** precise location (location is used on the device only and never transmitted), contacts,
photos, files, messages, health data, web history, and no analytics or crash-reporting SDK.

Notes:
- Data that is processed only on the device (location, saved trips, settings) is not "collected" under Google's
  definitions.
- If purchases are off, leave "Purchase history" out.
- An ad-free user's device never starts the AdMob SDK, but the form describes the app as a whole, so keep the
  AdMob rows.
