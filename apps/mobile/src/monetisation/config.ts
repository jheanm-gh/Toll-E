/**
 * Central monetisation configuration. Placements and products are defined here only, so
 * changing ad frequency or the product never requires touching screens.
 *
 * Placement policy (see docs/monetisation.md):
 * - Banners only. No interstitial, rewarded or app-open ads.
 * - Never on the map, the calculator, the purchase screen, or next to navigation actions.
 * - Always labelled "Advertisement" and separated from toll information.
 */
export type AdPlacementId = 'home_footer' | 'directory_inline' | 'plaza_detail_footer';

export interface AdPlacement {
  enabled: boolean;
  description: string;
  /** For list placements: show a single banner after this many results (never more than one). */
  afterItems?: number;
}

export const AD_PLACEMENTS: Record<AdPlacementId, AdPlacement> = {
  home_footer: { enabled: true, description: 'Bottom of the home screen, below notices and shortcuts.' },
  directory_inline: { enabled: true, afterItems: 8, description: 'One banner after the 8th result in the plaza list.' },
  plaza_detail_footer: { enabled: true, description: 'Bottom of a plaza page, below sources.' },
};

/** Master switch, e.g. to pause ads during an incident. */
export const ADS_ENABLED = true;

export const AD_FREE_PRODUCT = {
  /** Store product identifier (App Store Connect and Google Play Console). Non-consumable. */
  productId: 'tolle_ad_free_lifetime',
  /** RevenueCat entitlement identifier. */
  entitlementId: 'ad_free',
} as const;
