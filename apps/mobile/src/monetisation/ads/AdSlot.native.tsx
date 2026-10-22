import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/tokens';

import type { AdPlacementId } from '../config';

import { useAds } from './AdsProvider';

type RNGMA = typeof import('react-native-google-mobile-ads');
let mod: RNGMA | null = null;
try {
  // Lazy on purpose: a build without the native module must degrade, not crash.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require('react-native-google-mobile-ads') as RNGMA;
} catch {
  mod = null;
}

/**
 * A single banner, always labelled "Advertisement" and visually separated from toll data. Renders nothing when ads are off, purchased away, not consented,
 * not configured, or when the banner fails to load — the layout simply closes up.
 */
export function AdSlot({ placement }: { placement: AdPlacementId }) {
  const { canShow, unitId, personalised } = useAds();
  const [failed, setFailed] = useState(false);
  if (!mod || !unitId || !canShow(placement) || failed) return null;
  const { BannerAd, BannerAdSize } = mod;
  return (
    <View style={styles.wrap} accessibilityLabel="Advertisement" testID={`ad-slot-${placement}`}>
      <AppText variant="label" color={colors.ink500} style={styles.label}>
        Advertisement
      </AppText>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: !personalised }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm },
});
