export interface StoreProduct {
  id: string;
  title: string;
  description: string;
  /** Localised price exactly as the store reports it, e.g. "R49,99". Never hardcoded. */
  priceString: string;
}

export type PurchaseOutcome =
  | { kind: 'success' }
  | { kind: 'cancelled' }
  /** e.g. Google Play "slow card" or Ask to Buy. Ads are removed when the store confirms. */
  | { kind: 'pending' }
  | { kind: 'already_owned' }
  | { kind: 'error'; message: string; offline?: boolean };

export type RestoreOutcome =
  { kind: 'restored' } | { kind: 'nothing_to_restore' } | { kind: 'error'; message: string; offline?: boolean };

export type PurchaseServiceKind = 'revenuecat' | 'simulated' | 'unavailable';

export interface PurchaseService {
  readonly kind: PurchaseServiceKind;
  /** Why purchases cannot be made, when kind is 'unavailable'. */
  readonly unavailableReason?: string;
  configure(): Promise<void>;
  getProduct(): Promise<StoreProduct | null>;
  purchase(): Promise<PurchaseOutcome>;
  restore(): Promise<RestoreOutcome>;
  /** true/false when the store answered; null when it could not be reached. */
  getEntitlement(): Promise<boolean | null>;
  onEntitlementChange(listener: (active: boolean) => void): () => void;
}
