import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { z } from 'zod';

import { env, isDevelopment } from '@/config/env';
import { usePreferences } from '@/state/preferences';
import { KEYS, readJson, writeJson } from '@/state/storage';

import { createRevenueCatService } from './revenuecat';
import { createSimulatedService, simulatedStore, type SimulatedChoice } from './simulated';
import type { PurchaseOutcome, PurchaseService, RestoreOutcome, StoreProduct } from './types';
import { createUnavailableService } from './unavailable';

/**
 * Owns the ad-free entitlement.
 *
 * - The last confirmed entitlement is cached on the device so ads do not flash on start-up
 *   and the entitlement survives restarts and offline use.
 * - The store is asked again on every start; a definite "not entitled" (e.g. a refund) removes
 *   the cached entitlement, while a network failure keeps it.
 * - A cancelled, failed or pending purchase never grants the entitlement.
 */
const cacheSchema = z.object({
  active: z.boolean(),
  source: z.enum(['revenuecat', 'simulated']),
  confirmedAt: z.string(),
});

interface EntitlementState {
  adFree: boolean;
  /** Whether the entitlement has been confirmed with the store during this session. */
  confirmedThisSession: boolean;
  serviceKind: PurchaseService['kind'];
  /**
   * Whether this build offers the purchase at all. False when the feature flag
   * EXPO_PUBLIC_ENABLE_PURCHASES is off or no store is configured: no purchase or restore
   * controls are shown then.
   */
  purchasesOffered: boolean;
  unavailableReason: string | null;
  product: StoreProduct | null;
  productStatus: 'idle' | 'loading' | 'ready' | 'missing' | 'error';
  purchase: () => Promise<PurchaseOutcome>;
  restore: () => Promise<RestoreOutcome>;
  reloadProduct: () => Promise<void>;
  /** Development only. */
  resetSimulatedPurchase: () => void;
  simulatedPrompt: boolean;
  answerSimulatedPrompt: (choice: SimulatedChoice) => void;
}

const Ctx = createContext<EntitlementState | null>(null);

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { simulatedStore: simulatedStoreEnabled, loaded: prefsLoaded } = usePreferences();
  // The service this session's entitlement was last confirmed with; switching service resets it.
  const [confirmedWith, setConfirmedWith] = useState<PurchaseService | null>(null);
  const [adFree, setAdFree] = useState(false);
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [productStatus, setProductStatus] = useState<EntitlementState['productStatus']>('idle');
  const simulatedPrompt = useSyncExternalStore(simulatedStore.subscribePrompt, simulatedStore.isPrompting, () => false);

  const service = useMemo<PurchaseService>(() => {
    if (isDevelopment && simulatedStoreEnabled) {
      return createSimulatedService();
    }
    if (!env.enablePurchases) {
      return createUnavailableService('Removing ads is not offered in this version of Toll-E.');
    }
    if (Platform.OS === 'web') {
      return createUnavailableService('Removing ads is available in the Toll-E iOS and Android apps.');
    }
    return (
      createRevenueCatService() ?? createUnavailableService('Store purchases are not set up in this build of Toll-E.')
    );
  }, [simulatedStoreEnabled]);
  const confirmedThisSession = confirmedWith === service;

  const persist = useCallback(
    (active: boolean) => {
      if (service.kind === 'unavailable') return;
      void writeJson(KEYS.entitlement, {
        active,
        source: service.kind,
        confirmedAt: new Date().toISOString(),
      });
    },
    [service.kind],
  );

  // Start-up: cached value first, then ask the store.
  useEffect(() => {
    if (!prefsLoaded) return;
    let cancelled = false;
    void (async () => {
      const cached = await readJson(KEYS.entitlement, cacheSchema);
      if (cancelled) return;
      if (cached && cached.source === service.kind) {
        if (service.kind === 'simulated') simulatedStore.setOwned(cached.active);
        setAdFree(cached.active);
      } else {
        setAdFree(false);
      }
      try {
        await service.configure();
      } catch {
        return;
      }
      const live = await service.getEntitlement();
      if (cancelled || live === null) return;
      setAdFree(live);
      setConfirmedWith(service);
      persist(live);
    })();
    const unsubscribe = service.onEntitlementChange((active) => {
      setAdFree(active);
      setConfirmedWith(service);
      persist(active);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [service, prefsLoaded, persist]);

  const reloadProduct = useCallback(async () => {
    if (service.kind === 'unavailable') {
      setProductStatus('missing');
      return;
    }
    setProductStatus('loading');
    try {
      await service.configure();
      const p = await service.getProduct();
      setProduct(p);
      setProductStatus(p ? 'ready' : 'missing');
    } catch {
      setProductStatus('error');
    }
  }, [service]);

  const purchase = useCallback(async () => {
    const outcome = await service.purchase();
    if (outcome.kind === 'success' || outcome.kind === 'already_owned') {
      const live = await service.getEntitlement();
      if (live !== null) {
        setAdFree(live);
        setConfirmedWith(service);
        persist(live);
      }
    }
    return outcome;
  }, [service, persist]);

  const restore = useCallback(async () => {
    const outcome = await service.restore();
    if (outcome.kind === 'restored') {
      setAdFree(true);
      setConfirmedWith(service);
      persist(true);
    }
    return outcome;
  }, [service, persist]);

  const value = useMemo<EntitlementState>(
    () => ({
      adFree,
      confirmedThisSession,
      serviceKind: service.kind,
      purchasesOffered: service.kind !== 'unavailable',
      unavailableReason: service.unavailableReason ?? null,
      product,
      productStatus,
      purchase,
      restore,
      reloadProduct,
      resetSimulatedPurchase: () => {
        simulatedStore.setOwned(false);
        setAdFree(false);
        void writeJson(KEYS.entitlement, {
          active: false,
          source: 'simulated',
          confirmedAt: new Date().toISOString(),
        });
      },
      simulatedPrompt,
      answerSimulatedPrompt: simulatedStore.answer,
    }),
    [adFree, confirmedThisSession, service, product, productStatus, purchase, restore, reloadProduct, simulatedPrompt],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlement(): EntitlementState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEntitlement must be used inside EntitlementProvider');
  return ctx;
}
