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

  // EAS sets EAS_BUILD_PLATFORM; only the platform being built needs its real AdMob app id.
  const platform = process.env.EAS_BUILD_PLATFORM;
  const missing = [
    platform !== 'ios' && androidAppId === ADMOB_SAMPLE_ANDROID ? 'ADMOB_ANDROID_APP_ID' : null,
    platform !== 'android' && iosAppId === ADMOB_SAMPLE_IOS ? 'ADMOB_IOS_APP_ID' : null,
  ].filter(Boolean);
  if (isProductionBuild && missing.length) {
    throw new Error(`Production builds need real AdMob app ids. Set ${missing.join(' and ')} in the EAS environment.`);
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
      // The others are added by the Expo template but not used by Toll-E.
      blockedPermissions: [
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
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
      './plugins/withoutLocationServices',
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
      // After `eas init`, paste the project id it prints here (it is not a secret), e.g.
      // eas: { projectId: '00000000-0000-0000-0000-000000000000' },
    },
  };
};
