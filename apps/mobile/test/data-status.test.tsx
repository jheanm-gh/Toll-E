import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen } from '@testing-library/react-native';

import { DataStatus } from '@/components/plaza/DataStatus';
import bundled from '@/data/generated/dataset.json';

import { network } from './mocks';
import { renderApp } from './render';

describe('data status line', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    network.isConnected = true;
    network.isInternetReachable = true;
  });

  it('says the data is built into the app when nothing has been downloaded', async () => {
    await renderApp(<DataStatus />);
    expect(await screen.findByText(/Built into this app version/)).toBeTruthy();
  });

  it('labels downloaded data saved on the device with its retrieval date', async () => {
    await AsyncStorage.setItem(
      'tolle.dataset-cache.v1',
      JSON.stringify({ retrievedAt: '2026-10-20T08:00:00.000Z', dataset: bundled }),
    );
    await renderApp(<DataStatus />);
    expect(await screen.findByText(/Saved on this device · downloaded 20 October 2026/)).toBeTruthy();
  });

  it('ignores a corrupt cache and falls back to the built-in data', async () => {
    await AsyncStorage.setItem('tolle.dataset-cache.v1', JSON.stringify({ retrievedAt: 'x', dataset: { nope: 1 } }));
    await renderApp(<DataStatus />);
    expect(await screen.findByText(/Built into this app version/)).toBeTruthy();
  });

  it('says when the device is offline', async () => {
    network.isConnected = false;
    network.isInternetReachable = false;
    await renderApp(<DataStatus />);
    expect(await screen.findByText(/^Offline · /)).toBeTruthy();
  });
});
