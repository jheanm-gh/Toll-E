import { AD_FREE_PRODUCT } from '../config';

import type { PurchaseOutcome, PurchaseService } from './types';

/**
 * DEVELOPMENT ONLY. Lets the purchase screen, entitlement persistence and ad removal be tested
 * without store accounts. Clearly labelled as simulated everywhere it appears; never created
 * in production builds (see createPurchaseService).
 */
export type SimulatedChoice = 'approve' | 'cancel' | 'pending' | 'fail';

let owned = false;
let answerPrompt: ((choice: SimulatedChoice) => void) | null = null;
const promptListeners = new Set<() => void>();
const notifyPrompt = () => promptListeners.forEach((l) => l());

/** The simulated store's state lives outside React so it survives re-renders and re-creation of the service. */
export const simulatedStore = {
  isOwned: () => owned,
  setOwned: (v: boolean) => {
    owned = v;
  },
  /** Whether the simulated "store sheet" should be showing. */
  isPrompting: () => answerPrompt !== null,
  subscribePrompt: (listener: () => void) => {
    promptListeners.add(listener);
    return () => {
      promptListeners.delete(listener);
    };
  },
  answer: (choice: SimulatedChoice) => {
    const resolve = answerPrompt;
    answerPrompt = null;
    notifyPrompt();
    resolve?.(choice);
  },
};

function choose(): Promise<SimulatedChoice> {
  answerPrompt?.('cancel');
  return new Promise<SimulatedChoice>((resolve) => {
    answerPrompt = resolve;
    notifyPrompt();
  });
}

export function createSimulatedService(): PurchaseService {
  const listeners = new Set<(active: boolean) => void>();
  const emit = (v: boolean) => listeners.forEach((l) => l(v));
  return {
    kind: 'simulated',
    configure: async () => {},
    getProduct: async () => ({
      id: AD_FREE_PRODUCT.productId,
      title: 'Remove ads (simulated)',
      description: 'Simulated product for development builds.',
      priceString: 'R49.99 (simulated)',
    }),
    purchase: async (): Promise<PurchaseOutcome> => {
      if (owned) return { kind: 'already_owned' };
      const choice = await choose();
      switch (choice) {
        case 'approve':
          owned = true;
          emit(true);
          return { kind: 'success' };
        case 'cancel':
          return { kind: 'cancelled' };
        case 'pending':
          return { kind: 'pending' };
        case 'fail':
          return { kind: 'error', message: 'Simulated store error.' };
      }
    },
    restore: async () => (owned ? { kind: 'restored' } : { kind: 'nothing_to_restore' }),
    getEntitlement: async () => owned,
    onEntitlementChange: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
