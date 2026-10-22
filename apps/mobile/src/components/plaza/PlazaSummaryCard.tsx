import {
  PLAZA_TYPE_LABEL,
  STANDARD_CLASS_LABEL,
  destinationUrl,
  plazaNavigationTarget,
  unavailableReason,
} from '@toll-e/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, Price, TrustBadge } from '@/components/ui';
import { usePlazaInfo } from '@/hooks/usePlazaInfo';
import { usePreferences } from '@/state/preferences';
import { colors, spacing } from '@/theme/tokens';
import type { Plaza } from '@toll-e/core';

import { NavigateSheet } from './NavigateSheet';
import { RouteBadge } from './RouteBadge';

/** Compact plaza summary shown when a marker is selected on the map. */
export function PlazaSummaryCard({ plaza, onClose }: { plaza: Plaza; onClose: () => void }) {
  const info = usePlazaInfo(plaza);
  const { defaultClass } = usePreferences();
  const [navOpen, setNavOpen] = useState(false);
  if (!info) return null;
  const r = info.byClass[defaultClass];
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <RouteBadge route={plaza.route} />
        <View style={styles.title}>
          <AppText variant="heading" numberOfLines={1}>
            {plaza.name}
          </AppText>
          <AppText variant="small" color={colors.ink500} numberOfLines={1}>
            {[info.operator?.shortName, PLAZA_TYPE_LABEL[plaza.type]].filter(Boolean).join(' · ')}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close plaza summary" onPress={onClose} hitSlop={12}>
          <Icon name="close" size={22} color={colors.ink500} />
        </Pressable>
      </View>
      <View style={styles.priceRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="label" color={colors.ink500}>
            {STANDARD_CLASS_LABEL[defaultClass].label} · {STANDARD_CLASS_LABEL[defaultClass].short}
          </AppText>
          {r.kind === 'current' ? (
            <Price cents={r.tariff.amountCents} variant="priceMedium" color={colors.navy900} />
          ) : (
            <AppText variant="small" color={colors.ink500}>
              {r.kind === 'none' ? unavailableReason(r) : 'Charge depends on direction'}
            </AppText>
          )}
        </View>
        <TrustBadge trust={r.kind === 'current' ? r.trust : 'unavailable'} />
      </View>
      {plaza.location?.precision === 'approximate' ? (
        <AppText variant="small" color={colors.warning}>
          Map position is approximate.
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button label="Details" variant="primary" onPress={() => router.push(`/plazas/${plaza.id}`)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Directions"
            variant="outline"
            icon="navigation-variant-outline"
            onPress={() => setNavOpen(true)}
          />
        </View>
      </View>
      <NavigateSheet
        visible={navOpen}
        onClose={() => setNavOpen(false)}
        title={`Directions to ${plaza.name}`}
        note={
          plaza.location?.precision === 'verified'
            ? undefined
            : 'Toll-E searches for the plaza by name because its position has not been verified. Toll prices are not sent to the app.'
        }
        urlFor={(app) => destinationUrl(app, plazaNavigationTarget(plaza))}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md },
});
