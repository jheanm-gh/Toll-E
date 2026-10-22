import { Platform } from 'react-native';

import { env } from '@/config/env';

import { AD_FREE_PRODUCT } from '../config';

import type { PurchaseOutcome, PurchaseService, RestoreOutcome, StoreProduct } from './types';

type RC = typeof import('react-native-purchases').default;
type ErrorCodes = typeof import('react-native-purchases').PURCHASES_ERROR_CODE;

function load(): { Purchases: RC; codes: ErrorCodes; category: string } | null {
  try {
    // Required lazily so a build without the native module (e.g. Expo Go) degrades cleanly.
    // Lazy on purpose: a build without the native module must degrade, not crash.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases') as typeof import('react-native-purchases');
    return {
      Purchases: mod.default,
      codes: mod.PURCHASES_ERROR_CODE,
      category: mod.PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    };
  } catch {
    return null;
  }
}

export function revenueCatApiKey(): string | null {
  return Platform.OS === 'ios' ? env.revenueCatIosKey : Platform.OS === 'android' ? env.revenueCatAndroidKey : null;
}

/** RevenueCat-backed service. Receipt validation and restore are handled by RevenueCat's backend. */
export function createRevenueCatService(): PurchaseService | null {
  const apiKey = revenueCatApiKey();
  const rc = load();
  if (!apiKey || !rc) return null;
  const { Purchases, codes, category } = rc;
  let product: Awaited<ReturnType<RC['getProducts']>>[number] | null = null;
  let configured = false;

  const hasEntitlement = (info: { entitlements: { active: Record<string, unknown> } }) =>
    info.entitlements.active[AD_FREE_PRODUCT.entitlementId] !== undefined;

  const classify = (e: unknown): { code?: string; message: string; userCancelled?: boolean } => {
    const err = e as { code?: string; message?: string; userCancelled?: boolean | null };
    return {
      code: err?.code,
      message: err?.message ?? 'The store reported an error.',
      userCancelled: !!err?.userCancelled,
    };
  };
  const isOffline = (code?: string) => code === codes.NETWORK_ERROR || code === codes.OFFLINE_CONNECTION_ERROR;

  return {
    kind: 'revenuecat',
    async configure() {
      if (configured) return;
      Purchases.configure({ apiKey });
      configured = true;
    },
    async getProduct(): Promise<StoreProduct | null> {
      const products = await Purchases.getProducts([AD_FREE_PRODUCT.productId], category as never);
      product = products[0] ?? null;
      return product
        ? {
            id: product.identifier,
            title: product.title,
            description: product.description,
            priceString: product.priceString,
          }
        : null;
    },
    async purchase(): Promise<PurchaseOutcome> {
      try {
        if (!product) await this.getProduct();
        if (!product)
          return {
            kind: 'error',
            message: 'The ad-free product is not available in your store right now.',
          };
        const { customerInfo } = await Purchases.purchaseStoreProduct(product);
        if (hasEntitlement(customerInfo)) return { kind: 'success' };
        // The store accepted the payment but the entitlement is not active (usually a store or
        // dashboard configuration issue). Never treat this as success; tell the user to restore.
        return {
          kind: 'error',
          message:
            'The store completed the payment but ad removal was not confirmed. Tap “Restore purchase”, or contact support if this persists.',
        };
      } catch (e) {
        const err = classify(e);
        if (err.userCancelled || err.code === codes.PURCHASE_CANCELLED_ERROR) return { kind: 'cancelled' };
        if (err.code === codes.PAYMENT_PENDING_ERROR) return { kind: 'pending' };
        if (err.code === codes.PRODUCT_ALREADY_PURCHASED_ERROR) return { kind: 'already_owned' };
        return { kind: 'error', message: err.message, offline: isOffline(err.code) };
      }
    },
    async restore(): Promise<RestoreOutcome> {
      try {
        const info = await Purchases.restorePurchases();
        return hasEntitlement(info) ? { kind: 'restored' } : { kind: 'nothing_to_restore' };
      } catch (e) {
        const err = classify(e);
        return { kind: 'error', message: err.message, offline: isOffline(err.code) };
      }
    },
    async getEntitlement() {
      try {
        return hasEntitlement(await Purchases.getCustomerInfo());
      } catch {
        return null;
      }
    },
    onEntitlementChange(listener) {
      const l = (info: Parameters<Parameters<RC['addCustomerInfoUpdateListener']>[0]>[0]) =>
        listener(hasEntitlement(info));
      Purchases.addCustomerInfoUpdateListener(l);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(l);
      };
    },
  };
}
