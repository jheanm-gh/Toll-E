import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { useEntitlement } from '@/monetisation/purchases/EntitlementProvider';
import type { PurchaseOutcome } from '@/monetisation/purchases/types';

import { renderApp } from './render';

/**
 * Purchase states, exercised through the development-only simulated store (the same
 * EntitlementProvider code path the real store uses).
 */
const latest: { value?: ReturnType<typeof useEntitlement> } = {};
function Probe() {
  const entitlement = useEntitlement();
  useEffect(() => {
    latest.value = entitlement;
  });
  return <Text testID="ad-free">{String(entitlement.adFree)}</Text>;
}
/** The entitlement context as of the last render. */
const current = new Proxy({} as ReturnType<typeof useEntitlement>, {
  get: (_t, key: keyof ReturnType<typeof useEntitlement>) => latest.value![key],
});

async function storedEntitlement() {
  const raw = await AsyncStorage.getItem('tolle.entitlement.v1');
  return raw ? (JSON.parse(raw) as { active: boolean }) : null;
}

async function buy(choice: 'approve' | 'cancel' | 'pending' | 'fail'): Promise<PurchaseOutcome> {
  let pending!: Promise<PurchaseOutcome>;
  await act(async () => {
    pending = current.purchase();
  });
  await waitFor(() => expect(current.simulatedPrompt).toBe(true));
  await act(async () => current.answerSimulatedPrompt(choice));
  let outcome!: PurchaseOutcome;
  await act(async () => {
    outcome = await pending;
  });
  return outcome;
}

describe('ad-free purchase', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('tolle.preferences.v1', JSON.stringify({ simulatedStore: true }));
    await renderApp(<Probe />);
    await waitFor(() => expect(current.known).toBe(true));
    // Each test starts from "not owned".
    await act(async () => current.resetSimulatedPurchase());
  });

  it.each(['cancel', 'pending', 'fail'] as const)('a %s purchase does not remove ads', async (choice) => {
    const outcome = await buy(choice);
    expect(outcome.kind).toBe(choice === 'fail' ? 'error' : choice === 'cancel' ? 'cancelled' : 'pending');
    expect(screen.getByTestId('ad-free').props.children).toBe('false');
    expect((await storedEntitlement())?.active ?? false).toBe(false);
  });

  it('an approved purchase removes ads and is remembered on the device', async () => {
    expect((await buy('approve')).kind).toBe('success');
    await waitFor(() => expect(screen.getByTestId('ad-free').props.children).toBe('true'));
    expect((await storedEntitlement())?.active).toBe(true);
  });

  it('restore finds an earlier purchase, and reports when there is nothing to restore', async () => {
    let outcome: unknown;
    await act(async () => {
      outcome = await current.restore();
    });
    expect(outcome).toEqual({ kind: 'nothing_to_restore' });
    await buy('approve');
    await act(async () => current.resetSimulatedPurchase());
    await buy('approve');
    await act(async () => {
      outcome = await current.restore();
    });
    expect(outcome).toEqual({ kind: 'restored' });
  });
});
