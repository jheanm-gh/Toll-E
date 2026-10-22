import { STANDARD_CLASS_LABEL, availableRoutes, searchPlazas, type LatLng, type PlazaType } from '@toll-e/core';
import { useMemo, useState, type ReactElement } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Banner, Button, Chip, Divider, EmptyState, Icon, TextField } from '@/components/ui';
import { useData } from '@/data/DataProvider';
import { computePlazaInfo } from '@/hooks/usePlazaInfo';
import { useToday } from '@/hooks/useToday';
import { AD_PLACEMENTS } from '@/monetisation/config';
import { AdSlot } from '@/monetisation/ads/AdSlot';
import { REFERENCE_TOWNS, getLocationOnce } from '@/services/location';
import { usePreferences } from '@/state/preferences';
import { useSaved } from '@/state/saved';
import { colors, radii, spacing } from '@/theme/tokens';

import { PlazaRow } from './PlazaRow';

type Near = { coords: LatLng; label: string } | null;
type Row = { kind: 'plaza'; id: string; distance?: number } | { kind: 'ad' };

export function PlazaDirectory({
  initialQuery = '',
  header,
  initialNear = false,
}: {
  initialQuery?: string;
  header?: ReactElement;
  initialNear?: boolean;
}) {
  const data = useData();
  const today = useToday();
  const { defaultClass } = usePreferences();
  const { favouritePlazaIds } = useSaved();
  const [query, setQuery] = useState(initialQuery);
  const [route, setRoute] = useState<string | null>(null);
  const [type, setType] = useState<PlazaType | null>(null);
  const [near, setNear] = useState<Near>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [townPicker, setTownPicker] = useState(initialNear);
  const insets = useSafeAreaInsets();

  const routes = useMemo(() => availableRoutes(data.dataset), [data.dataset]);
  const results = useMemo(
    () => searchPlazas(data.dataset, { query, route: route ?? undefined, type: type ?? undefined }, near?.coords),
    [data.dataset, query, route, type, near],
  );
  const infos = useMemo(
    () => new Map(results.map((r) => [r.plaza.id, computePlazaInfo(data, r.plaza, today)])),
    [results, data, today],
  );
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = results.map((r) => ({ kind: 'plaza', id: r.plaza.id, distance: r.distanceMetres }));
    const after = AD_PLACEMENTS.directory_inline.afterItems ?? 8;
    if (list.length > after) list.splice(after, 0, { kind: 'ad' });
    return list;
  }, [results]);

  const locate = async () => {
    setLocating(true);
    setLocationMessage(null);
    const r = await getLocationOnce();
    setLocating(false);
    if (r.status === 'ok') {
      setNear({ coords: r.coords, label: 'your location' });
    } else {
      setLocationMessage(
        r.status === 'denied' ? 'Location permission was not given. You can choose a town instead.' : r.message,
      );
      setTownPicker(true);
    }
  };

  const unlocated = near ? results.filter((r) => r.distanceMetres === undefined).length : 0;

  const listHeader = (
    <View style={styles.header}>
      {header}
      <TextField
        icon="magnify"
        placeholder="Search plaza, road, operator or province"
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel="Search toll plazas"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All roads" selected={route === null} onPress={() => setRoute(null)} />
        {routes.map((r) => (
          <Chip
            key={r}
            label={r}
            selected={route === r}
            onPress={() => setRoute(route === r ? null : r)}
            accessibilityLabel={`Route ${r}`}
          />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label={near ? `Near ${near.label}` : locating ? 'Locating…' : 'Near me'}
          icon="crosshairs-gps"
          selected={!!near}
          onPress={() => (near ? setNear(null) : void locate())}
          accessibilityLabel={
            near ? `Sorted by distance from ${near.label}. Tap to clear` : 'Sort by distance from my location'
          }
        />
        <Chip label="Choose town" icon="city-variant-outline" onPress={() => setTownPicker(true)} />
        <Chip
          label="Mainline"
          selected={type === 'mainline'}
          onPress={() => setType(type === 'mainline' ? null : 'mainline')}
        />
        <Chip label="Ramp" selected={type === 'ramp'} onPress={() => setType(type === 'ramp' ? null : 'ramp')} />
      </ScrollView>
      {locationMessage ? <Banner tone="info">{locationMessage}</Banner> : null}
      <View style={styles.countRow}>
        <AppText variant="small" color={colors.ink500}>
          {results.length} {results.length === 1 ? 'plaza' : 'plazas'} · prices for{' '}
          {STANDARD_CLASS_LABEL[defaultClass].label} ({STANDARD_CLASS_LABEL[defaultClass].short.toLowerCase()})
        </AppText>
      </View>
      {near && unlocated > 0 ? (
        <AppText variant="small" color={colors.ink500}>
          Distances are approximate. {unlocated} {unlocated === 1 ? 'plaza has' : 'plazas have'} no confirmed position
          and {unlocated === 1 ? 'is' : 'are'} listed last.
        </AppText>
      ) : null}
    </View>
  );

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={(r, i) => (r.kind === 'ad' ? `ad-${i}` : r.id)}
        ListHeaderComponent={listHeader}
        ItemSeparatorComponent={() => <Divider inset={spacing.lg} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.huge }]}
        renderItem={({ item }) => {
          if (item.kind === 'ad') return <AdSlot placement="directory_inline" />;
          const info = infos.get(item.id);
          if (!info) return null;
          return (
            <PlazaRow
              info={info}
              vehicleClass={defaultClass}
              distanceMetres={item.distance}
              favourite={favouritePlazaIds.includes(item.id)}
            />
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="map-search-outline"
            title="No toll plazas match"
            body="Try a different spelling, another road, or clear the filters."
            action={
              <Button
                label="Clear search and filters"
                variant="outline"
                onPress={() => {
                  setQuery('');
                  setRoute(null);
                  setType(null);
                }}
              />
            }
          />
        }
        style={styles.list}
      />
      <Modal visible={townPicker} transparent animationType="slide" onRequestClose={() => setTownPicker(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setTownPicker(false)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <AppText variant="heading">Sort by distance from…</AppText>
          <AppText variant="small" color={colors.ink500}>
            Choose a town instead of sharing your location. Distances are straight-line and approximate.
          </AppText>
          <ScrollView style={styles.townList}>
            {REFERENCE_TOWNS.map((t) => (
              <Pressable
                key={t.name}
                accessibilityRole="button"
                onPress={() => {
                  setNear({ coords: t.coords, label: t.name });
                  setTownPicker(false);
                  setLocationMessage(null);
                }}
                style={({ pressed }) => [styles.town, pressed && { backgroundColor: colors.surfaceMuted }]}>
                <Icon name="map-marker-outline" size={20} color={colors.teal700} />
                <AppText variant="bodyStrong">{t.name}</AppText>
              </Pressable>
            ))}
          </ScrollView>
          <Button label="Cancel" variant="outline" onPress={() => setTownPicker(false)} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: spacing.sm },
  header: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  countRow: { flexDirection: 'row', justifyContent: 'space-between' },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    maxHeight: '75%',
  },
  townList: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md },
  town: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
