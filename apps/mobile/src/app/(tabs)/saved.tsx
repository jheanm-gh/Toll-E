import { STANDARD_CLASS_LABEL, formatLongDate, formatZAR } from '@toll-e/core';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { PlazaRow } from '@/components/plaza/PlazaRow';
import {
  AppText,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  useToast,
} from '@/components/ui';
import { useData } from '@/data/DataProvider';
import { computePlazaInfo } from '@/hooks/usePlazaInfo';
import { useToday } from '@/hooks/useToday';
import { confirmDestructive } from '@/services/confirm';
import { usePreferences } from '@/state/preferences';
import { useSaved, type SavedCalculation } from '@/state/saved';
import { colors, spacing } from '@/theme/tokens';

function describe(c: SavedCalculation) {
  const parts = [
    STANDARD_CLASS_LABEL[c.request.standardClass].label,
    c.request.trip === 'return' ? 'return' : 'one way',
    `${formatZAR(c.snapshot.totalCents)}${c.snapshot.confidence === 'partial' ? ' (partial)' : ''} on ${formatLongDate(c.savedAt.slice(0, 10))}`,
  ];
  return parts.join(' · ');
}

export default function SavedScreen() {
  const data = useData();
  const today = useToday();
  const { defaultClass } = usePreferences();
  const saved = useSaved();
  const toast = useToast();
  const favourites = saved.favouritePlazaIds
    .map((id) => data.dataset.plazas.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const recentPlazas = saved.recentPlazaIds
    .map((id) => data.dataset.plazas.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 5);
  const nothing =
    favourites.length === 0 &&
    saved.savedCalculations.length === 0 &&
    saved.recentCalculations.length === 0 &&
    recentPlazas.length === 0;

  return (
    <Screen title="Saved" subtitle="Stored on this device only. No account needed.">
      {nothing ? (
        <EmptyState
          icon="bookmark-outline"
          title="Nothing saved yet"
          body="Save a calculation from the calculator, or star a plaza to keep it here."
          action={<Button label="Calculate a trip" onPress={() => router.push('/calculate')} />}
        />
      ) : null}

      {saved.savedCalculations.length > 0 ? (
        <>
          <SectionHeader title="Saved trips" caption="Reopen to recalculate with the latest tariffs." />
          <Card padded={false}>
            {saved.savedCalculations.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Divider inset={spacing.lg} /> : null}
                <ListRow
                  icon="routes"
                  title={c.label}
                  subtitle={describe(c)}
                  onPress={() => router.push({ pathname: '/calculate', params: { saved: c.id } })}
                  right={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${c.label}`}
                      hitSlop={10}
                      onPress={() =>
                        confirmDestructive({ title: `Delete “${c.label}”?`, action: 'Delete' }, () => {
                          saved.removeCalculation(c.id);
                          toast('Deleted');
                        })
                      }>
                      <Icon name="trash-can-outline" size={20} color={colors.ink500} />
                    </Pressable>
                  }
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {favourites.length > 0 ? (
        <>
          <SectionHeader title="Favourite plazas" />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {favourites.map((p, i) => (
              <View key={p.id}>
                {i > 0 ? <Divider inset={spacing.lg} /> : null}
                <PlazaRow info={computePlazaInfo(data, p, today)} vehicleClass={defaultClass} favourite />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {saved.recentCalculations.length > 0 ? (
        <>
          <SectionHeader
            title="Recent calculations"
            action={
              <Button
                label="Clear"
                variant="ghost"
                size="sm"
                accessibilityLabel="Clear recent calculations"
                onPress={() =>
                  confirmDestructive(
                    {
                      title: 'Clear recent calculations?',
                      message: 'Saved trips are kept.',
                      action: 'Clear',
                    },
                    () => {
                      saved.clearRecent('calculations');
                      toast('Recent calculations cleared');
                    },
                  )
                }
              />
            }
          />
          <Card padded={false}>
            {saved.recentCalculations.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Divider inset={spacing.lg} /> : null}
                <ListRow
                  icon="history"
                  title={c.label}
                  subtitle={describe(c)}
                  onPress={() => router.push({ pathname: '/calculate', params: { saved: c.id } })}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {recentPlazas.length > 0 ? (
        <>
          <SectionHeader
            title="Recently viewed plazas"
            action={
              <Button
                label="Clear"
                variant="ghost"
                size="sm"
                accessibilityLabel="Clear recently viewed plazas"
                onPress={() =>
                  confirmDestructive(
                    {
                      title: 'Clear recently viewed plazas?',
                      message: 'Favourite plazas are kept.',
                      action: 'Clear',
                    },
                    () => {
                      saved.clearRecent('plazas');
                      toast('Recently viewed plazas cleared');
                    },
                  )
                }
              />
            }
          />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {recentPlazas.map((p, i) => (
              <View key={p.id}>
                {i > 0 ? <Divider inset={spacing.lg} /> : null}
                <PlazaRow
                  info={computePlazaInfo(data, p, today)}
                  vehicleClass={defaultClass}
                  favourite={saved.isFavourite(p.id)}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {!nothing ? (
        <AppText variant="small" color={colors.ink500}>
          Saved items stay on this device. Uninstalling Toll-E removes them. To clear your history or delete everything,
          go to More → Privacy.
        </AppText>
      ) : null}
    </Screen>
  );
}
