import Constants from 'expo-constants';

/**
 * Runtime configuration from EXPO_PUBLIC_* variables. Each must be referenced literally so
 * Expo can inline it at build time. Missing values switch features to an explicit
 * "not configured" state instead of failing.
 */
const clean = (v: string | undefined) => (v && v.trim() !== '' ? v.trim() : null);

export const env = {
  supabaseUrl: clean(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: clean(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  mapStyleUrl: clean(process.env.EXPO_PUBLIC_MAP_STYLE_URL) ?? 'https://tiles.openfreemap.org/styles/positron',
  admobBannerAndroid: clean(process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID),
  admobBannerIos: clean(process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS),
  revenueCatIosKey: clean(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY),
  revenueCatAndroidKey: clean(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY),
  supportEmail: clean(process.env.EXPO_PUBLIC_SUPPORT_EMAIL),
  privacyPolicyUrl: clean(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL),
  termsUrl: clean(process.env.EXPO_PUBLIC_TERMS_URL),
  /** Feature flag: offer the ad-free purchase. Off until the store product can be test-purchased. */
  enablePurchases: process.env.EXPO_PUBLIC_ENABLE_PURCHASES === 'true',
  /** Test builds only: also offer journeys whose plaza sequence is not yet verified (labelled as such). */
  showUnverifiedJourneys: process.env.EXPO_PUBLIC_SHOW_UNVERIFIED_JOURNEYS === 'true',
} as const;

export const appVersion = Constants.expoConfig?.version ?? '0.0.0';
export const buildProfile = (Constants.expoConfig?.extra?.buildProfile as string | undefined) ?? 'local';

/** True for Metro development and EAS development/preview builds. */
export const isDevelopment = __DEV__ || buildProfile === 'development' || buildProfile === 'preview';

/**
 * Every build except the EAS production profile shows Google's test ads, including the
 * closed-test build that testers install from Google Play, so real ad inventory is never
 * used for testing.
 */
export const usesTestAds = buildProfile !== 'production';

export const backendConfigured = !!(env.supabaseUrl && env.supabaseAnonKey);

/**
 * Request headers for the public Supabase API. Works with both kinds of public key: a legacy
 * "anon" key (a JWT, also sent as the bearer token) and a newer publishable key (sb_publishable_…),
 * which is not a JWT and must only be sent as `apikey`.
 */
export function supabaseHeaders(): Record<string, string> {
  const key = env.supabaseAnonKey ?? '';
  return key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}
