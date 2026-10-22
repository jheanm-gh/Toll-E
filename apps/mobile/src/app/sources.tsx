import { TRUST_EXPLANATION, summariseCoverage, type Trust } from '@toll-e/core';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ContentSections } from '@/components/ContentSection';
import { DataStatus } from '@/components/plaza/DataStatus';
import { SourceList } from '@/components/plaza/SourceList';
import { AppText, Button, Card, Screen, SectionHeader, TrustBadge } from '@/components/ui';
import { useData } from '@/data/DataProvider';
import { useToday } from '@/hooks/useToday';
import { colors, spacing } from '@/theme/tokens';

const STATES: (Trust | 'unavailable')[] = ['confirmed', 'stale', 'unverified', 'under_review', 'unavailable'];

export default function SourcesScreen() {
  const { dataset, refresh, refreshing, remoteConfigured } = useData();
  const today = useToday();
  const s = useMemo(() => summariseCoverage(dataset, today), [dataset, today]);
  const official = dataset.sources.filter((x) => x.official);
  const secondary = dataset.sources.filter((x) => !x.official);
  const totalTariffs = Object.values(s.tariffsByStatus).reduce((a, b) => a + b, 0);

  return (
    <Screen edges={['bottom']}>
      <AppText variant="body" color={colors.ink700}>
        Every price in Toll-E shows where it came from, when it took effect and whether a person has checked it. This
        page explains how.
      </AppText>

      <SectionHeader title="What the labels mean" />
      <Card style={{ gap: spacing.md }}>
        {STATES.map((t) => (
          <View key={t} style={styles.legend}>
            <TrustBadge trust={t} />
            <AppText variant="small" color={colors.ink700}>
              {t === 'unavailable'
                ? 'Toll-E has no current tariff for this plaza and vehicle class. We show the source so you can check.'
                : TRUST_EXPLANATION[t]}
            </AppText>
          </View>
        ))}
      </Card>

      <SectionHeader title="Coverage today" caption="What Toll-E currently knows — and does not." />
      <Card style={{ gap: spacing.xs }}>
        {[
          ['Toll plazas listed', s.plazas],
          ['With at least one current tariff', s.withAnyCurrentTariff],
          ['With current tariffs for all vehicle classes', s.withCompleteClassCoverage],
          ['Shown on the map (approximate positions)', s.withLocation],
          ['With a verified position', s.withVerifiedLocation],
          ['Published tariff records', totalTariffs],
          ['…checked by a person (verified)', s.tariffsByStatus.verified ?? 0],
          ['…under review (sources disagree)', s.tariffsByStatus.pending_review ?? 0],
        ].map(([label, value]) => (
          <View key={label as string} style={styles.statRow}>
            <AppText variant="body" color={colors.ink700} style={{ flex: 1 }}>
              {label}
            </AppText>
            <AppText variant="bodyStrong">{String(value)}</AppText>
          </View>
        ))}
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <DataStatus />
          {remoteConfigured ? (
            <Button
              label="Check for updates"
              variant="secondary"
              size="sm"
              loading={refreshing}
              onPress={() => void refresh()}
            />
          ) : null}
        </View>
      </Card>

      <ContentSections
        sections={[
          {
            heading: 'How prices are worked out',
            bullets: [
              'A tariff applies only between its effective dates. Toll-E uses South African time, so new tariffs start at midnight SAST on their effective date.',
              'Announced future tariffs are shown as upcoming and never used before they take effect. Expired tariffs are never shown as current.',
              'A journey is priced plaza by plaza for your vehicle class. Toll-E does not add up every plaza on a road: ramp plazas are counted only if you confirm you use them.',
              'Return trips price the way back separately, so direction-specific charges are respected.',
              'If any plaza cannot be priced, the total is marked partial and that plaza is listed — Toll-E never fills gaps with guesses.',
              'Amounts are in rand and include VAT, as published. Money is calculated in whole cents.',
              'Frequent-user, local-user and e-tag discounts are not applied.',
            ],
          },
          {
            heading: 'How information is checked',
            paragraphs: [
              'Toll tariffs are published by SANRAL and the concession operators and gazetted by government. Toll-E records the exact source of every value. A value becomes “Verified” only when a person at Toll-E has checked it against an official source, and the check is dated.',
              'Where official and secondary sources disagree, the value is marked “Under review”. Automated checks also compare each new tariff with the previous year and the published percentage increase.',
              'Map positions are approximate unless marked verified. When a position is not verified, directions search for the plaza by name.',
            ],
          },
          {
            heading: 'Gauteng e-tolls',
            paragraphs: [
              'Gauteng e-toll gantries were switched off on 11 April 2024. Toll-E includes no e-toll charges.',
            ],
          },
        ]}
      />

      <SectionHeader title="Official sources" caption="Government Gazettes, SANRAL and the toll operators." />
      <Card padded={false}>
        <SourceList sources={official} showNotes />
      </Card>
      <SectionHeader
        title="Secondary sources"
        caption="Used only to cross-check, or where they agree with another independent source. Always labelled."
      />
      <Card padded={false}>
        <SourceList sources={secondary} showNotes />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  legend: { gap: spacing.xs },
  statRow: { flexDirection: 'row', alignItems: 'center', minHeight: 32, gap: spacing.md },
});
