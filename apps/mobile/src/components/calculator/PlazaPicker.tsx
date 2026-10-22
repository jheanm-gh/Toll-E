import { searchPlazas } from '@toll-e/core';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteBadge } from '@/components/plaza/RouteBadge';
import { AppText, Button, Divider, Icon, TextField } from '@/components/ui';
import { useData } from '@/data/DataProvider';
import { colors, spacing, touchTarget } from '@/theme/tokens';

/** Searchable list for adding plazas to a manual trip. */
export function PlazaPicker({
  visible,
  selectedIds,
  onAdd,
  onClose,
}: {
  visible: boolean;
  selectedIds: readonly string[];
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const { dataset } = useData();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchPlazas(dataset, { query }), [dataset, query]);
  const operators = useMemo(() => new Map(dataset.operators.map((o) => [o.id, o.shortName])), [dataset]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <AppText variant="title" style={{ flex: 1 }}>
            Add toll plazas
          </AppText>
          <Button label="Done" size="sm" onPress={onClose} />
        </View>
        <View style={styles.search}>
          <TextField
            icon="magnify"
            placeholder="Search by plaza, road or operator"
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            autoFocus
          />
          <AppText variant="small" color={colors.ink500}>
            Add plazas in the order you will pass them. Include ramp plazas only if you use those ramps.
          </AppText>
        </View>
        <FlatList
          data={results}
          keyExtractor={(r) => r.plaza.id}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <Divider inset={spacing.lg} />}
          renderItem={({ item }) => {
            const added = selectedIds.includes(item.plaza.id);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: added }}
                accessibilityLabel={`${item.plaza.name}, ${item.plaza.route}${added ? ', added' : ''}`}
                disabled={added}
                onPress={() => onAdd(item.plaza.id)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}>
                <RouteBadge route={item.plaza.route} size="sm" />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong" color={added ? colors.ink500 : colors.ink900}>
                    {item.plaza.name}
                  </AppText>
                  <AppText variant="small" color={colors.ink500}>
                    {operators.get(item.plaza.operatorId)} ·{' '}
                    {item.plaza.type === 'unknown' ? 'type not confirmed' : item.plaza.type}
                  </AppText>
                </View>
                <Icon
                  name={added ? 'check-circle' : 'plus-circle-outline'}
                  size={24}
                  color={added ? colors.success : colors.teal600}
                />
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  search: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget + 8,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
});
