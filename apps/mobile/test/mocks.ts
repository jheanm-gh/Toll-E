import { View } from 'react-native';
import { createElement } from 'react';

/** Mutable state read by the fakes in test/setup.ts. Reset in beforeEach where it matters. */
export const network: { isConnected: boolean | undefined; isInternetReachable: boolean | undefined } = {
  isConnected: true,
  isInternetReachable: true,
};

export const routeParams: Record<string, string | undefined> = {};

export const consent = { canRequestAds: true };
export const adsInitialize = jest.fn(async () => []);

export const googleMobileAds = {
  __esModule: true,
  default: () => ({ initialize: adsInitialize }),
  TestIds: { ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/9214589741', BANNER: 'test-banner' },
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
  BannerAd: (props: { unitId: string }) =>
    createElement(View, { testID: 'banner-ad', accessibilityLabel: props.unitId }),
  AdsConsent: {
    gatherConsent: jest.fn(async () => ({
      canRequestAds: consent.canRequestAds,
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    })),
    getConsentInfo: jest.fn(async () => ({
      canRequestAds: consent.canRequestAds,
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    })),
    showPrivacyOptionsForm: jest.fn(async () => ({
      canRequestAds: consent.canRequestAds,
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    })),
  },
  AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED', NOT_REQUIRED: 'NOT_REQUIRED' },
};
