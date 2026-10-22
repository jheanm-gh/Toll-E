import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useEntitlement } from '../purchases/EntitlementProvider';
import { ADS_ENABLED, AD_PLACEMENTS, type AdPlacementId } from '../config';
import { usePreferences } from '@/state/preferences';

import { adsSupported, bannerUnitId, initialiseAds, showPrivacyOptions } from './runtime';

export type AdsStatus =
  /** Ad-free purchased: the SDK is never started. */
  | 'ad_free'
  /** Ads switched off centrally. */
  | 'disabled'
  /** Platform or build without an ads SDK, or no unit id configured. */
  | 'unavailable'
  | 'initialising'
  | 'ready'
  /** Consent not given where it is required: no ads are requested. */
  | 'no_consent'
  | 'error';

interface AdsState {
  status: AdsStatus;
  unitId: string | null;
  personalised: boolean;
  privacyOptionsRequired: boolean;
  canShow: (placement: AdPlacementId) => boolean;
  openPrivacyOptions: () => Promise<void>;
}

const Ctx = createContext<AdsState | null>(null);

export function AdsProvider({ children }: { children: ReactNode }) {
  const { adFree } = useEntitlement();
  const { personalisedAds } = usePreferences();
  const [sdkStatus, setSdkStatus] = useState<'initialising' | 'ready' | 'no_consent' | 'error'>('initialising');
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);
  const unitId = useMemo(() => bannerUnitId(), []);
  const eligible = !adFree && ADS_ENABLED && adsSupported() && !!unitId;
  const status: AdsStatus = adFree
    ? 'ad_free'
    : !ADS_ENABLED
      ? 'disabled'
      : !adsSupported() || !unitId
        ? 'unavailable'
        : sdkStatus;

  // The ads SDK is only started for users who have not removed ads.
  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    initialiseAds()
      .then((r) => {
        if (cancelled) return;
        setPrivacyOptionsRequired(r.privacyOptionsRequired);
        setSdkStatus(r.canRequestAds ? 'ready' : 'no_consent');
      })
      .catch(() => !cancelled && setSdkStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [eligible]);

  const openPrivacyOptions = useCallback(async () => {
    const r = await showPrivacyOptions().catch(() => null);
    if (!r) return;
    setPrivacyOptionsRequired(r.privacyOptionsRequired);
    setSdkStatus(r.canRequestAds ? 'ready' : 'no_consent');
  }, []);

  const value = useMemo<AdsState>(
    () => ({
      status,
      unitId,
      personalised: personalisedAds,
      privacyOptionsRequired,
      canShow: (placement) => status === 'ready' && !adFree && AD_PLACEMENTS[placement].enabled && !!unitId,
      openPrivacyOptions,
    }),
    [status, unitId, personalisedAds, privacyOptionsRequired, adFree, openPrivacyOptions],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAds(): AdsState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAds must be used inside AdsProvider');
  return ctx;
}
