import type { PurchaseService } from './types';

export function createUnavailableService(reason: string): PurchaseService {
  return {
    kind: 'unavailable',
    unavailableReason: reason,
    configure: async () => {},
    getProduct: async () => null,
    purchase: async () => ({ kind: 'error', message: reason }),
    restore: async () => ({ kind: 'error', message: reason }),
    getEntitlement: async () => null,
    onEntitlementChange: () => () => {},
  };
}
