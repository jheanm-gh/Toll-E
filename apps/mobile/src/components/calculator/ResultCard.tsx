import {
  CONFIDENCE_HEADLINE,
  STANDARD_CLASS_LABEL,
  TRUST_LABEL,
  formatLongDate,
  formatZAR,
  resultSummary,
  warningText,
  type CalculationResult,
  type Dataset,
} from '@toll-e/core';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, Divider, Icon, Price, TrustBadge } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/tokens';

const REASON_TEXT: Record<string, string> = {
  no_tariff_for_class: 'No tariff for this class',
  no_tariff_in_direction: 'No tariff for this direction',
  class_not_supported: 'Class not used at this plaza',
  expired: 'Tariff expired — no current tariff loaded',
  not_yet_effective: 'Tariff not yet in force',
  plaza_inactive: 'Plaza not in operation',
  direction_required: 'Charge depends on direction',
  overlapping_tariffs: 'Conflicting tariffs — needs review',
  conditional_not_confirmed: 'Not included',
  duplicate_in_leg: 'Already counted on this leg',
};

export function ResultCard({ result, dataset }: { result: CalculationResult; dataset: Dataset }) {
  const plazaName = (id: string) => dataset.plazas.find((p) => p.id === id)?.name ?? id;
  const sources = dataset.sources.filter((s) => result.sourceIds.includes(s.id));
  const schedules = dataset.schedules.filter((s) => result.scheduleIds.includes(s.id));
  const cls = STANDARD_CLASS_LABEL[result.input.standardClass];
  const isReturn = result.input.trip === 'return';
  const tone =
    result.confidence === 'confirmed'
      ? colors.success
      : result.confidence === 'partial'
        ? colors.review
        : colors.navy900;

  const informational = new Set(['discounts_not_applied']);
  const warnings = result.warnings.filter((w) => !informational.has(w.code));

  return (
    <Card style={styles.card} accessibilityLabel="Calculation result">
      <View style={styles.headRow}>
        <AppText variant="label" color={tone}>
          {CONFIDENCE_HEADLINE[result.confidence]}
        </AppText>
        {result.trust ? <TrustBadge trust={result.trust} /> : null}
      </View>
      {result.confidence === 'unavailable' ? (
        <AppText variant="body" color={colors.ink700}>
          None of the selected plazas has a current tariff for {cls.label}. Check the sources on each plaza page.
        </AppText>
      ) : (
        <>
          <Price cents={result.totalCents} variant="price" color={colors.navy900} />
          <AppText variant="small" color={colors.ink700}>
            {cls.label} ({cls.short.toLowerCase()}) · {isReturn ? 'return trip' : 'one way'} · {resultSummary(result)}
          </AppText>
          {isReturn ? (
            <View style={styles.legs}>
              <View style={styles.leg}>
                <AppText variant="small" color={colors.ink500}>
                  Outbound
                </AppText>
                <AppText variant="priceSmall">{formatZAR(result.outboundCents)}</AppText>
              </View>
              <View style={styles.leg}>
                <AppText variant="small" color={colors.ink500}>
                  Return
                </AppText>
                <AppText variant="priceSmall">{formatZAR(result.returnCents)}</AppText>
              </View>
            </View>
          ) : null}
        </>
      )}

      {warnings.length ? (
        <View style={styles.warnings}>
          {warnings.map((w) => (
            <View key={w.code} style={styles.warning}>
              <Icon
                name={
                  w.code === 'unpriced_events' || w.code === 'ambiguous_events'
                    ? 'alert-circle-outline'
                    : 'information-outline'
                }
                size={17}
                color={w.code === 'unpriced_events' || w.code === 'ambiguous_events' ? colors.review : colors.warning}
              />
              <AppText variant="small" color={colors.ink700} style={{ flex: 1 }}>
                {warningText(w, plazaName)}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      <Divider spaced />
      <AppText variant="heading">Breakdown</AppText>
      {(['outbound', 'return'] as const).map((leg) => {
        const lines = result.lines.filter((l) => l.leg === leg);
        if (!lines.length) return null;
        return (
          <View key={leg} style={styles.legBlock}>
            {isReturn ? (
              <AppText variant="label" color={colors.ink500}>
                {leg === 'outbound' ? 'Outbound' : 'Return'}
              </AppText>
            ) : null}
            {lines.map((l) => (
              <Pressable
                key={`${leg}-${l.sequence}`}
                accessibilityRole="button"
                accessibilityLabel={`${plazaName(l.plazaId)}: ${l.status === 'priced' ? formatZAR(l.amountCents!) : (REASON_TEXT[l.reason ?? ''] ?? l.status)}`}
                accessibilityHint="Opens the plaza's details"
                onPress={() => router.push(`/plazas/${l.plazaId}`)}
                style={({ pressed }) => [styles.line, pressed && { backgroundColor: colors.surfaceMuted }]}>
                <View style={[styles.seq, l.status !== 'priced' && styles.seqMuted]}>
                  <AppText variant="smallStrong" color={l.status === 'priced' ? colors.white : colors.ink500}>
                    {l.sequence}
                  </AppText>
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <AppText variant="bodyStrong" color={l.status === 'priced' ? colors.ink900 : colors.ink500}>
                    {plazaName(l.plazaId)}
                  </AppText>
                  {l.status === 'priced' ? (
                    <AppText variant="small" color={colors.ink500}>
                      {l.trust ? TRUST_LABEL[l.trust] : ''}
                      {l.effectiveFrom ? ` · since ${formatLongDate(l.effectiveFrom)}` : ''}
                    </AppText>
                  ) : (
                    <AppText
                      variant="small"
                      color={l.status === 'excluded' || l.status === 'duplicate' ? colors.ink500 : colors.review}>
                      {REASON_TEXT[l.reason ?? ''] ?? 'Not priced'}
                    </AppText>
                  )}
                </View>
                {l.status === 'priced' ? (
                  <AppText variant="priceSmall">{formatZAR(l.amountCents!)}</AppText>
                ) : (
                  <AppText variant="smallStrong" color={colors.ink400}>
                    —
                  </AppText>
                )}
              </Pressable>
            ))}
          </View>
        );
      })}

      <Divider spaced />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="smallStrong">Tariffs in force on {formatLongDate(result.input.date)}</AppText>
        {schedules.map((s) => (
          <AppText key={s.id} variant="small" color={colors.ink500}>
            • {s.name}
          </AppText>
        ))}
        {sources.length ? (
          <AppText variant="small" color={colors.ink500}>
            Sources:{' '}
            {sources
              .map((s) => s.publisher.replace(/ \(.*\)$/, ''))
              .filter((v, i, a) => a.indexOf(v) === i)
              .join('; ')}
          </AppText>
        ) : null}
        <AppText variant="small" color={colors.ink500}>
          Discounts (frequent-user, local-user, e-tag) are not applied. Amounts include VAT.
        </AppText>
        {result.confidence !== 'confirmed' ? (
          <Badge
            label="Estimate — confirm with the operator before you rely on it"
            tone="neutral"
            icon="information-outline"
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  legs: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  leg: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: spacing.md, gap: 2 },
  warnings: {
    gap: spacing.sm,
    marginTop: spacing.xs,
    backgroundColor: colors.amber50,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  warning: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  legBlock: { gap: 2, marginTop: spacing.xs },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  seq: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.navy900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqMuted: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
});
