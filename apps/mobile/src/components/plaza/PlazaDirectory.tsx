import {
  PROVINCE_NAMES,
  STANDARD_CLASS_LABEL,
  availableOperators,
  availableProvinces,
  availableRoutes,
  searchPlazas,
  sortPlazaResults,
  type LatLng,
  type PlazaSort,
  type PlazaType,
  type ProvinceCode,
} from '@toll-e/core';
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Banner,
  Button,
  Chip,
  Divider,
  EmptyState,
  Icon,
  OptionSheet,
  TextField,
  type SheetOption,
} from '@/components/ui';
import { useData } from '@/data/DataProvider';
import { computePlazaInfo } from '@/hooks/usePlazaInfo';
import { useToday } from '@/hooks/useToday';
import { REFERENCE_TOWNS, getLocationOnce } from '@/services/location';
import { usePreferences } from '@/state/preferences';
import { useSaved } from '@/state/saved';
import { colors, radii, spacing } from '@/theme/tokens';

import { PlazaRow } from './PlazaRow';

type Near = { coords: LatLng; label: string } | null;
type Sheet = 'sort' | 'province' | 'operator' | null;

const SORT_CHIP_LABEL: Record<PlazaSort, string> = {
  relevance: 'Sort',
  name: 'Name A–Z',
  price_low: 'Lowest price',
  price_high: 'Highest price',
  province: 'By province',
  distance: 'Nearest',
};

export function PlazaDirectory({
  initialQuery = '',
  header,
  initialNear = false,
  footer,
}: {
  initialQuery?: string;
  header?: ReactElement;
  initialNear?: boolean;
  /** Fixed below the list, outside the scrolling area. */
  footer?: ReactNode;
}) {
  const data = useData();
  const today = useToday();
  const { defaultClass } = usePreferences();
  const { favouritePlazaIds } = useSaved();
  const [query, setQuery] = useState(initialQuery);
  const [route, setRoute] = useState<string | null>(null);
  const [type, setType] = useState<PlazaType | null>(null);
  const [province, setProvince] = useState<ProvinceCode | null>(null);
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [sort, setSort] = useState<PlazaSort>('relevance');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [near, setNearState] = useState<Near>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [townPicker, setTownPicker] = useState(initialNear);
  const insets = useSafeAreaInsets();

  const routes = useMemo(() => availableRoutes(data.dataset), [data.dataset]);
  const provinces = useMemo(() => availableProvinces(data.dataset), [data.dataset]);
  const operators = useMemo(() => availableOperators(data.dataset), [data.dataset]);
  const withoutProvince = useMemo(
    () => searchPlazas(data.dataset).filter((r) => !r.plaza.province).length,
    [data.dataset],
  );
  const found = useMemo(
    () =>
      searchPlazas(
        data.dataset,
        {
          query,
          route: route ?? undefined,
          type: type ?? undefined,
          province: province ?? undefined,
          operatorId: operatorId ?? undefined,
        },
        near?.coords,
      ),
    [data.dataset, query, route, type, province, operatorId, near],
  );
  const infos = useMemo(
    () => new Map(found.map((r) => [r.plaza.id, computePlazaInfo(data, r.plaza, today)])),
    [found, data, today],
  );
  // Prices are sorted by the amount shown in each row: the default vehicle class.
  const results = useMemo(
    () =>
      sortPlazaResults(found, sort, (p) => {
        const r = infos.get(p.id)?.byClass[defaultClass];
        return r?.kind === 'current' ? r.tariff.amountCents : null;
      }),
    [found, sort, infos, defaultClass],
  );

  // Choosing a location sorts by distance; clearing it goes back to the default order.
  const setNear = (next: Near) => {
    setNearState(next);
    if (next) setSort('distance');
    else if (sort === 'distance') setSort('relevance');
  };
  const filtered = route !== null || type !== null || province !== null || operatorId !== null;
  const clearFilters = () => {
    setRoute(null);
    setType(null);
    setProvince(null);
    setOperatorId(null);
  };
  const classLabel = STANDARD_CLASS_LABEL[defaultClass].label;
  const priceCaption = `${classLabel} price. Plazas without a current price are listed last.`;
  const sortOptions: SheetOption<PlazaSort>[] = [
    { value: 'relevance', label: 'Default', caption: 'Best match to your search, then by road (N1, N2 …)' },
    { value: 'name', label: 'Name (A–Z)' },
    { value: 'price_low', label: 'Price: lowest first', caption: priceCaption },
    { value: 'price_high', label: 'Price: highest first', caption: priceCaption },
    { value: 'province', label: 'Province', caption: 'Plazas without a recorded province are listed last.' },
    ...(near
      ? [
          {
            value: 'distance' as const,
            label: 'Distance',
            caption: `From ${near.label}. Plazas without a known position are listed last.`,
          },
        ]
      : []),
  ];
  const provinceOptions: SheetOption<ProvinceCode | 'all'>[] = [
    { value: 'all', label: 'All provinces' },
    ...provinces.map((p) => ({ value: p, label: PROVINCE_NAMES[p] })),
  ];
  const operatorOptions: SheetOption<string>[] = [
    { value: 'all', label: 'All operators' },
    ...operators.map((o) => ({
      value: o.id,
      label: o.shortName,
      caption: o.name === o.shortName ? undefined : o.name,
    })),
  ];
  const operatorName = operators.find((o) => o.id === operatorId)?.shortName;

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
          label={SORT_CHIP_LABEL[sort]}
          icon="sort"
          menu
          selected={sort !== 'relevance'}
          onPress={() => setSheet('sort')}
          accessibilityLabel={`Sort order: ${sortOptions.find((o) => o.value === sort)?.label ?? 'Default'}`}
        />
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
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label={province ? PROVINCE_NAMES[province] : 'Province'}
          menu
          selected={province !== null}
          onPress={() => setSheet('province')}
          accessibilityLabel={`Province: ${province ? PROVINCE_NAMES[province] : 'all'}`}
        />
        <Chip
          label={operatorName ?? 'Operator'}
          menu
          selected={operatorId !== null}
          onPress={() => setSheet('operator')}
          accessibilityLabel={`Operator: ${operatorName ?? 'all'}`}
        />
        <Chip
          label="Mainline"
          selected={type === 'mainline'}
          onPress={() => setType(type === 'mainline' ? null : 'mainline')}
        />
        <Chip label="Ramp" selected={type === 'ramp'} onPress={() => setType(type === 'ramp' ? null : 'ramp')} />
      </ScrollView>
      {locationMessage ? <Banner tone="info">{locationMessage}</Banner> : null}
      <View style={styles.countRow}>
        <AppText variant="small" color={colors.ink500} style={styles.count}>
          {results.length} {results.length === 1 ? 'plaza' : 'plazas'} · prices for {classLabel} (
          {STANDARD_CLASS_LABEL[defaultClass].short.toLowerCase()})
        </AppText>
        {filtered ? <Button label="Clear filters" variant="ghost" size="sm" onPress={clearFilters} /> : null}
      </View>
      {near && unlocated > 0 ? (
        <AppText variant="small" color={colors.ink500}>
          Distances are approximate. {unlocated} {unlocated === 1 ? 'plaza has' : 'plazas have'} no confirmed position
          {sort === 'distance' ? ` and ${unlocated === 1 ? 'is' : 'are'} listed last` : ''}.
        </AppText>
      ) : null}
    </View>
  );

  return (
    <>
      <FlatList
        testID="plaza-list"
        data={results}
        keyExtractor={(r) => r.plaza.id}
        ListHeaderComponent={listHeader}
        ItemSeparatorComponent={() => <Divider inset={spacing.lg} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.huge }]}
        renderItem={({ item }) => {
          const info = infos.get(item.plaza.id);
          if (!info) return null;
          return (
            <PlazaRow
              info={info}
              vehicleClass={defaultClass}
              distanceMetres={item.distanceMetres}
              favourite={favouritePlazaIds.includes(item.plaza.id)}
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
                  clearFilters();
                }}
              />
            }
          />
        }
        style={styles.list}
      />
      {footer}
      <OptionSheet
        visible={sheet === 'sort'}
        title="Sort plazas"
        options={sortOptions}
        selected={sort}
        onSelect={setSort}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'province'}
        title="Filter by province"
        options={provinceOptions}
        selected={province ?? 'all'}
        onSelect={(v) => setProvince(v === 'all' ? null : v)}
        onClose={() => setSheet(null)}
        footnote={
          withoutProvince > 0
            ? `${withoutProvince} ${withoutProvince === 1 ? 'plaza has' : 'plazas have'} no province recorded yet and ${withoutProvince === 1 ? 'is' : 'are'} not shown when you choose a province.`
            : undefined
        }
      />
      <OptionSheet
        visible={sheet === 'operator'}
        title="Filter by operator"
        options={operatorOptions}
        selected={operatorId ?? 'all'}
        onSelect={(v) => setOperatorId(v === 'all' ? null : v)}
        onClose={() => setSheet(null)}
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
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  count: { flex: 1 },
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
