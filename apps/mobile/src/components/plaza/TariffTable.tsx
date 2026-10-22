import {
  STANDARD_CLASSES,
  STANDARD_CLASS_LABEL,
  ambiguousReason,
  formatLongDate,
  formatZAR,
  unavailableReason,
  type StandardClassId,
} from '@toll-e/core';
import { StyleSheet, View } from 'react-native';

import { AppText, Divider, Price, TrustBadge } from '@/components/ui';
import type { PlazaInfo } from '@/hooks/usePlazaInfo';
import { colors, spacing } from '@/theme/tokens';

/** Every vehicle class with its current tariff, status and effective date — or why there is none. */
export function TariffTable({ info, highlight }: { info: PlazaInfo; highlight?: StandardClassId }) {
  return (
    <View>
      {STANDARD_CLASSES.map((c, i) => {
        const r = info.byClass[c];
        const label = STANDARD_CLASS_LABEL[c];
        return (
          <View key={c}>
            {i > 0 ? <Divider /> : null}
            <View style={[styles.row, highlight === c && styles.highlight]}>
              <View style={styles.classCol}>
                <AppText variant="bodyStrong">{label.label}</AppText>
                <AppText variant="small" color={colors.ink500}>
                  {label.detail}
                </AppText>
              </View>
              <View style={styles.valueCol}>
                {r.kind === 'current' ? (
                  <>
                    <Price cents={r.tariff.amountCents} variant="priceSmall" color={colors.navy900} />
                    <TrustBadge trust={r.trust} compact />
                    <AppText variant="small" color={colors.ink500} align="right">
                      Since {formatLongDate(r.tariff.effectiveFrom)}
                    </AppText>
                    {r.upcoming ? (
                      <AppText variant="small" color={colors.info} align="right">
                        {formatZAR(r.upcoming.amountCents)} from {formatLongDate(r.upcoming.effectiveFrom)}
                      </AppText>
                    ) : null}
                  </>
                ) : (
                  <>
                    <TrustBadge trust="unavailable" />
                    <AppText variant="small" color={colors.ink500} align="right" style={styles.reason}>
                      {r.kind === 'none' ? unavailableReason(r) : ambiguousReason(r)}
                    </AppText>
                  </>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, alignItems: 'flex-start' },
  highlight: { backgroundColor: colors.teal50, marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg },
  classCol: { flex: 1, gap: 2 },
  valueCol: { alignItems: 'flex-end', gap: 4, maxWidth: '58%' },
  reason: { maxWidth: 220 },
});
