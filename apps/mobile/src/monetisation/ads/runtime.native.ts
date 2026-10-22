import { Platform } from 'react-native';

import { env, isDevelopment } from '@/config/env';

type RNGMA = typeof import('react-native-google-mobile-ads');

let mod: RNGMA | null | undefined;
function sdk(): RNGMA | null {
  if (mod !== undefined) return mod;
  try {
    // Lazy on purpose: a build without the native module must degrade, not crash.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('react-native-google-mobile-ads') as RNGMA;
  } catch {
    mod = null;
  }
  return mod;
}

export const adsSupported = () => sdk() !== null;

/**
 * Banner unit id. Development and preview builds ALWAYS use Google's test unit so real
 * inventory is never used for testing. Production uses the configured unit or shows no ads.
 */
export function bannerUnitId(): string | null {
  const s = sdk();
  if (!s) return null;
  if (isDevelopment) return s.TestIds.ADAPTIVE_BANNER;
  return Platform.OS === 'ios' ? env.admobBannerIos : Platform.OS === 'android' ? env.admobBannerAndroid : null;
}

export interface AdsInitResult {
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
}

/** Gather consent (Google UMP, shown only where required) and then start the SDK. */
export async function initialiseAds(): Promise<AdsInitResult> {
  const s = sdk();
  if (!s) return { canRequestAds: false, privacyOptionsRequired: false };
  let info: Awaited<ReturnType<RNGMA['AdsConsent']['gatherConsent']>>;
  try {
    info = await s.AdsConsent.gatherConsent();
  } catch {
    // Consent service unreachable (offline): fall back to whatever was previously stored.
    info = await s.AdsConsent.getConsentInfo();
  }
  if (info.canRequestAds) {
    await s.default().initialize();
  }
  return {
    canRequestAds: info.canRequestAds,
    privacyOptionsRequired:
      info.privacyOptionsRequirementStatus === s.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
  };
}

export async function showPrivacyOptions(): Promise<AdsInitResult | null> {
  const s = sdk();
  if (!s) return null;
  const info = await s.AdsConsent.showPrivacyOptionsForm();
  return {
    canRequestAds: info.canRequestAds,
    privacyOptionsRequired:
      info.privacyOptionsRequirementStatus === s.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
  };
}
