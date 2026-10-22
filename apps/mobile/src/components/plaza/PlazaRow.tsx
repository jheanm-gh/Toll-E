import { formatZAR, PLAZA_TYPE_LABEL, type StandardClassId } from '@toll-e/core';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, TrustBadge } from '@/components/ui';
import type { PlazaInfo } from '@/hooks/usePlazaInfo';
import { colors, spacing, touchTarget } from '@/theme/tokens';

import { RouteBadge } from './RouteBadge';

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

export function PlazaRow({
  info,
  vehicleClass,
  distanceMetres,
  favourite,
}: {
  info: PlazaInfo;
  vehicleClass: StandardClassId;
  distanceMetres?: number;
  favourite?: boolean;
}) {
  const { plaza, operator } = info;
  const r = info.byClass[vehicleClass];
  const price = r.kind === 'current' ? formatZAR(r.tariff.amountCents) : null;
  const a11y = [
    `${plaza.name} toll plaza`,
    `${plaza.route}`,
    operator?.shortName,
    PLAZA_TYPE_LABEL[plaza.type],
    price ? `${price}` : 'no current tariff',
    r.kind === 'current' ? `status ${r.trust.replace('_', ' ')}` : undefined,
    distanceMetres !== undefined ? `${formatDistance(distanceMetres)} away` : undefined,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Opens the plaza's details"
      onPress={() => router.push(`/plazas/${plaza.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <RouteBadge route={plaza.route} size="sm" />
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
            {plaza.name}
          </AppText>
          {favourite ? <Icon name="star" size={16} color={colors.amber500} /> : null}
        </View>
        <AppText variant="small" color={colors.ink500} numberOfLines={1}>
          {[
            operator?.shortName,
            plaza.type === 'unknown' ? 'Type not confirmed' : PLAZA_TYPE_LABEL[plaza.type],
            distanceMetres !== undefined ? formatDistance(distanceMetres) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      </View>
      <View style={styles.priceCol}>
        {price ? (
          <AppText variant="priceSmall" color={colors.navy900}>
            {price}
          </AppText>
        ) : (
          <AppText variant="small" color={colors.ink500}>
            No tariff
          </AppText>
        )}
        <TrustBadge trust={r.kind === 'current' ? r.trust : 'unavailable'} compact />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  main: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
  priceCol: { alignItems: 'flex-end', gap: 4 },
});
