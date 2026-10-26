import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import MoreScreen from '@/app/(tabs)/more';
import SavedScreen from '@/app/(tabs)/saved';

import { renderApp } from './render';

const KEY = 'tolle.saved.v1';

const calc = (id: string, label: string) => ({
  id,
  savedAt: '2026-10-20T08:00:00.000Z',
  label,
  request: {
    mode: 'manual',
    plazaIds: ['n4-machado'],
    includeConditional: [],
    trip: 'one_way',
    standardClass: 'class1',
    date: null,
  },
  snapshot: {
    totalCents: 12_600,
    confidence: 'estimate',
    pricedCount: 1,
    chargeableCount: 1,
    tariffDate: '2026-10-20',
    datasetVersion: 'test',
  },
});

async function stored() {
  return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as Record<string, unknown[]>;
}

describe('clearing history and saved items', () => {
  let answer: 'confirm' | 'cancel';

  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        favouritePlazaIds: ['n3-mooi'],
        savedCalculations: [calc('s1', 'Work trip')],
        recentCalculations: [calc('r1', 'Machado one way')],
        recentPlazaIds: ['n4-machado', 'n3-mooi'],
      }),
    );
    answer = 'confirm';
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const button = buttons?.find((b) => (answer === 'confirm' ? b.style === 'destructive' : b.style === 'cancel'));
      button?.onPress?.();
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('clears history from More but keeps saved trips and favourites', async () => {
    await renderApp(<MoreScreen />);
    expect(await screen.findByText('1 recent calculation and 2 recently viewed plazas')).toBeTruthy();

    answer = 'cancel';
    await fireEvent.press(screen.getByText('Clear history'));
    expect((await stored()).recentPlazaIds).toHaveLength(2);

    answer = 'confirm';
    await fireEvent.press(screen.getByText('Clear history'));
    expect(await screen.findByText('No history on this device')).toBeTruthy();
    const s = await stored();
    expect(s.recentCalculations).toEqual([]);
    expect(s.recentPlazaIds).toEqual([]);
    expect(s.savedCalculations).toHaveLength(1);
    expect(s.favouritePlazaIds).toEqual(['n3-mooi']);
  });

  it('deletes every saved item from More after confirmation', async () => {
    await renderApp(<MoreScreen />);
    await fireEvent.press(await screen.findByText('Delete all saved items'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete all saved items?',
      expect.stringContaining('cannot be undone'),
      expect.any(Array),
    );
    expect(await screen.findByText('Nothing saved on this device')).toBeTruthy();
    expect(await stored()).toEqual({
      favouritePlazaIds: [],
      savedCalculations: [],
      recentCalculations: [],
      recentPlazaIds: [],
    });
  });

  it('clears recent calculations and recently viewed plazas separately on the Saved screen', async () => {
    await renderApp(<SavedScreen />);
    await fireEvent.press(await screen.findByLabelText('Clear recently viewed plazas'));
    await waitFor(() => expect(screen.queryByText('Recently viewed plazas')).toBeNull());
    expect(screen.getByText('Recent calculations')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Clear recent calculations'));
    await waitFor(() => expect(screen.queryByText('Recent calculations')).toBeNull());
    expect(screen.getByText('Saved trips')).toBeTruthy();
    expect(screen.getByText('Favourite plazas')).toBeTruthy();
  });
});
