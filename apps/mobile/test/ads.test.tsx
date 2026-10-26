import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen, waitFor, within } from '@testing-library/react-native';
import { Text } from 'react-native';

import HomeScreen from '@/app/(tabs)/index';
import PlazaScreen from '@/app/plazas/[id]';
import PlazaListScreen from '@/app/plazas/index';
import { PlazaDirectory } from '@/components/plaza/PlazaDirectory';
import { AdSlot } from '@/monetisation/ads/AdSlot';
import { useAds } from '@/monetisation/ads/AdsProvider';

import { adsInitialize, consent, routeParams } from './mocks';
import { renderApp } from './render';

function Status() {
  return <Text testID="ads-status">{useAds().status}</Text>;
}

const TEST_BANNER = 'ca-app-pub-3940256099942544/9214589741';

describe('banner ads', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    adsInitialize.mockClear();
    consent.canRequestAds = true;
  });

  it('shows a labelled banner using Google test inventory outside production', async () => {
    await renderApp(
      <>
        <AdSlot placement="home_footer" />
        <Status />
      </>,
    );
    expect(await screen.findByTestId('ad-slot-home_footer')).toBeTruthy();
    expect(screen.getByText('Advertisement')).toBeTruthy();
    expect(screen.getByTestId('banner-ad').props.accessibilityLabel).toBe(TEST_BANNER);
  });

  it('shows no ad and never starts the ads SDK for an ad-free user', async () => {
    await AsyncStorage.setItem('tolle.preferences.v1', JSON.stringify({ simulatedStore: true }));
    await AsyncStorage.setItem(
      'tolle.entitlement.v1',
      JSON.stringify({ active: true, source: 'simulated', confirmedAt: '2026-10-01T00:00:00.000Z' }),
    );
    await renderApp(
      <>
        <AdSlot placement="home_footer" />
        <Status />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId('ads-status').props.children).toBe('ad_free'));
    expect(screen.queryByTestId('ad-slot-home_footer')).toBeNull();
    expect(adsInitialize).not.toHaveBeenCalled();
  });

  it('requests no ads when consent is not given', async () => {
    consent.canRequestAds = false;
    await renderApp(
      <>
        <AdSlot placement="home_footer" />
        <Status />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId('ads-status').props.children).toBe('no_consent'));
    expect(screen.queryByTestId('ad-slot-home_footer')).toBeNull();
    expect(adsInitialize).not.toHaveBeenCalled();
  });
});

describe('banner position', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    consent.canRequestAds = true;
  });
  afterEach(() => {
    delete routeParams.id;
  });

  // The banner sits below the scrolling content, so it stays on screen while the content scrolls.
  it('anchors the home banner below the scrolling content', async () => {
    await renderApp(<HomeScreen />);
    expect(await screen.findByTestId('ad-slot-home_footer')).toBeTruthy();
    expect(within(screen.getByTestId('home-scroll')).queryByTestId('ad-slot-home_footer')).toBeNull();
  });

  it('anchors the plaza list banner below the list, not between results', async () => {
    await renderApp(<PlazaListScreen />);
    expect(await screen.findByTestId('ad-slot-directory_footer')).toBeTruthy();
    expect(within(screen.getByTestId('plaza-list')).queryByTestId(/^ad-slot-/)).toBeNull();
  });

  it('anchors the plaza page banner below the page', async () => {
    routeParams.id = 'n4-machado';
    await renderApp(<PlazaScreen />);
    expect(await screen.findByTestId('ad-slot-plaza_detail_footer')).toBeTruthy();
    expect(within(screen.getByTestId('plaza-scroll')).queryByTestId(/^ad-slot-/)).toBeNull();
  });

  it('shows no banner with the list on the map tab', async () => {
    await renderApp(
      <>
        <PlazaDirectory />
        <Status />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId('ads-status').props.children).toBe('ready'));
    expect(screen.queryByTestId(/^ad-slot-/)).toBeNull();
  });
});
