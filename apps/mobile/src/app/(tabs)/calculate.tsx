import {
  STANDARD_CLASS_LABEL,
  calculate,
  formatLongDate,
  formatZAR,
  isISODate,
  journeyInput,
  journeyUrl,
  manualInput,
  type CalculationResult,
  type Journey,
  type StandardClassId,
  type TripType,
} from '@toll-e/core';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ClassPicker } from '@/components/calculator/ClassPicker';
import { PlazaPicker } from '@/components/calculator/PlazaPicker';
import { ResultCard } from '@/components/calculator/ResultCard';
import { DataStatus } from '@/components/plaza/DataStatus';
import { NavigateSheet } from '@/components/plaza/NavigateSheet';
import { RouteBadge } from '@/components/plaza/RouteBadge';
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Icon,
  Screen,
  SectionHeader,
  SegmentedControl,
  TextField,
  useToast,
} from '@/components/ui';
import { useData } from '@/data/DataProvider';
import { useOfferedJourneys } from '@/data/journeys';
import { useToday } from '@/hooks/useToday';
import { shareText } from '@/services/share';
import { usePreferences } from '@/state/preferences';
import { useSaved, type CalculationRequest } from '@/state/saved';
import { colors, radii, spacing } from '@/theme/tokens';

type Mode = 'journey' | 'manual';

function shareMessage(result: CalculationResult, title: string, plazaName: (id: string) => string): string {
  const cls = STANDARD_CLASS_LABEL[result.input.standardClass];
  const priced = result.lines.filter((l) => l.status === 'priced');
  return [
    `Toll-E ${result.confidence === 'confirmed' ? 'toll cost' : 'toll estimate'}: ${title}`,
    `${cls.label} (${cls.short.toLowerCase()}), ${result.input.trip === 'return' ? 'return' : 'one way'}: ${formatZAR(result.totalCents)}`,
    result.confidence === 'partial'
      ? `Partial: ${result.pricedCount} of ${result.chargeableCount} plazas priced.`
      : null,
    priced.map((l) => `• ${plazaName(l.plazaId)} ${formatZAR(l.amountCents!)}`).join('\n'),
    `Tariffs in force on ${formatLongDate(result.input.date)}. Not all values are verified — confirm with the operator.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export default function CalculateScreen() {
  const params = useLocalSearchParams<{ journey?: string; addPlaza?: string; saved?: string }>();
  const { dataset, index } = useData();
  const today = useToday();
  const prefs = usePreferences();
  const saved = useSaved();
  const toast = useToast();
  const journeys = useOfferedJourneys();

  const [mode, setMode] = useState<Mode>(journeys.length > 0 ? 'journey' : 'manual');
  const [journeyId, setJourneyId] = useState<string>(journeys[0]?.id ?? '');
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [trip, setTrip] = useState<TripType>('one_way');
  // The class follows the default from settings until the user picks one here.
  const [clsOverride, setClsOverride] = useState<StandardClassId | null>(null);
  const cls = clsOverride ?? prefs.defaultClass;
  const [date, setDate] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState('');
  const [editingDate, setEditingDate] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [restoredFrom, setRestoredFrom] = useState<{ savedAt: string; totalCents: number } | null>(null);

  // Deep links: add a plaza, pick a journey, or reopen a saved calculation.
  // Each set of params is applied once, during render, then cleared from the URL.
  const savedReady = !params.saved || saved.loaded;
  const paramsKey = `${params.addPlaza ?? ''}|${params.journey ?? ''}|${params.saved ?? ''}`;
  const [appliedKey, setAppliedKey] = useState('||');
  if (paramsKey !== appliedKey && savedReady) {
    setAppliedKey(paramsKey);
    if (params.addPlaza) {
      const id = params.addPlaza;
      setMode('manual');
      setManualIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    }
    if (params.journey && journeys.some((j) => j.id === params.journey)) {
      setMode('journey');
      setJourneyId(params.journey);
    }
    const s = params.saved
      ? [...saved.savedCalculations, ...saved.recentCalculations].find((x) => x.id === params.saved)
      : undefined;
    if (s) {
      const r = s.request;
      setMode(r.mode);
      if (r.journeyId) setJourneyId(r.journeyId);
      setManualIds(r.plazaIds);
      setIncluded(new Set(r.includeConditional));
      setTrip(r.trip);
      setClsOverride(r.standardClass);
      setDate(r.date);
      setRestoredFrom({ savedAt: s.savedAt, totalCents: s.snapshot.totalCents });
    }
  }
  const hasParams = paramsKey !== '||';
  useEffect(() => {
    if (hasParams && appliedKey === paramsKey) {
      router.setParams({ addPlaza: undefined, journey: undefined, saved: undefined });
    }
  }, [hasParams, appliedKey, paramsKey]);

  const journey: Journey | undefined = journeys.find((j) => j.id === journeyId);
  const travelDate = date ?? today;
  const plazaName = (id: string) => dataset.plazas.find((p) => p.id === id)?.name ?? id;

  const result = useMemo(() => {
    if (mode === 'journey') {
      if (!journey) return null;
      return calculate(
        index,
        journeyInput(journey, {
          trip,
          standardClass: cls,
          date: travelDate,
          includeConditional: included,
        }),
      );
    }
    if (manualIds.length === 0) return null;
    return calculate(index, manualInput(manualIds, { trip, standardClass: cls, date: travelDate }));
  }, [mode, journey, index, trip, cls, travelDate, included, manualIds]);

  const request: CalculationRequest = {
    mode,
    journeyId: mode === 'journey' ? journeyId : undefined,
    plazaIds: mode === 'manual' ? manualIds : [],
    includeConditional: mode === 'journey' ? [...included] : [],
    trip,
    standardClass: cls,
    date,
  };
  const title =
    mode === 'journey' && journey
      ? `${journey.name} (${journey.via})`
      : manualIds.length
        ? `${plazaName(manualIds[0]!)}${manualIds.length > 1 ? ` → ${plazaName(manualIds.at(-1)!)}` : ''} (${manualIds.length} ${manualIds.length === 1 ? 'plaza' : 'plazas'})`
        : 'Custom trip';
  const snapshot = result
    ? {
        totalCents: result.totalCents,
        confidence: result.confidence,
        pricedCount: result.pricedCount,
        chargeableCount: result.chargeableCount,
        tariffDate: travelDate,
        datasetVersion: dataset.datasetVersion,
      }
    : null;

  // Remember the calculation once the inputs have settled.
  const { recordRecentCalculation } = saved;
  const requestKey = JSON.stringify(request);
  useEffect(() => {
    if (!snapshot || !result || result.chargeableCount === 0) return;
    const t = setTimeout(() => recordRecentCalculation({ label: title, request, snapshot }), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, snapshot?.totalCents]);

  const applyDate = () => {
    const v = dateDraft.trim();
    if (v === '') {
      setDate(null);
      setEditingDate(false);
    } else if (isISODate(v)) {
      setDate(v === today ? null : v);
      setEditingDate(false);
    }
  };
  const dateError =
    dateDraft.trim() !== '' && !isISODate(dateDraft.trim()) ? 'Use the format YYYY-MM-DD, e.g. 2026-12-15' : null;

  const move = (i: number, delta: number) =>
    setManualIds((ids) => {
      const next = [...ids];
      const j = i + delta;
      if (j < 0 || j >= next.length) return ids;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <Screen title="Calculate tolls" subtitle="Toll costs for your vehicle, with every plaza itemised.">
      {restoredFrom && result ? (
        <Banner
          tone={restoredFrom.totalCents === result.totalCents ? 'info' : 'warning'}
          title={`Reopened a calculation saved ${formatLongDate(restoredFrom.savedAt.slice(0, 10))}`}>
          {restoredFrom.totalCents === result.totalCents
            ? 'The total is unchanged with current data.'
            : `It was ${formatZAR(restoredFrom.totalCents)} then; with current data it is ${formatZAR(result.totalCents)}.`}
        </Banner>
      ) : null}

      <SegmentedControl
        accessibilityLabel="How to choose toll plazas"
        value={mode}
        onChange={setMode}
        segments={[
          { value: 'journey', label: 'Popular routes', icon: 'routes' },
          { value: 'manual', label: 'Choose plazas', icon: 'gesture-tap' },
        ]}
      />

      {mode === 'journey' && journeys.length === 0 ? (
        <Card tone="muted">
          <EmptyState
            icon="routes"
            title="No checked routes yet"
            body="Popular routes appear here once every toll plaza on the route has been checked. You can still price a trip by choosing its plazas."
            action={<Button label="Choose plazas" icon="gesture-tap" onPress={() => setMode('manual')} />}
          />
        </Card>
      ) : mode === 'journey' ? (
        <View style={styles.block}>
          <View style={styles.journeyList}>
            {journeys.map((j) => {
              const active = j.id === journeyId;
              return (
                <Pressable
                  key={j.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`${j.name} via ${j.via}`}
                  onPress={() => {
                    setJourneyId(j.id);
                    setIncluded(new Set());
                  }}
                  style={({ pressed }) => [
                    styles.journey,
                    active && styles.journeyActive,
                    pressed && { opacity: 0.85 },
                  ]}>
                  <RouteBadge route={j.via} size="sm" />
                  <AppText variant="bodyStrong" style={{ flex: 1 }} color={active ? colors.navy900 : colors.ink700}>
                    {j.name}
                  </AppText>
                  <Icon
                    name={active ? 'radiobox-marked' : 'radiobox-blank'}
                    size={22}
                    color={active ? colors.teal600 : colors.ink400}
                  />
                </Pressable>
              );
            })}
          </View>
          {journey ? (
            <Card style={{ gap: spacing.sm }}>
              {journey.sequenceStatus !== 'verified' ? (
                <Badge label="Plaza sequence not yet checked" tone="warning" icon="alert-outline" />
              ) : null}
              <AppText variant="small" color={colors.ink700}>
                {journey.description}
              </AppText>
              {journey.events.map((e, i) => {
                const name = plazaName(e.plazaId);
                if (e.requirement === 'required') {
                  return (
                    <View key={e.plazaId} style={styles.eventRow}>
                      <View style={styles.dot}>
                        <AppText variant="smallStrong" color={colors.white}>
                          {i + 1}
                        </AppText>
                      </View>
                      <AppText variant="body" style={{ flex: 1 }}>
                        {name}
                      </AppText>
                    </View>
                  );
                }
                const on = included.has(e.plazaId);
                return (
                  <View key={e.plazaId} style={[styles.eventRow, styles.conditional]}>
                    <View style={[styles.dot, styles.dotMuted]}>
                      <AppText variant="smallStrong" color={colors.ink700}>
                        {i + 1}
                      </AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{name}</AppText>
                      <AppText variant="small" color={colors.ink500}>
                        {e.condition}
                      </AppText>
                    </View>
                    <Switch
                      accessibilityLabel={`Include ${name}`}
                      value={on}
                      onValueChange={(v) =>
                        setIncluded((s) => {
                          const n = new Set(s);
                          if (v) n.add(e.plazaId);
                          else n.delete(e.plazaId);
                          return n;
                        })
                      }
                      trackColor={{ true: colors.teal600, false: colors.borderStrong }}
                      thumbColor={colors.white}
                    />
                  </View>
                );
              })}
              {journey.limitations.map((l) => (
                <View key={l} style={styles.limitRow}>
                  <Icon name="information-outline" size={16} color={colors.ink500} />
                  <AppText variant="small" color={colors.ink500} style={{ flex: 1 }}>
                    {l}
                  </AppText>
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      ) : (
        <View style={styles.block}>
          {manualIds.length === 0 ? (
            <Card tone="muted">
              <EmptyState
                icon="map-marker-plus-outline"
                title="Choose your toll plazas"
                body="Add the plazas you will pass, in order. Toll-E prices each one for your vehicle."
                action={<Button label="Add toll plazas" icon="plus" onPress={() => setPickerOpen(true)} />}
              />
            </Card>
          ) : (
            <Card style={{ gap: spacing.xs }}>
              {manualIds.map((id, i) => (
                <View key={id} style={styles.eventRow}>
                  <View style={styles.dot}>
                    <AppText variant="smallStrong" color={colors.white}>
                      {i + 1}
                    </AppText>
                  </View>
                  <AppText variant="body" style={{ flex: 1 }}>
                    {plazaName(id)}
                  </AppText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${plazaName(id)} up`}
                    disabled={i === 0}
                    onPress={() => move(i, -1)}
                    hitSlop={8}
                    style={styles.iconBtn}>
                    <Icon name="chevron-up" size={22} color={i === 0 ? colors.border : colors.ink700} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${plazaName(id)} down`}
                    disabled={i === manualIds.length - 1}
                    onPress={() => move(i, 1)}
                    hitSlop={8}
                    style={styles.iconBtn}>
                    <Icon
                      name="chevron-down"
                      size={22}
                      color={i === manualIds.length - 1 ? colors.border : colors.ink700}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${plazaName(id)}`}
                    onPress={() => setManualIds((ids) => ids.filter((x) => x !== id))}
                    hitSlop={8}
                    style={styles.iconBtn}>
                    <Icon name="close-circle-outline" size={22} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
              <View style={styles.manualActions}>
                <Button
                  label="Add plazas"
                  icon="plus"
                  variant="secondary"
                  size="sm"
                  onPress={() => setPickerOpen(true)}
                />
                <Button label="Clear" variant="ghost" size="sm" onPress={() => setManualIds([])} />
              </View>
            </Card>
          )}
        </View>
      )}

      <SectionHeader title="Vehicle" />
      <ClassPicker value={cls} onChange={setClsOverride} />

      <SectionHeader title="Trip" />
      <SegmentedControl
        accessibilityLabel="One way or return"
        value={trip}
        onChange={setTrip}
        segments={[
          { value: 'one_way', label: 'One way', icon: 'arrow-right' },
          { value: 'return', label: 'Return', icon: 'swap-horizontal' },
        ]}
      />
      <Card tone="muted" style={{ gap: spacing.sm }}>
        <View style={styles.dateRow}>
          <Icon name="calendar-month-outline" size={20} color={colors.ink700} />
          <AppText variant="body" style={{ flex: 1 }}>
            Travel date:{' '}
            <AppText variant="bodyStrong">{date ? formatLongDate(date) : `Today (${formatLongDate(today)})`}</AppText>
          </AppText>
          <Button
            label={editingDate ? 'Cancel' : 'Change'}
            variant="ghost"
            size="sm"
            onPress={() => {
              setDateDraft(date ?? '');
              setEditingDate((v) => !v);
            }}
          />
        </View>
        {editingDate ? (
          <View style={{ gap: spacing.sm }}>
            <TextField
              placeholder="YYYY-MM-DD"
              value={dateDraft}
              onChangeText={setDateDraft}
              error={dateError}
              hint="Toll-E uses the tariffs in force on this date in South Africa."
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Travel date, format year month day"
              onSubmitEditing={applyDate}
            />
            <View style={styles.manualActions}>
              <Button label="Use this date" size="sm" onPress={applyDate} disabled={!!dateError} />
              <Button
                label="Use today"
                size="sm"
                variant="outline"
                onPress={() => {
                  setDate(null);
                  setEditingDate(false);
                }}
              />
            </View>
          </View>
        ) : null}
      </Card>

      {result ? (
        <>
          <ResultCard result={result} dataset={dataset} />
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button
                label="Save"
                icon="bookmark-plus-outline"
                onPress={() => {
                  if (!snapshot) return;
                  saved.saveCalculation({ label: title, request, snapshot });
                  toast('Saved to your trips');
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Share"
                icon="share-variant-outline"
                variant="outline"
                onPress={async () => {
                  const outcome = await shareText(shareMessage(result, title, plazaName), 'Toll-E toll estimate');
                  if (outcome === 'copied') toast('Copied to clipboard');
                  if (outcome === 'unavailable') toast('Sharing is not available here');
                }}
              />
            </View>
          </View>
          {mode === 'journey' && journey ? (
            <Button
              label={`Directions: ${journey.name}`}
              variant="secondary"
              icon="navigation-variant-outline"
              onPress={() => setNavOpen(true)}
            />
          ) : null}
          <DataStatus />
        </>
      ) : null}

      <PlazaPicker
        visible={pickerOpen}
        selectedIds={manualIds}
        onAdd={(id) => setManualIds((ids) => (ids.includes(id) ? ids : [...ids, id]))}
        onClose={() => setPickerOpen(false)}
      />
      {journey ? (
        <NavigateSheet
          visible={navOpen}
          onClose={() => setNavOpen(false)}
          title={`Directions: ${journey.name}`}
          note="Opens your navigation app with the start and end of this route. Your app chooses the road, which may differ from the plazas above. Toll prices are not sent to the app."
          urlFor={(app) => journeyUrl(app, journey)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  journeyList: { gap: spacing.sm },
  journey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  journeyActive: { borderColor: colors.teal600, backgroundColor: colors.teal50 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 40 },
  conditional: {
    backgroundColor: colors.amber50,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.navy900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotMuted: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  limitRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  manualActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  iconBtn: { padding: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md },
});
