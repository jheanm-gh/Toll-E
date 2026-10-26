/**
 * Central monetisation configuration. Placements and products are defined here only, so
 * changing ad frequency or the product never requires touching screens.
 *
 * Placement policy (see docs/monetisation.md):
 * - Banners only. No interstitial, rewarded or app-open ads.
 * - At most one banner per screen, anchored to the bottom edge outside the scrolling content, so it never sits
 *   between toll information and never moves under the user's finger while scrolling.
 * - Never on the map tab (including its list view), the calculator, the purchase screen or the directions sheet,
 *   and never placed beside a navigation button: the banner sits at the screen edge, below a labelled rule.
 * - Always labelled "Advertisement" and separated from toll information.
 */
export type AdPlacementId = 'home_footer' | 'directory_footer' | 'plaza_detail_footer';

export interface AdPlacement {
  enabled: boolean;
  description: string;
}

export const AD_PLACEMENTS: Record<AdPlacementId, AdPlacement> = {
  home_footer: { enabled: true, description: 'Fixed to the bottom of the home screen, above the tab bar.' },
  directory_footer: { enabled: true, description: 'Fixed to the bottom of the plaza list (not the map tab’s list).' },
  plaza_detail_footer: { enabled: true, description: 'Fixed to the bottom of a plaza page.' },
};

/** Master switch, e.g. to pause ads during an incident. */
export const ADS_ENABLED = true;

export const AD_FREE_PRODUCT = {
  /** Store product identifier (App Store Connect and Google Play Console). Non-consumable. */
  productId: 'tolle_ad_free_lifetime',
  /** RevenueCat entitlement identifier. */
  entitlementId: 'ad_free',
} as const;
