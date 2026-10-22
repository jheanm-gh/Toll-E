/** Web: Toll-E shows no ads in the browser build. */
export const adsSupported = () => false;
export const bannerUnitId = (): string | null => null;
export interface AdsInitResult {
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
}
export async function initialiseAds(): Promise<AdsInitResult> {
  return { canRequestAds: false, privacyOptionsRequired: false };
}
export async function showPrivacyOptions(): Promise<AdsInitResult | null> {
  return null;
}
