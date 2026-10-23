# Building the Android release

Toll-E is built with [EAS Build](https://docs.expo.dev/build/introduction/) into a signed Android App Bundle
(`.aab`) for Google Play. **No EAS build has been run yet** (that needs your Expo account). On 23 October 2026
the same native project was compiled locally into a release `.aab` (arm64 only, debug-signed). That shows the
native code, plugins and JavaScript bundle build cleanly. The app has not yet been run on a phone or emulator.

## Build profiles (`apps/mobile/eas.json`)

| Profile | Output | Ads | Routes with unverified plaza sequences | Developer menu | Use for |
| --- | --- | --- | --- | --- | --- |
| `development` | APK with dev client | Google test ads | Shown, labelled | Yes | Day-to-day development on a phone |
| `preview` | APK | Google test ads | Shown, labelled | Yes | Sharing a test build directly |
| `closed-test` | **AAB** | Google test ads | Shown, labelled | No | Google Play closed test (12 testers × 14 days) |
| `production` | **AAB** | Real AdMob unit | **Hidden** | No | The public release, once `npm run release:check` passes |

Version codes are managed by EAS (`appVersionSource: remote`) and increase automatically for `closed-test` and
`production` builds. The user-visible version is `version` in `app.config.ts` (currently `0.1.0`); raise it for
each public release.

## One-time set-up

1. **Expo account**: create a free account at [expo.dev](https://expo.dev). The free plan includes a monthly
   allowance of builds. Check the current limits on Expo's pricing page.
2. **Install and sign in**, from the repository root:

   ```
   npm ci
   cd apps/mobile
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

   `init` creates the project on expo.dev and prints a project id. Paste it into `app.config.ts` where the
   comment says `eas: { projectId: … }`.

3. **Choose the package name. It is permanent once uploaded to Play.** The default is `za.co.tolle.app`. To use
   another (for example `io.github.jheanmgh.tolle`), set `TOLLE_BUNDLE_ID` in the EAS environment variables for
   every environment *before the first upload*.

4. **Environment variables**: expo.dev → project → *Environment variables*. All of these are public
   configuration, not secrets (the Supabase key is the restricted "anon" key; never use the service-role key).

   | Variable | preview | production | Value |
   | --- | --- | --- | --- |
   | `EXPO_PUBLIC_SUPABASE_URL` | ✓ | ✓ | Supabase → Project settings → API → Project URL |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ | Supabase → Project settings → API → `anon` `public` key |
   | `EXPO_PUBLIC_SUPPORT_EMAIL` | ✓ | ✓ | The support address |
   | `EXPO_PUBLIC_PRIVACY_POLICY_URL` | ✓ | ✓ | `https://jheanm-gh.github.io/Toll-E/privacy.html` |
   | `EXPO_PUBLIC_TERMS_URL` | ✓ | ✓ | `https://jheanm-gh.github.io/Toll-E/terms.html` |
   | `ADMOB_ANDROID_APP_ID` | | ✓ | AdMob app id ([monetisation.md](../monetisation.md)) |
   | `EXPO_PUBLIC_ADMOB_BANNER_ANDROID` | | ✓ | AdMob banner unit id |
   | `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | ✓ | ✓ | Only when enabling purchases |
   | `EXPO_PUBLIC_ENABLE_PURCHASES` | ✓ | ✓ | `true` only after a licence-tester purchase works |

   The `closed-test` profile uses the *production* environment's variables, but it always shows test ads and
   shows unverified routes (labelled).

5. **Signing**: on the first build, EAS asks to generate an Android keystore. Answer **yes**. EAS stores this
   *upload key*. Google Play then holds the real app-signing key (Play App Signing, the default for new apps).
   Download a backup of the keystore from expo.dev → project → *Credentials* and keep it somewhere safe.

6. **Supabase backend**: see [backend-setup.md](backend-setup.md). Without it, the app runs on the toll data
   built into it and says so.

## Building

Before every build, from the repository root:

```
npm run check          # format, lint, typecheck, data validation, unit tests
npm run test:db        # database tests (needs PostgreSQL 16 installed locally)
```

Closed test:

```
cd apps/mobile
npx eas-cli@latest build --platform android --profile closed-test
```

Production, only once `npm run release:check` reports **ready**:

```
npx eas-cli@latest build --platform android --profile production
```

The build runs on Expo's servers (about 15–30 minutes on the free plan's queue). When it finishes, download
the `.aab` from the link it prints.

## Local native build (optional, for developers)

To check native changes without using EAS build minutes. This was done on 23 October 2026: `BUILD SUCCESSFUL`
in 16 minutes, producing a 46 MB arm64 `app-release.aab`.

Requirements: the Android SDK (platform 37, build-tools 37.0.0, NDK 27.1.12297006, CMake 3.22.1), **JDK 17**
(React Native's Gradle plugin requires it, even if a newer JDK runs Gradle) and about 10 GB free disk.

```
cd apps/mobile
npx expo prebuild --platform android      # generates android/ (git-ignored)
cd android
./gradlew -PreactNativeArchitectures=arm64-v8a :app:bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab (signed with the debug key; not for upload)
```

Check the merged permissions in
`android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml`. As of the
last build: location (coarse and fine, foreground only), internet, network state, vibrate, wake lock, the advertising
ID permissions added by AdMob, `BILLING` from the purchase library, and `FOREGROUND_SERVICE` from AndroidX
WorkManager (a dependency of Google's libraries). There are no foreground-service *types*: a config plugin
(`plugins/withoutLocationServices.js`) removes expo-location's unused background location services.

## Uploading to Google Play

The first upload must be done by hand in Play Console. See [google-play-checklist.md](google-play-checklist.md):
**Test and release → Testing → Closed testing → Create release → upload the `.aab`**.

`eas.json` has a `submit` profile that targets the internal track as a draft. You can use it later with a Play
service account (`npx eas-cli@latest submit -p android`), but it is never run automatically.

## Smoke test on a phone

On the first closed-test build, check by hand:

- [ ] Home shows notices, quick estimates and "Built into this app version" (or "Updated from the Toll-E server").
- [ ] Plaza list: search "Machado" → plaza page shows Classes 1–4 with "Unverified" badges and sources.
- [ ] Map: plazas appear; with flight mode on, the offline outline appears with its banner.
- [ ] Calculator: Johannesburg → Durban, Class 4, return → total shown as an estimate, five plazas each way.
- [ ] "Near me" asks for location only when tapped; denying it shows a message, not a crash.
- [ ] A banner labelled "Advertisement" appears at the bottom of Home and is a **Test Ad**.
- [ ] More → Privacy: "Ad privacy choices" appears only for EEA/UK users.
- [ ] Directions opens Google Maps or Waze at the plaza.
- [ ] Report incorrect information sends (with Supabase configured) or opens email.
- [ ] Send the app to the background and reopen it; switch flight mode on and off.

Record anything that differs in the closed-test feedback and fix it before the production build.
