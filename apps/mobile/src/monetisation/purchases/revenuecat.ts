import type { PurchaseService } from './types';

/** Web and other platforms: in-app purchases are only offered in the iOS and Android apps. */
export function createRevenueCatService(): PurchaseService | null {
  return null;
}

export function revenueCatApiKey(): string | null {
  return null;
}
