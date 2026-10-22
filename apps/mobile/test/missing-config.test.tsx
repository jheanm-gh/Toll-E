import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen, waitFor } from '@testing-library/react-native';

/**
 * A production build with nothing configured: no Supabase, no AdMob unit ids, no RevenueCat
 * keys, purchases switched off. Every screen must still work on the built-in data.
 */
jest.mock('@/config/env', () => ({
  env: {
    supabaseUrl: null,
    supabaseAnonKey: null,
    mapStyleUrl: 'https://tiles.openfreemap.org/styles/positron',
    admobBannerAndroid: null,
    admobBannerIos: null,
    revenueCatIosKey: null,
    revenueCatAndroidKey: null,
    supportEmail: null,
    privacyPolicyUrl: null,
    termsUrl: null,
    enablePurchases: false,
    showUnverifiedJourneys: false,
  },
  appVersion: '1.0.0',
  buildProfile: 'production',
  isDevelopment: false,
  usesTestAds: false,
  backendConfigured: false,
  supabaseHeaders: () => ({}),
}));

/* eslint-disable import/first -- the mock above must be registered before these load */
import CalculateScreen from '@/app/(tabs)/calculate';
import HomeScreen from '@/app/(tabs)/index';
import MoreScreen from '@/app/(tabs)/more';
import RemoveAdsScreen from '@/app/remove-ads';
import { useAds } from '@/monetisation/ads/AdsProvider';

import { renderApp } from './render';
/* eslint-enable import/first */

describe('production build with no services configured', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('home renders on built-in data, with no ads and no unverified routes', async () => {
    let status = '';
    function AdsStatus() {
      status = useAds().status;
      return null;
    }
    await renderApp(
      <>
        <HomeScreen />
        <AdsStatus />
      </>,
    );
    expect(await screen.findByText('Price a trip')).toBeTruthy();
    expect(screen.queryByText('Quick estimates')).toBeNull();
    expect(screen.queryByText('Advertisement')).toBeNull();
    await waitFor(() => expect(status).toBe('unavailable'));
  });

  it('the calculator offers plaza-by-plaza pricing when no route is verified yet', async () => {
    await renderApp(<CalculateScreen />);
    expect(await screen.findByText('Choose your toll plazas')).toBeTruthy();
  });

  it('More hides purchase controls and says online updates are not configured', async () => {
    await renderApp(<MoreScreen />);
    expect(await screen.findByText(/Online updates are not configured/)).toBeTruthy();
    expect(screen.queryByText('Remove ads')).toBeNull();
    expect(screen.queryByText('Restore purchase')).toBeNull();
    expect(screen.queryByText('Developer')).toBeNull();
  });

  it('the remove-ads screen, if opened by link, has no purchase controls', async () => {
    await renderApp(<RemoveAdsScreen />);
    expect(await screen.findByText('Not offered in this version')).toBeTruthy();
    expect(screen.queryByText('Restore purchase')).toBeNull();
  });
});
