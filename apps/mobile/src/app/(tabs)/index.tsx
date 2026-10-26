import {
  STANDARD_CLASS_LABEL,
  calculate,
  formatZAR,
  isWithin,
  journeyInput,
  searchPlazas,
  summariseCoverage,
} from '@toll-e/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { DataStatus } from '@/components/plaza/DataStatus';
import { PlazaRow, formatDistance } from '@/components/plaza/PlazaRow';
import { RouteBadge } from '@/components/plaza/RouteBadge';
import {
  AppText,
  Button,
  Card,
  Divider,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  TextField,
  TrustBadge,
} from '@/components/ui';
import { Notices } from '@/components/Notices';
import { useData } from '@/data/DataProvider';
import { useOfferedJourneys } from '@/data/journeys';
import { computePlazaInfo } from '@/hooks/usePlazaInfo';
import { useToday } from '@/hooks/useToday';
import { AdSlot } from '@/monetisation/ads/AdSlot';
import { getLocationOnce } from '@/services/location';
import { usePreferences } from '@/state/preferences';
import { useSaved } from '@/state/saved';
import { colors, radii, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const data = useData();
  const { dataset, index, refresh, refreshing } = data;
  const today = useToday();
  const { defaultClass } = usePreferences();
  const saved = useSaved();
  const journeys = useOfferedJourneys();
  const [query, setQuery] = useState('');
  const [nearby, setNearby] = useState<{ id: string; distance: number }[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const notices = useMemo(
    () => dataset.notices.filter((n) => isWithin(today, n.showFrom, n.showUntil)),
    [dataset.notices, today],
  );
  const quick = useMemo(
    () =>
      journeys.map((j) => ({
        j,
        r: calculate(index, journeyInput(j, { trip: 'one_way', standardClass: defaultClass, date: today })),
      })),
    [journeys, index, defaultClass, today],
  );
  const coverage = useMemo(() => summariseCoverage(dataset, today), [dataset, today]);
  const verified = coverage.tariffsByStatus.verified ?? 0;
  const totalTariffs = Object.values(coverage.tariffsByStatus).reduce((a, b) => a + b, 0);

  const findNearby = async () => {
    setLocating(true);
    setLocationNote(null);
    const r = await getLocationOnce();
    setLocating(false);
    if (r.status !== 'ok') {
      setLocationNote(r.status === 'denied' ? 'Location permission was not given.' : r.message);
      return;
    }
    const near = searchPlazas(dataset, {}, r.coords)
      .filter((x) => x.distanceMetres !== undefined)
      .slice(0, 3)
      .map((x) => ({ id: x.plaza.id, distance: x.distanceMetres! }));
    setNearby(near);
  };

  return (
    <Screen
      onRefresh={data.remoteConfigured ? refresh : undefined}
      refreshing={refreshing}
      testID="home-scroll"
      footer={<AdSlot placement="home_footer" />}>
      <View style={styles.hero}>
        <Logo inverse />
        <AppText variant="display" color={colors.white} style={styles.tagline}>
          Know your tolls.{'\n'}Know your costs.{'\n'}
          <AppText variant="display" color={colors.amber500}>
            Know before you go.
          </AppText>
        </AppText>
        <TextField
          icon="magnify"
          placeholder="Find a toll plaza or road"
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          returnKeyType="search"
          onSubmitEditing={() => router.push({ pathname: '/plazas', params: { q: query } })}
          accessibilityLabel="Search toll plazas"
        />
        <View style={styles.heroActions}>
          <Button
            label="Search"
            variant="accent"
            size="sm"
            onPress={() => router.push({ pathname: '/plazas', params: { q: query } })}
          />
          <Button label="Browse all plazas" variant="onDark" size="sm" onPress={() => router.push('/plazas')} />
        </View>
      </View>

      <Notices notices={notices} />

      {quick.length > 0 ? (
        <>
          <SectionHeader
            title="Quick estimates"
            caption={`${STANDARD_CLASS_LABEL[defaultClass].label} · one way · tariffs in force today`}
            action={<Button label="Calculator" variant="ghost" size="sm" onPress={() => router.push('/calculate')} />}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
            {quick.map(({ j, r }) => (
              <Card
                key={j.id}
                style={styles.quickCard}
                onPress={() => router.push({ pathname: '/calculate', params: { journey: j.id } })}
                accessibilityLabel={`${j.name} via ${j.via}: ${r.confidence === 'unavailable' ? 'no price' : formatZAR(r.totalCents)}${r.confidence === 'partial' ? ', partial total' : ''}`}>
                <RouteBadge route={j.via} size="sm" />
                <AppText variant="bodyStrong" numberOfLines={2}>
                  {j.name}
                </AppText>
                {r.confidence === 'unavailable' ? (
                  <AppText variant="small" color={colors.ink500}>
                    No price for this class
                  </AppText>
                ) : (
                  <AppText variant="priceMedium" color={colors.navy900}>
                    {formatZAR(r.totalCents)}
                  </AppText>
                )}
                <View style={styles.quickMeta}>
                  {r.trust ? <TrustBadge trust={r.trust} compact /> : null}
                  {r.confidence === 'partial' ? (
                    <AppText variant="small" color={colors.review}>
                      {r.pricedCount}/{r.chargeableCount} priced
                    </AppText>
                  ) : null}
                </View>
              </Card>
            ))}
          </ScrollView>
        </>
      ) : (
        <>
          <SectionHeader title="Price a trip" />
          <Card onPress={() => router.push('/calculate')} accessibilityLabel="Open the toll calculator">
            <AppText variant="bodyStrong">Toll calculator</AppText>
            <AppText variant="small" color={colors.ink500}>
              Choose the plazas on your route and see the cost for your vehicle, one way or return.
            </AppText>
          </Card>
        </>
      )}

      <SectionHeader title="Near you" />
      <Card padded={false}>
        {nearby && nearby.length > 0 ? (
          nearby.map((n, i) => {
            const plaza = dataset.plazas.find((p) => p.id === n.id)!;
            return (
              <View key={n.id}>
                {i > 0 ? <Divider inset={spacing.lg} /> : null}
                <PlazaRow
                  info={computePlazaInfo(data, plaza, today)}
                  vehicleClass={defaultClass}
                  distanceMetres={n.distance}
                />
              </View>
            );
          })
        ) : (
          <View style={styles.nearEmpty}>
            <AppText variant="small" color={colors.ink500}>
              {nearby && nearby.length === 0
                ? 'No plazas with a known position were found.'
                : 'See the closest toll plazas. Your location is used once and is not stored.'}
            </AppText>
            {locationNote ? (
              <AppText variant="small" color={colors.warning}>
                {locationNote}
              </AppText>
            ) : null}
            <View style={styles.heroActions}>
              <Button
                label={locating ? 'Locating…' : 'Use my location'}
                icon="crosshairs-gps"
                size="sm"
                variant="secondary"
                onPress={findNearby}
                loading={locating}
              />
              <Button
                label="Choose a town"
                size="sm"
                variant="ghost"
                onPress={() => router.push({ pathname: '/plazas', params: { near: '1' } })}
              />
            </View>
          </View>
        )}
        {nearby && nearby.length > 0 ? (
          <AppText variant="small" color={colors.ink500} style={styles.nearNote}>
            Straight-line distances to approximate positions ({nearby.map((n) => formatDistance(n.distance)).join(', ')}
            ).
          </AppText>
        ) : null}
      </Card>

      {saved.savedCalculations.length > 0 || saved.recentCalculations.length > 0 ? (
        <>
          <SectionHeader
            title={saved.savedCalculations.length ? 'Your saved trips' : 'Recent calculations'}
            action={<Button label="See all" variant="ghost" size="sm" onPress={() => router.push('/saved')} />}
          />
          <Card padded={false}>
            {(saved.savedCalculations.length ? saved.savedCalculations : saved.recentCalculations)
              .slice(0, 3)
              .map((c, i) => (
                <View key={c.id}>
                  {i > 0 ? <Divider inset={spacing.lg} /> : null}
                  <ListRow
                    icon="routes"
                    title={c.label}
                    subtitle={`${STANDARD_CLASS_LABEL[c.request.standardClass].label} · ${c.request.trip === 'return' ? 'return' : 'one way'} · ${formatZAR(c.snapshot.totalCents)} when saved`}
                    onPress={() => router.push({ pathname: '/calculate', params: { saved: c.id } })}
                  />
                </View>
              ))}
          </Card>
        </>
      ) : null}

      <Card
        tone="muted"
        onPress={() => router.push('/sources')}
        accessibilityLabel="About Toll-E's data and how it is verified">
        <View style={styles.dataRow}>
          <View style={styles.dataIcon}>
            <Icon name="shield-check-outline" size={22} color={colors.teal700} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">Where our prices come from</AppText>
            <AppText variant="small" color={colors.ink700}>
              {coverage.plazas} plazas · {totalTariffs} tariffs from SANRAL, operators and the Government Gazette ·{' '}
              {verified === 0 ? 'none verified by Toll-E yet' : `${verified} verified`}
            </AppText>
            <DataStatus compact />
          </View>
          <Icon name="chevron-right" size={22} color={colors.ink400} />
        </View>
      </Card>

      <Pressable onPress={() => router.push('/advertising')} accessibilityRole="link" style={styles.adNote}>
        <AppText variant="small" color={colors.ink500} align="center">
          Toll-E is free and supported by advertising.
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.navy900,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  tagline: { fontSize: 27, lineHeight: 33 },
  heroActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  quickRow: { gap: spacing.md, paddingRight: spacing.lg },
  quickCard: { width: 196, gap: spacing.xs },
  quickMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  nearEmpty: { padding: spacing.lg, gap: spacing.md },
  nearNote: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  dataRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  dataIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.teal50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adNote: { paddingVertical: spacing.xs },
});
