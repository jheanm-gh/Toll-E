import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

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
 * A single banner anchored to the bottom of a screen, outside its scrolling content. It is always labelled
 * "Advertisement" and separated from toll data by a rule. Renders nothing when ads are off, purchased away, not
 * consented, not configured, or when the banner fails to load: the screen simply gets that space back.
 *
 * `insetBottom` adds the device's bottom safe area, for screens without a tab bar below them.
 */
export function AdSlot({ placement, insetBottom = false }: { placement: AdPlacementId; insetBottom?: boolean }) {
  const { canShow, unitId, personalised } = useAds();
  const { bottom } = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  if (!mod || !unitId || !canShow(placement) || failed) return null;
  const { BannerAd, BannerAdSize } = mod;
  return (
    <View
      style={[styles.wrap, insetBottom && { paddingBottom: spacing.xs + bottom }]}
      accessibilityLabel="Advertisement"
      testID={`ad-slot-${placement}`}>
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
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: { alignSelf: 'flex-start', paddingHorizontal: spacing.lg },
});
