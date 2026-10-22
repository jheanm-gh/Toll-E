import {
  PLAZA_TYPE_LABEL,
  PROVINCE_NAMES,
  STANDARD_CLASSES,
  STANDARD_CLASS_LABEL,
  TRUST_EXPLANATION,
  VERIFICATION_LABEL,
  destinationUrl,
  formatLongDate,
  formatZAR,
  plazaNavigationTarget,
  tariffHistory,
  type PaymentMethod,
  type Source,
} from '@toll-e/core';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { NavigateSheet } from '@/components/plaza/NavigateSheet';
import { RouteBadge } from '@/components/plaza/RouteBadge';
import { SourceList } from '@/components/plaza/SourceList';
import { TariffTable } from '@/components/plaza/TariffTable';
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  ListRow,
  Price,
  Screen,
  SectionHeader,
  TrustBadge,
  useToast,
} from '@/components/ui';
import { useData, usePlaza } from '@/data/DataProvider';
import { usePlazaInfo } from '@/hooks/usePlazaInfo';
import { useToday } from '@/hooks/useToday';
import { AdSlot } from '@/monetisation/ads/AdSlot';
import { openExternal } from '@/services/linking';
import { usePreferences } from '@/state/preferences';
import { useSaved } from '@/state/saved';
import { colors, spacing } from '@/theme/tokens';

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  contactless_card: 'Contactless bank card or phone (tap to pay)',
  e_tag: 'SANRAL e-tag',
};

export default function PlazaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plaza = usePlaza(id);
  const info = usePlazaInfo(plaza);
  const { dataset, index } = useData();
  const today = useToday();
  const { defaultClass } = usePreferences();
  const saved = useSaved();
  const toast = useToast();
  const [navOpen, setNavOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { recordPlazaView } = saved;

  useEffect(() => {
    if (plaza) recordPlazaView(plaza.id);
  }, [plaza, recordPlazaView]);

  const sources = useMemo(() => {
    if (!plaza || !info) return [] as Source[];
    const ids = new Set<string>(plaza.sourceIds);
    for (const c of STANDARD_CLASSES) {
      const r = info.byClass[c];
      if (r.kind === 'current') ids.add(r.tariff.sourceId);
    }
    plaza.location?.sourceIds.forEach((s) => ids.add(s));
    return dataset.sources.filter((s) => ids.has(s.id)).sort((a, b) => Number(b.official) - Number(a.official));
  }, [plaza, info, dataset.sources]);

  const scheme = plaza ? dataset.vehicleClassSchemes.find((s) => s.id === plaza.classSchemeId) : undefined;
  const otherSchemeTariffs = useMemo(() => {
    if (!plaza || !scheme || scheme.id === 'za-standard') return [];
    return scheme.classes.map((c) => ({ cls: c, history: tariffHistory(index, plaza.id, c.id) }));
  }, [plaza, scheme, index]);

  if (!plaza || !info) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <EmptyState
          icon="map-marker-question-outline"
          title="Plaza not found"
          body="It may have been removed or renamed in a data update."
          action={<Button label="Browse all plazas" onPress={() => router.replace('/plazas')} />}
        />
      </Screen>
    );
  }

  const favourite = saved.isFavourite(plaza.id);
  const main = info.byClass[defaultClass];
  const op = info.operator;
  const nav = plazaNavigationTarget(plaza);
  const history = STANDARD_CLASSES.map((c) => ({ c, list: tariffHistory(index, plaza.id, c) })).filter(
    (h) => h.list.length > 0,
  );
  const hasPast = history.some((h) => h.list.some((t) => t.effectiveTo !== null && t.effectiveTo < today));

  return (
    <Screen edges={[]}>
      <Stack.Screen
        options={{
          title: plaza.name,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={favourite ? 'Remove from favourites' : 'Add to favourites'}
              accessibilityState={{ selected: favourite }}
              hitSlop={12}
              onPress={() => {
                const now = saved.toggleFavourite(plaza.id);
                toast(now ? 'Added to favourites' : 'Removed from favourites');
              }}>
              <Icon
                name={favourite ? 'star' : 'star-outline'}
                size={24}
                color={favourite ? colors.amber500 : colors.navy900}
              />
            </Pressable>
          ),
        }}
      />

      {/* Identity */}
      <View style={styles.identity}>
        <View style={styles.identityRow}>
          <RouteBadge route={plaza.route} />
          <Badge label={PLAZA_TYPE_LABEL[plaza.type]} tone={plaza.type === 'unknown' ? 'neutral' : 'brand'} />
        </View>
        <AppText variant="display" accessibilityRole="header">
          {plaza.name}
        </AppText>
        <AppText variant="body" color={colors.ink500}>
          {[info.road?.name, op?.name, plaza.province ? PROVINCE_NAMES[plaza.province] : null]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        {plaza.locality ? (
          <AppText variant="small" color={colors.ink500}>
            {plaza.locality}
          </AppText>
        ) : null}
      </View>

      {/* Headline price */}
      <Card>
        <AppText variant="label" color={colors.ink500}>
          {STANDARD_CLASS_LABEL[defaultClass].label} · {STANDARD_CLASS_LABEL[defaultClass].short} · one passage
        </AppText>
        {main.kind === 'current' ? (
          <View style={styles.headline}>
            <Price cents={main.tariff.amountCents} variant="price" color={colors.navy900} />
            <TrustBadge trust={main.trust} />
            <AppText variant="small" color={colors.ink700}>
              {TRUST_EXPLANATION[main.trust]}
            </AppText>
            <AppText variant="small" color={colors.ink500}>
              In force since {formatLongDate(main.tariff.effectiveFrom)}
              {main.tariff.effectiveTo ? ` until ${formatLongDate(main.tariff.effectiveTo)}` : ''} ·{' '}
              {main.tariff.vatInclusive ? 'VAT inclusive' : 'excluding VAT'} · checked{' '}
              {formatLongDate(main.tariff.checkedOn)}
            </AppText>
            {main.possiblySuperseded ? (
              <Banner tone="warning" title="A tariff adjustment date has passed">
                Tolls are normally adjusted on this date each year and Toll-E has not loaded a newer tariff yet. Check
                with the operator.
              </Banner>
            ) : null}
            {main.upcoming ? (
              <Banner
                tone="info"
                title={`Announced: ${formatZAR(main.upcoming.amountCents)} from ${formatLongDate(main.upcoming.effectiveFrom)}`}>
                The current price applies until then.
              </Banner>
            ) : null}
            {main.tariff.notes ? (
              <AppText variant="small" color={colors.ink500}>
                Note: {main.tariff.notes}
              </AppText>
            ) : null}
          </View>
        ) : (
          <View style={styles.headline}>
            <TrustBadge trust="unavailable" />
            <AppText variant="body" color={colors.ink700}>
              {main.kind === 'none'
                ? 'Toll-E does not have a current tariff for this vehicle class.'
                : 'The charge here depends on your direction of travel.'}
            </AppText>
            {sources.length ? (
              <AppText variant="small" color={colors.ink500}>
                Check the official source listed below.
              </AppText>
            ) : null}
          </View>
        )}
        <Button label="Change default vehicle class" variant="ghost" size="sm" onPress={() => router.push('/more')} />
      </Card>

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button label="Directions" icon="navigation-variant-outline" onPress={() => setNavOpen(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Add to trip"
            variant="outline"
            icon="calculator-variant-outline"
            onPress={() => router.push({ pathname: '/calculate', params: { addPlaza: plaza.id } })}
          />
        </View>
      </View>

      {/* All classes */}
      <SectionHeader title="Tariffs by vehicle class" caption="Per passage of the plaza, as published." />
      <Card>
        {scheme && scheme.id !== 'za-standard' ? (
          <View style={{ gap: spacing.md }}>
            <AppText variant="small" color={colors.ink500}>
              This plaza uses its own vehicle classes ({scheme.name}).
            </AppText>
            {otherSchemeTariffs.map(({ cls, history: h }) => {
              const current = h.find(
                (t) => t.effectiveFrom <= today && (t.effectiveTo === null || today <= t.effectiveTo),
              );
              return (
                <View key={cls.id} style={styles.otherRow}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{cls.label}</AppText>
                    <AppText variant="small" color={colors.ink500}>
                      {cls.description}
                    </AppText>
                  </View>
                  {current ? (
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Price cents={current.amountCents} color={colors.navy900} />
                      <Badge
                        label={VERIFICATION_LABEL[current.verificationStatus]}
                        tone={current.verificationStatus === 'pending_review' ? 'review' : 'outlineWarning'}
                      />
                    </View>
                  ) : (
                    <TrustBadge trust="unavailable" />
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <TariffTable info={info} highlight={defaultClass} />
        )}
      </Card>
      <AppText variant="small" color={colors.ink500}>
        Frequent-user, local-user and e-tag discounts may apply at some plazas and are not shown.
      </AppText>

      {/* History */}
      {hasPast ? (
        <Card>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showHistory }}
            onPress={() => setShowHistory((v) => !v)}
            style={styles.historyToggle}>
            <AppText variant="heading" style={{ flex: 1 }}>
              Tariff history
            </AppText>
            <Icon name={showHistory ? 'chevron-up' : 'chevron-down'} size={22} color={colors.ink700} />
          </Pressable>
          {showHistory
            ? history.map(({ c, list }) => (
                <View key={c} style={styles.historyBlock}>
                  <AppText variant="smallStrong">{STANDARD_CLASS_LABEL[c].label}</AppText>
                  {list.map((t) => (
                    <View key={t.id} style={styles.historyRow}>
                      <AppText variant="small" color={colors.ink700} style={{ flex: 1 }}>
                        {formatLongDate(t.effectiveFrom)} –{' '}
                        {t.effectiveTo ? formatLongDate(t.effectiveTo) : 'until replaced'}
                      </AppText>
                      <AppText variant="smallStrong">{formatZAR(t.amountCents)}</AppText>
                      <Badge
                        label={
                          t.effectiveTo !== null && t.effectiveTo < today
                            ? 'Expired'
                            : t.effectiveFrom > today
                              ? 'Future'
                              : 'Current'
                        }
                        tone="neutral"
                      />
                    </View>
                  ))}
                </View>
              ))
            : null}
        </Card>
      ) : null}

      {/* Location */}
      <SectionHeader title="Location" />
      <Card style={{ gap: spacing.sm }}>
        {plaza.location ? (
          <>
            <Badge
              label={plaza.location.precision === 'verified' ? 'Verified position' : 'Approximate position'}
              tone={plaza.location.precision === 'verified' ? 'success' : 'outlineWarning'}
              icon="map-marker-outline"
            />
            <AppText variant="small" color={colors.ink700}>
              {plaza.location.lat.toFixed(4)}, {plaza.location.lng.toFixed(4)}
            </AppText>
            {plaza.location.notes ? (
              <AppText variant="small" color={colors.ink500}>
                {plaza.location.notes}
              </AppText>
            ) : null}
          </>
        ) : (
          <>
            <Badge label="Position not yet confirmed" tone="neutral" icon="map-marker-off-outline" />
            <AppText variant="small" color={colors.ink500}>
              Toll-E has not confirmed where this plaza is, so it is not shown on the map. Directions search for it by
              name.
            </AppText>
          </>
        )}
        {plaza.carriageway ? <AppText variant="small">{plaza.carriageway}</AppText> : null}
        {plaza.notes?.map((n) => (
          <AppText key={n} variant="small" color={colors.ink700}>
            • {n}
          </AppText>
        ))}
      </Card>

      {/* Payment */}
      <SectionHeader title="Payment" />
      <Card style={{ gap: spacing.sm }}>
        {op?.payment ? (
          <>
            <Badge
              label={`${VERIFICATION_LABEL[op.payment.status]} · reported for ${op.shortName} plazas`}
              tone="outlineWarning"
              icon="help-circle-outline"
            />
            {op.payment.methods.map((m) => (
              <View key={m} style={styles.payRow}>
                <Icon
                  name={m === 'cash' ? 'cash' : m === 'e_tag' ? 'card-account-details-outline' : 'contactless-payment'}
                  size={18}
                  color={colors.ink700}
                />
                <AppText variant="body">{PAYMENT_LABEL[m]}</AppText>
              </View>
            ))}
            {op.payment.notes ? (
              <AppText variant="small" color={colors.ink500}>
                {op.payment.notes}
              </AppText>
            ) : null}
          </>
        ) : (
          <AppText variant="small" color={colors.ink500}>
            Payment methods for this plaza have not been researched yet. Carry cash or a contactless card, and check
            with the operator.
          </AppText>
        )}
      </Card>

      {/* Operator */}
      {op ? (
        <>
          <SectionHeader title="Operator" />
          <Card padded={false}>
            <ListRow
              title={op.name}
              subtitle={`Contact details ${op.contactStatus === 'verified' ? 'verified' : 'not yet verified'}${op.notes ? ` · ${op.notes}` : ''}`}
              icon="domain"
            />
            {op.website ? (
              <>
                <Divider inset={spacing.lg} />
                <ListRow
                  title="Operator website"
                  subtitle={op.website.replace(/^https:\/\//, '')}
                  icon="web"
                  external
                  onPress={async () => {
                    if (!(await openExternal(op.website!))) Alert.alert('Could not open the link', op.website);
                  }}
                />
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {/* Sources */}
      <SectionHeader
        title="Sources & verification"
        caption="Where the information on this page comes from. Official sources take precedence."
      />
      <Card padded={false}>
        <SourceList sources={sources} />
      </Card>
      <Button
        label="Report incorrect information"
        variant="outline"
        icon="flag-outline"
        onPress={() => router.push({ pathname: '/report', params: { plazaId: plaza.id } })}
      />

      <AdSlot placement="plaza_detail_footer" />

      <NavigateSheet
        visible={navOpen}
        onClose={() => setNavOpen(false)}
        title={`Directions to ${plaza.name}`}
        note={
          nav.coordinate
            ? undefined
            : 'Toll-E searches for the plaza by name because its exact position has not been verified. Toll prices are not sent to the app.'
        }
        urlFor={(app) => destinationUrl(app, nav)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { gap: spacing.xs, paddingTop: spacing.sm },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headline: { gap: spacing.sm, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md },
  otherRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  historyToggle: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  historyBlock: { gap: spacing.xs, marginTop: spacing.md },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  payRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
