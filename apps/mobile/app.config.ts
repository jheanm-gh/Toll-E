import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Toll-E app configuration.
 *
 * Build-time variables (native config, not secrets):
 *   TOLLE_BUNDLE_ID        reverse-DNS app id (replace before the first store submission)
 *   ADMOB_ANDROID_APP_ID   AdMob app id for Android  (ca-app-pub-…~…)
 *   ADMOB_IOS_APP_ID       AdMob app id for iOS
 * Runtime variables are EXPO_PUBLIC_* (see .env.example) and are bundled into the app, so they
 * must never contain secrets.
 */

// Google's published sample AdMob app ids — safe for development, never for release.
const ADMOB_SAMPLE_ANDROID = 'ca-app-pub-3940256099942544~3347511713';
const ADMOB_SAMPLE_IOS = 'ca-app-pub-3940256099942544~1458002511';

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE ?? 'local';
  const isProductionBuild = profile === 'production';
  const bundleId = process.env.TOLLE_BUNDLE_ID ?? 'za.co.tolle.app';
  const androidAppId = process.env.ADMOB_ANDROID_APP_ID ?? ADMOB_SAMPLE_ANDROID;
  const iosAppId = process.env.ADMOB_IOS_APP_ID ?? ADMOB_SAMPLE_IOS;

  if (isProductionBuild && (androidAppId === ADMOB_SAMPLE_ANDROID || iosAppId === ADMOB_SAMPLE_IOS)) {
    throw new Error(
      'Production builds need real AdMob app ids. Set ADMOB_ANDROID_APP_ID and ADMOB_IOS_APP_ID in the EAS environment.',
    );
  }

  return {
    ...config,
    name: 'Toll-E',
    slug: 'toll-e',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'tolle',
    userInterfaceStyle: 'light',
    backgroundColor: '#F6F4EF',
    ios: {
      bundleIdentifier: bundleId,
      supportsTablet: false,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: bundleId,
      adaptiveIcon: {
        backgroundColor: '#0B1F3A',
        foregroundImage: './assets/images/android-icon-foreground.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      // Location is only ever requested in the foreground, when the user asks for nearby plazas.
      blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION'],
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'single',
      favicon: './assets/images/favicon.png',
      name: 'Toll-E',
      themeColor: '#0B1F3A',
      backgroundColor: '#F6F4EF',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#0B1F3A',
          image: './assets/images/splash-icon.png',
          imageWidth: 120,
        },
      ],
      '@maplibre/maplibre-react-native',
      [
        'react-native-google-mobile-ads',
        {
          androidAppId,
          iosAppId,
          // Measurement starts only after the consent flow has run.
          delayAppMeasurementInit: true,
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Toll-E uses your location only when you ask to see toll plazas near you. It is not stored or shared.',
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      buildProfile: profile,
    },
  };
};
