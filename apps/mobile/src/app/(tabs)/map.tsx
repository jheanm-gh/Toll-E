import { availableRoutes } from '@toll-e/core';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TollMap } from '@/components/map/TollMap';
import type { MapBaseStatus } from '@/components/map/map-style';
import { PlazaDirectory } from '@/components/plaza/PlazaDirectory';
import { PlazaSummaryCard } from '@/components/plaza/PlazaSummaryCard';
import { AppText, Banner, Chip, SegmentedControl } from '@/components/ui';
import { useData } from '@/data/DataProvider';
import { colors, elevation, radii, spacing } from '@/theme/tokens';

type View_ = 'map' | 'list';

export default function MapScreen() {
  const { dataset } = useData();
  const [view, setView] = useState<View_>('map');
  const [route, setRoute] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<MapBaseStatus>('loading');

  const active = useMemo(
    () => dataset.plazas.filter((p) => p.publicationStatus === 'published' && p.status === 'active'),
    [dataset],
  );
  const shown = useMemo(() => active.filter((p) => p.location && (!route || p.route === route)), [active, route]);
  const total = useMemo(() => active.filter((p) => !route || p.route === route).length, [active, route]);
  const routes = useMemo(() => availableRoutes(dataset), [dataset]);
  const selected = selectedId ? active.find((p) => p.id === selectedId) : undefined;
  const mapFailed = status === 'failed';
  const showList = view === 'list' || mapFailed;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          Toll map
        </AppText>
        <SegmentedControl
          accessibilityLabel="Choose map or list view"
          value={showList ? 'list' : 'map'}
          onChange={setView}
          segments={[
            { value: 'map', label: 'Map', icon: 'map-outline' },
            { value: 'list', label: 'List', icon: 'format-list-bulleted' },
          ]}
        />
      </View>

      {showList ? (
        <PlazaDirectory
          header={
            mapFailed ? (
              <Banner tone="warning" title="The map could not be shown on this device">
                Every plaza is listed below instead.
              </Banner>
            ) : undefined
          }
        />
      ) : (
        <View style={styles.mapWrap}>
          <TollMap plazas={shown} selectedId={selectedId} onSelect={setSelectedId} onStatusChange={setStatus} />
          <View style={styles.overlayTop} pointerEvents="box-none">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="All roads" selected={route === null} onPress={() => setRoute(null)} />
              {routes.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  selected={route === r}
                  onPress={() => setRoute(route === r ? null : r)}
                  accessibilityLabel={`Show route ${r} only`}
                />
              ))}
            </ScrollView>
            {status === 'offline' ? (
              <Banner tone="offline" title="Offline map">
                Showing a simplified outline. Roads and towns appear when tiles can load.
              </Banner>
            ) : null}
          </View>
          <View style={styles.overlayBottom} pointerEvents="box-none">
            {selected ? (
              <PlazaSummaryCard plaza={selected} onClose={() => setSelectedId(null)} />
            ) : (
              <View
                style={styles.legend}
                accessible
                accessibilityLabel={`${shown.length} of ${total} plazas shown on the map. Plazas without a confirmed position are in the list. An amber ring means the position is approximate.`}>
                <View style={styles.legendRow}>
                  <View style={[styles.dot, { backgroundColor: colors.navy900 }]} />
                  <AppText variant="small" color={colors.ink700}>
                    Mainline
                  </AppText>
                  <View style={[styles.dot, { backgroundColor: colors.teal600 }]} />
                  <AppText variant="small" color={colors.ink700}>
                    Ramp / other
                  </AppText>
                  <View style={[styles.dot, styles.ring]} />
                  <AppText variant="small" color={colors.ink700}>
                    Approx. position
                  </AppText>
                </View>
                <AppText variant="small" color={colors.ink500}>
                  {shown.length} of {total} plazas on the map · the rest have no confirmed position — see List
                </AppText>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.md },
  mapWrap: { flex: 1, overflow: 'hidden', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  overlayTop: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  overlayBottom: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  legend: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.card,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  dot: { width: 12, height: 12, borderRadius: 6, marginLeft: spacing.xs },
  ring: { backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.amber500 },
});
